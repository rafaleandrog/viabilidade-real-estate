import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFluxo, taxaMensalDeAnual,
  type FluxoConfig,
} from './fluxo-caixa-motor.js';
import { type EventoCrono } from './fluxo-shared.js';

// #477: "a linha de receita é a unidade de regime comercial" — cada Grupo tem
// sua própria absorção e plano de pagamento, e o motor NUNCA mistura a
// carteira de um Grupo com a de outro.
//
// 🔴 **#585 SUPERSEDE a parte de JUROS desta suíte, e a perda é real.** Até
// 2026-08-26 cada Grupo tinha também a sua taxa de tabela, e o caso que este
// arquivo exercitava era o par que a EVI Urbitá trata via `Premissas!H16`:
// Residencial 12,5% a.a. × Não Residencial 13% a.a. A decisão do autor tornou
// a taxa um valor do ESTUDO — uma só, para todas as linhas —, e **esse cenário
// deixou de ser representável**. Não é bug da #477: é decisão nova, e está
// escrita aqui para o próximo leitor não "consertar" a suíte de volta.
//
// O que CONTINUA valendo, e é o que esta suíte guarda: as carteiras seguem
// isoladas por linha. Rodar duas linhas juntas produz exatamente a SOMA de
// rodar cada uma sozinha — se o motor comprimisse os saldos numa carteira
// compartilhada, a capitalização composta faria a soma dos juros mudar.

const perto = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;
const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const CRONO: EventoCrono[] = [
  { evento: 'planejamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'pre_lancamento', inicio_mes: 6, duracao_meses: 6 },
  { evento: 'lancamento', inicio_mes: 12, duracao_meses: 1 },
  { evento: 'obra', inicio_mes: 17, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 41, duracao_meses: 12 },
];

/**
 * #585: `taxaAaPct` continua no shape persistido porque é assim que o dado
 * está gravado — mas ele é INERTE desde a #585. Quem manda é
 * `config(..., jurosAaEstudo)`. Os testes abaixo provam as duas coisas.
 */
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

function config(linhasReceita: any[], jurosAaEstudo = 0): FluxoConfig {
  return {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, cronograma: CRONO,
    jurosTabelaAaEstudo: jurosAaEstudo,
    linhasReceita, linhasCusto: [], areaTerreno: 0,
  };
}

test('#585: a taxa persistida por linha ficou INERTE — quem manda é a do estudo', () => {
  // As duas linhas trazem taxas DIFERENTES no dado (12,5% × 13%), como um
  // estudo gravado antes da #585. Com a taxa do estudo em 12,5%, as duas
  // calculam a 12,5% — e o resultado é idêntico ao de duas linhas que já
  // tivessem 12,5% gravados. Se o dado da linha ainda mandasse, os dois
  // números divergiriam.
  const heterogeneo = [linhaReceita('Residencial', 12.5, 7_000_000),
                       linhaReceita('Não residencial', 13, 3_000_000)];
  const jaUniforme  = [linhaReceita('Residencial', 12.5, 7_000_000),
                       linhaReceita('Não residencial', 12.5, 3_000_000)];

  const a = calcularFluxo(config(heterogeneo, 12.5));
  const b = calcularFluxo(config(jaUniforme, 12.5));
  assert.ok(a.jurosClientes > 0, 'sem juros na base — o teste passaria por vacuidade');
  assert.ok(perto(a.jurosClientes, b.jurosClientes, 0.02),
    'a taxa gravada na linha voltou a mandar — ela é inerte desde a #585');

  // E mudar a taxa do ESTUDO muda o número, que é o pedido da issue.
  const c = calcularFluxo(config(heterogeneo, 13));
  assert.ok(c.jurosClientes > a.jurosClientes,
    'editar o campo da aba Financeiro não mexeu no cálculo das linhas existentes');
});

test('#477/#585: carteiras continuam isoladas por linha — juntas somam o que cada uma dá sozinha', () => {
  // A parte da #477 que a #585 NÃO revoga. Com a taxa única, as duas linhas
  // ainda são carteiras separadas: comprimi-las numa só mudaria a soma dos
  // juros, porque capitalização composta não é linear.
  const residencial = linhaReceita('Residencial', 12.5, 7_000_000);
  const naoResidencial = linhaReceita('Não residencial', 12.5, 3_000_000);
  const AA = 12.5;

  const rResidencial = calcularFluxo(config([residencial], AA));
  const rNaoResidencial = calcularFluxo(config([naoResidencial], AA));
  const combinado = calcularFluxo(config([residencial, naoResidencial], AA));

  assert.ok(rResidencial.jurosClientes > 0);
  assert.ok(rNaoResidencial.jurosClientes > 0);
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

  // Receita Bruta continua fechando por linha (venda líquida + juros).
  assert.ok(perto(combinado.receitaBruta, combinado.vendaLiquidaContratada + combinado.jurosClientes, 0.02));
});

test('#477/#585: taxa 0% no estudo não produz juros — nem quando a linha traz taxa gravada', () => {
  assert.equal(calcularFluxo(config([linhaReceita('Grupo único', 0, 5_000_000)])).jurosClientes, 0);
  // #585: e com 12,5% GRAVADOS na linha e 0% no estudo, o resultado é o mesmo
  // zero. É o outro sentido do override, e o que impede a taxa velha de
  // sobreviver escondida no JSON.
  assert.equal(calcularFluxo(config([linhaReceita('Grupo único', 12.5, 5_000_000)])).jurosClientes, 0);
});
