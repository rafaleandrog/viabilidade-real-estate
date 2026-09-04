// Render do checkbox "Ativo" da aba Financiamento à produção (#587). Ver o
// topo de `casos/funding-fap-checkbox.ts` para o porquê de medir aqui — a
// fiação entre o checkbox e `atualizarFundingOperacao`, que teste de função
// pura não alcança.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#587: clicar o checkbox "Ativo" da FàP chama a API com ativo=false', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-fap-checkbox', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const extra = a.extra?.['900'] as { patchChamado: boolean; ativoNoPatch: unknown } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.equal(
    extra!.patchChamado, true,
    'clicar o checkbox "Ativo" tinha que disparar um PATCH — apagar o `@urbi:checkbox-change` '
      + 'do template deixaria este caso vermelho e todo teste de função pura verde' + relato(a),
  );
  assert.equal(
    extra!.ativoNoPatch, false,
    `o PATCH tinha que mandar { ativo: false } ao desmarcar, e mandou ${JSON.stringify(extra!.ativoNoPatch)}`
      + relato(a),
  );
});
