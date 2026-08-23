#!/usr/bin/env node
// Preflight de PR — roda, ANTES de abrir o PR, tudo que hoje só falha DEPOIS.
//
// POR QUE ELE EXISTE
//
// Os guards de `pr-guards.yml` leem duas coisas que não existem enquanto o PR
// não foi aberto: o **corpo do PR** e o **diff contra a base**. Então a ordem
// natural do trabalho é a pior possível — escreve-se o corpo, abre-se o PR, e
// só aí o CI diz que ele estava errado. Cada erro custa um ciclo completo de
// `update_pull_request` + re-run, e o PR fica vermelho no meio, o que é
// indistinguível de "o código quebrou".
//
// Aconteceu no PR 501 (2026-08-23): o corpo citava `#440 → #450` em prosa, sem
// linha `Sem-fechamento:`. Nove jobs verdes, um vermelho, e a leitura de quem
// olha de fora foi "os PRs estão falhando no CI". Era uma linha de texto.
//
// O QUE ELE FAZ
//
// Reproduz localmente os guards que dependem de corpo/diff, contra um rascunho
// do corpo em arquivo, e mais três checagens de árvore que o CI não pode fazer
// porque para ele já é tarde (branch errada, upstream armado, árvore suja).
//
// O QUE ELE NÃO FAZ
//
// Não substitui `validar-frontend.sh` nem `validar-backend.sh` — aqueles rodam
// typecheck, testes e build. Este roda em ~1s e cobre o eixo do **metadado**.
//
// USO
//
//   node scripts/preflight-pr.mjs --corpo <arquivo.md> [--base origin/main]
//
// `--arquivos a.ts,b.ts` substitui a lista vinda do `git diff`. Serve para
// conferir um corpo ANTES de commitar — sem isso o diff é zero e a regra do
// diff vazio reprova um corpo que está correto. Use `--arquivos -` para
// declarar explicitamente que o diff é vazio.
//
// `--versao <base>:<atual>` substitui as duas versões do manifesto, e `-`
// declara "sem manifesto". É a TERCEIRA override, e ela existe pelo mesmo
// motivo das outras duas: a comparação de `versao` lia o `manifesto.json` do
// disco, então a bateria — que declara um diff sintético — reprovava os casos
// dela em qualquer PR que legitimamente bumpasse a versão. Como este job roda
// em TODO PR, isso faria toda migração corretamente versionada derrubar o CI.
// Achado do Codex no PR 502, rodada 2: o conserto da rodada 1 abriu isto.
//
// `--commits <arquivo|->` substitui as mensagens de commit. As duas overrides
// andam juntas: sobrescrever só a lista de arquivos deixa METADE da entrada
// vindo da árvore, e uma bateria de testes passa ou falha conforme o que
// estiver commitado. Foi achado do Codex no PR 502 — a bateria deste script
// passava antes do commit e quebrava depois dele, em 7 dos 20 casos.
//
// Fluxo canônico: escreva o corpo num arquivo, rode isto, e só então passe o
// MESMO arquivo para `mcp__github__create_pull_request`. O arquivo é o
// artefato — reescrever o corpo à mão na chamada do MCP desfaz a garantia.
//
// Só `node` + `git`: sem SDK, sem credencial, sem rede.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Argumentos ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (nome, padrao) => {
  const i = argv.indexOf(nome);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : padrao;
};

const CORPO_ARQ = arg('--corpo');
const BASE = arg('--base', 'origin/main');
const NUMERO = arg('--numero', '');
const ARQUIVOS_MANUAIS = arg('--arquivos');
const COMMITS_MANUAIS = arg('--commits');
const VERSAO_MANUAL = arg('--versao');

if (!CORPO_ARQ) {
  console.error('uso: node scripts/preflight-pr.mjs --corpo <arquivo.md> [--base origin/main]');
  console.error('\nEscreva o corpo do PR num arquivo e passe-o aqui. O mesmo arquivo vai');
  console.error('para o create_pull_request — se você reescrever o corpo na chamada do');
  console.error('MCP, o que foi verificado não é o que foi publicado.');
  process.exit(2);
}
if (!existsSync(CORPO_ARQ)) {
  console.error(`✖ arquivo de corpo não encontrado: ${CORPO_ARQ}`);
  process.exit(2);
}

const corpo = readFileSync(CORPO_ARQ, 'utf8');

const git = (...args) =>
  execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const bloqueantes = [];
const avisos = [];
const ok = [];

// ── 1. A árvore está num estado de onde dá para abrir PR ────────────────────
// O CI nunca vê isto: quando ele roda, o push já aconteceu. Se foi para o
// lugar errado, o estrago está feito.
let branch = '';
try {
  branch = git('branch', '--show-current');
} catch {
  bloqueantes.push('não consegui ler a branch atual — isto é um repositório git?');
}

if (branch === 'main') {
  bloqueantes.push(
    'estado da árvore: você está na `main`. O processo obrigatório exige branch própria criada de ' +
      '`origin/main` (CLAUDE.md § Processo obrigatório, passo 1).',
  );
} else if (branch) {
  ok.push(`estado da árvore: branch \`${branch}\`, não é a main`);
} else {
  // `actions/checkout` deixa o repositório em HEAD DESTACADO, e aí
  // `git branch --show-current` devolve vazio. Sem este ramo a checagem não
  // imprimia nada no CI, e um teste que assertava o texto da branch falhava lá
  // e passava aqui — a mesma classe de defeito que o `--arquivos` e o
  // `--commits` já tinham corrigido em outras entradas. As três checagens de
  // árvore são de PRÉ-PUSH: no CI o push já aconteceu e elas não se aplicam.
  ok.push('estado da árvore: HEAD destacado — branch e upstream não se aplicam (é o caso do CI)');
}

// A armadilha do `checkout -B <branch> origin/main`: a branch nasce rastreando
// `origin/main`, e um `git push` pelado empurra o trabalho para lá. Aqui o
// SUCESSO do comando é o problema.
try {
  const upstream = git('rev-parse', '--abbrev-ref', '@{u}');
  if (upstream === 'origin/main') {
    bloqueantes.push(
      'a branch rastreia `origin/main` — um `git push` sem argumentos empurra para a main. ' +
        'Rode `git branch --unset-upstream` (CLAUDE.md § Processo obrigatório, passo 1).',
    );
  } else {
    ok.push(`upstream \`${upstream}\``);
  }
} catch {
  ok.push('sem upstream configurado (um `git push` pelado falha, que é o desejado)');
}

const sujo = (() => {
  try {
    return git('status', '--porcelain');
  } catch {
    return '';
  }
})();
if (sujo) {
  avisos.push(
    `a árvore tem ${sujo.split('\n').length} arquivo(s) não commitado(s) — eles NÃO entram no PR:\n` +
      sujo
        .split('\n')
        .slice(0, 10)
        .map((l) => `      ${l}`)
        .join('\n'),
  );
} else {
  ok.push('árvore limpa');
}

// ── 2. Base, head e diff — do mesmo jeito que o CI calcula ──────────────────
let baseSha = '';
let headSha = '';
let arquivos = [];
let adicionados = [];
let commits = '';

try {
  // Três pontos: o CI usa merge-base. Dois pontos acusaria arquivo que veio da
  // base no meio do caminho, produzindo falso positivo em branch desatualizada.
  baseSha = git('merge-base', BASE, 'HEAD');
  headSha = git('rev-parse', 'HEAD');
  // --no-renames: sem ele, mover um arquivo emite só o caminho de DESTINO, e o
  // guard de escopo deixa de ver a origem. Reproduzido pelo Codex no PR 496.
  const saida = git('diff', '--no-renames', '--name-only', `${baseSha}...${headSha}`);
  arquivos = saida ? saida.split('\n').filter(Boolean) : [];
  // Só arquivo ADICIONADO conta como migração nova. Com `--name-only` puro, um
  // PR que CONSERTA uma migração existente aparecia como migração nova e o
  // preflight exigia bump — divergindo do guard do `validar-backend.sh`, que
  // usa `--diff-filter=A` de propósito. Commits históricos de conserto de
  // migração seriam barrados. Achado do Codex no PR 502, rodada 2.
  const adicionadosBrutos = git('diff', '--no-renames', '--diff-filter=A', '--name-only', `${baseSha}...${headSha}`);
  adicionados = adicionadosBrutos ? adicionadosBrutos.split('\n').filter(Boolean) : [];
  commits = git('log', '--format=%B', `${baseSha}..${headSha}`);
  if (COMMITS_MANUAIS !== undefined) {
    commits = COMMITS_MANUAIS === '-' ? '' : readFileSync(COMMITS_MANUAIS, 'utf8');
    ok.push(`mensagens de commit DECLARADAS por --commits (o git não foi consultado)`);
  }
  if (ARQUIVOS_MANUAIS !== undefined) {
    arquivos = ARQUIVOS_MANUAIS === '-' ? [] : ARQUIVOS_MANUAIS.split(',').map((a) => a.trim()).filter(Boolean);
    // Lista declarada não carrega status de mudança; tratar tudo como ADICIONADO
    // é o que a bateria quer exercitar, e está dito aqui para não virar surpresa.
    adicionados = arquivos;
    ok.push(`diff DECLARADO por --arquivos: ${arquivos.length} arquivo(s), todos tratados como adicionados`);
  } else {
    ok.push(`diff vs. ${BASE}: ${arquivos.length} arquivo(s), base \`${baseSha.slice(0, 8)}\``);
  }
} catch (e) {
  bloqueantes.push(
    `não consegui calcular o diff contra ${BASE} (${String(e.message).split('\n')[0]}). ` +
      'Rode `git fetch origin main` antes.',
  );
}

const texto = `${corpo}\n${commits}`;

// ── 3. Diff vazio + keyword de fechamento ───────────────────────────────────
// O caso do PR #142: 12 issues fechadas, zero arquivos alterados.
const RE_KEYWORD = /\b(?:clos(?:e|es|ed)|fix(?:es|ed)?|resolv(?:e|es|ed))\s*:?\s*#(\d+)/gi;
const fecha = [...texto.matchAll(RE_KEYWORD)].map((m) => m[1]);
if (arquivos.length === 0 && fecha.length > 0) {
  bloqueantes.push(
    `o corpo declara fechar #${fecha.join(', #')} mas o diff está VAZIO. ` +
      'Foi assim que o PR #142 fechou 12 issues sem entregar nada (ver #162).',
  );
} else if (arquivos.length === 0) {
  avisos.push('o diff está vazio. Não fecha issue, então não é bloqueante — mas confirme.');
}

// ── 4. Os guards do CI, com a mesma entrada ─────────────────────────────────
const rodar = (rotulo, script, env) => {
  try {
    const saida = execFileSync(process.execPath, [resolve(RAIZ, script)], {
      cwd: RAIZ,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    ok.push(`${rotulo}${saida.trim() ? ` — ${saida.trim().split('\n').pop().trim()}` : ''}`);
  } catch (e) {
    const detalhe = [e.stdout, e.stderr].filter(Boolean).join('\n').trim();
    bloqueantes.push(`${rotulo} reprovou:\n${detalhe.split('\n').map((l) => `      ${l}`).join('\n')}`);
  }
};

rodar('guard de fechamento de issue', 'scripts/guard-issue-fechamento.mjs', {
  PR_BODY: corpo,
  PR_COMMITS: commits,
  PR_NUMERO: NUMERO,
});
rodar('guard de escopo (regra R1)', 'scripts/guard-pr-escopo-processo.mjs', {
  PR_ARQUIVOS: arquivos.join('\n'),
});
rodar('guard de JSON estrito', 'scripts/guard-json.mjs', {});
rodar('guard de ciclos no schema', 'scripts/guard-schema-ciclos.mjs', {});
rodar('guard da rede do processo', 'scripts/guard-processo.mjs', {});

// ── 5. Armadilhas de redação que nenhum guard pega ──────────────────────────
// Não são bloqueantes: são avisos, porque cada um tem um uso legítimo raro.

// `Fecha #123` em português não fecha nada, e a falha é 100% silenciosa: o
// guard de fechamento nem acusa, porque o número está citado e o autor
// *acha* que declarou.
const pt = [...texto.matchAll(/\b(?:fecha|fechado|corrige|resolve\s+a)\s+#\d+/gi)].map((m) => m[0]);
if (pt.length > 0) {
  avisos.push(
    `keyword em PORTUGUÊS não fecha issue: ${[...new Set(pt)].join(', ')}. ` +
      'Só close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved.',
  );
}

// `PR #NNN` faz o guard tratar a PR como issue citada, e aí ele exige uma
// declaração que não faz sentido. O template já manda escrever "PR NNN".
const prRef = [...corpo.matchAll(/\bPR\s+#(\d+)/gi)].map((m) => m[0]);
if (prRef.length > 0) {
  avisos.push(
    `${[...new Set(prRef)].join(', ')} — o guard lê isso como issue citada. ` +
      'Escreva "PR NNN" ou cole a URL /pull/NNN.',
  );
}

// `@codex` dentro do corpo ou de um relatório dispara o App de verdade. No PR
// 498 uma menção entre crases num relatório fez o bot responder "To use Codex
// here, create an environment for this repo" — ruído que parece erro.
if (/@codex/i.test(corpo)) {
  avisos.push(
    'o corpo contém `@codex` — isso ACIONA o App, inclusive entre crases. ' +
      'Peça a revisão num comentário separado e escreva "Codex" no corpo.',
  );
}

// Migração nova sem bump da `versao`, e o inverso. O guard completo mora no
// validar-backend.sh, que aborta sem o SDK — aqui é a versão que roda sempre.
const migracoesNovas = adicionados.filter((a) => /^migracoes\/\d+.*\.js$/.test(a));

// Comparar o VALOR de `versao`, não só o caminho do arquivo: um PR que edita
// outro campo do manifesto marcava "bumpou" sem ter bumpado, e o preflight
// aprovava o que o validar-backend.sh reprova. Achado do Codex no PR 502.
const versaoDe = (ref) => {
  try {
    const bruto = ref === null
      ? readFileSync(resolve(RAIZ, 'manifesto.json'), 'utf8')
      : git('show', `${ref}:manifesto.json`);
    return JSON.parse(bruto).versao ?? null;
  } catch {
    return null;
  }
};
let versaoBase = baseSha ? versaoDe(baseSha) : null;
let versaoAtual = versaoDe(null);
if (VERSAO_MANUAL !== undefined) {
  const [b, a] = VERSAO_MANUAL === '-' ? [null, null] : VERSAO_MANUAL.split(':');
  versaoBase = b || null;
  versaoAtual = a || null;
  ok.push(`versao DECLARADA por --versao: \`${versaoBase ?? '—'}\` → \`${versaoAtual ?? '—'}\``);
}
const bumpou = versaoBase !== null && versaoAtual !== null && versaoBase !== versaoAtual;

if (migracoesNovas.length > 0 && !bumpou) {
  bloqueantes.push(
    `migração nova (${migracoesNovas.join(', ')}) sem bump da \`versao\` no manifesto.json ` +
      `(base \`${versaoBase ?? '?'}\` → atual \`${versaoAtual ?? '?'}\`). Tocar o arquivo não basta.`,
  );
}
if (migracoesNovas.length === 0 && bumpou) {
  bloqueantes.push(
    `\`versao\` bumpada (\`${versaoBase}\` → \`${versaoAtual}\`) sem migração nova. ` +
      'A `versao` descreve o SCHEMA — bumpar sem migração cria um degrau vazio.',
  );
}
if (migracoesNovas.length > 1) {
  bloqueantes.push(
    `${migracoesNovas.length} migrações no mesmo PR (${migracoesNovas.join(', ')}). ` +
      'Regra da Rodada 9: um número por PR.',
  );
}

// ── Saída ───────────────────────────────────────────────────────────────────
console.log(`preflight de PR — corpo: ${CORPO_ARQ} · base: ${BASE}\n`);
for (const o of ok) console.log(`  ✓ ${o}`);
if (avisos.length > 0) {
  console.log('');
  for (const a of avisos) console.log(`  ⚠ ${a}`);
}

if (bloqueantes.length === 0) {
  console.log(`\nok: ${ok.length} checagem(ns) passaram, ${avisos.length} aviso(s).`);
  console.log('Pode abrir o PR — passe ESTE arquivo como corpo, sem reescrever.');
  process.exit(0);
}

console.error(`\n✖ preflight reprovou (${bloqueantes.length} bloqueante(s)):\n`);
for (const b of bloqueantes) console.error(`  - ${b}`);
console.error('\nConserte e rode de novo. Abrir o PR agora significa CI vermelho.');
process.exit(1);
