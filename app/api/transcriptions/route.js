import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Fetch all transcriptions from Database
export async function GET() {
  try {
    const transcriptions = await prisma.transcription.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(transcriptions);
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    return NextResponse.json({ error: 'Failed to fetch transcriptions', details: error.message }, { status: 500 });
  }
}

// POST: Save a new transcription to Database
export async function POST(request) {
  try {
    const { text, language } = await request.json();

    if (!text || text.trim() === '') {
      return NextResponse.json({ error: 'Transcription text is required' }, { status: 400 });
    }

    const newTranscription = await prisma.transcription.create({
      data: {
        text: text.trim(),
        language: language || 'hi-IN',
      },
    });

    return NextResponse.json(newTranscription, { status: 201 });
  } catch (error) {
    console.error('Error saving transcription:', error);
    return NextResponse.json({ error: 'Failed to save transcription', details: error.message }, { status: 500 });
  }
}
