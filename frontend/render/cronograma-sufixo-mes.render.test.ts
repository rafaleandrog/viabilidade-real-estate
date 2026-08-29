// Render dos campos Início/Duração do Cronograma (#583) — "o sufixo de mês
// (jan/27, dez/27) transborda a caixa do campo".
//
// A lente que mata este defeito é `transbordoDeCaixa`: um FILHO do
// `.input-wrap` ultrapassa a borda de conteúdo do pai. É a lente determinística
// do harness — vem de box model, não de métrica de glifo (ver o comentário da
// sonda em `scripts/render-check.mjs`) —, e é exatamente a forma deste bug: o
// flex de uma linha do `viab-num` tem quatro filhos que não encolhem, a soma
// deles passa do teto do `.campo-mes viab-num`, e como o `.input-wrap` não
// declara `overflow` nem `flex-wrap` o excedente é PINTADO por fora da borda.
//
// ⚠️ `viab-num` é componente DESTE repositório, não um primitivo `urbi-*`
// stubado — aqui o harness mede o markup real do shadow DOM. O caveat de
// `docs/ui-urbiverso/LEIA.md` sobre o layout de dentro de um primitivo não se
// aplica.
//
// MEDIDO (é o que fecha o critério 4 da issue): com o teto anterior de 18ch
// este arquivo fica VERMELHO — 66 achados de `transbordoDeCaixa` por corrida
// (22 por largura, 3 larguras), de 11 a 20px para fora da borda. O piso também
// foi medido: com `max-width: 20ch` ainda há campo transbordando; com 21ch a
// corrida sai limpa, e 24ch é esse piso com folga.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender, type Achados } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
  textosInvisiveis, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

/**
 * Transbordos de TEXTO restritos aos campos de mês.
 *
 * Por que filtrar em vez de exigir zero: `transbordoDeTexto` depende da métrica
 * de glifo da máquina (o harness diz isso no próprio relatório), e esta tela
 * desenha um gantt em SVG cujos `<text>` acusam a lente em 1280px — MEDIDO
 * antes e depois do conserto, idêntico nas duas pontas, portanto alheio a esta
 * issue. Zerar a lente inteira aqui seria assumir a variação de fonte de uma
 * região que este PR não toca; restringir aos campos mantém a asserção sobre o
 * que a issue pede sem exportar o risco.
 */
function transbordoNosCamposDeMes(a: Achados): string[] {
  const fora: string[] = [];
  for (const [largura, m] of Object.entries(a.larguras)) {
    for (const t of m.transbordoDeTexto) {
      if (/campo-mes|viab-num|input-wrap/.test(t.onde)) {
        fora.push(`${largura}px: ${t.onde} (${t.scrollWidth} > ${t.clientWidth})`);
      }
    }
  }
  return fora;
}

test('Cronograma: o sufixo de mês não salta da caixa do campo em 1280/900/600px (#583)', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cronograma-sufixo-mes' });

  // A asserção do defeito. Com `max-width: 18ch` são 66 achados.
  assert.equal(
    contar(a, 'transbordoDeCaixa'), 0,
    'algum campo do Cronograma pintou conteúdo por fora da borda do .input-wrap — #583' + relato(a),
  );
  assert.deepEqual(
    transbordoNosCamposDeMes(a), [],
    'texto transbordou dentro dos campos Início/Duração — #583' + relato(a),
  );
  // #245 não regride: nada é CORTADO em silêncio para caber (o número
  // continua inteiro), e as caixas não se pintam umas sobre as outras.
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'duas caixas se sobrepuseram' + relato(a));
  // A tabela rola dentro do `.tabela-wrap` (scroller declarado); o DOCUMENTO
  // não pode rolar na horizontal, e alargar o campo é justamente o que poderia
  // quebrar isto.
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Cronograma: as cores dos campos resolvem em todas as variantes de tema do espelho', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'cronograma-sufixo-mes', larguras: [1280] });

  assert.ok(a.nVariantes >= 1, 'o espelho de tokens não descreve variante nenhuma' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
