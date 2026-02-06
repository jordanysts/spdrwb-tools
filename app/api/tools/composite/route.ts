import { NextRequest, NextResponse } from 'next/server'

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN

export async function POST(req: NextRequest) {
  try {
    if (!REPLICATE_API_TOKEN) {
      return NextResponse.json(
        { error: 'Replicate API token not configured' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { faceImage, bodyImage } = body

    if (!faceImage || !bodyImage) {
      return NextResponse.json(
        { error: 'Both face and body images required' },
        { status: 400 }
      )
    }

    // Use codeplugtech/face-swap model
    // input_image = target (where face goes) = bodyImage (original source)
    // swap_image = source face = faceImage (edited face from expression editor)
    const startResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        version: '278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34',
        input: {
          input_image: bodyImage,  // Original source image (target)
          swap_image: faceImage,   // Edited face (source)
        },
      }),
    })

    if (!startResponse.ok) {
      const errorData = await startResponse.json()
      console.error('Replicate face-swap error:', errorData)
      return NextResponse.json(
        { error: errorData.detail || 'Failed to start face swap' },
        { status: startResponse.status }
      )
    }

    const prediction = await startResponse.json()

    // If completed immediately (Prefer: wait worked)
    if (prediction.status === 'succeeded') {
      const outputUrl = prediction.output
      return NextResponse.json({
        success: true,
        image: outputUrl,
      })
    }

    // If still processing, poll for result
    if (prediction.status === 'processing' || prediction.status === 'starting') {
      const result = await pollForResult(prediction.id)
      return NextResponse.json({
        success: true,
        image: result.output,
      })
    }

    // If failed
    if (prediction.status === 'failed') {
      return NextResponse.json(
        { error: prediction.error || 'Face swap failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image: prediction.output,
    })

  } catch (error: unknown) {
    console.error('Composite error:', error)
    const message = error instanceof Error ? error.message : 'Failed to composite images'
    return NextResponse.json({ error: message }, { status: 500 })
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
    )

    const prediction = await response.json()

    if (prediction.status === 'succeeded') {
      return prediction
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || 'Face swap failed')
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Face swap timed out')
}
