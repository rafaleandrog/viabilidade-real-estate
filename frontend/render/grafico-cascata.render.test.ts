// Render de <viab-grafico-cascata> standalone, já na forma de COLUNAS
// VERTICAIS.
//
// ⚠️ O transbordo de TEXTO/corte por overflow oculto deste caso é REPORTADO
// E NÃO ASSEVERADO, mesmo padrão de `tabela-fluxo.render.test.ts`: o rótulo
// da coluna é um bloco VERTICAL de altura fixa (132px), estreito de propósito
// para 14 colunas caberem, e rótulos longos em português ("(-) Permuta
// financeira não residencial") truncam com elipse + `title` (tooltip) — o
// veredito de quantos pixels truncam depende da métrica de glifo da fonte da
// máquina, não da da instância (Montserrat).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

test('Cascata do resultado: as colunas, trilhos, barras e valores chegam à tela', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-cascata' });

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
