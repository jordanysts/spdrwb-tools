import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const TINYPNG_API_KEY = process.env.TINYPNG_API_KEY;

export async function POST(request: NextRequest) {
    try {
        if (!TINYPNG_API_KEY) {
            return NextResponse.json({ error: 'TinyPNG API key not configured' }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as Blob;
        
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert Blob to ArrayBuffer
        const buffer = await file.arrayBuffer();

        // Send to TinyPNG API
        const uploadResponse = await fetch('https://api.tinify.com/shrink', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`api:${TINYPNG_API_KEY}`).toString('base64')}`,
            },
            body: buffer,
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            console.error('TinyPNG upload error:', errorData);
            return NextResponse.json({ 
                error: errorData.message || `TinyPNG error: ${uploadResponse.status}` 
            }, { status: uploadResponse.status });
        }

        const uploadResult = await uploadResponse.json();
        console.log('TinyPNG result:', uploadResult);

        // Get the optimized image URL from TinyPNG
        const outputUrl = uploadResult.output?.url;
        
        if (!outputUrl) {
            return NextResponse.json({ error: 'No output URL from TinyPNG' }, { status: 500 });
        }

        // Download the optimized image from TinyPNG
        const downloadResponse = await fetch(outputUrl, {
            headers: {
                'Authorization': `Basic ${Buffer.from(`api:${TINYPNG_API_KEY}`).toString('base64')}`,
            },
        });

        if (!downloadResponse.ok) {
            return NextResponse.json({ error: 'Failed to download optimized image' }, { status: 500 });
        }

        const optimizedBuffer = await downloadResponse.arrayBuffer();
        const optimizedBase64 = Buffer.from(optimizedBuffer).toString('base64');
        
        // Determine mime type from original file or output
        const mimeType = uploadResult.output?.type || 'image/png';

        return NextResponse.json({
            success: true,
            input: {
                size: uploadResult.input?.size,
                type: uploadResult.input?.type,
            },
            output: {
                size: uploadResult.output?.size,
                type: uploadResult.output?.type,
                ratio: uploadResult.output?.ratio,
                width: uploadResult.output?.width,
                height: uploadResult.output?.height,
            },
            // Return as data URL for easy display
            dataUrl: `data:${mimeType};base64,${optimizedBase64}`,
            compressionPercent: uploadResult.output?.ratio 
                ? Math.round((1 - uploadResult.output.ratio) * 100) 
                : 0,
        });

    } catch (error: any) {
        console.error('TinyPNG API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to compress image' },
            { status: 500 }
        );
    }
}
