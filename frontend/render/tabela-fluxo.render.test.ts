// Render da TABELA do Fluxo de Caixa.
//
// A tabela mensal é o conteúdo mais largo do app. O que se verifica aqui é que
// a largura fica CONTIDA no scroller que o app declarou (`overflow-x: auto` no
// wrapper) em vez de vazar para o documento — e que nenhuma caixa pinta sobre
// outra.
//
// ⚠️ O transbordo de TEXTO deste caso é REPORTADO E NÃO ASSEVERADO, de
// propósito. Ele existe: nas três larguras, o `div.valor` dos KPIs de fluxo
// fica alguns pixels mais largo que o card (R$ 54.560.000,00 em 164px, no
// 1280). Mas o veredito depende da MÉTRICA DE GLIFO, e a fonte deste ambiente
// (Liberation Sans) não é a da instância (Montserrat) — asseverar isso seria
// plantar de propósito a quarta ocorrência, nesta rodada, de teste que muda de
// veredito conforme a máquina.
//
// O achado não desaparece por não ser asseverado: ele sai no relatório do
// harness e está registrado no corpo do PR desta onda, para triagem na onda de
// UI. Consertá-lo aqui seria segundo assunto no PR (regra R3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Tabela do Fluxo: a largura fica no scroller declarado, sem caixa sobre caixa', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'tabela-fluxo' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'a tabela empurrou o DOCUMENTO na horizontal' + relato(a));
  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  // Não são asserções — são o registro do que as lentes dependentes de fonte
  // viram neste ambiente. Sem isto o achado sumiria da saída quando o teste
  // passa, que é a definição de medir e jogar fora.
  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});
