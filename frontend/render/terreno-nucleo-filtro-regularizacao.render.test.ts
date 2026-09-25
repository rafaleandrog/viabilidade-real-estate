// Render do filtro do seletor "Adicionar lote" (Terreno & Áreas, Incorporação):
// excluir lotes de parcelamento com `regularizacao=true` ou com
// `setor_habitacional_id` preenchido (#746) e mostrar a busca por texto. Ver
// `casos/terreno-nucleo-filtro-regularizacao.ts` para o cenário — três lotes
// vindos do Núcleo: um preso a um parcelamento de regularização fundiária, um
// a um parcelamento de setor habitacional, e um a um parcelamento normal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('seletor de lote exclui regularização fundiária e setor habitacional e mostra busca por texto', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'terreno-nucleo-filtro-regularizacao', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const extra = a.extra?.['900'] as {
    chamadas: string[]; opcoesValores: string[]; opcoesRotulos: string[]; temBuscaInput: boolean;
    temSelect: boolean; imovelVinculadoNoPost: number | null;
  } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  assert.ok(
    extra!.chamadas.some((r) => r.startsWith('/parcelamentos')),
    'o componente tem que resolver os parcelamentos de regularização — sem isso o filtro não '
      + `liga em nada. Chamadas vistas: ${JSON.stringify(extra!.chamadas)}` + relato(a),
  );
  assert.ok(
    extra!.chamadas.some((r) => r.startsWith('/lotes')),
    'o componente tem que buscar lotes — sem isso a fixture não prova nada' + relato(a),
  );

  assert.deepEqual(
    extra!.opcoesValores, ['2'],
    'o lote #1 (parcelamento 10, regularizacao=true) e o lote #3 (parcelamento 30, setor_habitacional_id=7) '
      + `tinham que sumir da lista de resultados, e só o lote #2 (parcelamento 20, normal) ficar. Opções vistas: ${JSON.stringify(extra!.opcoesRotulos)}`
      + relato(a),
  );

  assert.equal(
    extra!.temBuscaInput, true,
    'o seletor de lote (Incorporação) tem que mostrar um campo de busca por texto' + relato(a),
  );

  assert.equal(
    extra!.temSelect, false,
    'campo único: não pode existir um <urbi-select> separado no fluxo de lote — a lista de '
      + 'resultados fica anexada ao mesmo <urbi-input class="busca">' + relato(a),
  );

  assert.equal(
    extra!.imovelVinculadoNoPost, 2,
    'clicar no item do <urbi-lista> (evento urbi:lista-click) tem que chegar a _adicionar() e '
      + 'virar um POST /estudos/:id/imoveis com o lote #2 (o elegível) — sem isso a lista só '
      + 'prova que POPULA, não que o clique VINCULA o lote certo' + relato(a),
  );
});
