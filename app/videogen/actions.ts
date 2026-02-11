'use server';

const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';

export async function getCredits() {
    if (!process.env.RUNWAY_API_KEY) {
        throw new Error('RUNWAY_API_KEY is not configured.');
    }

    try {
        const response = await fetch(`${RUNWAY_API_URL}/organization`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
                'X-Runway-Version': '2024-11-06',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch credits');
        }

        const data = await response.json();
        return {
            creditBalance: data.creditBalance || 0,
            tier: data.tier || {}
        };
    } catch (error) {
        console.error('getCredits error:', error);
        return null;
    }
}

export async function generateVideo(
    prompt: string,
    imageUrl: string,
    model: string = 'gen4_turbo',
    ratio: string = '1280:720',
    duration: number = 5,
    endImageUrl: string = '',
    includeAudio: boolean = false
) {

    if (!process.env.RUNWAY_API_KEY) {
        throw new Error('RUNWAY_API_KEY is not configured. Please add it to Vercel Settings.');
    }

    try {
        console.log(`Starting Runway generation with model: ${model}, duration: ${duration}...`);

        // Veo uses text_to_video endpoint if no image
        // Otherwise uses image_to_video
        const isVeo = model === 'veo3' || model === 'veo3.1';
        // Determine endpoint based on input type (Image vs Text only)
        const endpoint = imageUrl ? 'image_to_video' : 'text_to_video';

        let body: any = {
            model: isVeo ? 'veo3.1' : (model === 'gen4_turbo' && endpoint === 'text_to_video' ? 'gen4.5' : model),
            promptText: prompt,
            ratio: ratio,
        };

        // Handle specific payload differences per model
        if (isVeo) {
            if (endpoint === 'image_to_video') {
                // Veo image_to_video requires promptImage as an array
                body.promptImage = [];

                if (imageUrl) {
                    body.promptImage.push({
                        uri: imageUrl,
                        position: 'first'
                    });
                }

                if (endImageUrl) {
                    body.promptImage.push({
                        uri: endImageUrl,
                        position: 'last'
                    });
                }
            }

            // Veo uses 'audio' boolean, not 'removeAudio'
            body.audio = includeAudio;
            body.duration = duration;
            body.seed = 1115473149;
        } else {
            // Gen-4 Accepts simple string for image
            if (imageUrl) {
                body.promptImage = imageUrl;
            }
            // Gen-4 supports duration (5 or 10)
            body.duration = duration;
            body.seed = 4291861214;
        }

        // 1. Initiate Generation Task
        const createResponse = await fetch(`${RUNWAY_API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
                'Content-Type': 'application/json',
                'X-Runway-Version': '2024-11-06',
            },
            body: JSON.stringify(body),
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Runway creation error:', createResponse.status, errorText);
            throw new Error(`Failed to start video generation: ${createResponse.statusText}. Details: ${errorText}`);
        }

        const { id: taskId } = await createResponse.json();
        console.log('Video generation started, Task ID:', taskId);

        // 2. Poll for Completion
        let status = 'PENDING';
        let output = null;
        let attempts = 0;
        const maxAttempts = 120;

        while (status !== 'SUCCEEDED' && status !== 'FAILED' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;

            const statusResponse = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
                    'X-Runway-Version': '2024-11-06',
                },
            });

            if (!statusResponse.ok) {
                continue;
            }

            const statusData = await statusResponse.json();
            status = statusData.status;
            console.log(`Polling task ${taskId}: ${status}`);

            if (status === 'SUCCEEDED') {
                output = statusData.output;
            } else if (status === 'FAILED') {
                const failureReason = statusData.failureCode || statusData.failureReason || 'Unknown error';
                throw new Error(`Video generation failed: ${failureReason}`);
            }
        }

        if (status !== 'SUCCEEDED' || !output) {
            throw new Error('Video generation timed out or returned no valid output.');
        }

        return { output };

    } catch (error) {
        console.error('generateVideo error:', error);
        throw error;
    }
}
