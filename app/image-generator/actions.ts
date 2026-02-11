'use server';

import { GoogleGenAI, Modality } from "@google/genai";

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const BFL_API_KEY = process.env.BFL_API_KEY;

// Retry helper with exponential backoff (from spdrstudio photobooth)
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            console.log(`Attempt ${attempt + 1} failed:`, error.message);

            // Don't retry on certain errors
            if (error.message?.includes('safety') ||
                error.message?.includes('blocked') ||
                error.message?.includes('invalid')) {
                throw error;
            }

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

async function generateWithGemini(prompt: string, aspectRatio: string, imageSize: string, modelName: string, inputImage?: string | null) {
    if (!GOOGLE_AI_KEY) {
        throw new Error('Missing Google AI API Key');
    }

    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_KEY });

    const response = await ai.models.generateContent({
        model: modelName,
        contents: [
            {
                role: "user",
                parts: [
                    { text: prompt },
                    ...(inputImage ? [{
                        inlineData: {
                            mimeType: inputImage.split(';')[0].split(':')[1],
                            data: inputImage.split(',')[1]
                        }
                    }] : [])
                ],
            },
        ],
        config: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
            responseModalities: [Modality.IMAGE],
            imageConfig: {
                aspectRatio: aspectRatio,
                // Only set imageSize for gemini-3-pro-image-preview
                ...(modelName === "gemini-3-pro-image-preview" ? { imageSize: imageSize } : {}),
            },
        } as any,
    });

    const result = response.candidates?.[0]?.content?.parts;
    if (!result) {
        const finishReason = response.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error('Image generation blocked due to safety settings.');
        }
        throw new Error('AI could not generate a response. Please try again.');
    }

    for (const part of result) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }

    throw new Error('No image was generated. Please try again.');
}

async function generateWithSeeDream(prompt: string, aspectRatio: string, inputImage?: string | null) {
    if (!REPLICATE_API_TOKEN) {
        throw new Error('Missing Replicate API Token');
    }

    // Map aspect ratio to SeeDream format
    const aspectRatioMap: Record<string, string> = {
        "1:1": "1:1",
        "16:9": "16:9",
        "9:16": "9:16",
        "4:3": "4:3",
        "3:4": "3:4",
    };

    const response = await fetch("https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            input: {
                prompt: prompt,
                aspect_ratio: aspectRatioMap[aspectRatio] || "1:1",
                num_outputs: 1,
                ...(inputImage ? { image: inputImage } : {})
            },
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Replicate API error: ${error}`);
    }

    const prediction = await response.json();
    const predictionId = prediction.id;

    // Poll for completion
    let result;
    for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}`,
            {
                headers: {
                    "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
                },
            }
        );

        result = await statusResponse.json();

        if (result.status === "succeeded") {
            if (result.output && result.output[0]) {
                // Convert URL to base64
                const imageResponse = await fetch(result.output[0]);
                const arrayBuffer = await imageResponse.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                return `data:image/png;base64,${base64}`;
            }
            throw new Error("No output from Replicate");
        }

        if (result.status === "failed") {
            throw new Error(result.error || "Generation failed");
        }
    }

    throw new Error("Generation timed out");
}

async function generateWithFlux(prompt: string, aspectRatio: string) {
    if (!BFL_API_KEY) {
        throw new Error('Missing Black Forest Labs API Key');
    }

    // Map aspect ratio to Flux format (width x height)
    const aspectRatioMap: Record<string, { width: number; height: number }> = {
        "1:1": { width: 1024, height: 1024 },
        "16:9": { width: 1344, height: 768 },
        "9:16": { width: 768, height: 1344 },
        "4:3": { width: 1152, height: 896 },
        "3:4": { width: 896, height: 1152 },
    };

    const dimensions = aspectRatioMap[aspectRatio] || { width: 1024, height: 1024 };

    console.log("Flux Klein: Creating generation request...");

    // Step 1: Create the generation request using NEW BFL API (api.bfl.ai)
    const response = await fetch("https://api.bfl.ai/v1/flux-2-klein-9b", {
        method: "POST",
        headers: {
            "accept": "application/json",
            "x-key": BFL_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: prompt,
            width: dimensions.width,
            height: dimensions.height,
            guidance: 3.0,
            steps: 28,
            output_format: "jpeg",
            safety_tolerance: 2
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error("BFL API Error:", error);
        throw new Error(`BFL API error: ${error}`);
    }

    const createData = await response.json();
    console.log("Flux Klein: Request created:", createData.id);

    const pollingUrl = createData.polling_url;

    // Step 2: Poll for the result using polling_url
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds max (500ms intervals)

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const pollResponse = await fetch(pollingUrl, {
            headers: {
                "accept": "application/json",
                "x-key": BFL_API_KEY
            }
        });

        const pollData = await pollResponse.json();
        console.log(`Flux Klein: Poll attempt ${attempts + 1}: ${pollData.status}`);

        if (pollData.status === "Ready") {
            // Image is ready - fetch and convert to base64
            const imageUrl = pollData.result.sample;
            const imageResponse = await fetch(imageUrl);
            const arrayBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            console.log("Flux Klein: Generation complete");
            return `data:image/jpeg;base64,${base64}`;
        }

        if (pollData.status === "Error" || pollData.status === "Failed") {
            console.error("Generation failed:", pollData);
            throw new Error(pollData.error || "Generation failed");
        }

        attempts++;
    }

    throw new Error("Generation timed out - request took too long to complete");
}

export async function generateImageAction({
    prompt,
    aspectRatio = "1:1",
    imageSize = "2K",
    model = "gemini-flash",
    image = null
}: {
    modelId?: string;
    prompt: string;
    aspectRatio?: string;
    imageSize?: string;
    model?: string;
    image?: string | null;
}) {
    try {
        let generatedImage: string;

        // Map UI model names to actual model names
        const modelMap: Record<string, string> = {
            "gemini-pro": "gemini-3-pro-image-preview",
            "gemini-flash": "gemini-2.5-flash-image",
            "seedream": "seedream",
            "flux-klein": "flux-klein",
        };

        const actualModel = modelMap[model] || "gemini-2.5-flash-image";

        // Check if model supports image references
        if (model === "flux-klein" && image) {
            return { success: false, error: 'Flux Klein does not support image references. Please use Gemini or SeeDream for image-to-image.' };
        }

        // Retry logic with exponential backoff
        generatedImage = await retryWithBackoff(async () => {
            if (model === "seedream") {
                return await generateWithSeeDream(prompt, aspectRatio, image);
            } else if (model === "flux-klein") {
                return await generateWithFlux(prompt, aspectRatio);
            } else {
                return await generateWithGemini(prompt, aspectRatio, imageSize, actualModel, image);
            }
        }, 3, 3000); // 3 retries, starting with 3 second delay

        return { success: true, output: generatedImage };

    } catch (error: unknown) {
        console.error("Error generating image:", error);

        // Provide user-friendly error messages
        if (error instanceof Error) {
            if (error.message?.includes('quota') || error.message?.includes('rate')) {
                return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
            } else if (error.message?.includes('overloaded') || error.message?.includes('503')) {
                return { success: false, error: 'Service is currently overloaded. Retrying automatically...' };
            } else if (error.message?.includes('timeout')) {
                return { success: false, error: 'Request timed out. Please try again.' };
            }
            return { success: false, error: error.message || 'Failed to generate image' };
        }
        return { success: false, error: 'Failed to generate image' };
    }
}
