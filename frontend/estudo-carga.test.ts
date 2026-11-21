import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SequenciaDeCargas } from './estudo-carga.js';

// Busca controlável: cada chamada fica pendente até o teste resolvê-la.
function busca() {
  const pend: Array<{ ok: (v: string) => void; ko: (e: unknown) => void }> = [];
  const fn = () => new Promise<string>((ok, ko) => { pend.push({ ok, ko }); });
  return { fn, pend };
}

test('#907: A→B, a resposta de A chegando por último é descartada', async () => {
  const s = new SequenciaDeCargas(); const b = busca();
  const a1 = s.carregar(b.fn); const b1 = s.carregar(b.fn);
  b.pend[1].ok('B'); b.pend[0].ok('A');
  assert.deepEqual(await b1, { ultimo: true, resposta: 'B' });
  assert.deepEqual(await a1, { ultimo: false });
});

test('#907: A→B→A, a primeira A respondendo por último não vence a segunda', async () => {
  const s = new SequenciaDeCargas(); const b = busca();
  const a1 = s.carregar(b.fn); const b1 = s.carregar(b.fn); const a2 = s.carregar(b.fn);
  b.pend[2].ok('A-nova'); b.pend[1].ok('B'); b.pend[0].ok('A-velha');
  assert.deepEqual(await a2, { ultimo: true, resposta: 'A-nova' });
  assert.deepEqual(await b1, { ultimo: false });
  assert.deepEqual(await a1, { ultimo: false });
});

test('#907: mesmo estudo recarregado duas vezes fora de ordem — vale a última', async () => {
  const s = new SequenciaDeCargas(); const b = busca();
  const r1 = s.carregar(b.fn); const r2 = s.carregar(b.fn);
  b.pend[1].ok('v2'); b.pend[0].ok('v1');
  assert.deepEqual(await r2, { ultimo: true, resposta: 'v2' });
  assert.deepEqual(await r1, { ultimo: false });
});

test('#907: erro de um pedido velho não é aplicado; o do último é', async () => {
  const s = new SequenciaDeCargas(); const b = busca();
  const r1 = s.carregar(b.fn); const r2 = s.carregar(b.fn);
  b.pend[0].ko(new Error('velho')); b.pend[1].ok('novo');
  assert.deepEqual(await r1, { ultimo: false });
  assert.deepEqual(await r2, { ultimo: true, resposta: 'novo' });
  const r3 = s.carregar(b.fn); b.pend[2].ko('x');
  assert.deepEqual(await r3, { ultimo: true, erro: 'x' });
});

test('#907: só o último pedido libera `carregando`', async () => {
  const s = new SequenciaDeCargas(); const b = busca();
  const r1 = s.carregar(b.fn); const r2 = s.carregar(b.fn);
  b.pend[0].ok('velho');
  assert.equal((await r1).ultimo, false);   // não libera a tela
  b.pend[1].ok('novo');
  assert.equal((await r2).ultimo, true);    // só este libera
});

// Fiação (classe nº 1): o componente tem de passar pela sequência.
test('#907: tela-estudo carrega pela sequência e sai se não for o último', () => {
  const f = readFileSync(new URL('./tela-estudo.ts', import.meta.url), 'utf8');
  assert.ok(f.includes('this._cargas.carregar(() => buscarEstudo(id))'));
  assert.ok(f.includes('if (!carga.ultimo) return;'));
});
