// Render do achado do revisor no PR 669 (#664): o que `viab-num` FAZ ao
// receber `null` onde antes recebia número. Ver o topo de
// `casos/premissas-valor-unidade-null.ts` para o cenário — desenho invertido
// depois de cinco rodadas de revisão — e o porquê de medir aqui, e não em
// `frontend/premissas-valor-unidade.test.ts` (que para em `_valorUnidade`,
// sem atravessar a fiação de `viab-num`).
//
// Três asserções:
//   1. ANTES da transição, o campo mostra um número de verdade — controle:
//      sem ele, um caso que nunca monta nada com número passaria mesmo que
//      a transição não fosse exercitada.
//   2. DEPOIS da transição (ligação zerada por mudança de ESTADO real, não
//      por atribuição direta na prop), o campo fica VAZIO — não `"NaN"`,
//      não a string `"null"`.
//   3. NENHUM evento `urbi:input-numero-change` disparado só por a prop ter
//      mudado como efeito do re-render — Lit não dispara evento em `set` de
//      propriedade, mas é exatamente essa premissa que este teste prova, em
//      vez de presumir, e agora sobre uma transição de valor REAL (número →
//      `null`), não uma reatribuição do mesmo `null` que o `hasChanged` do
//      Lit suprimiria em silêncio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#664: viab-num recebe null (canônico presente, ligação zerada) e fica VAZIO, sem evento espúrio', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'premissas-valor-unidade-null', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const extra = a.extra?.['900'] as
    { valorAntes: string; valorInput: string; eventoDisparou: boolean } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.notEqual(
    extra!.valorAntes, '',
    'controle: ANTES da transição a ligação não é zero — o campo tem que mostrar um número de '
      + 'verdade, senão a transição desta issue não está sendo exercitada' + relato(a),
  );

  assert.equal(
    extra!.valorInput, '',
    `o <input> do viab-num tinha que ficar VAZIO depois da transição para ligação zerada, `
      + `e mostrou "${extra!.valorInput}" — NaN/"null" seria a regressão que a revisão apontou.`
      + relato(a),
  );
  assert.equal(
    extra!.eventoDisparou, false,
    'a transição número→null, disparada por mudança de estado real, não pode emitir '
      + '`urbi:input-numero-change` sozinha' + relato(a),
  );
});
