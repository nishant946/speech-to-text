import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT: Edit existing transcription text
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { text, language } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Transcription text is required' }, { status: 400 });
    }

    const updated = await prisma.transcription.update({
      where: { id },
      data: {
        text: text.trim(),
        language: language,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating transcription:', error);
    return NextResponse.json({ error: 'Failed to update transcription', details: error.message }, { status: 500 });
  }
}

// DELETE: Remove transcription from Database
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    await prisma.transcription.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Deleted successfully', id });
  } catch (error) {
    console.error('Error deleting transcription:', error);
    return NextResponse.json({ error: 'Failed to delete transcription', details: error.message }, { status: 500 });
  }
}
