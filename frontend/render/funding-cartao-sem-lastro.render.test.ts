// Render do cartão de uma antecipação sem lastro. Ver o topo de
// `casos/funding-cartao-sem-lastro.ts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { contar, declaracoesOciosas, larguraComOverflowDeDocumento, naoDeclaradas, motivoParaPular, relato } from './apoio.js';
import { AVISO_SEM_LASTRO } from '../funding-cartao-dados.js';

const pular = await motivoParaPular();

test('Funding: o cartão de antecipação sem lastro mostra a grade de quatro KPIs com "—" e o aviso abaixo', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-cartao-sem-lastro', larguras: [1280, 600] });

  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(contar(a, 'transbordoDeCaixa'), 0, 'alguma caixa estourou' + relato(a));
  assert.equal(contar(a, 'transbordoDeTexto'), 0, 'o aviso saltou da caixa' + relato(a));
  assert.equal(contar(a, 'sobreposicao'), 0, 'o aviso sobrepôs a grade' + relato(a));
  assert.deepEqual(larguraComOverflowDeDocumento(a), [], 'o documento rolou na horizontal' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  for (const largura of ['1280', '600']) {
    const x = (a.extra as any)?.[largura];
    assert.ok(x, `sem medida extra em ${largura}px` + relato(a));
    assert.deepEqual(x.kpis.map((k: any) => k.rotulo), ['Deságio', 'Custo efetivo', 'TIR alavancada', 'Exposição máxima'],
      `${largura}px: a grade não tem os quatro KPIs`);
    assert.equal(x.kpis[0].valor, '—', `${largura}px: deságio sem lastro`);
    assert.equal(x.kpis[1].valor, '—', `${largura}px: custo efetivo sem lastro`);
    for (const k of x.kpis) assert.doesNotMatch(k.valor, /NaN|undefined|^$/, `${largura}px: ${k.rotulo}`);
    assert.equal(x.aviso, AVISO_SEM_LASTRO, `${largura}px: o aviso de sem lastro não apareceu`);
    assert.equal(x.avisoAbaixoDaGrade, true, `${largura}px: o aviso não está abaixo da grade`);
  }
});
