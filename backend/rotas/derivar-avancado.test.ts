import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  planejarDerivacao, executarDerivacao, rotasDerivarAvancado,
  type OpcoesDerivacao, type PlanoDerivacao,
} from './derivar-avancado.js';
import { cronogramaPadrao, recalcularTravados } from './avancado.js';
import { calcularFluxo } from '../../frontend/fluxo-caixa-motor.js';
import { validarReconciliacaoCamadas } from '../../frontend/fluxo-invariantes.js';
import esquemaApp from '../../schema.json';

// ─────────────────────────────────────────────────────────────────
// Criação de um Avançado a partir de um Preliminar.
//
// As fixtures imitam o Postgres: coluna `decimal` chega como STRING ("4.00"), booleano como
// boolean, ausente como null. Áreas e percentuais são escolhidos para serem exatamente
// representáveis, salvo nos casos que existem para medir a quantização.
// ─────────────────────────────────────────────────────────────────

const CRONO = recalcularTravados(cronogramaPadrao());
const OPTS: OpcoesDerivacao = { aliquotaRet: 4, cronograma: CRONO, hoje: '24/11/2026' };

function estudoInc(extra: Record<string, any> = {}): Record<string, any> {
  return {
    id: 7, id_legivel: 'inc_torre-teste_df_007', nome: 'Torre Teste', uf: 'DF',
    tipo_empreendimento: 'incorporacao', nivel_analise: 'preliminar', status: 'rascunho', sequencia: 7, autor_id: 3,
    notas: null,
    origem_terreno: 'manual', terreno_manual_area: '1000.00', area_terreno_nucleo: null,
    area_pvt_r_fechada: '4500.00', area_pvt_nr_fechada: '1500.00',
    area_pvt_r_aberta: '0.00', area_pvt_nr_aberta: '0.00', area_comum_total: '0.00',
    sujeito_ret: false, imposto_percentual: '7.00',
    corretagem_percentual: '5.00', marketing_percentual: '1.00',
    permuta_financeira_residencial_pct: '0.00', permuta_financeira_nao_residencial_pct: '0.00',
    permuta_financeira_residencial_modo: 'pct_vgv', permuta_financeira_nao_residencial_modo: 'pct_vgv',
    considerar_custo_terreno: true, custo_terreno_m2: '200.00',
    projetos_modo: 'pct_vgv', projetos_pct: '1.60',
    incorporacao_registro_pct: '0.25',
    construcao_modo: 'valor_m2', custo_construcao_m2: '4800.00',
    taxa_gestao_pct: '6.00', custo_decoracao_m2: '150.00', manutencao_pct: '1.00',
    considerar_contingencias: true, contingencias_pct: '0.00',
    considerar_gestao_indiretos: true, gestao_indiretos_pct: '1.25',
    tem_pre_lancamento: true, data_inicio_projeto: null, juros_tabela_aa_padrao: null,
    // Colunas de permuta física do Preliminar: nenhuma pode viajar para o Avançado.
    permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: null, permuta_fisica_area_canonica: null,
    permuta_fisica_pct: null, permuta_fisica_produto_id: null, permuta_fisica_quantidade: 0,
    permuta_fisica_nr_modo: 'area_m2', permuta_fisica_nr_area_m2: null, permuta_fisica_nr_area_canonica: null,
    permuta_fisica_nr_pct: null, permuta_fisica_nr_produto_id: null, permuta_fisica_nr_quantidade: 0,
    ...extra,
  };
}

function estudoLot(extra: Record<string, any> = {}): Record<string, any> {
  return estudoInc({
    id: 8, id_legivel: 'lot_gleba_df_001', nome: 'Gleba', tipo_empreendimento: 'loteamento',
    terreno_manual_area: '100000.00',
    area_app_modo: 'm2', area_app_valor: '10000.00',
    area_elup_epu_modo: 'm2', area_elup_epu_valor: '5000.00',
    area_epc_modo: 'm2', area_epc_valor: '5000.00',
    area_viario_publico_modo: 'm2', area_viario_publico_valor: '20000.00',
    area_viario_privado_modo: 'm2', area_viario_privado_valor: '0',
    area_comuns_privadas_modo: 'm2', area_comuns_privadas_valor: '0',
    area_verdes_modo: 'm2', area_verdes_valor: '0',
    area_pvt_r_fechada: null, area_pvt_nr_fechada: null,
    custo_terreno_m2: '50.00',
    infra_modo: 'valor_m2', custo_infra_m2: '120.00', infra_pct: '30.00', infra_valor_fixo: null,
    stand_vendas_valor: '500000.00',
    ...extra,
  });
}

let seqProduto = 100;
function produto(extra: Record<string, any> = {}): Record<string, any> {
  return {
    id: seqProduto++, estudo_id: 7, nome: 'Produto', tipo: 'residencial',
    pct_alv: '50.0000', area_media_m2: null, preco_venda_m2: '10000.00',
    unidades: 30, unidades_permutadas: 0, ordem: 0, ...extra,
  };
}

/** Catálogo de áreas exatas sobre a base de 6.000 m² (4.500 R + 1.500 NR): 100, 150 e 50 m². */
function catalogoBase(): Record<string, any>[] {
  return [
    produto({ nome: '2 quartos', pct_alv: '50.0000', unidades: 30, ordem: 0 }),
    produto({ nome: '3 quartos', pct_alv: '25.0000', unidades: 10, ordem: 1 }),
    produto({ nome: 'Loja', tipo: 'nao_residencial', pct_alv: '25.0000', unidades: 30, preco_venda_m2: '12000.00', ordem: 2 }),
  ];
}

/** Produto LEGADO: sem `pct_alv`, com a área média própria. */
function legado(nome: string, area: string, unidades: number, preco: string, extra: Record<string, any> = {}) {
  return produto({ nome, pct_alv: null, area_media_m2: area, unidades, preco_venda_m2: preco, ...extra });
}

const centavos = (v: number): number => Math.round(v * 100);
const categoria = (plano: PlanoDerivacao, cat: string, sub?: string) =>
  plano.custos.filter((c) => c.categoria === cat && (sub === undefined || c.subcategoria === sub));
const unica = (plano: PlanoDerivacao, cat: string, sub?: string) => {
  const r = categoria(plano, cat, sub);
  assert.equal(r.length, 1, `esperada 1 linha "${cat}${sub ? ` › ${sub}` : ''}", vieram ${r.length}`);
  return r[0];
};
const identidadeFecha = (c: PlanoDerivacao['conferencia']): boolean =>
  centavos(c.vgvAvancado) - centavos(c.vgvPreliminarBruto) === centavos(c.diferencaAreaAberta) + centavos(c.diferencaQuantizacao);

// ── 1 ──
test('1: Incorporação R+NR sem área aberta — VGV igual ao centavo, tipologias, alocações e obrigatórias', () => {
  const plano = planejarDerivacao(estudoInc(), catalogoBase(), OPTS);
  assert.equal(plano.conferencia.vgvPreliminarBruto, 63_000_000);
  assert.equal(plano.conferencia.vgvAvancado, plano.conferencia.vgvPreliminarBruto);
  assert.equal(plano.conferencia.diferencaAreaAberta, 0);
  assert.equal(plano.conferencia.diferencaQuantizacao, 0);

  assert.deepEqual(plano.tipologias.map((t) => t.tipo_unidade), ['apartamento', 'apartamento', 'loja']);
  assert.deepEqual(plano.tipologias.map((t) => t.area_privativa_m2), [100, 150, 50]);
  assert.deepEqual(plano.tipologias.map((t) => t.quantidade), [30, 10, 30]);

  assert.equal(plano.alocacoes.length, 3);
  plano.alocacoes.forEach((a, i) => {
    assert.equal(a.tipologiaIndice, i);
    assert.equal(a.unidades, plano.tipologias[i].quantidade, '100% das unidades alocadas');
    assert.equal(a.preco_m2, plano.tipologias[i].preco_m2);
  });
  assert.equal(plano.grupo.tipo, 'receita');
  assert.equal(plano.grupo.nome, '1º Grupo');

  unica(plano, 'Preço', 'Valor à vista');
  unica(plano, 'Construção');
  unica(plano, 'Corretagem de vendas');

  assert.deepEqual(Object.keys(plano.copiaEstudo).filter((k) => k.startsWith('permuta_fisica')), []);
  assert.equal(plano.copiaEstudo.nivel_analise, 'avancado');
  assert.equal(plano.copiaEstudo.tipo_empreendimento, 'incorporacao');
  assert.ok(String(plano.copiaEstudo.notas).includes('Criado a partir do estudo Preliminar inc_torre-teste_df_007 em 24/11/2026.'));
  assert.ok(plano.relatorio.some((r) => /Cronograma/.test(r.origem)), 'o relatório sempre fala do cronograma padrão');
});

// ── 2 ──
test('2: área aberta — identidade das diferenças ao centavo e item de relatório', () => {
  const plano = planejarDerivacao(estudoInc({ area_pvt_r_aberta: '600.00' }), catalogoBase(), OPTS);
  assert.equal(plano.conferencia.diferencaAreaAberta, 5_999_000);
  assert.ok(identidadeFecha(plano.conferencia));
  assert.deepEqual(plano.tipologias.map((t) => t.area_privativa_aberta_m2), [13.33, 20, 0]);
  const item = plano.relatorio.find((r) => /Área privativa aberta residencial/.test(r.origem) && r.destino.includes('área privativa aberta'));
  assert.ok(item, 'a área aberta precisa de item de relatório');
  assert.ok(plano.relatorio.some((r) => r.origem === 'VGV bruto' && r.alerta === true && /área aberta/.test(r.regra)),
    'o VGV maior por causa da área aberta é declarado, nunca "igual"');
});

test('2b: família com área aberta e sem tipologia — alerta, nada é rateado', () => {
  const soResidencial = catalogoBase().slice(0, 2);
  const plano = planejarDerivacao(
    estudoInc({ area_pvt_nr_aberta: '100.00', area_pvt_r_fechada: '4500.00', area_pvt_nr_fechada: '0.00' }),
    soResidencial, OPTS,
  );
  const alerta = plano.relatorio.find((r) => r.alerta === true && /não residencial/.test(r.origem));
  assert.ok(alerta, 'área aberta sem tipologia na família tem de virar alerta');
  assert.ok(/não a representa/.test(alerta!.nota ?? ''));
  assert.equal(plano.conferencia.diferencaAreaAberta, 0);
  assert.ok(plano.tipologias.every((t) => t.area_privativa_aberta_m2 === 0));
});

// ── 3 ──
test('3: quantização da área derivada — diferença declarada e identidade ao centavo', () => {
  const plano = planejarDerivacao(
    estudoInc({ area_pvt_r_fechada: '6000.00', area_pvt_nr_fechada: '0.00' }),
    [produto({ pct_alv: '33.3333', unidades: 7, preco_venda_m2: '9000.00' })], OPTS,
  );
  assert.equal(plano.tipologias[0].area_privativa_m2, 285.71);
  assert.notEqual(plano.conferencia.diferencaQuantizacao, 0);
  assert.ok(plano.conferencia.diferencaQuantizacao < 0, 'a área arredondada para baixo reduz o VGV');
  assert.ok(identidadeFecha(plano.conferencia));
  assert.ok(plano.relatorio.some((r) => r.alerta === true && /arredondamento/.test(r.regra)));
});

// ── 4 ──
test('4: Loteamento — lote em todas, infraestrutura em R$/m² quando reconcilia, stand e cascata', () => {
  const produtos = [
    produto({ nome: 'Lote A', pct_alv: '50.0000', unidades: 100, preco_venda_m2: '1000.00', ordem: 0 }),
    produto({ nome: 'Lote B', pct_alv: '50.0000', unidades: 150, preco_venda_m2: '1200.00', ordem: 1 }),
  ];
  const plano = planejarDerivacao(estudoLot(), produtos, OPTS);
  assert.deepEqual(plano.tipologias.map((t) => t.tipo_unidade), ['lote', 'lote']);
  assert.deepEqual(plano.tipologias.map((t) => t.area_privativa_m2), [300, 200]);
  assert.equal(plano.conferencia.vgvPreliminarBruto, 66_000_000);
  assert.equal(plano.conferencia.vgvAvancado, 66_000_000);

  const construcao = unica(plano, 'Construção');
  assert.equal(construcao.grupo, 'obra');
  assert.equal(construcao.orcamento_unidade, 'rs_m2_priv');
  assert.equal(construcao.orcamento_valor, 120);
  assert.equal(construcao.orcamento_valor_canonico, null);

  const terreno = unica(plano, 'Preço', 'Valor à vista');
  assert.equal(terreno.orcamento_unidade, 'rs_m2_terreno');
  assert.equal(terreno.orcamento_valor, 50);

  const stand = unica(plano, 'Stand de vendas');
  assert.equal(stand.grupo, 'indireto');
  assert.equal(stand.orcamento_valor, 500_000);
  assert.equal(categoria(plano, 'Registro').length, 0, 'Registro é só da Incorporação');
  assert.ok(plano.relatorio.some((r) => /Cascata de áreas/.test(r.origem)));
});

test('4b: Loteamento com infraestrutura em % do VGV — congelada em R$', () => {
  const produtos = [
    produto({ nome: 'Lote A', pct_alv: '50.0000', unidades: 100, preco_venda_m2: '1000.00', ordem: 0 }),
    produto({ nome: 'Lote B', pct_alv: '50.0000', unidades: 150, preco_venda_m2: '1200.00', ordem: 1 }),
  ];
  const plano = planejarDerivacao(estudoLot({ infra_modo: 'pct_vgv', infra_pct: '30.00' }), produtos, OPTS);
  const construcao = unica(plano, 'Construção');
  assert.equal(construcao.orcamento_unidade, 'rs');
  assert.equal(construcao.orcamento_valor, 19_800_000);
  assert.equal(construcao.orcamento_valor_canonico, 19_800_000);
});

// ── 5 ──
test('5: permuta física por produto — uma linha por produto, unidades exatas e tipologia certa', () => {
  const produtos = catalogoBase();
  produtos[0].unidades_permutadas = 3;
  produtos[1].unidades_permutadas = 2;
  const plano = planejarDerivacao(estudoInc(), produtos, OPTS);
  const linhas = categoria(plano, 'Preço', 'Permuta física');
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas.map((l) => [l.permuta_tipologia_indice, l.permuta_quantidade]), [[0, 3], [1, 2]]);
  for (const l of linhas) {
    assert.equal(l.grupo, 'terreno');
    assert.equal(l.orcamento_unidade, 'rs');
    assert.equal(l.orcamento_valor, null);
  }
});

// ── 6 ──
test('6: permuta física por área — vence o MENOR resíduo, não a maior quantidade', () => {
  const produtos = [
    legado('Pequeno', '100.00', 30, '10000.00', { ordem: 0 }),
    legado('Médio', '130.00', 10, '10000.00', { ordem: 1 }),
  ];
  const plano = planejarDerivacao(
    estudoInc({ area_pvt_r_fechada: '4300.00', area_pvt_nr_fechada: '0.00', permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: '260.00' }),
    produtos, OPTS,
  );
  // 260 m²: o produto de 100 m² (30 unidades) daria 3 un. = 40 m² de resíduo; o de 130 m² dá 2 un. = 0.
  const linha = unica(plano, 'Preço', 'Permuta física');
  assert.equal(linha.permuta_tipologia_indice, 1);
  assert.equal(linha.permuta_quantidade, 2);
});

test('6b: permuta física por área que arredonda para zero — sem linha e com alerta', () => {
  const produtos = [
    legado('Pequeno', '100.00', 30, '10000.00', { ordem: 0 }),
    legado('Médio', '130.00', 10, '10000.00', { ordem: 1 }),
  ];
  const plano = planejarDerivacao(
    estudoInc({ area_pvt_r_fechada: '4300.00', area_pvt_nr_fechada: '0.00', permuta_fisica_modo: 'area_m2', permuta_fisica_area_m2: '40.00' }),
    produtos, OPTS,
  );
  assert.equal(categoria(plano, 'Preço', 'Permuta física').length, 0);
  assert.ok(plano.relatorio.some((r) => r.alerta === true && /Permuta física/.test(r.origem) && r.regra === 'não levada'));
});

// ── 7 ──
test('7: permuta financeira R + NR — uma linha em R$ com a soma', () => {
  const plano = planejarDerivacao(
    estudoInc({ permuta_financeira_residencial_pct: '2.00', permuta_financeira_nao_residencial_pct: '3.00' }),
    catalogoBase(), OPTS,
  );
  // 2% de R$ 45.000.000 (residencial) + 3% de R$ 18.000.000 (não residencial).
  const linha = unica(plano, 'Preço', 'Permuta financeira');
  assert.equal(linha.orcamento_unidade, 'rs');
  assert.equal(linha.orcamento_valor, 1_440_000);
  assert.equal(linha.orcamento_valor_canonico, 1_440_000);
});

test('7b: permuta financeira sem VGV vendável no Avançado — sem linha e com alerta', () => {
  const plano = planejarDerivacao(
    estudoInc({ permuta_financeira_residencial_modo: 'valor_fixo', permuta_financeira_residencial_valor: '50000.00' }),
    [], OPTS,
  );
  assert.equal(categoria(plano, 'Preço', 'Permuta financeira').length, 0);
  assert.ok(plano.relatorio.some((r) => r.alerta === true && r.origem === 'Permuta financeira'));
});

// ── 8 ──
test('8: custo desligado no Preliminar não vira linha', () => {
  const plano = planejarDerivacao(
    estudoInc({ considerar_custo_terreno: false, considerar_contingencias: false, contingencias_pct: '3.00' }),
    catalogoBase(), OPTS,
  );
  assert.equal(categoria(plano, 'Preço', 'Valor à vista').length, 0);
  assert.equal(categoria(plano, 'Contingência').length, 0);
  // O Preço obrigatório nasce vazio, para a tela não semeá-lo por conta própria.
  const preco = unica(plano, 'Preço');
  assert.equal(preco.orcamento_valor, null);
  assert.equal(preco.subcategoria, undefined);
});

// ── 9 ──
test('9: regime do imposto — RET com a alíquota do parâmetro, padrão, e alíquota ilegível', () => {
  const ret = planejarDerivacao(estudoInc({ sujeito_ret: true }), catalogoBase(), { ...OPTS, aliquotaRet: 4.5 });
  assert.equal(ret.copiaEstudo.considerar_ret, true);
  assert.equal(ret.copiaEstudo.ret_pct, 4.5);

  const padrao = planejarDerivacao(estudoInc({ sujeito_ret: false, imposto_percentual: '7.00' }), catalogoBase(), OPTS);
  assert.equal(padrao.copiaEstudo.considerar_ret, false);
  assert.equal(padrao.copiaEstudo.imposto_percentual, 7, 'a coluna do imposto padrão viaja');

  const semAliquota = planejarDerivacao(estudoInc({ sujeito_ret: true, ret_pct: '3.50' }), catalogoBase(), { ...OPTS, aliquotaRet: null });
  assert.equal(semAliquota.copiaEstudo.considerar_ret, true);
  assert.equal(semAliquota.copiaEstudo.ret_pct, 3.5, 'mantém o ret_pct copiado');
  assert.ok(semAliquota.relatorio.some((r) => r.alerta === true && /alíquota/.test(r.nota ?? '')));
});

// ── 10 ──
test('10: Construção que não reconcilia (canônico diverge do legado) — R$ com o valor efetivo', () => {
  const plano = planejarDerivacao(estudoInc({ construcao_valor_canonico: '30000000.00' }), catalogoBase(), OPTS);
  const c = unica(plano, 'Construção');
  assert.equal(c.orcamento_unidade, 'rs');
  assert.equal(c.orcamento_valor, 30_000_000);
  assert.equal(c.orcamento_valor_canonico, 30_000_000);
  assert.ok(plano.relatorio.some((r) => r.alerta === true && r.destino.endsWith('Construção') && /R\$/.test(r.regra)));

  // Controle: sem o canônico divergente a mesma Construção reconcilia e fica em R$/m².
  const controle = unica(planejarDerivacao(estudoInc(), catalogoBase(), OPTS), 'Construção');
  assert.equal(controle.orcamento_unidade, 'rs_m2_priv');
});

// ── 11 ──
test('11: produto legado sem pct_alv vira tipologia; produto em branco vira item de relatório', () => {
  const produtos = [
    legado('Legado', '80.00', 20, '9000.00', { ordem: 0 }),
    produto({ nome: 'Em branco', pct_alv: null, area_media_m2: null, preco_venda_m2: null, unidades: 0, ordem: 1 }),
  ];
  const plano = planejarDerivacao(
    estudoInc({ area_pvt_r_fechada: '1600.00', area_pvt_nr_fechada: '0.00' }), produtos, OPTS,
  );
  assert.equal(plano.tipologias.length, 1);
  assert.equal(plano.tipologias[0].nome, 'Legado');
  assert.equal(plano.tipologias[0].area_privativa_m2, 80);
  assert.equal(plano.conferencia.vgvAvancado, plano.conferencia.vgvPreliminarBruto);
  assert.ok(plano.relatorio.some((r) => /Em branco/.test(r.origem) && /não levado/.test(r.regra)));
});

// ── 12 ──
/** O `FluxoConfig` mínimo de um plano, montado como a tela monta o do Avançado. */
function configDoPlano(estudo: Record<string, any>, plano: PlanoDerivacao) {
  const tipologias = plano.tipologias.map((t, i) => ({
    id: i + 1000, tipologia_id: i + 1, nome: t.nome,
    area_privativa_m2: t.area_privativa_m2, area_privativa_aberta_m2: t.area_privativa_aberta_m2,
    quantidade: plano.alocacoes[i].unidades, preco_m2: plano.alocacoes[i].preco_m2,
  }));
  const linhasCusto = plano.custos.map((c, i) => {
    const { permuta_tipologia_indice, ...resto } = c;
    return { id: i + 1, ...resto, ...(permuta_tipologia_indice !== undefined ? { permuta_tipologia_id: permuta_tipologia_indice + 1 } : {}) };
  });
  return {
    dataInicio: null, taxaDescontoAa: 12, jurosTabelaAaEstudo: 0,
    areaTerreno: Number(estudo.terreno_manual_area) || Number(estudo.area_terreno_nucleo) || 0,
    cronograma: OPTS.cronograma.map(({ evento, inicio_mes, duracao_meses }) => ({ evento, inicio_mes, duracao_meses })),
    linhasReceita: [{
      id: 1, nome: plano.grupo.nome, fase_label: '', ordem: 0,
      absorcao: plano.grupo.absorcao, fluxo_pagamento: plano.grupo.fluxo_pagamento, tipologias,
    }],
    linhasCusto,
  };
}

test('12: equivalência com o motor — o VGV e o VGV vendável que o motor publica são os do plano', () => {
  const produtos = catalogoBase();
  produtos[0].unidades_permutadas = 3;
  const estudo = estudoInc({ area_pvt_r_aberta: '600.00' });
  const plano = planejarDerivacao(estudo, produtos, OPTS);
  const r = calcularFluxo(configDoPlano(estudo, plano));

  assert.equal(r.vgvTotal, plano.conferencia.vgvAvancado);
  // 3 unidades do 1º produto saem da venda: 3 × (100 + 13,33) m² × R$ 10.000.
  const t0 = plano.tipologias[0];
  const permutado = Math.round(3 * (t0.area_privativa_m2 + t0.area_privativa_aberta_m2) * t0.preco_m2 * 100) / 100;
  assert.equal(r.vgvPermutaFisica, permutado);
  assert.equal(r.vgvVendavel, Math.round((plano.conferencia.vgvAvancado - permutado) * 100) / 100);
  assert.equal(centavos(r.vgvTotal) - centavos(r.vgvPermutaFisica), centavos(r.vgvVendavel));
});

// ── 13 ──
test('13: as camadas Catálogo × Premissas não divergem (nenhum CAMADAS_DIVERGEM_PERMUTA_FISICA)', () => {
  const produtos = catalogoBase();
  produtos[0].unidades_permutadas = 3;
  produtos[2].unidades_permutadas = 4;
  const estudo = estudoInc();
  const plano = planejarDerivacao(estudo, produtos, OPTS);
  const tipologiasCatalogo = plano.tipologias.map((t, i) => ({ id: i + 1, ...t }));
  const linhasCusto = plano.custos.map((c, i) => ({
    id: i + 1, ...c,
    ...(c.permuta_tipologia_indice !== undefined ? { permuta_tipologia_id: c.permuta_tipologia_indice + 1 } : {}),
  }));
  assert.ok(linhasCusto.some((c) => c.subcategoria === 'Permuta física'), 'o caso precisa ter permuta física para medir algo');
  const divergencias = validarReconciliacaoCamadas({ ...plano.copiaEstudo }, linhasCusto, tipologiasCatalogo)
    .filter((d) => d.codigo === 'CAMADAS_DIVERGEM_PERMUTA_FISICA');
  assert.deepEqual(divergencias, []);
});

// ── 14: executor ──
type Chamada = { handle: string; op: string; tabela: string };

/** Armazenamento em memória com a validação de tipo, enum, tamanho e coluna do shell (derivada do schema.json). */
class Mem {
  tabelas = new Map<string, Map<number, any>>();
  log: Chamada[] = [];
  private ctl: { falharEm: string | null } = { falharEm: null };
  private seq = { v: 5000 };
  constructor(private nome = 'raiz', compartilhado?: Mem) {
    if (compartilhado) {
      this.tabelas = compartilhado.tabelas; this.log = compartilhado.log;
      this.seq = compartilhado.seq; this.ctl = compartilhado.ctl;
    }
  }
  set falharEm(tabela: string | null) { this.ctl.falharEm = tabela; }

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.seq.v++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }

  private static validar(tabela: string, dados: Record<string, any>): void {
    const def = (esquemaApp as any).tabelas?.[tabela];
    if (!def) throw new Error(`Tabela desconhecida: ${tabela}`);
    const erros: string[] = [];
    for (const [campo, valor] of Object.entries(dados)) {
      if (campo === 'id') continue;
      const col = def.colunas?.[campo];
      if (!col) { erros.push(`Coluna desconhecida "${campo}"`); continue; }
      if (valor === null || valor === undefined) continue;
      if (col.opcoes && !col.opcoes.includes(valor)) erros.push(`Campo "${campo}" fora das opções`);
      if (col.tipo === 'decimal') { if (typeof valor !== 'number') erros.push(`Campo "${campo}" deve ser um número`); }
      else if (col.tipo === 'inteiro' || col.tipo === 'referencia') {
        if (typeof valor !== 'number' || !Number.isInteger(valor)) erros.push(`Campo "${campo}" deve ser um número inteiro`);
      } else if (col.tipo === 'texto' && col.limite && String(valor).length > col.limite) erros.push(`Campo "${campo}" excede ${col.limite}`);
    }
    for (const [campo, col] of Object.entries<any>(def.colunas ?? {})) {
      if (col.obrigatorio === true && col.padrao === undefined && (dados[campo] === undefined || dados[campo] === null)) {
        erros.push(`Campo obrigatório "${campo}" ausente`);
      }
    }
    if (erros.length > 0) throw new Error(`Erros de validação (${tabela}): ${erros.join('; ')}`);
  }

  async criar(tabela: string, dados: Record<string, any>) {
    this.log.push({ handle: this.nome, op: 'criar', tabela });
    if (this.ctl.falharEm === tabela) throw new Error(`falha simulada em ${tabela}`);
    Mem.validar(tabela, dados);
    const id = this.semear(tabela, { ...dados });
    return { ...this.tabelas.get(tabela)!.get(id) };
  }

  async buscar(tabela: string, id: number) {
    const l = this.tabelas.get(tabela)?.get(Number(id));
    return l ? { ...l } : null;
  }

  async listar(tabela: string, opts: { filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc'; por_pagina?: number } = {}) {
    this.log.push({ handle: this.nome, op: 'listar', tabela });
    let linhas = [...(this.tabelas.get(tabela)?.values() ?? [])]
      .filter((l) => Object.entries(opts.filtros ?? {}).every(([k, v]) => l[k] === v));
    if (opts.ordenar) {
      const c = opts.ordenar; const d = opts.ordem === 'desc' ? -1 : 1;
      linhas = linhas.sort((a, b) => (a[c] === b[c] ? 0 : (a[c] > b[c] ? 1 : -1) * d));
    }
    const total = linhas.length;
    return { dados: linhas.slice(0, opts.por_pagina ?? 20).map((l) => ({ ...l })), total };
  }

  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    this.log.push({ handle: this.nome, op: 'varrerTudo', tabela });
    return [...(this.tabelas.get(tabela)?.values() ?? [])]
      .filter((l) => Object.entries(opts.filtros ?? {}).every(([k, v]) => l[k] === v))
      .map((l) => ({ ...l }));
  }

  async transaction<T>(cb: (trx: Mem) => Promise<T>): Promise<T> {
    const copia = new Map<string, Map<number, any>>();
    for (const [nome, tab] of this.tabelas) copia.set(nome, new Map([...tab].map(([id, l]) => [id, { ...l }])));
    try {
      return await cb(new Mem('trx', this));
    } catch (e) {
      this.tabelas.clear();
      for (const [k, v] of copia) this.tabelas.set(k, v);
      throw e;
    }
  }

  linhas(tabela: string): any[] { return [...(this.tabelas.get(tabela)?.values() ?? [])]; }
}

/** Planeja e completa a cópia como a rota completa. */
function planoPronto(estudo: Record<string, any>, produtos: Record<string, any>[]): PlanoDerivacao {
  const plano = planejarDerivacao(estudo, produtos, OPTS);
  Object.assign(plano.copiaEstudo, {
    status: 'rascunho', autor_id: 1, id_legivel: 'inc_novo_df_008', nome_exibicao: 'INC · Novo · DF · 008', sequencia: 8,
  });
  return plano;
}

test('14: executor com dados em memória — ordem das tabelas, ids remapeados e membro no MESMO handle', async () => {
  const produtos = catalogoBase();
  produtos[0].unidades_permutadas = 3;
  produtos[1].unidades_permutadas = 2;
  const estudo = estudoInc();
  const plano = planoPronto(estudo, produtos);

  const mem = new Mem();
  mem.semear('estudo_imoveis', { estudo_id: 7, imovel_nucleo_id: 55, tipo_imovel: 'gleba' });
  for (const p of produtos) mem.semear('preliminar_produtos', { ...p, estudo_id: 7 });
  const trx = new Mem('trx', mem);

  const { novo, funcao } = await executarDerivacao(trx as any, 7, plano, 1);
  assert.equal(funcao, 'editor');
  assert.equal(novo.nivel_analise, 'avancado');

  // Todas as escritas pelo MESMO handle (o `trx`), nenhuma pelo executor de fora.
  const criacoes = mem.log.filter((c) => c.op === 'criar');
  assert.ok(criacoes.length > 0);
  assert.ok(criacoes.every((c) => c.handle === 'trx'), 'toda escrita deve sair pelo handle recebido');
  assert.ok(criacoes.some((c) => c.tabela === 'estudo_membros'), 'o criador precisa entrar como editor, pelo mesmo handle');

  // Ordem: estudo → imóveis → catálogo → tipologias → grupo → alocações → custos → membro.
  const ordem = criacoes.map((c) => c.tabela);
  const primeira = (t: string) => ordem.indexOf(t);
  const ultima = (t: string) => ordem.lastIndexOf(t);
  const sequencia = ['estudos', 'estudo_imoveis', 'preliminar_produtos', 'avancado_tipologias', 'avancado_fases',
    'avancado_alocacoes', 'avancado_linhas_custo', 'estudo_membros'];
  for (let i = 0; i < sequencia.length - 1; i++) {
    assert.ok(ultima(sequencia[i]) < primeira(sequencia[i + 1]), `${sequencia[i]} deve ser gravada antes de ${sequencia[i + 1]}`);
  }

  // Referências: tipologia e fase pelos ids criados.
  const novoId = Number(novo.id);
  const tips = mem.linhas('avancado_tipologias').filter((t) => t.estudo_id === novoId).sort((a, b) => a.ordem - b.ordem);
  assert.equal(tips.length, 3);
  const fase = mem.linhas('avancado_fases').find((f) => f.estudo_id === novoId);
  assert.ok(fase);
  const alocs = mem.linhas('avancado_alocacoes').filter((a) => a.estudo_id === novoId);
  assert.equal(alocs.length, 3);
  for (const a of alocs) {
    assert.equal(a.fase_id, fase.id);
    assert.ok(tips.some((t) => t.id === a.tipologia_id), 'alocação aponta para tipologia criada');
  }
  const permutas = mem.linhas('avancado_linhas_custo')
    .filter((c) => c.estudo_id === novoId && c.subcategoria === 'Permuta física')
    .sort((a, b) => a.permuta_tipologia_id - b.permuta_tipologia_id);
  assert.equal(permutas.length, 2);
  assert.deepEqual(permutas.map((c) => c.permuta_tipologia_id), [tips[0].id, tips[1].id]);
  assert.deepEqual(permutas.map((c) => c.permuta_quantidade), [3, 2]);
  assert.ok(mem.linhas('avancado_linhas_custo').every((c) => !('permuta_tipologia_indice' in c)), 'a chave auxiliar não vai para o banco');
  const membro = mem.linhas('estudo_membros').find((m) => m.estudo_id === novoId);
  assert.deepEqual([membro.usuario_id, membro.funcao], [1, 'editor']);
  // Catálogo copiado para o estudo novo; o da origem intacto.
  assert.equal(mem.linhas('preliminar_produtos').filter((p) => p.estudo_id === novoId).length, 3);
  assert.equal(mem.linhas('estudo_imoveis').filter((p) => p.estudo_id === novoId).length, 1);
});

// ── Rota de ponta a ponta, com o validador do shell ──
function criarApp(mem: Mem, contexto: Record<string, any> = { nivelApp: 'admin', usuario: { id: 1, nome: 'Teste' } }, aliquotaParametro: unknown = 4) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = mem;
    req.contexto = contexto;
    req.parametros = { obter: async () => aliquotaParametro };
    req.eventos = { publicar: async () => {}, inscreverUsuario: async () => {}, cancelarInscricao: async () => {} };
    next();
  });
  app.use(rotasDerivarAvancado);
  return app;
}

async function comServidor(app: ReturnType<typeof express>, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', () => resolve()); server.once('error', reject); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function semearPreliminar(mem: Mem, extra: Record<string, any> = {}): number {
  const produtos = catalogoBase();
  produtos[0].unidades_permutadas = 3;
  const id = mem.semear('estudos', estudoInc({ id: 7, ...extra }));
  for (const p of produtos) mem.semear('preliminar_produtos', { ...p, estudo_id: id });
  return id;
}

test('rota: 201 com estudo e relatório, o Preliminar intacto e tudo aceito pelo validador do shell', async () => {
  const mem = new Mem();
  const id = semearPreliminar(mem);
  const doPreliminar = () => JSON.stringify(['estudos', 'preliminar_produtos', 'estudo_imoveis'].map((t) =>
    [t, mem.linhas(t).filter((l) => l.estudo_id === id || (t === 'estudos' && l.id === id))]));
  const antes = doPreliminar();
  await comServidor(criarApp(mem), async (base) => {
    const res = await fetch(`${base}/estudos/${id}/derivar-avancado`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201, JSON.stringify(corpo));
    assert.equal(corpo.estudo.nivel_analise, 'avancado');
    assert.equal(corpo.estudo.status, 'rascunho');
    assert.equal(corpo.estudo.autor_id, 1);
    assert.notEqual(corpo.estudo.id, id);
    assert.ok(Array.isArray(corpo.relatorio) && corpo.relatorio.length > 0);
    assert.ok(mem.linhas('estudo_membros').some((m) => m.estudo_id === corpo.estudo.id && m.funcao === 'editor'));
    assert.equal(mem.linhas('avancado_tipologias').filter((t) => t.estudo_id === corpo.estudo.id).length, 3);
    const origem = mem.linhas('estudos').find((e) => e.id === id);
    assert.equal(origem.nivel_analise, 'preliminar', 'o Preliminar não muda de nível');
    // O Preliminar segue como estava: nenhuma tabela ganhou ou perdeu linha com o id dele.
    assert.equal(doPreliminar(), antes);
  });
});

test('rota: recusas — origem Avançado 422, inexistente 404, id ruim 400, nível leitura 403', async () => {
  const mem = new Mem();
  const avancado = mem.semear('estudos', estudoInc({ id: 20, nivel_analise: 'avancado' }));
  await comServidor(criarApp(mem), async (base) => {
    const r1 = await fetch(`${base}/estudos/${avancado}/derivar-avancado`, { method: 'POST' });
    assert.equal(r1.status, 422);
    assert.equal((await r1.json()).codigo, 'NIVEL_INVALIDO');
    assert.equal((await fetch(`${base}/estudos/999/derivar-avancado`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/estudos/abc/derivar-avancado`, { method: 'POST' })).status, 400);
  });
  await comServidor(criarApp(mem, { nivelApp: 'leitura', usuario: { id: 1, nome: 'Teste' } }), async (base) => {
    assert.equal((await fetch(`${base}/estudos/${avancado}/derivar-avancado`, { method: 'POST' })).status, 403);
  });
});

test('rota: falha no meio da gravação desfaz tudo (nenhum estudo pela metade)', async () => {
  const mem = new Mem();
  const id = semearPreliminar(mem);
  mem.falharEm = 'avancado_linhas_custo';
  await comServidor(criarApp(mem), async (base) => {
    const res = await fetch(`${base}/estudos/${id}/derivar-avancado`, { method: 'POST' });
    assert.equal(res.status, 500);
    assert.equal((await res.json()).codigo, 'ERRO_INTERNO');
  });
  assert.equal(mem.linhas('estudos').length, 1, 'o estudo criado pela transação precisa ter sido desfeito');
  assert.equal(mem.linhas('avancado_tipologias').length, 0);
  assert.equal(mem.linhas('estudo_membros').length, 0);
});

// ── 15: fiação (classe de defeito nº 1 do CLAUDE.md) ──
test('15: fiação — a rota planeja, grava na transação, e só depois inscreve e publica', () => {
  const fonte = readFileSync(new URL('./derivar-avancado.ts', import.meta.url), 'utf8');
  const rota = fonte.slice(fonte.indexOf("rotasDerivarAvancado.post('/estudos/:id/derivar-avancado'"));
  assert.ok(rota.includes('planejarDerivacao('), 'a rota precisa chamar o planejador');
  const abre = rota.indexOf('req.dados!.transaction(');
  assert.ok(abre > 0, 'a gravação precisa estar numa transação');
  const exec = /req\.dados!\.transaction\(async \(trx\) =>\s*executarDerivacao\(trx[^;]*\)\);/.exec(rota);
  assert.ok(exec, 'a transação precisa executar `executarDerivacao(trx, ...)`');
  const fechamento = exec!.index + exec![0].length;
  const inscreve = rota.indexOf('inscreverMembroEstudo(');
  const publica = rota.indexOf('publicarEvento(');
  assert.ok(inscreve >= fechamento, 'a inscrição em eventos sai DEPOIS do commit');
  assert.ok(publica >= fechamento, 'a publicação do evento sai DEPOIS do commit');
  assert.ok(rota.indexOf('planejarDerivacao(') < abre, 'o plano é montado antes de abrir a transação');

  const exec2 = fonte.slice(fonte.indexOf('export async function executarDerivacao'), fonte.indexOf('// POST /estudos/:id/derivar-avancado'));
  assert.ok(exec2.includes('garantirMembro(dados,'), 'o executor vincula o criador pelo handle que recebeu');

  const rotas = readFileSync(new URL('../rotas.ts', import.meta.url), 'utf8');
  assert.ok(rotas.includes("from './rotas/derivar-avancado.js'"), 'backend/rotas.ts importa o router');
  assert.ok(/rotas\.use\(rotasDerivarAvancado\)/.test(rotas), 'backend/rotas.ts registra o router');
});


// ── B1: o plano é a fonte única do catálogo copiado ──
test('B1: o catálogo gravado é o do plano, não uma segunda leitura da origem', async () => {
  const produtos = catalogoBase();
  const plano = planoPronto(estudoInc(), produtos);
  assert.equal(plano.produtosOrigem.length, produtos.length);

  // O "banco" tem, na origem, um catálogo editado depois da leitura que gerou o plano.
  const mem = new Mem();
  for (const p of produtos) mem.semear('preliminar_produtos', { ...p, estudo_id: 7, nome: 'EDITADO DEPOIS', unidades: 999 });
  const trx = new Mem('trx', mem);
  const { novo } = await executarDerivacao(trx as any, 7, plano, 1);
  const copiados = mem.linhas('preliminar_produtos').filter((p) => p.estudo_id === Number(novo.id));
  assert.equal(copiados.length, produtos.length);
  assert.ok(copiados.every((p) => p.nome !== 'EDITADO DEPOIS' && p.unidades !== 999), 'a cópia vem do plano');
  assert.deepEqual(copiados.map((p) => p.nome).sort(), produtos.map((p) => p.nome).sort());
});

// ── Observação 2: permuta por produto acima das unidades do produto ──
test('permuta por produto limitada às unidades do produto — nota com os dois números e alerta', () => {
  const produtos = catalogoBase();
  const un = Number(produtos[0].unidades);
  produtos[0].unidades_permutadas = un + 5;
  const plano = planejarDerivacao(estudoInc(), produtos, OPTS);
  const it = plano.relatorio.find((r) => /Permuta física/.test(r.origem) && /declara/.test(r.nota ?? ''));
  assert.ok(it, 'item de relatório com a limitação');
  assert.equal(it!.alerta, true);
  assert.ok((it!.nota ?? '').includes(String(un + 5)) && (it!.nota ?? '').includes(String(un)));
  assert.ok(!/exatamente/.test(it!.nota ?? ''));
  // Dentro do limite, a nota segue dizendo "exatamente" e sem alerta.
  const ok = catalogoBase();
  ok[0].unidades_permutadas = 3;
  const itOk = planejarDerivacao(estudoInc(), ok, OPTS).relatorio.find((r) => /exatamente/.test(r.nota ?? ''));
  assert.ok(itOk && !itOk.alerta);
});

// ── Observação 6: parâmetro vazio não vira alíquota 0 ──
test('rota: parâmetro de alíquota vazio não vira 0 — vale o ret_pct copiado, com alerta', async () => {
  for (const ruim of ['', null]) {
    const mem = new Mem();
    const id = semearPreliminar(mem, { sujeito_ret: true, ret_pct: '3.50' });
    await comServidor(criarApp(mem, undefined, ruim), async (base) => {
      const res = await fetch(`${base}/estudos/${id}/derivar-avancado`, { method: 'POST' });
      const corpo = await res.json();
      assert.equal(res.status, 201, JSON.stringify(corpo));
      assert.equal(corpo.estudo.ret_pct, 3.5);
      assert.ok(corpo.relatorio.some((r: any) => r.alerta === true && /alíquota/.test(r.nota ?? '')));
    });
  }
});
