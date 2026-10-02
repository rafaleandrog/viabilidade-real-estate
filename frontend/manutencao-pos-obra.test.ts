// Categoria canônica "Manutenção pós-obra" (grupo `diretos`) no Avançado.
//
// Duas metades, porque o defeito pode morar em qualquer uma:
//  1. a PROFORMA: a linha sai com o nome certo e na posição pedida (depois de
//     Decoração, antes de Despesas Financeiras), nunca como "Outro";
//  2. a FIAÇÃO da tela: escolher a categoria na aba Custos grava o evento
//     Pós-obras. Apagar a atribuição em `_salvarCategoria` deixa a metade 1
//     verde — só esta a enxerga.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { proformaAvancado } from './proforma-avancado.js';
import { CATEGORIA_MANUTENCAO_POS_OBRA } from './fluxo-shared.js';

const { ViabFluxoCustos } = await import('./tela-fluxo-custos.js');

const CRONO = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 6, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 7, duracao_meses: 12 },
  { evento: 'pos_obra', inicio_mes: 19, duracao_meses: 24 },
];

const config = (custos: any[]): FluxoConfig => ({
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
  linhasCusto: custos, areaTerreno: 5_000,
  linhasReceita: [{
    id: 1, nome: 'Torre', fase_label: 'lancamento',
    tipologias: [{ id: 10, nome: 'Torre · tipologia', quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: { entrada: [{ pct: 100, parcelas: 1, descontoPct: 0 }] },
  }] as any,
});

const custo = (id: number, grupo: string, categoria: string, valor: number, extra: any = {}) => ({
  id, grupo, categoria, orcamento_valor: valor, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1, ...extra,
});

test('Proforma do Avançado: Manutenção pós-obra tem linha própria, depois de Decoração e antes de Despesas Financeiras', () => {
  const c = calcularFluxo(config([
    custo(1, 'obra', 'Decoração', 100_000),
    custo(2, 'diretos', CATEGORIA_MANUTENCAO_POS_OBRA, 1_846_829.45, { cronograma_evento: 'pos_obra' }),
    custo(3, 'financeiro', 'Juros de financiamento', 50_000),
    custo(4, 'diretos', 'Outro', 10_000),
  ]));
  const nomes = proformaAvancado(c, 1000).linhas.map((l) => l.nome);
  const idxDec = nomes.indexOf('(-) Decoração');
  const idxMan = nomes.indexOf('(-) Manutenção pós-obra');
  const idxFin = nomes.findIndex((n) => n.startsWith('(-) Despesas Financeiras'));
  assert.ok(idxDec >= 0 && idxMan >= 0 && idxFin >= 0, `linhas ausentes: ${nomes.join(' | ')}`);
  assert.ok(idxDec < idxMan && idxMan < idxFin, 'ordem pedida: Decoração, Manutenção pós-obra, Despesas Financeiras');
  // O "Outro" continua sendo "Outro" — a manutenção não foi parar nele.
  assert.equal(nomes.filter((n) => n === '(-) Outro').length, 1);
  const linha = proformaAvancado(c, 1000).linhas[idxMan];
  assert.ok(Math.abs(linha.valor + 1_846_829.45) <= 0.01);
});

test('aba Custos: escolher Manutenção pós-obra grava o evento Pós-obras e solta a âncora de fase', () => {
  const tela: any = new ViabFluxoCustos();
  const salvos: any[] = [];
  tela._salvar = (_c: any, dados: any) => { salvos.push(dados); };
  tela._salvarCategoria({ id: 1, orcamento_unidade: 'rs', cronograma_evento: 'obra', fase_ancora_id: 7 }, 'diretos', CATEGORIA_MANUTENCAO_POS_OBRA);
  assert.equal(salvos.length, 1);
  assert.equal(salvos[0].categoria, CATEGORIA_MANUTENCAO_POS_OBRA);
  assert.equal(salvos[0].cronograma_evento, 'pos_obra');
  assert.equal(salvos[0].fase_ancora_id, null);

  // Outra categoria não mexe no cronograma.
  tela._salvarCategoria({ id: 2, orcamento_unidade: 'rs' }, 'diretos', 'Projetos');
  assert.equal('cronograma_evento' in salvos[1], false);
});
