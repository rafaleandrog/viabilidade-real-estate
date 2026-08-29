// Render do medidor de eficiência de aproveitamento num LOTEAMENTO — #613,
// critério de aceite 3.
//
// Este arquivo é o único lugar do repositório que prova que a eficiência de
// aproveitamento chega ao DOM como medidor. Ver o topo de
// `casos/medidor-eficiencia-loteamento.ts` para por que a função pura sozinha
// não basta (o campo é opcional no tipo, então omiti-lo na chamada não é nem
// erro de compilação nem teste vermelho).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Loteamento: os 5 medidores (4 comuns + eficiência de aproveitamento) chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'medidor-eficiencia-loteamento' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Loteamento: nenhum token sem valor e nenhum texto invisível na aba com medidores', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'medidor-eficiencia-loteamento', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
