export type SupportedFormat = 'mp3' | 'wav' | 'ogg';

export type SupportedVoice = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' | 'feminina' | 'masculina';

export interface SynthesizeRequest {
  text: string;
  base_name?: string;
  voice?: string;
  language?: string;
  speed?: number;
  format?: SupportedFormat;
  split_paragraphs?: boolean;
  max_chunk_size?: number;
}

export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  description: string;
  recommendedLanguages: string[];
}

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ChunkSynthesisResult {
  index: number;
  totalChunks: number;
  filename: string;
  characterCount: number;
  durationEstimatedSec: number;
  audioBase64: string;
  dataUrl: string;
  mimeType: string;
  textSnippet: string;
  textFull: string;
}

export interface MultiChunkResponse {
  status: 'success';
  baseName: string;
  sanitizedBaseName: string;
  format: SupportedFormat;
  mimeType: string;
  voiceUsed: string;
  languageUsed: string;
  speedUsed: number;
  totalChunks: number;
  totalCharacters: number;
  totalDurationEstimatedSec: number;
  chunks: ChunkSynthesisResult[];
  timestamp: string;
}
