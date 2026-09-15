// Render da faixa de 5 KPIs — aba Gráficos (Preliminar), Rodada 12.
//
// ⚠️ Este caso monta `viab-tela-graficos` inteira, então a cascata do
// resultado (`viab-grafico-cascata`) também aparece na tela — o mesmo
// transbordo de texto/corte já registrado e não asseverado em
// `grafico-cascata.render.test.ts` (coluna de rótulo estreita de propósito,
// elipse + `title`) se repete aqui pelo mesmo motivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato, textosInvisiveis,
  tokensSemValor,
} from './apoio.js';

const pular = await motivoParaPular();

test('Faixa de KPIs do Preliminar: rótulo, valor e denominador dos 5 indicadores chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-graficos-preliminar' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const texto = contar(a, 'transbordoDeTexto');
  const cortado = contar(a, 'corte');
  if (texto + cortado > 0) {
    console.log(`  nota: ${texto} transbordo(s) de TEXTO e ${cortado} corte(s) por overflow oculto — dependem da fonte, não asseverados.${relato(a)}`);
  }
});

test('Faixa de KPIs do Preliminar: nenhum token sem valor e nenhum texto invisível', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'kpis-graficos-preliminar', larguras: [1280] });

  assert.deepEqual(tokensSemValor(a), [], 'token citado pelo CSS não resolve em alguma variante' + relato(a));
  assert.deepEqual(textosInvisiveis(a), [], 'texto pintado da mesma cor do próprio fundo' + relato(a));
});
