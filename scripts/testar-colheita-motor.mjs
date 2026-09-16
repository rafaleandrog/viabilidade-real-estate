#!/usr/bin/env node
// Guarda da colheita do motor de revisão: falha NUNCA pode virar laudo limpo.
//
// Por que este teste existe, e por que ele EXTRAI o código do markdown em vez de
// reimplementá-lo: a colheita é a única defesa entre "a lente caiu" e "a lente não
// achou nada", e as duas coisas se parecem — saída curta, exit silencioso, zero
// achado. O `.claude/motor-revisao.md` é a fonte única desse código, e uma cópia
// num script de teste divergiria em silêncio, que é exatamente o modo de falha que
// a defesa combate. É a mesma técnica que `scripts/testar-revisao-registrada.sh`
// usa para a expressão do workflow.
//
// O que motivou: o port do Kimi para este repositório manteve a colheita só do
// Codex, e com ela TODA lente Kimi bem-sucedida saía "NÃO EXECUTADA, texto vazio" —
// num ambiente em que a fan-out inteira roda em Kimi, a revisão voltaria limpa por
// construção. Achado P1 do App do Codex; nenhuma das cinco lentes Kimi o pegou,
// porque elas liam o próprio JSONL por outro caminho.
//
// As fixturas não são inventadas: cada uma reproduz uma forma OBSERVADA rodando os
// CLIs de verdade, ou um caso de borda do parser. A observação está anotada em cada
// uma, e a tabela do doc traz as do Kimi medidas pelo upstream.
//
// Roda com: node scripts/testar-colheita-motor.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const motor = readFileSync(join(raiz, '.claude', 'motor-revisao.md'), 'utf8');

// ── Extração: o bloco bash da seção "A colheita" ─────────────────────────────
const secao = motor.indexOf('## A colheita');
assert.notEqual(secao, -1, 'seção "A colheita" sumiu do motor');
const abre = motor.indexOf('```bash', secao);
const fecha = motor.indexOf('```', abre + 7);
assert.ok(abre !== -1 && fecha !== -1, 'bloco bash da colheita sumiu do motor');
const blocoOriginal = motor.slice(abre + 7, fecha);

// A asserção estrutural, e ela é o coração do arquivo: colher pelo GLOB em vez do
// roster faz a lente que morreu antes de escrever SUMIR do relatório, em vez de
// virar falha visível — o modo de falha que a §7 chama de pior que a falha.
assert.match(
  blocoOriginal,
  /^LENTES=/m,
  'a colheita tem que iterar o roster de lentes (LENTES=), nunca o glob dos arquivos: ' +
    'lente que morre antes de escrever some do relatório em vez de virar falha',
);

// Única adaptação: o roster é DADO da revisão, não lógica. Trocado pelo das fixturas.
const bloco = (roster) => blocoOriginal.replace(/^LENTES=.*$/m, `LENTES="${roster.join(' ')}"`);

// ── Fixturas ─────────────────────────────────────────────────────────────────
// `jsonl: null` = a lente não chegou a escrever arquivo nenhum.
const CASOS = [
  {
    id: 'codex_ok',
    motor: 'codex',
    exit: 0,
    // Forma observada: o `codex exec review --json` fecha o turno em item.completed.
    jsonl: [
      '{"type":"item.started","item":{"type":"agent_message"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"ACHADO: P1 | a.ts:3 | x"}}',
    ],
    esperaColhido: true,
    contem: 'ACHADO: P1',
  },
  {
    id: 'codex_turn_failed',
    motor: 'codex',
    exit: 1,
    // Observado: com --json o erro sai no próprio JSONL, não no stderr.
    jsonl: ['{"type":"turn.failed","error":{"message":"sandbox denied"}}'],
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
  {
    id: 'codex_interrompido',
    motor: 'codex',
    exit: 0,
    // O caso que deu origem à guarda: turno que falha AINDA emite agent_message.
    // Texto NÃO vazio e exit 0 — só o grep pelo texto salva.
    jsonl: [
      '{"type":"item.completed","item":{"type":"agent_message","text":"Review was interrupted. Please re-run /review and wait for it to complete."}}',
    ],
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
  {
    id: 'kimi_ok',
    motor: 'kimi',
    exit: 0,
    // Forma observada do stream-json do kimi 0.38.0: uma linha por mensagem, e a
    // resposta é o último role=assistant com .content não-nulo. É o caso do P1.
    jsonl: [
      '{"role":"meta","type":"system.version","content":"0.38.0"}',
      '{"role":"assistant","content":null,"tool_calls":[{"name":"Read"}]}',
      '{"role":"tool","content":"conteudo lido"}',
      '{"role":"assistant","content":"VEREDITO: precisa-atencao\\nACHADO: P2 | b.ts:9 | y"}',
    ],
    esperaColhido: true,
    contem: 'ACHADO: P2',
  },
  {
    id: 'kimi_sem_content',
    motor: 'kimi',
    exit: 1,
    // Observado com chave inválida / modelo inexistente / sem as KIMI_MODEL_*:
    // stdout traz só a linha system.version, e o motivo fica no stderr.
    jsonl: ['{"role":"meta","type":"system.version","content":"0.38.0"}'],
    err: 'failed to run prompt: No model configured',
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
  {
    id: 'kimi_cortado_com_texto',
    motor: 'kimi',
    exit: 124,
    // O caso que MAIS importa, e o único que a checagem de texto não pega: o turno
    // é cortado (timeout) DEPOIS de já ter escrito um content válido. Texto não
    // vazio, stderr vazio — só o exit != 0 denuncia. Remover a checagem de exit
    // deixa este caso verde, e uma revisão pela metade vira laudo completo.
    jsonl: [
      '{"role":"assistant","content":"VEREDITO: sem-achado"}',
      '{"role":"assistant","content":"ACHADO: P1 | c.ts:1 | parcial"}',
    ],
    err: '',
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
  {
    id: 'sem_arquivo',
    motor: 'kimi',
    exit: 1,
    // O processo morreu antes do redirecionamento: não há arquivo. Sem o roster,
    // este id simplesmente não apareceria no relatório.
    jsonl: null,
    esperaColhido: false,
    contem: 'sem saída',
  },
  {
    id: 'fora_do_execucao',
    motor: null, // não entra no execucao.txt
    exit: null,
    jsonl: ['{"role":"assistant","content":"texto que não deve ser colhido"}'],
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
];

// ── Execução ─────────────────────────────────────────────────────────────────
const OUT = mkdtempSync(join(tmpdir(), 'colheita-'));
let falhas = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const falha = (m, d) => { console.error(`  FALHA ${m} — ${d}`); falhas += 1; };

try {
  const execucao = [];
  for (const c of CASOS) {
    if (c.jsonl !== null) writeFileSync(join(OUT, `${c.id}.jsonl`), c.jsonl.join('\n') + '\n');
    writeFileSync(join(OUT, `${c.id}.err`), c.err ?? '');
    if (c.motor !== null) {
      execucao.push(`${c.id} exit=${c.exit} motor=${c.motor} modelo=x esforco=y dur=1s`);
    }
  }
  writeFileSync(join(OUT, 'execucao.txt'), execucao.join('\n') + '\n');

  const saida = execFileSync('bash', ['-c', `OUT=${JSON.stringify(OUT)}\n${bloco(CASOS.map((c) => c.id))}`], {
    encoding: 'utf8', timeout: 60_000,
  });

  ok(`bloco da colheita extraído do motor e executado (${CASOS.length} fixturas)`);
  ok('a colheita itera o roster de lentes, não o glob dos arquivos');

  // Cada fixtura tem a sua própria fatia da saída: do cabeçalho dela até o próximo.
  const fatia = (id) => {
    const i = saida.indexOf(`### ${id}`);
    if (i === -1) return null;
    const resto = saida.slice(i + 1);
    const j = resto.indexOf('\n### ');
    return j === -1 ? resto : resto.slice(0, j);
  };

  for (const c of CASOS) {
    const f = fatia(c.id);
    if (f === null) { falha(c.id, 'a lente sumiu da saída da colheita'); continue; }
    const colhido = !f.includes('NÃO EXECUTADA') && !f.includes('sem saída');
    if (colhido !== c.esperaColhido) {
      falha(c.id, `esperava ${c.esperaColhido ? 'colhido' : 'NÃO EXECUTADA'}, veio o contrário`);
      continue;
    }
    if (!f.includes(c.contem)) { falha(c.id, `a saída não contém ${JSON.stringify(c.contem)}`); continue; }
    ok(`${c.id} → ${c.esperaColhido ? 'colhido' : 'não executada'} (${c.contem})`);
  }

  // O texto de uma lente NUNCA pode vazar para a fatia de outra.
  const fkimi = fatia('kimi_ok') ?? '';
  if (fkimi.includes('ACHADO: P1')) falha('isolamento', 'texto do Codex vazou para a fatia do Kimi');
  else ok('cada lente colhe só o próprio arquivo');
} finally {
  rmSync(OUT, { recursive: true, force: true });
}

console.log();
if (falhas === 0) { console.log('ok: a colheita do motor passou em todas as fixturas.'); process.exit(0); }
console.error(`FALHOU: ${falhas} caso(s).`);
process.exit(1);
