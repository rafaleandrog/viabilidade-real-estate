// Aba Estrutura de capital do Funding — o rótulo de nível, os dados da aba,
// a geometria da torre e a pureza dos módulos novos.
//
// ⚠️ O que este arquivo NÃO prova, e os casos de render provam: que a aba
// MONTA a torre com as camadas, na ordem, e que a tabela da sequência repete na
// tela o texto dos cartões. Teste de função pura não enxerga fiação — classe de
// defeito nº 1 do `CLAUDE.md`. A defesa daquela metade é
// `frontend/render/casos/funding-estrutura.ts` e `grafico-stack-capital.ts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal, type OperacaoFunding,
} from './funding-motor.js';
import { mesRepasse } from './fluxo-shared.js';
import {
  camadasDoStack, indicadoresEstrutura, rotuloNivelCamada, sequenciaDeEstrutura, totaisDaEstrutura,
} from './funding-estrutura.js';
import { dadosDaEstrutura, estruturaCompleta } from './funding-estrutura-dados.js';
import { dadosDoCartao, valorEmReais, valorPercentual } from './funding-cartao-dados.js';
import { corDoTipo, numeroDaCor, COR_DO_TIPO } from './funding-cores.js';
import {
  ALTURA_MINIMA_CAMADA, ALTURA_TORRE, alturasDasCamadas, nomeAcessivelCamada,
} from './stack-capital-desenho.js';

// ── Fixture: o motor real, montado como a tela monta (`_recalcular`) ─────

const CRONO = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 3 },
  { evento: 'obra', inicio_mes: 3, duracao_meses: 12 },
  { evento: 'pos_obra', inicio_mes: 15, duracao_meses: 12 },
] as any;

const CONFIG: FluxoConfig = {
  dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO, jurosTabelaAaEstudo: 0,
  linhasReceita: [{
    id: 1, nome: 'Vendas',
    tipologias: [{ id: 1, quantidade: 40, area_privativa_m2: 60, preco_m2: 10_000 }],
    absorcao: { modo: 'linear' },
    fluxo_pagamento: {
      componentes: [
        { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
        { tipo: 'carteira_pos_marco', participacaoPct: 80, marcoMes: 14, carenciaMeses: 0, prazoMeses: 36 },
      ],
    },
  }],
  linhasCusto: [
    { id: 1, grupo: 'terreno', categoria: 'Preço', orcamento_valor: 4_000_000, orcamento_unidade: 'rs', inicio_mes: 0, duracao_meses: 1 },
    { id: 2, grupo: 'obra', categoria: 'Construção', orcamento_valor: 12_000_000, orcamento_unidade: 'rs', inicio_mes: 3, duracao_meses: 12 },
  ],
  areaTerreno: 3_000,
};

const FAP: OperacaoFunding = {
  id: 10, tipo: 'financiamento_producao', nome: 'Plano empresário', valor: 0, inicio_mes: 0, taxa_anual: 12.5,
  exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true, ativo: true,
};
const DIVIDA: OperacaoFunding = {
  id: 20, tipo: 'divida', nome: 'Crédito de terreno', ordem: 1, valor: 3_000_000, inicio_mes: 0, taxa_anual: 14,
  periodo_amortizacao_meses: 24, periodo_carencia_meses: 6, aporte_meses: 1,
} as OperacaoFunding;
const ANTECIPACAO: OperacaoFunding = {
  id: 30, tipo: 'antecipacao_recebiveis', nome: 'Cessão', valor: 0, inicio_mes: 16, taxa_anual: 18,
  pct_carteira_cedida: 40,
} as OperacaoFunding;
const EQUITY: OperacaoFunding = {
  id: 40, tipo: 'equity', nome: '', valor: 1_500_000, inicio_mes: 1,
  modo_retorno: 'resultado_final', pct_retorno: 6,
};
const QUATRO = [EQUITY, ANTECIPACAO, FAP, DIVIDA];

/** A montagem de `_recalcular`: um fluxo do projeto só, e o funding simulado sobre ele para cada subconjunto. */
function montar(ops: OperacaoFunding[]) {
  const calc = calcularFluxo({ ...CONFIG, operacoesFunding: ops });
  const rl = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, CONFIG.linhasCusto);
  const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
  const simularFunding = (sub: OperacaoFunding[]) => fundingDoEstudo(
    sub, calc.fluxoMensal, rl, resultadoFinal, mesRepasse(CRONO), 12,
    { custosRaw: CONFIG.linhasCusto, linhasCusto: calc.linhasCusto, cronograma: CRONO, recebimentoPorSafraMensal: calc.recebimentoPorSafraMensal },
  );
  const funding = simularFunding(ops);
  const sequencia = sequenciaDeEstrutura(ops, (sub) => indicadoresEstrutura(calc, sub.length ? simularFunding(sub) : null))!;
  return { calc, funding, sequencia };
}

const ROTULO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção', divida: 'Dívida',
  antecipacao_recebiveis: 'Antecipação de recebíveis', equity: 'Equity',
};
const rotuloTipo = (t: string) => ROTULO[t] ?? t;
const somaDe = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ── Rótulo de nível ─────────────────────────────────────────────────────

test('rótulo de nível: um por tipo, e o incorporador recebe por último', () => {
  const ops = [{ id: 1, modo_retorno: 'permuta_financeira' }, { id: 2, modo_retorno: 'resultado_final' }];
  assert.equal(rotuloNivelCamada({ id: 9, tipo: 'financiamento_producao' }, ops), 'sênior · base');
  assert.equal(rotuloNivelCamada({ id: 9, tipo: 'divida' }, ops), 'dívida');
  assert.equal(rotuloNivelCamada({ id: 9, tipo: 'antecipacao_recebiveis' }, ops), 'cessão de recebíveis');
  assert.equal(rotuloNivelCamada({ id: 'incorporador', tipo: 'incorporador' }, ops), 'recebe por último');
});

test('rótulo de nível do equity: a preferência da operação achada pelo id', () => {
  const ops = [{ id: 1, modo_retorno: 'permuta_financeira' }, { id: '2', modo_retorno: 'resultado_final' }];
  assert.equal(rotuloNivelCamada({ id: 1, tipo: 'equity' }, ops), 'recebe sobre a receita');
  // id como número na camada e texto na operação: a comparação é por String.
  assert.equal(rotuloNivelCamada({ id: 2, tipo: 'equity' }, ops), 'participa do resultado');
  // Operação ausente e camada sem id caem no padrão do motor (permuta financeira).
  assert.equal(rotuloNivelCamada({ id: 99, tipo: 'equity' }, ops), 'recebe sobre a receita');
  assert.equal(rotuloNivelCamada({ id: null, tipo: 'equity' }, ops), 'recebe sobre a receita');
});

// ── Cor do incorporador ─────────────────────────────────────────────────

test('cor: o incorporador tem o quinto N, distinto dos quatro tipos', () => {
  assert.equal(numeroDaCor('incorporador'), 5);
  assert.equal(Object.values(COR_DO_TIPO).includes(5), false);
  assert.equal(corDoTipo('incorporador'), 'var(--cor-categoria-5)');
});

// ── Dados da aba ────────────────────────────────────────────────────────

const M = montar(QUATRO);
const D = dadosDaEstrutura({ calc: M.calc, funding: M.funding, sequencia: M.sequencia, operacoes: QUATRO, rotuloTipo });

test('camadas: senioridade, nível, cor da categoria e percentuais somando 100', () => {
  assert.deepEqual(D.camadas.map((c) => c.tipo), ['financiamento_producao', 'divida', 'antecipacao_recebiveis', 'equity', 'incorporador']);
  assert.deepEqual(D.camadas.map((c) => c.nivel), [
    'sênior · base', 'dívida', 'cessão de recebíveis', 'participa do resultado', 'recebe por último',
  ]);
  assert.deepEqual(D.camadas.map((c) => c.cor), D.camadas.map((c) => corDoTipo(c.tipo)));
  assert.ok(Math.abs(somaDe(D.camadas.map((c) => c.pct ?? 0)) - 100) < 1e-9);
});

test('a estrutura completa é o "depois" do último passo — igual à simulação com todas as operações', () => {
  const completa = estruturaCompleta(M.sequencia);
  assert.deepEqual(completa, indicadoresEstrutura(M.calc, M.funding));
  // As camadas são exatamente as do núcleo, sobre essa estrutura.
  const brutas = camadasDoStack(M.funding, completa);
  assert.deepEqual(D.camadas.map(({ nivel, cor, ...c }) => c), brutas);
});

test('totais: os quatro números de `totaisDaEstrutura`, no formatador do cartão', () => {
  const completa = estruturaCompleta(M.sequencia);
  const t = totaisDaEstrutura(M.calc, camadasDoStack(M.funding, completa), completa);
  assert.deepEqual(D.totais, [
    { rotulo: 'Usos totais', valor: valorEmReais(t.usosTotais) },
    { rotulo: 'Dívida', valor: valorEmReais(t.divida) },
    { rotulo: 'Equity de terceiros', valor: valorEmReais(t.equityTerceiros) },
    { rotulo: 'Incorporador no pico', valor: valorEmReais(t.incorporadorNoPico) },
  ]);
});

test('tabela: começa no projeto sem funding, um passo por operação, termina na estrutura completa', () => {
  assert.equal(D.linhas.length, M.sequencia.passos.length + 1);
  assert.equal(D.linhas[0].passo, 'Projeto sem funding');
  assert.deepEqual(D.linhas[0].tir, valorPercentual(M.sequencia.base.tirAlavancada, true));
  assert.deepEqual(D.linhas.slice(1).map((l) => l.id), ['10', '20', '30', '40']);
  // Operação sem nome: o rótulo do tipo.
  assert.equal(D.linhas[4].passo, 'Equity');
  const completa = estruturaCompleta(M.sequencia);
  const ultima = D.linhas[D.linhas.length - 1];
  assert.deepEqual(ultima.exposicao, valorEmReais(Math.abs(completa.exposicaoMaxima)));
  assert.deepEqual(ultima.tir, valorPercentual(completa.tirAlavancada, true));
  // E o "incorporador no pico" é a mesma figura da última linha.
  assert.deepEqual(D.totais[3].valor, ultima.exposicao);
});

test('tabela: o "depois" de cada passo é o MESMO texto do cartão da operação', () => {
  for (const p of M.sequencia.passos) {
    if (p.operacao.tipo === 'financiamento_producao') continue; // não tem cartão
    const serie = M.funding!.operacoes.find((s) => s.operacao.id === p.operacao.id) ?? null;
    const cartao = dadosDoCartao({
      operacao: p.operacao as any, serie, passo: p, vgvTotal: M.calc.vgvTotal, dataInicio: 'jan/2027', rotuloTipo: rotuloTipo(p.operacao.tipo),
    });
    const kpi = (r: string) => cartao.kpis.find((k) => k.rotulo === r)!.valor;
    const linha = D.linhas.find((l) => l.id === String(p.operacao.id))!;
    assert.deepEqual(linha.tir, kpi('TIR alavancada'), `TIR do passo ${p.operacao.id}`);
    assert.deepEqual(linha.exposicao, kpi('Exposição máxima'), `exposição do passo ${p.operacao.id}`);
  }
});

test('sem operação: só a camada do incorporador, e a tabela só com o projeto sem funding', () => {
  const s = montar([]);
  const d = dadosDaEstrutura({ calc: s.calc, funding: s.funding, sequencia: s.sequencia, operacoes: [], rotuloTipo });
  assert.deepEqual(d.camadas.map((c) => c.tipo), ['incorporador']);
  assert.equal(d.camadas[0].valor, Math.abs(s.sequencia.base.exposicaoMaxima));
  assert.deepEqual(d.linhas.map((l) => l.passo), ['Projeto sem funding']);
});

test('Financiamento à produção desligado não vira camada nem passo', () => {
  const ops = [{ ...FAP, ativo: false }, DIVIDA];
  const s = montar(ops);
  const d = dadosDaEstrutura({ calc: s.calc, funding: s.funding, sequencia: s.sequencia, operacoes: ops, rotuloTipo });
  assert.deepEqual(d.camadas.map((c) => c.tipo), ['divida', 'incorporador']);
  assert.deepEqual(d.linhas.map((l) => l.id), ['base', '20']);
});

// ── Geometria da torre ──────────────────────────────────────────────────

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('altura: proporcional quando todas as camadas passam do piso', () => {
  const h = alturasDasCamadas([1, 2, 3], 360, 28);
  assert.ok(perto(h[0], 60) && perto(h[1], 120) && perto(h[2], 180), JSON.stringify(h));
});

test('altura: o piso só se aplica abaixo do limiar, e o resto segue proporcional', () => {
  // Uma camada de 0,5% ao lado de outras grandes.
  const valores = [0.5, 30, 69.5];
  const h = alturasDasCamadas(valores, ALTURA_TORRE, ALTURA_MINIMA_CAMADA);
  assert.equal(h[0], ALTURA_MINIMA_CAMADA, 'a pequena vai para o piso');
  assert.ok(h[1] > ALTURA_MINIMA_CAMADA && h[2] > ALTURA_MINIMA_CAMADA, 'as grandes NÃO vão para o piso');
  assert.ok(perto(h[2] / h[1], 69.5 / 30), 'entre as grandes a proporção é a verdadeira');
  assert.ok(perto(somaDe(h), ALTURA_TORRE), 'a torre mantém a altura');
  // Camada exatamente no limiar não é "promovida": fica no próprio valor.
  const limiar = alturasDasCamadas([28, 332], 360, 28);
  assert.ok(perto(limiar[0], 28) && perto(limiar[1], 332));
});

test('altura: com camadas demais para o piso, a torre cresce em vez de esmagar', () => {
  const h = alturasDasCamadas(new Array(15).fill(1), 360, 28);
  assert.ok(h.every((x) => perto(x, 28)));
  assert.equal(alturasDasCamadas([], 360, 28).length, 0);
});

test('nome acessível: nome, nível, valor exato em 2 casas e o percentual', () => {
  const nome = nomeAcessivelCamada({ nome: 'Crédito', nivel: 'dívida', valor: 123_456_789.5, pct: 12.34 });
  assert.equal(nome.replace(/ /g, ' '), 'Crédito, dívida, R$ 123.456.789,50, 12,3% do total das camadas');
});

// ── Pureza e fiação na fonte ────────────────────────────────────────────

const fonte = (f: string) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
/** Import de VALOR (não `import type`) de um módulo. */
const importaValorDe = (texto: string, modulo: string) =>
  new RegExp(`^import\\s+(?!type\\b)[^;]*from\\s+['"]\\./${modulo}['"]`, 'm').test(texto);

test('o componente e os módulos da aba não simulam: sem funding do estudo, sem motor de fluxo', () => {
  for (const f of ['grafico-stack-capital.ts', 'stack-capital-desenho.ts', 'funding-estrutura-dados.ts']) {
    const t = fonte(f);
    assert.equal(t.includes('fundingDoEstudo('), false, `${f} chama fundingDoEstudo`);
    assert.equal(t.includes('calcularFluxo('), false, `${f} calcula o fluxo`);
    assert.equal(importaValorDe(t, 'funding-motor\\.js'), false, `${f} importa valor de funding-motor`);
    assert.equal(importaValorDe(t, 'fluxo-caixa-motor\\.js'), false, `${f} importa valor de fluxo-caixa-motor`);
  }
});

test('a aba lê a sequência do estado e monta a torre com as camadas da aba', () => {
  const t = fonte('tela-funding.ts');
  const de = t.indexOf('private _renderAbaEstrutura(');
  assert.notEqual(de, -1, 'a aba Estrutura de capital não tem render próprio');
  const corpo = t.slice(de, t.indexOf('\n  render() {', de));
  assert.ok(corpo.includes('sequencia: this.sequencia'), 'a aba não lê a sequência do @state');
  assert.ok(corpo.includes('<viab-grafico-stack-capital .camadas=${d.camadas}>'), 'a torre não recebe as camadas');
  assert.equal(/fundingDoEstudo\(|sequenciaDeEstrutura\(|calcularFluxo\(/.test(corpo), false, 'a aba simula por conta própria');
});
