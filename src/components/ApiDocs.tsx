import { useState } from 'react';
import { Copy, Check, Terminal, Code2, Server, FileAudio, Layers, Tag, ShieldCheck, Key } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ApiDocsProps {
  currentText: string;
  currentBaseName?: string;
  currentVoice: string;
  currentLanguage: string;
  currentSpeed: number;
  currentFormat: string;
}

export function ApiDocs({ currentText, currentBaseName = 'audio_capitulo', currentVoice, currentLanguage, currentSpeed, currentFormat }: ApiDocsProps) {
  const { profile } = useAuth();
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedFetch, setCopiedFetch] = useState(false);
  const [copiedPython, setCopiedPython] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState<'curl' | 'js' | 'python'>('curl');

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const endpointUrl = `${originUrl}/synthesize`;
  const userApiKey = profile?.apiKey || 'SEU_BEARER_TOKEN_OU_API_KEY';

  const requestJson = JSON.stringify(
    {
      text: currentText || 'Primeiro parágrafo do audiolivro...\n\nSegundo parágrafo subsequente...',
      base_name: currentBaseName || 'audiolivro_capitulo_01',
      voice: currentVoice,
      language: currentLanguage,
      speed: currentSpeed,
      format: currentFormat,
      split_paragraphs: true,
      max_chunk_size: 4000,
    },
    null,
    2
  );

  const curlCommand = `curl -X POST "${endpointUrl}" \\
  -H "Authorization: Bearer ${userApiKey}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '${JSON.stringify({
    text: currentText || 'Primeiro parágrafo do texto...\n\nSegundo parágrafo do texto...',
    base_name: currentBaseName || 'audiolivro_capitulo_01',
    voice: currentVoice,
    language: currentLanguage,
    speed: currentSpeed,
    format: currentFormat,
    split_paragraphs: true,
  })}'`;

  const jsSnippet = `// Exemplo em JavaScript / Node.js com Autenticação
const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${userApiKey}",
    "Content-Type": "application/json",
    "Accept": "application/json"
  },
  body: JSON.stringify(${requestJson})
});

if (!response.ok) {
  const errorData = await response.json();
  console.error("Erro na síntese:", errorData);
} else {
  const data = await response.json();
  console.log(\`Gerados \${data.totalChunks} arquivos com nome base: \${data.sanitizedBaseName}\`);
  
  // Itera sobre cada arquivo subsequente gerado: [nome_base]-[counter].[ext]
  data.chunks.forEach((chunk) => {
    console.log(\`-> Arquivo: \${chunk.filename} (\${chunk.durationEstimatedSec}s, \${chunk.characterCount} chars)\`);
    // chunk.audioBase64 ou chunk.dataUrl
  });
}`;

  const pythonSnippet = `# Exemplo em Python (requests) com Bearer Token / API Key
import requests
import base64

url = "${endpointUrl}"
headers = {
    "Authorization": "Bearer ${userApiKey}",
    "Accept": "application/json"
}

payload = ${JSON.stringify(
    {
      text: currentText || 'Primeiro parágrafo...\n\nSegundo parágrafo subsequente...',
      base_name: currentBaseName || 'audiolivro_capitulo_01',
      voice: currentVoice,
      language: currentLanguage,
      speed: currentSpeed,
      format: currentFormat,
      split_paragraphs: true,
    },
    null,
    4
  ).replace(/: true/g, ': True').replace(/: false/g, ': False')}

response = requests.post(url, json=payload, headers=headers)

if response.status_code == 200:
    result = response.json()
    print(f"Total de trechos gerados: {result['totalChunks']}")
    
    for chunk in result['chunks']:
        filename = chunk['filename']  # Ex: audiolivro_capitulo_01-01.mp3
        audio_bytes = base64.b64decode(chunk['audioBase64'])
        with open(filename, "wb") as f:
            f.write(audio_bytes)
        print(f"Salvo com sucesso: {filename}")
else:
    print(f"Erro {response.status_code}:", response.json())`;


  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Endpoint Header Card */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-[#FF4E00] text-black font-mono text-xs font-bold rounded-lg shadow-[0_0_12px_rgba(255,78,0,0.4)]">
              POST
            </span>
            <span className="font-mono text-base font-bold text-white">
              /synthesize
            </span>
            <span className="text-xs text-white/40 font-mono hidden sm:inline">
              (ou /api/synthesize)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white/50">
            <Server className="w-3.5 h-3.5 text-[#FF4E00]" />
            <span>Suporte a Fatiamento de Parágrafos & Nomes Incrementais</span>
          </div>
        </div>

        <p className="text-sm text-white/70 leading-relaxed mb-4">
          Recebe um payload JSON com o texto, nome base (<code className="text-[#FF4E00] font-mono">base_name</code>) e parâmetros de voz. Quando o texto contém múltiplos parágrafos ou ultrapassa o tamanho limite, a API fatia no final do último parágrafo e gera os arquivos subsequentes no padrão <code className="text-[#FF4E00] font-mono">[nome_base]-[counter].[ext]</code> sanitizados em <code className="text-[#00FF66] font-mono">snake_case</code> minúsculo.
        </p>

        {/* Code Snippets switcher */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveSnippet('curl')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                  activeSnippet === 'curl' ? 'bg-[#FF4E00] text-black font-bold shadow-[0_0_12px_rgba(255,78,0,0.3)]' : 'text-white/50 hover:text-white'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>cURL</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSnippet('js')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                  activeSnippet === 'js' ? 'bg-[#FF4E00] text-black font-bold shadow-[0_0_12px_rgba(255,78,0,0.3)]' : 'text-white/50 hover:text-white'
                }`}
              >
                <Code2 className="w-3 h-3" />
                <span>JavaScript / Fetch</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSnippet('python')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                  activeSnippet === 'python' ? 'bg-[#FF4E00] text-black font-bold shadow-[0_0_12px_rgba(255,78,0,0.3)]' : 'text-white/50 hover:text-white'
                }`}
              >
                <FileAudio className="w-3 h-3" />
                <span>Python</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (activeSnippet === 'curl') copyToClipboard(curlCommand, setCopiedCurl);
                if (activeSnippet === 'js') copyToClipboard(jsSnippet, setCopiedFetch);
                if (activeSnippet === 'python') copyToClipboard(pythonSnippet, setCopiedPython);
              }}
              className="flex items-center gap-1.5 text-xs font-mono text-white/60 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
            >
              {copiedCurl || copiedFetch || copiedPython ? (
                <Check className="w-3.5 h-3.5 text-[#00FF66]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>COPIAR SNIPPET</span>
            </button>
          </div>

          <div className="bg-black/90 rounded-2xl p-4 font-mono text-xs text-white/90 overflow-x-auto border border-white/10 shadow-inner">
            {activeSnippet === 'curl' && <pre className="whitespace-pre-wrap leading-relaxed text-emerald-300">{curlCommand}</pre>}
            {activeSnippet === 'js' && <pre className="whitespace-pre-wrap leading-relaxed text-amber-200">{jsSnippet}</pre>}
            {activeSnippet === 'python' && <pre className="whitespace-pre-wrap leading-relaxed text-sky-200">{pythonSnippet}</pre>}
          </div>
        </div>
      </div>

      {/* Parameters Table Card */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl">
        <h3 className="text-xs uppercase font-mono tracking-[0.2em] text-white/40 mb-4 font-bold">
          Especificação dos Parâmetros (JSON Schema)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono tracking-[0.15em] uppercase text-white/40">
                <th className="pb-3 font-semibold">Campo</th>
                <th className="pb-3 font-semibold">Tipo</th>
                <th className="pb-3 font-semibold">Obrigatório</th>
                <th className="pb-3 font-semibold">Padrão</th>
                <th className="pb-3 font-semibold">Descrição & Validação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/80 font-mono text-xs">
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">text</td>
                <td className="py-3 text-amber-400">string</td>
                <td className="py-3 text-rose-400 font-bold">Sim</td>
                <td className="py-3 text-white/30">-</td>
                <td className="py-3 font-sans text-white/70">Texto a ser sintetizado (até 100.000 caracteres quando fatiado por parágrafos).</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">base_name</td>
                <td className="py-3 text-amber-400">string</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">"audio"</td>
                <td className="py-3 font-sans text-white/70">
                  Nome base para os arquivos gerados. Sanitizado automaticamente para <code className="text-white">lowercase_snake_case</code> e sufixado com <code className="text-white">-01.[ext]</code>, <code className="text-white">-02.[ext]</code>.
                </td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">voice</td>
                <td className="py-3 text-amber-400">string</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">"Kore"</td>
                <td className="py-3 font-sans text-white/70">
                  Nome da voz neural: <code className="text-white">Kore</code>, <code className="text-white">Puck</code>, <code className="text-white">Fenrir</code>, <code className="text-white">Charon</code>, <code className="text-white">Zephyr</code> (ou aliases <code className="text-white">"feminina"</code> / <code className="text-white">"masculina"</code>).
                </td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">language</td>
                <td className="py-3 text-amber-400">string</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">"pt-BR"</td>
                <td className="py-3 font-sans text-white/70">
                  Código de idioma BCP-47 (<code className="text-white">pt-BR</code>, <code className="text-white">en-US</code>, <code className="text-white">es-ES</code>, <code className="text-white">fr-FR</code>, etc.).
                </td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">speed</td>
                <td className="py-3 text-amber-400">number</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">1.0</td>
                <td className="py-3 font-sans text-white/70">Multiplicador de velocidade de reprodução (<code className="text-white">0.5</code> a <code className="text-white">2.0</code>).</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">format</td>
                <td className="py-3 text-amber-400">string</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">"mp3"</td>
                <td className="py-3 font-sans text-white/70">Formato binário de codificação do arquivo: <code className="text-white">"mp3"</code>, <code className="text-white">"wav"</code> ou <code className="text-white">"ogg"</code>.</td>
              </tr>
              <tr>
                <td className="py-3 font-bold text-[#FF4E00]">split_paragraphs</td>
                <td className="py-3 text-amber-400">boolean</td>
                <td className="py-3 text-white/40">Não</td>
                <td className="py-3 text-[#00FF66]">true</td>
                <td className="py-3 font-sans text-white/70">Habilita divisão inteligente ao final do último parágrafo de cada trecho.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
