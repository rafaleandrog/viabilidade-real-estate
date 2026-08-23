// Testes DO HARNESS, não de tela — os dois sentidos da verificação.
//
// Todo o resto de `frontend/render/` pergunta "a tela está certa?". Este arquivo
// pergunta "o harness sabe dizer que não?". A distinção não é acadêmica: até a
// revisão do PR 506 o harness devolvia "limpo" para um caso que não montava
// nada, e nada nesta suíte ficaria vermelho por causa disso. Verificação só vale
// testada nos dois sentidos — é o mesmo princípio de
// `scripts/testar-guards-ui.sh`, escrito depois de um guard virar teatro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarRender, lacunasDeDimensao } from '../../scripts/render-check.mjs';
import { motivoParaPular } from './apoio.js';

const pular = await motivoParaPular();

test('o harness REJEITA um caso que não monta o que declara', { skip: pular ?? false }, async () => {
  await assert.rejects(
    () => verificarRender({ caso: 'controle-vazio', larguras: [1280] }),
    /não montou o que declara/,
    'um caso que não renderiza nada precisa reprovar, não reportar "limpo"',
  );
});

test('o harness REJEITA um caso que não declara `exigir`', { skip: pular ?? false }, async () => {
  await assert.rejects(
    () => verificarRender({ caso: 'controle-sem-exigir', larguras: [1280] }),
    /não declara/,
    'sem prova de montagem obrigatória, um caso novo nasce medindo nada',
  );
});

test('o inventário de lacunas de dimensão é derivado do espelho, não escrito à mão', () => {
  // Não asseveramos QUAIS são — isso mudaria a cada ressincronização do espelho
  // e viraria falso positivo. Asseveramos a FORMA: se o inventário quebrar, o
  // aviso de "prop de tamanho que o stub não honra" para de existir em silêncio.
  const l = lacunasDeDimensao();
  assert.ok(Array.isArray(l), 'lacunasDeDimensao() precisa devolver lista');
  for (const x of l) {
    assert.equal(typeof x.tag, 'string');
    assert.equal(typeof x.prop, 'string');
    assert.equal(typeof x.atributo, 'string');
    assert.match(x.tag, /^urbi-/, 'lacuna precisa apontar um primitivo do espelho');
  }
});
