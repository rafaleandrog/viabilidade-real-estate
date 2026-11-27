// Render da troca de âncora no rascunho do Funding. Ver o topo de
// `casos/funding-ancora-rascunho.ts`: é a fiação entre `_recalcular` e o mês
// derivado do Cronograma, que o teste de função pura não alcança.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender } from '../../scripts/render-check.mjs';
import { motivoParaPular, relato } from './apoio.js';

const pular = await motivoParaPular();

test('Funding: trocar a âncora no rascunho recalcula a prévia na hora, e o salvo coincide', { skip: pular ?? false }, async () => {
  const a = await verificarRender({ caso: 'funding-ancora-rascunho', larguras: [900] });

  assert.deepEqual(a.erroConsole, [], 'a página lançou erro durante a montagem' + relato(a));
  assert.equal(a.montagem?.assentou, true, 'o Lit não assentou antes da medição' + relato(a));

  const x = a.extra?.['900'] as any;
  assert.ok(x, 'o caso não devolveu a medida extra — `medir()` não rodou' + relato(a));

  // Sem rascunho, a tela mostra o mês GRAVADO, mesmo defasado do Cronograma.
  assert.equal(x.antes.mes, x.mesGravadoEsperado, 'sem rascunho, o mês exibido tinha de ser o gravado');
  assert.ok(x.painelEsperado.length > 0, 'o oráculo não desenhou o painel do investidor');
  assert.notEqual(x.antes.painel, x.painelEsperado, 'o caso não discrimina: o painel já era o do mês novo');
  // O aporte no mês novo estica o horizonte: sem isso o caso não pega a prévia
  // que reusa o fluxo-base das operações gravadas e trunca as parcelas.
  assert.ok(x.horizonteNovo > x.horizonteGravado, `o caso não discrimina o horizonte (${x.horizonteGravado} → ${x.horizonteNovo})`);

  // Com o rascunho, mês derivado e indicador mudam sem salvar.
  assert.equal(x.rascunho.mes, x.mesNovoEsperado, 'o "Início derivado" não mostrou o mês da âncora nova');
  assert.equal(
    x.rascunho.painel, x.painelEsperado,
    'os indicadores da prévia não recalcularam com o mês da âncora nova — `_recalcular` não aplicou o mês derivado, ou não refez o fluxo-base (horizonte) com as operações em rascunho',
  );

  // Depois de salvar e recarregar, o mês exibido é o gravado, e é o da prévia.
  assert.deepEqual(x.salvo.patch, { cronograma_evento: 'lancamento' }, 'o PATCH tinha de mandar só a âncora');
  assert.equal(x.salvo.temDraft, false, 'o rascunho não foi limpo depois de salvar');
  assert.equal(x.salvo.mes, x.rascunho.mes, 'o mês gravado divergiu do que a prévia mostrava');
});
