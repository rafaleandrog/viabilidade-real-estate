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

// Marca da recusa vinda do resolver simulado, para distingui-la de qualquer
// outra exceção que uma função do wrapper possa lançar.
//
// É um `Symbol` NA EXCEÇÃO, e não um prefixo de mensagem, porque texto é
// falsificável: medido, um `throw new Error('[shell] indisponivel')` vindo de
// outro lugar era classificado como recusa e a suíte falhava dizendo "o slug
// da app voltou ao caminho" — sem slug nenhum no caminho. Falhar pelo motivo
// errado manda quem lê procurar no lugar errado, que é justamente o defeito
// que esta separação existe para evitar.
const MARCA_RECUSA = Symbol('recusa-do-resolver');

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

// As funções que saem por `api()` com caminho ABSOLUTO de shell, de propósito:
// `/shell` está em SEGMENTOS_CROSS_APP no resolver, então não recebe injeção.
// Conjunto, e não escalar: uma segunda função cross-app legítima é plausível
// (`/shell/apps/viabilidade/parametros`), e com escalar ela reprovaria em dois
// pontos por uma razão que não é defeito.
const VIA_NAMESPACE_CROSS_APP = new Set(['listarUsuarios']);

// Argumento que LIGA todo ramo condicional de query do wrapper: é truthy (para
// `if (busca)` e para `tipo ? … : ''`), interpola como '7' (serve de id numa
// rota), e traz as chaves de filtro que `listarEstudos` lê.
const ARG_ATIVO = {
  tipo_empreendimento: 'incorporacao',
  status: 'ativo',
  toString: () => '7',
};

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
    throw Object.assign(
      new Error(
        `[shell] ${fn}() passou "${caminho}", que começa com o slug da app ` +
          `("/${APP_ID}"). O shell injeta o "/${APP_ID}" sozinho — passe o caminho ` +
          `relativo. Obsolescência api-slug-manual, encerrada.`
      ),
      { [MARCA_RECUSA]: true }
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

  const recusadas: string[] = [];
  const outrasExcecoes: string[] = [];
  for (const nome of funcoes) {
    fnAtual = nome;
    // Cada função é chamada DUAS vezes, e isso não é zelo: vários caminhos têm
    // um ramo condicional de query (`if (busca)`, `filtros.tipo_empreendimento`,
    // `tipo ? ... : ''`), e chamar só de um jeito exercita só um dos ramos. Uma
    // mutação que puser o slug apenas no ramo com query passaria verde —
    // medido, antes desta correção.
    //
    //  · sem argumento nenhum → os parâmetros com default assumem o default, e
    //    o ramo "sem query" é o exercitado;
    //  · com ARG_ATIVO em todas as posições → todo ramo condicional liga.
    //
    // ARG_ATIVO é truthy, interpola como '7' (serve de id), carrega as chaves
    // de filtro que o wrapper lê e sobrevive a `JSON.stringify`.
    const aridade = Math.max(api[nome].length, 3);
    const chamadas = [[], Array.from({ length: aridade }, () => ARG_ATIVO)];
    for (const args of chamadas) {
      try {
        await api[nome](...(args as any[]));
      } catch (e) {
        // Separar a recusa do resolver de QUALQUER outra exceção. Sem isto, um
        // `TypeError` vindo de outro lugar era empilhado em `recusadas` e a
        // falha saía com a mensagem "o slug da app voltou ao caminho" —
        // ruidosa, mas apontando para um slug que não existe. Falhar pelo
        // motivo errado manda quem lê procurar no lugar errado.
        const msg = String((e as Error).message);
        const ehRecusa = Boolean((e as any)?.[MARCA_RECUSA]);
        (ehRecusa ? recusadas : outrasExcecoes).push(`  · ${nome}(): ${msg}`);
      }
    }
  }

  // ── A asserção PRINCIPAL: as URLs COLETADAS, não as exceções propagadas ────
  //
  // Esta ordem importa, e custou uma rodada de revisão para ficar certa. A
  // versão anterior deste teste concluía só a partir de `recusadas`, ou seja,
  // da exceção CHEGAR até aqui — e uma função do wrapper que engolisse o
  // próprio erro num `try/catch` saía VERDE com o slug reposto. Medido, com a
  // mutação aplicada. Era o mesmo padrão que o cabeçalho deste arquivo culpa
  // por ter escondido o incidente original: o `catch` do dashboard.
  //
  // `chamadasApi` registra a URL ANTES de o mock lançar, então ela é o fato
  // primário; a exceção é consequência. Medir o fato primário torna a
  // verificação independente do que a função faz com o erro depois.
  // ⚠️ A regra é por PRESENÇA do segmento, não por posição — e a inversão é
  // deliberada. A versão anterior olhava só o PRIMEIRO segmento, espelhando o
  // resolver do shell, e três formas passavam verdes: `/api/viabilidade/…`,
  // `//viabilidade/…` e `./viabilidade/…`. A primeira é a perigosa de verdade,
  // porque o literal `/api/dados/viabilidade/…` JÁ existe neste mesmo arquivo
  // (nos dois uploads): copiá-lo para uma chamada de `api()` é o erro natural,
  // e produz o mesmo 404 em toda tela que derrubou a app.
  //
  // Enumerar as formas sujas não converge — é a armadilha 14. Então o teste
  // inverte: **nenhum caminho passado a `api()` carrega o segmento do slug**,
  // em posição nenhuma. Isso é verdade por construção, porque o shell injeta o
  // prefixo sozinho; a única chamada legítima que contém a palavra é a do
  // namespace cross-app, declarada em `VIA_NAMESPACE_CROSS_APP`.
  // ⚠️ A isenção é pela URL, NUNCA pela função — e a distinção não é estilo.
  // A versão anterior isentava `listarUsuarios` inteira, e com isso reabria
  // exatamente o buraco que a rodada anterior tinha fechado: uma segunda
  // chamada com o slug, dentro dela e engolida por um `try/catch`, saía verde.
  // Isentar QUEM CHAMA isenta tudo que essa função venha a fazer depois;
  // isentar A URL isenta só o caminho que de fato é legítimo.
  const comSlug = chamadasApi.filter((c) => {
    const path = c.url.split(/[?#]/)[0];
    if (path.startsWith('/shell/')) return false;
    return path.split('/').includes(APP_ID);
  });
  assert.deepEqual(
    comSlug.map((c) => `${c.fn}() → ${c.url}`),
    [],
    `chamada(s) a api() com o slug da app no caminho — o shell recusaria cada uma:\n` +
      comSlug.map((c) => `  · ${c.fn}() → ${c.url}`).join('\n')
  );

  assert.deepEqual(
    outrasExcecoes,
    [],
    `função(ões) do wrapper lançaram por um motivo que NÃO é a recusa do resolver — ` +
      `o teste não mediu o caminho delas:\n` + outrasExcecoes.join('\n')
  );

  // A recusa propagada é a verificação IRMÃ, não a principal: ela prova que o
  // erro do resolver chega a quem chamou, em vez de morrer no caminho.
  assert.deepEqual(
    recusadas,
    [],
    `o shell recusaria ${recusadas.length} chamada(s) — o slug da app voltou ao caminho:\n` +
      recusadas.join('\n')
  );

  // A contagem vem DEPOIS das duas asserções de URL, de propósito: a mensagem
  // dela manda "atualize a constante", e se ela falhasse primeiro, quem
  // seguisse a instrução converteria um vermelho de slug num bump de número.
  assert.equal(
    funcoes.length,
    FUNCOES_EXPORTADAS,
    `o wrapper exporta ${funcoes.length} funções, e este teste está calibrado para ` +
      `${FUNCOES_EXPORTADAS}. Confira ANTES que as asserções de caminho acima estejam ` +
      `verdes; só então atualize a constante — ela existe para que função nova não entre ` +
      `sem passar por esta verificação.`
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
    [...new Set(cross.map((c) => c.fn))].sort(),
    [...VIA_NAMESPACE_CROSS_APP].sort(),
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
