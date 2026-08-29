// Render da ABERTURA POR PARTE da aba Análise Financeira (#594).
//
// O `exigir` do caso é a asserção principal e ela roda ANTES destas lentes:
// sem a chamada a `_renderRetornoPorParte`/`_renderRoiProjeto` em
// `_renderAnaliseFinanceira`, os seletores `table.proforma.partes`,
// `tr.parte-incorporador`, `tr.parte-tranche` e `td.roi-projeto` não casam nada
// e o harness rejeita a montagem. O TETO ("duas tranches, não três") é
// assertado dentro do `montar` do caso — ver o cabeçalho de
// `frontend/render/casos/retorno-por-parte.ts` para o porquê de ele não caber
// em `exigir`, que só tem piso.
//
// As lentes abaixo cobrem o risco próprio da tabela nova: ela tem 8 colunas
// contra as 2 das outras duas `table.proforma` do arquivo, então é a primeira
// desta tela que pode empurrar rolagem horizontal no DOCUMENTO — e as células
// de MOIC/TIR/Payback trazem `td.pos`/`td.neg`/`td.vazio`, cores novas que
// precisam resolver nas duas variantes de tema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('#594: a abertura por parte chega à tela (fiação da Análise Financeira)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'retorno-por-parte' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('#594: a tabela de 8 colunas rola dentro de si, e nenhuma cor some no fundo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'retorno-por-parte', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela rolou o documento na horizontal' + relato(a));
});
