// Render do card do GRUPO com a badge "Plano não migrado" (#458).
//
// A linha de botões do cabeçalho já é a mais apertada do card — nome editável
// + até três botões + o ícone de remover — e é onde uma badge nova estoura
// primeiro. `urbi-kpi` já produziu essa classe de defeito cinco vezes (#488,
// PR 508); nenhum teste de unidade pega, só o render em Chromium.
//
// ⚠️ Só 1280px. O card do Grupo tem um transbordo de CAIXA PRÉ-EXISTENTE em
// 900/600px — confirmado por mutação: o mesmo transbordo ocorre com a badge
// COMPLETAMENTE REMOVIDA do componente (`urbi-card` de 974px dentro de um
// viewport de 568/868px, causado pela grade de botões + `urbi-input.nome`
// fixo em 200px, não pela badge). É por isso que `modal-pagamento.ts` monta
// com `fases: []` — "o card do Grupo por trás dele tem grade própria e
// larga, que abafaria o achado" (comentário daquele caso). Consertar o
// responsivo do card inteiro é assunto de OUTRA issue; este caso mede só se
// a badge NOVA piora ou não o que já existe em 1280px, onde o card cabe.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Grupo: a badge "Plano não migrado" cabe na linha do cabeçalho em 1280px', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grupo-badge-legado', larguras: [1280] });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o card empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
});

test('Grupo: nenhum token sem valor e nenhum texto invisível na badge nova', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grupo-badge-legado', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
