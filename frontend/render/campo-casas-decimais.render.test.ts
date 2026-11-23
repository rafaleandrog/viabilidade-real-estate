// Render do teto de 2 casas decimais nos campos de formulário (`viab-num`).
// Ver o topo de `casos/campo-casas-decimais.ts` para o porquê de medir aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { declaracoesOciosas, motivoParaPular, naoDeclaradas, relato } from './apoio.js';
import type { MedidaCasasCampo } from './casos/campo-casas-decimais.js';

const pular = await motivoParaPular();

test('viab-num: valor derivado mostra no máximo 2 casas em repouso e no foco, e continua exato', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'campo-casas-decimais', larguras: [1280] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const m = a.extra?.['1280'] as MedidaCasasCampo | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // 500 m² / 300 m² = 166,666…% — a dízima que o foco despejava inteira.
  assert.equal(m!.repouso, '166,67', relato(a));
  assert.equal(m!.foco, '166,67', 'ao ganhar foco o campo mostrou mais de 2 casas' + relato(a));
  assert.equal(m!.depoisDoBlur, '166,67', relato(a));
  // Focar e sair sem digitar não grava: o canônico segue exato.
  assert.equal(m!.eventoSemDigitar, false, 'focar e sair sem digitar emitiu alteração' + relato(a));
  assert.equal(m!.canonicoDepois, 500, relato(a));

  // O que se digita não é cortado; só a exibição em repouso arredonda.
  assert.equal(m!.digitado, '12,345', relato(a));
  assert.equal(m!.valorEmitido, 12.345, relato(a));
  assert.equal(m!.repousoDepoisDeDigitar, '12,35', relato(a));

  // `casas-decimais` acima de 2 não fura o teto.
  assert.equal(m!.repousoCasas4, '33,33', relato(a));
  assert.equal(m!.focoCasas4, '33,33', relato(a));

  // Decimal persistido que chega como texto continua aparecendo.
  assert.equal(m!.repousoTexto, '1.500.000,46', relato(a));
  assert.equal(m!.focoTexto, '1500000,46', relato(a));
});
