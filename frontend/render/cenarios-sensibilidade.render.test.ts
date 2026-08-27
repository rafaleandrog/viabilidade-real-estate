// #568: prova de FIAÇÃO da sub-aba Cenários — o fator de stress sai do seletor
// de variável, atravessa `calcularProforma` e chega ao catálogo de Produtos, e
// a tela mostra três cenários DIFERENTES. Ver o cabeçalho de
// `casos/cenarios-sensibilidade.ts` para o porquê deste caso medir fiação e não
// cálculo — e por que a marca de negativo do Bear é o que prova a ligação.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cenários: os três cenários chegam à tela, e só o Bear fecha com Resultado negativo', { skip: pular ?? false }, async () => {
  // O `exigir` do caso (td.num.cen-bear.neg junto de td.num.cen-base.pos) já
  // reprova a montagem se o fator parar de alcançar o catálogo — é ele a prova
  // de fiação, e `verificarRender` lança antes de medir qualquer pixel.
  const a = await verificarRender({ caso: 'cenarios-sensibilidade' });

  assert.deepEqual(a.montagem?.faltando ?? [], [], 'a variação entre cenários não chegou ao DOM' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Cenários: as cores dos cenários e a marca de negativo resolvem em todas as variantes de tema', { skip: pular ?? false }, async () => {
  // As classes `cen-bear`/`cen-base`/`cen-bull` e `neg` substituíram o `style`
  // inline: só a partir do CSS o espelho de tokens consegue conferir que
  // `--cor-erro`/`--cor-sucesso`/`--cor-info` resolvem em todas as variantes.
  const a = await verificarRender({ caso: 'cenarios-sensibilidade', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
