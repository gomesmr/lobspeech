import React, { useState } from 'react';
import { useAuth, SUPER_ADMIN_EMAIL } from '../contexts/AuthContext';
import { ShieldCheck, LogIn, Mail, Lock, AlertCircle, Sparkles, Key, Radio, Layers, Volume2, ShieldAlert } from 'lucide-react';

export function SplashScreen() {
  const { signInWithGoogle, signInWithEmail, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError('Falha ao autenticar com o Google. Verifique a conta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Prior check for super admin email
    if (email.toLowerCase().trim() !== SUPER_ADMIN_EMAIL.toLowerCase().trim()) {
      setError(`Acesso restrito. Apenas o Master Admin (${SUPER_ADMIN_EMAIL}) possui autorização de acesso.`);
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white font-mono p-4">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FF4E00]/10 border border-[#FF4E00]/30 flex items-center justify-center animate-pulse">
            <Radio className="w-6 h-6 text-[#FF4E00]" />
          </div>
          <div className="absolute w-20 h-20 rounded-full bg-[#FF4E00]/10 animate-ping"></div>
        </div>
        <div className="text-sm font-semibold text-white/80 tracking-wider">CARREGANDO SISTEMA...</div>
        <div className="text-[11px] text-white/40 mt-1">VERIFICANDO CREDENCIAIS DE ACESSO</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between selection:bg-[#FF4E00] selection:text-black">
      {/* Top subtle bar */}
      <header className="border-b border-white/5 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF4E00] shadow-[0_0_10px_#FF4E00]"></div>
          <span className="font-mono text-xs tracking-wider text-white/70">TTS-CORE ENGINE / PRO-AUDIO</span>
        </div>
        <div className="text-[10px] font-mono text-white/40 tracking-widest uppercase">
          ACESSO MASTER RESTRITO
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF4E00]/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header Title */}
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#FF4E00]/10 border border-[#FF4E00]/30 text-[#FF4E00] mb-3 shadow-[0_0_20px_rgba(255,78,0,0.15)]">
              <Volume2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold font-mono tracking-tight text-white mb-1">
              Text-to-Speech API Backend
            </h1>
            <p className="text-xs font-mono text-white/50">
              Painel de Controle & Síntese Neural Gemini
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5 font-mono animate-fade-in">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign-in (Recommended for master user) */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-white/90 text-black font-mono text-xs font-bold flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-[0.99] mb-4 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
              />
            </svg>
            <span>Entrar com Conta Google Master</span>
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">ou credenciais</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-white/40 mb-1.5">
                E-mail do Administrador Master
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gomes.mr@gmail.com"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 pl-10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 font-mono transition-colors"
                />
                <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-white/40 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-3 pl-10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 font-mono transition-colors"
                />
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#FF4E00] hover:bg-[#ff6220] text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,78,0,0.3)] active:scale-[0.99] cursor-pointer disabled:opacity-50 mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{submitting ? 'Autenticando...' : 'Acessar Painel Master'}</span>
            </button>
          </form>

          {/* Master info notice */}
          <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2.5 text-[11px] font-mono text-white/40">
            <ShieldCheck className="w-4 h-4 text-[#FF4E00] shrink-0" />
            <span>Super Usuário Designado: <strong className="text-white/70">gomes.mr@gmail.com</strong></span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 px-6 text-center">
        <p className="text-[10px] font-mono text-white/30">
          PROTEGIDO POR FIREBASE AUTH & FIRESTORE ABAC SECURITY RULES • GEMINI 3.1 FLASH TTS
        </p>
      </footer>
    </div>
  );
}
