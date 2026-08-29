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
function naTabela(a: Achados, lente: 'transbordoDeCaixa' | 'transbordoDeTexto'): string[] {
  const dentro: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m[lente] as { onde: string }[]) {
      if (t.onde.includes('table.fx')) dentro.push(t.onde);
    }
  }
  return dentro;
}

/**
 * Sobreposição escopada à tabela.
 *
 * ⚠️ FUNÇÃO SEPARADA, e não um caso a mais da acima, porque **o achado tem
 * outra forma**: `transbordoDeCaixa`/`transbordoDeTexto` trazem `{ onde }`,
 * mas `sobreposicao` traz `{ a, b, px, py }` — dois caminhos, um por caixa
 * (`scripts/render-check.mjs`, onde `sobreposicao.push` monta o achado).
 *
 * Ler `.onde` num achado de sobreposição devolve `undefined`, e o
 * `.includes(...)` seguinte **lança** `Cannot read properties of undefined`.
 * O efeito é o pior possível: qualquer sobreposição na página — inclusive
 * fora da tabela — derrubaria este teste com um TypeError, e uma sobreposição
 * dentro da tabela nunca seria classificada como tal. Achado P2 do revisor.
 *
 * A sobreposição conta quando QUALQUER uma das duas caixas está na tabela: se
 * algo de fora invade a tabela, o defeito é visível nela.
 */
function sobreposicaoNaTabela(a: Achados): string[] {
  const dentro: string[] = [];
  for (const m of Object.values(a.larguras)) {
    for (const t of m.sobreposicao as { a: string; b: string }[]) {
      if (t.a.includes('table.fx') || t.b.includes('table.fx')) dentro.push(`${t.a} × ${t.b}`);
    }
  }
  return dentro;
}

test('Cenários: a tabela fecha em Livre → funding → Fluxo de Caixa (#596)', { skip: pular ?? false }, async () => {
  // O `exigir` do caso carrega a asserção principal — ele afirma ORDEM, não só
  // presença, e reprova ANTES de medir pixel se a tabela não montou. É ele que
  // fica vermelho se alguém apagar a chamada `tabelaFluxo(…)` de
  // `tela-cenarios.ts` (critério 3).
  const a = await verificarRender({ caso: 'tabela-fluxo-cenarios' });

  assert.deepEqual(naTabela(a, 'transbordoDeCaixa'), [], 'a tabela estourou a caixa' + relato(a));
  assert.deepEqual(sobreposicaoNaTabela(a), [], 'duas caixas se sobrepuseram na tabela' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // ⚠️ TRANSBORDO DE TEXTO E CORTE NÃO SÃO ASSEVERADOS — mesma ressalva dos dois
  // casos irmãos (`tabela-fluxo.render.test.ts`, `tabela-fluxo-funding.render.test.ts`):
  // eles dependem da MÉTRICA DE GLIFO, e a fonte deste ambiente não é a da
  // instância. Asseverá-los plantaria um teste que muda de veredito conforme a
  // máquina. A primeira versão deste arquivo os asseverava — achado P2 do
  // revisor, e ele tem razão: a inconsistência com os irmãos era minha.
  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }

  // A contagem GLOBAL de transbordo de CAIXA fica registrada, não asserida: é o
  // número que o corpo do PR cita para o defeito pré-existente dos sliders. Se
  // ele zerar (alguém consertou), nada aqui quebra — o teste não passa a exigir
  // o defeito.
  const caixaGlobal = contar(a, 'transbordoDeCaixa');
  if (caixaGlobal > 0) {
    console.log(`  nota: ${caixaGlobal} transbordo(s) de CAIXA na página, nenhum na tabela — ver o defeito pré-existente dos sliders no corpo do PR.`);
  }
});
