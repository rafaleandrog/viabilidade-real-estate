import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  resolverCustoTotal, totalConstrucaoCustos, CATEGORIAS_BASE_CONSTRUCAO, type EventoCrono,
} from './fluxo-shared.js';
import { calcularProforma, type ProformaInput } from './proforma.js';
import { ctxConversaoPreliminar } from './premissas-conversao.js';
import { montarLinhasProforma } from './tela-proforma.js';
import { fmtNum } from './viab-format.js';

// Duas bases de custo em % que a EVI usa e o app não expressava:
//   `pct_recebido` — % da receita RECEBIDA, com juros de tabela (marketing,
//                    registro, manutenção pós-obra, marketing global, gestão);
//   `pct_constr`   — % do custo de construção (Projetos: 1,6% × R$ 101.760.000).
// Os testes de motor medem o NÚMERO que sai do fluxo, não só a função pura: é
// a classe de defeito nº 1 (a base pronta e o motor sem passá-la).

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

// 10 unidades × 100 m² × R$ 10.000 = VGV de tabela R$ 10.000.000, vendidas no
// mês 12 e pagas em 12 parcelas fixas — com juros de tabela, o recebido supera
// o VGV de tabela.
const LINHA_RECEITA = {
  id: 1, nome: 'Venda', tipologias: [{ id: 1, quantidade: 10, area_privativa_m2: 100, preco_m2: 10_000 }],
  absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
  fluxo_pagamento: { componentes: [
    { tipo: 'prazo_fixo', participacaoPct: 100, prazoMeses: 12, defasagemMeses: 1, sinalPct: 0 },
  ] },
};
const VGV_TABELA = 10_000_000;

function custo(id: number, grupo: string, categoria: string, unidade: string, valor: number) {
  return {
    id, grupo, categoria, subcategoria: null, orcamento_unidade: unidade, orcamento_valor: valor,
    orcamento_valor_canonico: null, inicio_mes: 0, duracao_meses: 1, cronograma_evento: 'customizado',
  };
}

function fluxo(linhasCusto: any[], jurosTabelaAaEstudo = 12.5) {
  const config: FluxoConfig = {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita: [LINHA_RECEITA], linhasCusto, areaTerreno: 0, jurosTabelaAaEstudo,
  };
  return calcularFluxo(config);
}

const totalDaLinha = (c: ReturnType<typeof fluxo>, id: number) => {
  const l = c.linhasCusto.find((x) => x.id === id);
  assert.ok(l, `linha de custo ${id} ausente do fluxo`);
  return l!.total;
};

test('resolverCustoTotal: pct_recebido aplica sobre a receita recebida; pct_constr sobre o custo de construção', () => {
  const ctx = { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 100, receitaRecebida: 2_000_000, totalConstrucao: 101_760_000 };
  assert.equal(resolverCustoTotal({ orcamento_valor: 1, orcamento_unidade: 'pct_recebido' }, ctx), 20_000);
  assert.ok(perto(resolverCustoTotal({ orcamento_valor: 1.6, orcamento_unidade: 'pct_constr' }, ctx), 1_628_160));
  // Sem a base no contexto, o custo é zero — nunca cai no VGV de tabela, que é
  // exatamente a base errada que a unidade existe para não usar.
  assert.equal(resolverCustoTotal({ orcamento_valor: 1, orcamento_unidade: 'pct_recebido' }, { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 100 }), 0);
});

test('totalConstrucaoCustos: Construção + Decoração + Gestão da obra; fora Outorga, Contingência e linhas pct_constr', () => {
  assert.deepEqual([...CATEGORIAS_BASE_CONSTRUCAO], ['Construção', 'Decoração', 'Gestão da obra']);
  const custos = [
    custo(1, 'obra', 'Construção', 'rs', 96_000_000),
    custo(2, 'obra', 'Decoração', 'rs', 500_000),
    custo(3, 'obra', 'Gestão da obra', 'pct_obra', 6),
    custo(4, 'obra', 'Outorga', 'rs', 1_000_000),
    custo(5, 'obra', 'Contingência', 'rs', 2_000_000),
    custo(6, 'obra', 'Construção', 'pct_constr', 10),
    custo(7, 'diretos', 'Projetos', 'rs', 3_000_000),
  ];
  const totalObra = 96_000_000 + 500_000 + 1_000_000 + 2_000_000; // pct_obra fora; pct_constr resolve 0 sem base
  const ctx = { areaPrivativaTotal: 0, areaTerreno: 0, vgvTotal: 0, totalObra };
  const gestao = totalObra * 0.06;
  assert.ok(perto(totalConstrucaoCustos(custos, ctx), 96_000_000 + 500_000 + gestao));
  // `excluirId` tira a linha que está sendo convertida.
  assert.ok(perto(totalConstrucaoCustos(custos, ctx, 2), 96_000_000 + gestao));
});

test('motor: pct_recebido de 1% sobre um fluxo com juros dá 1% da receita recebida, não do VGV de tabela', () => {
  const c = fluxo([custo(10, 'diretos', 'Marketing & Publicidade', 'pct_recebido', 1)]);
  assert.ok(c.receitaBruta > VGV_TABELA + 100_000, `os juros de tabela não entraram no recebido: ${c.receitaBruta}`);
  const total = totalDaLinha(c, 10);
  assert.ok(perto(total, c.receitaBruta * 0.01, 0.05), `pct_recebido=${total} × 1% da receita recebida=${c.receitaBruta * 0.01}`);
  assert.ok(!perto(total, VGV_TABELA * 0.01, 100), 'pct_recebido caiu no VGV de tabela');
  // A 100%, a linha é a própria base — e ela bate AO CENTAVO com a
  // `receitaBruta` publicada, que é o número que a tela de Custos lê.
  const cem = fluxo([custo(10, 'diretos', 'Marketing & Publicidade', 'pct_recebido', 100)]);
  assert.ok(perto(totalDaLinha(cem, 10), cem.receitaBruta, 0.005), `${totalDaLinha(cem, 10)} × ${cem.receitaBruta}`);
  // Sem juros, recebido = VGV de tabela, e as duas bases coincidem.
  const semJuros = fluxo([custo(10, 'diretos', 'Marketing & Publicidade', 'pct_recebido', 1)], 0);
  assert.ok(perto(totalDaLinha(semJuros, 10), VGV_TABELA * 0.01, 0.05));
});

test('motor: Projetos em pct_constr reproduz a EVI — 1,6% × (construção + gestão da obra) = R$ 1.628.160', () => {
  const c = fluxo([
    custo(1, 'obra', 'Construção', 'rs', 96_000_000),
    custo(2, 'obra', 'Gestão da obra', 'pct_obra', 6),
    custo(3, 'diretos', 'Projetos', 'pct_constr', 1.6),
  ]);
  assert.ok(perto(totalDaLinha(c, 2), 5_760_000));
  assert.ok(perto(totalDaLinha(c, 3), 1_628_160), `Projetos=${totalDaLinha(c, 3)}`);
  // A base acompanha a construção: dobrar a construção dobra Projetos.
  const dobro = fluxo([
    custo(1, 'obra', 'Construção', 'rs', 192_000_000),
    custo(2, 'obra', 'Gestão da obra', 'pct_obra', 6),
    custo(3, 'diretos', 'Projetos', 'pct_constr', 1.6),
  ]);
  assert.ok(perto(totalDaLinha(dobro, 3), 2 * 1_628_160));
  // A Outorga entra na base da Gestão da obra (`pct_obra` é o grupo inteiro),
  // mas NÃO na base de Projetos — só pela gestão que incidiu sobre ela.
  const comOutorga = fluxo([
    custo(1, 'obra', 'Construção', 'rs', 96_000_000),
    custo(2, 'obra', 'Gestão da obra', 'pct_obra', 6),
    custo(4, 'obra', 'Outorga', 'rs', 1_000_000),
    custo(3, 'diretos', 'Projetos', 'pct_constr', 1.6),
  ]);
  assert.ok(perto(totalDaLinha(comOutorga, 3), 0.016 * (96_000_000 + 0.06 * 97_000_000)));
});

test('motor: Decoração e Gestão da obra de estudo migrado (grupo diretos) entram na base de pct_constr', () => {
  // A migração 002 moveu as duas categorias de `obra` para `diretos`; a base
  // casa pela categoria, como os buckets da Proforma do Avançado.
  const c = fluxo([
    custo(1, 'obra', 'Construção', 'rs', 96_000_000),
    custo(2, 'diretos', 'Gestão da obra', 'rs', 5_760_000),
    custo(5, 'diretos', 'Decoração', 'rs', 1_000_000),
    custo(3, 'diretos', 'Projetos', 'pct_constr', 1.6),
  ]);
  assert.ok(perto(totalDaLinha(c, 3), 0.016 * (96_000_000 + 5_760_000 + 1_000_000)), `Projetos=${totalDaLinha(c, 3)}`);
});

// ── Preliminar ──────────────────────────────────────────────────────────

const INC: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 100 }],
  area_pvt_r_fechada: 10_000,
  construcao_modo: 'valor_total', construcao_valor_total: 96_000_000,
  custo_decoracao_m2: 0, taxa_gestao_pct: 6,
  projetos_modo: 'pct_vgv', projetos_pct: 1.6,
} as ProformaInput;

test('Preliminar: Projetos em pct_constr = % do custo de obras (construção + decoração + gestão)', () => {
  const p = calcularProforma({ ...INC, projetos_modo: 'pct_constr' });
  assert.ok(perto(p.custoObras, 101_760_000), `custoObras=${p.custoObras}`);
  assert.ok(perto(p.projetos, 1_628_160), `projetos=${p.projetos}`);
  // Mesma coluna (`projetos_pct`), base diferente: em pct_vgv sai sobre o VGV.
  const vgv = calcularProforma(INC);
  assert.ok(perto(vgv.projetos, vgv.vgv * 0.016));
  assert.ok(!perto(vgv.projetos, p.projetos, 1));
  // O canônico em R$, quando existe, continua prevalecendo sobre o modo.
  const can = calcularProforma({ ...INC, projetos_modo: 'pct_constr', projetos_valor_canonico: 1_000_000 });
  assert.equal(can.projetos, 1_000_000);
});

test('Preliminar: a decoração entra no custo de obras que serve de base a pct_constr', () => {
  const p = calcularProforma({ ...INC, projetos_modo: 'pct_constr', custo_decoracao_m2: 100 });
  assert.ok(p.decoracao > 0);
  assert.ok(perto(p.projetos, 0.016 * (96_000_000 + p.decoracao) * 1.06), `projetos=${p.projetos}`);
});

test('Preliminar: o memo de Projetos deriva o % do valor aplicado, não da coluna compartilhada', () => {
  // Estudo a 1,6% do VGV que trocou a badge para % Construção: o canônico
  // guarda o R$ e `projetos_pct` continua 1,6 — um % da OUTRA base.
  const memo = (e: ProformaInput) => {
    const p = calcularProforma(e);
    const linha = montarLinhasProforma(p, p.vgv, { estudo: e, produtos: e.produtos ?? [], aliquotaRet: 4 })
      .find((l) => /Projetos/.test(l.l));
    assert.ok(linha, 'linha de Projetos ausente');
    return { memo: linha!.memo, p };
  };
  const vgv = calcularProforma(INC).vgv;
  const trocado = memo({ ...INC, projetos_modo: 'pct_constr', projetos_valor_canonico: vgv * 0.016 });
  const esperado = (vgv * 0.016) / trocado.p.custoObras * 100;
  assert.equal(trocado.memo, `${fmtNum(esperado, 2)}% do custo de obras`);
  assert.notEqual(trocado.memo, '1,6% do custo de obras', 'o memo leu a coluna compartilhada');
  // Sem canônico (linha legada), a coluna É o percentual aplicado.
  const legado = memo({ ...INC, projetos_modo: 'pct_constr' });
  assert.equal(legado.memo, '1,6% do custo de obras');
  // Canônico com base zerada: não há % a publicar — o memo não repete a coluna.
  const semBase = memo({ ...INC, projetos_modo: 'pct_constr', construcao_valor_total: 0, construcao_valor_canonico: 0, taxa_gestao_pct: 0, projetos_valor_canonico: 500_000 });
  assert.equal(semBase.p.custoObras, 0);
  assert.equal(semBase.memo, 'valor fixo');
  // A recíproca: canônico vindo da base de construção, modo de volta a % VGV.
  const volta = memo({ ...INC, projetos_modo: 'pct_vgv', projetos_valor_canonico: 1_628_160 });
  assert.equal(volta.memo, `${fmtNum(1_628_160 / vgv * 100, 2)}% do VGV`);
});

test('Preliminar: a badge de Projetos converte sobre o custo de obras que a Proforma publica', () => {
  const p = calcularProforma(INC);
  assert.equal(ctxConversaoPreliminar(p).custoObras, p.custoObras);
});
