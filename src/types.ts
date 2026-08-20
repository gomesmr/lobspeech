export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  description: string;
  recommendedLanguages: string[];
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface AudioChunkItem {
  index: number;
  totalChunks: number;
  filename: string;
  characterCount: number;
  durationSeconds: number;
  url: string;
  blob: Blob;
  mimeType: string;
  textSnippet: string;
  textFull: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  sizeBytes?: number;
}

export interface AudioSession {
  sessionId: string;
  slug: string;
  fullSessionId: string;
  folderName: string;
  customTitle?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  createdAt: string;
  baseName: string;
  voice: string;
  language: string;
  speed: number;
  format: string;
  text: string;
  totalCharacters: number;
  totalDurationSeconds: number;
  totalChunks: number;
  chunksCount: number;
  driveFiles?: DriveFileInfo[];
  isSavedToDrive?: boolean;
}

export interface SynthesizedAudio {
  sessionId?: string;
  slug?: string;
  fullSessionId?: string;
  folderName?: string;
  driveFolderUrl?: string;
  url: string;
  blob: Blob;
  format: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  text: string;
  voice: string;
  language: string;
  speed: number;
  timestamp: Date;
  baseName?: string;
  sanitizedBaseName?: string;
  filename?: string;
  totalChunks?: number;
  chunks?: AudioChunkItem[];
  driveUploadStatus?: 'idle' | 'uploading' | 'synced' | 'error';
}
