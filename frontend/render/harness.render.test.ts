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
import { verificarRender, inventarioDeReproducao } from '../../scripts/render-check.mjs';
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

test('o harness REJEITA um caso cujo nó exigido existe mas está OCULTO', { skip: pular ?? false }, async () => {
  // O buraco entre os dois controles acima, e o que uma regressão de estado
  // realmente produz: o componente renderiza, mas o que se queria medir está
  // sob `display: none` com um spinner na frente. Antes do conserto isto dava
  // "600px limpo · 900px limpo · 1280px limpo" com 213 nós montados.
  await assert.rejects(
    () => verificarRender({ caso: 'controle-oculto', larguras: [1280] }),
    /OCULTO/,
    'nó exigido porém invisível não prova montagem — as lentes pulam subárvore oculta',
  );
});

test('o harness ACUSA prop não reproduzida que o caso não declarou', { skip: pular ?? false }, async () => {
  // O outro sentido do confronto: sem este controle, um `naoDeclaradas` sempre
  // vazio deixaria os quatro casos reais verdes e a verificação seria enfeite.
  const a = await verificarRender({ caso: 'controle-prop-nao-declarada', larguras: [1280] });
  assert.deepEqual(a.montagem?.naoDeclaradas, ['urbi-botao.variante']);
});

test('o inventário de reprodução é derivado do espelho, não escrito à mão', () => {
  // Não asseveramos QUAIS props são reproduzidas — isso mudaria a cada
  // ressincronização e viraria falso positivo. Asseveramos que o inventário
  // existe, cobre o espelho inteiro e classifica cada entrada; se ele quebrar, o
  // confronto de `aceitaNaoReproduzido` para de existir em silêncio.
  const inv = inventarioDeReproducao();
  assert.ok(inv.length > 50, `inventário curto demais (${inv.length}) — o espelho tem 181 pares`);
  for (const x of inv) {
    assert.match(x.tag, /^urbi-/, 'entrada precisa apontar um primitivo do espelho');
    assert.equal(typeof x.prop, 'string');
    assert.equal(typeof x.atributo, 'string');
    assert.equal(typeof x.reproduzida, 'boolean');
  }
  // `urbi-textarea.rows` é o caso que reprovou o inventário por regex de nome na
  // rodada 2: ele restringe a altura do controle real e nenhum sniffer o pegava.
  // Agora ele não precisa ser reconhecido — basta não ser dado como reproduzido.
  const rows = inv.find((x) => x.tag === 'urbi-textarea' && x.prop === 'rows');
  assert.ok(rows, 'urbi-textarea.rows sumiu do espelho?');
  assert.equal(rows?.reproduzida, false, 'o stub não tem textarea — rows não pode contar como reproduzida');
});
