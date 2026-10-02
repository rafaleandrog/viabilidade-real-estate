// Render das bases `pct_recebido` e `pct_constr` na tela Custos do Avançado.
// Ver o topo de `casos/custos-bases-pct.ts` para o porquê de medir aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaBasesPct } from './casos/custos-bases-pct.js';

const pular = await motivoParaPular();
const perto = (a: number | undefined, b: number, tol = 0.01) => a !== undefined && Math.abs(a - b) <= tol;

test('Custos do Avançado: badges % Construção / % Recebido e as bases que a tela monta batem com o motor', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'custos-bases-pct', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaBasesPct | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  assert.deepEqual(m!.badgesProjetos, ['R$', 'R$/m² priv', '% Construção'], relato(a));
  assert.deepEqual(m!.badgesMarketing, ['R$', '% VGV', '% Recebido'], relato(a));

  // Custo de construção = 96.000.000 + 6% de gestão = 101.760.000; Projetos
  // a 1,6% = R$ 1.628.160,00 (o número da EVI).
  assert.ok(perto(m!.totalConstrucao, 101_760_000), `totalConstrucao=${m!.totalConstrucao}` + relato(a));
  assert.ok(perto(m!.ligacaoConstrucao, 101_760_000), `ligação da badge=${m!.ligacaoConstrucao}` + relato(a));
  assert.match(m!.resultadoProjetos, /1\.628\.160,00/, relato(a));

  // Receita recebida = a `receitaBruta` do motor, com juros: maior que o VGV
  // de tabela, e é ela que a linha em % Recebido aplica.
  assert.ok(m!.receitaBrutaMotor !== undefined && m!.receitaBrutaMotor > 10_100_000, relato(a));
  assert.ok(perto(m!.receitaRecebida, m!.receitaBrutaMotor!), relato(a));
  assert.ok(perto(m!.ligacaoRecebido, m!.receitaBrutaMotor!), relato(a));
  assert.notEqual(m!.resultadoMarketing, 'R$ 100.000,00', 'o % Recebido caiu no VGV de tabela' + relato(a));
});
