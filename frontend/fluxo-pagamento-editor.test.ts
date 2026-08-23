import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  erroFormularioPagamento,
  fluxoPagamentoParaSalvar,
  formularioPagamento,
  jurosDeTabelaConfigurados,
} from './fluxo-pagamento-editor.js';

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
