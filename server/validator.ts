import { SynthesizeRequest, SupportedFormat } from './types.js';
import { sanitizeBaseName } from './chunker.js';

// Max length per individual synthesize chunk request to Gemini TTS
export const MAX_SINGLE_CHUNK_LENGTH = 5000;
// Max full text length when splitting into multiple paragraph chunks (up to 100k chars)
export const MAX_TOTAL_TEXT_LENGTH = 100000;
export const DEFAULT_CHUNK_SIZE = 4000;
export const MIN_SPEED = 0.5;
export const MAX_SPEED = 2.0;
export const SUPPORTED_FORMATS: SupportedFormat[] = ['mp3', 'wav', 'ogg'];

export const SUPPORTED_LANGUAGES = [
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Español (España)', flag: '🇪🇸' },
  { code: 'es-LA', name: 'Español (Latinoamérica)', flag: '🇲🇽' },
  { code: 'fr-FR', name: 'Français (France)', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano (Italia)', flag: '🇮🇹' },
  { code: 'ja-JP', name: '日本語 (Japão)', flag: '🇯🇵' },
];

export const SUPPORTED_VOICES = [
  { id: 'Kore', name: 'Kore (Voz Feminina suave/natural)', gender: 'female', description: 'Voz feminina clara, expressiva e natural', recommendedLanguages: ['pt-BR', 'en-US', 'es-ES', 'fr-FR'] },
  { id: 'Puck', name: 'Puck (Voz Masculina dinâmica)', gender: 'male', description: 'Voz masculina jovem e dinâmica', recommendedLanguages: ['pt-BR', 'en-US', 'es-ES', 'de-DE'] },
  { id: 'Fenrir', name: 'Fenrir (Voz Masculina profunda)', gender: 'male', description: 'Voz masculina encorpada e confiante', recommendedLanguages: ['pt-BR', 'en-US', 'es-ES'] },
  { id: 'Charon', name: 'Charon (Voz Masculina madura/calma)', gender: 'male', description: 'Voz masculina madura, formal e pausada', recommendedLanguages: ['pt-BR', 'en-US', 'fr-FR'] },
  { id: 'Zephyr', name: 'Zephyr (Voz Feminina equilibrada)', gender: 'female', description: 'Voz feminina neutra, equilibrada e amigável', recommendedLanguages: ['pt-BR', 'en-US', 'es-ES'] },
];

export interface ValidationResult {
  isValid: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  sanitized?: {
    text: string;
    baseName: string;
    sanitizedBaseName: string;
    voice: string;
    language: string;
    speed: number;
    format: SupportedFormat;
    splitParagraphs: boolean;
    maxChunkSize: number;
  };
}

export function validateSynthesizeRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return {
      isValid: false,
      statusCode: 400,
      error: 'InvalidBody',
      message: 'O corpo da requisição deve ser um objeto JSON válido.',
    };
  }

  const req = body as Partial<SynthesizeRequest>;

  // 1. Text validation
  if (req.text === undefined || req.text === null) {
    return {
      isValid: false,
      statusCode: 400,
      error: 'MissingParameter',
      message: 'O parâmetro "text" é obrigatório.',
    };
  }

  if (typeof req.text !== 'string') {
    return {
      isValid: false,
      statusCode: 400,
      error: 'InvalidType',
      message: 'O parâmetro "text" deve ser uma string.',
    };
  }

  const trimmedText = req.text.trim();
  if (trimmedText.length === 0) {
    return {
      isValid: false,
      statusCode: 400,
      error: 'EmptyText',
      message: 'O texto fornecido não pode ser vazio ou conter apenas espaços em branco.',
    };
  }

  if (trimmedText.length > MAX_TOTAL_TEXT_LENGTH) {
    return {
      isValid: false,
      statusCode: 400,
      error: 'TextTooLong',
      message: `O texto excede o limite máximo permitido de ${MAX_TOTAL_TEXT_LENGTH} caracteres (atual: ${trimmedText.length}).`,
    };
  }

  // 2. Base Name validation & sanitization
  const rawBaseName = typeof req.base_name === 'string' && req.base_name.trim() 
    ? req.base_name.trim() 
    : 'audio';
  const sanitizedBaseName = sanitizeBaseName(rawBaseName);

  // 3. Speed validation
  let speed = 1.0;
  if (req.speed !== undefined && req.speed !== null) {
    if (typeof req.speed !== 'number' || isNaN(req.speed)) {
      return {
        isValid: false,
        statusCode: 422,
        error: 'InvalidSpeed',
        message: 'O parâmetro "speed" deve ser um número.',
      };
    }
    if (req.speed < MIN_SPEED || req.speed > MAX_SPEED) {
      return {
        isValid: false,
        statusCode: 422,
        error: 'SpeedOutOfRange',
        message: `O parâmetro "speed" deve estar entre ${MIN_SPEED} e ${MAX_SPEED} (recebido: ${req.speed}).`,
      };
    }
    speed = Number(req.speed.toFixed(2));
  }

  // 4. Format validation
  let format: SupportedFormat = 'mp3';
  if (req.format !== undefined && req.format !== null) {
    if (typeof req.format !== 'string') {
      return {
        isValid: false,
        statusCode: 422,
        error: 'InvalidFormat',
        message: 'O formato de áudio deve ser uma string.',
      };
    }
    const lowerFormat = req.format.toLowerCase() as SupportedFormat;
    if (!SUPPORTED_FORMATS.includes(lowerFormat)) {
      return {
        isValid: false,
        statusCode: 422,
        error: 'UnsupportedFormat',
        message: `Formato de áudio "${req.format}" não suportado. Formatos válidos: ${SUPPORTED_FORMATS.join(', ')}.`,
      };
    }
    format = lowerFormat;
  }

  // 5. Voice validation & mapping
  let voice = 'Kore';
  if (req.voice) {
    const rawVoice = String(req.voice).trim();
    const lowerVoice = rawVoice.toLowerCase();

    // Map common aliases
    if (lowerVoice === 'feminina' || lowerVoice === 'female') {
      voice = 'Kore';
    } else if (lowerVoice === 'masculina' || lowerVoice === 'male') {
      voice = 'Puck';
    } else {
      const match = SUPPORTED_VOICES.find(
        (v) => v.id.toLowerCase() === lowerVoice || v.name.toLowerCase().includes(lowerVoice)
      );
      if (match) {
        voice = match.id;
      } else {
        const knownVoices = SUPPORTED_VOICES.map((v) => v.id);
        if (!knownVoices.includes(rawVoice)) {
          return {
            isValid: false,
            statusCode: 422,
            error: 'UnsupportedVoice',
            message: `Voz "${rawVoice}" não reconhecida. Vozes disponíveis: ${knownVoices.join(', ')} (ou "feminina", "masculina").`,
          };
        }
        voice = rawVoice;
      }
    }
  }

  // 6. Language validation
  let language = 'pt-BR';
  if (req.language) {
    const rawLang = String(req.language).trim();
    const langMatch = SUPPORTED_LANGUAGES.find(
      (l) => l.code.toLowerCase() === rawLang.toLowerCase() || l.code.split('-')[0].toLowerCase() === rawLang.toLowerCase()
    );
    if (langMatch) {
      language = langMatch.code;
    } else {
      if (!/^[a-zA-Z]{2}(-[a-zA-Z]{2,4})?$/.test(rawLang)) {
        return {
          isValid: false,
          statusCode: 422,
          error: 'InvalidLanguageCode',
          message: `Código de idioma inválido "${rawLang}". Use códigos padrão como pt-BR, en-US, es-ES, etc.`,
        };
      }
      language = rawLang;
    }
  }

  // 7. Split Paragraphs & Chunk size settings
  const splitParagraphs = req.split_paragraphs !== undefined ? Boolean(req.split_paragraphs) : true;
  let maxChunkSize = DEFAULT_CHUNK_SIZE;
  if (typeof req.max_chunk_size === 'number' && req.max_chunk_size >= 200 && req.max_chunk_size <= MAX_SINGLE_CHUNK_LENGTH) {
    maxChunkSize = Math.floor(req.max_chunk_size);
  }

  return {
    isValid: true,
    sanitized: {
      text: trimmedText,
      baseName: rawBaseName,
      sanitizedBaseName,
      voice,
      language,
      speed,
      format,
      splitParagraphs,
      maxChunkSize,
    },
  };
}
