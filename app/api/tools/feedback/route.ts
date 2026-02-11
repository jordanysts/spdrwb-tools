import { NextRequest, NextResponse } from 'next/server'
import { put, list, del } from '@vercel/blob'

const FEEDBACK_BLOB_NAME = 'feedback-data.json'

export interface FeedbackItem {
  id: string
  type: 'bug' | 'feature' | 'improvement' | 'other'
  title: string
  description: string
  tool: string
  submittedBy: string
  status: 'new' | 'in-progress' | 'done' | 'dismissed'
  adminNote: string
  createdAt: string
  updatedAt: string
}

async function loadFeedback(): Promise<FeedbackItem[]> {
  try {
    const { blobs } = await list({ prefix: FEEDBACK_BLOB_NAME })
    if (blobs.length === 0) return []

    // Get the most recent blob
    const latestBlob = blobs.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0]

    const response = await fetch(latestBlob.url)
    if (!response.ok) return []
    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Error loading feedback from blob:', error)
    return []
  }
}

async function saveFeedback(items: FeedbackItem[]) {
  // Clean up old blobs first
  try {
    const { blobs } = await list({ prefix: FEEDBACK_BLOB_NAME })
    for (const blob of blobs) {
      await del(blob.url)
    }
  } catch {
    // Ignore cleanup errors
  }

  // Save new data
  await put(FEEDBACK_BLOB_NAME, JSON.stringify(items, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  })
}

// GET - List all feedback
export async function GET() {
  try {
    const items = await loadFeedback()
    // Sort by newest first
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return NextResponse.json({ items })
  } catch (error) {
    console.error('Error reading feedback:', error)
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 })
  }
}

// POST - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, title, description, tool, submittedBy } = body

    if (!title || !type) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 })
    }

    const items = await loadFeedback()

    const newItem: FeedbackItem = {
      id: crypto.randomUUID(),
      type: type || 'other',
      title: title.trim(),
      description: (description || '').trim(),
      tool: (tool || 'General').trim(),
      submittedBy: (submittedBy || 'Anonymous').trim(),
      status: 'new',
      adminNote: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    items.push(newItem)
    await saveFeedback(items)

    return NextResponse.json({ item: newItem }, { status: 201 })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}

// PATCH - Update feedback status/notes (admin)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, adminNote } = body

    if (!id) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 })
    }

    const items = await loadFeedback()
    const index = items.findIndex(item => item.id === id)

    if (index === -1) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    if (status) items[index].status = status
    if (adminNote !== undefined) items[index].adminNote = adminNote
    items[index].updatedAt = new Date().toISOString()

    await saveFeedback(items)

    return NextResponse.json({ item: items[index] })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }
}

// DELETE - Remove feedback item (admin)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Feedback ID is required' }, { status: 400 })
    }

    const items = await loadFeedback()
    const filtered = items.filter(item => item.id !== id)

    if (filtered.length === items.length) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    await saveFeedback(filtered)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
  }
}