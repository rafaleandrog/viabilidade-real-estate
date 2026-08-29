// Render da tabela do Fluxo de Caixa COM funding — a verificação do critério 8
// da #592.
//
// ⚠️ A asserção que importa roda ANTES destas lentes: é o `exigir` do caso
// (`frontend/render/casos/tabela-fluxo-funding.ts`), que o harness confere na
// montagem. Ele exige as quatro linhas de fecho, os dois blocos de funding com
// a natureza certa, e — pelo combinador `~` — a ORDEM entre eles. Apagar a
// montagem de qualquer uma das seções deixa este caso VERMELHO, que é
// literalmente o que o critério 8 pede.
//
// As lentes abaixo cobrem o risco próprio de acrescentar linhas e duas
// divisórias novas a uma tabela que já é a mais larga do app: caixa que
// ultrapassa o pai, caixa pintando sobre caixa, e token que não resolve nas
// quatro variantes de tema.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('#592 tabela com funding: as duas seções de fecho chegam ao DOM, na ordem', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'tabela-fluxo-funding' });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela empurrou o DOCUMENTO na horizontal' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  // Mesma ressalva do caso irmão: transbordo de TEXTO e corte por overflow
  // oculto dependem da MÉTRICA DE GLIFO, e a fonte deste ambiente não é a da
  // instância. Reportado, nunca asseverado — asseverar plantaria um teste que
  // muda de veredito conforme a máquina.
  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});
