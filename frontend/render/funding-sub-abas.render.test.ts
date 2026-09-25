// Render das sub-abas por OPERAÇÃO dentro de um tipo de Funding (Dívida com
// duas operações). Ver o topo de `casos/funding-sub-abas.ts` para o porquê de
// medir aqui — a troca de sub-aba é fiação (evento → estado → re-render) que
// nenhum teste de função pura alcança.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, naoDeclaradas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Funding: duas operações do mesmo tipo montam em sub-abas próprias', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-sub-abas', larguras: [900] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));

  const extra = a.extra?.['900'] as { ativaAntes: string | null; ativaDepois: string | null } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.equal(
    extra!.ativaAntes, '10',
    'a primeira operação de Dívida (id 10) tinha que ser a sub-aba ativa por padrão' + relato(a),
  );
  assert.equal(
    extra!.ativaDepois, '11',
    'disparar `urbi:aba-selecionar` com a segunda operação (id 11) tinha que mudar a sub-aba ativa — '
      + 'apagar o handler do template deixaria este caso vermelho e todo teste de função pura verde' + relato(a),
  );
});
