import { useState, useEffect, FormEvent } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL } from './contexts/AuthContext';
import { SplashScreen } from './components/SplashScreen';
import { Header } from './components/Header';
import { AudioPlayer } from './components/AudioPlayer';
import { ApiDocs } from './components/ApiDocs';
import { EnvironmentReport } from './components/EnvironmentReport';
import { SessionHistory } from './components/SessionHistory';
import { SynthesizedAudio, VoiceOption, LanguageOption, AudioChunkItem, AudioSession } from './types';
import { generateSessionName } from './utils/sessionSlug';
import { googleDriveService, DriveUploadProgress } from './services/googleDrive';
import { 
  saveAudioSessionToFirestore, 
  fetchAudioSessionsFromFirestore, 
  updateAudioSessionInFirestore, 
  deleteAudioSessionFromFirestore 
} from './services/sessionStore';
import { 
  Play, 
  Loader2, 
  Sparkles, 
  Trash2, 
  Wand2, 
  AlertTriangle,
  History,
  Volume2,
  Cpu,
  Radio,
  Sliders,
  CheckCircle2,
  Terminal,
  FileText,
  Layers,
  Scissors,
  Tag,
  Cloud,
  HardDrive,
  ExternalLink
} from 'lucide-react';

const PRESET_TEXTS = [
  {
    title: 'Capítulo de Audiolivro (Múltiplos Parágrafos)',
    lang: 'pt-BR',
    voice: 'Charon',
    baseName: 'audiolivro_capitulo_01',
    text: `O sol despontava silencioso por trás das serras azuladas, derramando sobre o vale uma luz dourada e suave. As folhas das árvores centenárias ainda guardavam o orvalho fresco da madrugada, que brilhava como pequenos diamantes suspensos no ar límpido da montanha.

Era o primeiro dia de uma jornada esperada por gerações. Os viajantes ajustaram suas mochilas com cuidado meticuloso, verificando os mapas cartográficos desenhados à mão e as antigas bússolas herdadas de seus ancestrais. Nenhum deles ousava falar alto, como se o respeito pelo início da trilha exigisse solene reverência.

Conforme avançavam pela vereda de terra batida, o aroma característico de terra molhada e folhas de eucalipto preenchia a atmosfera. Ao longe, o murmúrio constante de uma cachoeira indicava que o primeiro ponto de descanso estava próximo, trazendo alívio e renovando a determinação de todo o grupo.`,
  },
  {
    title: 'Boas-vindas Curto',
    lang: 'pt-BR',
    voice: 'Kore',
    baseName: 'boas_vindas',
    text: 'Olá! Seja bem-vindo ao backend de conversão de texto em fala. Este áudio foi gerado com prosódia natural e alta fidelidade em português do Brasil.',
  },
  {
    title: 'Notícia Tech (2 Blocos)',
    lang: 'pt-BR',
    voice: 'Puck',
    baseName: 'noticia_tech_ia',
    text: `O avanço dos modelos neurais de áudio permite sintetizar voz com entonação humana em poucos milissegundos, transformando a acessibilidade digital em todo o mundo.

Engenheiros e desenvolvedores agora integram interfaces conversacionais inteligentes em aplicações web e dispositivos embarcados com latência imperceptível e máxima naturalidade.`,
  },
  {
    title: 'Assistente Virtual',
    lang: 'pt-BR',
    voice: 'Zephyr',
    baseName: 'confirmacao_pedido',
    text: 'Seu pedido número 4281 foi confirmado com sucesso e sairá para entrega amanhã pela manhã. Deseja receber atualizações por mensagem?',
  },
];

interface LogEntry {
  method: string;
  path: string;
  status: string;
  duration: string;
  time: string;
}

interface ChunkPreview {
  index: number;
  totalChunks: number;
  filename: string;
  characterCount: number;
  wordCount: number;
  snippet: string;
  text: string;
}

export default function App() {
  const { user, profile, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'playground' | 'sessions' | 'docs' | 'environment'>('playground');
  
  // Synthesis form state
  const [text, setText] = useState<string>(PRESET_TEXTS[0].text);
  const [baseName, setBaseName] = useState<string>(PRESET_TEXTS[0].baseName);
  const [voice, setVoice] = useState<string>('Charon');
  const [language, setLanguage] = useState<string>('pt-BR');
  const [speed, setSpeed] = useState<number>(1.0);
  const [format, setFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3');
  const [splitParagraphs, setSplitParagraphs] = useState<boolean>(true);
  const [maxChunkSize, setMaxChunkSize] = useState<number>(1200); // 1200 chars for testing paragraph split
  const [autoSaveToDrive, setAutoSaveToDrive] = useState<boolean>(true);
  
  // Dynamic Chunk Preview state
  const [chunkPreviews, setChunkPreviews] = useState<ChunkPreview[]>([]);
  
  // API and metadata state
  const [voicesList, setVoicesList] = useState<VoiceOption[]>([]);
  const [languagesList, setLanguagesList] = useState<LanguageOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sessions & Drive state
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState<DriveUploadProgress | null>(null);
  const [synthesisProgress, setSynthesisProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  
  // Results, History & Live Logs
  const [currentAudio, setCurrentAudio] = useState<SynthesizedAudio | null>(null);
  const [history, setHistory] = useState<SynthesizedAudio[]>([]);
  const [apiLogs, setApiLogs] = useState<LogEntry[]>([
    { method: 'GET', path: '/api/health', status: '200 OK', duration: '0.01s', time: '13:04:12' },
    { method: 'GET', path: '/api/voices', status: '200 OK', duration: '0.02s', time: '13:04:13' },
  ]);

  // Load saved sessions from both Firestore and directly from Google Drive
  const loadSessions = async (interactiveDrive: boolean = false) => {
    setSessionsLoading(true);
    try {
      let firestoreSessions: AudioSession[] = [];
      if (user) {
        firestoreSessions = await fetchAudioSessionsFromFirestore(user.uid);
      }

      // Also try to list sessions directly from Google Drive
      let driveSessions: any[] = [];
      try {
        driveSessions = await googleDriveService.listSessionsFromGoogleDrive(interactiveDrive);
      } catch (dErr) {
        console.warn('Drive list sessions fallback:', dErr);
      }

      // Merge and deduplicate by sessionId or folderName
      const mergedMap = new Map<string, AudioSession>();
      
      firestoreSessions.forEach((s) => {
        const key = s.folderName || s.sessionId || s.fullSessionId;
        if (key) mergedMap.set(key, s);
      });

      driveSessions.forEach((s) => {
        const key = s.folderName || s.sessionId || s.fullSessionId;
        if (key) {
          const existing = mergedMap.get(key);
          if (existing) {
            mergedMap.set(key, { ...existing, ...s, isSavedToDrive: true });
          } else {
            mergedMap.set(key, s);
            if (user) {
              // Persist newly discovered session into firestore for future instant loads
              saveAudioSessionToFirestore(user.uid, s);
            }
          }
        }
      });

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setSessions(mergedList);
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Session Management Handlers
  const handleRenameSession = async (session: AudioSession, newTitle: string) => {
    try {
      // 1. Update in Firestore & Local storage
      await updateAudioSessionInFirestore(user?.uid || '', session.sessionId, { customTitle: newTitle });
      
      // 2. Optionally update in Google Drive if folderId exists
      if (session.driveFolderId) {
        googleDriveService.renameFolder(session.driveFolderId, newTitle).catch((err) => {
          console.warn('Erro ao atualizar nome no Drive:', err);
        });
      }

      // 3. Update React state immediately
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === session.sessionId ? { ...s, customTitle: newTitle } : s))
      );
    } catch (err) {
      console.error('Erro ao renomear sessão:', err);
      // Still update local state so user experience is not blocked
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === session.sessionId ? { ...s, customTitle: newTitle } : s))
      );
    }
  };

  const handleDeleteSession = async (session: AudioSession) => {
    try {
      // 1. Update React state immediately for instant feedback
      setSessions((prev) => prev.filter((s) => s.sessionId !== session.sessionId));

      // 2. Delete from Firestore & Local deleted set
      await deleteAudioSessionFromFirestore(user?.uid || '', session.sessionId);

      // 3. Delete from Google Drive if folderId exists
      if (session.driveFolderId) {
        await googleDriveService.deleteFolder(session.driveFolderId, false).catch((dErr) => {
          console.warn('Erro ao deletar pasta no Drive:', dErr);
        });
      }
    } catch (err) {
      console.error('Erro ao deletar sessão:', err);
    }
  };

  const handleDeleteSessionFile = async (session: AudioSession, fileId: string) => {
    try {
      const audioFiles = (session.driveFiles || []).filter(f => f.name !== 'session-metadata.json');
      
      // If there's only 1 audio file or less in this session, deleting it deletes the whole session folder to avoid orphaned empty folders
      if (audioFiles.length <= 1) {
        await handleDeleteSession(session);
        return;
      }

      const updatedFiles = (session.driveFiles || []).filter(f => f.id !== fileId);
      const remainingAudioCount = updatedFiles.filter(f => f.name !== 'session-metadata.json').length;

      // 1. Update React state immediately
      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === session.sessionId
            ? {
                ...s,
                driveFiles: updatedFiles,
                totalChunks: remainingAudioCount,
                chunksCount: remainingAudioCount,
              }
            : s
        )
      );

      // 2. Update Firestore & Local storage
      await updateAudioSessionInFirestore(user?.uid || '', session.sessionId, {
        driveFiles: updatedFiles,
        totalChunks: remainingAudioCount,
        chunksCount: remainingAudioCount
      });

      // 3. Delete file in Drive
      await googleDriveService.deleteFile(fileId, false).catch((dErr) => {
        console.warn('Erro ao deletar arquivo no Drive:', dErr);
      });
    } catch (err) {
      console.error('Erro ao deletar arquivo da sessão:', err);
    }
  };

  useEffect(() => {
    loadSessions(false);
  }, [user]);

  // Fetch supported metadata on load
  useEffect(() => {
    fetch('/api/voices')
      .then((res) => res.json())
      .then((data) => {
        if (data.voices) setVoicesList(data.voices);
        if (data.languages) setLanguagesList(data.languages);
      })
      .catch((err) => console.error('Erro ao carregar vozes:', err));
  }, []);

  // Calculate chunk previews in real time when text, baseName, format or chunk size changes
  useEffect(() => {
    if (!text.trim()) {
      setChunkPreviews([]);
      return;
    }

    const timer = setTimeout(() => {
      fetch('/api/preview-chunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          base_name: baseName,
          format,
          max_chunk_size: maxChunkSize,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.chunks) {
            setChunkPreviews(data.chunks);
          }
        })
        .catch(() => {});
    }, 200);

    return () => clearTimeout(timer);
  }, [text, baseName, format, maxChunkSize]);

  // Sanitized preview helper
  const getSanitizedBaseNamePreview = () => {
    return baseName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'audio';
  };

  const handleSynthesize = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) {
      setError('Por favor, digite um texto para converter em fala.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSynthesisProgress(null);
    const startTime = performance.now();

    try {
      // Generate distinct UUID + memorable slug session identifier
      const sessionIdentity = generateSessionName();
      const folderName = sessionIdentity.fullSessionId;
      let finalAudio: SynthesizedAudio;

      const standardMimeType = format === 'mp3' ? 'audio/mpeg' : format === 'ogg' ? 'audio/ogg' : 'audio/wav';

      // If text splits into multiple chunks (e.g. 3 to 20+ chapters/paragraphs), use resilient progressive chunk runner
      if (splitParagraphs && chunkPreviews.length > 1) {
        const totalChunks = chunkPreviews.length;
        setSynthesisProgress({
          current: 0,
          total: totalChunks,
          message: `Iniciando síntese de ${totalChunks} partes...`,
        });

        const synthesizedChunks: AudioChunkItem[] = new Array(totalChunks);
        let completed = 0;

        // Process in parallel batches of 3
        const BATCH_SIZE = 3;
        for (let i = 0; i < chunkPreviews.length; i += BATCH_SIZE) {
          const batch = chunkPreviews.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (preview) => {
              // Retry helper
              let lastErr: any;
              for (let attempt = 0; attempt <= 2; attempt++) {
                try {
                  const chunkRes = await fetch('/api/synthesize-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      text: preview.text,
                      base_name: baseName,
                      chunk_index: preview.index,
                      total_chunks: totalChunks,
                      voice,
                      language,
                      speed,
                      format,
                    }),
                  });

                  if (!chunkRes.ok) {
                    const errData = await chunkRes.json().catch(() => ({}));
                    throw new Error(errData.message || `Erro ${chunkRes.status} no chunk ${preview.index}`);
                  }

                  const chunkData = await chunkRes.json();
                  const byteChars = atob(chunkData.audioBase64);
                  const byteArray = new Uint8Array(byteChars.length);
                  for (let b = 0; b < byteChars.length; b++) {
                    byteArray[b] = byteChars.charCodeAt(b);
                  }
                  const chunkMime = chunkData.mimeType || standardMimeType;
                  const blob = new Blob([byteArray], { type: chunkMime });
                  const url = URL.createObjectURL(blob);

                  synthesizedChunks[preview.index - 1] = {
                    index: preview.index,
                    totalChunks,
                    filename: chunkData.filename,
                    characterCount: chunkData.characterCount,
                    durationSeconds: chunkData.durationEstimatedSec,
                    url,
                    blob,
                    mimeType: chunkMime,
                    textSnippet: chunkData.textSnippet,
                    textFull: chunkData.textFull,
                  };

                  completed++;
                  setSynthesisProgress({
                    current: completed,
                    total: totalChunks,
                    message: `Sintetizando partes: ${completed} de ${totalChunks} concluídas (${Math.round((completed / totalChunks) * 100)}%)...`,
                  });
                  return;
                } catch (cErr: any) {
                  lastErr = cErr;
                  if (attempt < 2) {
                    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
                  }
                }
              }
              throw lastErr;
            })
          );
        }

        const totalDurationSec = synthesizedChunks.reduce((acc, c) => acc + (c?.durationSeconds || 0), 0);
        const totalBytes = synthesizedChunks.reduce((acc, c) => acc + (c?.blob?.size || 0), 0);

        finalAudio = {
          sessionId: sessionIdentity.uuid,
          slug: sessionIdentity.slug,
          fullSessionId: sessionIdentity.fullSessionId,
          folderName,
          url: synthesizedChunks[0]?.url || '',
          blob: synthesizedChunks[0]?.blob || new Blob(),
          format,
          mimeType: standardMimeType,
          durationSeconds: Number(totalDurationSec.toFixed(2)),
          sizeBytes: totalBytes,
          text: text.trim(),
          voice,
          language,
          speed,
          timestamp: new Date(),
          baseName,
          sanitizedBaseName: getSanitizedBaseNamePreview(),
          filename: synthesizedChunks[0]?.filename,
          totalChunks,
          chunks: synthesizedChunks,
          driveUploadStatus: 'idle',
        };
      } else {
        // Standard single chunk or fast synthesis
        const response = await fetch('/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, audio/*',
          },
          body: JSON.stringify({
            text: text.trim(),
            base_name: baseName,
            voice,
            language,
            speed,
            format,
            split_paragraphs: splitParagraphs,
            max_chunk_size: maxChunkSize,
          }),
        });

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        const contentType = response.headers.get('Content-Type') || '';

        if (!response.ok) {
          let errMsg = `Erro ${response.status}: Falha ao sintetizar áudio.`;
          try {
            const errJson = await response.json();
            if (errJson.message) errMsg = errJson.message;
          } catch {
            // ignore
          }
          setApiLogs((prev) => [
            { method: 'POST', path: '/synthesize', status: `${response.status} ERR`, duration: `${elapsed}s`, time: new Date().toLocaleTimeString() },
            ...prev.slice(0, 7),
          ]);
          throw new Error(errMsg);
        }

        if (contentType.includes('application/json')) {
          const data = await response.json();
          const convertedChunks: AudioChunkItem[] = (data.chunks || []).map((c: any) => {
            const byteChars = atob(c.audioBase64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteArray[i] = byteChars.charCodeAt(i);
            }
            const chunkMime = c.mimeType || standardMimeType;
            const blob = new Blob([byteArray], { type: chunkMime });
            const url = URL.createObjectURL(blob);

            return {
              index: c.index,
              totalChunks: c.totalChunks,
              filename: c.filename,
              characterCount: c.characterCount,
              durationSeconds: c.durationEstimatedSec,
              url,
              blob,
              mimeType: chunkMime,
              textSnippet: c.textSnippet,
              textFull: c.textFull,
            };
          });

          const firstChunkUrl = convertedChunks[0]?.url || '';
          const firstChunkBlob = convertedChunks[0]?.blob || new Blob();

          finalAudio = {
            sessionId: sessionIdentity.uuid,
            slug: sessionIdentity.slug,
            fullSessionId: sessionIdentity.fullSessionId,
            folderName,
            url: firstChunkUrl,
            blob: firstChunkBlob,
            format: data.format || format,
            mimeType: data.mimeType || standardMimeType,
            durationSeconds: data.totalDurationEstimatedSec,
            sizeBytes: convertedChunks.reduce((acc, curr) => acc + curr.blob.size, 0),
            text: text.trim(),
            voice: data.voiceUsed || voice,
            language: data.languageUsed || language,
            speed: data.speedUsed || speed,
            timestamp: new Date(),
            baseName: data.baseName || baseName,
            sanitizedBaseName: data.sanitizedBaseName,
            filename: convertedChunks[0]?.filename,
            totalChunks: data.totalChunks,
            chunks: convertedChunks,
            driveUploadStatus: 'idle',
          };
        } else {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const durationHeader = response.headers.get('X-Audio-Duration-Seconds');
          const durationSec = durationHeader ? parseFloat(durationHeader) : parseFloat(elapsed);
          const returnedBaseName = response.headers.get('X-Base-Name') || getSanitizedBaseNamePreview();
          const defaultFilename = `${returnedBaseName}-01.${format}`;

          finalAudio = {
            sessionId: sessionIdentity.uuid,
            slug: sessionIdentity.slug,
            fullSessionId: sessionIdentity.fullSessionId,
            folderName,
            url: audioUrl,
            blob: audioBlob,
            format,
            mimeType: contentType || `audio/${format}`,
            durationSeconds: durationSec,
            sizeBytes: audioBlob.size,
            text: text.trim(),
            voice,
            language,
            speed,
            timestamp: new Date(),
            baseName,
            sanitizedBaseName: returnedBaseName,
            filename: defaultFilename,
            totalChunks: 1,
            chunks: [
              {
                index: 1,
                totalChunks: 1,
                filename: defaultFilename,
                characterCount: text.length,
                durationSeconds: durationSec,
                url: audioUrl,
                blob: audioBlob,
                mimeType: contentType || `audio/${format}`,
                textSnippet: text.slice(0, 90),
                textFull: text,
              }
            ],
            driveUploadStatus: 'idle',
          };
        }
      }

      setCurrentAudio(finalAudio);
      setHistory((prev) => [finalAudio, ...prev.slice(0, 9)]);

      // Auto-save to Google Drive if enabled and user is logged in
      if (autoSaveToDrive && user && finalAudio.chunks && finalAudio.chunks.length > 0) {
        try {
          finalAudio.driveUploadStatus = 'uploading';
          const driveRecord = await googleDriveService.saveCompleteSessionToDrive(
            folderName,
            {
              sessionId: sessionIdentity.uuid,
              baseName: finalAudio.baseName || 'audio',
              voice: finalAudio.voice,
              language: finalAudio.language,
              speed: finalAudio.speed,
              format: finalAudio.format,
              text: finalAudio.text,
              chunks: finalAudio.chunks,
            },
            (progress) => {
              setDriveUploadProgress(progress);
            }
          );

          // Update audio item with drive folder info
          finalAudio.driveFolderUrl = driveRecord.folderUrl;
          finalAudio.driveUploadStatus = 'synced';
          setCurrentAudio({ ...finalAudio });

          // Save session record into Firestore
          const sessionDoc: AudioSession = {
            sessionId: sessionIdentity.uuid,
            slug: sessionIdentity.slug,
            fullSessionId: sessionIdentity.fullSessionId,
            folderName,
            driveFolderId: driveRecord.folderId,
            driveFolderUrl: driveRecord.folderUrl,
            createdAt: new Date().toISOString(),
            baseName: finalAudio.baseName || 'audio',
            voice: finalAudio.voice,
            language: finalAudio.language,
            speed: finalAudio.speed,
            format: finalAudio.format,
            text: finalAudio.text,
            totalCharacters: finalAudio.text.length,
            totalDurationSeconds: finalAudio.durationSeconds,
            totalChunks: finalAudio.totalChunks || 1,
            chunksCount: finalAudio.chunks.length,
            driveFiles: driveRecord.audioFiles,
            isSavedToDrive: true,
          };

          await saveAudioSessionToFirestore(user.uid, sessionDoc);
          setSessions((prev) => [sessionDoc, ...prev]);
        } catch (driveErr) {
          console.warn('Erro ao salvar no Google Drive:', driveErr);
          finalAudio.driveUploadStatus = 'error';
        }
      }

      const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      setApiLogs((prev) => [
        { method: 'POST', path: '/synthesize', status: '200 OK', duration: `${totalElapsed}s`, time: new Date().toLocaleTimeString() },
        ...prev.slice(0, 7),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor de TTS.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreset = (preset: typeof PRESET_TEXTS[0]) => {
    setText(preset.text);
    setLanguage(preset.lang);
    setVoice(preset.voice);
    setBaseName(preset.baseName);
  };

  // STRICT ACCESS CONTROL: If not authenticated or not the super admin master user, show SplashScreen only
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isMasterUser = userEmail === SUPER_ADMIN_EMAIL.toLowerCase().trim();

  if (loading || !user) {
    return <SplashScreen />;
  }

  if (!isMasterUser) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-mono">
        <div className="max-w-md w-full bg-[#0d0d0d] border border-rose-500/30 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">ACESSO NÃO AUTORIZADO</h2>
          <p className="text-xs text-white/50 mb-6 leading-relaxed">
            A conta logada (<span className="text-rose-300 font-bold">{user.email}</span>) não possui privilégios de Master Admin. Apenas <strong>{SUPER_ADMIN_EMAIL}</strong> pode acessar e administrar este ambiente.
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-mono text-xs font-bold uppercase transition-all"
          >
            Sair e Trocar de Conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-[#FF4E00] selection:text-black">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container with Atmospheric Ambient Gradient */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-radial-at-t from-[#1a100a] via-[#050505] to-[#050505]">
        {/* TAB 1: PLAYGROUND */}
        {activeTab === 'playground' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN (Session Config & Active Engine) */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* Active Voice Engine Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono font-bold">
                    Active Voice Engine
                  </h2>
                  <Radio className="w-3 h-3 text-[#FF4E00] animate-pulse" />
                </div>

                <div className="space-y-2.5">
                  {[
                    { id: 'Charon', name: 'Charon (pt-BR / Male Calm)', desc: 'Madura & Narração / Livros' },
                    { id: 'Kore', name: 'Kore (pt-BR / Female Neural)', desc: 'Suave & Expressiva' },
                    { id: 'Puck', name: 'Puck (pt-BR / Male Dynamic)', desc: 'Jovem & Notícias' },
                    { id: 'Fenrir', name: 'Fenrir (pt-BR / Male Deep)', desc: 'Encorpada & Confiante' },
                    { id: 'Zephyr', name: 'Zephyr (pt-BR / Female Crisp)', desc: 'Equilibrada & Amigável' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoice(v.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                        voice === v.id
                          ? 'bg-white/10 border-[#FF4E00]/60 text-white shadow-[0_0_12px_rgba(255,78,0,0.15)]'
                          : 'bg-white/[0.02] border-white/5 text-white/50 hover:text-white/90 hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-mono font-medium">{v.id}</div>
                        <div className="text-[10px] text-white/40 truncate">{v.desc}</div>
                      </div>
                      {voice === v.id && (
                        <div className="w-2 h-2 rounded-full bg-[#FF4E00] shadow-[0_0_8px_#FF4E00]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Telemetry Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-4 font-mono font-bold">
                  Configuração de Arquivo & Nomenclatura
                </h2>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/50">PADRÃO DE NOME</span>
                    <span className="text-[#FF4E00] font-bold">[base]-[01].{format}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/50">NOME SANITIZADO</span>
                    <span className="text-white/90 truncate max-w-[140px] text-right font-bold text-[#00FF66]">
                      {getSanitizedBaseNamePreview()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/50">DIVISÃO PARÁGRAFOS</span>
                    <span className={splitParagraphs ? 'text-[#00FF66] font-bold' : 'text-white/50'}>
                      {splitParagraphs ? 'ATIVADO' : 'DESATIVADO'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/50">TRECHOS DETECTADOS</span>
                    <span className="text-[#FF4E00] font-bold">
                      {chunkPreviews.length || 1} {chunkPreviews.length === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/50">NEURAL TTS ENGINE</span>
                    <span className="text-white/90">Gemini 3.1 Flash</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER COLUMN (Input Console, Base Name & Active Player) */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              {/* Synthesizer Workspace Box */}
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                {/* Micro Header */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 font-mono">
                    <Wand2 className="w-3.5 h-3.5 text-[#FF4E00]" />
                    <h2 className="text-xs uppercase tracking-[0.15em] font-semibold text-white/90">
                      Entrada de Texto & Fatiamento de Áudio
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono text-white/40">
                    {text.length} CARACTERES • {chunkPreviews.length || 1} TRECHOS
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                  <span className="text-[11px] text-white/40 font-mono">Modelos:</span>
                  {PRESET_TEXTS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => loadPreset(preset)}
                      className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/5"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>

                {/* Base Name Input Card (NEW) */}
                <div className="mb-4 p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="input-base-name" className="text-[10px] uppercase font-mono tracking-[0.15em] text-white/50 flex items-center gap-1.5 font-bold">
                      <Tag className="w-3.5 h-3.5 text-[#FF4E00]" />
                      <span>Nome Base do Arquivo (nome_base)</span>
                    </label>
                    <span className="text-[10px] font-mono text-white/40">
                      Formato: <code className="text-[#FF4E00]">[nome_base]-[counter].{format}</code>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      id="input-base-name"
                      type="text"
                      value={baseName}
                      onChange={(e) => setBaseName(e.target.value)}
                      placeholder="Ex: capitulo_01_introducao, podcast_trecho, aula_01"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 focus:ring-1 focus:ring-[#FF4E00]/30 transition-all"
                    />
                    <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono text-[#00FF66] shrink-0">
                      ➜ {getSanitizedBaseNamePreview()}-01.{format}
                    </div>
                  </div>

                  <p className="text-[10px] font-mono text-white/40 leading-relaxed">
                    * Sanitização automática: converte para <span className="text-white/70">minúsculas (lowercase)</span>, remove acentos, formata em <span className="text-white/70">snake_case</span> e separa o contador por <span className="text-[#FF4E00]">hífen (-)</span>.
                  </p>
                </div>

                {/* Textarea */}
                <div className="relative mb-5">
                  <textarea
                    id="tts-text-input"
                    rows={6}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={100000}
                    placeholder="Digite ou cole aqui o texto com múltiplos parágrafos. O sistema irá fatiar automaticamente ao final de cada parágrafo e gerar os arquivos em sequência..."
                    className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 focus:ring-1 focus:ring-[#FF4E00]/40 transition-all resize-y leading-relaxed font-sans"
                  />
                  {text && (
                    <button
                      type="button"
                      onClick={() => setText('')}
                      className="absolute top-3 right-3 text-white/40 hover:text-white p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      title="Limpar texto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Chunk Division Preview (Realtime list of upcoming files) */}
                {chunkPreviews.length > 0 && (
                  <div className="mb-5 p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-white/70">
                        <Scissors className="w-3.5 h-3.5 text-[#FF4E00]" />
                        <span className="font-bold">Fatiamento no Final do Último Parágrafo:</span>
                        <span className="px-2 py-0.5 rounded bg-[#FF4E00]/15 text-[#FF4E00] text-[10px] font-bold font-mono">
                          {chunkPreviews.length} {chunkPreviews.length === 1 ? 'arquivo a ser gerado' : 'arquivos a serem gerados'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {chunkPreviews.map((c) => (
                        <div key={c.index} className="p-2.5 rounded-xl bg-black/50 border border-white/5 text-xs font-mono flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[#FF4E00] font-bold">{c.filename}</span>
                              <span className="text-[10px] text-white/40">({c.characterCount} caracteres)</span>
                            </div>
                            <p className="text-[11px] text-white/50 font-sans italic line-clamp-1">
                              "{c.snippet}"
                            </p>
                          </div>
                          <span className="text-[10px] text-[#00FF66] shrink-0 font-bold bg-[#00FF66]/10 px-2 py-0.5 rounded border border-[#00FF66]/20">
                            PARTE {c.index}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hardware & Format Controls Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                  {/* Language Selector */}
                  <div>
                    <label htmlFor="select-language" className="block text-[10px] uppercase font-mono tracking-[0.15em] text-white/40 mb-2">
                      Idioma / Sotaque
                    </label>
                    <select
                      id="select-language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#FF4E00]/60"
                    >
                      <option value="pt-BR" className="bg-[#0a0a0a]">🇧🇷 Português (Brasil)</option>
                      <option value="pt-PT" className="bg-[#0a0a0a]">🇵🇹 Português (Portugal)</option>
                      <option value="en-US" className="bg-[#0a0a0a]">🇺🇸 English (US)</option>
                      <option value="en-GB" className="bg-[#0a0a0a]">🇬🇧 English (UK)</option>
                      <option value="es-ES" className="bg-[#0a0a0a]">🇪🇸 Español (España)</option>
                      <option value="fr-FR" className="bg-[#0a0a0a]">🇫🇷 Français (France)</option>
                      <option value="de-DE" className="bg-[#0a0a0a]">🇩🇪 Deutsch</option>
                      <option value="it-IT" className="bg-[#0a0a0a]">🇮🇹 Italiano</option>
                      <option value="ja-JP" className="bg-[#0a0a0a]">🇯🇵 日本語 (Japão)</option>
                    </select>
                  </div>

                  {/* Format Selector */}
                  <div>
                    <label className="block text-[10px] uppercase font-mono tracking-[0.15em] text-white/40 mb-2">
                      Formato de Saída (FFmpeg)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['mp3', 'wav', 'ogg'] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setFormat(fmt)}
                          className={`py-2 text-xs font-mono font-bold rounded-xl border transition-all ${
                            format === fmt
                              ? 'bg-[#FF4E00] text-black border-[#FF4E00] shadow-[0_0_12px_rgba(255,78,0,0.3)]'
                              : 'bg-black/60 border-white/10 text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          .{fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Speed Slider */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="slider-speed" className="text-[10px] uppercase font-mono tracking-[0.15em] text-white/40">
                      Velocidade de Fala (Filtro atempo)
                    </label>
                    <span className="text-xs font-mono font-bold text-[#FF4E00] bg-[#FF4E00]/10 px-2 py-0.5 rounded border border-[#FF4E00]/20">
                      {speed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    id="slider-speed"
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
                  />
                  <div className="flex justify-between items-center text-[10px] text-white/40 font-mono mt-1.5">
                    <span>0.50x (Lento)</span>
                    <div className="flex gap-1">
                      {[0.75, 1.0, 1.25, 1.5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSpeed(s)}
                          className={`px-1.5 py-0.5 rounded font-mono ${speed === s ? 'bg-[#FF4E00] text-black font-bold' : 'bg-white/5 text-white/50 hover:text-white'}`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                    <span>2.00x (Rápido)</span>
                  </div>
                </div>

                {/* Auto-Save Google Drive Checkbox */}
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-500/5 p-3.5 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="checkbox-drive-sync"
                      type="checkbox"
                      checked={autoSaveToDrive}
                      onChange={(e) => setAutoSaveToDrive(e.target.checked)}
                      className="w-4 h-4 rounded bg-black/60 border-white/20 text-[#FF4E00] focus:ring-0 accent-[#FF4E00] cursor-pointer"
                    />
                    <label htmlFor="checkbox-drive-sync" className="text-xs font-mono text-white/90 cursor-pointer flex items-center gap-1.5 font-semibold">
                      <Cloud className="w-4 h-4 text-blue-400" />
                      <span>Salvar sessão automaticamente no Google Drive</span>
                    </label>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">
                    Pasta: <code className="text-blue-300">[UUID]-[nome-aleatório]</code>
                  </span>
                </div>

                {/* Synthesis Progress Banner */}
                {synthesisProgress && (
                  <div className="mt-3 p-3.5 rounded-xl bg-[#FF4E00]/10 border border-[#FF4E00]/30 text-xs font-mono text-white space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-[#FF4E00] animate-spin shrink-0" />
                        <span className="font-bold text-[#FF4E00]">{synthesisProgress.message}</span>
                      </div>
                      <span className="text-[11px] text-white/60 font-mono">
                        {synthesisProgress.current} / {synthesisProgress.total} partes
                      </span>
                    </div>
                    <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="bg-[#FF4E00] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${Math.round((synthesisProgress.current / synthesisProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Drive Upload Progress Banner */}
                {driveUploadProgress && driveUploadProgress.step !== 'idle' && (
                  <div className="mt-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-mono text-blue-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {driveUploadProgress.step === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : driveUploadProgress.step === 'error' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                      )}
                      <span>{driveUploadProgress.message}</span>
                    </div>

                    {driveUploadProgress.folderUrl && (
                      <a
                        href={driveUploadProgress.folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-[11px] shrink-0 transition-colors"
                      >
                        <span>Abrir Pasta</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 font-mono space-y-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      <div className="flex-1 font-semibold text-rose-300">{error}</div>
                    </div>
                    {error.includes('Limite de requisições') || error.includes('quota') || error.includes('429') ? (
                      <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-[11px] text-white/70 space-y-1.5 pl-3">
                        <p className="font-bold text-amber-300">💡 Como resolver:</p>
                        <p>1. <strong>Aguarde alguns segundos:</strong> O plano gratuito possui uma taxa de 10 requisições/minuto.</p>
                        <p>2. <strong>Plano Pago (Pay-as-you-go):</strong> Vincule uma conta de faturamento no Google AI Studio / Google Cloud e adicione a chave em <em>Settings &gt; Secrets</em> para milhares de requisições por minuto sem bloqueios.</p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Main Action Button */}
                <div className="mt-6">
                  <button
                    id="btn-synthesize-main"
                    type="button"
                    disabled={isLoading || !text.trim()}
                    onClick={() => handleSynthesize()}
                    className="w-full py-4 px-6 rounded-2xl bg-[#FF4E00] hover:bg-[#ff6220] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_0_24px_rgba(255,78,0,0.35)]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                        <span>SINTETIZANDO TRECHOS SUBSEQUENTES VIA GEMINI TTS...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current text-black" />
                        <span>
                          {chunkPreviews.length > 1 
                            ? `GERAR ${chunkPreviews.length} ARQUIVOS SUBSEQUENTES (${getSanitizedBaseNamePreview()}-01.${format}...)` 
                            : `GERAR ÁUDIO (${getSanitizedBaseNamePreview()}-01.${format})`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Audio Player Output */}
              {currentAudio ? (
                <AudioPlayer audio={currentAudio} />
              ) : (
                <div className="p-8 rounded-3xl bg-black border border-dashed border-white/10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 text-white/30 flex items-center justify-center mx-auto border border-white/5">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-mono text-white/50 uppercase tracking-widest">
                    Aguardando execução da síntese
                  </div>
                  <p className="text-[11px] text-white/30 max-w-sm mx-auto">
                    Insira o texto e nome base desejado. O sistema criará os arquivos incrementais numerados e disponibilizará o player com download sequencial.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN (Live API Log & System Health) */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              {/* System Health HUD */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono font-bold">
                    System Health
                  </h2>
                  <Cpu className="w-3.5 h-3.5 text-[#00FF66]" />
                </div>

                <div className="space-y-4 font-mono">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/50">CPU LOAD (FFmpeg)</span>
                      <span className="text-white/90">0.8%</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-[12%] h-full bg-[#FF4E00]"></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/50">MEMORY FOOTPRINT</span>
                      <span className="text-white/90">86 MB / 4 GB</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-[18%] h-full bg-white/40"></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-white/50">STREAM LATENCY</span>
                      <span className="text-[#00FF66]">~380ms avg</span>
                    </div>
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="w-[85%] h-full bg-[#00FF66]"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 p-3 rounded-xl bg-[#FF4E00]/10 border border-[#FF4E00]/30 font-mono text-[10px] leading-relaxed text-white/80">
                  <div className="text-[#FF4E00] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF4E00] animate-ping"></span>
                    <span>PARAGRAPH CHUNKER</span>
                  </div>
                  Fatiamento inteligente preserva integridade semântica e pontuação entre trechos.
                </div>
              </div>

              {/* Live API Request Log */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-mono font-bold flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-[#00FF66]" />
                    <span>Live API Request Log</span>
                  </h2>
                  <span className="text-[9px] font-mono text-white/30">{apiLogs.length} reqs</span>
                </div>

                <div className="space-y-2 font-mono text-[10px] flex-1 overflow-hidden">
                  {apiLogs.map((log, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5">
                      <span className={`font-bold ${log.method === 'POST' ? 'text-[#FF4E00]' : 'text-[#00FF66]'}`}>
                        {log.method}
                      </span>
                      <span className="text-white/70 truncate">{log.path}</span>
                      <span className="text-white/30 ml-auto">{log.duration}</span>
                      <span className={`text-[9px] px-1 rounded ${log.status.includes('ERR') ? 'bg-rose-500/20 text-rose-400' : 'text-[#00FF66]'}`}>
                        {log.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test History */}
              {history.length > 0 && (
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold flex items-center gap-1.5">
                      <History className="w-3 h-3 text-[#FF4E00]" />
                      <span>Histórico de Sessão ({history.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setHistory([])}
                      className="text-[10px] text-white/40 hover:text-white"
                    >
                      Limpar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {history.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => setCurrentAudio(item)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          currentAudio?.url === item.url
                            ? 'bg-white/10 border-[#FF4E00]/60 text-white'
                            : 'bg-black/40 border-white/5 hover:border-white/20 text-white/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white text-[11px] truncate max-w-[130px]">
                            {item.sanitizedBaseName || 'audio'} ({item.chunks?.length || 1} pts)
                          </span>
                          <span className="text-[9px] text-[#FF4E00] uppercase font-mono">.{item.format} • {item.speed}x</span>
                        </div>
                        <p className="text-[10px] text-white/40 line-clamp-1 font-sans">
                          "{item.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SESSIONS & GOOGLE DRIVE */}
        {activeTab === 'sessions' && (
          <SessionHistory
            sessions={sessions}
            loading={sessionsLoading}
            onRefresh={loadSessions}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
            onDeleteSessionFile={handleDeleteSessionFile}
            onSelectSession={(sess) => {
              setActiveTab('playground');
            }}
          />
        )}

        {/* TAB 3: API DOCS & CURL */}
        {activeTab === 'docs' && (
          <ApiDocs
            currentText={text}
            currentBaseName={baseName}
            currentVoice={voice}
            currentLanguage={language}
            currentSpeed={speed}
            currentFormat={format}
          />
        )}

        {/* TAB 4: ENVIRONMENT REPORT (ETAPA 1) */}
        {activeTab === 'environment' && <EnvironmentReport />}
      </main>

      {/* Futuristic Telemetry Footer */}
      <footer className="px-8 py-4 border-t border-white/10 bg-[#0a0a0a] flex flex-wrap items-center justify-between gap-4 text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">
        <span className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66]"></span>
          <span>SECURE API GATEWAY: ACTIVE</span>
        </span>
        <span>ENGINE: GEMINI 3.1 FLASH TTS</span>
        <span>AUDIO PIPELINE: FFMPEG PCM / MP3 / WAV / OGG</span>
        <span>PARAGRAPH CHUNKING: ENABLED</span>
        <span>REGION: US-EAST5 / CLOUD RUN</span>
      </footer>
    </div>
  );
}
