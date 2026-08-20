import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  ExternalLink, 
  Clock, 
  Layers, 
  Music, 
  Volume2, 
  VolumeX,
  RefreshCw, 
  CheckCircle2, 
  FileText, 
  Cloud,
  ChevronRight,
  HardDrive,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Trash2,
  Edit3,
  Search,
  ArrowUpDown,
  Download,
  Check,
  AlertCircle,
  X,
  Loader2,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import { AudioSession, DriveFileInfo } from '../types';
import { googleDriveService } from '../services/googleDrive';

interface SessionHistoryProps {
  sessions: AudioSession[];
  loading: boolean;
  onRefresh: (interactive?: boolean) => void;
  onSelectSession?: (session: AudioSession) => void;
  onUpdateSession?: (sessionId: string, updates: Partial<AudioSession>) => Promise<void>;
  onDeleteSession?: (session: AudioSession) => Promise<void>;
  onDeleteSessionFile?: (session: AudioSession, fileId: string) => Promise<void>;
  onRenameSession?: (session: AudioSession, newTitle: string) => Promise<void>;
}

type SortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'chunks';

export function SessionHistory({ 
  sessions, 
  loading, 
  onRefresh, 
  onSelectSession,
  onUpdateSession,
  onDeleteSession,
  onDeleteSessionFile,
  onRenameSession
}: SessionHistoryProps) {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Active Session Player State
  const [activeSession, setActiveSession] = useState<AudioSession | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tts_playback_speed');
      return saved ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
    try {
      localStorage.setItem('tts_playback_speed', playbackSpeed.toString());
    } catch {
      // ignore
    }
  }, [playbackSpeed]);

  const [trackBlobUrls, setTrackBlobUrls] = useState<Record<string, string>>({});
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Modal / Action states
  const [renameModalSession, setRenameModalSession] = useState<AudioSession | null>(null);
  const [newTitleInput, setNewTitleInput] = useState<string>('');
  const [deleteModalSession, setDeleteModalSession] = useState<AudioSession | null>(null);
  const [deleteFileConfirm, setDeleteFileConfirm] = useState<{ session: AudioSession; file: DriveFileInfo } | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sort and filter files inside a session naturally (ascending by filename: audio-01, audio-02, ..., audio-10, audio-13)
  const getSortedAudioFiles = (session: AudioSession): DriveFileInfo[] => {
    if (!session.driveFiles) return [];
    const audioFiles = session.driveFiles.filter(f => f.name !== 'session-metadata.json');
    return [...audioFiles].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  // Filter & Sort Sessions List
  const filteredAndSortedSessions = React.useMemo(() => {
    let result = [...sessions];

    // Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(s => 
        (s.customTitle && s.customTitle.toLowerCase().includes(q)) ||
        s.folderName.toLowerCase().includes(q) ||
        s.baseName.toLowerCase().includes(q) ||
        s.sessionId.toLowerCase().includes(q) ||
        (s.text && s.text.toLowerCase().includes(q)) ||
        (s.driveFiles && s.driveFiles.some(f => f.name.toLowerCase().includes(q)))
      );
    }

    // Sort - preserving original createdAt date when sorted by newest/oldest
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'name_asc') {
        const nameA = (a.customTitle || a.folderName || '').toLowerCase();
        const nameB = (b.customTitle || b.folderName || '').toLowerCase();
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'name_desc') {
        const nameA = (a.customTitle || a.folderName || '').toLowerCase();
        const nameB = (b.customTitle || b.folderName || '').toLowerCase();
        return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'chunks') {
        const countA = a.driveFiles ? a.driveFiles.filter(f => f.name !== 'session-metadata.json').length : (a.totalChunks || 1);
        const countB = b.driveFiles ? b.driveFiles.filter(f => f.name !== 'session-metadata.json').length : (b.totalChunks || 1);
        return countB - countA;
      }
      return 0;
    });

    return result;
  }, [sessions, searchTerm, sortBy]);

  // Active playlist files
  const activePlaylist = activeSession ? getSortedAudioFiles(activeSession) : [];
  const currentTrack = activePlaylist[currentTrackIndex];

  // Load audio URL for current track (from cache or Drive)
  const resolveTrackAudioUrl = async (file: DriveFileInfo): Promise<string> => {
    if (trackBlobUrls[file.id]) {
      return trackBlobUrls[file.id];
    }
    setLoadingTrackId(file.id);
    setPlaybackError(null);
    try {
      const { url } = await googleDriveService.fetchAudioBlob(file.id, false);
      setTrackBlobUrls(prev => ({ ...prev, [file.id]: url }));
      setLoadingTrackId(null);
      return url;
    } catch (err: any) {
      setLoadingTrackId(null);
      console.warn('Erro ao carregar áudio do Drive:', err);
      // Try interactive
      try {
        const { url } = await googleDriveService.fetchAudioBlob(file.id, true);
        setTrackBlobUrls(prev => ({ ...prev, [file.id]: url }));
        return url;
      } catch (interactiveErr: any) {
        setPlaybackError(`Não foi possível carregar o arquivo ${file.name} do Drive.`);
        throw interactiveErr;
      }
    }
  };

  // Play track by index
  const playTrackAtIndex = async (index: number) => {
    if (!activeSession || index < 0 || index >= activePlaylist.length) return;
    const track = activePlaylist[index];
    setCurrentTrackIndex(index);
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      const url = await resolveTrackAudioUrl(track);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play()
          .then(() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = playbackSpeedRef.current;
            }
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error('Playback trigger error:', err);
            setIsPlaying(false);
          });
      }
    } catch (err) {
      setIsPlaying(false);
    }
  };

  // Start playing a session from the beginning (track index 0)
  const handleStartSessionPlayback = async (session: AudioSession, startIndex: number = 0) => {
    const playlist = getSortedAudioFiles(session);
    if (playlist.length === 0) {
      alert('Esta sessão não contém arquivos de áudio válidos.');
      return;
    }
    setActiveSession(session);
    setCurrentTrackIndex(startIndex);
    setIsPlaying(false);
    setCurrentTime(0);

    const track = playlist[startIndex];
    try {
      const url = await resolveTrackAudioUrl(track);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
        audioRef.current.playbackRate = playbackSpeedRef.current;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.play()
          .then(() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = playbackSpeedRef.current;
            }
            setIsPlaying(true);
          })
          .catch((e) => {
            console.warn('Autoplay blocked or waiting user gesture:', e);
          });
      }
    } catch (err) {
      console.warn('Error loading first track:', err);
    }
  };

  // Auto-play Next track when current ends (Continuous sequence playback!)
  const handleTrackEnded = () => {
    setIsPlaying(false);
    if (currentTrackIndex < activePlaylist.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      playTrackAtIndex(nextIndex);
    } else {
      // Reached the end of the playlist
      console.log('Fim da playlist da sessão.');
    }
  };

  const handleNextTrack = () => {
    if (currentTrackIndex < activePlaylist.length - 1) {
      playTrackAtIndex(currentTrackIndex + 1);
    }
  };

  const handlePrevTrack = () => {
    if (currentTrackIndex > 0) {
      playTrackAtIndex(currentTrackIndex - 1);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  // Rename Session
  const executeRenameSession = async () => {
    if (!renameModalSession || !newTitleInput.trim()) return;
    setActionLoading(true);
    try {
      const trimmed = newTitleInput.trim();
      if (onRenameSession) {
        await onRenameSession(renameModalSession, trimmed);
      } else if (onUpdateSession) {
        await onUpdateSession(renameModalSession.sessionId, { customTitle: trimmed });
      }
      // Update active session if it's the one being renamed
      if (activeSession?.sessionId === renameModalSession.sessionId) {
        setActiveSession(prev => prev ? { ...prev, customTitle: trimmed } : null);
      }
      setRenameModalSession(null);
    } catch (err) {
      console.error('Erro ao renomear sessão:', err);
      alert('Falha ao renomear sessão.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Entire Session
  const executeDeleteSession = async () => {
    if (!deleteModalSession) return;
    setActionLoading(true);
    try {
      if (onDeleteSession) {
        await onDeleteSession(deleteModalSession);
      }
      if (activeSession?.sessionId === deleteModalSession.sessionId) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setActiveSession(null);
      }
      setDeleteModalSession(null);
    } catch (err) {
      console.error('Erro ao deletar sessão:', err);
      alert('Falha ao deletar sessão.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Single File
  const executeDeleteFile = async () => {
    if (!deleteFileConfirm) return;
    const { session, file } = deleteFileConfirm;
    setActionLoading(true);
    try {
      if (onDeleteSessionFile) {
        await onDeleteSessionFile(session, file.id);
      }
      // Update local active session files if active
      if (activeSession?.sessionId === session.sessionId) {
        const remaining = (activeSession.driveFiles || []).filter(f => f.id !== file.id);
        if (remaining.filter(f => f.name !== 'session-metadata.json').length === 0) {
          // Session is gone because last file deleted
          if (audioRef.current) audioRef.current.pause();
          setActiveSession(null);
        } else {
          setActiveSession(prev => prev ? { ...prev, driveFiles: remaining } : null);
          if (currentTrack?.id === file.id) {
            if (audioRef.current) audioRef.current.pause();
            setIsPlaying(false);
          }
        }
      }
      setDeleteFileConfirm(null);
    } catch (err) {
      console.error('Erro ao deletar arquivo:', err);
      alert('Falha ao deletar arquivo.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Hidden Audio Element with continuous listeners */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (!duration || isNaN(duration)) {
              setDuration(audioRef.current.duration || 0);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
        }}
        onCanPlay={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
        }}
        onEnded={handleTrackEnded}
        onPlay={() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.warn('Audio playback error:', e);
          setIsPlaying(false);
        }}
      />

      {/* Header & Sync Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#FF4E00]" />
            GERENCIADOR DE SESSÕES & GOOGLE DRIVE
          </h2>
          <p className="text-xs font-mono text-white/50 mt-0.5">
            Gerencie, renomeie, filtre e reproduza sequencialmente todos os áudios e capítulos salvos no Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onRefresh(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-mono text-blue-300 font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Sincronizar Drive</span>
          </button>

          <button
            type="button"
            onClick={() => onRefresh(false)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#FF4E00]' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* ACTIVE CONTINUOUS SESSION PLAYER (Sticky / Featured) */}
      {activeSession && (
        <div className="p-6 rounded-3xl bg-black border-2 border-[#FF4E00]/40 shadow-[0_0_40px_rgba(255,78,0,0.15)] space-y-5 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF4E00]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Player Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#FF4E00] animate-pulse shadow-[0_0_12px_#FF4E00]" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold font-mono text-white">
                    {activeSession.customTitle || activeSession.baseName || activeSession.folderName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#FF4E00]/20 border border-[#FF4E00]/40 text-[#FF4E00] text-[10px] font-mono font-bold">
                    REPRODUÇÃO SEQUENCIAL
                  </span>
                </div>
                <div className="text-[11px] font-mono text-white/50 mt-0.5 flex items-center gap-2">
                  <span>Pasta: {activeSession.folderName}</span>
                  <span>•</span>
                  <span>Criada em: {new Date(activeSession.createdAt).toLocaleDateString()} {new Date(activeSession.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setActiveSession(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
              title="Fechar player da sessão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Current Playing Track Banner */}
          <div className="bg-[#0e0e0e] border border-white/10 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#FF4E00]/10 border border-[#FF4E00]/30 flex items-center justify-center shrink-0">
                <Music className="w-5 h-5 text-[#FF4E00]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-white flex items-center gap-2 truncate">
                  <span className="text-[#FF4E00]">Parte {currentTrackIndex + 1} de {activePlaylist.length}:</span>
                  <span className="truncate">{currentTrack?.name || 'Selecione uma faixa'}</span>
                </div>
                <div className="text-[11px] font-mono text-white/40 mt-0.5">
                  Ordem Crescente Automática • Próxima faixa toca sozinha ao finalizar
                </div>
              </div>
            </div>

            {/* Quick waveform visualizer */}
            <div className="flex items-center gap-1 shrink-0 px-3 py-1.5 bg-black/60 rounded-xl border border-white/5">
              <div className={`w-1 bg-[#FF4E00] rounded-full transition-all ${isPlaying ? 'h-5 animate-pulse' : 'h-2 opacity-30'}`} />
              <div className={`w-1 bg-[#FF4E00] rounded-full transition-all ${isPlaying ? 'h-7 animate-bounce' : 'h-3 opacity-30'}`} />
              <div className={`w-1 bg-[#FF4E00] rounded-full transition-all ${isPlaying ? 'h-4 animate-pulse' : 'h-2 opacity-30'}`} />
              <div className={`w-1 bg-[#FF4E00] rounded-full transition-all ${isPlaying ? 'h-8 animate-bounce' : 'h-3 opacity-30'}`} />
              <div className={`w-1 bg-[#FF4E00] rounded-full transition-all ${isPlaying ? 'h-5 animate-pulse' : 'h-2 opacity-30'}`} />
              <span className="text-[10px] font-mono text-white/60 ml-2">
                {isPlaying ? 'TOCANDO' : 'PAUSADO'}
              </span>
            </div>
          </div>

          {/* Player Progress Scrubber */}
          <div className="space-y-1.5 relative z-10">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.05}
              value={currentTime}
              onChange={(e) => {
                const time = parseFloat(e.target.value);
                setCurrentTime(time);
                if (audioRef.current) audioRef.current.currentTime = time;
              }}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
            />
            <div className="flex justify-between text-[11px] font-mono text-white/50">
              <span className="text-[#FF4E00]">{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Player Console Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10 pt-1">
            <div className="flex items-center gap-3">
              {/* Previous */}
              <button
                type="button"
                onClick={handlePrevTrack}
                disabled={currentTrackIndex === 0}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white flex items-center justify-center transition-colors border border-white/10"
                title="Faixa Anterior"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-12 h-12 rounded-2xl bg-[#FF4E00] hover:bg-[#ff6220] text-black flex items-center justify-center font-bold shadow-[0_0_20px_rgba(255,78,0,0.4)] active:scale-95 transition-all"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {loadingTrackId ? (
                  <Loader2 className="w-6 h-6 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current text-black" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5 fill-current text-black" />
                )}
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={handleNextTrack}
                disabled={currentTrackIndex >= activePlaylist.length - 1}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white flex items-center justify-center transition-colors border border-white/10"
                title="Próxima Faixa"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Speed dropdown */}
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-mono text-white/80">
                <span>Vel:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => {
                    const spd = parseFloat(e.target.value);
                    setPlaybackSpeed(spd);
                    if (audioRef.current) audioRef.current.playbackRate = spd;
                  }}
                  className="bg-transparent border-none text-[#FF4E00] font-bold focus:outline-none cursor-pointer"
                >
                  <option value="0.75" className="bg-[#111] text-white">0.75x</option>
                  <option value="1.0" className="bg-[#111] text-white">1.0x</option>
                  <option value="1.25" className="bg-[#111] text-white">1.25x</option>
                  <option value="1.5" className="bg-[#111] text-white">1.5x</option>
                  <option value="2.0" className="bg-[#111] text-white">2.0x</option>
                </select>
              </div>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current) {
                    if (isMuted) {
                      audioRef.current.volume = volume || 0.8;
                      setIsMuted(false);
                    } else {
                      audioRef.current.volume = 0;
                      setIsMuted(true);
                    }
                  }
                }}
                className="text-white/60 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (audioRef.current) {
                    audioRef.current.volume = val;
                    setIsMuted(val === 0);
                  }
                }}
                className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
              />
            </div>
          </div>

          {/* Ordered Track Playlist Table */}
          <div className="space-y-2 pt-2 border-t border-white/10 relative z-10">
            <div className="flex items-center justify-between text-xs font-mono text-white/50">
              <span className="uppercase text-[10px] tracking-wider text-white/40">
                Lista de Faixas em Sequência Crescente ({activePlaylist.length} arquivos):
              </span>
              <span className="text-[10px] text-emerald-400">
                Auto-avanço ativado
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {activePlaylist.map((file, idx) => {
                const isCurrent = currentTrackIndex === idx;
                const isLoadingThis = loadingTrackId === file.id;

                return (
                  <div
                    key={file.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono transition-all ${
                      isCurrent
                        ? 'bg-[#FF4E00]/10 border-[#FF4E00]/50 text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    <div
                      onClick={() => playTrackAtIndex(idx)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
                          isCurrent
                            ? 'bg-[#FF4E00] text-black font-bold'
                            : 'bg-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isCurrent && isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-2 truncate">
                          <span className="text-[#FF4E00] text-[11px]">{idx + 1}.</span>
                          <span className="truncate">{file.name}</span>
                        </div>
                        {file.sizeBytes && (
                          <div className="text-[10px] text-white/40">
                            {formatFileSize(file.sizeBytes)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white"
                          title="Ver arquivo no Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteFileConfirm({ session: activeSession, file })}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                        title="Deletar este arquivo do Drive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SEARCH AND SORT TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0c0c0c] border border-white/10 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome da sessão, pasta, texto ou capítulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-9 py-2 text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#FF4E00]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="w-4 h-4 text-[#FF4E00] shrink-0" />
          <span className="text-xs font-mono text-white/50 hidden md:inline">Ordenar:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#FF4E00] cursor-pointer"
          >
            <option value="newest" className="bg-[#111] text-white">Mais recentes (Criação ↓)</option>
            <option value="oldest" className="bg-[#111] text-white">Mais antigas (Criação ↑)</option>
            <option value="name_asc" className="bg-[#111] text-white">Nome (A → Z)</option>
            <option value="name_desc" className="bg-[#111] text-white">Nome (Z → A)</option>
            <option value="chunks" className="bg-[#111] text-white">Mais capítulos</option>
          </select>
        </div>
      </div>

      {/* SESSIONS LIST */}
      {filteredAndSortedSessions.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <Folder className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-sm font-mono text-white/70 font-semibold mb-1">
            {searchTerm ? 'Nenhuma sessão encontrada com essa busca' : 'Nenhuma sessão registrada'}
          </p>
          <p className="text-xs font-mono text-white/40 max-w-sm mx-auto">
            {searchTerm ? 'Tente buscar com outro termo ou limpe o filtro.' : 'Gere um novo áudio no sintetizador para criar uma pasta de sessão estruturada no seu Google Drive.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedSessions.map((session) => {
            const sortedAudioFiles = getSortedAudioFiles(session);
            const isSessionActive = activeSession?.sessionId === session.sessionId;

            return (
              <div
                key={session.sessionId}
                className={`p-5 rounded-2xl bg-[#0c0c0c] border transition-all group ${
                  isSessionActive
                    ? 'border-[#FF4E00]/60 bg-[#0e0e0e] shadow-[0_0_24px_rgba(255,78,0,0.1)]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Session Identification & Custom Title */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Custom Title or Base Title */}
                      <span className="text-sm font-bold font-mono text-white flex items-center gap-1.5">
                        <Folder className="w-4 h-4 text-[#FF4E00] shrink-0" />
                        <span>{session.customTitle || session.baseName || session.folderName}</span>
                      </span>

                      {/* Folder Name Tag */}
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 text-[10px] font-mono">
                        {session.folderName}
                      </span>

                      {session.isSavedToDrive && session.driveFolderUrl && (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          DRIVE SINCRONIZADO
                        </span>
                      )}

                      {/* Creation Date Badge (Always Preserved) */}
                      <span className="text-[11px] font-mono text-white/40 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#FF4E00]" />
                        {new Date(session.createdAt).toLocaleDateString()} {new Date(session.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Prompt Text Preview */}
                    <p className="text-xs text-white/80 line-clamp-2 font-mono leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/5">
                      {session.text}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Continuous Auto-Play All Button */}
                    <button
                      type="button"
                      onClick={() => handleStartSessionPlayback(session, 0)}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FF4E00] hover:bg-[#ff6220] text-black font-mono text-xs font-bold transition-all shadow-[0_0_16px_rgba(255,78,0,0.3)] cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current text-black" />
                      <span>Reproduzir Sessão ({sortedAudioFiles.length || session.totalChunks})</span>
                    </button>

                    {/* Rename Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setRenameModalSession(session);
                        setNewTitleInput(session.customTitle || session.baseName || '');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 font-mono text-xs transition-colors cursor-pointer"
                      title="Renomear título da sessão"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#FF4E00]" />
                      <span>Renomear</span>
                    </button>

                    {/* Drive Link */}
                    {session.driveFolderUrl && (
                      <a
                        href={session.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 font-mono text-xs transition-colors"
                        title="Abrir pasta no Google Drive"
                      >
                        <Cloud className="w-3.5 h-3.5 text-blue-400" />
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </a>
                    )}

                    {/* Delete Session Button */}
                    <button
                      type="button"
                      onClick={() => setDeleteModalSession(session)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                      title="Excluir sessão e todos os seus arquivos do Drive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Ordered Files Preview List in Session Card */}
                {sortedAudioFiles.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">
                        Arquivos em Ordem Crescente ({sortedAudioFiles.length}):
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sortedAudioFiles.map((file, idx) => (
                        <div
                          key={file.id}
                          className="group/file inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[11px] font-mono transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => handleStartSessionPlayback(session, idx)}
                            className="flex items-center gap-1 text-white hover:text-[#FF4E00] cursor-pointer"
                            title={`Tocar a partir de ${file.name}`}
                          >
                            <Play className="w-3 h-3 fill-current text-[#FF4E00]" />
                            <span>{file.name}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteFileConfirm({ session, file })}
                            className="opacity-40 group-hover/file:opacity-100 hover:text-rose-400 transition-opacity ml-1 cursor-pointer"
                            title="Deletar este arquivo do Drive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* RENAME MODAL */}
      {renameModalSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0e0e] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#FF4E00]" />
                RENOMEAR SESSÃO
              </h3>
              <button
                type="button"
                onClick={() => setRenameModalSession(null)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs font-mono text-white/60">
              Altere o título de exibição da sessão. A data original de criação ({new Date(renameModalSession.createdAt).toLocaleDateString()}) será preservada intacta na ordenação.
            </p>

            <div>
              <label className="text-[11px] font-mono text-white/50 block mb-1.5">Novo Título da Sessão:</label>
              <input
                type="text"
                value={newTitleInput}
                onChange={(e) => setNewTitleInput(e.target.value)}
                placeholder="Ex: Livro Capítulo 1 a 13"
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-[#FF4E00]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenameModalSession(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-white/70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeRenameSession}
                disabled={actionLoading || !newTitleInput.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF4E00] hover:bg-[#ff6220] text-black font-mono text-xs font-bold disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
                <span>Salvar Nome</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ENTIRE SESSION MODAL */}
      {deleteModalSession && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0e0e] border border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold font-mono text-white">
                EXCLUIR SESSÃO COMPLETA?
              </h3>
            </div>

            <p className="text-xs font-mono text-white/70 leading-relaxed">
              Você está prestes a excluir a sessão <strong className="text-white">{deleteModalSession.customTitle || deleteModalSession.folderName}</strong>.
            </p>
            <p className="text-[11px] font-mono text-rose-300 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
              ⚠️ Isso apagará permanentemente a pasta e todos os seus arquivos de áudio do Google Drive e do banco de dados.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalSession(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-white/70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDeleteSession}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SINGLE FILE CONFIRM MODAL */}
      {deleteFileConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e0e0e] border border-rose-500/30 rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold font-mono text-white">
                EXCLUIR ARQUIVO DE ÁUDIO?
              </h3>
            </div>

            <p className="text-xs font-mono text-white/70">
              Deseja deletar o arquivo <strong className="text-white">{deleteFileConfirm.file.name}</strong> do Google Drive?
            </p>

            {/* Special single file remaining rule explanation */}
            {getSortedAudioFiles(deleteFileConfirm.session).length <= 1 && (
              <p className="text-[11px] font-mono text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                ℹ️ Este é o único arquivo restante desta sessão. Ao deletá-lo, a pasta da sessão no Google Drive também será removida para evitar pastas órfãs sem conteúdo.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteFileConfirm(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-white/70"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDeleteFile}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Excluir Arquivo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

