import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// A TERCEIRA exceção ao contrato C7 é localizada, e este arquivo é a trava dela
// ─────────────────────────────────────────────────────────────────────────────
//
// Pedido do autor (#754, 2026-09-18): a coluna R$ da PROFORMA — Preliminar e
// Avançado, tela, tabela de sensibilidade, CSV e PDF — sai em INTEIROS. Tudo o
// mais (persistência, entrada, motor, Fluxo de Caixa, as demais tabelas, os
// textos de detalhe do card, os cards de KPI com a SUA exceção `fmtR$Kpi`, e o
// rótulo da cascata com a SUA `fmtR$Milhoes`) fica em 2 casas (`CLAUDE.md`
// § Contratos inegociáveis).
//
// Mesmo desenho de `frontend/cascata-milhoes.test.ts`, pelo mesmo motivo: a
// função `celulaInteira` é trivial, e um teste dela prova só que arredonda. O
// que precisa ser garantido é uma propriedade do INVENTÁRIO — que a exceção
// valha nos três consumidores da Proforma e em NENHUM outro lugar. Isso é
// fiação (classe de defeito nº 1 do `CLAUDE.md`): apagar uma chamada deixa a
// suíte inteira verde, e o harness de render não lê texto.
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA: chamada a menos (alguém
// devolveu a Proforma a `celula`, 2 casas) e chamada a mais (a exceção vazou
// para o Fluxo de Caixa ou para outra tabela) reprovam igual.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');

// Mesma normalização de `kpi-casas-decimais.test.ts` e `cascata-milhoes.test.ts`.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ocorrencias = (texto: string, alvo: string) => semComentarios(texto).split(alvo).length - 1;

/**
 * Os consumidores da exceção, e quantas vezes cada um a chama.
 *
 * · `exportar.ts` — `celulaProforma`: a coluna R$ da Proforma do Preliminar na
 *   tela (a tela a reexporta), na tabela de sensibilidade (`celulaSensibilidade`
 *   delega para ela), no CSV e no PDF — UMA chamada serve as quatro superfícies.
 * · `tela-fluxo-ver.ts` — `_renderProforma`, a Proforma do Avançado. As outras
 *   duas tabelas do arquivo ("Fluxo de Caixa Livre × Fluxo de Caixa" e "ROI do
 *   projeto") NÃO são a Proforma e seguem em `fmtR$`.
 * · `viab-format.ts` — a declaração.
 */
const CONSUMIDORES: { arquivo: string; chamadas: number }[] = [
  { arquivo: 'frontend/exportar.ts', chamadas: 1 },
  { arquivo: 'frontend/tela-fluxo-ver.ts', chamadas: 1 },
  { arquivo: 'frontend/viab-format.ts', chamadas: 1 },
];

// Enumerar por `git ls-files`, nunca varrendo o disco (armadilha 1 da Rodada 10).
const fontesVersionadas = (): string[] =>
  execFileSync('git', ['ls-files', 'frontend'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts'));

test('#754: a exceção de inteiros é chamada EXATAMENTE onde deve, por contagem', () => {
  for (const { arquivo, chamadas } of CONSUMIDORES) {
    assert.equal(
      ocorrencias(fonte(arquivo), 'celulaInteira('), chamadas,
      `${arquivo} deveria chamar celulaInteira ${chamadas}× — a menos significa que a coluna R$ `
      + 'da Proforma voltou a 2 casas (`celula`); a mais, que a exceção ganhou um call site novo '
      + 'sem passar por aqui',
    );
  }
});

// Rede de node contra a reversão que ACRESCENTA uma chamada de 2 casas onde a
// Proforma vive: `celulaProforma` não pode voltar a chamar `celula`, e a
// `_renderProforma` do Avançado também não. `exportar.ts` continua chamando
// `celulaCompartilhada` (= `celula`) UMA vez, em `celulaFx` (Fluxo de Caixa);
// `tela-fluxo-ver.ts` deixa de chamar `celula(` de vez.
const CHAMADAS_CELULA: { arquivo: string; alvo: string; chamadas: number; onde: string }[] = [
  { arquivo: 'frontend/exportar.ts', alvo: 'celulaCompartilhada(', chamadas: 1, onde: '`celulaFx` (CSV/PDF do Fluxo de Caixa)' },
  { arquivo: 'frontend/tela-fluxo-ver.ts', alvo: 'celula(', chamadas: 0, onde: 'nenhum — a Proforma do Avançado usa `celulaInteira`' },
];

test('#754: a Proforma NÃO voltou a `celula` (2 casas) — rede sempre ligada, sem navegador', () => {
  for (const { arquivo, alvo, chamadas, onde } of CHAMADAS_CELULA) {
    assert.equal(
      ocorrencias(fonte(arquivo), alvo), chamadas,
      `${arquivo} deveria chamar ${alvo} ${chamadas}× (${onde}). Divergiu: ou a Proforma voltou `
      + 'a 2 casas, ou entrou um uso novo e legítimo — nos dois o certo é decidir aqui',
    );
  }
});

/** Onde o símbolo PODE aparecer sem ser um call site de exibição. */
const EXCECOES = [
  'frontend/proforma-inteiros.test.ts', // esta trava
  'frontend/viab-format.test.ts',       // o teste da função pura
  'frontend/kpi-casas-decimais.test.ts', // cita o símbolo nos MOTIVOS das entradas de zero (string, não comentário)
  'frontend/proforma-cores.test.ts',     // confronta a classe `pos`/`neg` com o TEXTO que `celulaInteira` publica (não formata célula)
];

test('#754: a exceção de inteiros NÃO vazou para nenhum outro arquivo do frontend', () => {
  const permitidos = new Set([...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES]);
  const vazamentos = fontesVersionadas()
    .filter((f) => !permitidos.has(f))
    .filter((f) => ocorrencias(fonte(f), 'celulaInteira') > 0);
  assert.deepEqual(
    vazamentos, [],
    'a formatação em inteiros vale SÓ na coluna R$ da Proforma — Fluxo de Caixa, demais tabelas, '
    + 'cards e cascata seguem cada um com a sua regra (C7 e as duas exceções anteriores)',
  );
});

test('#754: todo caminho do inventário aponta para arquivo versionado, e nenhuma exceção é cega', () => {
  const versionadas = new Set(fontesVersionadas());
  const todos = [...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES];
  assert.deepEqual(todos.filter((f) => !versionadas.has(f)), [],
    'caminho do inventário que não está mais versionado — exceção cega ou consumidor renomeado');
  const desnecessarias = EXCECOES.filter((f) => ocorrencias(fonte(f), 'celulaInteira') === 0);
  assert.deepEqual(desnecessarias, [],
    'exceção que não é mais necessária — o arquivo não cita mais `celulaInteira`, e mantê-la na '
    + 'lista desliga a conferência dele para sempre');
});
