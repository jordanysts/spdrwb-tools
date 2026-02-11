import { NextRequest, NextResponse } from 'next/server';
import { trackEvent } from '@/lib/analytics';
import { auth } from '@/auth';

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1';

export async function POST(request: NextRequest) {
  if (!RUNWAY_API_KEY) {
    return NextResponse.json({ error: 'Runway API key not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, taskId, promptImage, promptText, model, duration, ratio } = body;

    // Poll for task status
    if (action === 'status' && taskId) {
      const response = await fetch(`${RUNWAY_API_URL}/tasks/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Runway status error:', errorText);
        return NextResponse.json({ error: `Failed to get task status: ${response.status}` }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    // Create new generation task (track provider call)
    if (action === 'generate') {
      try {
        const session = await auth();
        trackEvent({
          type: 'provider_call',
          path: '/api/tools/runway',
          user: session?.user?.email || 'unknown',
          timestamp: new Date().toISOString(),
          provider: 'runway',
        }).catch(() => {});
      } catch {}
      // Build the request body based on Runway API specs
      const requestBody: Record<string, unknown> = {
        model: model || 'gen3a_turbo',
        ...(duration && { duration: parseInt(duration) }),
        ...(ratio && { ratio }),
      };

      // If we have an image, use image_to_video, otherwise text_to_video
      if (promptImage) {
        // Image to video generation
        requestBody.promptImage = promptImage;
        if (promptText) {
          requestBody.promptText = promptText;
        }

        const response = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Runway-Version': '2024-11-06',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Runway generation error:', errorText);
          return NextResponse.json({ error: `Failed to start generation: ${response.status} - ${errorText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

      } else if (promptText) {
        // Text to video generation (if supported)
        requestBody.promptText = promptText;

        const response = await fetch(`${RUNWAY_API_URL}/text_to_video`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Runway-Version': '2024-11-06',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Runway text-to-video error:', errorText);
          // Fallback message for text-only
          return NextResponse.json({ 
            error: 'Text-to-video may require an image. Please upload an image to generate video.' 
          }, { status: 400 });
        }

        const data = await response.json();
        return NextResponse.json(data);
      } else {
        return NextResponse.json({ error: 'Please provide an image or text prompt' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Runway API error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}
