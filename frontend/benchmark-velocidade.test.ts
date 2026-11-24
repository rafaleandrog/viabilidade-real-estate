// #971: o benchmark de sensibilidade `velocidade` (velocidade de vendas dos
// Cenários do Avançado) é sensibilidade nas três pontas: na tela de
// configuração (seção de sensibilidade, com rótulo), na leitura dos medidores
// (descartado com o motivo de sensibilidade, não o genérico) e na faixa do
// controle de Cenários.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverIndicadoresBenchmark } from './benchmarks-indicadores.js';
import { faixaDaVelocidade } from './cenarios-padrao.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('#971 medidores: `velocidade` é descartado como sensibilidade, sem meta', () => {
  const { exibiveis, descartados } = resolverIndicadoresBenchmark([{ campo: 'velocidade', valor: 0 }], {});
  assert.equal(exibiveis.length, 0);
  assert.equal(descartados.length, 1);
  assert.match(descartados[0].motivo, /sensibilidade/);
  assert.match(descartados[0].motivo, /sem meta/);
});

test('#971 tela de benchmarks: `velocidade` cai na seção de sensibilidade, com o rótulo "Velocidade de vendas"', () => {
  // A tela é um LitElement (não importável sem DOM): confere-se a declaração.
  const tela = readFileSync(join(RAIZ, 'frontend/viabilidade-config-benchmarks.ts'), 'utf8');
  const sens = tela.match(/export const CAMPOS_SENS = new Set\(\[([^\]]*)\]\)/);
  assert.ok(sens, 'CAMPOS_SENS sumiu');
  assert.match(sens![1], /'velocidade'/);
  assert.match(tela, /velocidade: 'Velocidade de vendas',/);
});

test('#971 cenários: o benchmark `velocidade` dá a faixa do controle', () => {
  const bm = [{ campo: 'velocidade', variacao_positiva_pct: 20, variacao_negativa_pct: 10 }];
  assert.deepEqual(faixaDaVelocidade(bm), { min: -10, max: 20 });
});

// Achado P2 do App do Codex (PR 978): numa instalação que já tinha benchmarks,
// o auto-semear (só com a lista vazia) nunca criava `velocidade`.
import { semeaduraNecessaria } from './benchmarks-semeadura.js';

test('#971 semeadura: lista vazia semeia tudo; lista sem `velocidade` semeia só ela; completa, nada', () => {
  assert.deepEqual(semeaduraNecessaria([]), {});
  assert.deepEqual(semeaduraNecessaria([{ campo: 'preco' }, { campo: 'roi' }]), { campos: ['velocidade'] });
  assert.equal(semeaduraNecessaria([{ campo: 'preco' }, { campo: 'velocidade' }]), null);
});

test('#971 semeadura: a tela de benchmarks usa a função e passa os campos ao semear', () => {
  const tela = readFileSync(join(RAIZ, 'frontend/viabilidade-config-benchmarks.ts'), 'utf8');
  assert.match(tela, /const semeadura = semeaduraNecessaria\(itens\);/);
  assert.match(tela, /if \(semeadura && !this\.somenteLeitura && !this\._semeadoTentado\)/);
  assert.match(tela, /await semearBenchmarks\(semeadura\.campos\);/);
  const api = readFileSync(join(RAIZ, 'frontend/viabilidade-api.ts'), 'utf8');
  assert.match(api, /body: JSON\.stringify\(\{ campos \}\)/);
});
