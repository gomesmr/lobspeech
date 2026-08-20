import { GoogleGenAI, Modality } from '@google/genai';
import { convertAudio, getMimeType } from './audioConverter.js';
import { SupportedFormat } from './types.js';

let genAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

export interface SynthesizeOptions {
  text: string;
  voice: string;
  language: string;
  speed: number;
  format: SupportedFormat;
}

export interface SynthesizeResult {
  audioBuffer: Buffer;
  mimeType: string;
  format: SupportedFormat;
  characterCount: number;
  durationEstimatedSec: number;
}

/**
 * Synthesizes text to speech using Gemini TTS (gemini-3.1-flash-tts-preview)
 * and encodes to the target format with speed adjustments.
 */
export async function synthesizeSpeech(options: SynthesizeOptions): Promise<SynthesizeResult> {
  const { text, voice, language, speed, format } = options;
  const ai = getGenAiClient();

  // Validate voice name against Gemini TTS supported prebuilt voices
  const validVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
  const voiceName = validVoices.includes(voice) ? voice : 'Kore';

  // Construct prompt to ensure proper language pronunciation
  let promptText = text;
  if (language && !language.startsWith('en')) {
    // If not default english, ensure pronunciation guidance if needed
    // Gemini handles multilingual text naturally
    promptText = text;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-tts-preview',
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = part?.inlineData?.data;

  if (!base64Audio) {
    throw new Error('Não foi possível gerar áudio a partir do serviço de TTS.');
  }

  const rawPcmBuffer = Buffer.from(base64Audio, 'base64');

  // Convert raw 24kHz PCM to target format (MP3/WAV/OGG) and apply speed filter
  const processedBuffer = await convertAudio(rawPcmBuffer, {
    format,
    speed,
    sampleRate: 24000,
  });

  const mimeType = getMimeType(format);

  // PCM 16-bit mono 24000 Hz: 48,000 bytes per second
  const rawDurationSec = rawPcmBuffer.length / 48000;
  const durationEstimatedSec = speed > 0 ? Number((rawDurationSec / speed).toFixed(2)) : Number(rawDurationSec.toFixed(2));

  return {
    audioBuffer: processedBuffer,
    mimeType,
    format,
    characterCount: text.length,
    durationEstimatedSec,
  };
}
