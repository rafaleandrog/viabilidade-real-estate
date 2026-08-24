import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentesParaSalvar,
  erroFormularioPagamento,
  fluxoPagamentoParaSalvar,
  formularioPagamento,
  jurosDeTabelaConfigurados,
} from './fluxo-pagamento-editor.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  receitaLiquidaComCorretagemMensal,
  simularEquity,
  type ModoRetorno,
  type OperacaoFunding,
} from './funding-motor.js';

const CRONO = [{ evento: 'obra', inicio_mes: 12, duracao_meses: 24 }];

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
  // Tipo diferente: nenhum dos dois passes acha doador, e a taxa cai no default
  // do espelho. Isto está DOCUMENTADO como o limite do conserto — o par
  // ate_marco↔prazo_fixo é uma troca de regra econômica, não uma edição de
  // parâmetro, e transplantar taxa entre regras diferentes seria adivinhação.
  assert.equal(taxaDe(salvo.componentes, 'prazo_fixo'), 0);
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
