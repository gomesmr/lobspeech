import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs';
import { SupportedFormat } from './types.js';

export function isWavHeader(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  return riff === 'RIFF' && wave === 'WAVE';
}

/**
 * Resolves the available FFmpeg binary path
 */
function getFfmpegBinary(): string {
  if (typeof ffmpegPath === 'string' && fs.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }
  if (fs.existsSync('/usr/bin/ffmpeg')) {
    return '/usr/bin/ffmpeg';
  }
  return 'ffmpeg';
}

/**
 * Creates a standard WAV header from raw 16-bit PCM buffer (pure JS fallback)
 */
export function pcmToWav(pcmData: Buffer, sampleRate: number = 24000, numChannels: number = 1): Buffer {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const wavHeader = Buffer.alloc(44);

  // RIFF identifier
  wavHeader.write('RIFF', 0);
  // file length minus 8 bytes
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  // WAVE identifier
  wavHeader.write('WAVE', 8);
  // fmt chunk identifier
  wavHeader.write('fmt ', 12);
  // chunk length
  wavHeader.writeUInt32LE(16, 16);
  // sample format (1 = PCM)
  wavHeader.writeUInt16LE(1, 20);
  // channel count
  wavHeader.writeUInt16LE(numChannels, 22);
  // sample rate
  wavHeader.writeUInt32LE(sampleRate, 24);
  // byte rate
  wavHeader.writeUInt32LE(byteRate, 28);
  // block align
  wavHeader.writeUInt16LE(blockAlign, 32);
  // bits per sample
  wavHeader.writeUInt16LE(16, 34);
  // data chunk identifier
  wavHeader.write('data', 36);
  // data chunk length
  wavHeader.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([wavHeader, pcmData]);
}

/**
 * Converts raw audio or PCM/WAV buffer to the requested format (MP3, WAV, OGG)
 * and adjusts speech speed using FFmpeg.
 */
export async function convertAudio(
  inputBuffer: Buffer,
  options: {
    format: SupportedFormat;
    speed?: number;
    sampleRate?: number;
  }
): Promise<Buffer> {
  const { format, speed = 1.0, sampleRate = 24000 } = options;

  return new Promise((resolve, reject) => {
    const isWav = isWavHeader(inputBuffer);
    const binary = getFfmpegBinary();
    const args: string[] = [];

    // Input configuration
    if (isWav) {
      args.push('-i', 'pipe:0');
    } else {
      // Raw 16-bit PCM little-endian, mono, 24kHz from Gemini TTS
      args.push('-f', 's16le', '-ar', sampleRate.toString(), '-ac', '1', '-i', 'pipe:0');
    }

    // Audio filter for speed/tempo modification
    const filters: string[] = [];
    if (Math.abs(speed - 1.0) > 0.01) {
      // FFmpeg atempo filter works between 0.5 and 2.0 natively
      filters.push(`atempo=${speed}`);
    }

    if (filters.length > 0) {
      args.push('-filter:a', filters.join(','));
    }

    // Output format configuration - Voice optimized: 64 kbps Mono (44.1 kHz) for podcasts/audiobooks/TTS
    if (format === 'mp3') {
      args.push(
        '-ar', '44100',
        '-ac', '1',
        '-c:a', 'libmp3lame',
        '-b:a', '64k',
        '-id3v2_version', '3',
        '-write_id3v1', '1',
        '-f', 'mp3',
        'pipe:1'
      );
    } else if (format === 'ogg') {
      args.push(
        '-ar', '44100',
        '-ac', '1',
        '-c:a', 'libvorbis',
        '-q:a', '3',
        '-f', 'ogg',
        'pipe:1'
      );
    } else {
      // WAV format (16-bit PCM 44.1kHz mono)
      args.push(
        '-ar', '44100',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-f', 'wav',
        'pipe:1'
      );
    }

    const ffmpeg = spawn(binary, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const errorMsg = Buffer.concat(errorChunks).toString('utf-8');
        reject(new Error(`FFmpeg error (exit code ${code}): ${errorMsg}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Falha ao executar FFmpeg: ${err.message}`));
    });

    // Write the audio data into ffmpeg stdin
    ffmpeg.stdin.write(inputBuffer);
    ffmpeg.stdin.end();
  });
}

/**
 * Returns the MIME type corresponding to a supported format.
 */
export function getMimeType(format: SupportedFormat): string {
  switch (format) {
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'wav':
    default:
      return 'audio/wav';
  }
}
