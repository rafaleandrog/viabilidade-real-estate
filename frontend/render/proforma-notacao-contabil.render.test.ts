// #567: prova de FIAÇÃO — a Proforma de um estudo deficitário mostra o sinal
// real de "Receita operacional"/"Resultado" negativos, e não em módulo. Ver o
// cabeçalho de `casos/proforma-deficitaria.ts` para o porquê deste caso medir
// fiação e não cálculo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Proforma deficitária: Receita operacional e Resultado negativos chegam à tela com a marca de negativo', { skip: pular ?? false }, async () => {
  // O `exigir` do caso (tr.consolidado.nat-receita td.neg / tr.resultado
  // td.neg) já reprova a montagem se a tela voltar a mostrar as duas linhas
  // em módulo — é ele a prova de fiação, e `verificarRender` lança antes de
  // medir qualquer pixel.
  const a = await verificarRender({ caso: 'proforma-deficitaria' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a marca de negativo não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('#754: a coluna R$ da Proforma publica INTEIROS na tela — sonda de DOM contra realocação', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-deficitaria', larguras: [1280] });
  const m = a.extra?.['1280'] as { celulasRs: number; comCentavos: string[] } | undefined;
  assert.ok(m, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));
  assert.ok(m!.celulasRs >= 5, `poucas células R$ medidas (${m!.celulasRs}) — a tabela não montou inteira` + relato(a));
  assert.deepEqual(m!.comCentavos, [], 'célula da coluna R$ da Proforma publicou centavos — a exceção de inteiros (#754) não chegou à tela' + relato(a));
});

test('Proforma deficitária: a cor de negativo (vermelho, não o verde fixo de receita) resolve em todas as variantes de tema', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'proforma-deficitaria', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
