#!/usr/bin/env node
// Cria e sincroniza no GitHub as issues descritas em `docs/rodada-8/25-issues-final.md`.
//
//   node scripts/criar-issues-rodada-8.mjs               # ensaio: não toca em nada
//   node scripts/criar-issues-rodada-8.mjs --executar    # CRIA as que não têm `numero:`
//   node scripts/criar-issues-rodada-8.mjs --sincronizar # ATUALIZA as que têm `numero:`
//   node scripts/criar-issues-rodada-8.mjs --sincronizar --so R8-05,R8-21
//
// O arquivo é a FONTE DE VERDADE; o GitHub é o espelho. Editar lá e sincronizar
// mantém as duas pontas iguais e deixa o histórico versionado no repositório.
//
// Exige `gh` autenticado (`gh auth status`).
//
// - `--executar` é idempotente por TÍTULO: issue cujo título já exista é PULADA,
//   então reexecutar depois de uma falha no meio não duplica nada.
// - `--sincronizar` reescreve título, corpo e labels da issue `numero:`. As labels
//   são reconciliadas: entra o que falta, sai o que sobra — exceto as que o script
//   não gerencia (ver `LABELS_GERIDAS`), que ficam intactas.
//
// O arquivo de entrada usa blocos delimitados:
//
//   <<<ISSUE>>>
//   id: R8-01
//   numero: 426          ← presente ⇒ a issue existe; ausente ⇒ será criada
//   title: [P1] fix(...): ...
//   labels: P1, motor
//   sources: A5 §D14 · C1
//   ---
//   <corpo markdown>
//   <<<END>>>

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = 'rafaleandrog/viabilidade-real-estate';
const ENTRADA = 'docs/rodada-8/25-issues-final.md';

// O documento usa P1/P2/P3 e `docs`; o repositório já tinha convenção própria
// desde antes desta rodada. Traduzimos em vez de criar um esquema paralelo.
const MAPA_LABEL = {
  P1: 'prioridade-1',
  P2: 'prioridade-2',
  P3: 'prioridade-3',
  docs: 'documentation',
};

// Só estas o `--sincronizar` remove quando somem do arquivo. Uma label posta à
// mão no GitHub (triagem, milestone improvisada) sobrevive à sincronização —
// senão o script apagaria em silêncio trabalho de quem estava no navegador.
const LABELS_GERIDAS = new Set([
  ...Object.values(MAPA_LABEL), 'rodada-8',
  'motor', 'ui', 'backend', 'funding', 'decisao',
]);

const args = process.argv.slice(2);
const executar = args.includes('--executar');
const sincronizar = args.includes('--sincronizar');
const soIdx = args.indexOf('--so');
const so = soIdx >= 0 ? new Set((args[soIdx + 1] || '').split(',').map((s) => s.trim())) : null;

if (executar && sincronizar) {
  console.error('--executar e --sincronizar são modos distintos; rode um de cada vez.');
  process.exit(1);
}

const bruto = readFileSync(ENTRADA, 'utf8');
const blocos = [...bruto.matchAll(/<<<ISSUE>>>\r?\n([\s\S]*?)\r?\n<<<END>>>/g)].map((m) => m[1]);

if (!blocos.length) {
  console.error(`Nenhum bloco <<<ISSUE>>> encontrado em ${ENTRADA}.`);
  process.exit(1);
}

const issues = blocos.map((b, i) => {
  const corte = b.indexOf('\n---');
  if (corte < 0) throw new Error(`Bloco ${i + 1} sem separador '---' entre cabeçalho e corpo.`);
  const cabecalho = b.slice(0, corte);
  const corpo = b.slice(corte + 4).replace(/^\r?\n/, '');
  const campo = (nome) => (cabecalho.match(new RegExp(`^${nome}:\\s*(.+)$`, 'm')) || [])[1]?.trim();

  const id = campo('id');
  const title = campo('title');
  if (!id || !title) throw new Error(`Bloco ${i + 1} sem 'id' ou 'title'.`);

  const labels = (campo('labels') || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .map((l) => MAPA_LABEL[l] || l);
  labels.push('rodada-8');

  const numero = campo('numero');
  return {
    id, title, labels: [...new Set(labels)], sources: campo('sources') || '', corpo,
    numero: numero ? Number(numero) : null,
  };
})
// O cabeçalho do documento traz um bloco de EXEMPLO do formato, com id
// `R8-NN` e reticências no título. Ele casa com o delimitador e viraria uma
// issue de verdade — foi o que o primeiro ensaio pegou.
.filter((it) => /^R8-\d+$/.test(it.id) && !/…|\.\.\./.test(it.title));

// --- validação antes de tocar na rede -------------------------------------
const erros = [];
const vistos = new Set();
for (const it of issues) {
  if (vistos.has(it.title)) erros.push(`título repetido: ${it.title}`);
  vistos.add(it.title);
  if (/\b(closes|fixes|resolves)\b/i.test(it.title)) erros.push(`${it.id}: keyword de fechamento no TÍTULO (não funciona lá)`);
  if (!it.corpo.trim()) erros.push(`${it.id}: corpo vazio`);
}
if (erros.length) {
  console.error('Validação falhou:\n  ' + erros.join('\n  '));
  process.exit(1);
}

const comNumero = issues.filter((i) => i.numero);
console.log(`${issues.length} issues lidas de ${ENTRADA} — ${comNumero.length} já existem no GitHub.`);

if (!executar && !sincronizar) {
  for (const it of issues) {
    console.log(`  ${it.id}  ${it.numero ? '#' + it.numero : '(nova)'}  [${it.labels.join(', ')}]  ${it.title}`);
  }
  console.log('\nEnsaio — nada foi tocado. Use --executar (cria) ou --sincronizar (atualiza).');
  process.exit(0);
}

// ---------------------------------------------------------------- sincronizar
if (sincronizar) {
  const alvo = issues.filter((i) => i.numero && (!so || so.has(i.id)));
  if (!alvo.length) { console.error('Nada a sincronizar: nenhum bloco tem `numero:`.'); process.exit(1); }

  const dirS = mkdtempSync(join(tmpdir(), 'r8-sync-'));
  let ok = 0, erro = 0;

  for (const it of alvo) {
    const rodape = `\n\n---\n<sub>Rodada 8 · \`${it.id}\` · fontes: ${it.sources}`
      + ` · contexto completo em \`docs/rodada-8/\`</sub>\n`;
    const arq = join(dirS, `${it.id}.md`);
    writeFileSync(arq, it.corpo + rodape, 'utf8');

    try {
      // Labels de agora, para saber o que sai. Só as geridas entram na conta.
      const atuais = JSON.parse(execFileSync('gh', ['issue', 'view', String(it.numero),
        '--repo', REPO, '--json', 'labels'], { encoding: 'utf8' })).labels.map((l) => l.name);
      const querer = new Set(it.labels);
      const add = it.labels.filter((l) => !atuais.includes(l));
      const rem = atuais.filter((l) => LABELS_GERIDAS.has(l) && !querer.has(l));

      const argv = ['issue', 'edit', String(it.numero), '--repo', REPO,
        '--title', it.title, '--body-file', arq];
      for (const l of add) argv.push('--add-label', l);
      for (const l of rem) argv.push('--remove-label', l);
      execFileSync('gh', argv, { encoding: 'utf8' });

      const delta = [add.length ? '+' + add.join(',') : '', rem.length ? '-' + rem.join(',') : '']
        .filter(Boolean).join(' ');
      console.log(`✓ ${it.id}  #${it.numero}${delta ? '  ' + delta : ''}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${it.id}  #${it.numero}  ${String(e.stderr || e.message).trim().split('\n')[0]}`);
      erro++;
    } finally {
      try { unlinkSync(arq); } catch {}
    }
  }

  console.log(`\nsincronizadas ${ok} · falhas ${erro}`);
  process.exit(erro ? 1 : 0);
}

// Idempotência: o que já existe no repo, por título.
const existentes = new Set(
  JSON.parse(execFileSync('gh', ['issue', 'list', '--repo', REPO, '--state', 'all',
    '--limit', '1000', '--json', 'title'], { encoding: 'utf8', maxBuffer: 1e8 }))
    .map((i) => i.title),
);

const dir = mkdtempSync(join(tmpdir(), 'r8-'));
let criadas = 0, puladas = 0, falhas = 0;

for (const it of issues) {
  if (so && !so.has(it.id)) continue;
  // `numero:` é a declaração de que a issue já existe. Vale mais que a busca por
  // título, que erra quando o título foi reescrito (é justamente o que a
  // sincronização faz) — sem isto, editar um título criaria uma issue duplicada.
  if (it.numero) { console.log(`· ${it.id} já é #${it.numero}, pulando`); puladas++; continue; }
  if (existentes.has(it.title)) { console.log(`· ${it.id} já existe, pulando`); puladas++; continue; }

  const rodape = `\n\n---\n<sub>Rodada 8 · \`${it.id}\` · fontes: ${it.sources}`
    + ` · contexto completo em \`docs/rodada-8/\`</sub>\n`;
  const arq = join(dir, `${it.id}.md`);
  writeFileSync(arq, it.corpo + rodape, 'utf8');

  const argv = ['issue', 'create', '--repo', REPO, '--title', it.title, '--body-file', arq];
  for (const l of it.labels) argv.push('--label', l);

  try {
    const url = execFileSync('gh', argv, { encoding: 'utf8' }).trim().split('\n').pop();
    console.log(`✓ ${it.id}  ${url}`);
    criadas++;
  } catch (e) {
    console.error(`✗ ${it.id}  ${String(e.stderr || e.message).trim().split('\n')[0]}`);
    falhas++;
  } finally {
    try { unlinkSync(arq); } catch {}
  }
}

console.log(`\ncriadas ${criadas} · puladas ${puladas} · falhas ${falhas}`);
process.exit(falhas ? 1 : 0);
