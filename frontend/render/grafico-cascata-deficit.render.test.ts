// Render da cascata do resultado num projeto DEFICITÁRIO (#720): o Resultado
// negativo é desenhado ABAIXO da linha do zero, não como coluna zerada. Ver
// `casos/grafico-cascata-deficit.ts` para o cenário e a sonda de geometria.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { naoDeclaradas, declaracoesOciosas, motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('#720: cascata deficitária desenha o Resultado abaixo da linha do zero', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'grafico-cascata-deficit', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));
  assert.deepEqual(naoDeclaradas(a), [], 'prop que o stub não reproduz, em uso e não declarada' + relato(a));
  assert.deepEqual(declaracoesOciosas(a), [], 'declaração ociosa em aceitaNaoReproduzido' + relato(a));

  const g = a.extra?.['900'] as {
    resultadoTopo: number; resultadoBase: number; zeroTopo: number; trilhoBase: number;
    vgvBase: number; vgvTopo: number; trilhoTopo: number; rodape: string;
  } | undefined;
  assert.ok(g, 'o caso não devolveu a medida extra — medir() não rodou' + relato(a));
  const TOL = 2; // px — a linha tem 1px e o filete mínimo 2px
  // A barra do Resultado começa NA linha do zero e desce até o piso do trilho.
  assert.ok(Math.abs(g!.resultadoTopo - g!.zeroTopo) <= TOL, `o topo do Resultado (${g!.resultadoTopo}) não está na linha do zero (${g!.zeroTopo})` + relato(a));
  assert.ok(Math.abs(g!.resultadoBase - g!.trilhoBase) <= TOL, `a base do Resultado (${g!.resultadoBase}) não está no piso do trilho (${g!.trilhoBase})` + relato(a));
  assert.ok(g!.resultadoBase - g!.resultadoTopo > 10, 'o Resultado deficitário voltou a ser um filete — a geometria não chegou ao desenho' + relato(a));
  // O VGV de tabela começa na linha do zero e sobe até o topo do trilho.
  assert.ok(Math.abs(g!.vgvBase - g!.zeroTopo) <= TOL, `a base do VGV (${g!.vgvBase}) não está na linha do zero (${g!.zeroTopo})` + relato(a));
  assert.ok(Math.abs(g!.vgvTopo - g!.trilhoTopo) <= TOL, `o topo do VGV (${g!.vgvTopo}) não está no topo do trilho (${g!.trilhoTopo})` + relato(a));
  // A linha do zero fica DENTRO do trilho, nem no topo nem na base.
  assert.ok(g!.zeroTopo > g!.trilhoTopo + TOL && g!.zeroTopo < g!.trilhoBase - TOL, 'a linha do zero está colada numa borda do trilho' + relato(a));
  assert.match(g!.rodape, /menor saldo/, 'o rodapé não declara a escala com piso' + relato(a));
});
