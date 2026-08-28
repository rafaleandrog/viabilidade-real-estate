// Render do Painel do investidor (Funding) com uma operação de 9 DÍGITOS
// (#579 — "o VALOR salta para fora do quadro do KPI"). Ver o topo de
// `casos/ind-funding.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Funding: um indicador do investidor (9 dígitos) não salta da caixa (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'ind-funding' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algum .ind-card estourou a track' + relato(a));
  assert.equal(
    contar(a, 'transbordoDeTexto'), 0,
    'Um indicador do investidor (9 dígitos) saltou para fora do quadro — #579.' + relato(a),
  );
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois cards se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});
