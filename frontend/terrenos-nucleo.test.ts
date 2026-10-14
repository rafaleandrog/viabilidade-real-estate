import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coletarPaginas, idsParcelamentosRegularizacao, loteForaDaRegularizacao,
} from './terrenos-nucleo.js';

test('idsParcelamentosRegularizacao: só regularizacao verdadeira; ausente/falsa fica fora', () => {
  const parc = [
    { id: 10, regularizacao: true },
    { id: 11, regularizacao: false },
    { id: 12, regularizacao: null },
    { id: 13 },
    { id: 14, regularizacao: 'true' },
    { id: 15, regularizacao: 'false' },
    { id: 16, regularizacao: 1, setor_habitacional_id: 3 },
    { id: 17, regularizacao: false, setor_habitacional_id: 3 },
  ];
  assert.deepEqual([...idsParcelamentosRegularizacao(parc)].sort(), [10, 14, 16]);
  assert.equal(idsParcelamentosRegularizacao([]).size, 0);
});

test('loteForaDaRegularizacao: entra o que não é regularização, inclusive sem parcelamento', () => {
  const reg = new Set([10]);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: 10 }, reg), false);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: '10' }, reg), false);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: 11 }, reg), true);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: null }, reg), true);
  assert.equal(loteForaDaRegularizacao({}, reg), true);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: 10 }, new Set()), true, 'nenhum parcelamento de regularização');
});

test('loteForaDaRegularizacao é fail-closed: sem conjunto resolvido nenhum lote passa', () => {
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: 11 }, null), false);
  assert.equal(loteForaDaRegularizacao({ parcelamento_id: null }, null), false);
  assert.equal(loteForaDaRegularizacao({}, null), false);
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
