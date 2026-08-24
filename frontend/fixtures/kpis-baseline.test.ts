import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASOS, kpisDoCaso, type KpisBaseline } from './kpis-baseline.js';

// Catraca dos 4 KPIs (#468). Um PR da cadeia que mova qualquer um deles sem
// atualizar `kpis-baseline.ts` fica VERMELHO aqui — que é a proteção inteira.
//
// ⚠️ O MONETÁRIO É COMPARADO EM CENTAVOS INTEIROS, NÃO POR TOLERÂNCIA.
//
// A versão anterior usava `Math.abs(Δ) <= 0.01` e deixava passar uma mudança de
// EXATAMENTE um centavo — porque em ponto flutuante `3899999.95 − 3899999.94`
// dá `0.009999999776…`, que é menor que `0.01`. Medido sobre os 14 valores
// desta fixture: **20 dos 28 deslocamentos de ±1 centavo passavam**.
//
// Isso contradizia a promessa da catraca. Comparar centavos arredondados é
// exato: absorve o ruído de float (medido: 1,4e-9) e rejeita qualquer diferença
// real, inclusive a de um centavo.
const centavos = (v: number) => Math.round(v * 100);

const TOL_PCT = 1e-6;

const igualEmCentavos = (obtido: number, esperado: number, rotulo: string) => {
  assert.equal(
    centavos(obtido), centavos(esperado),
    `${rotulo}: obtido ${obtido} (${centavos(obtido)} centavos), esperado ${esperado} (${centavos(esperado)} centavos)`,
  );
};

// As derivadas (`margemPct`, `roiPct`, `tir`) carregam precisão plena (C7) e
// são comparadas por tolerância — nunca `assert.equal` em ponto flutuante.
const perto = (obtido: number, esperado: number, tol: number, rotulo: string) => {
  assert.ok(
    Math.abs(obtido - esperado) <= tol,
    `${rotulo}: obtido ${obtido}, esperado ${esperado} (Δ ${Math.abs(obtido - esperado)}, tolerância ${tol})`,
  );
};

const conferir = (obtido: KpisBaseline, esperado: KpisBaseline, id: string) => {
  igualEmCentavos(obtido.resultado, esperado.resultado, `${id} · Resultado`);
  perto(obtido.margemPct, esperado.margemPct, TOL_PCT, `${id} · Margem %`);
  perto(obtido.roiPct, esperado.roiPct, TOL_PCT, `${id} · ROI %`);
  // TIR é `number | null`: estudo sem inversão de sinal no fluxo não tem TIR.
  // Assertar `null` explicitamente, em vez de deixar a comparação estourar.
  if (esperado.tir === null) {
    assert.equal(obtido.tir, null, `${id} · TIR deveria ser null e veio ${obtido.tir}`);
  } else {
    assert.notEqual(obtido.tir, null, `${id} · TIR virou null`);
    perto(obtido.tir as number, esperado.tir, TOL_PCT, `${id} · TIR`);
  }

  // ⚠️ OS ALAVANCADOS TAMBÉM SÃO COMPARADOS, e uma versão anterior deste arquivo
  // os GRAVAVA sem os comparar — a fixture registrava três números que nenhuma
  // asserção olhava. O conserto da #432 move o `vplLiquidoFunding` do caso E em
  // R$ 132,95 e passava verde por causa disso.
  //
  // `null` significa "estudo sem funding" e é asserção, não ausência: se um caso
  // sem funding passar a produzir número aqui, alguém realimentou o funding num
  // caminho que não deveria.
  for (const campo of ['caixaFinalAlavancado', 'vplLiquidoFunding', 'fundingSaidas'] as const) {
    const esp = esperado[campo];
    const obt = obtido[campo];
    if (esp === null) {
      assert.equal(obt, null, `${id} · ${campo} deveria ser null (sem funding) e veio ${obt}`);
    } else {
      assert.notEqual(obt, null, `${id} · ${campo} virou null`);
      igualEmCentavos(obt as number, esp, `${id} · ${campo}`);
    }
  }
};

for (const caso of CASOS) {
  test(`#468 baseline ${caso.id} — ${caso.titulo}`, () => {
    conferir(kpisDoCaso(caso.config, caso.operacoes), caso.esperado, caso.id);
  });
}

// ── o que impede a catraca de virar enfeite ─────────────────────────────────

test('#468 todo caso declara qual issue vigia', () => {
  for (const c of CASOS) {
    assert.ok(c.vigia && c.vigia.length > 20, `caso ${c.id} sem declaração de vigilância`);
  }
  assert.equal(CASOS.length, 5);
  assert.deepEqual(CASOS.map((c) => c.id), ['A', 'B', 'C', 'D', 'E']);
});

test('#468 os casos distinguem estruturas de capital — E CONTINUAM distinguindo depois da #426', () => {
  // ⚠️ ESTE É O TESTE QUE A REVISÃO OBRIGOU A EXISTIR, e a razão é medida:
  // `resultado`/`margemPct`/`roiPct` só enxergam funding ATRAVÉS do defeito da
  // #426 (a proforma soma o principal como custo). Aplicando o conserto dela, os
  // casos A, B e C ficavam BIT-IDÊNTICOS nos quatro KPIs — a catraca cegava no
  // PR seguinte ao próprio, e #434 chegaria sem nada vigiando.
  //
  // Os campos ALAVANCADOS existem por isso. Eles vêm de `FundingNoFluxo`, o
  // rodapé da tabela, que é a única superfície exibida que enxerga funding
  // (`funding-motor.ts:650-653` declara isso: "as KPIs do projeto continuam
  // desalavancadas … só o rodapé da tabela alavanca").
  const [a, b, c] = CASOS.map((x) => x.esperado);

  // ⚠️ DEPOIS DA #426 os desalavancados de A, B e C são IDÊNTICOS, e essa
  // igualdade é a invariante do conserto: a proforma parou de olhar a estrutura
  // de capital. Antes dela, B e C tinham margem negativa contra +39% do mesmo
  // projeto. Se estes voltarem a divergir, o funding vazou de volta para a
  // proforma.
  assert.equal(a.resultado, b.resultado, 'a #426 desalavancou a proforma: A e B têm o mesmo resultado');
  assert.equal(a.resultado, c.resultado, 'idem para C');
  assert.equal(a.margemPct, c.margemPct, 'idem na margem');

  // Os alavancados distinguem por um caminho que a #426 NÃO toca. Se estas três
  // asserções caírem, a catraca perdeu a capacidade de vigiar funding.
  assert.equal(a.caixaFinalAlavancado, null, 'A não tem funding');
  assert.notEqual(b.caixaFinalAlavancado, c.caixaFinalAlavancado, 'B e C precisam divergir no caixa alavancado');
  assert.notEqual(b.fundingSaidas, c.fundingSaidas, 'B e C precisam divergir no serviço da dívida');

  // ⚠️ A TIR NÃO distingue: A, B e C têm a mesma, porque `FluxoCalc.tir` é do
  // fluxo DESALAVANCADO. Fixar isso impede alguém de "consertar" os três valores
  // iguais achando que são erro de captura.
  assert.equal(a.tir, b.tir, 'A e B compartilham a TIR: ela não enxerga funding');
  assert.equal(b.tir, c.tir, 'B e C compartilham a TIR: ela não enxerga funding');
  assert.notEqual(CASOS[3].esperado.tir, a.tir, 'D move a TIR — é o lado da receita');
});

test('#468 o caso E alcança o ramo `progressivo` do equity, que os outros não alcançam', () => {
  // Sem E, o conserto da #432 passava 8/8 VERDE — medido. Duas razões
  // independentes: o equity de C é `resultado_final` (o clamp mora no ramo
  // `permuta_financeira`), e a receita líquida de C nunca fica negativa
  // (mínimo 0,00), que é a condição que dispara o clamp.
  const e = CASOS[4];
  assert.equal(e.operacoes[0].modo_retorno, 'permuta_financeira');
  assert.notEqual(e.esperado.fundingSaidas, null, 'E precisa ter funding, ou não alcança o motor de equity');
  const c = CASOS[2];
  assert.equal(c.operacoes.find((o) => o.tipo === 'equity')?.modo_retorno, 'resultado_final',
    'se C virar `permuta_financeira`, E deixa de ser o único — reveja os dois `vigia`');
});

test('#468 a fixture não reimplementa o motor', () => {
  // A catraca só vigia enquanto os números vierem de `calcularFluxo`/
  // `proformaAvancado`/`fundingDoEstudo`; no dia em que alguém colar uma conta
  // aqui, ela fica verde junto com o motor errado. Esta asserção é fraca de
  // propósito — a de verdade é a revisão —, mas pega o caso óbvio de alguém
  // trocar a chamada por um literal.
  //
  // ⚠️ A sonda mede pelos ALAVANCADOS, não pelo `resultado`. Depois da #426 a
  // proforma é desalavancada, então passar operações NÃO move mais o resultado —
  // e a versão anterior desta asserção, que comparava `resultado`, ficaria
  // permanentemente vermelha por medir a coisa que o conserto eliminou.
  const semFunding = kpisDoCaso(CASOS[0].config, []);
  const comFunding = kpisDoCaso(CASOS[2].config, CASOS[2].operacoes);
  assert.equal(semFunding.fundingSaidas, null, 'sem operações não há saída de funding');
  assert.notEqual(comFunding.fundingSaidas, null,
    'kpisDoCaso tem que REAGIR às operações; se não reage, virou literal');
  assert.ok((comFunding.fundingSaidas as number) > 0);
});

test('#468 a catraca MORDE — medido por mutação, não por esperança', () => {
  // Medições reais, feitas sobre cópia da árvore. Não são folclore:
  //
  //   conserto da #426 (não somar o funding no custo financeiro)   → 4 falham
  //   conserto da #432 (clamp em zero + carry-forward do equity)   → 1 falha (caso E)
  //   conserto da #434 (duas passadas no sweep)                    → 1 falha (caso C)
  //
  // ⚠️ A da #432 só passou a morder DEPOIS de duas correções que a revisão
  // obrigou: o caso E (o ramo `progressivo` é inalcançável por A–D) e a
  // comparação dos campos alavancados, que a versão anterior GRAVAVA sem
  // ASSERTAR. Antes das duas, o conserto da #432 passava 100% verde.
  //
  // Se afrouxar tolerância ou convergir fixture, refaça a medida antes de
  // acreditar no verde. O que este teste trava é o pressuposto das três.
  // O monetário não tem tolerância: é igualdade em centavos inteiros. Este teste
  // trava a única folga que sobrou, a das derivadas.
  assert.ok(TOL_PCT <= 1e-6, 'tolerância percentual afrouxada — a catraca deixa de morder');
  // E prova que o monetário rejeita um centavo — era o furo da versão anterior.
  assert.notEqual(centavos(3_899_999.94), centavos(3_899_999.95), 'um centavo tem que ser diferença');
});

test('#468 o que a fixture NÃO vigia, declarado em vez de prometido', () => {
  // Um `vigia:` que promete cobertura inexistente é pior que silêncio: dá à
  // cadeia inteira confiança falsa. Estas três issues são estruturalmente
  // invisíveis a uma fixture de frontend que percorre
  // `calcularFluxo → fundingDoEstudo → proformaAvancado`:
  //
  //   #433  validação de rota, backend puro
  //   #435  validação de rota, backend puro — a própria issue diz "não toca o motor"
  //   #431  camada de EDITOR (`fluxo-pagamento-editor.ts`, `_absorcaoJson`)
  //   #428  idem, e o critério 4 dela EXIGE que a suíte fique verde sem taxa
  //   #429  diagnóstico por desenho — o item 4 diz "nenhum número muda"
  //
  // Este teste existe para que nenhum `vigia:` volte a citá-las.
  const todos = CASOS.map((c) => c.vigia).join(' ');
  for (const issue of ['#433', '#435']) {
    assert.ok(!todos.includes(`vigia ${issue}`), `${issue} é backend puro; nenhum caso pode reivindicá-la`);
  }
  // E os casos que mencionam #431/#428/#429 têm de fazê-lo NEGANDO cobertura.
  const d = CASOS[3].vigia;
  assert.ok(/NÃO fica vermelho|não fica vermelho/.test(d),
    'o caso D precisa dizer explicitamente que não fica vermelho com #431/#428');
});
