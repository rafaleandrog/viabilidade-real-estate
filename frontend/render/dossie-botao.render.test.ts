// Render do botão "Dossiê do projeto" nas duas telas de resultado — Proforma do Preliminar e Fluxo de
// Caixa do Avançado.
//
// O `exigir` de cada caso é a asserção principal e roda ANTES destas lentes: sem o botão no template o
// seletor não casa nada e o harness rejeita a montagem. Ver o cabeçalho de
// `casos/dossie-botao-proforma.ts` para o porquê de isto não caber num teste de função pura.
// As lentes abaixo cobrem o risco próprio de uma terceira ação numa barra que já quebra linha: nenhum
// transbordo, nenhum documento rolando na horizontal, nenhuma cor sem valor.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

for (const [caso, rotulo] of [
  ['dossie-botao-proforma', 'Proforma do Preliminar'],
  ['dossie-botao-fluxo', 'Fluxo de Caixa do Avançado'],
] as const) {
  test(`Dossiê do projeto (${rotulo}): o botão chega à tela e a barra de ações cabe em 1280/900/600px`, { skip: pular ?? false }, async () => {
    const a = await verificarRender({ caso });

    assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
    assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
    assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
    assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
    assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
    assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
    assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  });
}
