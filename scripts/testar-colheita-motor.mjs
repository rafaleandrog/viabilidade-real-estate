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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

// A extração é first-match dentro da seção. Se algum dia a prosa ganhar um bloco ```bash
// ANTES do da colheita — um exemplo didático da linha do roster, digamos —, ele seria o
// extraído, e a bateria rodaria verde sobre um exemplo em vez da guarda. Estas duas marcas
// são o que só o bloco real tem; com elas, o exemplo falha FECHADO em vez de passar.
for (const marca of ['execucao.txt', 'item.completed', 'role=="assistant"']) {
  assert.ok(
    blocoOriginal.includes(marca),
    `o bloco extraído da seção "A colheita" não contém ${JSON.stringify(marca)} — ` +
      'a extração pegou o primeiro ```bash da seção, e ele não é a colheita',
  );
}

// A colheita escolhe o parser pelo campo `motor=` do execucao.txt — então as fixturas só
// valem se o PRODUTOR daquele arquivo gravar o campo. As duas funções de despacho vivem no
// mesmo doc; sem esta asserção, a bateria ficaria verde exercitando um formato que a fan-out
// real não produz. Já aconteceu: a `lente()` do Codex gravava `tier=` e não `motor=`, e toda
// lente Codex bem-sucedida seria colhida como "não chegou a escrever".
const despachos = [...motor.matchAll(/echo "\$id exit=\$rc[^"]*"\s*>>\s*"\$OUT\/execucao\.txt"/g)]
  .map((m) => m[0]);
assert.ok(despachos.length >= 2, 'não achei as duas funções de despacho (Codex e Kimi) no motor');
for (const d of despachos) {
  assert.match(d, /motor=/, `função de despacho sem \`motor=\`: a colheita leria a lente como não executada — ${d}`);
}

// Única adaptação: o roster é DADO da revisão, não lógica. Trocado pelo das fixturas.
const bloco = (roster) => blocoOriginal.replace(/^LENTES=.*$/m, `LENTES="${roster.join(' ')}"`);

// ── A guarda de override de agente, extraída da seção da árvore ──────────────
// Ela é a única trava contra o vetor de sequestro do revisor (um `agent.md` com
// `override: true` no repositório revisado substitui o system prompt da lente), e
// ela já falhou ABERTA: escrita como `if ls -d "$a" "$b"`, com só UM dos diretórios
// existindo — o caso real de um PR hostil — o `ls` imprime o que achou e sai rc=2 por
// causa do que faltou, então o `if` não entra no corpo e o despacho segue. Medido.
// Os três casos abaixo cobrem os três estados, e o do meio é o que a forma antiga perdia.
const secaoArvore = motor.indexOf('## A árvore que o motor lê');
assert.notEqual(secaoArvore, -1, 'seção "A árvore que o motor lê" sumiu do motor');
const marcaOv = motor.indexOf('OVERRIDE DE AGENTE NA ÁRVORE', secaoArvore);
assert.notEqual(marcaOv, -1, 'a guarda de override de agente sumiu da seção da árvore');
const abreOv = motor.lastIndexOf('```bash', marcaOv);
const fechaOv = motor.indexOf('```', marcaOv);
const blocoBruto = motor.slice(abreOv + 7, fechaOv);
// O bloco da seção da árvore tem DOIS passos, e só o segundo é a guarda. Rodar o bloco
// inteiro executaria o passo 1 (`git -C "$WT" diff … > "$OUT/DIFF.patch"`) com `OUT`
// indefinido — ou seja, um redirect para `/DIFF.patch`, escrita fora do tempdir. Não é
// hipótese: a primeira versão desta bateria criou esse arquivo na raiz, rodando como root.
// Então o recorte é explícito, e falha FECHADO se a âncora sumir.
const inicioGuarda = blocoBruto.indexOf('for d in ');
assert.notEqual(
  inicioGuarda, -1,
  'não achei o `for d in` da guarda de override dentro do bloco da seção da árvore — ' +
    'sem a âncora, o teste rodaria o passo do `git diff` em vez da guarda',
);
const blocoOv = blocoBruto.slice(inicioGuarda);
// A sentinela é larga de propósito: o teste EXECUTA este trecho com `bash -c`, então
// qualquer comando que escreva ou apague precisa esbarrar aqui. A primeira versão casava
// só `git ` com espaço literal e `rm -rf` literal, e deixava passar `rm -r`, `find -delete`
// e qualquer redirect para caminho absoluto — mais furada que a placa que anunciava.
assert.doesNotMatch(
  blocoOv, /\b(git|rm|mv|cp|find|tee|dd|truncate|install)\b|>\s*["']?[/$]/,
  'o recorte da guarda não pode conter comando que escreva, mova ou apague, nem redirect: ' +
    'o teste executa este trecho, e ele tem que ser inerte fora da própria checagem',
);
// A prova é EXECUTAR, não casar regex: a forma antiga (`if ls -d "$a" "$b"`) também
// "menciona" os dois caminhos, e passaria por qualquer asserção textual.
const estadoOverride = (dirs) => {
  const wt = mkdtempSync(join(tmpdir(), 'wt-'));
  try {
    for (const d of dirs) mkdirSync(join(wt, ...d.split('/')), { recursive: true });
    try {
      execFileSync('bash', ['-c', `WT=${JSON.stringify(wt)}\n${blocoOv}`], { encoding: 'utf8', timeout: 30_000 });
      return 0;
    } catch (e) { return e.status ?? -1; }
  } finally { rmSync(wt, { recursive: true, force: true }); }
};
assert.equal(estadoOverride([]), 0, 'árvore limpa: a guarda não pode abortar');
// O estado negativo que faltava, e sem ele uma regressão passaria verde: guarda que
// testasse o diretório PAI (`[ -e "$WT/.kimi-code" ]`) abortaria todo PR que versione
// `.kimi-code/settings.json` sem agente nenhum — falso positivo que bloqueia revisão
// legítima. Fail-closed não é licença para abortar o que não é ameaça.
assert.equal(
  estadoOverride(['.kimi-code/nao-e-agents', '.agents/nao-e-agents']), 0,
  'diretório-pai presente sem `agents/`: a guarda não pode abortar — ela olha o caminho exato',
);
assert.notEqual(
  estadoOverride(['.kimi-code/agents']), 0,
  'SÓ .kimi-code/agents presente — o caso real de um PR hostil — e a guarda NÃO abortou: ' +
    'é a falha ABERTA que a forma `ls` de dois operandos produzia (rc=2 sem entrar no corpo)',
);
assert.notEqual(estadoOverride(['.agents/agents']), 0, 'só .agents/agents presente e a guarda não abortou');
assert.notEqual(estadoOverride(['.kimi-code/agents', '.agents/agents']), 0, 'os dois presentes e a guarda não abortou');

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
    exit: 0,
    // exit 0 E texto presente, os dois DE PROPÓSITO: é o que faz esta fixtura isolar a
    // guarda do `jq`. Com exit 1, o ramo `rc != 0` condenaria a lente; com texto vazio,
    // o `[ -z "$texto" ]` condenaria — nos dois casos apagar o `jq` inteiro deixaria a
    // fixtura verde, e ela mediria outra guarda que não a que diz medir. Medido: a
    // primeira versão desta fixtura tinha exit 1 e caía nessa armadilha.
    // Observado: com --json o erro sai no próprio JSONL, não no stderr, e o turno pode
    // falhar DEPOIS de já ter emitido a mensagem.
    jsonl: [
      '{"type":"item.completed","item":{"type":"agent_message","text":"ACHADO: P3 | d.ts:2 | parcial"}}',
      '{"type":"turn.failed","error":{"message":"sandbox denied"}}',
    ],
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
    id: 'kimi_preliminar',
    motor: 'kimi',
    exit: 0,
    // Observado em colheita real: a lente escreve mensagens preliminares ("agora vou
    // conferir X") ANTES da resposta. A regra do doc é "a última mensagem de assistente
    // com conteúdo"; um `select` sem `last` emite todas e o `tail -c` trunca a
    // concatenação — o preliminar entra no relatório como se fosse achado.
    jsonl: [
      '{"role":"assistant","content":"Agora vou conferir o contexto do repositorio:"}',
      '{"role":"assistant","content":null,"tool_calls":[{"name":"Read"}]}',
      '{"role":"assistant","content":"VEREDITO: sem-achado\\nRESPOSTA_FINAL_UNICA"}',
    ],
    err: '',
    esperaColhido: true,
    contem: 'RESPOSTA_FINAL_UNICA',
    naoContem: 'Agora vou conferir',
  },
  {
    id: 'kimi_exit0_sem_content',
    motor: 'kimi',
    exit: 0,
    // O caso do P1, ISOLADO: a lente terminou limpa (exit 0) e não deixou resposta.
    // Nenhuma outra fixtura tem exit 0 com texto vazio, então esta é a única que
    // condena a ausência de `[ -z "$texto" ]` na condição — sem ela, apagar a guarda
    // de texto deixaria a bateria inteira verde, que é o oposto do que este arquivo faz.
    jsonl: [
      '{"role":"meta","type":"system.version","content":"0.38.0"}',
      '{"role":"assistant","content":null,"tool_calls":[{"name":"Read"}]}',
    ],
    err: '',
    esperaColhido: false,
    contem: 'NÃO EXECUTADA',
  },
  {
    id: 'kimi_stack_trace',
    motor: 'kimi',
    exit: 1,
    // A quinta forma da tabela do doc: PROVIDER_TYPE inválido (ou `-m`) derruba o CLI
    // com um stack trace do Node cuja linha ÚTIL fica no TOPO. É o caso que motivou o
    // pipeline de diagnóstico (`grep … | head -2` antes do `tail -2`): um `tail` sozinho
    // devolveria o rodapé do stack e perderia o motivo.
    jsonl: ['{"role":"meta","type":"system.version","content":"0.38.0"}'],
    err: [
      "Error: Agent event 'agent.activity.updated' has no active lifecycle context",
      '    at Agent.emit (node:events:518:28)',
      '    at Module._compile (node:internal/modules/cjs/loader:1364:14)',
    ].join('\n'),
    esperaColhido: false,
    contem: 'lifecycle context',   // o motivo tem que sobreviver ao filtro de ruído
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
  // A âncora é `### <id>` seguido de espaço ou fim de linha — sem isso, um id que seja
  // PREFIXO de outro (`kimi` vs `kimi_ok`) casaria o cabeçalho errado e o teste mediria
  // a lente vizinha achando que mediu a certa.
  const fatia = (id) => {
    const re = new RegExp(`^### ${id}(?=[ \\n])`, 'm');
    const m = re.exec(saida);
    if (!m) return null;
    const resto = saida.slice(m.index + m[0].length);
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
    if (c.naoContem && f.includes(c.naoContem)) {
      falha(c.id, `a saída contém ${JSON.stringify(c.naoContem)} — o texto preliminar vazou para o relatório`);
      continue;
    }
    ok(`${c.id} → ${c.esperaColhido ? 'colhido' : 'não executada'} (${c.contem})`);
  }

  // O texto de uma lente NUNCA pode vazar para a fatia de outra — nos DOIS sentidos, e
  // com fatia não-vazia, senão a asserção passaria por ausência em vez de por isolamento.
  const fkimi = fatia('kimi_ok');
  const fcodex = fatia('codex_ok');
  if (!fkimi || !fcodex) falha('isolamento', 'uma das fatias veio vazia — a asserção passaria por ausência');
  else if (fkimi.includes('ACHADO: P1')) falha('isolamento', 'texto do Codex vazou para a fatia do Kimi');
  else if (fcodex.includes('ACHADO: P2')) falha('isolamento', 'texto do Kimi vazou para a fatia do Codex');
  else ok('cada lente colhe só o próprio arquivo (conferido nos dois sentidos)');
} finally {
  rmSync(OUT, { recursive: true, force: true });
}

console.log();
if (falhas === 0) { console.log('ok: a colheita do motor passou em todas as fixturas.'); process.exit(0); }
console.error(`FALHOU: ${falhas} caso(s).`);
process.exit(1);
