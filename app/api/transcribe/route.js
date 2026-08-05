import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(request) {
  try {
    const { audioBase64, mimeType, promptText } = await request.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_groq_api_key')) {
      return NextResponse.json(
        { 
          error: 'GROQ_API_KEY is missing.', 
          message: 'Please add GROQ_API_KEY in .env file from https://console.groq.com' 
        }, 
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: apiKey.trim() });

    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const file = await Groq.toFile(audioBuffer, 'audio.webm', { type: mimeType || 'audio/webm' });

      const transcription = await groq.audio.transcriptions.create({
        file: file,
        model: 'whisper-large-v3-turbo',
        response_format: 'json',
        prompt: 'Transcribe spoken audio in Hindi, English, or Hinglish accurately.',
      });

      return NextResponse.json({
        success: true,
        text: transcription.text.trim(),
      });
    }

    if (promptText) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.7,
        max_completion_tokens: 2048,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      return NextResponse.json({
        success: true,
        text: responseText.trim(),
      });
    }

    return NextResponse.json({ error: 'No audio data or text provided.' }, { status: 400 });
  } catch (error) {
    console.error('Transcription API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}
