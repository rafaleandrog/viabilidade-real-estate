// Render do achado do revisor no PR 669 (#664): o que `viab-num` FAZ ao
// receber `null` onde antes recebia número. Ver o topo de
// `casos/premissas-valor-unidade-null.ts` para o cenário e o porquê de medir
// aqui, e não em `frontend/premissas-valor-unidade.test.ts` (que para em
// `_valorUnidade`, sem atravessar a fiação de `viab-num`).
//
// Duas asserções, e as duas são o achado: campo VAZIO (não `"NaN"`, não a
// string `"null"`) e NENHUM evento `urbi:input-numero-change` disparado só
// por a prop ter mudado — Lit não dispara evento em `set` de propriedade, mas
// é exatamente essa premissa que este teste prova, em vez de presumir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#664: viab-num recebe null (canônico presente, ligação zerada) e fica VAZIO, sem evento espúrio', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'premissas-valor-unidade-null', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const extra = a.extra?.['900'] as { valorInput: string; eventoDisparou: boolean } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.equal(
    extra!.valorInput, '',
    `o <input> do viab-num tinha que ficar VAZIO com o canônico presente e a ligação zerada, `
      + `e mostrou "${extra!.valorInput}" — NaN/"null" seria a regressão que a revisão apontou.`
      + relato(a),
  );
  assert.equal(
    extra!.eventoDisparou, false,
    'receber `null` por propriedade não pode disparar `urbi:input-numero-change` sozinho' + relato(a),
  );
});
