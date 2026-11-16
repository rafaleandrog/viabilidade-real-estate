import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tipologiasDestinoAlocacao, camposDoServidorNaAlocacao } from './fluxo-shared.js';

// O seletor de tipologia de uma alocação só oferece destino que o servidor
// aceita na troca (saldo do destino no estudo inteiro > 0 e >= unidades da
// alocação), e a resposta atrasada de uma troca não desfaz preço digitado.

const TIPS = [
  { id: 1, nome: 'A', quantidade: 10 },
  { id: 2, nome: 'B', quantidade: 5 },   // saldo 5 − 2 = 3
  { id: 3, nome: 'C', quantidade: 4 },   // saldo 4 − 4 = 0
  { id: 4, nome: 'D', quantidade: 8 },   // saldo 8
];
const FASES = [
  { id: 10, alocacoes: [{ id: 100, tipologia_id: 1, unidades: 6 }, { id: 101, tipologia_id: 2, unidades: 2 }] },
  { id: 11, alocacoes: [{ id: 102, tipologia_id: 3, unidades: 4 }] },
];
const ids = (xs: any[]) => xs.map((t) => t.id);

test('destino com saldo menor que as unidades da alocação não é oferecido', () => {
  // alocação 100: 6 unidades de A. B tem saldo 3 (< 6), C nenhum, D 8.
  assert.deepEqual(ids(tipologiasDestinoAlocacao(FASES, TIPS, FASES[0].alocacoes[0])), [1, 4]);
});

test('destino com saldo que comporta as unidades é oferecido; saldo zero nunca', () => {
  // alocação 101: 2 unidades de B. A tem saldo 4, C 0, D 8.
  assert.deepEqual(ids(tipologiasDestinoAlocacao(FASES, TIPS, FASES[0].alocacoes[1])), [1, 2, 4]);
});

test('a tipologia atual sempre aparece, mesmo sem saldo', () => {
  // alocação 102: 4 unidades de C, a atual. A tem saldo 4, B 3 (< 4), D 8.
  assert.deepEqual(ids(tipologiasDestinoAlocacao(FASES, TIPS, FASES[1].alocacoes[0])), [1, 3, 4]);
});

test('alocação com 0 unidades: destino sem saldo segue fora (SALDO_ESGOTADO no servidor)', () => {
  const fases = [{ id: 10, alocacoes: [...FASES[0].alocacoes, { id: 103, tipologia_id: 4, unidades: 0 }] }, FASES[1]];
  assert.deepEqual(ids(tipologiasDestinoAlocacao(fases, TIPS, fases[0].alocacoes[2])), [1, 2, 4]);
});

test('resposta da troca aplica o preço do destino só sem edição de preço depois', () => {
  assert.deepEqual(camposDoServidorNaAlocacao({ tipologia_id: 2 }, { preco_m2: 9000 }, false), { preco_m2: 9000 });
  assert.deepEqual(camposDoServidorNaAlocacao({ tipologia_id: 2 }, { preco_m2: 9000 }, true), {});
  assert.deepEqual(camposDoServidorNaAlocacao({ unidades: 3 }, { preco_m2: 9000 }, false), {});
});

test('fiação: a tela usa as duas funções, recria o seletor depois de erro e conta edições de preço', () => {
  const raiz = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const src = readFileSync(`${raiz}/frontend/tela-fluxo-receitas.ts`, 'utf8');
  assert.match(src, /const opcoes = tipologiasDestinoAlocacao\(this\.fases, this\.tipologias, a\)/);
  assert.match(src, /keyed\(`\$\{a\.id\}:\$\{this\._versaoAloc\}`, html`<urbi-select/);
  assert.equal((src.match(/this\._versaoAloc\+\+/g) ?? []).length, 2, 'erro de resposta e exceção sobem a versão');
  assert.match(src, /camposDoServidorNaAlocacao\(dados, res, \(this\._edicoesPreco\.get\(id\) \?\? 0\) !== edicoesAntes\)/);
  assert.match(src, /if \(dados\.preco_m2 !== undefined\) this\._edicoesPreco\.set\(id,/);
});
