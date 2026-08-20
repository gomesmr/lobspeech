/**
 * Utilities for sanitizing base names and splitting long texts by paragraph/sentence boundaries.
 */

/**
 * Sanitizes a base filename:
 * - Converts to lower case
 * - Replaces accents/diacritics (e.g., 'á' -> 'a', 'ç' -> 'c')
 * - Converts spaces, hyphens, and non-alphanumeric chars to underscores (snake_case)
 * - Removes repeated underscores and trims leading/trailing underscores
 * - Falls back to 'audio' if empty
 */
export function sanitizeBaseName(rawName?: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return 'audio';
  }

  const normalized = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_') // replace any non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
    .replace(/_+/g, '_'); // collapse consecutive underscores

  return normalized || 'audio';
}

/**
 * Formats chunk audio filename: [sanitized_base_name]-[counter].[ext]
 * Counter is 1-indexed (e.g. audio_capitulo_01-1.mp3 or padded audio-01.mp3)
 */
export function formatChunkFilename(baseName: string, index: number, totalChunks: number, format: string): string {
  const sanitized = sanitizeBaseName(baseName);
  const padLength = totalChunks >= 10 ? String(totalChunks).length : 2;
  const counterStr = String(index).padStart(padLength, '0');
  return `${sanitized}-${counterStr}.${format}`;
}

export interface TextChunk {
  index: number;
  text: string;
  characterCount: number;
  wordCount: number;
}

/**
 * Splits text into logical chunks prioritizing paragraph breaks (\n\n), line breaks (\n),
 * and sentence boundaries (. ! ? ;), ensuring that no paragraph is cut mid-sentence if possible.
 * 
 * @param fullText The full text to split
 * @param maxChunkSize Maximum character limit per chunk (default: 4000)
 */
export function splitTextIntoChunks(fullText: string, maxChunkSize: number = 4000): TextChunk[] {
  const trimmed = fullText.trim();
  if (!trimmed) return [];

  // If text already fits in a single chunk, return immediately
  if (trimmed.length <= maxChunkSize) {
    return [{
      index: 1,
      text: trimmed,
      characterCount: trimmed.length,
      wordCount: trimmed.split(/\s+/).filter(Boolean).length,
    }];
  }

  const chunks: string[] = [];
  // Split raw text into paragraphs preserving structure
  const rawParagraphs = trimmed.split(/\n\s*\n/);

  let currentChunk = '';

  for (const para of rawParagraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // If paragraph itself fits into current chunk
    if (!currentChunk) {
      if (trimmedPara.length <= maxChunkSize) {
        currentChunk = trimmedPara;
      } else {
        // Individual paragraph is larger than maxChunkSize, split by sentence
        const sentenceChunks = splitLongParagraph(trimmedPara, maxChunkSize);
        for (let i = 0; i < sentenceChunks.length; i++) {
          if (i === sentenceChunks.length - 1 && sentenceChunks[i].length < maxChunkSize / 2) {
            currentChunk = sentenceChunks[i];
          } else {
            chunks.push(sentenceChunks[i]);
          }
        }
      }
    } else {
      const prospectiveLength = currentChunk.length + 2 + trimmedPara.length; // '\n\n'
      if (prospectiveLength <= maxChunkSize) {
        currentChunk += '\n\n' + trimmedPara;
      } else {
        // Current chunk is finished at the end of the last paragraph
        chunks.push(currentChunk.trim());
        
        if (trimmedPara.length <= maxChunkSize) {
          currentChunk = trimmedPara;
        } else {
          const sentenceChunks = splitLongParagraph(trimmedPara, maxChunkSize);
          for (let i = 0; i < sentenceChunks.length; i++) {
            if (i === sentenceChunks.length - 1 && sentenceChunks[i].length < maxChunkSize / 2) {
              currentChunk = sentenceChunks[i];
            } else {
              chunks.push(sentenceChunks[i]);
            }
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.map((text, idx) => ({
    index: idx + 1,
    text,
    characterCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  }));
}

/**
 * Splits a very long single paragraph by sentence boundaries (., !, ?, ;)
 */
function splitLongParagraph(paragraph: string, maxChunkSize: number): string[] {
  // Regex to split by sentence boundaries while keeping punctuation
  const sentences = paragraph.match(/[^.!?;\n]+[.!?;\n]+|[^.!?;\n]+$/g) || [paragraph];
  const result: string[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if (!buffer) {
      if (trimmedSentence.length <= maxChunkSize) {
        buffer = trimmedSentence;
      } else {
        // Sentence is extraordinarily long (no punctuation), split by words
        const wordParts = splitByWords(trimmedSentence, maxChunkSize);
        result.push(...wordParts);
      }
    } else if (buffer.length + 1 + trimmedSentence.length <= maxChunkSize) {
      buffer += ' ' + trimmedSentence;
    } else {
      result.push(buffer.trim());
      if (trimmedSentence.length <= maxChunkSize) {
        buffer = trimmedSentence;
      } else {
        const wordParts = splitByWords(trimmedSentence, maxChunkSize);
        result.push(...wordParts);
        buffer = '';
      }
    }
  }

  if (buffer.trim()) {
    result.push(buffer.trim());
  }

  return result;
}

function splitByWords(longSentence: string, maxChunkSize: number): string[] {
  const words = longSentence.split(/\s+/);
  const parts: string[] = [];
  let temp = '';

  for (const w of words) {
    if (!temp) {
      temp = w;
    } else if (temp.length + 1 + w.length <= maxChunkSize) {
      temp += ' ' + w;
    } else {
      parts.push(temp);
      temp = w;
    }
  }
  if (temp) parts.push(temp);
  return parts;
}
