#!/usr/bin/env node
// Guard do processo obrigatório — confere que a rede que o sustenta continua de pé.
//
// POR QUE ELE EXISTE: todo o resto (hooks, deny, skill de revisão) falha CALADO.
// Um PR que apague `.claude/settings.json`, renomeie um script de hook ou tire o
// bit de execução não deixa NADA vermelho: os hooks simplesmente param de rodar,
// e "não rodou" é indistinguível de "tudo normal". Este guard transforma essa
// ausência em falha visível.
//
// O que ele NÃO faz: validar a semântica dos hooks. Ele confere existência,
// parse e executabilidade. Um hook que exista e esteja errado passa por aqui —
// para isso existe `scripts/testar-guarda-monorepo.sh`.
//
// Só `node`: sem SDK, sem credencial, sem rede. Roda no CI e localmente igual.

import { readFileSync, existsSync, accessSync, constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const erros = [];
const ok = [];

const caminho = (p) => resolve(RAIZ, p);

// ── 1. O settings.json existe e é JSON estrito ──────────────────────────────
const SETTINGS = '.claude/settings.json';
let settings = null;
if (!existsSync(caminho(SETTINGS))) {
  erros.push(`${SETTINGS} não existe — sem ele nenhum hook do processo roda.`);
} else {
  try {
    settings = JSON.parse(readFileSync(caminho(SETTINGS), 'utf8'));
    ok.push(`${SETTINGS} é JSON estrito`);
  } catch (e) {
    erros.push(`${SETTINGS} não parseia (${e.message}) — o Claude Code ignora o arquivo inteiro.`);
  }
}

// ── 2. Os arquivos que o processo exige existem ─────────────────────────────
const OBRIGATORIOS = [
  ['.claude/motor-revisao.md', 'a skill de revisão manda PARAR se ele faltar'],
  ['.claude/skills/revisar-pr-apps/SKILL.md', 'é o passo 6 do processo'],
  ['.claude/preparar-sessao.sh', 'hook SessionStart'],
  ['.claude/lembrete-processo.sh', 'hook UserPromptSubmit'],
  ['.claude/guarda-monorepo.sh', 'hook PreToolUse — a única defesa contra escrita no monorepo'],
  ['scripts/testar-guarda-monorepo.sh', 'a bateria da guarda'],
  ['scripts/testar-revisao-registrada.sh', 'a bateria do parsing da atestação'],
  ['scripts/guard-pr-escopo-processo.mjs', 'a regra R1 — processo não viaja com código de produto'],
  ['scripts/preflight-pr.mjs', 'o portão que roda os guards de corpo/diff ANTES de abrir o PR'],
  ['scripts/testar-preflight-pr.sh', 'a bateria do preflight — portão sem bateria dá licença'],
];
for (const [arq, motivo] of OBRIGATORIOS) {
  if (existsSync(caminho(arq))) ok.push(`${arq} presente`);
  else erros.push(`${arq} não existe — ${motivo}.`);
}

// ── 3. Os scripts de hook são executáveis ───────────────────────────────────
// Bit de execução perdido = hook que não roda, sem erro em lugar nenhum.
for (const arq of OBRIGATORIOS.map(([a]) => a).filter((a) => a.endsWith('.sh'))) {
  if (!existsSync(caminho(arq))) continue;
  try {
    accessSync(caminho(arq), constants.X_OK);
    ok.push(`${arq} é executável`);
  } catch {
    erros.push(`${arq} não tem bit de execução — o hook não vai rodar, e a falha é calada.`);
  }
}

// ── 4. Todo `command` de hook aponta para arquivo que existe ────────────────
if (settings?.hooks) {
  for (const [evento, grupos] of Object.entries(settings.hooks)) {
    for (const grupo of grupos ?? []) {
      for (const h of grupo.hooks ?? []) {
        const cmd = h.command ?? '';
        const m = cmd.match(/\.claude\/[A-Za-z0-9._/-]+\.sh/);
        if (!m) continue;
        if (existsSync(caminho(m[0]))) ok.push(`hook ${evento} → ${m[0]} existe`);
        else erros.push(`hook ${evento} aponta para ${m[0]}, que não existe.`);
      }
    }
  }
}

// ⚠️ FORA do `if` acima, de propósito. Este laço já esteve dentro dele, e aí
// apagar a chave `hooks` INTEIRA — o jeito mais provável de furar a rede —
// passava verde, com um alegre "17 verificações". Achado da revisão do PR #424.
for (const ev of ['SessionStart', 'UserPromptSubmit', 'PreToolUse']) {
  if (settings && !settings.hooks?.[ev]) erros.push(`hook ${ev} sumiu do ${SETTINGS}.`);
}

// ── 5. As regras de deny do monorepo continuam lá ───────────────────────────
const deny = settings?.permissions?.deny ?? [];
for (const ferramenta of ['Write', 'Edit', 'NotebookEdit']) {
  const tem = deny.some((r) => r.startsWith(`${ferramenta}(`) && r.includes('/home/user/urbiverso'));
  if (tem) ok.push(`deny de ${ferramenta} no monorepo presente`);
  else erros.push(`deny de ${ferramenta} sob /home/user/urbiverso sumiu de ${SETTINGS}.`);
}

// ── 6. A geração antiga não voltou ──────────────────────────────────────────
// Ressuscitar o protocolo de duas sessões traria de volta duas máquinas de
// estado divergentes — ver CLAUDE.md § Processo obrigatório.
for (const morto of ['.claude/protocolo-revisao-pr.md', '.claude/skills/acompanhar-revisao/SKILL.md']) {
  if (existsSync(caminho(morto))) {
    erros.push(`${morto} voltou a existir — a geração de duas sessões foi apagada de propósito.`);
  }
}

// ── Saída ───────────────────────────────────────────────────────────────────
if (erros.length === 0) {
  console.log(`ok: a rede do processo está íntegra (${ok.length} verificações).`);
  process.exit(0);
}
console.error('A rede do processo obrigatório está furada:\n');
for (const e of erros) console.error(`  - ${e}`);
console.error('\nVer CLAUDE.md § "Processo obrigatório de trabalho".');
process.exit(1);
