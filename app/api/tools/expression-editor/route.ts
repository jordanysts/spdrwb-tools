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
      rotate_pitch = 0,
      rotate_yaw = 0,
      rotate_roll = 0,
      blink = 0,
      eyebrow = 0,
      wink = 0,
      pupil_x = 0,
      pupil_y = 0,
      aaa = 0,
      eee = 0,
      woo = 0,
      smile = 0,
      src_ratio = 1,
      sample_ratio = 1,
      crop_factor = 1.7,
      output_format = 'webp',
      output_quality = 95,
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
        path: '/api/tools/expression-editor',
        user: session?.user?.email || 'unknown',
        timestamp: new Date().toISOString(),
        provider: 'replicate',
      }).catch(() => {});
    } catch {}

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
          image,
          rotate_pitch,
          rotate_yaw,
          rotate_roll,
          blink,
          eyebrow,
          wink,
          pupil_x,
          pupil_y,
          aaa,
          eee,
          woo,
          smile,
          src_ratio,
          sample_ratio,
          crop_factor,
          output_format,
          output_quality,
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
    console.error('Expression editor error:', error);
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
