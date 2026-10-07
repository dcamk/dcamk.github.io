// Shim de demonstração do Lumo.
// Carregado ANTES do app real (build de lumo-src/src). Faz o papel do backend Tauri/Rust:
// responde aos comandos com dados falsos mas plausíveis (sistema, e-mails, tarefas, MPRIS),
// conversa roteirizada no tom da paleta, terminal falso e eventos de arrastar arquivo.
// Nenhuma chamada sai do navegador e nada pede chave de API.
(() => {
  'use strict';

  const parentWin = window.parent !== window ? window.parent : null;
  const post = (msg) => parentWin?.postMessage({ source: 'lumo-demo', ...msg }, '*');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

  // ---- Configuração inicial da demo ---------------------------------------------------------
  // A paleta pode chegar pela URL (?palette=…&look=…) — o site abre a prévia já na paleta dele.
  const params = new URLSearchParams(location.search);
  const PALETTES = ['grafite', 'safira', 'indigo', 'ambar', 'noir', 'matrix'];
  try {
    const raw = JSON.parse(localStorage.getItem('lumo.settings') || '{}');
    const p = params.get('palette');
    const l = params.get('look');
    if (PALETTES.includes(p)) raw.palette = p;
    else if (!PALETTES.includes(raw.palette)) raw.palette = 'safira';
    if (l === 'classico' || l === 'realista') raw.look = l;
    if (raw.muted === undefined) raw.muted = params.get('sound') !== '1';
    raw.audioOutput = 'webkit';
    raw.cursorMode = 'screen';
    localStorage.setItem('lumo.settings', JSON.stringify(raw));
    if (!localStorage.getItem('lumo.tasks')) {
      const now = Date.now();
      localStorage.setItem(
        'lumo.tasks',
        JSON.stringify([
          { id: 't1', text: 'Revisar a proposta do cliente', completed: false, remindAt: now + 42 * 60_000 },
          { id: 't2', text: 'Beber água', completed: false, remindAt: now + 18 * 60_000 },
          { id: 't3', text: 'Atualizar o sistema', completed: true },
          { id: 't4', text: 'Reunião de equipe às 15:30', completed: false },
        ])
      );
    }
  } catch {
    /* sem localStorage: segue com os padrões do app */
  }

  const currentPalette = () => {
    try {
      const p = JSON.parse(localStorage.getItem('lumo.settings') || '{}').palette;
      return PALETTES.includes(p) ? p : 'safira';
    } catch {
      return 'safira';
    }
  };

  // ---- IPC do Tauri 2 (mesmo contrato de @tauri-apps/api/mocks) -------------------------------
  const callbacks = new Map();
  let nextCb = 1;
  const transformCallback = (cb, once = false) => {
    const id = nextCb++;
    callbacks.set(id, (data) => {
      if (once) callbacks.delete(id);
      return cb && cb(data);
    });
    return id;
  };
  const unregisterCallback = (id) => callbacks.delete(id);
  const runCallback = (id, data) => callbacks.get(id)?.(data);

  // Channel (Rust → JS): mensagens numeradas
  const chanIndex = new WeakMap();
  const send = (channel, message) => {
    if (!channel || typeof channel.id !== 'number') return;
    const i = chanIndex.get(channel) ?? 0;
    chanIndex.set(channel, i + 1);
    runCallback(channel.id, { index: i, message });
  };

  // Eventos (plugin:event)
  const listeners = new Map(); // nome → Map(eventId → callbackId)
  let nextEvent = 1;
  const emit = (event, payload) => {
    const map = listeners.get(event);
    if (!map) return;
    for (const [id, cb] of map) runCallback(cb, { event, id, payload });
  };

  // ---- Dados falsos --------------------------------------------------------------------------
  const GB = 1024 ** 3;
  const bootAt = Date.now() - (3 * 3600 + 27 * 60) * 1000;
  let cpuPhase = 0;
  const systemStats = () => {
    cpuPhase += 0.6;
    const cpu = 14 + Math.sin(cpuPhase) * 7 + Math.sin(cpuPhase * 2.7) * 4 + Math.random() * 3;
    const mem = 6.4 + Math.sin(cpuPhase * 0.35) * 0.25;
    return {
      cpu: Math.max(2, cpu),
      mem_used: mem * GB,
      mem_total: 15.5 * GB,
      disk_used: 212.4 * GB,
      disk_total: 476.9 * GB,
      temp: 51 + Math.sin(cpuPhase * 0.5) * 3,
      battery: 78,
      charging: false,
      net_down: (180 + Math.random() * 320) * 1024,
      net_up: (12 + Math.random() * 30) * 1024,
      uptime: Math.round((Date.now() - bootAt) / 1000),
      load: 0.9 + Math.random() * 0.4,
      cores: 8,
      top: [
        { name: 'firefox', cpu: 6.2, mem: 9.8 },
        { name: 'code', cpu: 3.1, mem: 7.4 },
        { name: 'gnome-shell', cpu: 2.4, mem: 3.1 },
      ],
    };
  };

  const media = { player: 'Spotify', playing: true, title: 'Weightless', artist: 'Marconi Union' };
  const TRACKS = [
    ['Weightless', 'Marconi Union'],
    ['Avril 14th', 'Aphex Twin'],
    ['An Ending (Ascent)', 'Brian Eno'],
  ];
  let track = 0;

  const minutesAgo = (m) => Date.now() - m * 60_000;
  const inbox = {
    total: 3,
    messages: [
      { id: 'm1', thread_id: 'm1', from: 'Ana Souza', subject: 'Proposta revisada', snippet: 'Segue a versão com os ajustes que conversamos ontem.', date: minutesAgo(6) },
      { id: 'm2', thread_id: 'm2', from: 'GitHub', subject: '[dcamk/lumo] Nova issue: tema claro', snippet: 'Seria possível ter uma paleta clara para o painel?', date: minutesAgo(48) },
      { id: 'm3', thread_id: 'm3', from: 'Carlos Lima', subject: 'Reunião às 15:30', snippet: 'Confirmado. Levo os números do trimestre.', date: minutesAgo(130) },
    ],
  };

  const now = () => Math.floor(Date.now() / 1000);
  const POOL = [
    ['llm7:gpt-4.1-nano', 'llm7', 'LLM7', 'gpt-4.1-nano', false, true, true, 820, 'sem chave'],
    ['groq:llama-3.3-70b-versatile', 'groq', 'Groq', 'llama-3.3-70b-versatile', false, true, true, 310, '30/min'],
    ['gemini:gemini-2.5-flash', 'gemini', 'Gemini', 'gemini-2.5-flash', false, true, true, 640, '10/min'],
    ['cerebras:qwen-3-235b', 'cerebras', 'Cerebras', 'qwen-3-235b', false, true, true, 270, '30/min'],
    ['ollama:qwen2.5:7b', 'ollama', 'Ollama', 'qwen2.5:7b', true, true, true, 1450, 'local'],
  ].map(([key, provider, label, model, local, ok, tools, latency_ms, rate], i) => ({
    key, provider, label, model, local, ok, tools, latency_ms, error: '', checked_at: now() - 90,
    cooldown_secs: 0, capacity: 1, quality: 0.9 - i * 0.08, ctx_k: local ? 32 : 128, rate, score: 0.95 - i * 0.1,
  }));

  const FACTS = [
    { id: 1, text: 'Usa Ubuntu 24.04 com GNOME.', ts: now() - 86400 * 3 },
    { id: 2, text: 'Prefere respostas curtas e diretas.', ts: now() - 86400 * 2 },
    { id: 3, text: 'Trabalha com projetos em ~/Projetos.', ts: now() - 86400 },
  ];
  const SKILLS = [
    { name: 'organizar-downloads', description: 'Separa a pasta Downloads por tipo de arquivo.' },
    { name: 'relatorio-semanal', description: 'Monta um resumo da semana a partir das tarefas.' },
  ];
  const PLUGINS = [
    {
      name: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '~'],
      enabled: true, trusted: false, running: true, tools: ['read_file', 'list_directory', 'search_files'], error: '',
    },
  ];

  const kindOf = (name) => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
      txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
      mp3: 'audio/mpeg', mp4: 'video/mp4', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', odt: 'application/vnd.oasis.opendocument.text',
    };
    return map[ext] || 'application/octet-stream';
  };
  // Tamanho informado pela página (arquivo real arrastado pelo visitante); só o número é usado
  const knownSizes = new Map();

  // ---- Conversa roteirizada no tom da paleta --------------------------------------------------
  const TONE = {
    grafite: {
      hello: 'Bom dia. Posso cuidar de tarefas, lembretes, comandos no terminal e arquivos. Diga o que precisa.',
      vlcAsk: 'Certo. Vou instalar o VLC pelo apt. Preciso da sua aprovação para executar o comando abaixo.',
      vlcDone: 'VLC instalado com sucesso. Ele já está no menu de aplicativos.',
      diskAsk: 'Vou verificar o espaço da partição principal.',
      diskDone: 'Há 264 GB livres em / (45% em uso). Não é necessária nenhuma ação.',
      refused: 'Entendido. Nada foi executado.',
      file: (n) => `Recebi ${n}. Posso resumir o conteúdo, renomear, mover para outra pasta ou enviar ao Drive. Como prefere?`,
      generic: 'Entendido. Na demonstração eu respondo com roteiros prontos; no app instalado, o modelo principal decide e delega aos especialistas quando convém. Experimente: “instale o VLC” ou “quanto espaço tenho livre?”.',
    },
    safira: {
      hello: 'Olá. Posso ajudar com: 1) tarefas e lembretes, 2) comandos no terminal, 3) arquivos e e-mails. Por onde começamos?',
      vlcAsk: 'Plano: 1) instalar o VLC via apt; 2) confirmar a versão. Aprove o comando abaixo para começar.',
      vlcDone: 'Concluído. VLC 3.0.20 instalado (exit 0). Tempo total: 14 s.',
      diskAsk: 'Vou medir o uso de / com df.',
      diskDone: 'Resultado: 264 GB livres de 477 GB (45% em uso). Folga confortável para os próximos meses.',
      refused: 'Comando recusado. Nenhuma alteração foi feita.',
      file: (n) => `Arquivo recebido: ${n}. Opções: 1) resumir, 2) renomear, 3) mover, 4) enviar ao Drive.`,
      generic: 'Entendido. Esta prévia usa respostas roteirizadas; no app, o modelo principal escolhe o provedor mais rápido disponível. Teste: “instale o VLC” ou “quanto espaço tenho livre?”.',
    },
    indigo: {
      hello: 'Boa noite. Estou por aqui, sem pressa. Tarefas, terminal ou arquivos: é só pedir.',
      vlcAsk: 'Claro. Preparei a instalação do VLC com calma; basta aprovar o comando abaixo.',
      vlcDone: 'Pronto. O VLC já está instalado e esperando no menu de aplicativos.',
      diskAsk: 'Vou olhar o espaço do disco com tranquilidade.',
      diskDone: 'Você tem 264 GB livres em /, cerca de 55% do disco. Há bastante espaço.',
      refused: 'Tudo bem. Não executei nada.',
      file: (n) => `Recebi ${n}. Posso resumir, organizar ou enviar ao Drive. O que deseja fazer com ele?`,
      generic: 'Entendo. Nesta prévia eu sigo um roteiro; no app instalado a conversa é com o modelo de verdade. Que tal pedir “instale o VLC”?',
    },
    ambar: {
      hello: 'Oi. Bora trabalhar: tarefas, terminal, arquivos, e-mail. Manda.',
      vlcAsk: 'Bora resolver. Separei o comando para instalar o VLC; aprove e eu cuido do resto.',
      vlcDone: 'Feito. VLC instalado, já dá para abrir pelo menu.',
      diskAsk: 'Deixa eu conferir o disco.',
      diskDone: 'Tem 264 GB livres em /. Espaço de sobra por enquanto.',
      refused: 'Beleza, não rodei nada.',
      file: (n) => `Chegou ${n}. Quer que eu resuma, organize ou mande para o Drive?`,
      generic: 'Anotado. Aqui na prévia as respostas são roteirizadas; no app, quem responde é o modelo de verdade. Tenta “instale o VLC”.',
    },
    noir: {
      hello: 'Pronto.',
      vlcAsk: 'VLC. Aprove.',
      vlcDone: 'Instalado.',
      diskAsk: 'Verificando.',
      diskDone: '264 GB livres. 45% em uso.',
      refused: 'Cancelado.',
      file: (n) => `${n}. Resumir, mover ou Drive?`,
      generic: 'Prévia roteirizada. Peça: “instale o VLC”.',
    },
    matrix: {
      hello: '> ok: sessão aberta. tarefas | terminal | arquivos. aguardando input.',
      vlcAsk: '> ok: pacote vlc localizado no repositório. aguardando aprovação.',
      vlcDone: '> feito. vlc 3.0.20 instalado. exit 0.',
      diskAsk: '> ok: df -h /',
      diskDone: '> 264G livres em /. uso 45%. nada a fazer.',
      refused: '> erro: abortado pelo operador.',
      file: (n) => `> ok: ${n} recebido. opções: resumir | mover | drive.`,
      generic: '> prévia roteirizada. tente: instale o vlc',
    },
  };
  const tone = (persona) => {
    if (persona) {
      if (/hacker|terminal/i.test(persona)) return TONE.matrix;
      if (/seco|minimalista/i.test(persona)) return TONE.noir;
      if (/analista|estruturado/i.test(persona)) return TONE.safira;
      if (/estúdio|sofisticado/i.test(persona)) return TONE.indigo;
      if (/criativo|caloroso/i.test(persona)) return TONE.ambar;
      if (/executivo/i.test(persona)) return TONE.grafite;
    }
    return TONE[currentPalette()] || TONE.safira;
  };

  const pending = new Map(); // id → resolve(aprovado)
  let cancelled = false;

  async function streamText(ch, text) {
    const words = text.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 3) {
      if (cancelled) return;
      send(ch, { type: 'text_delta', text: words.slice(i, i + 3).join('') });
      await wait(45);
    }
    send(ch, { type: 'text', text });
  }

  async function runScriptedCommand(ch, t, command, reason, output, okText) {
    const id = uid();
    send(ch, { type: 'command', id, command, reason, needs_approval: true });
    post({ type: 'event', name: 'command-pending' });
    const approved = await new Promise((resolve) => pending.set(id, resolve));
    if (!approved) {
      send(ch, { type: 'command_done', id, code: null, approved: false });
      await streamText(ch, t.refused);
      return;
    }
    for (const line of output) {
      if (cancelled) break;
      await wait(220 + Math.random() * 200);
      send(ch, { type: 'output', id, line });
    }
    send(ch, { type: 'command_done', id, code: 0, approved: true });
    post({ type: 'event', name: 'command-done' });
    await wait(300);
    await streamText(ch, okText);
  }

  async function brainSend({ req, events: ch }) {
    cancelled = false;
    const t = tone(req?.persona);
    const text = String(req?.text || '');
    await wait(500);
    const files = [...text.matchAll(/^- (\S.*?) \(/gm)].map((m) => m[1]);
    if (files.length) {
      for (const f of files) {
        send(ch, { type: 'read', path: f });
        await wait(350);
      }
      await streamText(ch, t.file(files.map((f) => f.split('/').pop()).join(', ')));
      return;
    }
    if (/vlc|instal/i.test(text)) {
      await streamText(ch, t.vlcAsk);
      await runScriptedCommand(ch, t, 'sudo apt install -y vlc', 'Instalar o VLC pelo gerenciador de pacotes', [
        'Lendo listas de pacotes... Pronto',
        'Construindo árvore de dependências... Pronto',
        'Os NOVOS pacotes a seguir serão instalados:',
        '  vlc vlc-bin vlc-plugin-base vlc-plugin-qt',
        'Obter:1 http://archive.ubuntu.com/ubuntu noble/universe amd64 vlc-bin 3.0.20-3build6 [17,3 kB]',
        'Configurando vlc (3.0.20-3build6) ...',
      ], t.vlcDone);
      return;
    }
    if (/espa[cç]o|disco|livre/i.test(text)) {
      await streamText(ch, t.diskAsk);
      await runScriptedCommand(ch, t, 'df -h /', 'Ver o espaço livre da partição principal', [
        'Sist. Arq.      Tam. Usado Disp. Uso% Montado em',
        '/dev/nvme0n1p2  477G  212G  264G  45% /',
      ], t.diskDone);
      return;
    }
    if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|e ai|hey)\b/i.test(text.trim())) {
      await streamText(ch, t.hello);
      return;
    }
    await streamText(ch, t.generic);
  }

  // Ajuda do terminal (brain_ask): explica o erro e sugere UM comando
  function brainAsk({ prompt }) {
    const cmd = (/Comando: (.*)/.exec(prompt || '') || [])[1] || '';
    const pal = currentPalette();
    const pre = pal === 'matrix' ? '> ' : '';
    if (/^apt(-get)? install/.test(cmd)) {
      return `${pre}O apt precisa de privilégios de administrador para instalar pacotes.\n\`\`\`bash\nsudo ${cmd}\n\`\`\``;
    }
    if (/^docker/.test(cmd)) {
      return `${pre}O Docker não está instalado neste sistema.\n\`\`\`bash\nsudo apt install -y docker.io\n\`\`\``;
    }
    if (/^cd /.test(cmd)) {
      return `${pre}A pasta não existe. Liste as pastas do diretório atual para conferir o nome.\n\`\`\`bash\nls -d */\n\`\`\``;
    }
    if (/^pyhton|^pyton/.test(cmd)) {
      return `${pre}Erro de digitação no nome do programa.\n\`\`\`bash\n${cmd.replace(/^py\w+/, 'python3')}\n\`\`\``;
    }
    const first = cmd.split(' ')[0];
    return `${pre}O comando ${first} não existe neste sistema. Procure o pacote que o fornece.\n\`\`\`bash\napt search ${first}\n\`\`\``;
  }

  // ---- Terminal falso ---------------------------------------------------------------------
  const enc = new TextEncoder();
  const b64 = (s) => {
    const bytes = enc.encode(s);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  const PROMPT = '\x1b[1;38;5;81mvoce@lumo-demo\x1b[0m:\x1b[1;38;5;75m~\x1b[0m$ ';
  const term = { ch: null, line: '', marks: 0, busy: false, history: [] };
  const termOut = (s) => term.ch && send(term.ch, b64(s.replace(/\n/g, '\r\n')));

  const NEOFETCH = [
    '\x1b[38;5;208m            .-/+oossssoo+/-.             \x1b[0m\x1b[1mvoce\x1b[0m@\x1b[1mlumo-demo\x1b[0m',
    '\x1b[38;5;208m        `:+ssssssssssssssssss+:`         \x1b[0m------------------',
    '\x1b[38;5;208m      -+ssssssssssssssssssyyssss+-       \x1b[0m\x1b[1mOS:\x1b[0m Ubuntu 24.04.1 LTS x86_64',
    '\x1b[38;5;208m    .ossssssssssssssssss\x1b[0mdMMMNy\x1b[38;5;208msssso.     \x1b[0m\x1b[1mKernel:\x1b[0m 6.8.0-45-generic',
    '\x1b[38;5;208m   /sssssssssss\x1b[0mhdmmNNmmyNMMMMh\x1b[38;5;208mssssss/    \x1b[0m\x1b[1mUptime:\x1b[0m 3 hours, 27 mins',
    '\x1b[38;5;208m  +sssssssss\x1b[0mhmydMMMMMMMNddddy\x1b[38;5;208mssssssss+   \x1b[0m\x1b[1mShell:\x1b[0m bash 5.2.21',
    '\x1b[38;5;208m /ssssssss\x1b[0mhNMMMyhhyyyyhmNMMMNh\x1b[38;5;208mssssssss/  \x1b[0m\x1b[1mDE:\x1b[0m GNOME 46.0',
    '\x1b[38;5;208m.ssssssss\x1b[0mdMMMNh\x1b[38;5;208mssssssssss\x1b[0mhNMMMd\x1b[38;5;208mssssssss.  \x1b[0m\x1b[1mCPU:\x1b[0m AMD Ryzen 7 5700U (16) @ 4.3GHz',
    '\x1b[38;5;208m+sss\x1b[0mhhhyNMMNy\x1b[38;5;208mssssssssssss\x1b[0myNMMMy\x1b[38;5;208msssssss+  \x1b[0m\x1b[1mMemory:\x1b[0m 6.4GiB / 15.5GiB',
    '',
  ].join('\n');

  const FS = ['Documentos', 'Downloads', 'Imagens', 'Música', 'Projetos', 'Vídeos', 'notas.md'];

  function execLine(raw) {
    const cmd = raw.trim();
    let out = '';
    let code = 0;
    const [name, ...args] = cmd.split(/\s+/);
    switch (name) {
      case '':
        break;
      case 'ls':
        out = FS.map((f) => (f.includes('.') ? f : `\x1b[1;34m${f}\x1b[0m`)).join('  ') + '\n';
        break;
      case 'pwd':
        out = '/home/voce\n';
        break;
      case 'whoami':
        out = 'voce\n';
        break;
      case 'date':
        out = new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'medium' }) + '\n';
        break;
      case 'uname':
        out = args.includes('-a')
          ? 'Linux lumo-demo 6.8.0-45-generic #45-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 x86_64 GNU/Linux\n'
          : 'Linux\n';
        break;
      case 'neofetch':
      case 'fastfetch':
        out = NEOFETCH + '\n';
        break;
      case 'echo':
        out = args.join(' ').replace(/^["']|["']$/g, '') + '\n';
        break;
      case 'cat':
        if (args[0] === 'notas.md') out = '# Notas\n- Testar o Lumo no Matrix\n- Pedir para a IA organizar Downloads\n';
        else {
          out = `cat: ${args[0] || ''}: Arquivo ou diretório inexistente\n`;
          code = 1;
        }
        break;
      case 'clear':
        out = '\x1b[2J\x1b[H';
        break;
      case 'help':
        out = 'Comandos desta demonstração: ls, pwd, whoami, date, uname -a, neofetch, cat notas.md, clear.\nExperimente um que falha, como "apt install htop" ou "docker ps", para ver a IA explicando o erro.\n';
        break;
      case 'sudo':
        if (args[0] === 'apt' || args[0] === 'apt-get') {
          out = '[sudo] senha para voce: \nLendo listas de pacotes... Pronto\nConstruindo árvore de dependências... Pronto\nConfigurando ' + (args[args.length - 1] || 'pacote') + ' ... Pronto\n';
        } else out = '(demonstração: sudo simulado)\n';
        break;
      case 'apt':
      case 'apt-get':
        if (args[0] === 'install') {
          out = 'E: Não foi possível abrir o arquivo de trava /var/lib/dpkg/lock-frontend - open (13: Permissão negada)\nE: Não foi possível obter trava do frontend dpkg; você é root?\n';
          code = 100;
        } else if (args[0] === 'search') {
          out = `Ordenando... Pronto\nPesquisa de Texto Completo... Pronto\n${args[1] || ''}/noble 1.0 amd64\n`;
        } else out = 'apt 2.7.14 (amd64)\n';
        break;
      case 'cd':
        if (FS.includes(args[0]) || !args[0] || args[0] === '~') break;
        out = `bash: cd: ${args[0]}: Arquivo ou diretório inexistente\n`;
        code = 1;
        break;
      case 'exit':
        out = '';
        break;
      default:
        out = `${name}: comando não encontrado\n`;
        code = 127;
    }
    return { out, code };
  }

  function termRun(line) {
    const { out, code } = execLine(line);
    termOut('\n' + out);
    // marcador OSC 777 igual ao do backend: código, contador, comando em base64
    const mark = `\x1b]777;lumo;${code};${++term.marks};${b64(line.trim())}\x07`;
    term.ch && send(term.ch, b64(mark + PROMPT));
    if (line.trim()) post({ type: 'event', name: code === 0 ? 'term-ok' : 'term-fail' });
  }

  function termWrite(data) {
    for (const c of data) {
      if (c === '\r') {
        const line = term.line;
        term.line = '';
        termRun(line);
      } else if (c === '\x7f' || c === '\b') {
        if (term.line) {
          term.line = term.line.slice(0, -1);
          termOut('\b \b');
        }
      } else if (c === '\x03') {
        term.line = '';
        termOut('^C\n');
        send(term.ch, b64(`\x1b]777;lumo;130;${++term.marks};\x07${PROMPT}`));
      } else if (c === '\x1b') {
        return; // setas e afins: ignorados na demo
      } else if (c >= ' ') {
        term.line += c;
        termOut(c);
      }
    }
  }

  // Digita como uma pessoa (tour / botões do site)
  async function typeInTerm(text) {
    for (const c of text) {
      termWrite(c);
      await wait(c === '\r' ? 120 : 55 + Math.random() * 40);
    }
  }

  // ---- Comandos --------------------------------------------------------------------------
  const settingsOf = () => JSON.parse(localStorage.getItem('lumo.settings') || '{}');
  let googleConnected = true;
  const googleStatus = () => ({ configured: true, source: 'build', connected: googleConnected, email: googleConnected ? 'voce@gmail.com' : null });
  let autostart = true;
  let shortcutOn = true;
  let lastCursor = null;

  const handlers = {
    'plugin:event|listen': ({ event, handler }) => {
      const id = nextEvent++;
      if (!listeners.has(event)) listeners.set(event, new Map());
      listeners.get(event).set(id, handler);
      if (event === 'lumo://action' && early.length) setTimeout(() => early.splice(0).forEach((a) => emit(event, a)), 50);
      return id;
    },
    'plugin:event|unlisten': ({ event, eventId }) => {
      listeners.get(event)?.delete(eventId);
      return null;
    },
    'plugin:event|emit': ({ event, payload }) => (emit(event, payload), null),

    // janela
    set_window_shape: () => null,
    set_overlay_size: () => null,
    set_always_on_top: () => null,
    begin_user_move: () => null,
    reset_window_position: () => null,
    has_saved_position: () => false,
    get_cursor_in_window: () => lastCursor ?? [innerWidth / 2, 40],

    // som: devolve false → o app usa o Web Audio do navegador
    play_sound: () => false,
    audio_backend: () => 'webkit',
    notify: () => null,
    frontend_log: () => null,
    open_url: ({ url }) => {
      if (/^https:\/\/(github\.com|console\.cloud\.google\.com|aistudio\.google\.com|console\.groq\.com|openrouter\.ai|cloud\.cerebras\.ai)/.test(url)) {
        window.open(url, '_blank', 'noopener');
      }
      return true;
    },

    // sistema
    system_stats: systemStats,
    system_info: () => ({ distro: 'Ubuntu 24.04.1 LTS', kernel: '6.8.0-45-generic', desktop: 'GNOME 46', session: 'x11' }),
    media_status: () => ({ ...media }),
    media_control: ({ action }) => {
      if (action === 'PlayPause') media.playing = !media.playing;
      else {
        track = (track + (action === 'Next' ? 1 : TRACKS.length - 1)) % TRACKS.length;
        [media.title, media.artist] = TRACKS[track];
        media.playing = true;
      }
      return null;
    },
    run_command: async ({ command, mode }) => {
      await wait(400);
      if (mode !== 'output') return '';
      if (/hostname -I/.test(command)) return 'Local: 192.168.0.42\nPúblico: (oculto na demonstração)';
      if (/^df/.test(command)) return 'Montado em  Tam. Usado Disp. Uso%\n/           477G  212G  264G  45%\n/boot/efi   1,1G  6,2M  1,1G   1%';
      if (/^ss /.test(command)) return 'State  Recv-Q Send-Q Local Address:Port\nLISTEN 0      4096   127.0.0.53%lo:53\nLISTEN 0      128          0.0.0.0:22\nLISTEN 0      4096       127.0.0.1:11434';
      return '(demonstração: comando simulado)';
    },
    set_focus_dnd: ({ enable }) => ({ status: enable ? 'enabled' : 'disabled', message: enable ? 'Não Perturbe ligado.' : 'Não Perturbe desligado.' }),
    get_autostart: () => autostart,
    set_autostart: ({ enabled }) => (autostart = !!enabled),
    shortcut_status: () => ({ gnome: true, installed: shortcutOn, binding: '<Control><Alt>l' }),
    set_shortcut: ({ enabled }) => ((shortcutOn = !!enabled), { gnome: true, installed: shortcutOn, binding: '<Control><Alt>l' }),
    cursor_extension_status: () => ({ session: 'gnome-x11', installed: false, enabled: false, active: false }),
    install_cursor_extension: () => 'Na demonstração nada é instalado. No app, a extensão vai para ~/.local/share/gnome-shell/extensions.',
    inspect_paths: ({ paths }) =>
      paths.map((p) => {
        const name = p.split('/').pop() || p;
        return { path: p, name, size: knownSizes.get(name) ?? 248_000, kind: kindOf(name), is_dir: false };
      }),

    // Google
    google_status: googleStatus,
    google_connect: async () => (await wait(600), (googleConnected = true), googleStatus()),
    google_disconnect: () => ((googleConnected = false), googleStatus()),
    google_set_client: () => googleStatus(),
    gmail_unread: async () => (await wait(250), googleConnected ? JSON.parse(JSON.stringify(inbox)) : { total: 0, messages: [] }),
    drive_upload: async ({ name }) => (await wait(900), `https://drive.google.com/ (demonstração: ${name} não foi enviado)`),

    // cérebro
    brain_configure: () => null,
    brain_warm: () => null,
    brain_reset: () => null,
    brain_send: brainSend,
    brain_ask: async (a) => (await wait(900), brainAsk(a)),
    agent_approve: ({ id, approved }) => {
      pending.get(id)?.(!!approved);
      pending.delete(id);
      return null;
    },
    agent_cancel: () => {
      cancelled = true;
      for (const [id, r] of pending) (r(false), pending.delete(id));
      return null;
    },
    pool_status: () => POOL,
    pool_test: async () => (await wait(1200), POOL.map((s) => ({ ...s, checked_at: now(), latency_ms: Math.round(s.latency_ms * (0.85 + Math.random() * 0.3)) }))),
    memory_list: () => FACTS,
    skill_list: () => SKILLS,
    plugin_list: () => PLUGINS,
    list_models: () => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-qwq-32b', 'gemma2-9b-it'],
    dispatch_ai_stream: async ({ onChunk }) => {
      const t = tone();
      for (const w of t.generic.split(/(\s+)/)) {
        send(onChunk, w);
        await wait(30);
      }
      return null;
    },

    // terminal
    term_open: ({ onData }) => {
      term.ch = onData;
      const hello =
        `\x1b[2mTerminal de demonstração do Lumo: nada roda na sua máquina.\x1b[0m\r\n` +
        `\x1b[2mExperimente: ls, neofetch, uname -a ou um comando que falha, como apt install htop.\x1b[0m\r\n\r\n`;
      return b64(hello + PROMPT);
    },
    term_write: ({ data }) => (termWrite(data), null),
    term_resize: () => null,
  };

  async function invoke(cmd, args = {}) {
    const h = handlers[cmd];
    if (!h) return null; // comando sem efeito visível na demonstração
    return h(args || {});
  }

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback,
    unregisterCallback,
    runCallback,
    callbacks,
    convertFileSrc: (p) => p,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (event, id) => listeners.get(event)?.delete(id),
  };

  // O app no navegador também chama /api/ai/chat (fora do Tauri): responde aqui, sem rede
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.includes('/api/ai/')) {
      await wait(600);
      return new Response(JSON.stringify({ reply: tone().generic }), { headers: { 'Content-Type': 'application/json' } });
    }
    return realFetch(input, init);
  };

  // ---- Ponte com o site (postMessage) ---------------------------------------------------------
  // ações que chegam antes de o app escutar lumo://action ficam na fila
  const early = [];
  const action = (a) => {
    if (listeners.get('lumo://action')?.size) emit('lumo://action', a);
    else early.push(a);
  };
  let dragPos = { x: innerWidth / 2, y: 60 };
  const dpr = () => window.devicePixelRatio || 1;
  const phys = (p) => ({ x: p.x * dpr(), y: p.y * dpr() });

  async function dropSequence(name, size) {
    if (size) knownSizes.set(name, size);
    const path = `/home/voce/Downloads/${name}`;
    const start = { x: innerWidth * 0.82, y: 150 };
    emit('tauri://drag-enter', { paths: [path], position: phys(start) });
    // o arquivo "passeia" até o Lumo: ele abre a boca e persegue
    for (let i = 0; i <= 24; i++) {
      const k = i / 24;
      const p = { x: start.x + (innerWidth / 2 - start.x) * k, y: start.y - 70 * Math.sin(k * Math.PI) + (40 - start.y) * k * 0.3 };
      emit('tauri://drag-over', { position: phys(p) });
      await wait(45);
    }
    await wait(250);
    emit('tauri://drag-drop', { paths: [path], position: phys({ x: innerWidth / 2, y: 60 }) });
  }

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.target !== 'lumo-demo') return;
    switch (m.type) {
      case 'action':
        action(m.action);
        break;
      case 'palette':
        action(`palette:${m.id}`);
        break;
      case 'look':
        action(`look:${m.look}`);
        break;
      case 'mode':
        if (m.mode === 'quick') action(m.tab ? `tab:${m.tab}` : 'tab:tasks');
        else if (m.mode === 'compact') action('compact');
        else if (m.mode === 'drop') void dropSequence(m.name || 'relatorio-trimestral.pdf', m.size);
        break;
      case 'tab':
        action(`tab:${m.tab}`);
        break;
      case 'ask':
        action(`ask:${m.text}`);
        break;
      case 'email':
        window.lumoDebug?.fakeEmail?.(m.from, m.subject);
        break;
      case 'type':
        void typeInTerm(m.text);
        break;
      case 'mute':
        action('mute');
        break;
      case 'cursor':
        // ponteiro sobre a página do site, já em coordenadas desta janela
        // (ignorado logo depois de um movimento real aqui dentro)
        if (performance.now() - lastLocal > 400) lastCursor = [m.x, m.y];
        break;
      case 'drag': {
        // arquivo real do visitante passando sobre a área de trabalho de mentira
        const p = { x: m.x, y: m.y };
        dragPos = p;
        if (m.phase === 'enter') emit('tauri://drag-enter', { paths: [], position: phys(p) });
        else if (m.phase === 'over') emit('tauri://drag-over', { position: phys(p) });
        else if (m.phase === 'leave') emit('tauri://drag-leave', {});
        else if (m.phase === 'drop') {
          if (m.size) knownSizes.set(m.name, m.size);
          emit('tauri://drag-drop', { paths: [`/home/voce/Downloads/${m.name}`], position: phys(p) });
        }
        break;
      }
    }
  });

  // O app compara o cursor "global" (lido a cada 50 ms) com o mousemove real. Quando o mouse
  // entra aqui vindo de longe, a última leitura ainda é a posição de fora e o app acharia que o
  // cursor global está quebrado. Então o primeiro movimento depois de um tempo fora é reemitido
  // 70 ms depois, quando a próxima leitura já devolve a posição daqui de dentro.
  let lastLocal = 0;
  window.addEventListener(
    'mousemove',
    (e) => {
      const now = performance.now();
      const fresh = now - lastLocal > 300;
      lastCursor = [e.clientX, e.clientY];
      lastLocal = now;
      if (fresh && e.isTrusted) {
        e.stopImmediatePropagation();
        const copy = new MouseEvent('mousemove', e);
        setTimeout(() => (e.target || window).dispatchEvent(copy), 70);
      }
    },
    { capture: true }
  );

  // Arrastar um arquivo real direto sobre a prévia: só o NOME é usado; nada é lido nem enviado
  let dragDepth = 0;
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (dragDepth++ === 0) emit('tauri://drag-enter', { paths: [], position: phys({ x: e.clientX, y: e.clientY }) });
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragPos = { x: e.clientX, y: e.clientY };
    emit('tauri://drag-over', { position: phys(dragPos) });
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    if (--dragDepth <= 0) {
      dragDepth = 0;
      emit('tauri://drag-leave', {});
    }
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    const f = e.dataTransfer.files[0];
    const name = f?.name || 'arquivo';
    if (f) knownSizes.set(name, f.size);
    emit('tauri://drag-drop', { paths: [`/home/voce/Downloads/${name}`], position: phys({ x: e.clientX, y: e.clientY }) });
  });

  // Estado do app → site (chamado pelo gancho injetado no build da demo)
  window.__lumoDemo = {
    state: (s) => post({ type: 'state', ...s }),
  };
  post({ type: 'boot' });
})();
