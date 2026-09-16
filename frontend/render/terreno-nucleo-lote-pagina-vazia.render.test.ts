// Render: busca vazia de lote (Terreno & Áreas, Incorporação) tem que achar
// lotes elegíveis mesmo quando a página 1 do Núcleo cai inteira no filtro de
// regularização fundiária — sem o usuário precisar digitar nada. Ver
// `casos/terreno-nucleo-lote-pagina-vazia.ts` para o cenário (achado do
// usuário, 2026-09-16).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('busca vazia de lote avança página sozinha quando a 1ª vem zerada pelo filtro', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'terreno-nucleo-lote-pagina-vazia', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const extra = a.extra?.['900'] as {
    chamadasLotes: string[]; opcoesValores: string[]; opcoesRotulos: string[]; buscaDigitada: string;
  } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  assert.equal(
    extra!.buscaDigitada, '',
    'este caso prova o carregamento INICIAL, sem digitar nada — se a busca não está vazia, o '
      + 'caso não está medindo o cenário certo' + relato(a),
  );

  assert.ok(
    extra!.chamadasLotes.length >= 2,
    'o componente tem que pedir pelo menos a página 1 E a página 2 sozinho — sem isso, a causa '
      + `raiz não foi consertada. Chamadas vistas: ${JSON.stringify(extra!.chamadasLotes)}` + relato(a),
  );

  assert.deepEqual(
    extra!.opcoesValores, ['2'],
    'com a página 1 inteira excluída pelo filtro de regularização, o lote #2 da página 2 tinha '
      + 'que aparecer na lista de resultados SEM o usuário digitar nada — antes deste conserto a '
      + `tela ficava presa em "0 lotes elegíveis". Opções vistas: ${JSON.stringify(extra!.opcoesRotulos)}`
      + relato(a),
  );
});
