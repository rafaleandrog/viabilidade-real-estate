// Render do Painel na aba Estudos (#683) — abrir a aba default não pode
// disparar os requests das outras 4 abas. Ver o topo de
// `casos/painel-abas-lazy.ts` para o porquê de medir aqui: a fiação entre
// "qual aba está ativa" e "qual componente de fato monta" não é algo que um
// teste de leitura de fonte alcança — os 5 slots eram montados
// incondicionalmente antes desta issue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#683: abrir o Painel na aba Estudos não busca curvas, benchmarks nem regiões de mercado', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'painel-abas-lazy', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const extra = a.extra?.['1280'] as { chamadas: string[] } | undefined;
  assert.ok(extra, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));

  const chamadas = extra!.chamadas;
  assert.ok(
    chamadas.some((r) => r.startsWith('/estudos')),
    'a própria aba Estudos tem que buscar os estudos — sem isso a fixture não prova nada' + relato(a),
  );

  const rotasQueNaoDeviam = chamadas.filter((r) =>
    r.includes('/avancado/curvas') || r.includes('/benchmarks') || r.includes('/mercado/regioes')
    || r.startsWith('/glebas') || r.startsWith('/lotes'));
  assert.deepEqual(
    rotasQueNaoDeviam, [],
    'abrir a aba Estudos não pode buscar dados de Curvas, Benchmarks, Regiões monitoradas ou '
      + 'Terrenos — isso significa que o slot da outra aba montou incondicionalmente, o próprio '
      + `defeito que a #683 corrigiu. Chamadas vistas: ${JSON.stringify(chamadas)}` + relato(a),
  );
});
