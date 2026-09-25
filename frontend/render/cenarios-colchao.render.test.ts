// Render do consumo do colchão (#734): o estado de alerta (Bear inviável),
// dito em palavras, e a regra da baixa alavanca ao trocar de variável.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato, contar, larguraComOverflowDeDocumento } from './apoio.js';

const pular = await motivoParaPular();

test('#734: o Bear que consome mais de 100% do colchão é declarado inviável em palavras; a baixa alavanca é dita ao trocar de variável', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cenarios-colchao' });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'caixa transbordou' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixa sobre caixa' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));

  const g = a.extra?.['900'] as {
    alerta: string; equilibrio: string; temBanner: boolean; temBaixa: boolean;
    depois: { texto: string; temBanner: boolean; temBaixa: boolean };
  } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  // Preço: folga ≈ −7,1%, Bear −10% ⇒ consumo ≈ 140% ⇒ inviável, em palavras.
  assert.equal(g!.temBanner, true, 'o alerta de cenário inviável não apareceu' + relato(a));
  assert.match(g!.alerta, /já é inviável/, 'o alerta não diz, em palavras, que o Bear é inviável' + relato(a));
  assert.match(g!.alerta, /consome 1\d\d,\d%/, 'o consumo do colchão não está publicado no alerta' + relato(a));
  assert.match(g!.equilibrio, /pode errar -7,\d% até o resultado zerar/, 'o ponto de equilíbrio do preço não bate com a margem de segurança' + relato(a));
  assert.equal(g!.temBaixa, false, 'preço não é baixa alavanca neste fixture' + relato(a));
  // Permuta financeira: amplitude zero ⇒ baixa alavanca, sem alerta.
  assert.equal(g!.depois.temBanner, false, 'a troca de variável não apagou o alerta' + relato(a));
  assert.equal(g!.depois.temBaixa, true, 'a mensagem de baixa alavanca não apareceu' + relato(a));
  assert.match(g!.depois.texto, /Variável selecionada: Permuta financeira/, 'o bloco não segue a variável selecionada' + relato(a));
});
