import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Play, Pause, Download, Volume2, VolumeX, RotateCcw, Copy, Check, Music, Layers, ChevronRight, FileDown } from 'lucide-react';
import { SynthesizedAudio, AudioChunkItem } from '../types';

interface AudioPlayerProps {
  audio: SynthesizedAudio;
}

export function AudioPlayer({ audio }: AudioPlayerProps) {
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedBase64, setCopiedBase64] = useState(false);
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
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = playbackSpeed;
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const hasMultipleChunks = Boolean(audio.chunks && audio.chunks.length > 1);
  const currentChunk: AudioChunkItem | undefined = hasMultipleChunks && audio.chunks 
    ? audio.chunks[selectedChunkIndex] 
    : undefined;

  const currentAudioUrl = currentChunk ? currentChunk.url : audio.url;
  const currentFilename = currentChunk ? currentChunk.filename : (audio.filename || `audio-01.${audio.format}`);
  const currentText = currentChunk ? currentChunk.textFull : audio.text;
  const currentBlob = currentChunk ? currentChunk.blob : audio.blob;
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setPlaybackError(null);
    if (audioRef.current) {
      audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
      audioRef.current.playbackRate = playbackSpeedRef.current;
      audioRef.current.load();
    }
  }, [currentAudioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    setPlaybackError(null);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
      audioRef.current.playbackRate = playbackSpeedRef.current;
      audioRef.current
        .play()
        .then(() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Playback error:', err);
          setIsPlaying(false);
          setPlaybackError('Clique no botão de Play para iniciar a reprodução.');
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!duration || isNaN(duration) || duration === 0) {
        setDuration(audioRef.current.duration || (currentChunk ? currentChunk.durationSeconds : audio.durationSeconds));
      }
    }
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleDownloadSingle = (chunkItem?: AudioChunkItem) => {
    const itemUrl = chunkItem ? chunkItem.url : currentAudioUrl;
    const itemName = chunkItem ? chunkItem.filename : currentFilename;
    const a = document.createElement('a');
    a.href = itemUrl;
    a.download = itemName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = () => {
    if (!audio.chunks || audio.chunks.length === 0) {
      handleDownloadSingle();
      return;
    }
    audio.chunks.forEach((chunk, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = chunk.url;
        a.download = chunk.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
  };

  const copyBase64 = async () => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        navigator.clipboard.writeText(base64data);
        setCopiedBase64(true);
        setTimeout(() => setCopiedBase64(false), 2000);
      };
      reader.readAsDataURL(currentBlob);
    } catch {
      // fallback
    }
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div id="audio-player-container" className="relative rounded-3xl bg-black border border-white/10 overflow-hidden shadow-2xl backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        preload="auto"
        onPlay={() => {
          if (audioRef.current) {
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          handleTimeUpdate();
          if (audioRef.current) {
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
        }}
        onCanPlay={() => {
          setPlaybackError(null);
          if (audioRef.current) {
            audioRef.current.defaultPlaybackRate = playbackSpeedRef.current;
            audioRef.current.playbackRate = playbackSpeedRef.current;
          }
        }}
        onError={(e) => {
          console.error('Audio element error:', e);
          setIsPlaying(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          // Auto-play next chunk if available
          if (hasMultipleChunks && audio.chunks && selectedChunkIndex < audio.chunks.length - 1) {
            setSelectedChunkIndex(selectedChunkIndex + 1);
          }
        }}
      />

      {/* Atmospheric Orange Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#ff4e0018_0%,_transparent_75%)] pointer-events-none"></div>

      {/* Top Bar with Audio Metadata & Sanitized Base Name */}
      <div className="relative p-5 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-[#FF4E00] rounded-full shadow-[0_0_10px_#FF4E00]"></div>
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-white flex items-center gap-2 flex-wrap">
              <span className="text-[#FF4E00] font-mono bg-[#FF4E00]/10 px-2 py-0.5 rounded border border-[#FF4E00]/30">
                {currentFilename}
              </span>
              {hasMultipleChunks && (
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-white/10 text-white/80 border border-white/15 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[#00FF66]" />
                  <span>PARTE {selectedChunkIndex + 1} DE {audio.chunks?.length}</span>
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-white/50 mt-1">
              VOZ: <span className="text-white/80">{audio.voice}</span> • IDIOMA: <span className="text-white/80">{audio.language}</span> • VELOCIDADE: <span className="text-[#FF4E00]">{audio.speed}x</span> • TAMANHO: <span className="text-white/80">{formatFileSize(currentBlob.size)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {audio.driveFolderUrl && (
            <a
              id="btn-open-drive-folder"
              href={audio.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 rounded-xl transition-all border border-blue-500/30"
              title="Abrir pasta da sessão no Google Drive"
            >
              <Music className="w-3.5 h-3.5 text-blue-400" />
              <span>PASTA NO DRIVE</span>
            </a>
          )}

          <button
            id="btn-copy-base64"
            onClick={copyBase64}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-medium bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-xl transition-all border border-white/10"
            title="Copiar áudio codificado em Base64"
          >
            {copiedBase64 ? <Check className="w-3.5 h-3.5 text-[#00FF66]" /> : <Copy className="w-3.5 h-3.5 text-white/60" />}
            <span>{copiedBase64 ? 'COPIADO!' : 'BASE64'}</span>
          </button>

          {hasMultipleChunks && (
            <button
              id="btn-download-all"
              onClick={handleDownloadAll}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono font-semibold bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all border border-white/20"
              title="Baixar todos os arquivos fatiados em sequência"
            >
              <FileDown className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>BAIXAR TODOS ({audio.chunks?.length})</span>
            </button>
          )}

          <button
            id="btn-download-audio"
            onClick={() => handleDownloadSingle()}
            type="button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono font-semibold bg-[#FF4E00] hover:bg-[#ff6220] text-black rounded-xl transition-all shadow-[0_0_16px_rgba(255,78,0,0.3)]"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>EXPORTAR ARQUIVO</span>
          </button>
        </div>
      </div>

      {/* Multiple Chunks Selector Tabs (if text was split into parts) */}
      {hasMultipleChunks && audio.chunks && (
        <div className="px-5 py-3 bg-white/[0.02] border-b border-white/10 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest shrink-0 mr-1">
            Trechos Fatiados:
          </span>
          {audio.chunks.map((chunk, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedChunkIndex(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all shrink-0 flex items-center gap-1.5 ${
                selectedChunkIndex === idx
                  ? 'bg-[#FF4E00] text-black font-bold shadow-[0_0_12px_rgba(255,78,0,0.4)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
              }`}
            >
              <span>{chunk.filename}</span>
              <span className={`text-[10px] ${selectedChunkIndex === idx ? 'text-black/70' : 'text-white/40'}`}>
                ({formatTime(chunk.durationSeconds)})
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Immersive Visualizer Stage */}
      <div className="relative h-44 flex flex-col items-center justify-center p-6">
        {/* Animated Sound Wave Graphic */}
        <div className="flex items-center justify-center gap-1.5 opacity-90 my-auto">
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-10 animate-waveform-1' : 'h-6 opacity-40'}`}></div>
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-20 animate-waveform-2' : 'h-10 opacity-50'}`}></div>
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-14 animate-waveform-3' : 'h-8 opacity-40'}`}></div>
          <div className={`w-1.5 bg-[#FF4E00] rounded-full shadow-[0_0_16px_#FF4E00] transition-all duration-300 ${isPlaying ? 'h-28 animate-waveform-4' : 'h-16 opacity-70'}`}></div>
          <div className={`w-2 bg-[#FF4E00] rounded-full shadow-[0_0_24px_#FF4E00] transition-all duration-300 ${isPlaying ? 'h-36 animate-waveform-5' : 'h-24'}`}></div>
          <div className={`w-1.5 bg-[#FF4E00] rounded-full shadow-[0_0_16px_#FF4E00] transition-all duration-300 ${isPlaying ? 'h-28 animate-waveform-4' : 'h-16 opacity-70'}`}></div>
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-14 animate-waveform-3' : 'h-8 opacity-40'}`}></div>
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-20 animate-waveform-2' : 'h-10 opacity-50'}`}></div>
          <div className={`w-1 bg-[#FF4E00] rounded-full transition-all duration-300 ${isPlaying ? 'h-10 animate-waveform-1' : 'h-6 opacity-40'}`}></div>
        </div>

        {/* Text Transcript preview in visualizer */}
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-white/40 pt-2 border-t border-white/5">
          <div className="truncate max-w-[70%] italic text-white/70">
            "{currentText}"
          </div>
          <div className="flex items-center gap-1.5 text-[#00FF66] shrink-0 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse"></span>
            <span>{isPlaying ? 'PLAYING' : 'READY'}</span>
          </div>
        </div>
      </div>

      {/* Control Console */}
      <div className="p-5 bg-white/[0.03] border-t border-white/10 space-y-4">
        <div className="flex items-center gap-4">
          <button
            id="btn-toggle-play"
            onClick={togglePlay}
            type="button"
            className="w-12 h-12 rounded-2xl bg-[#FF4E00] hover:bg-[#ff6220] text-black flex items-center justify-center transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,78,0,0.4)] shrink-0 font-bold"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-current text-black" /> : <Play className="w-6 h-6 ml-0.5 fill-current text-black" />}
          </button>

          <button
            id="btn-replay-audio"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().then(() => setIsPlaying(true));
              }
            }}
            type="button"
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors shrink-0 border border-white/10"
            title="Reiniciar áudio deste trecho"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Time Scrubber */}
          <div className="flex-1 flex flex-col gap-1.5">
            <input
              id="audio-seek-slider"
              type="range"
              min={0}
              max={duration || 100}
              step={0.05}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
            />
            <div className="flex justify-between text-[11px] font-mono text-white/50">
              <span className="text-[#FF4E00]">{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Speed Control */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-mono text-white/80 shrink-0">
            <span className="text-[10px] text-white/40">VEL:</span>
            <select
              id="audio-player-speed-select"
              value={playbackSpeed}
              onChange={(e) => {
                const spd = parseFloat(e.target.value);
                setPlaybackSpeed(spd);
                if (audioRef.current) {
                  audioRef.current.defaultPlaybackRate = spd;
                  audioRef.current.playbackRate = spd;
                }
              }}
              className="bg-transparent border-none text-[#FF4E00] font-bold focus:outline-none cursor-pointer text-xs"
            >
              <option value="0.75" className="bg-[#111] text-white">0.75x</option>
              <option value="1.0" className="bg-[#111] text-white">1.0x</option>
              <option value="1.25" className="bg-[#111] text-white">1.25x</option>
              <option value="1.5" className="bg-[#111] text-white">1.5x</option>
              <option value="2.0" className="bg-[#111] text-white">2.0x</option>
            </select>
          </div>

          {/* Volume Control */}
          <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-white/10">
            <button
              id="btn-toggle-mute"
              onClick={toggleMute}
              type="button"
              className="text-white/60 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              id="audio-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF4E00]"
              title="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
