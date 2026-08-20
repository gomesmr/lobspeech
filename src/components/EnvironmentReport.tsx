import { Cpu, Globe, Server, CheckCircle2, Layers, Zap, Terminal } from 'lucide-react';

export function EnvironmentReport() {
  return (
    <div className="space-y-6 text-[#e0e0e0]">
      {/* Overview Card */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-[#FF4E00]/15 text-[#FF4E00] flex items-center justify-center border border-[#FF4E00]/30 shadow-[0_0_12px_rgba(255,78,0,0.2)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-mono">
              ETAPA 1 — Avaliação do Ambiente e Justificativa da Stack
            </h2>
            <p className="text-xs text-white/50 font-mono">
              INSPEÇÃO DO RUNTIME CONTAINERIZADO • MOTORES TTS • DESEMPENHO EM CPU
            </p>
          </div>
        </div>

        <p className="text-sm text-white/70 leading-relaxed font-sans">
          Antes do desenvolvimento do backend, realizamos uma auditoria rigorosa de hardware, runtimes e encoders disponíveis. Abaixo estão os dados de telemetria coletados diretamente no container e a justificativa técnica para a stack selecionada.
        </p>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[#FF4E00] mb-2 font-mono">
            <Server className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold">Sistema / Kernel</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">Linux x86_64</div>
          <div className="text-xs text-white/40 mt-1">Cloud Run Sandboxed (gVisor)</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[#FF4E00] mb-2 font-mono">
            <Zap className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold">Runtimes Nativos</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">Node.js 22 + Python 3.10</div>
          <div className="text-xs text-white/40 mt-1">npm 10.9 & tsx nativos</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-amber-400 mb-2 font-mono">
            <Cpu className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold">Aceleração Gráfica</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">Apenas CPU (Sem GPU)</div>
          <div className="text-xs text-white/40 mt-1">Zero overhead para inferência</div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2 text-[#00FF66] mb-2 font-mono">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] uppercase tracking-[0.15em] font-bold">Encoder & Rede</span>
          </div>
          <div className="text-sm font-bold text-white font-mono">FFmpeg 4.4 + HTTPS Out</div>
          <div className="text-xs text-white/40 mt-1">LAME MP3, PCM WAV & OGG Vorbis</div>
        </div>
      </div>

      {/* Recommended Stack vs Alternatives */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
        <h3 className="text-xs uppercase font-mono tracking-[0.2em] text-white/40 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#00FF66]" />
          <span>Arquitetura Implementada vs. Alternativas Avaliadas</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Implemented Stack */}
          <div className="border border-[#FF4E00]/40 bg-[#FF4E00]/5 rounded-2xl p-5 space-y-3 shadow-[0_0_20px_rgba(255,78,0,0.1)]">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#FF4E00] text-black shadow-sm">
                STACK RECOMENDADA (Implementada)
              </span>
              <span className="text-xs font-mono text-[#00FF66] font-bold">QUALIDADE EXCELENTE EM PT-BR</span>
            </div>
            <div className="text-sm font-bold text-white font-mono">
              Node.js 22 + Express + Gemini 3.1 TTS + FFmpeg
            </div>
            <ul className="text-xs space-y-2 text-white/80 leading-relaxed font-sans">
              <li>
                <strong className="text-white">Linguagem & Backend:</strong> TypeScript com Express no Node.js 22. O workspace já possui integração nativa, compilação via TSX e binding em 0.0.0.0:3000.
              </li>
              <li>
                <strong className="text-white">Motor TTS:</strong> Modelo neural <code className="text-[#FF4E00] font-mono">gemini-3.1-flash-tts-preview</code> via SDK oficial <code className="text-[#FF4E00] font-mono">@google/genai</code>. Chave injetada com segurança (<code className="text-[#FF4E00] font-mono">GEMINI_API_KEY</code>). Gera prosódia ultra-natural em português brasileiro (pt-BR).
              </li>
              <li>
                <strong className="text-white">Processamento & Formatos:</strong> FFmpeg nativo (<code className="text-[#FF4E00] font-mono">libmp3lame</code>, <code className="text-[#FF4E00] font-mono">libvorbis</code> e PCM) para conversão instantânea e controle de velocidade com filtro <code className="text-[#FF4E00] font-mono">atempo</code>.
              </li>
              <li>
                <strong className="text-white">Zero Impacto de GPU:</strong> Como o container não possui GPU, modelos locais causariam timeout ou travamentos. A inferência em nuvem roda em ~380ms com streaming binário direto.
              </li>
            </ul>
          </div>

          {/* Alternative Stack */}
          <div className="border border-white/10 bg-black/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold font-mono bg-white/10 text-white/60">
                STACK ALTERNATIVA
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold">OFFLINE / LOCAL</span>
            </div>
            <div className="text-sm font-bold text-white/70 font-mono">
              Python 3.10 + FastAPI + Piper TTS Local (ONNX CPU)
            </div>
            <ul className="text-xs space-y-2 text-white/60 leading-relaxed font-sans">
              <li>
                <strong className="text-white/80">Linguagem & Backend:</strong> Python 3.10 com FastAPI e Uvicorn.
              </li>
              <li>
                <strong className="text-white/80">Motor TTS:</strong> Piper TTS local com modelo ONNX em CPU.
              </li>
              <li>
                <strong className="text-white/80">Vantagens:</strong> Funciona 100% desconectado da internet.
              </li>
              <li>
                <strong className="text-white/80">Desvantagens no Container:</strong> Modelos locais de alta qualidade em pt-BR exigem download pesado de pesos (~100-300MB), usam 100% dos núcleos de CPU e possuem entonação mais robótica se comparados a modelos de fundação neurais.
              </li>
            </ul>
          </div>
        </div>

        {/* Matrix comparison */}
        <div className="pt-4 border-t border-white/10">
          <h4 className="text-[10px] uppercase font-mono tracking-[0.2em] text-white/40 mb-3 font-bold">
            Matriz Técnica de Motores TTS
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-white/10 text-[10px] text-white/40">
                  <th className="pb-2">Motor TTS</th>
                  <th className="pb-2">Execução</th>
                  <th className="pb-2">Exige GPU?</th>
                  <th className="pb-2">Qualidade pt-BR</th>
                  <th className="pb-2">Formatos</th>
                  <th className="pb-2">Compatibilidade no Container</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                <tr className="bg-[#FF4E00]/10">
                  <td className="py-2.5 font-bold text-[#FF4E00]">Gemini Flash TTS (Recomendado)</td>
                  <td className="py-2.5">Cloud Neural</td>
                  <td className="py-2.5 text-[#00FF66]">Não (Zero GPU)</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">Excelente (Prosódia natural)</td>
                  <td className="py-2.5">PCM / MP3 / WAV / OGG</td>
                  <td className="py-2.5 text-[#00FF66] font-bold">Perfeita (SDK e chave ativos)</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-white/70">Piper TTS</td>
                  <td className="py-2.5">Local (ONNX)</td>
                  <td className="py-2.5 text-amber-400">Não (CPU alta)</td>
                  <td className="py-2.5 text-amber-400">Boa (Levemente robótica)</td>
                  <td className="py-2.5">WAV</td>
                  <td className="py-2.5 text-white/50">Possível com setup de binários</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-white/70">Coqui TTS / XTTS</td>
                  <td className="py-2.5">Local (PyTorch)</td>
                  <td className="py-2.5 text-rose-400">Sim (Lento em CPU)</td>
                  <td className="py-2.5 text-[#00FF66]">Excelente</td>
                  <td className="py-2.5">WAV</td>
                  <td className="py-2.5 text-rose-400">Inviável sem GPU (timeout)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
