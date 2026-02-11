'use server';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

interface ExpressionParams {
    image: string;
    rotate_pitch?: number;
    rotate_yaw?: number;
    rotate_roll?: number;
    blink?: number;
    eyebrow?: number;
    wink?: number;
    pupil_x?: number;
    pupil_y?: number;
    aaa?: number;
    eee?: number;
    woo?: number;
    smile?: number;
    src_ratio?: number;
    sample_ratio?: number;
    crop_factor?: number;
    output_format?: string;
    output_quality?: number;
}

export async function generateExpression(params: ExpressionParams) {
    try {
        if (!REPLICATE_API_TOKEN) {
            throw new Error('Replicate API token not configured');
        }

        if (!params.image) {
            throw new Error('Image is required');
        }

        // Start prediction using standard predictions endpoint with version
        const startResponse = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait',
            },
            body: JSON.stringify({
                version: 'bf913bc90e1c44ba288ba3942a538693b72e8cc7df576f3beebe56adc0a92b86',
                input: {
                    image: params.image,
                    rotate_pitch: params.rotate_pitch ?? 0,
                    rotate_yaw: params.rotate_yaw ?? 0,
                    rotate_roll: params.rotate_roll ?? 0,
                    blink: params.blink ?? 0,
                    eyebrow: params.eyebrow ?? 0,
                    wink: params.wink ?? 0,
                    pupil_x: params.pupil_x ?? 0,
                    pupil_y: params.pupil_y ?? 0,
                    aaa: params.aaa ?? 0,
                    eee: params.eee ?? 0,
                    woo: params.woo ?? 0,
                    smile: params.smile ?? 0,
                    src_ratio: params.src_ratio ?? 1,
                    sample_ratio: params.sample_ratio ?? 1,
                    crop_factor: params.crop_factor ?? 1.7,
                    output_format: params.output_format ?? 'webp',
                    output_quality: params.output_quality ?? 95,
                },
            }),
        });

        if (!startResponse.ok) {
            const errorData = await startResponse.json();
            console.error('Replicate API error:', errorData);
            throw new Error(errorData.detail || 'Failed to start prediction');
        }

        const prediction = await startResponse.json();

        // If the prediction is already complete (Prefer: wait header worked)
        if (prediction.status === 'succeeded') {
            return {
                success: true,
                output: prediction.output,
                id: prediction.id,
            };
        }

        // If still processing, poll for result
        if (prediction.status === 'processing' || prediction.status === 'starting') {
            const result = await pollForResult(prediction.id);
            return {
                success: true,
                output: result.output,
                id: result.id,
            };
        }

        // If failed
        if (prediction.status === 'failed') {
            throw new Error(prediction.error || 'Prediction failed');
        }

        return {
            success: true,
            output: prediction.output,
            id: prediction.id,
            status: prediction.status,
        };

    } catch (error) {
        console.error('Expression editor error:', error);
        // Return error instead of throwing for better Next.js server action handling
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        };
    }
}

async function pollForResult(predictionId: string, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(
            `https://api.replicate.com/v1/predictions/${predictionId}`,
            {
                headers: {
                    'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                },
            }
        );

        const prediction = await response.json();

        if (prediction.status === 'succeeded') {
            return prediction;
        }

        if (prediction.status === 'failed' || prediction.status === 'canceled') {
            throw new Error(prediction.error || 'Prediction failed');
        }

        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Prediction timed out');
}
