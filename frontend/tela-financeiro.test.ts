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
  // #585 (rodada 2): o botão trava ENQUANTO o valor é inválido, como o "Aplicar"
  // do modal irmão — validar só no clique deixava o usuário com um toast que
  // some e nenhum campo marcado.
  assert.match(fonte, /\?desabilitado=\$\{Boolean\(erroJuros\)\}/,
    'o botão Salvar voltou a aceitar clique com a taxa inválida');
  assert.match(fonte, /const erroJuros = erroJurosTabelaEstudo\(this\.form\['juros_tabela_aa_padrao'\]\);/,
    'o erro deixou de ser recalculado no render — o botão para de acompanhar a digitação');
});

// ─────────────────────────────────────────────────────────────────────────
// #585 — a TABELA que mantém os três validadores da coluna alinhados
// ─────────────────────────────────────────────────────────────────────────
//
// `estudos.juros_tabela_aa_padrao` é validada em TRÊS lugares, e eles não
// compartilham código porque rodam em runtimes diferentes:
//
//   · `erroJurosTabelaEstudo`      — aqui, no navegador (feedback imediato);
//   · `percentualEstrito`          — `backend/rotas/estudos.ts` (a fronteira);
//   · `numeroLimpo`                — `migracoes/037_…` (runner de migração).
//
// ⚠️ **Três regras para um campo é exatamente como a classe de defeito desta
// issue começa.** Medido antes deste conserto: a migração rejeitava `'0x10'`,
// `'1e3'`, `'  '`, `true` e `[]`, e os outros dois os aceitavam como 16, 1000,
// 0, 1 e 0 — na coluna que governa os juros de TODAS as linhas de receita.
//
// Esta tabela é exercitada **aqui** contra o validador da tela, e **em
// `backend/rotas/estudos.test.ts`** contra o do PATCH — os dois com a mesma
// lista, então divergirem um do outro fica vermelho.
//
// ⚠️ **A migração NÃO é coberta por esta tabela, e é preciso dizê-lo.**
// `numeroLimpo` não é exportado (migração é módulo de runner, sem superfície de
// import), então o que o harness prova é o COMPORTAMENTO em quatro entradas —
// `''`, `'0x10'`, `'1e3'` e `taxaMensal: '0x10'`, nos estudos 12 a 15 — não a
// tabela inteira. As doze restantes valem para dois dos três validadores.
// Escrito assim de propósito: dizer "a mesma lista está nos três" seria a
// afirmação plausível e falsa que esta issue passou seis rodadas caçando.

const ENTRADAS_DA_COLUNA: Array<[unknown, boolean, string]> = [
  // valor            aceita?  por quê
  [12.5,              true,  'número decimal, o caso normal'],
  [0,                 true,  '0% é venda sem juros — escolha explícita'],
  ['12.5',            true,  'string decimal é aceitável: vem do JSON/PATCH'],
  [-5,                false, 'negativo inverte o fluxo de caixa do estudo'],
  [-0.01,             false, 'a faixa que o motor NÃO defende (ele só clampa <= -100)'],
  ['0x10',            false, "Number('0x10') é 16 — hexadecimal não é percentual digitado"],
  ['1e3',             false, "Number('1e3') é 1000 — notação científica idem"],
  ['  ',              false, "Number('  ') é 0 — espaço em branco não é resposta"],
  ['12,5',            false, 'vírgula: aqui não há usuário digitando, é dado persistido'],
  ['abc',             false, 'lixo'],
  [true,              false, 'Number(true) é 1'],
  [[],                false, 'Number([]) é 0'],
  [[12.5],            false, 'Number([12.5]) é 12.5 — array não é número'],
  [{},                false, 'objeto'],
  [Infinity,          false, 'não finito'],
  [NaN,               false, 'não finito'],
];

test('#585 os três validadores da coluna concordam — tabela de entradas', () => {
  for (const [valor, aceita, motivo] of ENTRADAS_DA_COLUNA) {
    const erro = erroJurosTabelaEstudo(valor);
    assert.equal(erro === null, aceita,
      `${JSON.stringify(valor)} deveria ser ${aceita ? 'aceito' : 'recusado'} — ${motivo}`);
  }
  // `null`/`undefined`/`''` são "não configurado", e são aceitos: é como o
  // usuário esvazia o campo. Ficam fora da tabela porque não são valores.
  assert.equal(erroJurosTabelaEstudo(null), null);
  assert.equal(erroJurosTabelaEstudo(undefined), null);
  assert.equal(erroJurosTabelaEstudo(''), null);
});
