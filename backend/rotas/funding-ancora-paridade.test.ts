import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cronogramaPadrao, ancorarLinhaCusto, EVENTOS_CRONOGRAMA } from './avancado.js';
import { mesDaAncora } from '../../frontend/fluxo-shared.js';

// Paridade entre o mês que a prévia do Funding deriva no navegador
// (`mesDaAncora`) e o que o servidor grava (`ancorarLinhaCusto`, chamado por
// `resolverInicio` em `funding.ts`). Se os dois divergirem, a prévia mostra um
// mês e o Salvar grava outro.

const COM_PRE = cronogramaPadrao();
// Estudo sem pré-lançamento: `lerCronograma` remove a linha `pre_lancamento`.
const SEM_PRE = COM_PRE.filter((l) => l.evento !== 'pre_lancamento');
// Cronograma com meses fora do padrão, para a paridade não passar por acaso.
const DESLOCADO = COM_PRE.map((l, i) => ({ ...l, inicio_mes: l.inicio_mes + 3 + i }));

const EVENTOS = [...EVENTOS_CRONOGRAMA, 'customizado', 'evento_inexistente'];

for (const [nome, crono] of [['com pré-lançamento', COM_PRE], ['sem pré-lançamento', SEM_PRE], ['deslocado', DESLOCADO]] as const) {
  test(`paridade navegador × servidor, cronograma ${nome}`, () => {
    for (const evento of EVENTOS) {
      const servidor = ancorarLinhaCusto(evento, crono as any)?.inicio_mes ?? null;
      assert.equal(mesDaAncora(evento, crono as any), servidor, `evento ${evento}`);
    }
  });
}

test('a matriz exercita os cinco eventos do Cronograma', () => {
  assert.deepEqual(
    [...EVENTOS_CRONOGRAMA].sort(),
    ['lancamento', 'obra', 'planejamento', 'pos_obra', 'pre_lancamento'],
  );
  assert.equal(ancorarLinhaCusto('pre_lancamento', SEM_PRE as any), null);
  assert.equal(mesDaAncora('pre_lancamento', SEM_PRE as any), null);
});
