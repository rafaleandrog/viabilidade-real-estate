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

test('o harness REJEITA um nó RECORTADO por ancestral recolhido', { skip: pular ?? false }, async () => {
  // A décima terceira forma, e ela fechava o vão que as outras três deixavam:
  // `height: 0; overflow: hidden` num ancestral. `checkVisibility` diz true, o
  // retângulo do descendente segue positivo, e como o ancestral tem retângulo
  // zero a lente de corte também o pulava — prova de montagem verde e todas as
  // lentes limpas com zero pixel na tela. Achado do Codex, rodada 5.
  //
  // O caso pede 3 `urbi-kpi` e monta 3: âncora, um dentro do painel recolhido e
  // um dentro de um painel ROLÁVEL. Só o recortado deixa de contar — se o
  // rolável também deixasse, a rejeição viria pelo motivo errado, e é por isso
  // que os dois moram no mesmo caso.
  await assert.rejects(
    () => verificarRender({ caso: 'controle-recorte-ancestral', larguras: [1280] }),
    /OCULTO/,
    'nó dentro de painel recolhido não aparece — não pode contar como montado',
  );
});

test('o harness REJEITA um caso oculto por `opacity: 0` num ANCESTRAL', { skip: pular ?? false }, async () => {
  // O irmão do anterior, e separado de propósito: `display: none` zera o
  // retângulo do descendente, `opacity: 0` NÃO se propaga para o computado dele
  // — os filhos seguem com `opacity: 1` e caixa positiva. Uma checagem que olhe
  // só o próprio nó dá tudo por visível, que foi o achado da rodada 3.
  // A tabela com as demais formas de ocultação está em scripts/render-check.mjs.
  await assert.rejects(
    () => verificarRender({ caso: 'controle-opacidade-zero', larguras: [1280] }),
    /OCULTO/,
    'opacity:0 em ancestral esconde a tela e as lentes de layout pulam a subárvore',
  );
});

test('o harness REJEITA um caso posicionado FORA DA ÁREA ROLÁVEL', { skip: pular ?? false }, async () => {
  // A 12ª forma de ocultação, e a que precisou de checagem própria: nem
  // `checkVisibility` (diz true) nem o retângulo (200x40) a pegam. O que a
  // denuncia é `right = -9799` — coordenada negativa não amplia o scroll, então
  // não existe rolagem que chegue lá. Distingue-se de conteúdo abaixo da dobra,
  // que tem `bottom` positivo e é medido de propósito.
  await assert.rejects(
    () => verificarRender({ caso: 'controle-fora-da-area', larguras: [1280] }),
    /OCULTO/,
    'left:-9999px esconde a tela sem que estilo computado ou tamanho denunciem',
  );
});

test('caixa zerada PELO STUB é cobrada; zerada por TRANSFORM não é', { skip: pular ?? false }, async () => {
  // Os dois sentidos do discriminador, num caso só — é o que prova que a
  // distinção distingue, em vez de só existir. Medido antes do conserto: os
  // DOIS eram cobrados, forçando dispensa para conteúdo que nenhuma lente mede.
  const a = await verificarRender({ caso: 'controle-transform-zero', larguras: [1280] });
  assert.deepEqual(
    a.montagem?.naoDeclaradas,
    ['urbi-select.opcoes'],
    'o select zerado pelo stub tem de ser cobrado (a prop é a causa de a caixa sumir); '
      + 'o botão sob transform:scale(0) não, porque nenhuma lente o mede',
  );
});

test('o harness REJEITA um caso que usa primitivo sem stub', { skip: pular ?? false }, async () => {
  // Sem stub o navegador trata a tag como elemento desconhecido: nenhuma das
  // declarações `:host` do primitivo real se aplica, e a geometria medida ali é
  // ficção que nenhuma lente acusa.
  await assert.rejects(
    () => verificarRender({ caso: 'controle-sem-stub', larguras: [1280] }),
    /sem stub/,
    'primitivo fora do espelho não tem box model — medir aquela região é inventar',
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
    // `atributo` é `string` OU `null` — nulo é a prop `so_propriedade`, que o
    // Lit entrega por binding e que precisa continuar no inventário.
    assert.ok(typeof x.atributo === 'string' || x.atributo === null, `atributo inválido em ${x.tag}.${x.prop}`);
    assert.equal(typeof x.reproduzida, 'boolean');
  }
  // `urbi-textarea.rows` é o caso que reprovou o inventário por regex de nome na
  // rodada 2: ele restringe a altura do controle real e nenhum sniffer o pegava.
  // Agora ele não precisa ser reconhecido — basta não ser dado como reproduzido.
  const rows = inv.find((x) => x.tag === 'urbi-textarea' && x.prop === 'rows');
  assert.ok(rows, 'urbi-textarea.rows sumiu do espelho?');
  assert.equal(rows?.reproduzida, false, 'o stub não tem textarea — rows não pode contar como reproduzida');

  // ⚠️ E as props SEM atributo precisam estar aqui. Elas eram filtradas para
  // fora antes de classificar, e o Lit as usa normalmente por binding de
  // propriedade: `urbi-select.opcoes` nunca aparecia como não reproduzida,
  // embora o stub não desenhe opção nenhuma. Achado P2 do Codex, rodada 3.
  const semAtributo = inv.filter((x) => x.atributo === null);
  assert.ok(semAtributo.length >= 10, `props so_propriedade sumiram do inventário (${semAtributo.length})`);
  const opcoes = inv.find((x) => x.tag === 'urbi-select' && x.prop === 'opcoes');
  assert.ok(opcoes, 'urbi-select.opcoes precisa estar no inventário mesmo sem atributo');
  assert.equal(opcoes?.atributo, null);
  assert.equal(opcoes?.reproduzida, false, 'o stub não desenha opções');
});
