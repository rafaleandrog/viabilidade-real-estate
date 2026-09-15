// #589 — a lista lateral do estudo Avançado: **Custos antes de Viabilidade**,
// e nada mais mudando junto.
//
// ⚠️ ONDE ESTE ARQUIVO ANCORA, E POR QUÊ. A constante `PAGINAS` é privada do
// módulo, e testá-la seria testar a DECLARAÇÃO. O que este arquivo mede é a
// CHAMADA: roda o `render()` real de `ViabTelaAvancado` e lê o valor que o
// binding `.secoes` de `<urbi-nav>` recebe de fato. Quem trocar `PAGINAS` por
// um literal escrito à mão no template continua sendo aferido, porque a
// asserção é sobre o que o primitivo recebe — não sobre de onde veio.
//
// Isso funciona sem DOM porque `render()` só CONSTRÓI `TemplateResult`s: as
// tags `viab-*`/`urbi-*` viram texto estático e valores de binding, e nada é
// instanciado. `LitElement` se instancia em Node sem `customElements` nem
// `document` (mesma constatação de `carregamento-corrida.test.ts:15-17`); o que
// exigiria DOM é `renderRoot`/`update()`, que este arquivo nunca aciona.
//
// A camada de render em Chromium NÃO alcança este caso: o stub de
// `scripts/render-check.mjs` não reproduz `.secoes` (é binding de
// PROPRIEDADE — o Lit nem escreve atributo), então `<urbi-nav>` sobe sem item
// nenhum e a ordem da lista simplesmente não existe no DOM medido. Por isso a
// aferição é aqui.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { ViabTelaAvancado } = await import('./tela-avancado.js');

type ResultadoLit = { strings: readonly string[]; values: readonly unknown[] };

// Localiza o valor de UM binding pelo texto estático que o precede. `strings`
// e `values` de um `TemplateResult` são intercalados: o valor `i` fica entre
// `strings[i]` e `strings[i + 1]`. Procurar pelo sufixo (`.secoes=`) prende a
// asserção ao ponto do template, não a um índice posicional que qualquer edição
// vizinha deslocaria em silêncio.
function bindingPorSufixo(tr: unknown, sufixo: string): unknown {
  const { strings, values } = tr as ResultadoLit;
  assert.ok(Array.isArray(strings) && Array.isArray(values), 'render() não devolveu um TemplateResult');
  const i = strings.findIndex((s) => s.trimEnd().endsWith(sufixo));
  assert.notEqual(i, -1, `nenhum binding \`${sufixo}\` no render() de viab-tela-avancado`);
  return values[i];
}

function telaAvancado(): any {
  // Construir a classe direto é legítimo: `@customElement` já rodou na
  // importação acima e a instância não é anexada a documento nenhum.
  return new (ViabTelaAvancado as any)();
}

// ─────────────────────────────────────────────────────────────────────────
// Critério 1 — a ordem da lista lateral
// ─────────────────────────────────────────────────────────────────────────

test('#589: a lista lateral do Avançado mostra Custos ANTES de Viabilidade', () => {
  const secoes = bindingPorSufixo(telaAvancado().render(), '.secoes=') as { itens: { id: string; label: string }[] }[];
  assert.equal(secoes.length, 1, 'urbi-nav do Avançado tem uma seção só');
  const rotulos = secoes[0].itens.map((p) => p.label);

  assert.deepEqual(rotulos, [
    'Resumo',
    'Empreendimento',
    'Custos',
    'Viabilidade',
    'Funding',
    'Resultados',
    'Cenários',
    'Análise de mercado',
    'Apelo Comercial',
  ]);

  // Redundante com o `deepEqual` acima de propósito: é esta a frase do pedido,
  // e quem ler a falha vê o requisito, não só um array diferente.
  assert.ok(rotulos.indexOf('Custos') < rotulos.indexOf('Viabilidade'), 'Custos tem de vir antes de Viabilidade');
});

// ─────────────────────────────────────────────────────────────────────────
// #718 — Funding promovida de sub-aba (dentro de Viabilidade) a página de
// nível 1, logo abaixo de Viabilidade.
// ─────────────────────────────────────────────────────────────────────────

test('#718: Funding é página de nível 1, logo abaixo de Viabilidade', () => {
  const secoes = bindingPorSufixo(telaAvancado().render(), '.secoes=') as { itens: { id: string; label: string }[] }[];
  const itens = secoes[0].itens;
  assert.equal(itens.length, 9, 'a lista lateral do Avançado agora tem 9 páginas');
  const idxViabilidade = itens.findIndex((p) => p.label === 'Viabilidade');
  const idxFunding = itens.findIndex((p) => p.label === 'Funding');
  assert.notEqual(idxFunding, -1, '"Funding" precisa existir na lista lateral');
  assert.equal(idxFunding, idxViabilidade + 1, 'Funding vem IMEDIATAMENTE abaixo de Viabilidade');
  assert.equal(itens.find((p) => p.label === 'Funding')?.id, 'funding');
});

test('#718: Funding (nível 1) renderiza viab-funding direto, sem urbi-abas de 2º nível', () => {
  const el = telaAvancado();
  el.aba = 'funding';
  // A CHAMADA, como o resto do arquivo: o conteúdo da página é o valor que cai
  // em `<div class="conteudo">${...}</div>` no render() real da tela.
  const conteudo = bindingPorSufixo(el.render(), 'class="conteudo">') as ResultadoLit;
  const marcado = conteudo.strings.some((s) => s.includes('<viab-funding'));
  assert.ok(marcado, 'a página funding tem que montar <viab-funding>');
  // Nenhum `urbi-abas` de nível 2 nesta página: viab-funding tem navegação
  // própria (#586), e envolvê-la duplicaria chassi de navegação.
  assert.ok(!conteudo.strings.some((s) => s.includes('<urbi-abas')),
    'a página Funding não usa urbi-abas de nível 2 — a navegação interna é do próprio componente');
});

test('#718: a página Viabilidade perdeu a aba Funding — só Receitas e Financeiro', () => {
  const el = telaAvancado();
  el.aba = 'viabilidade';
  const conteudo = bindingPorSufixo(el.render(), 'class="conteudo">') as ResultadoLit;
  const abas = bindingPorSufixo(conteudo, '.abas=') as { id: string; label: string }[];
  assert.deepEqual(abas.map((a) => a.label), ['Receitas', 'Financeiro']);
});

// ─────────────────────────────────────────────────────────────────────────
// Critério 2 — nada mais muda: ids internos, slugs públicos e aliases
// ─────────────────────────────────────────────────────────────────────────

test('#589: o id interno da página de Custos continua `obra` (#40)', () => {
  const secoes = bindingPorSufixo(telaAvancado().render(), '.secoes=') as { itens: { id: string; label: string }[] }[];
  const ids = secoes[0].itens.map((p) => p.id);
  assert.deepEqual(ids, ['resumo', 'empreendimento', 'obra', 'viabilidade', 'funding', 'fluxo', 'cenarios', 'mercado', 'apelo']);
  assert.equal(secoes[0].itens.find((p) => p.label === 'Custos')?.id, 'obra');
  assert.equal(secoes[0].itens.find((p) => p.label === 'Resultados')?.id, 'fluxo');
});

test('#589: deep link continua abrindo a página certa — slug público e alias antigo', () => {
  const el = telaAvancado();

  // #250 — slug público de Custos, e o alias antigo que deep links e favoritos
  // guardaram antes dele.
  el.aba = 'custos';
  assert.equal(el.aba, 'obra', '/detalhe/:id/custos abre a página de Custos');
  el.aba = 'obra';
  assert.equal(el.aba, 'obra', '/detalhe/:id/obra (alias antigo) ainda abre a página de Custos');

  // #350 — o mesmo par para Resultados.
  el.aba = 'resultados';
  assert.equal(el.aba, 'fluxo', '/detalhe/:id/resultados abre Resultados');
  el.aba = 'fluxo';
  assert.equal(el.aba, 'fluxo', '/detalhe/:id/fluxo (alias antigo) ainda abre Resultados');

  // Página sem tradução: slug = id.
  el.aba = 'viabilidade';
  assert.equal(el.aba, 'viabilidade');
});

test('#589: selecionar Custos no menu leva o SLUG público para a URL, não o id', () => {
  const el = telaAvancado();
  const emitidos: any[] = [];
  el.dispatchEvent = (e: any) => { emitidos.push(e); return true; };

  const aoSelecionar = bindingPorSufixo(el.render(), '@urbi:nav-selecionar=') as (e: CustomEvent) => void;
  aoSelecionar(new CustomEvent('urbi:nav-selecionar', { detail: { id: 'obra' } }));
  aoSelecionar(new CustomEvent('urbi:nav-selecionar', { detail: { id: 'fluxo' } }));
  aoSelecionar(new CustomEvent('urbi:nav-selecionar', { detail: { id: 'viabilidade' } }));

  assert.deepEqual(emitidos.map((e) => e.type), ['viab:aba-topo', 'viab:aba-topo', 'viab:aba-topo']);
  assert.deepEqual(emitidos.map((e) => e.detail.id), ['custos', 'resultados', 'viabilidade']);
});

// ─────────────────────────────────────────────────────────────────────────
// Critério 3 — a aba default continua `resumo`, inclusive para slug desconhecido
// ─────────────────────────────────────────────────────────────────────────

// ⚠️ O LIMITE DESTE TESTE CONTINUA VALENDO, e agora ele tem par. Este bloco já
// se chamou "a aba default não vira a 1ª posição do array por acidente", e essa
// defesa não existia: `resumo` É `PAGINAS[0]`, então nenhuma asserção de
// caixa-preta distingue o literal `'resumo'` de um `PAGINAS[0].id`. Medido de
// novo em 2026-09-02, com a mutação nas DUAS origens do default (`_aba` inicial
// e o fallback do setter, `frontend/tela-avancado.ts`): 1048 testes de frontend
// e 74 casos de render VERDES. Este arquivo não enxerga a diferença — e, SEM
// mexer em produção, não há como fazê-lo enxergar.
//
// ⚠️ A ressalva não é decorativa, e a #638 é quem a exige: a **Opção 2** dela
// descreve uma costura de injeção em `PAGINAS` que tornaria a pergunta de
// comportamento outra vez, e diz, com todas as letras, que essa seria a defesa
// **mais forte**. Ela foi recusada aqui por ESCOPO — criar ponto de injeção em
// produção só para viabilizar teste tem risco próprio —, não por ser impossível.
// Escrever "não há como" sem a cláusula faria quem considerar a Opção 2 no futuro
// ler impossibilidade onde houve escolha.
//
// O que MUDOU é que a defesa passou a existir fora daqui, na camada que responde
// à pergunta sem tocar em produção: `scripts/guard-aba-default-literal.mjs`
// (#638) pergunta à ÁRVORE do TypeScript duas coisas: se cada origem do default
// é um literal de string que concorda com a outra, e se o setter ou o
// inicializador leem as listas de páginas de um jeito sensível à ORDEM.
//
// A segunda regra não é redundante, e custou quatro rodadas de revisão para
// aparecer: perguntar só "o fallback é literal?" depende de ALCANÇABILIDADE — um
// ternário de condição sempre-verdadeira tem o ramo falso morto, e o literal
// aprovado é código que não roda. A pergunta decidível na árvore é a da ordem, e
// é a que a issue de fato faz.
//
// A divisão de trabalho, para não se procurar aqui o que não mora aqui: este
// teste mede o COMPORTAMENTO (sem URL, e com slug desconhecido, a aba resolvida
// é `resumo`); o guard mede a FORMA que sustenta esse comportamento quando
// alguém reordenar `PAGINAS`.
test('#589: a aba default continua `resumo`, inclusive para slug desconhecido', () => {
  // Sem nada vindo da URL.
  assert.equal(telaAvancado().aba, 'resumo');

  // Slug desconhecido (ex.: uma URL de Preliminar) cai no default, não na 1ª
  // página da lista.
  const el = telaAvancado();
  el.aba = 'premissas';
  assert.equal(el.aba, 'resumo');
  el.aba = 'inexistente';
  assert.equal(el.aba, 'resumo');
});

// ─────────────────────────────────────────────────────────────────────────
// Critério 5 — paridade Loteamento × Incorporação
// ─────────────────────────────────────────────────────────────────────────

test('#589: a lista lateral é a MESMA para Loteamento e Incorporação', () => {
  const listaDe = (padrao: string) => {
    const el = telaAvancado();
    // `tipo_empreendimento` é o campo CANÔNICO do estudo (frontend/tela-estudo.ts,
    // `this.estudo.tipo_empreendimento`); `padrao`/`tipo` não existem no modelo e
    // ficam aqui só como ruído inerte. Sem o canônico as duas chamadas
    // entregariam `undefined` e exercitariam o MESMO caminho — o deepEqual
    // passaria por construção, inclusive depois de alguém introduzir a
    // ramificação que este teste diz barrar.
    el.estudo = { id: 1, tipo_empreendimento: padrao, padrao, tipo: padrao };
    const secoes = bindingPorSufixo(el.render(), '.secoes=') as { itens: { id: string; label: string }[] }[];
    return secoes[0].itens.map((p) => `${p.id}:${p.label}`);
  };
  // O menu do Avançado não ramifica por padrão de estudo — a paridade é
  // estrutural, e este teste é o que impede alguém de introduzir a ramificação
  // sem que nada fique vermelho.
  assert.deepEqual(listaDe('loteamento'), listaDe('incorporacao'));
  assert.equal(listaDe('loteamento')[2], 'obra:Custos');
});
