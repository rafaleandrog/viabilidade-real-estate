import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFluxo, taxaMensalDeAnual,
  type FluxoConfig,
} from './fluxo-caixa-motor.js';
import { type EventoCrono } from './fluxo-shared.js';

// #477: "a linha de receita é a unidade de regime comercial" — cada Grupo tem
// sua própria absorção, plano de pagamento e taxa de juros de tabela, e o
// motor NUNCA mistura a carteira de um Grupo com a de outro. Esta suíte não
// testa código NOVO (a estrutura já existe desde sempre, #477 só a documenta
// e acrescenta o default herdado na criação) — é o regression test que o
// critério de aceite da issue pede: dois grupos com taxas diferentes
// (Residencial 12,5% a.a. × Não residencial 13% a.a., o par que a EVI trata
// via `Premissas!H16`) produzem `jurosClientes` igual à SOMA dos dois, sem
// misturar carteiras.

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

function linhaReceita(nome: string, taxaAaPct: number, vgv: number) {
  return {
    id: nome, nome,
    tipologias: [{ id: 1, quantidade: 1, area_privativa_m2: 100, preco_m2: vgv / 100 }],
    absorcao: { modo: 'personalizado', meses: [{ mes: 12, pct: 100 }] },
    fluxo_pagamento: {
      componentes: [{
        tipo: 'prazo_fixo', participacaoPct: 100, sinalPct: 0,
        prazoMeses: 24, defasagemMeses: 1, taxaMensal: taxaMensalDeAnual(taxaAaPct),
        jurosNoMesDaContratacao: false,
      }],
    },
  };
}

function config(linhasReceita: any[]): FluxoConfig {
  return {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    linhasReceita, linhasCusto: [], areaTerreno: 0,
  };
}

test('#477: dois Grupos com taxas de tabela diferentes somam jurosClientes sem misturar carteiras', () => {
  const residencial = linhaReceita('Residencial', 12.5, 7_000_000);
  const naoResidencial = linhaReceita('Não residencial', 13, 3_000_000);

  const rResidencial = calcularFluxo(config([residencial]));
  const rNaoResidencial = calcularFluxo(config([naoResidencial]));
  const combinado = calcularFluxo(config([residencial, naoResidencial]));

  // As duas taxas produzem juros reais e DIFERENTES entre si — se o motor
  // aplicasse uma taxa só (ex.: a primeira linha vazando para a segunda), os
  // dois resultados individuais seriam iguais, o que não é o caso aqui.
  assert.ok(rResidencial.jurosClientes > 0);
  assert.ok(rNaoResidencial.jurosClientes > 0);
  assert.notEqual(rResidencial.jurosClientes, rNaoResidencial.jurosClientes);

  // O teste que importa: rodar as duas linhas JUNTAS produz exatamente a SOMA
  // de rodar cada uma SOZINHA — é isso que "carteiras isoladas por linha"
  // significa operacionalmente. Se o motor comprimisse os saldos das duas
  // linhas numa única safra/carteira compartilhada, a soma dos juros mudaria
  // (a capitalização composta não é linear).
  assert.ok(perto(combinado.jurosClientes, rResidencial.jurosClientes + rNaoResidencial.jurosClientes, 0.02));
  assert.ok(perto(
    soma(combinado.jurosClientesMensal),
    soma(rResidencial.jurosClientesMensal) + soma(rNaoResidencial.jurosClientesMensal),
    0.02,
  ));

  // receitaPorComponenteMensal (tabelaCurta é o bucket do componente
  // `prazo_fixo`) agrega os dois Grupos sem perder nem duplicar valor.
  assert.ok(perto(
    soma(combinado.receitaPorComponenteMensal.tabelaCurta),
    soma(rResidencial.receitaPorComponenteMensal.tabelaCurta) + soma(rNaoResidencial.receitaPorComponenteMensal.tabelaCurta),
    0.02,
  ));

  // Receita Bruta continua fechando por linha (venda líquida + juros), com as
  // duas taxas convivendo no mesmo estudo.
  assert.ok(perto(combinado.receitaBruta, combinado.vendaLiquidaContratada + combinado.jurosClientes, 0.02));
});

test('#477: taxa 0% (default de estudo sem configuração) não produz juros — mesmo comportamento de sempre', () => {
  const r = calcularFluxo(config([linhaReceita('Grupo único', 0, 5_000_000)]));
  assert.equal(r.jurosClientes, 0);
});
