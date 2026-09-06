// Render do Painel chegando DIRETO na aba Terrenos (#683, achado do Codex na
// rodada 2 do PR): `connectedCallback()` chamava `_carregar()` (Estudos)
// incondicionalmente, fora do gate dos slots. Ver o topo de
// `casos/painel-abas-lazy-terrenos.ts` para o cenário completo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#683: chegar direto na aba Terrenos não busca Estudos', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'painel-abas-lazy-terrenos', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const extra = a.extra?.['1280'] as { chamadas: string[] } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  const chamadas = extra!.chamadas;
  assert.ok(
    chamadas.some((r) => r.startsWith('/glebas') || r.startsWith('/lotes')),
    'a própria aba Terrenos tem que buscar glebas/lotes — sem isso a fixture não prova nada' + relato(a),
  );

  const rotaEstudos = chamadas.filter((r) => r.startsWith('/estudos'));
  assert.deepEqual(
    rotaEstudos, [],
    'chegar direto em /terrenos não pode buscar /estudos — connectedCallback() chamava _carregar() '
      + `incondicionalmente, fora do gate dos slots. Chamadas vistas: ${JSON.stringify(chamadas)}`
      + relato(a),
  );
});
