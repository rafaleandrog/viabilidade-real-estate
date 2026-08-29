// Render da tabela de fluxo da aba CENÁRIOS (#596) — a prova de que a segunda
// tela realmente monta a reestrutura da #592, e não só a primeira.
// Ver o topo de `casos/tabela-fluxo-cenarios.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender, type Achados } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

/**
 * Achados de uma lente **restritos à tabela** (`table.fx`), pelo caminho CSS
 * que o harness reporta em `onde`.
 *
 * ⚠️ ISTO É UM ESCOPO DECLARADO, NÃO UMA ISENÇÃO — e a diferença é o que
 * separa "medi outra coisa" de "não medi".
 *
 * A aba Cenários tem, ACIMA da tabela, um bloco de sliders que já transborda
 * 4px em 600px (`div.topo > urbi-card > div.slider`, 572 > 568). Ele é
 * PRÉ-EXISTENTE — nada nesta issue o toca, e nenhum caso de render o media até
 * agora, que é por isso que ninguém sabia. Asserir sobre a página inteira aqui
 * faria este caso nascer vermelho por um defeito de outra issue, e a saída
 * fácil (afrouxar a asserção) apagaria também o que ele existe para medir.
 *
 * O defeito está reportado no corpo do PR, com o número medido, em vez de
 * silenciado. Se ele for consertado, este filtro continua correto: ele não
 * perdoa nada dentro da tabela, que é o objeto desta issue.
 */
function naTabela(a: Achados, lente: 'transbordoDeCaixa' | 'transbordoDeTexto' | 'sobreposicao'): string[] {
  const fora: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m[lente] as { onde: string }[]) {
      if (t.onde.includes('table.fx')) fora.push(t.onde);
    }
  }
  return fora;
}

test('Cenários: a tabela fecha em Livre → funding → Fluxo de Caixa (#596)', { skip: pular ?? false }, async () => {
  // O `exigir` do caso carrega a asserção principal — ele afirma ORDEM, não só
  // presença, e reprova ANTES de medir pixel se a tabela não montou. É ele que
  // fica vermelho se alguém apagar a chamada `tabelaFluxo(…)` de
  // `tela-cenarios.ts` (critério 3).
  const a = await verificarRender({ caso: 'tabela-fluxo-cenarios' });

  assert.deepEqual(naTabela(a, 'transbordoDeCaixa'), [], 'a tabela estourou a caixa' + relato(a));
  assert.deepEqual(naTabela(a, 'transbordoDeTexto'), [], 'texto saltou do quadro na tabela' + relato(a));
  assert.deepEqual(naTabela(a, 'sobreposicao'), [], 'duas caixas se sobrepuseram na tabela' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // ⚠️ A contagem GLOBAL fica registrada, não asserida: é o número que o corpo
  // do PR cita para o defeito pré-existente dos sliders. Se ele zerar (alguém
  // consertou), nada aqui quebra — o teste não passa a exigir o defeito.
  void contar(a, 'transbordoDeCaixa');
});
