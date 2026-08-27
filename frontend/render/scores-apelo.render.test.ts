// Render dos scores do Apelo Comercial com um valor de 9 DÍGITOS (#579 — "o
// VALOR salta para fora do quadro do KPI"). `viab-tela-apelo` é compartilhada
// entre Preliminar e Avançado (ver o topo de `casos/scores-apelo.ts`) — um
// caso cobre os dois.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Apelo Comercial: um score de 9 dígitos e o nome do fator não saltam da caixa (#579)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'scores-apelo' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'algum urbi-kpi estourou a track' + relato(a));
  assert.equal(
    contar(a, 'transbordoDeTexto'), 0,
    'Um score/rótulo de fator saltou para fora do quadro — #579.' + relato(a),
  );
  assert.equal(contar(a, 'sobreposicao'), 0, 'dois cards de score se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});
