import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { fmtR$Milhoes } from './viab-format.js';

// ─────────────────────────────────────────────────────────────────────────────
// A SEGUNDA exceção ao contrato C7 é localizada, e este arquivo é a trava dela
// ─────────────────────────────────────────────────────────────────────────────
//
// Pedido do autor: a cascata do resultado publica valores em MILHÕES, com uma
// casa ("R$ 26,5"). Tudo o mais — persistência, entrada, motor, tabelas,
// Proforma, Fluxo de Caixa, exportação e os cards de KPI (que têm a SUA própria
// exceção, `fmtR$Kpi`/#581) — fica como está (`CLAUDE.md` § Contratos
// inegociáveis).
//
// ⚠️ POR QUE UM TESTE QUE LÊ O FONTE, e não só um teste da função pura.
// `fmtR$Milhoes` é trivial, e um teste dela prova apenas que ela divide por um
// milhão. O que precisa ser garantido é uma propriedade do INVENTÁRIO: que a
// abreviação valha na cascata e em NENHUM outro lugar. Isso é fiação, e é a
// classe de defeito nº 1 do `CLAUDE.md` — apagar a chamada no componente deixa
// a suíte inteira verde, e o harness de render não alcança (o `exigir` de
// `scripts/render-check.mjs` só aceita `{seletor, minimo}`, nunca texto).
//
// A lista fecha nos DOIS sentidos, por CONTAGEM EXATA e não por presença:
// chamada a menos (alguém reverteu o rótulo para `fmtR$`) e chamada a mais
// (alguém vazou a abreviação para uma tabela) reprovam igual.

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const fonte = (relativo: string) => readFileSync(join(RAIZ, relativo), 'utf8');

// Mesma normalização de `frontend/kpi-casas-decimais.test.ts`: contar substring
// crua deixaria um comentário citando `fmtR$Milhoes(` compensar a reversão de um
// call site real, e a contagem exata viraria decoração.
const semComentarios = (texto: string) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([^:'"`])\/\/.*$/gm, '$1');

const ocorrencias = (texto: string, alvo: string) => semComentarios(texto).split(alvo).length - 1;

/** O único consumidor da exceção, e quantas vezes ele a chama. */
const CONSUMIDOR = { arquivo: 'frontend/grafico-cascata.ts', chamadas: 1 };

// ⚠️ Enumerar por `git ls-files` e não varrendo o disco: o passo `Build` do
// `validation.yml` gera `backend/rotas.js` antes dos testes, e um inventário que
// varre o diretório enxerga artefato que só existe no runner (armadilha 1 da
// Rodada 10 — 1 falha de 953 no CI, verde local em três execuções).
const fontesVersionadas = (): string[] =>
  execFileSync('git', ['ls-files', 'frontend'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.ts'));

test('a exceção de milhões é chamada EXATAMENTE onde deve, por contagem', () => {
  assert.equal(
    ocorrencias(fonte(CONSUMIDOR.arquivo), 'fmtR$Milhoes('),
    CONSUMIDOR.chamadas,
    `${CONSUMIDOR.arquivo} deveria chamar fmtR$Milhoes ${CONSUMIDOR.chamadas}× — `
    + 'a menos significa que o rótulo da barra voltou a `fmtR$`; a mais, que a '
    + 'abreviação ganhou um call site novo sem passar por aqui',
  );
});

test('a exceção de milhões NÃO vazou para nenhum outro arquivo do frontend', () => {
  const excecoes = new Set([
    CONSUMIDOR.arquivo,
    'frontend/viab-format.ts',        // a definição
    'frontend/cascata-milhoes.test.ts', // esta trava
    'frontend/viab-format.test.ts',   // o teste da função pura
  ]);
  const vazamentos = fontesVersionadas()
    .filter((f) => !excecoes.has(f))
    .filter((f) => ocorrencias(fonte(f), 'fmtR$Milhoes') > 0);
  assert.deepEqual(
    vazamentos, [],
    'a abreviação em milhões vale SÓ no rótulo de barra da cascata — '
    + 'tabela, Proforma, Fluxo de Caixa e exportação seguem em 2 casas (C7)',
  );
});

test('o inventário aponta para arquivos que existem', () => {
  // Sem isto, renomear `grafico-cascata.ts` deixaria a trava verde contra um
  // arquivo fantasma — a contagem de um arquivo inexistente nunca é conferida
  // porque `fonte()` estouraria... e só estoura se alguém rodar o teste. Aqui
  // o erro é explícito.
  assert.ok(
    fontesVersionadas().includes(CONSUMIDOR.arquivo),
    `${CONSUMIDOR.arquivo} não está versionado — o inventário desta trava envelheceu`,
  );
});

test('fmtR$Milhoes nunca publica zero negativo', () => {
  // Entre -R$ 50.000 (exclusivo) e R$ 0 o Intl arredonda a fração fora mas
  // preserva o sinal; sem a normalização a barra publicaria "-R$ 0,0".
  assert.equal(fmtR$Milhoes(-10_000).includes('-'), false);
  assert.equal(fmtR$Milhoes(-49_999).includes('-'), false);
  // E a fronteira legítima continua negativa.
  assert.equal(fmtR$Milhoes(-60_000).includes('-'), true);
});
