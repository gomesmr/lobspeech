import { useState, useEffect } from 'react';
import { Sparkles, Terminal, Activity, User, LogOut, Key, ShieldCheck, HardDrive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from './AuthModal';

interface HeaderProps {
  activeTab: 'playground' | 'sessions' | 'docs' | 'environment';
  setActiveTab: (tab: 'playground' | 'sessions' | 'docs' | 'environment') => void;
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
  const { user, profile, signOut, loading } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [serverHealth, setServerHealth] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [uptime, setUptime] = useState<string>('00:04:12');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Health error');
      })
      .then((data) => {
        setServerHealth('healthy');
        if (data.uptimeSeconds) {
          const hours = Math.floor(data.uptimeSeconds / 3600);
          const minutes = Math.floor((data.uptimeSeconds % 3600) / 60);
          const seconds = Math.floor(data.uptimeSeconds % 60);
          setUptime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        }
      })
      .catch(() => setServerHealth('error'));
  }, []);

  const copyApiKey = () => {
    if (profile?.apiKey) {
      navigator.clipboard.writeText(profile.apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <>
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Engine Identifier */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 bg-[#FF4E00] rounded-full shadow-[0_0_14px_#FF4E00] animate-pulse"></div>
              <div className="absolute w-6 h-6 rounded-full bg-[#FF4E00]/20 animate-ping"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-white tracking-tight font-mono">
                  TTS-CORE <span className="text-white/40 font-sans font-normal text-xs sm:text-sm">/ SYNTHESIZER ENGINE v2.4</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono tracking-wider font-bold bg-[#FF4E00]/10 text-[#FF4E00] border border-[#FF4E00]/30">
                  FIREBASE AUTH
                </span>
              </div>
              <p className="text-[11px] text-white/50 font-mono tracking-wide">
                STREAMING NEURAL VOICE SYNTHESIS • MP3 / WAV / OGG PIPELINE
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 backdrop-blur-md">
            <button
              id="tab-playground"
              type="button"
              onClick={() => setActiveTab('playground')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'playground'
                  ? 'bg-[#FF4E00] text-black font-semibold shadow-[0_0_16px_rgba(255,78,0,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Playground
            </button>
            <button
              id="tab-sessions"
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'sessions'
                  ? 'bg-[#FF4E00] text-black font-semibold shadow-[0_0_16px_rgba(255,78,0,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Sessões & Drive</span>
            </button>
            <button
              id="tab-docs"
              type="button"
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'docs'
                  ? 'bg-[#FF4E00] text-black font-semibold shadow-[0_0_16px_rgba(255,78,0,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>API Docs</span>
            </button>
            <button
              id="tab-environment"
              type="button"
              onClick={() => setActiveTab('environment')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'environment'
                  ? 'bg-[#FF4E00] text-black font-semibold shadow-[0_0_16px_rgba(255,78,0,0.4)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Diagnóstico</span>
            </button>
          </nav>

          {/* User Auth & Telemetry */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5 pr-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#FF4E00]/20 text-[#FF4E00] flex items-center justify-center font-mono font-bold text-xs">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono font-medium text-white truncate max-w-[120px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="px-1.5 py-0.2 bg-[#FF4E00]/20 text-[#FF4E00] border border-[#FF4E00]/40 text-[8px] font-mono font-bold rounded">
                      MASTER
                    </span>
                  </div>
                  {profile?.apiKey && (
                    <button
                      type="button"
                      onClick={copyApiKey}
                      className="text-[9px] font-mono text-white/50 hover:text-[#00FF66] text-left transition-colors flex items-center gap-1"
                      title="Clique para copiar sua API Key secreta"
                    >
                      <Key className="w-2.5 h-2.5" />
                      <span>{copiedKey ? 'Copiada!' : `${profile.apiKey.slice(0, 12)}...`}</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="ml-1 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-rose-400 transition-colors"
                  title="Sair da conta"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-mono flex items-center gap-2 transition-all hover:border-[#FF4E00]/50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF4E00]" />
                <span>Entrar / Cadastrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}

