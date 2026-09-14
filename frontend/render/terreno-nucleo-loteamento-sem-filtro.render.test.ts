// Render: Loteamento (gleba) continua sem busca por texto e sem chamada a
// `/parcelamentos` — o pedido do autor exclui essa tela explicitamente. Ver
// `casos/terreno-nucleo-loteamento-sem-filtro.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('seletor de gleba (Loteamento) não ganha busca nem filtro de regularização', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'terreno-nucleo-loteamento-sem-filtro', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const extra = a.extra?.['900'] as
    { chamadas: string[]; temBuscaInput: boolean; temPaginacaoNumerica: boolean } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  assert.ok(
    extra!.chamadas.some((r) => r.startsWith('/glebas')),
    'o ramo Loteamento tem que continuar buscando /glebas' + relato(a),
  );
  assert.deepEqual(
    extra!.chamadas.filter((r) => r.startsWith('/parcelamentos')), [],
    'Loteamento não pode chamar /parcelamentos — o filtro de regularização fundiária é só de '
      + `Incorporação. Chamadas vistas: ${JSON.stringify(extra!.chamadas)}` + relato(a),
  );
  assert.equal(
    extra!.temBuscaInput, false,
    'o seletor de gleba não pode ganhar o campo de busca por texto — pedido explícito do autor'
      + relato(a),
  );
  assert.equal(
    extra!.temPaginacaoNumerica, true,
    'o seletor de gleba tem que manter a paginação numérica antiga (Página X de Y)' + relato(a),
  );
});
