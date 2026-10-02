// Render do modal ABSORÇÃO DE VENDAS: janela Pós-chaves do Grupo e o atalho
// "À vista, mês único". É a prova de FIAÇÃO entre as funções puras e a tela —
// ver o topo de `casos/modal-absorcao-janela.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import {
  contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato,
} from './apoio.js';

const pular = await motivoParaPular();

type Leitura = { posChaves: string; janela: number | null; desabilitados: number; derivado: string };

test('Modal de Absorção: a janela do Grupo chega ao rótulo, e "mês único" leva a janela a 1 e o Pós-chaves a 100%', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'modal-absorcao-janela' });

  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa filha ultrapassou o pai' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'caixas pintadas se sobrepuseram' + relato(a));
  assert.equal(contar(a, 'corte'), 0, 'conteúdo cortado por overflow oculto' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o modal empurrou o documento na horizontal' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const g = a.extra?.['900'] as { antes: Leitura; depois: Leitura } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  // Antes: janela de 3 meses lida do persistido; a faixa exibida tem 3 meses.
  assert.equal(g!.antes.janela, 3, 'o campo da janela não mostra o valor persistido' + relato(a));
  assert.match(g!.antes.posChaves, /\(3m\)/, 'a faixa Pós-chaves não acompanha a janela do Grupo' + relato(a));
  assert.equal(g!.antes.desabilitados, 0, 'campo desabilitado sem mês único' + relato(a));
  assert.match(g!.antes.derivado, /^35/, 'Pós-chaves derivado errado antes do clique' + relato(a));
  // Depois de "Sim": 100% num único mês, campos travados.
  assert.equal(g!.depois.janela, 1, 'mês único não pôs a janela em 1 mês' + relato(a));
  assert.match(g!.depois.posChaves, /\(1m\)/, 'a faixa Pós-chaves não virou um único mês' + relato(a));
  assert.equal(g!.depois.desabilitados, 4, 'os três % e a janela deviam ficar desabilitados' + relato(a));
  assert.match(g!.depois.derivado, /^100/, 'o Pós-chaves derivado não foi a 100%' + relato(a));
});
