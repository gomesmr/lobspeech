import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  validateSynthesizeRequest, 
  SUPPORTED_VOICES, 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_FORMATS, 
  MAX_SINGLE_CHUNK_LENGTH, 
  MAX_TOTAL_TEXT_LENGTH, 
  DEFAULT_CHUNK_SIZE,
  MIN_SPEED, 
  MAX_SPEED 
} from './server/validator.js';
import { synthesizeSpeech } from './server/geminiTts.js';
import { splitTextIntoChunks, formatChunkFilename, sanitizeBaseName } from './server/chunker.js';
import { ApiErrorResponse, ChunkSynthesisResult, MultiChunkResponse } from './server/types.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function startServer() {
  const app = express();

  // Standard middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    exposedHeaders: [
      'Content-Disposition', 
      'Content-Length', 
      'X-Audio-Duration-Seconds', 
      'X-Audio-Format', 
      'X-Voice-Used', 
      'X-Language-Used',
      'X-Chunk-Index',
      'X-Total-Chunks',
      'X-Base-Name'
    ],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logger middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/synthesize')) {
      const now = new Date().toISOString();
      console.log(`[${now}] ${req.method} ${req.path}`);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'text-to-speech-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      engine: 'gemini-3.1-flash-tts-preview',
      ffmpeg: true,
      features: {
        paragraphChunking: true,
        baseNameSanitization: true,
        pattern: '[nome_base]-[counter].[ext]',
      },
      limits: {
        maxSingleChunkLength: MAX_SINGLE_CHUNK_LENGTH,
        maxTotalTextLength: MAX_TOTAL_TEXT_LENGTH,
        defaultChunkSize: DEFAULT_CHUNK_SIZE,
        minSpeed: MIN_SPEED,
        maxSpeed: MAX_SPEED,
        supportedFormats: SUPPORTED_FORMATS,
      },
    });
  });

  // Helper preview chunks endpoint (splits text and previews filenames without synthesizing)
  app.post('/api/preview-chunks', (req: Request, res: Response): void => {
    const { text, base_name, max_chunk_size, format } = req.body;
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      res.status(400).json({ error: 'EmptyText', message: 'Texto não fornecido.' });
      return;
    }

    const base = sanitizeBaseName(base_name);
    const audioFmt = typeof format === 'string' && ['mp3', 'wav', 'ogg'].includes(format.toLowerCase()) ? format.toLowerCase() : 'mp3';
    const chunkSize = typeof max_chunk_size === 'number' && max_chunk_size >= 200 ? max_chunk_size : DEFAULT_CHUNK_SIZE;
    
    const chunks = splitTextIntoChunks(trimmed, chunkSize);
    const previews = chunks.map((c) => ({
      index: c.index,
      totalChunks: chunks.length,
      filename: formatChunkFilename(base, c.index, chunks.length, audioFmt),
      characterCount: c.characterCount,
      wordCount: c.wordCount,
      snippet: c.text.length > 80 ? c.text.slice(0, 80) + '...' : c.text,
      text: c.text,
    }));

    res.json({
      baseName: base_name || 'audio',
      sanitizedBaseName: base,
      format: audioFmt,
      totalChunks: chunks.length,
      totalCharacters: trimmed.length,
      chunks: previews,
    });
  });

  // Get available voices and language configuration
  app.get('/api/voices', (_req: Request, res: Response) => {
    res.json({
      voices: SUPPORTED_VOICES,
      languages: SUPPORTED_LANGUAGES,
      formats: SUPPORTED_FORMATS,
      defaults: {
        baseName: 'audio',
        voice: 'Kore',
        language: 'pt-BR',
        speed: 1.0,
        format: 'mp3',
        maxChunkSize: DEFAULT_CHUNK_SIZE,
      },
      limits: {
        maxSingleChunkLength: MAX_SINGLE_CHUNK_LENGTH,
        maxTotalTextLength: MAX_TOTAL_TEXT_LENGTH,
        minSpeed: MIN_SPEED,
        maxSpeed: MAX_SPEED,
      },
    });
  });

  // TTS Synthesis handler logic with multi-chunk and single binary output support
  const handleSynthesize = async (req: Request, res: Response): Promise<void> => {
    const validation = validateSynthesizeRequest(req.body);

    if (!validation.isValid || !validation.sanitized) {
      const errorResponse: ApiErrorResponse = {
        error: validation.error || 'ValidationError',
        message: validation.message || 'Dados de requisição inválidos.',
        timestamp: new Date().toISOString(),
      };
      res.status(validation.statusCode || 400).json(errorResponse);
      return;
    }

    const { text, baseName, sanitizedBaseName, voice, language, speed, format, splitParagraphs, maxChunkSize } = validation.sanitized;

    try {
      // Split text into chunks by paragraph boundaries
      const textChunks = splitParagraphs 
        ? splitTextIntoChunks(text, maxChunkSize)
        : [{ index: 1, text, characterCount: text.length, wordCount: text.split(/\s+/).filter(Boolean).length }];

      const totalChunks = textChunks.length;

      // Check if client wants JSON response (e.g. multi-chunk list or explicit response_type)
      const acceptHeader = req.headers.accept || '';
      const isMultiChunk = totalChunks > 1;
      const wantsJson = isMultiChunk || req.query.response_type === 'json' || (acceptHeader.includes('application/json') && !acceptHeader.includes('audio/*') && !acceptHeader.includes('*/*'));

      // If single chunk and client requested raw binary stream (standard default)
      if (!wantsJson && totalChunks === 1) {
        const result = await synthesizeSpeech({
          text: textChunks[0].text,
          voice,
          language,
          speed,
          format,
        });

        const filename = formatChunkFilename(sanitizedBaseName, 1, 1, result.format);
        res.setHeader('Content-Type', result.mimeType);
        res.setHeader('Content-Length', result.audioBuffer.length);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('X-Audio-Duration-Seconds', result.durationEstimatedSec.toString());
        res.setHeader('X-Audio-Format', result.format);
        res.setHeader('X-Voice-Used', voice);
        res.setHeader('X-Language-Used', language);
        res.setHeader('X-Character-Count', result.characterCount.toString());
        res.setHeader('X-Chunk-Index', '1');
        res.setHeader('X-Total-Chunks', '1');
        res.setHeader('X-Base-Name', sanitizedBaseName);

        res.status(200).send(result.audioBuffer);
        return;
      }

      // Helper with retry logic
      const synthesizeWithRetry = async (chunkText: string, retries = 2): Promise<any> => {
        let lastErr: any;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await synthesizeSpeech({
              text: chunkText,
              voice,
              language,
              speed,
              format,
            });
          } catch (e: any) {
            lastErr = e;
            // If quota error, stop immediately
            if (e?.message?.includes('429') || e?.message?.includes('RESOURCE_EXHAUSTED')) {
              throw e;
            }
            if (attempt < retries) {
              await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            }
          }
        }
        throw lastErr;
      };

      // Multi-chunk synthesis: synthesize in parallel batches (concurrency: 3)
      const synthesizedChunks: ChunkSynthesisResult[] = new Array(totalChunks);
      const BATCH_SIZE = 3;

      for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
        const batch = textChunks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (chunk) => {
            const result = await synthesizeWithRetry(chunk.text);
            const filename = formatChunkFilename(sanitizedBaseName, chunk.index, totalChunks, result.format);
            const base64Audio = result.audioBuffer.toString('base64');
            const dataUrl = `data:${result.mimeType};base64,${base64Audio}`;

            return {
              index: chunk.index,
              totalChunks,
              filename,
              characterCount: chunk.characterCount,
              durationEstimatedSec: result.durationEstimatedSec,
              audioBase64: base64Audio,
              dataUrl,
              mimeType: result.mimeType,
              textSnippet: chunk.text.length > 90 ? chunk.text.slice(0, 90) + '...' : chunk.text,
              textFull: chunk.text,
            };
          })
        );

        for (const res of batchResults) {
          synthesizedChunks[res.index - 1] = res;
        }
      }

      const totalDuration = synthesizedChunks.reduce((acc, c) => acc + (c?.durationEstimatedSec || 0), 0);

      const responsePayload: MultiChunkResponse = {
        status: 'success',
        baseName,
        sanitizedBaseName,
        format,
        mimeType: synthesizedChunks[0]?.mimeType || 'audio/mp3',
        voiceUsed: voice,
        languageUsed: language,
        speedUsed: speed,
        totalChunks,
        totalCharacters: text.length,
        totalDurationEstimatedSec: Number(totalDuration.toFixed(2)),
        chunks: synthesizedChunks,
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(responsePayload);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao sintetizar voz.';
      console.error('Error during TTS synthesis:', err);

      let statusCode = 500;
      let errorCode = 'SynthesisError';
      let userFriendlyMessage = errorMessage;

      // Check if it's a 429 Quota Exceeded error from Gemini API
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        statusCode = 429;
        errorCode = 'QuotaExceeded';
        userFriendlyMessage = 'Limite de requisições gratuitas (Free Tier) da API Gemini atingido. Aguarde alguns segundos ou configure uma chave com faturamento ativado (Pay-as-you-go) em Settings > Secrets.';
      }

      const errorResponse: ApiErrorResponse = {
        error: errorCode,
        message: userFriendlyMessage,
        details: { raw: errorMessage },
        timestamp: new Date().toISOString(),
      };
      res.status(statusCode).json(errorResponse);
    }
  };

  // Single Chunk synthesis endpoint for streaming/resilient multi-part processing
  app.post('/api/synthesize-chunk', async (req: Request, res: Response): Promise<void> => {
    try {
      const { text, base_name, chunk_index, total_chunks, voice, language, speed, format } = req.body;
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) {
        res.status(400).json({ error: 'EmptyText', message: 'Texto do chunk não fornecido.' });
        return;
      }

      const audioFmt = typeof format === 'string' && ['mp3', 'wav', 'ogg'].includes(format.toLowerCase()) ? format.toLowerCase() : 'mp3';
      const voiceName = typeof voice === 'string' ? voice : 'Kore';
      const lang = typeof language === 'string' ? language : 'pt-BR';
      const spd = typeof speed === 'number' && speed >= 0.5 && speed <= 2.0 ? speed : 1.0;
      const idx = typeof chunk_index === 'number' ? chunk_index : 1;
      const tot = typeof total_chunks === 'number' ? total_chunks : 1;
      const base = sanitizeBaseName(base_name || 'audio');

      const result = await synthesizeSpeech({
        text: trimmed,
        voice: voiceName,
        language: lang,
        speed: spd,
        format: audioFmt as any,
      });

      const filename = formatChunkFilename(base, idx, tot, result.format);
      const base64Audio = result.audioBuffer.toString('base64');
      const dataUrl = `data:${result.mimeType};base64,${base64Audio}`;

      res.json({
        index: idx,
        totalChunks: tot,
        filename,
        characterCount: trimmed.length,
        durationEstimatedSec: result.durationEstimatedSec,
        audioBase64: base64Audio,
        dataUrl,
        mimeType: result.mimeType,
        textSnippet: trimmed.length > 90 ? trimmed.slice(0, 90) + '...' : trimmed,
        textFull: trimmed,
      });
    } catch (err: any) {
      console.error('Error synthesizing single chunk:', err);
      const isQuota = err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      res.status(isQuota ? 429 : 500).json({
        error: isQuota ? 'QuotaExceeded' : 'ChunkSynthesisError',
        message: err?.message || 'Falha ao sintetizar chunk.',
      });
    }
  });

  // Main requested endpoint: POST /synthesize
  app.post('/synthesize', handleSynthesize);
  // Alias endpoint: POST /api/synthesize
  app.post('/api/synthesize', handleSynthesize);

  // Global 404 for unknown API routes
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'NotFound',
      message: 'Rota da API não encontrada.',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite middleware in dev or static files in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TTS Backend Server running on http://0.0.0.0:${PORT}`);
    console.log(`Endpoint available: POST http://localhost:${PORT}/synthesize`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
