import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  camposVisiveisFinanceiro, sujeitoRetVisivelFinanceiro, impostoPercentualEditavel,
  erroJurosTabelaEstudo,
} from './tela-financeiro.js';

// #450 (D8/D-Q08, 2026-08-22): a aba Financeiro do Avançado parava de exibir
// controles sem consumidor no Avançado. Os testes de frontend deste repo são
// de lógica pura (sem DOM) — a decisão de o quê renderizar/desabilitar foi
// extraída para estas três funções puras, exportadas só para isto.

test('#450 camposVisiveisFinanceiro: no Avançado, só taxa_desconto_aa e imposto_percentual', () => {
  assert.deepEqual(camposVisiveisFinanceiro('avancado'), ['taxa_desconto_aa', 'imposto_percentual']);
});

test('#450 camposVisiveisFinanceiro: fora do Avançado, a aba não renderiza nada', () => {
  assert.deepEqual(camposVisiveisFinanceiro('preliminar'), []);
  assert.deepEqual(camposVisiveisFinanceiro(''), []);
});

test('#450 camposVisiveisFinanceiro: os 7 controles removidos nunca aparecem na lista, em nível nenhum', () => {
  const removidos = [
    'regime_tributario', 'aliquota_pis_pct', 'aliquota_cofins_pct', 'aliquota_csll_pct',
    'aliquota_irpj_pct', 'aliquota_itbi_pct', 'imposto_sobre_permuta_fisica',
  ];
  for (const nivel of ['avancado', 'preliminar', '']) {
    const visiveis = camposVisiveisFinanceiro(nivel);
    for (const campo of removidos) {
      assert.ok(!visiveis.includes(campo), `${campo} não deveria aparecer para nivel="${nivel}"`);
    }
  }
});

test('#450 (D-Q08) sujeitoRetVisivelFinanceiro: oculto no Avançado, visível fora dele', () => {
  assert.equal(sujeitoRetVisivelFinanceiro('avancado'), false);
  assert.equal(sujeitoRetVisivelFinanceiro('preliminar'), true);
  assert.equal(sujeitoRetVisivelFinanceiro(''), true);
});

test('#450 impostoPercentualEditavel: nunca editável na aba Financeiro — só o Preliminar (Premissas) edita de fato', () => {
  assert.equal(impostoPercentualEditavel('avancado'), false);
  assert.equal(impostoPercentualEditavel('preliminar'), false);
});

// ─────────────────────────────────────────────────────────────────────────
// #585 — a taxa de tabela do estudo
// ─────────────────────────────────────────────────────────────────────────
//
// A #585 tirou o campo de juros do modal de Fluxo de pagamento e, junto com
// ele, a validação de `erroFormularioPagamento` que barrava taxa negativa.
// Estes testes são o que devolve essa garantia — e a prova de que ela está
// LIGADA, não só escrita.

test('#585 erroJurosTabelaEstudo: taxa negativa é barrada, inclusive fora do domínio extremo', () => {
  // A faixa que ninguém cobria: `taxaMensalDeAnual` só clampa `aa <= -100`, e
  // é a faixa `-100 < aa < 0` que um usuário digita sem querer. `-5` produzia
  // uma taxa mensal negativa VÁLIDA (-0,004265…), aplicada a todo componente
  // financiado de todo o estudo.
  assert.ok(erroJurosTabelaEstudo(-5));
  assert.ok(erroJurosTabelaEstudo(-0.01));
  assert.ok(erroJurosTabelaEstudo(-150));
  assert.ok(erroJurosTabelaEstudo(NaN));
  assert.ok(erroJurosTabelaEstudo(Infinity));
});

test('#585 erroJurosTabelaEstudo: 0 e vazio são respostas válidas, não erros', () => {
  // `0` é "venda sem juros", uma escolha explícita — nunca pode ser tratado
  // como ausência (é a mesma regra que a migração `037` aplica na votação).
  assert.equal(erroJurosTabelaEstudo(0), null);
  assert.equal(erroJurosTabelaEstudo(12.5), null);
  assert.equal(erroJurosTabelaEstudo(null), null);
  assert.equal(erroJurosTabelaEstudo(undefined), null);
  assert.equal(erroJurosTabelaEstudo(''), null);
});

test('#585 FIAÇÃO: a tela BARRA antes de persistir e PROPAGA depois de salvar', () => {
  // As duas mutações que o typecheck não pega e que a suíte inteira não
  // acusaria: apagar a chamada de validação (o campo volta a aceitar taxa
  // negativa) e apagar o `dispatchEvent` (o valor salvo não chega às outras
  // abas até alguém recarregar a página).
  const fonte = readFileSync(new URL('./tela-financeiro.ts', import.meta.url), 'utf8');
  assert.match(
    fonte,
    /const invalido = erroJurosTabelaEstudo\(this\.form\['juros_tabela_aa_padrao'\]\);\s*\n\s*if \(invalido\)/,
    'a tela parou de barrar a taxa inválida antes do PATCH',
  );
  assert.match(
    fonte,
    /dispatchEvent\(new CustomEvent\('viab:premissas-change'/,
    'a tela parou de propagar o valor salvo — as outras abas ficam com a taxa velha',
  );
  // E o evento tem de ATRAVESSAR o shadow DOM até `tela-estudo`, senão ele
  // morre no próprio componente e a propagação é decorativa.
  assert.match(fonte, /bubbles: true, composed: true/);
});
