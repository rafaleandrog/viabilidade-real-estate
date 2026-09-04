// #597 — a corrida de carregamento em `tela-proforma.ts` e `tela-premissas.ts`:
// navegar do estudo A para o B, com a resposta de A chegando DEPOIS da de B,
// não pode sobrescrever `produtos`/`benchmarks`/`aliquotaRet` do estudo B.
// Mesma classe de defeito que `tela-graficos.ts` teve (PR 580) e o mesmo
// conserto: `respostaAindaVale` (`frontend/viab-imagem-principal.ts:41`),
// importada — não reescrita inline (`:34-40` explica o porquê).
//
// Sem harness de DOM neste repo (só `frontend/render/*.render.test.ts`, que
// mede layout via Chromium com respostas de rede fixas — não serve para
// controlar ORDEM de resolução de duas fetches concorrentes). Este arquivo
// chama `_init()` diretamente nas duas classes reais — o mesmo método privado
// que `updated()` dispara — em vez de reimplementar a corrida numa função
// solta que poderia divergir do código de produção. Isso funciona porque as
// duas telas não tocam o DOM dentro de `_init()`: só leem `this.estudo` e
// escrevem `@state()`. `LitElement` se instancia em Node sem `customElements`
// nem `document` (confirmado nesta sessão) — o que falharia sem DOM é
// `render()`/`renderRoot`, que `_init()` nunca chama.
//
// `viabilidade-api.ts` resolve `urbiVerso` uma única vez, na primeira
// importação (`export const urbiVerso = globalThis.urbiVerso as ...`) — por
// isso o mock é instalado em `globalThis.urbiVerso` ANTES do `import()`
// dinâmico das duas telas, abaixo. Import estático das telas rodaria antes
// deste arquivo ter chance de instalar o mock.

import { test } from 'node:test';
import assert from 'node:assert/strict';

type Chamada = { url: string; resolve: (v: any) => void; reject: (e: any) => void };

// Mock de `urbiVerso.api`: cada chamada registra uma promise controlável e
// fica pendurada até o teste decidir resolvê-la — é o que permite fazer a
// resposta de A "chegar depois" da de B de propósito, em vez de torcer pela
// ordem natural de duas promises já resolvidas.
function criarApiControlavel() {
  const chamadas: Chamada[] = [];
  const api = (url: string, _opts?: any): Promise<any> => {
    let resolve!: (v: any) => void;
    let reject!: (e: any) => void;
    const p = new Promise<any>((res, rej) => { resolve = res; reject = rej; });
    chamadas.push({ url, resolve, reject });
    return p;
  };
  // Resolve a N-ésima chamada feita (0-based) — índice explícito, não FIFO por
  // URL: `buscarConfig()` bate na MESMA URL (`/config`) para os
  // dois estudos, então só a ordem de REGISTRO (que o teste controla ao
  // decidir quando chama `_init()`) distingue qual é qual.
  const resolverChamada = (indice: number, valor: any) => {
    const c = chamadas[indice];
    if (!c) throw new Error(`sem chamada registrada no índice ${indice} (havia ${chamadas.length})`);
    c.resolve(valor);
  };
  const rejeitarChamada = (indice: number, erro: any) => {
    const c = chamadas[indice];
    if (!c) throw new Error(`sem chamada registrada no índice ${indice} (havia ${chamadas.length})`);
    c.reject(erro);
  };
  return { api, chamadas, resolverChamada, rejeitarChamada };
}

// `viabilidade-api.ts` faz `export const urbiVerso = globalThis.urbiVerso as ...`
// — captura o VALOR (a referência ao objeto) uma única vez, na primeira
// importação. Trocar `globalThis.urbiVerso` inteiro depois disso não muda o
// que o módulo já capturou. Por isso o objeto instalado abaixo nunca é
// substituído: cada teste troca só a função para a qual `api`/`notificar`
// delegam (`apiAtual`/`notificarAtual`), via `usarApi()`.
let apiAtual: (url: string, opts?: any) => Promise<any> = () => Promise.resolve({ dados: [] });
let notificarAtual: (...args: any[]) => void = () => {};
function usarApi(fn: (url: string, opts?: any) => Promise<any>) { apiAtual = fn; }

(globalThis as any).urbiVerso = {
  api: (url: string, opts?: any) => apiAtual(url, opts),
  notificar: (...args: any[]) => notificarAtual(...args),
};

const { ViabTelaProforma } = await import('./tela-proforma.js');
const { ViabTelaPremissas } = await import('./tela-premissas.js');

// ─────────────────────────────────────────────────────────────────────────
// tela-proforma.ts — estudo de Incorporação (critério #8: um estudo de cada
// tipo entre os dois arquivos deste teste).
// ─────────────────────────────────────────────────────────────────────────

test('#597 tela-proforma: resposta de A fora de ordem (chega DEPOIS da de B) não sobrescreve produtos/benchmarks/aliquotaRet', async () => {
  const ctrl = criarApiControlavel();
  usarApi(ctrl.api);

  const el: any = new ViabTelaProforma();
  const estudoA = { id: 1, tipo_empreendimento: 'incorporacao' };
  const estudoB = { id: 2, tipo_empreendimento: 'incorporacao' };

  // Navega para A: dispara [benchmarks(A), config(A), produtos(A)] — índices 0,1,2.
  el.estudo = estudoA;
  const p1 = el._init();
  // Antes de A responder, navega para B: dispara [benchmarks(B), config(B), produtos(B)] — índices 3,4,5.
  el.estudo = estudoB;
  const p2 = el._init();

  assert.equal(ctrl.chamadas.length, 6, 'as duas chamadas de _init() não dispararam 3+3 fetches');
  assert.match(ctrl.chamadas[2].url, /\/estudos\/1\//, 'chamada 2 devia ser o produtos de A (id=1)');
  assert.match(ctrl.chamadas[5].url, /\/estudos\/2\//, 'chamada 5 devia ser o produtos de B (id=2)');

  // B resolve PRIMEIRO — é o comportamento correto de rede: a fetch mais nova
  // (B) chega antes da mais antiga (A).
  const benchmarksB = { dados: [{ campo: 'vgv_m2', valor_min: 2, valor_max: 5 }] };
  const cfgB = { parametros: { aliquota_ret_pct: 7 } };
  const produtosB = { dados: [{ id: 20, nome: 'Produto B' }] };
  ctrl.resolverChamada(3, benchmarksB);
  ctrl.resolverChamada(4, cfgB);
  ctrl.resolverChamada(5, produtosB);
  await p2;

  assert.deepEqual(el.produtos, produtosB.dados, 'B não aplicou o próprio catálogo');
  assert.equal(el.aliquotaRet, 7, 'B não aplicou a própria alíquota');
  assert.deepEqual(el.benchmarks, benchmarksB.dados, 'B não aplicou os próprios benchmarks');

  // A resolve DEPOIS, com valores DIFERENTES — se a guarda não estiver em
  // vigor, estes valores vazam para o estado que a tela mostra (o estudo B).
  const benchmarksA = { dados: [{ campo: 'vgv_m2', valor_min: 99, valor_max: 999 }] };
  const cfgA = { parametros: { aliquota_ret_pct: 4 } };
  const produtosA = { dados: [{ id: 10, nome: 'Produto A' }] };
  ctrl.resolverChamada(0, benchmarksA);
  ctrl.resolverChamada(1, cfgA);
  ctrl.resolverChamada(2, produtosA);
  await p1;

  // A tela ainda mostra o estudo B, sem contaminação de A.
  assert.deepEqual(el.produtos, produtosB.dados, 'a resposta atrasada de A sobrescreveu produtos de B');
  assert.equal(el.aliquotaRet, 7, 'a resposta atrasada de A sobrescreveu aliquotaRet de B');
  assert.deepEqual(el.benchmarks, benchmarksB.dados, 'a resposta atrasada de A sobrescreveu benchmarks de B');
});

test('#597 tela-proforma: o catch também descarta a resposta atrasada (sem console.error para a chamada obsoleta)', async () => {
  const ctrl = criarApiControlavel();
  usarApi(ctrl.api);
  const origConsoleError = console.error;
  const erros: any[] = [];
  console.error = (...args: any[]) => { erros.push(args); };

  try {
    const el: any = new ViabTelaProforma();
    const estudoA = { id: 1, tipo_empreendimento: 'incorporacao' };
    const estudoB = { id: 2, tipo_empreendimento: 'incorporacao' };

    el.estudo = estudoA;
    const p1 = el._init(); // índices 0,1,2
    el.estudo = estudoB;
    const p2 = el._init(); // índices 3,4,5

    ctrl.resolverChamada(3, { dados: [] });
    ctrl.resolverChamada(4, { parametros: { aliquota_ret_pct: 7 } });
    ctrl.resolverChamada(5, { dados: [{ id: 20, nome: 'Produto B' }] });
    await p2;
    assert.equal(erros.length, 0, 'B não devia logar erro nenhum');

    // A REJEITA — é uma fetch que falhou depois de ficar obsoleta. Sem a
    // guarda no `catch`, isto logaria um erro sobre um estudo que não é mais
    // o que a tela mostra.
    ctrl.resolverChamada(0, { dados: [] });
    ctrl.resolverChamada(1, { parametros: { aliquota_ret_pct: 4 } });
    ctrl.rejeitarChamada(2, new Error('falha de rede da chamada obsoleta de A'));
    await p1; // não pode rejeitar: o catch da própria _init() trata o erro.

    assert.equal(erros.length, 0, 'o catch logou um erro de uma chamada já obsoleta (estudo A, quando a tela já é B)');
    assert.deepEqual(el.produtos, [{ id: 20, nome: 'Produto B' }], 'estado de B precisa continuar intacto');
  } finally {
    console.error = origConsoleError;
  }
});

test('#597 tela-proforma: sem corrida, um erro do estudo CORRENTE ainda é logado (o guard não silencia erro real)', async () => {
  const ctrl = criarApiControlavel();
  usarApi(ctrl.api);
  const origConsoleError = console.error;
  const erros: any[] = [];
  console.error = (...args: any[]) => { erros.push(args); };

  try {
    const el: any = new ViabTelaProforma();
    el.estudo = { id: 1, tipo_empreendimento: 'incorporacao' };
    const p1 = el._init();
    ctrl.resolverChamada(0, { dados: [] });
    ctrl.resolverChamada(1, { parametros: { aliquota_ret_pct: 4 } });
    ctrl.rejeitarChamada(2, new Error('falha de rede real, sem troca de estudo'));
    await p1;
    assert.equal(erros.length, 1, 'um erro do estudo corrente (sem corrida) precisa continuar logado');
  } finally {
    console.error = origConsoleError;
  }
});

// ─────────────────────────────────────────────────────────────────────────
// tela-premissas.ts — estudo de Loteamento (o outro tipo do critério #8).
// ─────────────────────────────────────────────────────────────────────────

test('#597 tela-premissas: resposta de A fora de ordem (chega DEPOIS da de B) não sobrescreve produtos/benchmarks/aliquotaRet', async () => {
  const ctrl = criarApiControlavel();
  usarApi(ctrl.api);

  const el: any = new ViabTelaPremissas();
  const estudoA = { id: 1, tipo_empreendimento: 'loteamento' };
  const estudoB = { id: 2, tipo_empreendimento: 'loteamento' };

  el.estudo = estudoA;
  const p1 = el._init(); // índices 0,1,2
  el.estudo = estudoB;
  const p2 = el._init(); // índices 3,4,5

  assert.equal(ctrl.chamadas.length, 6, 'as duas chamadas de _init() não dispararam 3+3 fetches');
  assert.match(ctrl.chamadas[2].url, /\/estudos\/1\//, 'chamada 2 devia ser o produtos de A (id=1)');
  assert.match(ctrl.chamadas[5].url, /\/estudos\/2\//, 'chamada 5 devia ser o produtos de B (id=2)');

  const benchmarksB = { dados: [{ campo: 'vgv_m2', valor_min: 1, valor_max: 3 }] };
  const cfgB = { parametros: { aliquota_ret_pct: 6 } };
  const produtosB = { dados: [{ id: 20, nome: 'Lote B' }] };
  ctrl.resolverChamada(3, benchmarksB);
  ctrl.resolverChamada(4, cfgB);
  ctrl.resolverChamada(5, produtosB);
  await p2;

  assert.deepEqual(el.produtos, produtosB.dados);
  assert.equal(el.aliquotaRet, 6);
  assert.deepEqual(el.benchmarks, benchmarksB.dados);

  const benchmarksA = { dados: [{ campo: 'vgv_m2', valor_min: 88, valor_max: 888 }] };
  const cfgA = { parametros: { aliquota_ret_pct: 4 } };
  const produtosA = { dados: [{ id: 10, nome: 'Lote A' }] };
  ctrl.resolverChamada(0, benchmarksA);
  ctrl.resolverChamada(1, cfgA);
  ctrl.resolverChamada(2, produtosA);
  await p1;

  assert.deepEqual(el.produtos, produtosB.dados, 'a resposta atrasada de A sobrescreveu produtos de B');
  assert.equal(el.aliquotaRet, 6, 'a resposta atrasada de A sobrescreveu aliquotaRet de B');
  assert.deepEqual(el.benchmarks, benchmarksB.dados, 'a resposta atrasada de A sobrescreveu benchmarks de B');
});

test('#597 tela-premissas: o catch também descarta a resposta atrasada (sem console.error para a chamada obsoleta)', async () => {
  const ctrl = criarApiControlavel();
  usarApi(ctrl.api);
  const origConsoleError = console.error;
  const erros: any[] = [];
  console.error = (...args: any[]) => { erros.push(args); };

  try {
    const el: any = new ViabTelaPremissas();
    const estudoA = { id: 1, tipo_empreendimento: 'loteamento' };
    const estudoB = { id: 2, tipo_empreendimento: 'loteamento' };

    el.estudo = estudoA;
    const p1 = el._init(); // índices 0,1,2
    el.estudo = estudoB;
    const p2 = el._init(); // índices 3,4,5

    ctrl.resolverChamada(3, { dados: [] });
    ctrl.resolverChamada(4, { parametros: { aliquota_ret_pct: 6 } });
    ctrl.resolverChamada(5, { dados: [{ id: 20, nome: 'Lote B' }] });
    await p2;
    assert.equal(erros.length, 0, 'B não devia logar erro nenhum');

    ctrl.resolverChamada(0, { dados: [] });
    ctrl.resolverChamada(1, { parametros: { aliquota_ret_pct: 4 } });
    ctrl.rejeitarChamada(2, new Error('falha de rede da chamada obsoleta de A'));
    await p1;

    assert.equal(erros.length, 0, 'o catch logou um erro de uma chamada já obsoleta (estudo A, quando a tela já é B)');
    assert.deepEqual(el.produtos, [{ id: 20, nome: 'Lote B' }], 'estado de B precisa continuar intacto');
  } finally {
    console.error = origConsoleError;
  }
});
