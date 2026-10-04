import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coletarPaginas, idsSetoresUrbita, idsParcelamentosDosSetores, loteDoSetor, normalizarTexto,
} from './terrenos-setor.js';

const SETORES = [
  { id: 1, slug: 'sol-nascente', nome: 'Sol Nascente' },
  { id: 2, slug: 'urbita', nome: null },
  { id: 3, slug: 'sh-3', nome: 'Setor Habitacional Urbitá' },
];

test('normalizarTexto tira acento e caixa', () => {
  assert.equal(normalizarTexto('  URBITÁ '), 'urbita');
  assert.equal(normalizarTexto(null), '');
});

test('idsSetoresUrbita casa por slug OU nome, sem acento nem caixa', () => {
  assert.deepEqual([...idsSetoresUrbita(SETORES)].sort(), [2, 3]);
  assert.equal(idsSetoresUrbita([{ id: 9, slug: 'outro', nome: 'Outro' }]).size, 0);
  assert.equal(idsSetoresUrbita([]).size, 0);
});

test('idsParcelamentosDosSetores: só parcelamento ligado ao setor; setor nulo fica fora', () => {
  const parc = [
    { id: 10, setor_habitacional_id: 2 },
    { id: 11, setor_habitacional_id: 1 },
    { id: 12, setor_habitacional_id: null },
    { id: 13 },
    { id: 14, setor_habitacional_id: '3' },
  ];
  assert.deepEqual([...idsParcelamentosDosSetores(parc, new Set([2, 3]))].sort(), [10, 14]);
});

test('loteDoSetor é fail-closed: sem conjunto resolvido nenhum lote passa', () => {
  const ids = new Set([10]);
  assert.equal(loteDoSetor({ parcelamento_id: 10 }, ids), true);
  assert.equal(loteDoSetor({ parcelamento_id: '10' }, ids), true);
  assert.equal(loteDoSetor({ parcelamento_id: 11 }, ids), false);
  assert.equal(loteDoSetor({ parcelamento_id: null }, ids), false);
  assert.equal(loteDoSetor({}, ids), false);
  assert.equal(loteDoSetor({ parcelamento_id: 10 }, null), false);
  assert.equal(loteDoSetor({ parcelamento_id: 10 }, new Set()), false);
});

test('coletarPaginas acumula até a página vir incompleta ou acabar `paginas`', async () => {
  const pedidas: number[] = [];
  const cheia = (n: number) => Array.from({ length: 2 }, (_, i) => ({ id: n * 10 + i }));
  const r = await coletarPaginas(async (p) => {
    pedidas.push(p);
    return p < 3 ? { dados: cheia(p), paginas: 3 } : { dados: [{ id: 99 }], paginas: 3 };
  }, 2);
  assert.deepEqual(pedidas, [1, 2, 3]);
  assert.equal(r.length, 5);

  // `paginas` corta mesmo com página cheia.
  const cortadas: number[] = [];
  await coletarPaginas(async (p) => { cortadas.push(p); return { dados: cheia(p), paginas: 1 }; }, 2);
  assert.deepEqual(cortadas, [1]);

  // Resposta sem `dados` não quebra.
  assert.deepEqual(await coletarPaginas(async () => ({}), 2), []);
});

test('coletarPaginas: `paginas` manda — página curta por teto de servidor menor NÃO encerra a coleta', async () => {
  const pedidas: number[] = [];
  // Servidor clampeia em 2 por página (o pedido foi 200): 3 páginas, a última com 1 item.
  const r = await coletarPaginas(async (p) => {
    pedidas.push(p);
    return { dados: p < 3 ? [{ id: p * 10 }, { id: p * 10 + 1 }] : [{ id: 99 }], paginas: 3 };
  }, 200);
  assert.deepEqual(pedidas, [1, 2, 3]);
  assert.equal(r.length, 5);
});

test('coletarPaginas: sem `paginas`, página incompleta encerra; cheia continua; vazia sempre encerra', async () => {
  const a: number[] = [];
  await coletarPaginas(async (p) => { a.push(p); return { dados: p === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] }; }, 2);
  assert.deepEqual(a, [1, 2], 'cheia (2) continua; incompleta (1) encerra');

  const b: number[] = [];
  await coletarPaginas(async (p) => { b.push(p); return { dados: p < 3 ? [{ id: p }, { id: p + 10 }] : [] }; }, 2);
  assert.deepEqual(b, [1, 2, 3], 'página vazia encerra mesmo sem `paginas`');

  const c: number[] = [];
  await coletarPaginas(async (p) => { c.push(p); return { dados: [], paginas: 9 }; }, 2);
  assert.deepEqual(c, [1], 'vazia encerra mesmo quando `paginas` promete mais');
});
