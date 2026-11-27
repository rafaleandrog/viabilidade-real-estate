import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fmtR$Mi } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────────
// A QUARTA exceção ao contrato C7 é localizada, e este arquivo é a trava dela
// ─────────────────────────────────────────────────────────────────────────────
//
// Decisão do dono para o Funding: os cartões de operação e a aba Estrutura de
// capital mostram valores em R$ milhões, com uma casa ("R$ 20,1 mi"). A página
// da operação, as tabelas, o Fluxo de Caixa e a exportação seguem em reais
// cheios, com 2 casas (`CLAUDE.md` § Contratos inegociáveis).
//
// Mesmo desenho das travas de `kpi-casas-decimais.test.ts` e
// `cascata-milhoes.test.ts`: o que precisa ser garantido é uma propriedade do
// INVENTÁRIO — a abreviação vale nos consumidores declarados e em nenhum outro
// lugar —, por CONTAGEM EXATA, que fecha nos dois sentidos.
//
// ⚠️ O símbolo é prefixo de `fmtR$Milhoes`, o formatador da cascata. Por isso a
// conta de call site procura `fmtR$Mi(` (com o parêntese), e a de vazamento usa
// uma fronteira que não aceita letra, dígito, `_` nem `$` depois do nome.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');

// Mesma normalização das outras travas: um comentário citando o símbolo não
// pode compensar a reversão de um call site real.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');
const chamadas = (texto: string) => semComentarios(texto).split('fmtR$Mi(').length - 1;
const mencoes = (texto: string) => (semComentarios(texto).match(/fmtR\$Mi(?![A-Za-z0-9_$])/g) ?? []).length;

/**
 * Os consumidores da exceção, e quantas vezes cada um a chama. Os cartões de
 * operação montam todo valor em reais por um único ponto (`valorEmReais()`,
 * que põe o exato em 2 casas no título); os totais e a tabela da sequência da
 * aba Estrutura de capital usam o MESMO ponto (por `funding-estrutura-dados.ts`,
 * que não chama o formatador direto), e a torre da aba escreve o valor de
 * cada camada com uma chamada própria, com o exato no título e no nome
 * acessível.
 */
const CONSUMIDORES: { arquivo: string; chamadas: number }[] = [
  { arquivo: 'frontend/funding-cartao-dados.ts', chamadas: 1 },
  { arquivo: 'frontend/grafico-stack-capital.ts', chamadas: 1 },
];

/** Onde o símbolo PODE aparecer sem ser um call site de exibição. */
const EXCECOES = [
  'frontend/viab-format.ts',        // a declaração
  'frontend/funding-milhoes.test.ts', // esta trava, que também testa os valores
];

const fontesVersionadas = (): string[] =>
  execFileSync('git', ['ls-files', 'frontend'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts'));

test('a exceção "R$ mi" é chamada EXATAMENTE onde deve, por contagem', () => {
  for (const c of CONSUMIDORES) {
    assert.equal(chamadas(fonte(c.arquivo)), c.chamadas, `${c.arquivo} deveria chamar fmtR$Mi ${c.chamadas}×`);
  }
});

test('em viab-format.ts o símbolo aparece uma vez: a declaração', () => {
  const texto = fonte('frontend/viab-format.ts');
  assert.equal(chamadas(texto), 1);
  assert.equal(mencoes(texto), 1);
  assert.match(semComentarios(texto), /export function fmtR\$Mi\(/);
});

test('a exceção "R$ mi" NÃO vazou para nenhum outro arquivo do frontend', () => {
  const excecoes = new Set([...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES]);
  const vazamentos = fontesVersionadas()
    .filter((f) => !excecoes.has(f))
    .filter((f) => mencoes(fonte(f)) > 0);
  assert.deepEqual(
    vazamentos, [],
    'o valor em milhões com sufixo "mi" vale só nos consumidores declarados em CONSUMIDORES — '
    + 'página da operação, tabelas, Fluxo de Caixa e exportação seguem em 2 casas (C7)',
  );
});

test('todo caminho do inventário está versionado e toda exceção ainda é necessária', () => {
  const versionadas = new Set(fontesVersionadas());
  const orfaos = [...CONSUMIDORES.map((c) => c.arquivo), ...EXCECOES].filter((f) => !versionadas.has(f));
  assert.deepEqual(orfaos, [], 'caminho do inventário que não está versionado');
  assert.deepEqual(EXCECOES.filter((f) => mencoes(fonte(f)) === 0), [], 'exceção que não cita mais o símbolo');
});

// ── Valores ──────────────────────────────────────────────────────────────

/** O Intl separa "R$" do número com espaço não separável; o formatador faz o mesmo antes de "mi". */
const norm = (s: string) => s.replace(/ /g, ' ');

test('fmtR$Mi: positivo, negativo, zero e bilhão', () => {
  assert.equal(norm(fmtR$Mi(20_100_000)), 'R$ 20,1 mi');
  assert.equal(norm(fmtR$Mi(-20_100_000)), '-R$ 20,1 mi');
  assert.equal(norm(fmtR$Mi(0)), 'R$ 0,0 mi');
  assert.equal(norm(fmtR$Mi(1_234_500_000)), 'R$ 1.234,5 mi');
  assert.equal(norm(fmtR$Mi(12_345_678_900)), 'R$ 12.345,7 mi');
});

test('fmtR$Mi: fronteira do zero, sem zero negativo', () => {
  assert.equal(norm(fmtR$Mi(49_999)), 'R$ 0,0 mi');
  assert.equal(norm(fmtR$Mi(-49_999)), 'R$ 0,0 mi');
  assert.equal(norm(fmtR$Mi(50_000)), 'R$ 0,1 mi');
  assert.equal(norm(fmtR$Mi(-50_000)), '-R$ 0,1 mi');
  assert.equal(norm(fmtR$Mi(-0)), 'R$ 0,0 mi');
});

test('fmtR$Mi: não finito sai "—", nunca zero', () => {
  assert.equal(fmtR$Mi(Number.NaN), '—');
  assert.equal(fmtR$Mi(Number.POSITIVE_INFINITY), '—');
  assert.equal(fmtR$Mi(Number.NEGATIVE_INFINITY), '—');
});
