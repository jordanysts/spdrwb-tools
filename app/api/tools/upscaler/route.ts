import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
import { auth } from '@/auth';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

export async function POST(request: NextRequest) {
    try {
        if (!REPLICATE_API_TOKEN) {
            return NextResponse.json(
                { error: 'Replicate API token not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const {
            image,
            scale = 2,
            face_enhance = false,
            face_enhance_strength = 0.5,
            model_name = 'Standard V2',
            output_format = 'png'
        } = body;

        if (!image) {
            return NextResponse.json(
                { error: 'Image is required' },
                { status: 400 }
            );
        }

        // Track provider call
        try {
            const session = await auth();
            trackEvent({
                type: 'provider_call',
                path: '/api/tools/upscaler',
                user: session?.user?.email || 'unknown',
                timestamp: new Date().toISOString(),
                provider: 'replicate',
            }).catch(() => {});
        } catch {}

        // Start prediction using model predictions endpoint
        const startResponse = await fetch('https://api.replicate.com/v1/models/topazlabs/image-upscale/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait',
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
        });

        if (!startResponse.ok) {
            const errorData = await startResponse.json();
            console.error('Replicate API error:', errorData);
            return NextResponse.json(
                { error: errorData.detail || 'Failed to start prediction' },
                { status: startResponse.status }
            );
        }

        const prediction = await startResponse.json();

        // If the prediction is already complete (Prefer: wait header worked)
        if (prediction.status === 'succeeded') {
            return NextResponse.json({
                success: true,
                output: prediction.output,
                id: prediction.id,
            });
        }

        // If still processing, poll for result
        if (prediction.status === 'processing' || prediction.status === 'starting') {
            const result = await pollForResult(prediction.id);
            return NextResponse.json({
                success: true,
                output: result.output,
                id: result.id,
            });
        }

        // If failed
        if (prediction.status === 'failed') {
            return NextResponse.json(
                { error: prediction.error || 'Prediction failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            output: prediction.output,
            id: prediction.id,
            status: prediction.status,
        });

    } catch (error) {
        console.error('Upscaler error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
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
