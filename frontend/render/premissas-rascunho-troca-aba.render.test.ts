// Render: edição não salva das Premissas do Preliminar continua acusada como
// não salva depois de trocar de página do estudo e voltar, e o aviso de saída
// (`beforeunload`) segue o rascunho sem sobrar depois de a tela sair. Ver o
// topo de `casos/premissas-rascunho-troca-aba.ts` para o porquê de medir aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Premissas: rascunho sobrevive à troca de página com a faixa de não salvo, e o beforeunload o protege sem vazar', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'premissas-rascunho-troca-aba', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const m = a.extra?.['1280'] as Record<string, unknown> | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  // Sem isto o caso não exercita o defeito: a tela de Premissas tem de ter
  // sido DESMONTADA e montada de novo pela troca de página.
  assert.equal(m!.recriada, true, 'a troca de página não recriou a tela de Premissas — a fixture não prova nada' + relato(a));
  assert.equal(String(m!.valorDepois), '1500', 'o rascunho não voltou para o formulário depois da troca de página' + relato(a));
  assert.equal(m!.avisoDepois, true,
    'depois de trocar de página e voltar, a edição não salva aparece como salva (sem a faixa de "não salvo")' + relato(a));
  assert.equal(m!.saidaBloqueadaMontado, true, 'com rascunho pendente, o beforeunload não pediu confirmação' + relato(a));
  assert.equal(m!.saidaBloqueadaDesmontado, false, 'o listener de beforeunload sobrou depois de a tela do estudo sair' + relato(a));
});
