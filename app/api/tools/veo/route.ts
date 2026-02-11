import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { trackEvent } from '@/lib/analytics';
import { auth } from '@/auth';

export const maxDuration = 300; // 5 minutes for video generation

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;

export async function POST(request: NextRequest) {
    try {
        const { action, prompt, model, aspectRatio, resolution, operationName } = await request.json();

        if (!GOOGLE_AI_KEY) {
            return NextResponse.json({ error: 'Google AI API key not configured' }, { status: 500 });
        }

        if (action === 'generate') {
            // Track provider call
            try {
                const session = await auth();
                trackEvent({
                    type: 'provider_call',
                    path: '/api/tools/veo',
                    user: session?.user?.email || 'unknown',
                    timestamp: new Date().toISOString(),
                    provider: 'google-veo',
                }).catch(() => {});
            } catch {}

            // Generate video with Veo using the SDK
            const veoModel = model || 'veo-3.1-generate-preview';
            console.log(`Veo: Starting video generation with model ${veoModel}`);
            console.log(`Veo: Prompt: ${prompt?.substring(0, 100)}...`);

            try {
                const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);
                
                // Get the Veo model
                const videoModel = genAI.getGenerativeModel({ 
                    model: veoModel,
                    generationConfig: {
                        // Video-specific configuration
                    }
                });

                // Generate video
                const result = await videoModel.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                });

                console.log('Veo result:', JSON.stringify(result, null, 2));

                // Check for video in the response
                const response = result.response;
                console.log('Response:', JSON.stringify(response, null, 2));
                
                // The video should be in the response
                // For now, return the raw response to see what we get
                return NextResponse.json({
                    success: true,
                    data: response,
                    text: response.text(),
                });

            } catch (genError: any) {
                console.error('Veo generation error:', genError);
                console.error('Error details:', JSON.stringify(genError, null, 2));
                
                // Return detailed error for debugging
                return NextResponse.json({
                    error: genError.message || 'Failed to generate video',
                    details: genError.toString(),
                    stack: genError.stack,
                }, { status: 500 });
            }

        } else if (action === 'status') {
            // For now, just return that status checking isn't implemented
            // since we're not sure how the async video generation works yet
            return NextResponse.json({
                error: 'Status checking not yet implemented',
                done: false,
            });

        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Veo API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process request' },
            { status: 500 }
        );
    }
}
