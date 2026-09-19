// Render da Proforma do AVANÇADO com cor por natureza de linha (#593).
//
// O `exigir` do caso é a asserção principal e ela roda ANTES destas lentes:
// sem `class="num ${sinal}"` em `_renderProforma`, `tr.receita td.pos` e
// `tr.resultado td.neg` não casam nada e o harness rejeita a montagem. Ver o
// cabeçalho de `frontend/render/casos/proforma-avancada-cores.ts` para a
// divisão de trabalho com `frontend/proforma-cores.test.ts` (que é quem prova
// que as REGRAS existem e são as mesmas do Preliminar).
//
// As lentes abaixo rodam por cima disso e cobrem o risco próprio de acrescentar
// fundo e peso a linhas de tabela: `padding-top` novo na linha de resultado e
// `font-weight: 800` podem empurrar caixa, e um `color-mix` que não resolva
// deixaria texto da cor do próprio fundo — é o que `textosInvisiveis` e
// `tokensSemValor` medem, nas quatro variantes de tema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Proforma do Avançado: a marca de sinal chega à célula (fiação da #593)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-avancada-cores' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('#754: a coluna R$ da Proforma do Avançado publica INTEIROS na tela — sonda de DOM contra realocação', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-avancada-cores', larguras: [1280] });
  const m = a.extra?.['1280'] as { celulasRs: number; comCentavos: string[] } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.ok(m!.celulasRs >= 5, `poucas células R$ medidas (${m!.celulasRs}) — a Proforma não montou inteira` + relato(a));
  assert.deepEqual(m!.comCentavos, [], 'célula da coluna R$ da Proforma do Avançado publicou centavos — a exceção de inteiros (#754) não chegou à tela' + relato(a));
});

test('Proforma do Avançado: as cores novas resolvem e nenhum texto some no fundo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-avancada-cores', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela rolou o documento na horizontal' + relato(a));
});
