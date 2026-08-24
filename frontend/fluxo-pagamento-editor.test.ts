import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentesParaSalvar,
  erroFormularioPagamento,
  fluxoPagamentoParaSalvar,
  formularioPagamento,
  jurosDeTabelaConfigurados,
  taxasDistintasDoPlano,
} from './fluxo-pagamento-editor.js';
import {
  calcularFluxo, jurosTabelaAnualPct, taxaMensalDeAnual,
  type FluxoConfig,
} from './fluxo-caixa-motor.js';
import { validarFluxoCalc } from './fluxo-invariantes.js';
import { readFileSync } from 'node:fs';
import {
  receitaLiquidaComCorretagemMensal,
  simularEquity,
  type ModoRetorno,
  type OperacaoFunding,
} from './funding-motor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];
const perto12 = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= tol;

test('#248 configuração nova persiste contrato canônico e espelho legado', () => {
  const form = formularioPagamento(null);
  const salvo = fluxoPagamentoParaSalvar(form, CRONO);

  assert.equal(erroFormularioPagamento(form, CRONO), null);
  assert.deepEqual(salvo.componentes.map((c) => [c.tipo, c.participacaoPct]), [
    ['imediato', 15],
    ['ate_marco', 15],
    ['concentrado', 70],
  ]);
  assert.equal(salvo.entrada[0].pct, 15);
  assert.equal(salvo.parcelas[0].periodicidade, 'mensal');
  assert.equal(salvo.aplicado, true);
});

test('#248 leitura de shapes legados não reinterpreta os campos', () => {
  const legado = {
    comissao: { ativo: false, tipo: 'destacada', pct: 4 },
    entrada: { pct: 20, parcelas: 1, descontoPct: 5 },
    parcelas: { pct: 30, periodicidade: 'trimestral', parcelas: 10, ao_longo_obra: false },
    repasse: { apos_entrega_meses: 6 },
  };
  const form = formularioPagamento(legado);
  assert.deepEqual(form.entrada, [legado.entrada]);
  assert.deepEqual(form.parcelas, [legado.parcelas]);
  assert.equal(form.repasse.apos_entrega_meses, 6);
});

test('#248 bloqueia soma acima de 100% antes de chamar o backend', () => {
  const form = formularioPagamento(null);
  form.entrada[0].pct = 60;
  form.parcelas[0].pct = 50;
  assert.match(erroFormularioPagamento(form, CRONO)!, /não pode superar 100%/);
});

test('#248 rejeita prazo fixo vazio e aceita parcelas mensais válidas', () => {
  const form = formularioPagamento(null);
  form.parcelas[0] = { pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: false };
  assert.match(erroFormularioPagamento(form, CRONO)!, /ao menos uma parcela mensal/);
  form.parcelas[0].parcelas = 36;
  assert.equal(erroFormularioPagamento(form, CRONO), null);
});

test('#248 percentuais negativos são inválidos', () => {
  const form = formularioPagamento(null);
  form.entrada[0].pct = -1;
  assert.match(erroFormularioPagamento(form, CRONO)!, /entre 0% e 100%/);
});

test('#345 repasse.apos_entrega_meses não é mais validado (campo inerte, sem controle na UI)', () => {
  const form = formularioPagamento(null);
  form.repasse.apos_entrega_meses = 1.5; // valor fracionário, antes rejeitado
  assert.equal(erroFormularioPagamento(form, CRONO), null);
});

// ─────────────────────────────────────────────────────────────────────────
// #436 — juros de tabela persistidos, em leitura
// ─────────────────────────────────────────────────────────────────────────

test('#436: a taxa mensal do estudo 5 vira 12,5% a.a.', () => {
  // O caso nominal citado no critério de aceite da issue.
  const r = jurosDeTabelaConfigurados({
    componentes: [{ tipo: 'prazo_fixo', taxaMensal: 0.0098636, rotulo: 'parcelas' }],
  });
  assert.equal(r.length, 1);
  // ⚠️ PRECISÃO PLENA, não 12.5. `anualPct` é derivada não monetária, e o C7
  // manda carregá-la inteira e arredondar só para exibir — quem arredonda é o
  // `fmtPct` da tela. Uma versão anterior guardava aqui o valor já arredondado,
  // e o teste, afirmando `12.5`, não distinguia uma coisa da outra.
  assert.equal(r[0].anualPct, (Math.pow(1.0098636, 12) - 1) * 100);
  assert.equal(Math.round(r[0].anualPct * 10) / 10, 12.5, 'e exibido dá 12,5%');
  assert.deepEqual(r[0].rotulos, ['parcelas']);
});

test('#436: taxa zero nao gera bloco — o estudo 6 nao ve nada', () => {
  assert.deepEqual(jurosDeTabelaConfigurados({
    componentes: [
      { tipo: 'prazo_fixo', taxaMensal: 0, rotulo: 'parcelas' },
      { tipo: 'concentrado', taxaMensal: 0, rotulo: 'repasse' },
    ],
  }), []);
});

test('#436: componentes com a mesma taxa se agrupam numa linha', () => {
  const r = jurosDeTabelaConfigurados({
    componentes: [
      { tipo: 'prazo_fixo', taxaMensal: 0.0098636, rotulo: 'parcelas' },
      { tipo: 'ate_marco', taxaMensal: 0.0098636, rotulo: 'ate as chaves' },
    ],
  });
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].rotulos, ['parcelas', 'ate as chaves']);
});

test('#436: taxas divergentes viram uma linha cada, na ordem de aparicao', () => {
  const r = jurosDeTabelaConfigurados({
    componentes: [
      { tipo: 'prazo_fixo', taxaMensal: 0.0098636, rotulo: 'parcelas' },   // 12,5%
      { tipo: 'concentrado', taxaMensal: 0.005, rotulo: 'repasse' },        // 6,2%
    ],
  });
  assert.equal(r.length, 2);
  assert.equal(Math.round(r[0].anualPct * 10) / 10, 12.5);
  assert.deepEqual(r[0].rotulos, ['parcelas']);
  assert.equal(Math.round(r[1].anualPct * 10) / 10, 6.2);
  assert.deepEqual(r[1].rotulos, ['repasse']);
});

test('#436: componente sem rotulo cai no tipo, e nao no vazio', () => {
  const r = jurosDeTabelaConfigurados({
    componentes: [{ tipo: 'concentrado', taxaMensal: 0.01 }],
  });
  assert.deepEqual(r[0].rotulos, ['concentrado']);
});

test('#436: fluxo sem componentes, nulo ou com lixo nao quebra', () => {
  assert.deepEqual(jurosDeTabelaConfigurados(null), []);
  assert.deepEqual(jurosDeTabelaConfigurados({}), []);
  assert.deepEqual(jurosDeTabelaConfigurados({ componentes: 'nao e array' }), []);
  // taxa nao numerica e ignorada em vez de virar NaN% na tela
  assert.deepEqual(jurosDeTabelaConfigurados({
    componentes: [{ tipo: 'prazo_fixo', taxaMensal: 'meio por cento' }],
  }), []);
});

test('#436: taxa que arredonda para 0,0% nao gera bloco', () => {
  // 0,003% a.m. dá 0,036% a.a., que exibido é "0,0% a.a." — anunciar juros
  // acompanhados do aviso vermelho de destruicao, para uma taxa que a tela nao
  // consegue mostrar. O filtro do `mensal === 0` sozinho nao pegava este caso.
  assert.deepEqual(jurosDeTabelaConfigurados({
    componentes: [{ tipo: 'prazo_fixo', taxaMensal: 0.00003, rotulo: 'parcelas' }],
  }), []);
  // E a menor taxa que AINDA aparece continua aparecendo.
  const r = jurosDeTabelaConfigurados({
    componentes: [{ tipo: 'prazo_fixo', taxaMensal: 0.0005, rotulo: 'parcelas' }],
  });
  assert.equal(r.length, 1);
  assert.equal(Math.round(r[0].anualPct * 10) / 10, 0.6);
});

// ─────────────────────────────────────────────────────────────────────────
// #431 — o modal para de reescrever o que não sabe representar
// ─────────────────────────────────────────────────────────────────────────
//
// Todos os casos abaixo partem de uma linha que JÁ TEM `componentes` canônicos
// persistidos com `taxaMensal` diferente de 0 — a condição em que o modal
// destruía dado. Linha sem `componentes` continua no caminho de sempre, e os
// testes de #248 acima provam isso sem edição nenhuma.

/** Obra de 27 meses a partir do mês 12 → fim da obra no mês 38, repasse no 39. */
const CRONO_LONGA = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 27 }];

const TAXA = 0.0098636; // 12,5% a.a. — a taxa exata do estudo 5 de Pinguim

/**
 * A linha "Tabela longa (80%)" do estudo 5, no shape real: `entrada: []`,
 * parcelamento de 30% ao longo da obra, repasse derivado de 70%, e a taxa de
 * 12,5% a.a. no componente `ate_marco`. Antes desta issue, abrir e aplicar
 * transformava 0/30/70 em 15/30/55 e zerava a taxa.
 */
const FP_TABELA_LONGA = () => ({
  comissao: { ativo: true, tipo: 'embutida', pct: 0 },
  ret: { ativo: false, pct: 0 },
  entrada: [],
  parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  repasse: { apos_entrega_meses: 0 },
  // ⚠️ A ORDEM DAS CHAVES é a do dump real de `GET /estudos/5/avancado/receitas`
  // citado na issue — `rotulo` e `marcoMes` antes de `participacaoPct` —, e ela
  // NÃO é a ordem em que `componentesDoLegado` monta o objeto. Isso não é
  // capricho: é o que dá dente ao teste de byte-identidade abaixo. Com a
  // fixture escrita na ordem do adaptador, remover o caso 2 inteiro passava por
  // todos os testes (medido por mutação).
  componentes: [
    {
      tipo: 'ate_marco',
      rotulo: 'Tabela longa - parcelas ate a entrega, juros 12,5% a.a.',
      marcoMes: 38, sinalPct: 0, taxaMensal: TAXA, defasagemMeses: 1,
      participacaoPct: 30, jurosNoMesDaContratacao: false,
    },
    {
      tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 39,
      taxaMensal: 0, participacaoPct: 70,
    },
  ],
  aplicado: true,
});

const particao = (comps: any[]) => comps.map((c) => [c.tipo, c.participacaoPct]);
const taxaDe = (comps: any[], tipo: string) => comps.find((c) => c.tipo === tipo)?.taxaMensal;

test('#431: abrir o modal e aplicar SEM MUDAR NADA é no-op — taxaMensal e sinalPct inclusive', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);

  // Metade 1: o placeholder de 15% não nasce mais numa linha que tem
  // `componentes`. Antes desta issue isto era `[{ pct: 15, parcelas: 1, ... }]`.
  assert.deepEqual(form.entrada, [], 'entrada fabricada onde o dado diz que não há');

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(salvo.componentes, fp.componentes, 'o no-op moveu o array canônico');
  // A taxa tem 7 casas e é derivada NÃO monetária (C7): sobrevive ao bit, sem
  // arredondamento nenhum.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
  // A partição continua 0/30/70. Antes desta issue virava 15/30/55.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);

  // Idempotência: aplicar de novo sobre o que foi gravado também não move nada.
  const denovo = fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO_LONGA);
  assert.deepEqual(denovo.componentes, fp.componentes);
});

test('#431: o no-op é BYTE-idêntico, não só deepEqual — inclusive a ordem das chaves', () => {
  // O critério de aceite da issue, para o autor conferir na instância, é um GET
  // byte-idêntico. `deepEqual` não distingue { tipo, taxaMensal } de
  // { taxaMensal, tipo }, e o caso 3 (transplante) reordenaria as chaves porque
  // monta o objeto a partir do regenerado. Só o caso 2 (devolver o persistido
  // verbatim) entrega isso — sem este teste, remover o caso 2 inteiro passa
  // despercebido (medido por mutação).
  const fp = FP_TABELA_LONGA();
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_LONGA);
  assert.equal(JSON.stringify(salvo.componentes), JSON.stringify(fp.componentes));
});

test('#431: campo canônico que este editor NEM CONHECE também sobrevive', () => {
  // O transplante não pode ser uma lista fechada de quatro campos: no dia em
  // que o contrato canônico ganhar um quinto, ele passaria a ser apagado em
  // toda edição sem nenhum teste ficar vermelho. `politicaAmortizacao` aqui faz
  // o papel desse quinto campo — o editor não o menciona em lugar nenhum.
  const fp = FP_TABELA_LONGA();
  (fp.componentes[0] as any).politicaAmortizacao = 'sac';
  const form = formularioPagamento(fp);
  // no-op
  assert.equal(
    (fluxoPagamentoParaSalvar(form, CRONO_LONGA).componentes[0] as any).politicaAmortizacao, 'sac');
  // e edição real
  form.parcelas = [{ ...form.parcelas[0], pct: 40 }];
  assert.equal(
    (fluxoPagamentoParaSalvar(form, CRONO_LONGA).componentes[0] as any).politicaAmortizacao, 'sac');
});

test('#431: editar de verdade o espelho legado regenera — e preserva o que o legado não sabe dizer', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], pct: 40 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 40], ['concentrado', 60]]);
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA, 'a taxa morreu na edição');
  // E o rótulo do dado, que o espelho legado reescreveria para
  // 'ao longo da obra (legado)', também sobrevive.
  assert.match(salvo.componentes[0].rotulo!, /Tabela longa/);
});

test('#431: o CRONOGRAMA continua mandando em marcoMes e mesPagamento', () => {
  // O espelho legado não sabe dizer taxa, mas SABE dizer quando o marco cai —
  // ele sai do Cronograma. Se `marcoMes`/`mesPagamento` fossem tratados como
  // campo só-canônico e transplantados do persistido, uma obra encurtada
  // deixaria o repasse parado no mês velho, para sempre.
  const fp = FP_TABELA_LONGA();
  const CRONO_CURTA = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 20 }]; // fim 31
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_CURTA);
  assert.equal((salvo.componentes[0] as any).marcoMes, 31, 'o marco não seguiu o cronograma');
  assert.equal((salvo.componentes[1] as any).mesPagamento, 32, 'o repasse não seguiu o cronograma');
  // …e a taxa, que o espelho não sabe dizer, sobreviveu à mudança de cronograma.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
});

test('#431: linha SEM componentes canônicos segue no comportamento de sempre', () => {
  const form = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  });
  assert.equal(form.componentes, null);
  const salvo = fluxoPagamentoParaSalvar(form, CRONO);
  assert.deepEqual(particao(salvo.componentes), [['imediato', 20], ['ate_marco', 30], ['concentrado', 50]]);
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), 0, 'não há de onde herdar taxa: 0 é o certo');
});

// ── Os testes de IDENTIDADE, que a versão por índice reprovaria ──
//
// Parear persistido×regenerado por POSIÇÃO faz qualquer inserção ou remoção
// deslocar todo mundo. A matriz abaixo é a de C2 na issue: em nenhum caso a
// `taxaMensal` de um componente SOBREVIVENTE pode ir a 0.

test('#431 identidade: ADICIONAR entrada não mata a taxa dos componentes preexistentes', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  // O que o botão "Adicionar entrada" faz: uma linha nova no topo do plano.
  form.entrada = [{ pct: 10, parcelas: 1, descontoPct: 0 }];
  form.parcelas = [{ ...form.parcelas[0], pct: 30 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(particao(salvo.componentes), [['imediato', 10], ['ate_marco', 30], ['concentrado', 60]]);
  // Por índice: [0] imediato×ate_marco ✗ e [1] ate_marco×concentrado ✗ — a taxa
  // morreria nos dois. Por identidade, o `ate_marco` acha o `ate_marco`.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
});

test('#431 identidade: REMOVER o parcelamento não mata a taxa do que sobrou', () => {
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [{ pct: 10, parcelas: 1, descontoPct: 0 }],
    componentes: [
      { tipo: 'imediato', participacaoPct: 10, descontoPct: 0, rotulo: 'Sinal' },
      {
        tipo: 'ate_marco', participacaoPct: 30, sinalPct: 0, marcoMes: 38, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'Tabela',
      },
      { tipo: 'concentrado', participacaoPct: 60, mesPagamento: 39, taxaMensal: 0.005, rotulo: 'Repasse' },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = []; // `_delLinha('parcelas', 0)`

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(particao(salvo.componentes), [['imediato', 10], ['concentrado', 90]]);
  // Por índice o `concentrado` regenerado herdaria do `ate_marco` persistido e
  // levaria a taxa errada (ou 0). Por identidade herda do `concentrado`.
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), 0.005);
});

test('#431 identidade: REORDENAR as linhas leva a taxa junto com a linha', () => {
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [
      { pct: 20, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false },
      { pct: 30, periodicidade: 'mensal', parcelas: 5, ao_longo_obra: false },
    ],
    componentes: [
      {
        tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'A',
      },
      {
        tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 5, defasagemMeses: 1,
        taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: 0, rotulo: 'R' },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = [form.parcelas[1], form.parcelas[0]]; // trocadas de lugar

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(salvo.componentes.map((c: any) => [c.participacaoPct, c.taxaMensal, c.rotulo]), [
    [30, 0.005, 'B'],
    [20, TAXA, 'A'],
    [50, 0, 'R'],
  ], 'a taxa tem de seguir a LINHA, não a posição');
});

test('#431 identidade: inserir linha no meio não transplanta a taxa para o componente errado', () => {
  // O caso de migração cruzada: dois `prazo_fixo` de taxas diferentes. Inserir
  // uma Entrada no topo desloca os índices; com o mesmo `tipo` nos dois, a
  // guarda por tipo sozinha não dispararia e ninguém acusaria nada.
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [
      { pct: 20, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false },
      { pct: 30, periodicidade: 'mensal', parcelas: 5, ao_longo_obra: false },
    ],
    componentes: [
      {
        tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 0, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'A',
      },
      {
        tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 5, defasagemMeses: 1,
        taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: 0, rotulo: 'R' },
    ],
  };
  const form = formularioPagamento(fp);
  form.entrada = [{ pct: 5, parcelas: 1, descontoPct: 0 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  const porRotulo = (r: string) => salvo.componentes.find((c: any) => c.rotulo === r) as any;
  assert.equal(porRotulo('A').taxaMensal, TAXA, 'a taxa de A escorregou');
  assert.equal(porRotulo('A').participacaoPct, 20);
  assert.equal(porRotulo('B').taxaMensal, 0.005, 'a taxa de B escorregou');
  assert.equal(porRotulo('B').participacaoPct, 30);
  // A entrada NOVA nasce sem juros — é o default do espelho, e é deliberado:
  // herdar a taxa do plano fabricaria juros que o usuário nunca digitou.
  const nova = salvo.componentes.find((c: any) => c.tipo === 'imediato') as any;
  assert.equal(nova.taxaMensal, undefined);
});

test('#431 identidade: marcar/desmarcar "Ao longo da obra" preserva a taxa da linha', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  // O checkbox do modal: `ate_marco` vira `prazo_fixo`.
  form.parcelas = [{ ...form.parcelas[0], ao_longo_obra: false, parcelas: 12 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(salvo.componentes[0].tipo, 'prazo_fixo');
  // ⚠️ #428 MUDOU esta linha, e é a única asserção existente que ela move.
  //
  // Tipo diferente: nenhum dos dois passes acha doador. Até a #428 a taxa caía
  // então em 0, e o comentário aqui defendia esse 0 dizendo que transplantar
  // taxa entre regras econômicas diferentes seria adivinhação. Era verdade
  // enquanto a taxa só existia DENTRO de cada componente persistido.
  //
  // Com a #428 a taxa é campo do PLANO (D-Q02), digitado no cabeçalho do modal,
  // e este plano declara 12,5% a.a. Aplicá-la ao prazo_fixo recém-criado não é
  // adivinhar a taxa de um componente que morreu: é usar a taxa que o usuário
  // declarou para a tabela inteira. Zerar seria o defeito — desmarcar um
  // checkbox apagaria os juros de 30% do plano sem aviso.
  //
  // O valor é o CRU do persistido, não `(1+aa)^(1/12)−1` de volta: sem taxa
  // editada, `taxaMensalDoPlano` não faz a ida e volta em ponto flutuante, e
  // por isso é 0,0098636 e não 0,009863600000000083.
  assert.equal(taxaDe(salvo.componentes, 'prazo_fixo'), TAXA);
  // Mas o `concentrado` sobrevivente mantém o que era dele.
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), 0);
  assert.deepEqual(particao(salvo.componentes), [['prazo_fixo', 30], ['concentrado', 70]]);
});

test('#431: espelho legado inteiramente vazio não regenera um repasse de 100%', () => {
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [],
  };
  const form = formularioPagamento(fp);
  assert.deepEqual(form.entrada, []);
  assert.deepEqual(form.parcelas, []);
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(salvo.componentes, fp.componentes,
    'sem espelho de onde regenerar, o persistido tem de ficar de pé');
});

test('#431: a validação olha O ARRAY QUE VAI SER GRAVADO, não uma projeção parecida', () => {
  // Espelho vazio + persistido que NÃO fecha 100% (dado legado torto). O que
  // será gravado é o persistido, que soma 99 — e é isso que o usuário precisa
  // ver barrado. `componentesDoLegado` devolveria `[concentrado 100]` e o modal
  // aprovaria um array para persistir outro.
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [],
    componentes: [
      {
        tipo: 'ate_marco', participacaoPct: 30, sinalPct: 0, marcoMes: 38, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'Tabela',
      },
      { tipo: 'concentrado', participacaoPct: 69, mesPagamento: 39, taxaMensal: 0, rotulo: 'Repasse' },
    ],
  };
  const form = formularioPagamento(fp);
  assert.deepEqual(
    componentesParaSalvar(form, CRONO_LONGA).map((c: any) => c.participacaoPct), [30, 69],
    'pré-condição do teste: é o persistido que vai ser gravado',
  );
  assert.match(erroFormularioPagamento(form, CRONO_LONGA)!, /soma dos componentes deve ser 100%/);
});

test('#431: a linha "Tabela longa" continua válida — o conserto não inventa erro', () => {
  const fp = FP_TABELA_LONGA();
  assert.equal(erroFormularioPagamento(formularioPagamento(fp), CRONO_LONGA), null);
});

// ── A asserção de FUNDING (fatia C3 da issue) ──
//
// O conserto pode ser declarado bom preservando a RECEITA e ainda assim mover o
// retorno do investidor, porque a base do equity é
// `receitaMensal − corretagem` e os juros de tabela entram nela. Este teste
// roda o motor inteiro antes e depois do ciclo abrir/aplicar e exige igualdade
// AO CENTAVO nos dois modos de retorno.

const OBRA_FUNDING = [
  { evento: 'lancamento', inicio_mes: 0, duracao_meses: 6 },
  { evento: 'obra', inicio_mes: 6, duracao_meses: 24 },
  { evento: 'pos_obra', inicio_mes: 30, duracao_meses: 6 },
];

function configComFluxoPagamento(fp: any): FluxoConfig {
  return {
    dataInicio: 'jan/2027', taxaDescontoAa: 12, areaTerreno: 0, cronograma: OBRA_FUNDING,
    linhasReceita: [{
      id: 1, nome: 'Vendas',
      tipologias: [{ id: 1, quantidade: 100, area_privativa_m2: 50, preco_m2: 10_000 }],
      absorcao: { modo: 'distribuido', blocos: [
        { evento: 'pre_lancamento', pct: 0 }, { evento: 'lancamento', pct: 40 },
        { evento: 'obra', pct: 50 }, { evento: 'pos_obra', pct: 0 },
      ] },
      fluxo_pagamento: fp,
    }],
    linhasCusto: [],
  } as FluxoConfig;
}

/** A linha com juros de tabela: 20% de entrada + 80% até o marco a 12,5% a.a. */
const FP_COM_JUROS = () => ({
  comissao: { ativo: true, tipo: 'embutida', pct: 0 },
  ret: { ativo: false, pct: 0 },
  entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
  parcelas: [{ pct: 80, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  repasse: { apos_entrega_meses: 0 },
  componentes: [
    { tipo: 'imediato', participacaoPct: 20, descontoPct: 0, rotulo: 'Sinal 20%' },
    {
      tipo: 'ate_marco', participacaoPct: 80, sinalPct: 0, marcoMes: 29, defasagemMeses: 1,
      taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'Tabela, juros 12,5% a.a.',
    },
  ],
  aplicado: true,
});

const OP_EQUITY = (modo: ModoRetorno): OperacaoFunding => ({
  id: 1, tipo: 'equity', nome: 'Investidor', valor: 5_000_000, inicio_mes: 0,
  pct_retorno: 4, modo_retorno: modo,
});

test('#431 funding: o ciclo abrir/aplicar não move o retorno do investidor, nos dois modos', () => {
  const fp = FP_COM_JUROS();
  const antes = calcularFluxo(configComFluxoPagamento(fp));
  // Pré-condição: a base tem de conter juros de verdade, senão o teste passa
  // por vacuidade e não exerce nada.
  assert.ok(antes.jurosClientes > 0, `sem juros na base (${antes.jurosClientes}) — teste vazio`);

  const depois = calcularFluxo(configComFluxoPagamento(
    fluxoPagamentoParaSalvar(formularioPagamento(fp), OBRA_FUNDING),
  ));

  const baseAntes = receitaLiquidaComCorretagemMensal(antes.receitaMensal, antes.linhasCusto, []);
  const baseDepois = receitaLiquidaComCorretagemMensal(depois.receitaMensal, depois.linhasCusto, []);
  const resultado = (c: typeof antes) => c.fluxoAcumulado[c.fluxoAcumulado.length - 1];

  for (const modo of ['permuta_financeira', 'resultado_final'] as ModoRetorno[]) {
    const a = simularEquity(OP_EQUITY(modo), baseAntes, resultado(antes), 30, antes.prazo);
    const d = simularEquity(OP_EQUITY(modo), baseDepois, resultado(depois), 30, depois.prazo);
    assert.deepEqual(d.saidas, a.saidas, `saidas do investidor mudaram em ${modo}`);
    assert.deepEqual(d.entradas, a.entradas, `entradas do investidor mudaram em ${modo}`);
  }
});

// ── Os dois casos que a rodada 1 de revisão do PR 523 achou ──
//
// Os dois são da mesma família: o pareamento persistido×regenerado não tem
// identidade de LINHA para se apoiar, só os valores do espelho. Um deles é
// defeito e foi consertado; o outro é limite, e este teste existe para que ele
// pare de ser surpresa.

test('#431 identidade: apagar uma linha e mexer na que sobrou NÃO herda a taxa da apagada', () => {
  // Achado P1 do Codex, confirmado por medição. Dois `prazo_fixo` de taxas
  // diferentes; o usuário apaga o primeiro E muda o percentual do segundo.
  // Nenhum casa exato, então tudo cai no passe 2 — e o `find` guloso entregava
  // ao sobrevivente o doador que estava primeiro na fila, que é justamente a
  // linha APAGADA. A sobrevivente saía com a `taxaMensal` e o `rotulo` de um
  // componente que o usuário acabou de mandar embora.
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [
      { pct: 30, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false },
      { pct: 70, periodicidade: 'mensal', parcelas: 20, ao_longo_obra: false },
    ],
    componentes: [
      {
        tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'A',
      },
      {
        tipo: 'prazo_fixo', participacaoPct: 70, sinalPct: 0, prazoMeses: 20, defasagemMeses: 1,
        taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[1], pct: 100 }]; // apaga A, põe B em 100%

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(salvo.componentes.length, 1);
  const sobrevivente = salvo.componentes[0] as any;
  assert.equal(sobrevivente.rotulo, 'B', 'a sobrevivente herdou o rótulo da linha APAGADA');
  assert.equal(sobrevivente.taxaMensal, 0.005, 'a sobrevivente herdou a taxa da linha APAGADA');
  assert.equal(sobrevivente.prazoMeses, 20, 'e o prazo continua sendo o dela, que vem do espelho');
});

test('#431 LIMITE declarado: permutar valores entre linhas do mesmo tipo move a taxa junto com o VALOR', () => {
  // Este teste NÃO afirma o comportamento desejável — afirma o que o conserto
  // consegue, e por quê ele não consegue mais.
  //
  // Dois `prazo_fixo` de estrutura idêntica exceto o percentual: 30% a 12,5% e
  // 70% a 6,2%. O usuário digita 70 na PRIMEIRA linha e 30 na segunda, sem
  // reordenar nada. O passe 1 casa por projeção exata, então a primeira
  // regenerada (agora 70%) acha o componente que tinha 70% — e a taxa troca de
  // linha junto com o valor.
  //
  // Não há como distinguir isso de "o usuário arrastou as duas linhas", que
  // produz entrada byte-idêntica e cujo comportamento correto é exatamente
  // este (é o que `identidade: REORDENAR` exige, logo acima). Enquanto o
  // espelho legado não guardar identidade de linha, um dos dois casos tem de
  // perder. Escolhemos perder o mais raro — e escrevemos isto para que a
  // escolha seja visível em vez de virar um bug reportado daqui a seis meses.
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [
      { pct: 30, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false },
      { pct: 70, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false },
    ],
    componentes: [
      {
        tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 0, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'A',
      },
      {
        tipo: 'prazo_fixo', participacaoPct: 70, sinalPct: 0, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], pct: 70 }, { ...form.parcelas[1], pct: 30 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(salvo.componentes.map((c: any) => [c.participacaoPct, c.taxaMensal, c.rotulo]), [
    [70, 0.005, 'B'],
    [30, TAXA, 'A'],
  ], 'o limite mudou de forma — releia o docblock de componentesParaSalvar antes de "consertar" isto');
  // O que o limite NÃO faz: inventar taxa nem perder taxa. As duas continuam
  // no plano, cada uma no componente cujo percentual o usuário lhe deu.
  const taxas = salvo.componentes.map((c: any) => c.taxaMensal).sort();
  assert.deepEqual(taxas, [0.005, TAXA].sort(), 'nenhuma taxa do plano pode sumir nem nascer');
});

// ─────────────────────────────────────────────────────────────────────────
// #428 — o campo de juros de tabela: onde digitar, e o que isso faz ao
//        transplante que a #431 construiu
// ─────────────────────────────────────────────────────────────────────────
//
// A #431 fez o modal PARAR DE DESTRUIR `taxaMensal`, preservando-a como campo
// "só-canônico" — aquilo que o formulário não sabe representar. A #428 dá o
// campo onde digitá-la, e com isso `taxaMensal` deixa de ser só-canônica no
// momento em que o usuário mexe nele. Os testes abaixo cobrem os DOIS lados
// desse eixo, porque errar qualquer um dos dois é um defeito calado:
//
//   - taxa intocada → segue só-canônica, transplantada componente a
//     componente. Errar aqui ressuscita a destruição que a #431 consertou;
//   - taxa editada  → o valor digitado manda em todo o plano (D-Q02). Errar
//     aqui deixa o campo INERTE: ele aceita o número e descarta.

test('#428 ida e volta: o que o campo grava é o que o formulário relê', () => {
  // Critério 5. É aqui que a conversão % a.a. ↔ mensal pode perder dígito.
  const form = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  });
  form.juros_tabela_aa = 12.5;                       // o usuário digita

  const salvo = fluxoPagamentoParaSalvar(form, CRONO);
  // A DECISÃO DE PERSISTÊNCIA desta issue: a taxa anual digitada vira chave
  // própria do mesmo blob `json` (sem migração). É ela que preserva o dígito —
  // derivar 12,5 de volta de `(1 + i_m)^12 − 1` devolveria 12,4999…%.
  assert.equal(salvo.juros_tabela_aa, 12.5);
  // E a taxa mensal chegou aos componentes financiados, com precisão plena (C7).
  const mensal = (salvo.componentes.find((c: any) => c.tipo === 'ate_marco') as any).taxaMensal;
  assert.equal(mensal, 0.00986358055321146);
  assert.equal((salvo.componentes.find((c: any) => c.tipo === 'concentrado') as any).taxaMensal, mensal);
  assert.equal('taxaMensal' in salvo.componentes[0], false, 'imediato não recebe juros');

  // A volta: reabrir o modal mostra o número DIGITADO, não o derivado.
  assert.equal(formularioPagamento(salvo).juros_tabela_aa, 12.5);
  // …e reaplicar não move nada (idempotência).
  assert.deepEqual(fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO), salvo);
});

test('#428 estudo anterior à issue abre mostrando a taxa que ele TEM, não 0%', () => {
  // O estudo 5 de Pinguim recebeu `taxaMensal` pela API, sem a chave nova. Se
  // o campo abrisse em 0%, o primeiro "Aplicar" apagaria os juros — o defeito
  // que a #431 acabou de consertar, de volta pela porta do campo novo.
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  assert.equal(form.juros_tabela_aa, undefined, 'a chave não existe no dado, e não pode ser fabricada');
  assert.ok(perto12(jurosTabelaAnualPct(form), 12.500026), 'o campo tem de exibir a taxa derivada');
  // E o "Aplicar" sem tocar em nada continua BYTE-idêntico: nem a taxa se move,
  // nem a chave nova aparece no JSON gravado.
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(JSON.stringify(salvo.componentes), JSON.stringify(fp.componentes));
  assert.equal('juros_tabela_aa' in salvo, false, 'o no-op inventou uma chave no JSON persistido');
});

test('#428 digitar a taxa VENCE o transplante — senão o campo é decorativo', () => {
  // O caso que a mudança de `camposSoCanonicos` existe para atender. Sem ela,
  // o transplante devolveria a taxa velha por cima da digitada e o campo
  // aceitaria o número sem efeito nenhum.
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  form.juros_tabela_aa = 18;                          // só a taxa muda

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  const esperada = taxaMensalDeAnual(18);
  // D-Q02: UMA taxa por Grupo — a mesma em TODOS os componentes financiados,
  // inclusive no `concentrado`, que estava em 0.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), esperada);
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), esperada);
  assert.equal(salvo.juros_tabela_aa, 18);
  // A estrutura não mudou, e o resto do que é só-canônico continua preservado.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);
  assert.match(salvo.componentes[0].rotulo!, /Tabela longa/);
  assert.equal((salvo.componentes[0] as any).sinalPct, 0);
});

test('#428 digitar 0 DESLIGA os juros, e não cai de volta na derivação', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  form.juros_tabela_aa = 0;

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), 0);
  assert.equal(salvo.juros_tabela_aa, 0);
  // A chave 0 é resposta, não ausência: reabrir tem de mostrar 0%, e não a
  // taxa velha ressuscitada dos componentes.
  assert.equal(jurosTabelaAnualPct(formularioPagamento(salvo)), 0);
});

test('#428 taxa INTOCADA continua só-canônica: plano heterogêneo sobrevive', () => {
  // O caso residencial × não residencial da EVI (`!H14` 12,5% × `!H22` 13%):
  // duas taxas no mesmo plano, e o campo único guarda uma. Enquanto ninguém
  // mexer nele, o transplante da #431 preserva as DUAS, componente a
  // componente — é por isso que o eixo é "foi editado", e não "existe campo".
  const fp = FP_TABELA_LONGA();
  (fp.componentes[1] as any).taxaMensal = taxaMensalDeAnual(13);
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], pct: 40 }];   // edita o espelho, não a taxa

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 40], ['concentrado', 60]]);
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), taxaMensalDeAnual(13));
  assert.equal('juros_tabela_aa' in salvo, false, 'editar o espelho não pode inventar a chave');

  // E quando o usuário MEXE na taxa, o achatamento é explícito e assumido —
  // é o que o aviso do modal anuncia quando há mais de uma taxa gravada.
  const form2 = formularioPagamento(fp);
  form2.juros_tabela_aa = 10;
  const achatado = fluxoPagamentoParaSalvar(form2, CRONO_LONGA);
  assert.equal(taxaDe(achatado.componentes, 'ate_marco'), taxaMensalDeAnual(10));
  assert.equal(taxaDe(achatado.componentes, 'concentrado'), taxaMensalDeAnual(10));
});

test('#428 espelho legado vazio: o campo continua tendo efeito', () => {
  // A guarda da #431 (`entrada` e `parcelas` vazios → devolve o persistido
  // verbatim) não pode engolir a taxa: sem este ramo o campo seria inerte
  // justamente na linha "Tabela longa" do estudo 5.
  const fp = { ...FP_TABELA_LONGA(), entrada: [], parcelas: [] };
  const form = formularioPagamento(fp);
  assert.deepEqual(fluxoPagamentoParaSalvar(form, CRONO_LONGA).componentes, fp.componentes);

  form.juros_tabela_aa = 13;
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), taxaMensalDeAnual(13));
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), taxaMensalDeAnual(13));
  // A partição não se mexe: não houve espelho de onde regenerar.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);
});

test('#428 linha NOVA: a taxa digitada chega ao motor e a Receita Bruta fecha', () => {
  // Critério 3 (invariante R-A2-18, `RECEITA_BRUTA_NAO_CONSERVA`) exercitado
  // ponta a ponta, e não sobre um `FluxoCalc` montado à mão: campo do modal →
  // `fluxoPagamentoParaSalvar` → `componentes` → `calcularFluxo`. É a FIAÇÃO
  // que este teste cobre; a matemática já era testada.
  const semTaxa = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  });
  const base = calcularFluxo(configComFluxoPagamento(fluxoPagamentoParaSalvar(semTaxa, OBRA_FUNDING)));
  assert.equal(base.jurosClientes, 0, 'sem taxa digitada, nenhum estudo muda de número');
  // ⚠️ Tolerância de 10 centavos, e não a padrão de 1: sobre R$ 50.000.000,00
  // repartidos em dezenas de safras, cada uma quantizada em centavos (C7,
  // `round2` parcela a parcela), o resíduo acumulado é de R$ 0,06 — MEDIDO na
  // linha SEM juros, portanto anterior a esta issue e alheio a ela. É o mesmo
  // motivo da tolerância de R$ 1,00 nos goldens Calliandra.
  const TOL = 0.10;
  assert.deepEqual(validarFluxoCalc(base, TOL), []);

  const comTaxa = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  });
  comTaxa.juros_tabela_aa = 12.5;
  const com = calcularFluxo(configComFluxoPagamento(fluxoPagamentoParaSalvar(comTaxa, OBRA_FUNDING)));

  assert.ok(com.jurosClientes > 0, 'a taxa digitada não chegou ao motor');
  // R-A2-18: Receita Bruta = contratação líquida + juros, com taxa ≠ 0. É este
  // fechamento que prova que os juros estão SEPARADOS do principal.
  assert.deepEqual(validarFluxoCalc(com, TOL), []);
  assert.ok(perto12(com.receitaBruta, com.vendaLiquidaContratada + com.jurosClientes, TOL));
  // A contratação não se mexe: juros são acréscimo, nunca reclassificação.
  assert.ok(perto12(com.vendaLiquidaContratada, base.vendaLiquidaContratada, TOL));
  assert.ok(com.receitaBruta > base.receitaBruta);
  // Fora de escopo, e por isso travado aqui: ligar juros aumenta a base do RET
  // (incide sobre recebido) e NÃO a da corretagem (incide sobre contratado).
  assert.ok(perto12(com.vendaBrutaContratada, base.vendaBrutaContratada, TOL));
});

test('#428 FIAÇÃO: o modal tem o campo, e ele lê a taxa efetiva — não a chave crua', () => {
  // ⚠️ Este é um teste de FONTE, e ele existe por falta de opção melhor: não há
  // harness de DOM para o modal de Pagamento, e `modais-json-regra-classe.test.ts`
  // já registra que "nenhum teste de módulo puro cobre que a TELA de fato chame
  // estas funções". Todo o resto da #428 é lógica pura e bem coberta; o que
  // sobra descoberto é exatamente a linha de template — e é ali que mora o
  // defeito recorrente desta rodada, que é de fiação e não de cálculo.
  //
  // Ele trava três coisas, cada uma um defeito CALADO se quebrar:
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');

  // 1. o campo existe e está ligado ao setter. Sem ele, toda a lógica acima
  //    fica inalcançável pela interface — que é o estado anterior a esta issue.
  assert.match(fonte, /<viab-num label="Juros de tabela \(% a\.a\.\)"/);
  assert.match(fonte, /@urbi:input-numero-change=\$\{\(ev: CustomEvent\) => this\._setJurosTabela\(/);

  // 2. o `.valor` sai de `jurosTabelaAnualPct(f)`, e NUNCA de `f.juros_tabela_aa`
  //    cru. Ler a chave direto faz o estudo 5 — que tem a taxa nos componentes e
  //    não tem a chave — abrir o campo em 0%, e o primeiro Aplicar apaga
  //    R$ 1.259.273,59 de juros. O typecheck não pega: as duas leituras são
  //    `number | undefined` e as duas compilam.
  assert.match(fonte, /\.valor=\$\{jurosAA\}/);
  assert.match(fonte, /const jurosAA = jurosTabelaAnualPct\(f\);/);
  assert.equal(/\.valor=\$\{f\.juros_tabela_aa/.test(fonte), false,
    'o campo está lendo a chave crua e vai mostrar 0% em estudo anterior à #428');

  // 3. o texto que a #431 deixou dizendo que NÃO há onde digitar a taxa saiu.
  //    Um aviso que descreve o estado anterior é pior que nenhum: ele manda o
  //    usuário desconfiar de um campo que está bem ali, funcionando.
  assert.equal(/não editáveis nesta versão|não há\s+campo onde digitá/.test(fonte), false,
    'a tela ainda anuncia que os juros não são editáveis');
});

// ─────────────────────────────────────────────────────────────────────────────
// Revisão da #428 — rodada 1. Três bloqueantes, cada um com o teste que teria
// impedido o defeito. Os dois primeiros vieram da revisão do App do Codex e
// foram reproduzidos com execução antes de virarem conserto.
// ─────────────────────────────────────────────────────────────────────────────

const CRONO_REV = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 27 }] as any;

/** Plano heterogêneo escrito pela API: residencial 12,5% × não residencial 13%. */
const planoHeterogeneo = () => ({
  comissao: { ativo: false, pct: 0 }, ret: { ativo: false, pct: 0 },
  entrada: [], parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  repasse: { apos_entrega_meses: 0 },
  componentes: [
    { tipo: 'ate_marco', rotulo: 'Residencial 12,5%', marcoMes: 38, sinalPct: 0,
      taxaMensal: taxaMensalDeAnual(12.5), defasagemMeses: 1, participacaoPct: 30,
      jurosNoMesDaContratacao: false },
    { tipo: 'concentrado', rotulo: 'Nao residencial 13%', mesPagamento: 39,
      taxaMensal: taxaMensalDeAnual(13), participacaoPct: 70 },
  ],
  aplicado: true,
});

test('#428 revisão B1: digitar a taxa do PRIMEIRO componente uniformiza o plano, não vira no-op', () => {
  // O defeito: `taxaFoiEditada` comparava só com a primeira taxa persistida.
  // Quem digitava 12,5 justamente para UNIFORMIZAR um plano heterogêneo batia
  // com o primeiro componente, era lido como "não editou", e o save gravava
  // `juros_tabela_aa: 12.5` sobre componentes que seguiam em 13%. A chave
  // passava a contradizer o dado, e digitar 12,5 de novo nunca consertava.
  const form: any = formularioPagamento(planoHeterogeneo());
  form.juros_tabela_aa = 12.5;
  const salvo: any = fluxoPagamentoParaSalvar(form, CRONO_REV);
  assert.equal(salvo.juros_tabela_aa, 12.5);
  for (const c of salvo.componentes) {
    assert.equal(c.taxaMensal, taxaMensalDeAnual(12.5),
      `${c.rotulo}: a chave anuncia 12,5% e o componente tem outra taxa — o campo ficou inerte`);
  }
  // E o que o campo passa a mostrar concorda com o que está gravado.
  assert.equal(jurosTabelaAnualPct(salvo), 12.5);
});

test('#428 revisão B1: sem a chave, nada é edição — o no-op da #431 continua de pé', () => {
  // A porta 1 do conserto. Ausência da chave é o sinal confiável de "não
  // tocou", porque `_setJurosTabela` é o único caminho que a escreve.
  const dado = planoHeterogeneo();
  const salvo: any = fluxoPagamentoParaSalvar(formularioPagamento(dado), CRONO_REV);
  assert.deepEqual(salvo.componentes, dado.componentes,
    'abrir e aplicar sem mexer achatou um plano heterogêneo');
  assert.equal('juros_tabela_aa' in salvo, false, 'a chave vazou sem ninguém digitar');
});

test('#428 revisão B1: plano já uniforme na taxa da chave não é reescrito', () => {
  // O outro lado: com a chave presente e o plano inteiro já naquela taxa, não
  // há edição — senão toda reabertura reescreveria o JSON.
  const uniforme: any = planoHeterogeneo();
  uniforme.juros_tabela_aa = 12.5;
  uniforme.componentes = uniforme.componentes.map((c: any) => ({ ...c, taxaMensal: taxaMensalDeAnual(12.5) }));
  const salvo: any = fluxoPagamentoParaSalvar(formularioPagamento(uniforme), CRONO_REV);
  assert.deepEqual(salvo.componentes, uniforme.componentes);
});

test('#428 revisão B2: taxa anual negativa é barrada antes do Aplicar', () => {
  const form: any = formularioPagamento(planoHeterogeneo());
  for (const ruim of [-150, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    form.juros_tabela_aa = ruim;
    assert.match(String(erroFormularioPagamento(form, CRONO_REV)), /juros de tabela/i,
      `${ruim} deveria bloquear o Aplicar`);
  }
  // 0 e valores normais continuam passando.
  for (const bom of [0, 12.5, 13]) {
    form.juros_tabela_aa = bom;
    assert.equal(erroFormularioPagamento(form, CRONO_REV), null, `${bom} não deveria bloquear`);
  }
});

test('#428 revisão B2: nem um caminho novo consegue persistir taxaMensal NaN/null', () => {
  // Defesa em profundidade no motor: `JSON.stringify(NaN)` é `null`, então um
  // NaN que escapasse do formulário apagaria a taxa de todo componente
  // financiado — a classe de defeito da #431 por esta porta.
  assert.equal(taxaMensalDeAnual(-150), 0);
  assert.equal(taxaMensalDeAnual(-100), 0);
  assert.equal(taxaMensalDeAnual(Number.NaN), 0);
  const form: any = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 3 }],
    parcelas: [{ pct: 80, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false }],
    repasse: { apos_entrega_meses: 0 },
  });
  form.juros_tabela_aa = -150;
  const salvo: any = fluxoPagamentoParaSalvar(form, CRONO_REV);
  const serializado = JSON.parse(JSON.stringify(salvo));
  for (const c of serializado.componentes) {
    assert.equal(Number.isFinite(c.taxaMensal), true, 'taxaMensal virou null no JSON');
  }
});

test('#428 revisão B3: o aviso enxerga o plano do estudo 5 — 12,5% ao lado de 0%', () => {
  // A linha "Tabela longa": 12,5% no `ate_marco` (30%) e 0% no Repasse (70%).
  // `jurosDeTabelaConfigurados` descarta o zero — correto para o bloco
  // somente-leitura da #436, errado como gatilho do aviso do campo único.
  const estudo5 = {
    componentes: [
      { tipo: 'ate_marco', rotulo: 'Tabela longa, juros 12,5% a.a.', taxaMensal: 0.0098636,
        marcoMes: 38, defasagemMeses: 1, sinalPct: 0, participacaoPct: 30 },
      { tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 39, taxaMensal: 0, participacaoPct: 70 },
    ],
  };
  assert.equal(jurosDeTabelaConfigurados(estudo5).length, 1, 'a função da #436 não muda');
  assert.equal(taxasDistintasDoPlano(estudo5).length, 2,
    'o aviso ficaria escondido justamente onde alterar o campo liga juros em 70% do plano');
  // Plano de fato uniforme não dispara aviso nenhum.
  assert.equal(taxasDistintasDoPlano({
    componentes: [
      { tipo: 'prazo_fixo', taxaMensal: 0.0098636, participacaoPct: 50 },
      { tipo: 'prazo_fixo', taxaMensal: 0.0098636, participacaoPct: 50 },
    ],
  }).length, 1);
  // Plano inteiro sem juros também não — 0% em todo mundo é uma taxa só.
  assert.equal(taxasDistintasDoPlano({
    componentes: [{ tipo: 'prazo_fixo', taxaMensal: 0 }, { tipo: 'concentrado', taxaMensal: 0 }],
  }).length, 1);
  // `imediato` não tem taxa e não pode fazer um plano parecer heterogêneo.
  assert.equal(taxasDistintasDoPlano({
    componentes: [{ tipo: 'imediato', participacaoPct: 30 }, { tipo: 'prazo_fixo', taxaMensal: 0.0098636 }],
  }).length, 1);
  assert.deepEqual(taxasDistintasDoPlano(null), []);
});

test('#428 revisão B3: a tela dispara o aviso por taxasDistintasDoPlano, não por jurosDeTabelaConfigurados', () => {
  // Fiação — mesmo motivo do teste de fonte da #428: não há harness de DOM
  // para este modal, e trocar a fonte do gatilho de volta é um defeito calado.
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');
  assert.match(fonte, /const taxasPlano = taxasDistintasDoPlano\(/);
  assert.match(fonte, /\$\{taxasPlano\.length > 1 \?/);
  assert.equal(/\$\{juros\.length > 1 \?/.test(fonte), false,
    'o aviso voltou a ser disparado pela contagem que descarta taxa zero');
});

test('#428 revisão R1: o setter do campo grava a chave que o editor lê', () => {
  // A mutação de fiação que o teste de fonte da #428 não tentava: ele exigia
  // que o template CHAMASSE `_setJurosTabela(`, mas nunca o que o setter faz.
  // Renomear a chave para `jurosTabelaAa` passava typecheck e os 500 testes, e
  // deixava o campo completamente inerte.
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');
  assert.match(fonte, /_setJurosTabela\(valor: number\)\s*\{[^}]*juros_tabela_aa: valor/,
    'o setter não está gravando `juros_tabela_aa` — o campo fica inerte, e em silêncio');
  // E o campo continua respeitando estudo somente-leitura.
  assert.match(fonte, /<viab-num label="Juros de tabela \(% a\.a\.\)"[\s\S]{0,120}\?desabilitado=\$\{dis\}/);
});

// ─────────────────────────────────────────────────────────────────────────────
// #455 — sinal na contratação por componente parcelado
// ─────────────────────────────────────────────────────────────────────────────

const FP_PARCELAMENTO_COM_SINAL = () => ({
  comissao: { ativo: true, tipo: 'embutida', pct: 0 },
  entrada: [],
  parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, sinalPct: 15 }],
  repasse: { apos_entrega_meses: 0 },
  componentes: [
    {
      tipo: 'ate_marco', rotulo: 'Tabela longa (legado)', marcoMes: 38, sinalPct: 15,
      taxaMensal: 0, defasagemMeses: 1, participacaoPct: 30, jurosNoMesDaContratacao: false,
    },
    { tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 39, taxaMensal: 0, participacaoPct: 70 },
  ],
  aplicado: true,
});

test('#455 no-op: abrir e aplicar sem mexer preserva sinalPct — byte-idêntico', () => {
  const fp = FP_PARCELAMENTO_COM_SINAL();
  const form = formularioPagamento(fp);
  assert.equal(form.parcelas[0].sinalPct, 15, 'o espelho tem de mostrar o sinal persistido');
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal(JSON.stringify(salvo.componentes), JSON.stringify(fp.componentes));
});

test('#455 ida e volta pelo editor puro: o sinal digitado chega a sinalPct e volta ao formulário igual', () => {
  const fp = FP_PARCELAMENTO_COM_SINAL();
  const form = formularioPagamento(fp);
  // O que o campo novo faz: `_setLinha('parcelas', 0, 'sinalPct', valor)`.
  form.parcelas = [{ ...form.parcelas[0], sinalPct: 22.5 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  const ateMarco = salvo.componentes.find((c: any) => c.tipo === 'ate_marco') as any;
  assert.equal(ateMarco.sinalPct, 22.5, 'o sinal digitado não chegou ao componente');
  // A partição não se mexe: só o sinal mudou.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);
  // E reabrir mostra 22,5 de volta — não o valor antigo, nem 0.
  const reaberto = formularioPagamento(salvo);
  assert.equal(reaberto.parcelas[0].sinalPct, 22.5);
  // Idempotência: aplicar de novo sobre o gravado não move nada.
  const denovo = fluxoPagamentoParaSalvar(reaberto, CRONO_LONGA);
  assert.deepEqual(denovo.componentes, salvo.componentes);
});

test('#455 identidade: mexer no sinal de UMA linha não muda o sinal da outra', () => {
  const fp = {
    ...FP_TABELA_LONGA(),
    entrada: [],
    parcelas: [
      { pct: 20, periodicidade: 'mensal', parcelas: 10, ao_longo_obra: false, sinalPct: 5 },
      { pct: 30, periodicidade: 'mensal', parcelas: 5, ao_longo_obra: false, sinalPct: 12 },
    ],
    componentes: [
      {
        tipo: 'prazo_fixo', participacaoPct: 20, sinalPct: 5, prazoMeses: 10, defasagemMeses: 1,
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'A',
      },
      {
        tipo: 'prazo_fixo', participacaoPct: 30, sinalPct: 12, prazoMeses: 5, defasagemMeses: 1,
        taxaMensal: 0.005, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: 0, rotulo: 'R' },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], sinalPct: 9 }, form.parcelas[1]]; // só a primeira muda

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  const porRotulo = (r: string) => salvo.componentes.find((c: any) => c.rotulo === r) as any;
  assert.equal(porRotulo('A').sinalPct, 9, 'o sinal digitado na linha A não chegou');
  assert.equal(porRotulo('B').sinalPct, 12, 'o sinal de B se moveu sem ninguém editá-lo');
  // E a taxa de cada linha, que é campo diferente, continua na linha certa.
  assert.equal(porRotulo('A').taxaMensal, TAXA);
  assert.equal(porRotulo('B').taxaMensal, 0.005);
});

test('#455 FIAÇÃO: o modal tem o campo Sinal por linha de Parcelamento, ligado ao setter certo', () => {
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');

  // 1. o campo existe dentro do bloco de Parcelamento e está ligado a
  //    `_setLinha('parcelas', i, 'sinalPct', ...)` — não a outra chave.
  assert.match(fonte, /<viab-num label="Sinal" sufixo="%"/);
  assert.match(fonte,
    /@urbi:input-numero-change=\$\{\(ev: CustomEvent\) => this\._setLinha\('parcelas', i, 'sinalPct', ev\.detail\.valor \?\? 0\)\}/);

  // 2. o `.valor` lê `p.sinalPct` (via `n(...)`), não uma constante nem outro
  //    campo — senão o controle mostraria sempre 0 ou o valor errado.
  assert.match(fonte, /label="Sinal" sufixo="%" casas-minimas="2" \?desabilitado=\$\{dis\} \.valor=\$\{n\(p\.sinalPct\)\}/);

  // 3. o texto que distingue Entrada (% do total) de Sinal (% do componente)
  //    está na tela — critério de aceite 6 da issue.
  assert.match(fonte, /% do total da venda/);
  assert.match(fonte, /deste[\s\S]{0,20}componente/);
});

// ─────────────────────────────────────────────────────────────────────────────
// #460 — resíduo de parcelamento sem prazo rola para o repasse (opt-in)
// ─────────────────────────────────────────────────────────────────────────────

test('#460 no-op: sem residuoAteMarco no persistido, a chave não nasce no JSON gravado', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  assert.equal('residuoAteMarco' in form, false, 'a chave foi fabricada onde o dado não tinha');
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal('residuoAteMarco' in salvo, false, 'o no-op inventou uma chave no JSON persistido');
  assert.deepEqual(salvo.componentes, fp.componentes);
});

test('#460 a escolha do controle sobrevive ao Aplicar e volta ao reabrir', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  (form as any).residuoAteMarco = 'concentrado';

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA);
  assert.equal((salvo as any).residuoAteMarco, 'concentrado');
  // O array de componentes não muda por causa deste campo — ele não descreve
  // NENHUM componente, só é lido pelo motor no momento do cálculo.
  assert.deepEqual(salvo.componentes, fp.componentes);

  const reaberto = formularioPagamento(salvo);
  assert.equal(reaberto.residuoAteMarco, 'concentrado');
});

test('#460 FIAÇÃO: o modal tem o controle de destino do resíduo, ligado ao setter certo', () => {
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');

  // 1. o controle existe e está ligado ao setter.
  assert.match(fonte, /<urbi-select label="Resíduo sem prazo"/);
  assert.match(fonte,
    /@urbi:select-change=\$\{\(ev: CustomEvent\) =>\s*\n?\s*this\._setResiduoAteMarco\(ev\.detail\.valor as ResiduoAteMarco\)\}/);

  // 2. o `.valor` lê `f.residuoAteMarco`, com o default 'imediato' — não uma
  //    constante, e não outra chave.
  assert.match(fonte, /\.valor=\$\{f\.residuoAteMarco \?\? 'imediato'\}/);

  // 3. o setter grava a chave que `componentesIntegradosSafra` lê.
  assert.match(fonte,
    /_setResiduoAteMarco\(valor: ResiduoAteMarco\)\s*\{[^}]*residuoAteMarco: valor/);
});
