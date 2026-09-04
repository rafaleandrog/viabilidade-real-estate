// O caminho passado a `urbiVerso.api()` é RELATIVO — nunca repete o slug da app.
//
// ── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────────
//
// Em 2026-09-04 a app inteira parou de funcionar na instância: nenhuma tela
// carregava dado, não dava para criar estudo, e a lista de estudos aparecia
// vazia — o que se leu, de fora, como "os dados foram apagados". Não foram.
//
// A causa era uma constante em `viabilidade-api.ts`:
//
//     const APP = '/viabilidade';            // interpolada em 72 caminhos
//
// O shell sempre injetou o `/<appId>` sozinho; repetir o slug à mão era um
// compat tolerado com `console.warn`. Quando a obsolescência `api-slug-manual`
// venceu (data-piso 2026-08-30), o resolver do shell passou a LANÇAR — antes
// de a requisição sair. Os 72 caminhos viraram 72 exceções.
//
// ── O QUE ESTE TESTE MEDE, E POR QUE ELE PRECISOU EXISTIR ───────────────────
//
// Medido antes do conserto: a suíte inteira ficava VERDE com o bug presente.
// Os mocks dos casos de render casam por `rota.includes(<sufixo>)` e nenhum
// deles casa `/viabilidade`, então nenhuma asserção do repo enxergava o
// prefixo. É a classe de defeito nº 1 do `CLAUDE.md` na forma mais cara: o
// cálculo estava certo, a FIAÇÃO é que estava errada, e a cobertura daquele
// caminho era decoração.
//
// Então este teste não olha o texto do arquivo — ele exercita as funções de
// verdade e mede a URL que efetivamente chega ao `api()`. Um guard estático
// sobre o literal `'/viabilidade'` pegaria só a forma já conhecida; a mesma
// URL montada por concatenação ou por outra constante passaria batido.
//
// O mock REPRODUZ a recusa do shell (`shell/frontend/src/urbiVerso.ts`,
// `resolverCaminhoApi`) em vez de só coletar strings: assim o teste quebra
// pelo mesmo motivo pelo qual a instância quebra, e não por um proxy disso.
//
// ⚠️ Prova de que ele morde (refaça se mexer aqui): reponha o prefixo em
// qualquer caminho de `viabilidade-api.ts` e rode este arquivo. Tem de ficar
// VERMELHO nomeando a função. Se ficar verde, o teste não está medindo nada.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const APP_ID = 'viabilidade';

// As funções que NÃO chamam `urbiVerso.api()` — o eixo aqui é *por onde a
// função sai*, não *que caminho ela escreve*. Cada entrada carrega o motivo (é
// o que um revisor lê para julgar se a exceção ainda vale) e a lista fecha por
// CONTAGEM EXATA abaixo, nos dois sentidos: entrada a mais (violação entrando
// de carona) e entrada a menos (exceção morta) reprovam.
//
// ⚠️ `listarUsuarios` NÃO entra aqui, e a distinção é a razão de esta lista
// existir com este eixo: ela chama `api()` normalmente, só que num namespace
// cross-app (`/shell/...`), que o resolver do shell deixa passar sem injetar
// slug. Ou seja, ela é exercitada pela verificação principal como qualquer
// outra — pô-la aqui a isentaria do teste que ela deve passar. O que ela tem
// de próprio é conferido em separado, no fim.
const SEM_CHAMADA_API: Record<string, string> = {
  listarGlebasNucleo: 'urbiVerso.nucleo() — não passa pelo resolver do shell',
  listarLotesNucleo: 'urbiVerso.nucleo() — não passa pelo resolver do shell',
  buscarImovelNucleo: 'urbiVerso.nucleo() — não passa pelo resolver do shell',
  uploadDocumentoApelo: 'fetch nativo em /api/dados/... — caminho absoluto, fora do resolver',
  uploadDocumentoEmpreendimento: 'fetch nativo em /api/dados/... — caminho absoluto, fora do resolver',
};

// A única função que sai por `api()` com caminho ABSOLUTO de shell, de
// propósito: `/shell` está em SEGMENTOS_CROSS_APP no resolver.
const VIA_NAMESPACE_CROSS_APP = 'listarUsuarios';

// Quantas funções o wrapper exporta. Trava a porta que a lista de exceção
// deixaria aberta: função nova que nasça com o slug entra no laço abaixo em
// vez de passar despercebida.
const FUNCOES_EXPORTADAS = 78;

type Registro = { fn: string; url: string };

/**
 * Reproduz `resolverCaminhoApi` do shell no ponto que importa: caminho cujo
 * primeiro segmento é o slug da app é RECUSADO. A query sai antes de fatiar,
 * como no original — senão `/viabilidade?x=1` escaparia da recusa.
 */
function resolverComoOShell(caminho: string, fn: string): void {
  const norm = caminho.startsWith('/') ? caminho : '/' + caminho;
  const corte = norm.search(/[?#]/);
  const somentePath = corte === -1 ? norm : norm.slice(0, corte);
  if ((somentePath.split('/')[1] ?? '') === APP_ID) {
    throw new Error(
      `[shell] ${fn}() passou "${caminho}", que começa com o slug da app ` +
        `("/${APP_ID}"). O shell injeta o "/${APP_ID}" sozinho — passe o caminho ` +
        `relativo. Obsolescência api-slug-manual, encerrada.`
    );
  }
}

test('nenhuma função do wrapper repete o slug da app no caminho', async () => {
  const chamadasApi: Registro[] = [];
  const chamadasNucleo: Registro[] = [];
  const chamadasFetch: Registro[] = [];
  let fnAtual = '?';

  (globalThis as any).urbiVerso = {
    api(url: string) {
      chamadasApi.push({ fn: fnAtual, url });
      resolverComoOShell(url, fnAtual);
      return Promise.resolve({ dados: [] });
    },
    nucleo(url: string) {
      chamadasNucleo.push({ fn: fnAtual, url });
      return Promise.resolve({ dados: [] });
    },
  };
  (globalThis as any).fetch = (url: string) => {
    chamadasFetch.push({ fn: fnAtual, url });
    return Promise.resolve({ json: async () => ({ upload_id: 1 }) } as any);
  };

  // O módulo captura `globalThis.urbiVerso` uma única vez, na primeira
  // importação — daí o import dinâmico DEPOIS de instalar o mock (mesma razão
  // documentada em `carregamento-corrida.test.ts`).
  const api: Record<string, any> = await import('./viabilidade-api.js');

  const funcoes = Object.keys(api).filter((k) => typeof api[k] === 'function').sort();

  assert.equal(
    funcoes.length,
    FUNCOES_EXPORTADAS,
    `o wrapper exporta ${funcoes.length} funções, e este teste está calibrado para ` +
      `${FUNCOES_EXPORTADAS}. Se você acrescentou ou removeu uma, atualize a constante ` +
      `— ela existe para que função nova não entre sem passar por esta verificação.`
  );

  const recusadas: string[] = [];
  for (const nome of funcoes) {
    fnAtual = nome;
    // `{}` para cada parâmetro declarado: serve como id interpolado, como
    // objeto de `JSON.stringify` e como filtro cujos campos saem `undefined`.
    const args = Array.from({ length: api[nome].length }, () => ({}));
    try {
      await api[nome](...args);
    } catch (e) {
      recusadas.push(`  · ${(e as Error).message}`);
    }
  }

  assert.deepEqual(
    recusadas,
    [],
    `o shell recusaria ${recusadas.length} chamada(s) — o slug da app voltou ao caminho:\n` +
      recusadas.join('\n')
  );

  // As que NÃO passam por `api()` com caminho de app são exatamente as
  // declaradas — nem uma a mais (violação entrando de carona), nem uma a menos
  // (exceção morta que desligaria a verificação em silêncio).
  const semChamadaApi = funcoes.filter((n) => !chamadasApi.some((c) => c.fn === n)).sort();
  assert.deepEqual(
    semChamadaApi,
    Object.keys(SEM_CHAMADA_API).sort(),
    'a lista SEM_CHAMADA_API divergiu do que o wrapper realmente faz'
  );

  // A exceção cross-app continua sendo o que diz ser — e continua sendo UMA só.
  const cross = chamadasApi.filter((c) => c.url.startsWith('/shell/'));
  assert.deepEqual(
    [...new Set(cross.map((c) => c.fn))],
    [VIA_NAMESPACE_CROSS_APP],
    'apareceu (ou sumiu) uma chamada a api() num namespace cross-app'
  );

  // E as três exceções continuam sendo o que dizem ser.
  for (const { fn, url } of chamadasFetch) {
    assert.ok(
      url.startsWith('/api/dados/'),
      `${fn}() usa fetch nativo e deve bater em /api/dados/... — veio "${url}"`
    );
  }
  for (const { fn, url } of chamadasNucleo) {
    assert.ok(
      !url.startsWith(`/${APP_ID}`),
      `${fn}() passou "${url}" a nucleo() — o slug não entra aqui tampouco`
    );
  }
});
