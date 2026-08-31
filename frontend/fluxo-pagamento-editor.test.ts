import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentesParaSalvar,
  erroFormularioPagamento,
  fluxoPagamentoParaSalvar,
  formularioPagamento,
  jurosDeTabelaConfigurados,
} from './fluxo-pagamento-editor.js';
import {
  calcularFluxo, taxaMensalDeAnual,
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
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, AA_ESTUDO);

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

/**
 * #585: a taxa de tabela do ESTUDO, em % a.a. — é ela que as fixturas deste
 * arquivo declaram, porque desde a #585 a `taxaMensal` de cada componente é
 * PROJEÇÃO dela, não dado da linha.
 */
const AA_ESTUDO = 12.5;
/**
 * A mensal equivalente. Até a #585 esta constante era o literal `0.0098636` —
 * a taxa exata que o estudo 5 de Pinguim recebeu pela API, com 7 casas.
 *
 * ⚠️ Ela é DERIVADA agora, e a diferença importa: `taxaMensalDeAnual(12.5)` é
 * `0.00986358055321146`, não `0.0098636`. A #428 evitava de propósito a ida e
 * volta `mensal → % a.a. → mensal` para que "abrir e aplicar sem mexer" fosse
 * byte-idêntico num estudo legado. A #585 tira essa garantia — e não por
 * descuido: com a taxa vindo do estudo, a mensal persistida é recalculada a
 * partir dela em toda escrita. **Consequência declarada:** a primeira gravação
 * de uma linha legada reescreve `0.0098636` como `0.00986358055321146`. É
 * diferença economicamente nula (8e-9 ao mês) e é o preço de ter uma fonte só.
 */
const TAXA = taxaMensalDeAnual(AA_ESTUDO);

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
      // #585: o Repasse carregava `taxaMensal: 0` ao lado de um `ate_marco` a
      // 12,5% — o plano heterogêneo do estudo 5, que era exatamente o caso que
      // a #428 preservava. Com UMA taxa por estudo esse plano não é mais
      // representável: a fixture passa a ser homogênea, e é assim que o dado
      // fica depois da primeira gravação nesta versão.
      tipo: 'concentrado', rotulo: 'Repasse', mesPagamento: 39,
      taxaMensal: TAXA, participacaoPct: 70,
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  assert.deepEqual(salvo.componentes, fp.componentes, 'o no-op moveu o array canônico');
  // A taxa tem 7 casas e é derivada NÃO monetária (C7): sobrevive ao bit, sem
  // arredondamento nenhum.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
  // A partição continua 0/30/70. Antes desta issue virava 15/30/55.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);

  // Idempotência: aplicar de novo sobre o que foi gravado também não move nada.
  const denovo = fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO_LONGA, AA_ESTUDO);
  assert.deepEqual(denovo.componentes, fp.componentes);
  // #585: e com OUTRA taxa de estudo o no-op deixa de ser byte-idêntico — de
  // propósito. É a única coisa que a #585 tira da regra de classe da #431.
  const comOutraTaxa = fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO_LONGA, 6.2);
  assert.equal(taxaDe(comOutraTaxa.componentes, 'ate_marco'), taxaMensalDeAnual(6.2));
});

test('#431: o no-op é BYTE-idêntico, não só deepEqual — inclusive a ordem das chaves', () => {
  // O critério de aceite da issue, para o autor conferir na instância, é um GET
  // byte-idêntico. `deepEqual` não distingue { tipo, taxaMensal } de
  // { taxaMensal, tipo }, e o caso 3 (transplante) reordenaria as chaves porque
  // monta o objeto a partir do regenerado. Só o caso 2 (devolver o persistido
  // verbatim) entrega isso — sem este teste, remover o caso 2 inteiro passa
  // despercebido (medido por mutação).
  const fp = FP_TABELA_LONGA();
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_LONGA, AA_ESTUDO);
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
    (fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO).componentes[0] as any).politicaAmortizacao, 'sac');
  // e edição real
  form.parcelas = [{ ...form.parcelas[0], pct: 40 }];
  assert.equal(
    (fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO).componentes[0] as any).politicaAmortizacao, 'sac');
});

test('#431: editar de verdade o espelho legado regenera — e preserva o que o legado não sabe dizer', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], pct: 40 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
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
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_CURTA, AA_ESTUDO);
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
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, AA_ESTUDO);
  assert.deepEqual(particao(salvo.componentes), [['imediato', 20], ['ate_marco', 30], ['concentrado', 50]]);
  // #585: antes desta issue a asserção era `0` — "não há de onde herdar taxa".
  // Agora há: a taxa do ESTUDO vale para linha nova e linha velha igualmente.
  assert.equal(taxaDe(salvo.componentes, 'ate_marco'), TAXA);
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
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
      { tipo: 'concentrado', participacaoPct: 60, mesPagamento: 39, taxaMensal: TAXA, rotulo: 'Repasse' },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = []; // `_delLinha('parcelas', 0)`

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  assert.deepEqual(particao(salvo.componentes), [['imediato', 10], ['concentrado', 90]]);
  // #585: o MARCADOR de identidade deixou de poder ser `taxaMensal` — ela é
  // uniforme agora. Quem discrimina é `rotulo`, que continua só-canônico: por
  // índice o `concentrado` regenerado herdaria do `ate_marco` persistido e
  // viria com o rótulo 'Tabela'.
  assert.equal((salvo.componentes[1] as any).rotulo, 'Repasse');
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), TAXA);
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  // #585: o marcador é `rotulo` — `taxaMensal` é uniforme e não discrimina mais.
  assert.deepEqual(salvo.componentes.map((c: any) => [c.participacaoPct, c.rotulo]), [
    [30, 'B'],
    [20, 'A'],
    [50, 'R'],
  ], 'o campo só-canônico tem de seguir a LINHA, não a posição');
  for (const c of salvo.componentes.filter((x: any) => 'taxaMensal' in x)) {
    assert.equal((c as any).taxaMensal, TAXA, 'a taxa do estudo vale para todo componente financiado');
  }
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  const porRotulo = (r: string) => salvo.componentes.find((c: any) => c.rotulo === r) as any;
  // #585: o pareamento continua sendo por identidade — o que mudou é o campo
  // que serve de prova. `prazoMeses` vem do espelho e `rotulo` é só-canônico;
  // os dois juntos mostram que A e B não escorregaram um para o lugar do outro.
  assert.equal(porRotulo('A').participacaoPct, 20);
  assert.equal(porRotulo('A').prazoMeses, 10, 'A escorregou');
  assert.equal(porRotulo('B').participacaoPct, 30);
  assert.equal(porRotulo('B').prazoMeses, 5, 'B escorregou');
  assert.equal(porRotulo('A').taxaMensal, TAXA);
  assert.equal(porRotulo('B').taxaMensal, TAXA);
  // A entrada NOVA continua sem juros — `imediato` paga no mês da venda e não
  // tem `taxaMensal`, nem com a taxa do estudo configurada.
  const nova = salvo.componentes.find((c: any) => c.tipo === 'imediato') as any;
  assert.equal(nova.taxaMensal, undefined);
});

test('#431 identidade: marcar/desmarcar "Ao longo da obra" preserva a taxa da linha', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  // O checkbox do modal: `ate_marco` vira `prazo_fixo`.
  form.parcelas = [{ ...form.parcelas[0], ao_longo_obra: false, parcelas: 12 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
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
  // #585 fecha esta discussão de vez: o valor é `(1 + aa)^(1/12) − 1` da taxa
  // do ESTUDO, e vale para o componente novo e para o sobrevivente igualmente.
  // Não há mais "a taxa que era dele" — não há taxa por componente.
  assert.equal(taxaDe(salvo.componentes, 'prazo_fixo'), TAXA);
  assert.equal(taxaDe(salvo.componentes, 'concentrado'), TAXA);
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
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
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
    componentesParaSalvar(form, CRONO_LONGA, AA_ESTUDO).map((c: any) => c.participacaoPct), [30, 69],
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
    dataInicio: 'jan/2027', taxaDescontoAa: 12, jurosTabelaAaEstudo: AA_ESTUDO, areaTerreno: 0, cronograma: OBRA_FUNDING,
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
    fluxoPagamentoParaSalvar(formularioPagamento(fp), OBRA_FUNDING, AA_ESTUDO),
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  assert.equal(salvo.componentes.length, 1);
  const sobrevivente = salvo.componentes[0] as any;
  assert.equal(sobrevivente.rotulo, 'B', 'a sobrevivente herdou o rótulo da linha APAGADA');
  // #585: `taxaMensal` não prova mais nada aqui — ela é a do estudo nos dois.
  assert.equal(sobrevivente.taxaMensal, TAXA);
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

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  // #585: o limite continua existindo e é o mesmo — o rótulo troca de linha
  // junto com o valor. `taxaMensal` deixou de servir de marcador (é uniforme).
  assert.deepEqual(salvo.componentes.map((c: any) => [c.participacaoPct, c.rotulo]), [
    [70, 'B'],
    [30, 'A'],
  ], 'o limite mudou de forma — releia o docblock de componentesParaSalvar antes de "consertar" isto');
});

// ─────────────────────────────────────────────────────────────────────────
// #585 — a taxa de tabela virou valor do ESTUDO
// ─────────────────────────────────────────────────────────────────────────
//
// O bloco de 15 testes da #428 que morava aqui exercitava um eixo que não
// existe mais: "o usuário mexeu no campo do modal?". O campo saiu do modal, a
// chave `juros_tabela_aa` saiu de `FormularioPagamento` e a taxa passou a
// entrar por parâmetro, vinda do estudo. Não há mais taxa intocada a preservar
// nem taxa editada a propagar — há UMA taxa, e ela vale sempre.
//
// O que os testes precisam provar mudou junto, e é isto:
//
//   - a taxa do estudo chega a todo componente financiado, INCLUSIVE quando o
//     persistido trazia outra (é o coração da issue: vale para linha que já
//     existe);
//   - `imediato` continua sem `taxaMensal`, e não pode ganhar uma;
//   - a chave legada `juros_tabela_aa` não é fabricada nem preservada;
//   - o no-op da #431 continua de pé para tudo o que NÃO é a taxa.

test('#585 a taxa do estudo chega aos componentes financiados, e o dígito não se perde', () => {
  const form = formularioPagamento({
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
  });
  const salvo = fluxoPagamentoParaSalvar(form, CRONO, 12.5);
  const mensal = (salvo.componentes.find((c: any) => c.tipo === 'ate_marco') as any).taxaMensal;
  // Precisão plena (contrato C7) — composição `(1 + i)^(1/12) − 1`, nunca i/12.
  assert.equal(mensal, 0.00986358055321146);
  assert.equal((salvo.componentes.find((c: any) => c.tipo === 'concentrado') as any).taxaMensal, mensal);
  assert.equal('taxaMensal' in salvo.componentes[0], false, 'imediato não recebe juros');
  // A chave legada não pode ser fabricada: ela não existe mais no formulário.
  assert.equal('juros_tabela_aa' in salvo, false, 'a chave legada voltou pelo Aplicar');
  // Reaplicar com a MESMA taxa do estudo não move nada (idempotência).
  assert.deepEqual(fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO, 12.5), salvo);
});

test('#585 estudo existente: a taxa do estudo SOBREPÕE a que estava persistida', () => {
  // O coração da issue — "vale para estudos existentes". A linha traz 13% a.a.
  // gravados; o estudo diz 12,5%. Depois do Aplicar, o plano inteiro está em
  // 12,5%. Antes da #585 o transplante preservava os 13% e o campo global
  // seria decorativo.
  const mensal13 = Math.pow(1.13, 1 / 12) - 1;
  const fp = {
    comissao: { ativo: true, tipo: 'embutida', pct: 0 },
    entrada: [{ pct: 20, parcelas: 1, descontoPct: 0 }],
    parcelas: [{ pct: 30, periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true }],
    repasse: { apos_entrega_meses: 0 },
    componentes: [
      { tipo: 'imediato', participacaoPct: 20, descontoPct: 0 },
      { tipo: 'ate_marco', participacaoPct: 30, marcoMes: 38, defasagemMeses: 1,
        sinalPct: 0, taxaMensal: mensal13, jurosNoMesDaContratacao: false, rotulo: 'ao longo da obra (legado)' },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: mensal13, rotulo: 'repasse (legado)' },
    ],
  };
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_LONGA, 12.5);
  const taxas = salvo.componentes.filter((c: any) => 'taxaMensal' in c).map((c: any) => c.taxaMensal);
  assert.equal(taxas.length, 2, 'os dois componentes financiados continuam lá');
  for (const t of taxas) {
    assert.equal(t, 0.00986358055321146,
      'a taxa do estudo tem de valer para a linha JÁ GRAVADA — é o pedido da issue');
  }
  assert.equal('taxaMensal' in salvo.componentes[0], false, 'imediato continua sem taxa');
});

test('#585 taxa 0 no estudo DESLIGA os juros, inclusive sem espelho de onde regenerar', () => {
  // `entrada`/`parcelas` do espelho vazios é a guarda "não há espelho de onde
  // regenerar" — o caminho que a #428 teve de tratar à parte, e que continua
  // tendo de aplicar a taxa do estudo.
  const fp = FP_TABELA_LONGA();
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(fp), CRONO_LONGA, 0);
  const taxas = salvo.componentes.filter((c: any) => 'taxaMensal' in c).map((c: any) => c.taxaMensal);
  assert.ok(taxas.length > 0, 'a fixture perdeu os componentes financiados');
  assert.deepEqual(taxas, taxas.map(() => 0));
});

test('#585 o no-op da #431 continua de pé para tudo o que NÃO é a taxa', () => {
  // Abrir e aplicar sem mexer em nada, com a MESMA taxa do estudo, tem de ser
  // byte-idêntico. É a regra de classe da #431, e a #585 não a revoga: o que
  // ela tira do no-op é só a `taxaMensal`, que deixou de ser dado da linha.
  const salvo = fluxoPagamentoParaSalvar(formularioPagamento(FP_TABELA_LONGA()), CRONO_LONGA, 12.5);
  const outra = fluxoPagamentoParaSalvar(formularioPagamento(salvo), CRONO_LONGA, 12.5);
  assert.deepEqual(outra, salvo);
});

test('#585 FIAÇÃO: o modal NÃO tem mais campo de juros, e a tela passa a taxa do estudo', () => {
  // Mutação que esta asserção pega e o typecheck não pega: alguém devolve o
  // campo ao modal "para ficar mais prático", e o app volta a ter duas entradas
  // para a mesma grandeza — uma delas inerte.
  const fonte = readFileSync(new URL('./tela-fluxo-receitas.ts', import.meta.url), 'utf8');
  assert.equal(/<viab-num label="Juros de tabela/.test(fonte), false,
    'o campo de juros de tabela voltou ao modal — a #585 o move para a aba Financeiro');
  // ⚠️ Casar `_setJurosTabela` cru daria falso positivo: a nota de remoção que
  // ficou no arquivo cita o nome. O que não pode voltar é a DECLARAÇÃO e a
  // CHAMADA.
  assert.equal(/private _setJurosTabela/.test(fonte), false, 'o setter do campo removido voltou');
  assert.equal(/this\._setJurosTabela\(/.test(fonte), false, 'o template voltou a chamar o setter removido');
  // E a tela passa a taxa do ESTUDO ao gravar. Sem isto, o array persistido
  // ficaria com a taxa antiga enquanto o motor calcula com a nova.
  assert.match(fonte, /fluxoPagamentoParaSalvar\([\s\S]{0,240}juros_tabela_aa_padrao/,
    'a tela parou de passar a taxa do estudo ao gravar');
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
  // #585: esta fixture é um plano SEM juros (`taxaMensal: 0` nos dois
  // componentes), então a taxa do estudo aqui é 0 — é o que faz o no-op
  // continuar byte-idêntico.
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, 0);
  assert.equal(JSON.stringify(salvo.componentes), JSON.stringify(fp.componentes));
});

test('#455 ida e volta pelo editor puro: o sinal digitado chega a sinalPct e volta ao formulário igual', () => {
  const fp = FP_PARCELAMENTO_COM_SINAL();
  const form = formularioPagamento(fp);
  // O que o campo novo faz: `_setLinha('parcelas', 0, 'sinalPct', valor)`.
  form.parcelas = [{ ...form.parcelas[0], sinalPct: 22.5 }];

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, 0);
  const ateMarco = salvo.componentes.find((c: any) => c.tipo === 'ate_marco') as any;
  assert.equal(ateMarco.sinalPct, 22.5, 'o sinal digitado não chegou ao componente');
  // A partição não se mexe: só o sinal mudou.
  assert.deepEqual(particao(salvo.componentes), [['ate_marco', 30], ['concentrado', 70]]);
  // E reabrir mostra 22,5 de volta — não o valor antigo, nem 0.
  const reaberto = formularioPagamento(salvo);
  assert.equal(reaberto.parcelas[0].sinalPct, 22.5);
  // Idempotência: aplicar de novo sobre o gravado não move nada.
  const denovo = fluxoPagamentoParaSalvar(reaberto, CRONO_LONGA, 0);
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
        taxaMensal: TAXA, jurosNoMesDaContratacao: false, rotulo: 'B',
      },
      { tipo: 'concentrado', participacaoPct: 50, mesPagamento: 39, taxaMensal: TAXA, rotulo: 'R' },
    ],
  };
  const form = formularioPagamento(fp);
  form.parcelas = [{ ...form.parcelas[0], sinalPct: 9 }, form.parcelas[1]]; // só a primeira muda

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  const porRotulo = (r: string) => salvo.componentes.find((c: any) => c.rotulo === r) as any;
  assert.equal(porRotulo('A').sinalPct, 9, 'o sinal digitado na linha A não chegou');
  assert.equal(porRotulo('B').sinalPct, 12, 'o sinal de B se moveu sem ninguém editá-lo');
  // #585: a taxa é a mesma nas duas linhas — ela não discrimina mais. Quem
  // prova a identidade aqui é `sinalPct`, que É por linha.
  assert.equal(porRotulo('A').taxaMensal, TAXA);
  assert.equal(porRotulo('B').taxaMensal, TAXA);
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
  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
  assert.equal('residuoAteMarco' in salvo, false, 'o no-op inventou uma chave no JSON persistido');
  assert.deepEqual(salvo.componentes, fp.componentes);
});

test('#460 a escolha do controle sobrevive ao Aplicar e volta ao reabrir', () => {
  const fp = FP_TABELA_LONGA();
  const form = formularioPagamento(fp);
  (form as any).residuoAteMarco = 'concentrado';

  const salvo = fluxoPagamentoParaSalvar(form, CRONO_LONGA, AA_ESTUDO);
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
