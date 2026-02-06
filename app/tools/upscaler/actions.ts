"use server";

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

interface UpscaleParams {
    image: string;
    scale?: number;
    model_name?: string;
    face_enhance?: boolean;
    face_enhance_strength?: number;
    output_format?: string;
}

export async function upscaleImage(params: UpscaleParams) {
    try {
        if (!REPLICATE_API_TOKEN) {
            throw new Error("Replicate API token not configured");
        }

        const {
            image,
            scale = 2,
            face_enhance = false,
            face_enhance_strength = 0.5,
            model_name = "Standard V2",
            output_format = "png",
        } = params;

        if (!image) {
            throw new Error("Image is required");
        }

        // Start prediction using model predictions endpoint
        const startResponse = await fetch(
            "https://api.replicate.com/v1/models/topazlabs/image-upscale/predictions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
                    "Content-Type": "application/json",
                    Prefer: "wait",
                },
                body: JSON.stringify({
                    input: {
                        image,
                        upscale_factor: `${scale}x`,
                        enhance_model: model_name,
                        face_enhancement: face_enhance,
                        face_enhancement_strength: face_enhance_strength,
                        output_format,
                    },
                }),
            }
        );

        if (!startResponse.ok) {
            const errorData = await startResponse.json();
            console.error("Replicate API error:", errorData);
            throw new Error(errorData.detail || "Failed to start prediction");
        }

        const prediction = await startResponse.json();

        // If the prediction is already complete (Prefer: wait header worked)
        if (prediction.status === "succeeded") {
            return {
                success: true,
                output: prediction.output,
                id: prediction.id,
            };
        }

        // If still processing, poll for result
        if (prediction.status === "processing" || prediction.status === "starting") {
            const result = await pollForResult(prediction.id);
            return {
                success: true,
                output: result.output,
                id: result.id,
            };
        }

        // If failed
        if (prediction.status === "failed") {
            throw new Error(prediction.error || "Prediction failed");
        }

        return {
            success: true,
            output: prediction.output,
            id: prediction.id,
            status: prediction.status,
        };
    } catch (error) {
        console.error("Upscaler error:", error);
        throw error;
    }
}

async function pollForResult(predictionId: string, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
                Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
            },
        });

        const prediction = await response.json();

        if (prediction.status === "succeeded") {
            return prediction;
        }

        if (prediction.status === "failed" || prediction.status === "canceled") {
            throw new Error(prediction.error || "Prediction failed");
        }

        // Wait 1 second before polling again
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("Prediction timed out");
}
