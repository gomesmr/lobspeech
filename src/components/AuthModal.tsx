import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, UserPlus, KeyRound, Sparkles, Mail, Lock, AlertCircle, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Tente entrar.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter no mínimo 6 caracteres.');
      } else {
        setError(err.message || 'Falha ao autenticar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Falha ao autenticar com o Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 font-mono">
            <ShieldCheck className="w-5 h-5 text-[#FF4E00]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {isSignUp ? 'Criar Nova Conta' : 'Acessar Backend TTS'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white text-xs font-mono p-1 rounded-lg hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-xs flex items-center justify-center gap-3 transition-all mb-4"
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
          <span>Continuar com Google</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-[10px] font-mono text-white/30 uppercase">ou com e-mail</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1.5">E-mail</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 font-mono"
              />
              <Mail className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-white/40 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 pl-9 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF4E00]/60 font-mono"
              />
              <Lock className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#FF4E00] hover:bg-[#ff6220] text-black font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all mt-2"
          >
            {isSignUp ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            <span>{isSignUp ? 'Criar Conta' : 'Entrar'}</span>
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs font-mono text-white/50 hover:text-white transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Entrar' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
}
