// Render da aba ANÁLISE FINANCEIRA do Avançado — a marca de sinal na SEGUNDA
// `<table class="proforma">` de `tela-fluxo-ver.ts` (#593).
//
// O `exigir` do caso é a asserção principal e ela roda ANTES destas lentes:
// sem `class="num ${sinal}"` em `_renderAnaliseFinanceira`, `tr.n0.receita
// td.neg` e `tr.n0.resultado td.neg` não casam nada e o harness rejeita a
// montagem. Ver o cabeçalho de `frontend/render/casos/analise-financeira-sinal.ts`
// para o porquê de o defeito ter atravessado o primeiro commit da issue: não
// havia caso de render nenhum com `vista: 'analise'`.
//
// As lentes abaixo cobrem o risco próprio de a regra de cor passar a ALCANÇAR
// esta tabela: `tr.receita td` e `tr.resultado td` trazem fundo por `color-mix`
// e `font-weight`/`padding-top` novos, então um token que não resolva deixaria
// texto da cor do próprio fundo, e a caixa maior pode empurrar layout numa aba
// que também tem KPIs, controles e três gráficos na mesma tela.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Análise Financeira: a marca de sinal chega à célula (fiação da #593)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'analise-financeira-sinal' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Análise Financeira: as cores resolvem e nenhum texto some no fundo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'analise-financeira-sinal', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela rolou o documento na horizontal' + relato(a));
});
