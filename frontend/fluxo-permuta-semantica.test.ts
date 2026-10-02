import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { validarProduto } from './fluxo-invariantes.js';
import type { EventoCrono } from './fluxo-shared.js';

// #792 — semântica da permuta física, decisão do autor pela opção (b): as
// unidades permutadas são PARTE das alocadas. O motor já as lia assim
// (`reservarPermutasFisicas` reserva de dentro das alocações de Receitas); o
// backend e as invariantes as liam como ADICIONAIS, e a tela só deixava alocar
// `catálogo − permutadas`, sobre as quais o motor tirava as permutadas de novo.
// Estes testes são os da issue, ajustados à opção (b): o motor não muda; o
// estado B (catálogo inteiro alocado, parte permutada) passa a ser aceito.

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];
const permuta = [{ id: 1, grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física',
  permuta_tipologia_id: 1, permuta_quantidade: 20, orcamento_valor: null }];
const catalogo = [{ id: 1, nome: 'Studio', quantidade: 200, area_privativa_m2: 25 }];
const config = (alocadas: number): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
  linhasReceita: [{ id: 1, nome: 'G', fase_label: 'G',
    tipologias: [{ id: 1, tipologia_id: 1, nome: 'Studio', quantidade: alocadas, area_privativa_m2: 25, preco_m2: 12_000 }],
    absorcao: { modo: 'distribuido', blocos: [{ evento: 'lancamento', pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }] } }],
  linhasCusto: permuta, areaTerreno: 1000,
} as FluxoConfig);
const produto = (alocadas: number) =>
  validarProduto(config(alocadas).linhasReceita as any[], permuta as any[], catalogo as any[], CRONO, 60);
const codigos = (alocadas: number, codigo: string) => produto(alocadas).filter((d) => d.codigo === codigo);

test('#792 1 — (b) estado B: catálogo 200 = 200 alocadas, 20 delas permutadas, é aceito sem erro nenhum', () => {
  assert.deepEqual(produto(200).filter((d) => d.severidade === 'erro'), []);
  assert.deepEqual(codigos(200, 'PRODUTO_SUBALOCADO'), []);
});

test('#792 2 — o motor não muda: 200 alocadas com 20 permutadas rendem 180 vendáveis', () => {
  const calc = calcularFluxo(config(200));
  assert.equal(calc.vgvTotal, 200 * 25 * 12_000);
  assert.equal(calc.vgvPermutaFisica, 20 * 25 * 12_000);
  assert.equal(calc.vgvVendavel, 180 * 25 * 12_000);
});

test('#792 3 — estado A (regra antiga, 180 + 20 = 200) calcula igual e passa a mostrar PRODUTO_SUBALOCADO (alerta) de 20', () => {
  assert.equal(calcularFluxo(config(180)).vgvVendavel, 160 * 25 * 12_000);
  const sub = codigos(180, 'PRODUTO_SUBALOCADO');
  assert.equal(sub.length, 1);
  assert.equal(sub[0].severidade, 'alerta');
  assert.equal(sub[0].diferenca, 20);
  assert.deepEqual(produto(180).filter((d) => d.severidade === 'erro'), []);
});

test('#792 4 — o catálogo continua o teto: 201 alocadas é PRODUTO_EXCEDE_ESTOQUE', () => {
  assert.equal(codigos(201, 'PRODUTO_EXCEDE_ESTOQUE').length, 1);
  assert.deepEqual(codigos(200, 'PRODUTO_EXCEDE_ESTOQUE'), []);
});
