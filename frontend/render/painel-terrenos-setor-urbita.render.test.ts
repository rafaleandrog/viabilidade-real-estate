// Render da aba Terrenos do Painel: só lotes do setor Urbitá; glebas, qualquer uma. Ver
// `casos/painel-terrenos-setor-urbita.ts` para o cenário e para o porquê de existir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

type Extra = { linhas: string[]; aviso: string };

async function rodar(caso: string) {
  const a = await verificarRender({ caso, larguras: [1280] });
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  const extra = a.extra?.['1280'] as Extra | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  return { extra: extra!, a };
}

test('Terrenos: lote só do setor Urbitá, gleba qualquer uma', { skip: pular ?? false }, async () => {
  const { extra, a } = await rodar('painel-terrenos-setor-urbita');
  assert.deepEqual(
    [...extra.linhas].sort(), ['GLEBA-A', 'GLEBA-B', 'LOTE-URBITA'],
    `só o lote do parcelamento do setor Urbitá e as duas glebas podiam aparecer. Linhas: ${JSON.stringify(extra.linhas)}` + relato(a),
  );
  assert.equal(extra.aviso, '', 'com o setor resolvido não há banner de lotes ocultos' + relato(a));
});

test('Terrenos: sem permissão em setores habitacionais, esconde TODOS os lotes e avisa (fail-closed)', { skip: pular ?? false }, async () => {
  const { extra, a } = await rodar('painel-terrenos-setor-sem-permissao');
  assert.deepEqual(
    [...extra.linhas].sort(), ['GLEBA-A', 'GLEBA-B'],
    `sem identificar o setor nenhum lote pode aparecer; as glebas seguem. Linhas: ${JSON.stringify(extra.linhas)}` + relato(a),
  );
  assert.match(extra.aviso, /Lotes ocultos/, 'o motivo tem que aparecer na tela' + relato(a));
});
