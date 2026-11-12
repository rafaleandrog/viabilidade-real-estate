// #860 — toda remoção de DENTRO de um estudo sai por `PATCH …/remover`.
//
// O shell só deixa `admin` usar DELETE em rota de app (SDK, permissoes.md
// § Contrato uniforme método→nível: "DELETE só para admin … Para 'remover da
// UI' sem ser admin, modele como mutação (PATCH …)"). Com DELETE, o editor —
// que cria custos, tipologias, produtos, documentos — tomava 403 em todo botão
// de remover (reproduzido ao vivo na Pinguim em 2026-11-12).
//
// O teste EXERCITA as funções do wrapper e mede o método e a URL que chegam ao
// `urbiVerso.api()` — não o texto do arquivo. Prova de que ele morde (refaça se
// mexer aqui): volte qualquer uma das funções abaixo para `method: 'DELETE'` e
// rode este arquivo; tem de ficar VERMELHO nomeando a função.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Função do wrapper → argumentos → caminho esperado (sem o sufixo `/remover`).
const REMOCOES_DO_ESTUDO: [string, number[], string][] = [
  ['removerEstudo', [7], '/estudos/7'],
  ['desvincularImovel', [7, 3], '/estudos/7/imoveis/3'],
  ['removerProdutoPreliminar', [7, 3], '/estudos/7/preliminar/produtos/3'],
  ['removerTipologia', [7, 3], '/estudos/7/avancado/tipologias/3'],
  ['removerFaseAvancado', [7, 3], '/estudos/7/avancado/fases/3'],
  ['removerAlocacao', [7, 3, 5], '/estudos/7/avancado/fases/3/alocacoes/5'],
  ['removerCustoAvancado', [7, 3], '/estudos/7/avancado/custos/3'],
  ['removerFundingOperacao', [7, 3], '/estudos/7/avancado/funding/3'],
  ['removerCenario', [7, 3], '/estudos/7/avancado/cenarios/3'],
  ['removerDocumentoApelo', [7, 3], '/estudos/7/apelo-comercial/documentos/3'],
  ['removerDocumentoEmpreendimento', [7, 3], '/estudos/7/empreendimento/documentos/3'],
];

// Os cadastros GLOBAIS continuam em DELETE: só o admin do app os edita, então o
// contrato do shell não barra ninguém que devesse passar.
const REMOCOES_GLOBAIS: [string, number[], string][] = [
  ['removerBenchmark', [3], '/benchmarks/3'],
  ['removerCurva', [3], '/avancado/curvas/3'],
  ['removerRegiaoMercado', [3], '/mercado/regioes/3'],
];

test('#860: as remoções de dentro do estudo saem por PATCH …/remover; as globais seguem em DELETE', async () => {
  const chamadas: { url: string; method: string }[] = [];
  (globalThis as any).urbiVerso = {
    api(url: string, opts: RequestInit = {}) {
      chamadas.push({ url, method: String(opts.method ?? 'GET') });
      return Promise.resolve({ ok: true });
    },
  };
  // O módulo captura `globalThis.urbiVerso` na importação — por isso o import
  // dinâmico DEPOIS do mock (mesma razão de `api-caminho-relativo.test.ts`).
  const api: Record<string, any> = await import('./viabilidade-api.js');

  for (const [fn, args, caminho] of REMOCOES_DO_ESTUDO) {
    assert.equal(typeof api[fn], 'function', `${fn} não é exportada pelo wrapper`);
    chamadas.length = 0;
    await api[fn](...args);
    assert.deepEqual(chamadas, [{ url: `${caminho}/remover`, method: 'PATCH' }], `${fn}()`);
  }
  for (const [fn, args, caminho] of REMOCOES_GLOBAIS) {
    chamadas.length = 0;
    await api[fn](...args);
    assert.deepEqual(chamadas, [{ url: caminho, method: 'DELETE' }], `${fn}()`);
  }
});
