import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarSeAindaAtual } from './estudo-carga.js';

// #907 — duas cargas em voo; a do estudo 1 responde POR ÚLTIMO.
test('#907: resposta do estudo anterior, chegando depois, é descartada', async () => {
  const pendentes = new Map<number, (v: { id: number }) => void>();
  const buscar = (id: number) => new Promise<{ id: number }>((r) => pendentes.set(id, r));
  let atual = 1;
  const carga1 = carregarSeAindaAtual(1, buscar, () => atual);
  atual = 2; // troca rápida de estudo
  const carga2 = carregarSeAindaAtual(2, buscar, () => atual);
  pendentes.get(2)!({ id: 2 });
  pendentes.get(1)!({ id: 1 }); // a primeira responde por último
  assert.deepEqual(await carga2, { atual: true, resposta: { id: 2 } });
  assert.deepEqual(await carga1, { atual: false });
});

test('#907: recarga do mesmo estudo continua sendo aplicada', async () => {
  const r = await carregarSeAindaAtual(3, async (id) => ({ id }), () => 3);
  assert.deepEqual(r, { atual: true, resposta: { id: 3 } });
});

// Fiação (classe nº 1): o componente tem de usar a guarda.
test('#907: tela-estudo carrega o estudo pela guarda de corrida', () => {
  const f = readFileSync(new URL('./tela-estudo.ts', import.meta.url), 'utf8');
  assert.ok(f.includes('carregarSeAindaAtual(idPedido, buscarEstudo, () => this.estudoId)'));
  assert.ok(f.includes('if (!carga.atual) return;'));
});
