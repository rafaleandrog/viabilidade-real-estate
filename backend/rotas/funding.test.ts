import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarCamposOperacao, conflitoFinanciamentoUnico, somaRetornoExcede, remocaoFinanciamentoBloqueada,
} from './funding.js';

// #355 — validação das operações de Funding. Só lógica pura: as rotas em si
// exigem servidor e banco, que este ambiente não sobe (ver CLAUDE.md).

test('#355 payload parcial é válido (o mesmo validador serve POST e PATCH)', () => {
  assert.equal(validarCamposOperacao({}), null);
  assert.equal(validarCamposOperacao({ nome: 'Dívida A' }), null);
  assert.equal(validarCamposOperacao({ valor: 1_000_000 }), null);
});

test('#355 aceita os 3 tipos e os 2 modos de retorno', () => {
  for (const tipo of ['financiamento_producao', 'divida', 'equity']) {
    assert.equal(validarCamposOperacao({ tipo }), null, tipo);
  }
  for (const modo_retorno of ['permuta_financeira', 'resultado_final']) {
    assert.equal(validarCamposOperacao({ modo_retorno }), null, modo_retorno);
  }
});

test('#355 rejeita tipo, modo e âncora fora da lista', () => {
  // `capital_giro`, `preferred_equity` e `sponsor_equity` eram do modelo antigo
  // e deixam de existir — a API precisa recusar, não aceitar em silêncio.
  assert.match(String(validarCamposOperacao({ tipo: 'capital_giro' })), /tipo deve ser um de/);
  assert.match(String(validarCamposOperacao({ tipo: 'preferred_equity' })), /tipo deve ser um de/);
  assert.match(String(validarCamposOperacao({ modo_retorno: 'A' })), /modo_retorno deve ser um de/);
  assert.match(String(validarCamposOperacao({ cronograma_evento: 'entrega' })), /cronograma_evento deve ser um de/);
});

test('#355 rejeita valores negativos e não numéricos', () => {
  assert.match(String(validarCamposOperacao({ valor: -1 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ taxa_anual: -0.5 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ pct_retorno: -2 })), /não pode ser negativo/);
  assert.match(String(validarCamposOperacao({ valor: 'abc' })), /deve ser numérico/);
  // null é ausência de valor, não erro — a coluna é anulável.
  assert.equal(validarCamposOperacao({ fase_ancora_id: null, valor: null }), null);
});

test('#355 carência precisa ser menor que a amortização', () => {
  // O PMT da planilha é calculado sobre `amortização − carência`: igualar os
  // dois zeraria o prazo e a operação nunca se pagaria.
  assert.match(
    String(validarCamposOperacao({ periodo_amortizacao_meses: 12, periodo_carencia_meses: 12 })),
    /menor que periodo_amortizacao_meses/,
  );
  assert.match(
    String(validarCamposOperacao({ periodo_amortizacao_meses: 12, periodo_carencia_meses: 24 })),
    /menor que periodo_amortizacao_meses/,
  );
  assert.equal(validarCamposOperacao({ periodo_amortizacao_meses: 36, periodo_carencia_meses: 12 }), null);
  // Amortização 0 = operação ainda em branco; não é erro de coerência.
  assert.equal(validarCamposOperacao({ periodo_amortizacao_meses: 0, periodo_carencia_meses: 0 }), null);
});

test('#355 aporte_meses mínimo é 1', () => {
  assert.match(String(validarCamposOperacao({ aporte_meses: 0 })), /pelo menos 1/);
  assert.equal(validarCamposOperacao({ aporte_meses: 1 }), null);
});

test('#355 Financiamento à produção é único por estudo', () => {
  const existentes = [
    { id: 1, tipo: 'financiamento_producao' },
    { id: 2, tipo: 'divida' },
  ];
  // Um segundo financiamento conflita...
  assert.deepEqual(conflitoFinanciamentoUnico('financiamento_producao', existentes), { id: 1, tipo: 'financiamento_producao' });
  // ...mas dívida e equity são livres.
  assert.equal(conflitoFinanciamentoUnico('divida', existentes), undefined);
  assert.equal(conflitoFinanciamentoUnico('equity', existentes), undefined);
  // Sem nenhum ainda, pode criar.
  assert.equal(conflitoFinanciamentoUnico('financiamento_producao', [{ id: 2, tipo: 'divida' }]), undefined);
});

test('#355 o PATCH do próprio financiamento não conflita consigo mesmo', () => {
  const existentes = [{ id: 1, tipo: 'financiamento_producao' }];
  assert.equal(conflitoFinanciamentoUnico('financiamento_producao', existentes, 1), undefined);
  // Mas outro registro tentando virar financiamento, sim.
  assert.deepEqual(conflitoFinanciamentoUnico('financiamento_producao', existentes, 9), { id: 1, tipo: 'financiamento_producao' });
});

// ── Campos de financiamento_producao (§4.3, preservados da #405) ──────────

test('#355 exposicao_minima e percentual_financiavel aceitam 0-100 e rejeitam acima disso', () => {
  assert.equal(validarCamposOperacao({ exposicao_minima: 0 }), null);
  assert.equal(validarCamposOperacao({ exposicao_minima: 20 }), null);
  assert.equal(validarCamposOperacao({ percentual_financiavel: 100 }), null);
  assert.match(String(validarCamposOperacao({ exposicao_minima: 101 })), /não pode passar de 100/);
  assert.match(String(validarCamposOperacao({ percentual_financiavel: -5 })), /não pode ser negativo/);
});

test('#355 custo_linha_ids precisa ser uma lista de números', () => {
  assert.equal(validarCamposOperacao({ custo_linha_ids: [1, 5, 8] }), null);
  assert.equal(validarCamposOperacao({ custo_linha_ids: [] }), null);
  // null é "sem seleção própria" (cai na base padrão no motor) — não é erro.
  assert.equal(validarCamposOperacao({ custo_linha_ids: null }), null);
  assert.match(String(validarCamposOperacao({ custo_linha_ids: 'abc' })), /lista de números/);
  assert.match(String(validarCamposOperacao({ custo_linha_ids: [1, 'x'] })), /lista de números/);
});

test('#355 amortizar_com_caixa_disponivel não passa pela checagem numérica (é booleano)', () => {
  assert.equal(validarCamposOperacao({ amortizar_com_caixa_disponivel: true }), null);
  assert.equal(validarCamposOperacao({ amortizar_com_caixa_disponivel: false }), null);
});

// ── #587 — `ativo`, genérico na coluna, restrito ao Financiamento à produção ──

test('#587 ativo é aceito em financiamento_producao, ligado ou desligado', () => {
  assert.equal(validarCamposOperacao({ tipo: 'financiamento_producao', ativo: true }), null);
  assert.equal(validarCamposOperacao({ tipo: 'financiamento_producao', ativo: false }), null);
});

test('#587 ativo é recusado em divida e equity — o produto não tem status', () => {
  for (const tipo of ['divida', 'equity']) {
    const msg = validarCamposOperacao({ tipo, ativo: false });
    assert.ok(msg, `tipo=${tipo} devia recusar`);
    assert.match(msg!, /ativo.*Financiamento à produção/);
  }
});

test('#587 ativo não numérico/string não passa como booleano válido', () => {
  const msg = validarCamposOperacao({ tipo: 'financiamento_producao', ativo: 'sim' as any });
  assert.ok(msg);
  assert.match(msg!, /booleano/);
});

test('#587 PATCH: a checagem usa o TIPO FINAL (atual + patch), não só o corpo do patch', () => {
  // Simula a chamada real do handler PATCH: validarCamposOperacao({ ...operacao, ...dados }).
  // Um PATCH que manda só `{ ativo: false }` numa operação de dívida tem de
  // recusar mesmo sem repetir `tipo` no corpo.
  const operacaoExistente = { id: 1, tipo: 'divida', nome: 'Dívida A' };
  const patch = { ativo: false };
  const msg = validarCamposOperacao({ ...operacaoExistente, ...patch });
  assert.ok(msg);
  assert.match(msg!, /Financiamento à produção/);
});

test('#587 (achado do Codex, PR 671): PATCH que não toca `ativo` numa Dívida/Equity EXISTENTE não pode recusar', () => {
  // Toda linha da tabela nasce com `ativo: true` (padrão do schema.json) —
  // inclusive Dívida/Equity, onde o campo é inerte. `operacaoExistente`
  // simula o que `req.dados!.buscar` devolve depois da migração 039: já traz
  // `ativo: true`, mesmo sem o cliente nunca ter mandado esse campo. Um PATCH
  // que só renomeia a operação (sem tocar `ativo`) tem que passar — testar
  // `dados.ativo !== undefined` no estado FINAL rejeitaria isso sempre,
  // porque o `ativo: true` herdado da linha nunca é `undefined`.
  const operacaoExistente = { id: 2, tipo: 'divida', nome: 'Dívida A', ativo: true };
  const patch = { nome: 'Dívida A renomeada' };
  const msg = validarCamposOperacao({ ...operacaoExistente, ...patch });
  assert.equal(msg, null, `PATCH que não toca ativo não pode ser recusado, e foi: ${msg}`);
});

test('#587: `ativo: true` explícito em Dívida/Equity é um no-op harmless, não erro', () => {
  // Só `false` ("desligar") não faz sentido fora da FàP. `true` é o estado
  // default e nunca precisa de bloqueio.
  for (const tipo of ['divida', 'equity']) {
    assert.equal(validarCamposOperacao({ tipo, ativo: true }), null);
  }
});

test('#587 remocaoFinanciamentoBloqueada: só o Financiamento à produção é fixo', () => {
  assert.equal(remocaoFinanciamentoBloqueada({ tipo: 'financiamento_producao' }), true);
  assert.equal(remocaoFinanciamentoBloqueada({ tipo: 'divida' }), false);
  assert.equal(remocaoFinanciamentoBloqueada({ tipo: 'equity' }), false);
});

// ── #435 — teto de `Σ pct_retorno` ────────────────────────────────────────
//
// A regra é da spec vigente (`docs/viabilidade/fluxo-investidor-formulas.md`
// §2, "Teto de Σ pct_retorno"), NÃO da planilha: a planilha tem uma operação
// só e é fonte nula aqui. O enunciado original vivia na §6 de
// `funding-capital-stack.md`, que é ADR supersedido.

test('#435 pct_retorno entra na faixa 0-100 (uma operação isolada)', () => {
  assert.equal(validarCamposOperacao({ pct_retorno: 0 }), null);
  assert.equal(validarCamposOperacao({ pct_retorno: 100 }), null);
  assert.match(String(validarCamposOperacao({ pct_retorno: 101 })), /não pode passar de 100/);
  // A regra antiga (negativo) continua valendo.
  assert.match(String(validarCamposOperacao({ pct_retorno: -2 })), /não pode ser negativo/);
});

test('#435 a soma do estudo é barrada em 100%, não a operação isolada', () => {
  const eq = (pct: number, id = 1, modo = 'permuta_financeira') =>
    ({ id, tipo: 'equity', modo_retorno: modo, pct_retorno: pct });

  // 60 + 40 = 100: cabe.
  assert.equal(somaRetornoExcede([eq(60)], { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 40 }), null);
  // 60 + 41 = 101: recusa, e a mensagem diz a soma e o que sobra.
  const m = somaRetornoExcede([eq(60)], { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 41 });
  assert.match(String(m), /não pode superar 100%/);
  assert.match(String(m), /60\.00%/);
  assert.match(String(m), /101\.00%/);
  assert.match(String(m), /Sobra 40\.00%/);
});

test('#435 o PATCH da própria operação não se conta duas vezes', () => {
  const existentes = [{ id: 1, tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 60 }];
  // Sem `ignorarId` isto somaria 60 + 70 = 130 e travaria TODA edição.
  assert.equal(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 70 }, 1), null);
  // Uma SEGUNDA operação a 70, porém, estoura.
  assert.match(
    String(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 70 }, 2)),
    /não pode superar 100%/,
  );
});

test('#435 as duas somas são independentes — bases diferentes não competem', () => {
  const existentes = [{ id: 1, tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 90 }];
  // 90% da Receita Líquida + 90% do Resultado Final: válido.
  assert.equal(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'resultado_final', pct_retorno: 90 }), null);
  // Mas 90 + 90 no MESMO modo, não.
  assert.match(
    String(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 90 })),
    /não pode superar 100%/,
  );
  // E o teto do `resultado_final` existe de verdade.
  assert.match(
    String(somaRetornoExcede(
      [{ id: 1, tipo: 'equity', modo_retorno: 'resultado_final', pct_retorno: 90 }],
      { tipo: 'equity', modo_retorno: 'resultado_final', pct_retorno: 20 },
    )),
    /Resultado Final/,
  );
});

test('#435 operação gravada SEM modo_retorno conta como permuta_financeira (default)', () => {
  // O default vive no banco (`schema.json:413`) e no motor; sem aplicá-lo aqui,
  // a linha escaparia das DUAS somas.
  const existentes = [{ id: 1, tipo: 'equity', pct_retorno: 90 }];
  assert.match(
    String(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 20 })),
    /não pode superar 100%/,
  );
  // E o novo sem o campo também cai na soma A.
  assert.match(
    String(somaRetornoExcede(existentes, { tipo: 'equity', pct_retorno: 20 })),
    /não pode superar 100%/,
  );
  // Contra `resultado_final`, porém, o existente sem campo não compete.
  assert.equal(somaRetornoExcede(existentes, { tipo: 'equity', modo_retorno: 'resultado_final', pct_retorno: 20 }), null);
});

test('#435 tipo diferente de equity não entra na soma, nem como existente nem como novo', () => {
  // `pct_retorno` existe na tabela para os 3 tipos, com default 0 — somar
  // dívida/financiamento contaria linha que não distribui receita.
  assert.equal(somaRetornoExcede(
    [{ id: 1, tipo: 'divida', pct_retorno: 90 }],
    { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 90 },
  ), null);
  assert.equal(somaRetornoExcede(
    [{ id: 1, tipo: 'financiamento_producao', pct_retorno: 90 }],
    { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 90 },
  ), null);
  // Uma dívida nova nunca é barrada, mesmo com equity cheio no estudo.
  assert.equal(somaRetornoExcede(
    [{ id: 1, tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 100 }],
    { tipo: 'divida', pct_retorno: 90 },
  ), null);
});

test('#435 tolerância de ponto flutuante: 60 + 40,001 cabe, 60 + 40,02 não', () => {
  // `> 100.01`, não `> 100` estrito — mesmo padrão de `erroFormularioAbsorcao`.
  const existentes = [{ id: 1, tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 60 }];
  assert.equal(somaRetornoExcede(existentes, { tipo: 'equity', pct_retorno: 40.001 }), null);
  assert.match(
    String(somaRetornoExcede(existentes, { tipo: 'equity', pct_retorno: 40.02 })),
    /não pode superar 100%/,
  );
});

test('#435 estudo sem equity ainda aceita a primeira operação inteira', () => {
  assert.equal(somaRetornoExcede([], { tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 100 }), null);
  // 100 é o limite; a segunda a 0,02 já estoura.
  assert.match(
    String(somaRetornoExcede(
      [{ id: 1, tipo: 'equity', modo_retorno: 'permuta_financeira', pct_retorno: 100 }],
      { tipo: 'equity', pct_retorno: 0.02 },
    )),
    /Sobra 0\.00%/,
  );
});
