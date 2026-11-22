// #905: a exportação mostra o tipo (CSV, PDF da Proforma e PDF do Fluxo) e o status (PDF da Proforma)
// com os rótulos da tela, não os valores crus do banco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { csvProforma, htmlProforma, htmlFluxo, rotuloTipo, rotuloStatus } from './exportar.js';

const ESTUDO = { id: 1, nome: 'Estudo', tipo_empreendimento: 'incorporacao', status: 'em_analise' };

const PROFORMA: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  produtos: [{ nome: 'Apto', area_media_m2: 100, preco_venda_m2: 10_000, unidades: 10 } as any],
  imposto_percentual: 6, corretagem_percentual: 5,
  considerar_custo_terreno: true, custo_terreno_m2: 500, terreno_manual_area: 3_000,
};

const FLUXO: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, jurosTabelaAaEstudo: 0,
  cronograma: [
    { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
    { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
    { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  ],
  linhasReceita: [{
    id: 1, nome: 'Fase', fase_label: 'Fase',
    tipologias: [{ id: 11, nome: 'Apto', quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: { componentes: [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0, rotulo: 'à vista' }] },
  }],
  linhasCusto: [{ id: 2, grupo: 'obra', categoria: 'Obra', orcamento_valor: 3_000_000, orcamento_unidade: 'rs', inicio_mes: 17, duracao_meses: 24 }],
  areaTerreno: 0,
} as any;

test('#905 rotuloTipo/rotuloStatus: rótulo da tela; fora do mapa, o valor cru', () => {
  assert.equal(rotuloTipo('incorporacao'), 'Incorporação');
  assert.equal(rotuloTipo('loteamento'), 'Loteamento');
  assert.equal(rotuloStatus('em_analise'), 'Em análise');
  assert.equal(rotuloStatus('rascunho'), 'Rascunho');
  assert.equal(rotuloTipo('outro_tipo'), 'outro_tipo');
  assert.equal(rotuloStatus(null), '');
});

test('#905 CSV da Proforma: "Incorporação", não `incorporacao`', () => {
  const csv = csvProforma(ESTUDO, calcularProforma(PROFORMA), false);
  assert.match(csv, /^Tipo;Incorporação$/m);
  assert.doesNotMatch(csv, /incorporacao/);
});

test('#905 PDF da Proforma: "Incorporação · Em análise", sem os valores crus', () => {
  const html = htmlProforma(ESTUDO, calcularProforma(PROFORMA), false);
  assert.ok(html.includes('Incorporação · Em análise'), 'cabeçalho com os rótulos da tela');
  assert.doesNotMatch(html, /incorporacao|em_analise/);
});

test('#905 PDF do Fluxo: "Incorporação", sem o valor cru', () => {
  const html = htmlFluxo(ESTUDO, calcularFluxo(FLUXO), 'jan/2027', 'Proj', null, [], []);
  assert.ok(html.includes('Fluxo de Caixa (Avançado) · Incorporação ·'));
  assert.doesNotMatch(html, /incorporacao/);
});

test('#905 os números exportados não mudam com o rótulo', () => {
  const p = calcularProforma(PROFORMA);
  const comRotulo = csvProforma(ESTUDO, p, false).split('\n').slice(3).join('\n');
  const outroTipo = csvProforma({ ...ESTUDO, tipo_empreendimento: 'loteamento' }, p, false).split('\n').slice(3).join('\n');
  assert.equal(comRotulo, outroTipo, 'as linhas de números independem do rótulo do cabeçalho');
});
