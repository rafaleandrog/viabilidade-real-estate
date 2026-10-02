import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado } from './avancado.js';
import { LINHAS_OBRIGATORIAS } from '../../frontend/fluxo-shared.js';

// #590/#514 — PROVA DE FIAÇÃO DE PONTA A PONTA (critério de aceite 3 da
// #590). Teste puro de frontend NÃO satisfaz este critério: era exatamente
// o caso antes deste PR — `dadosDaTrocaDeUnidade` convertia certo, e o
// `PATCH` real do backend tomava 400 UNIDADE_INVALIDA mesmo assim, porque o
// bug morava na FIAÇÃO (a allowlist de validação da rota), não no cálculo.
// Este arquivo monta um Express real, registra `rotasAvancado` como o shell
// faria, e faz uma requisição HTTP de verdade contra ele — a única forma de
// provar que a rota aceita o payload, e não só que a função pura converte.

// ── fake de `req.dados` (o que o shell injeta) — em memória, tabelas por Map ──
class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }

  async buscar(tabela: string, id: number) {
    return this.tabelas.get(tabela)?.get(Number(id)) ?? null;
  }

  // Obedece `pagina`/`por_pagina` COMO ESCRITO, igual ao backend real — sem
  // isso o fake não reproduz o defeito da #756: um `listar(..., por_pagina:
  // 1000)` tem que devolver só 1000 das 1001+ linhas semeadas.
  async listar(tabela: string, opts: {
    filtros?: Record<string, any>; pagina?: number; por_pagina?: number;
  } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    const linhas = todas.filter((linha) => Object.entries(filtros).every(([k, v]) => linha[k] === v));
    const pagina = opts.pagina ?? 1;
    const porPagina = opts.por_pagina ?? 20;
    const inicio = (pagina - 1) * porPagina;
    return { dados: linhas.slice(inicio, inicio + porPagina), total: linhas.length };
  }

  // Laço genuíno de páginas sobre `listar`, o mesmo contrato do verbo da
  // plataforma: devolve o ARRAY de todas as linhas, sem envelope.
  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any>; lote?: number } = {}) {
    const lote = opts.lote ?? 500;
    const todas: any[] = [];
    for (let pagina = 1; ; pagina++) {
      const r = await this.listar(tabela, { ...opts, pagina, por_pagina: lote });
      todas.push(...r.dados);
      if (todas.length >= r.total || r.dados.length === 0) return todas;
    }
  }

  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    const tab = this.tabelas.get(tabela);
    const atual = tab?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${tabela}#${id} não existe`);
    const atualizado = { ...atual, ...patch };
    tab!.set(Number(id), atualizado);
    return atualizado;
  }

  async criar(tabela: string, dados: Record<string, any>) {
    const id = this.semear(tabela, dados);
    return this.buscar(tabela, id);
  }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  // O shell injeta req.dados/req.contexto antes de despachar para a rota da
  // app — aqui simulado por um middleware, com nível admin (evita precisar
  // semear estudo_membros para passar por exigirEditor/exigirMembro).
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  return app;
}

function custoObraBase(estudoId: number, overrides: Record<string, any> = {}) {
  return {
    estudo_id: estudoId,
    grupo: 'obra',
    categoria: 'Gestão da obra',
    subcategoria: null,
    orcamento_valor: null,
    orcamento_valor_canonico: null,
    orcamento_unidade: 'rs',
    cronograma_evento: 'customizado',
    fase_ancora_id: null,
    inicio_mes: 0,
    duracao_meses: 1,
    ordem: 0,
    distribuicao_modo: 'fixo',
    permuta_tipologia_id: null,
    permuta_quantidade: 0,
    permuta_financeira_deduzir_imposto: false,
    permuta_financeira_deduzir_corretagem: false,
    ...overrides,
  };
}

async function comServidor(
  app: ReturnType<typeof express>,
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', () => resolve());
      server.once('error', reject);
    });
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('#590 fiação: PATCH /estudos/:id/avancado/custos/:cid com orcamento_unidade=pct_obra devolve 200, não 400', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_unidade: 'pct_obra' }),
    });
    const corpo = await res.json();
    assert.equal(res.status, 200, `esperado 200, veio ${res.status}: ${JSON.stringify(corpo)}`);
    assert.equal(corpo.orcamento_unidade, 'pct_obra');
    // Confirma que a mudança foi de fato PERSISTIDA no "banco" (não só ecoada
    // na resposta) — busca a linha de novo, fora da resposta do PATCH.
    const linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(linha.orcamento_unidade, 'pct_obra');
  });
});

test('#590 controle negativo: unidade inexistente continua tomando 400 UNIDADE_INVALIDA (prova que o teste acima exerce validação de verdade)', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_unidade: 'pct_fantasma' }),
    });
    const corpo = await res.json();
    assert.equal(res.status, 400);
    assert.equal(corpo.codigo, 'UNIDADE_INVALIDA');
    // A mensagem reflete a lista ATUAL — se pct_obra for removida de novo da
    // allowlist, este assert também acusa (a mensagem para de citá-la).
    assert.match(corpo.mensagem, /pct_obra/);
  });
});

test('#590 fiação: a linha muda de valor também — 10% de totalObra R$ 50.000.000 grava R$ 5.000.000 canônico (via _editarOrcamento simulado pelo cliente)', async () => {
  // Reproduz o fluxo completo do usuário: 1) troca a badge para "% Obra"
  // (PATCH orcamento_unidade); 2) digita 10 na badge (PATCH orcamento_valor +
  // orcamento_valor_canonico, exatamente como `_editarOrcamento` monta —
  // #514 é quem faz esse canônico sair certo; esta rota só precisa aceitar
  // gravar os dois campos, o que já valia antes desta issue).
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const cid = dados.semear('avancado_linhas_custo', custoObraBase(1, { orcamento_unidade: 'pct_obra' }));

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orcamento_valor: 10, orcamento_valor_canonico: 5_000_000 }),
    });
    assert.equal(res.status, 200);
    const linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.orcamento_valor_canonico), 5_000_000);
  });
});

// ── #753: a linha "Permuta física" entra nesse estado CAMPO A CAMPO ─────────
//
// A tela salva subcategoria, tipologia e quantidade em três PATCHes
// independentes (`tela-fluxo-custos.ts`). Antes da #753 `validarPermutaFisica`
// exigia tipologia E quantidade ≥ 1 em QUALQUER PATCH que deixasse a linha
// como "Permuta física" — o primeiro PATCH (só a subcategoria) tomava 400
// PERMUTA_TIPOLOGIA_OBRIGATORIA, o modelo da tela ficava na subcategoria
// anterior e a linha nunca renderizava o seletor de tipologia. Este teste é a
// prova de fiação de ponta a ponta, na mesma forma do #590 acima: Express real,
// rota real, três requisições na ordem em que a tela as faz.
//
// Mutação declarada: repor a guarda antiga (`PERMUTA_TIPOLOGIA_OBRIGATORIA`
// quando a tipologia é nula) deixa o PRIMEIRO passo vermelho.

function precoTerrenoBase(estudoId: number, overrides: Record<string, any> = {}) {
  return custoObraBase(estudoId, {
    grupo: 'terreno', categoria: 'Preço', subcategoria: 'Valor à vista',
    orcamento_valor: 1_000_000, orcamento_valor_canonico: 1_000_000,
    cronograma_evento: 'planejamento',
    ...overrides,
  });
}

async function patch(base: string, cid: number, body: Record<string, any>) {
  const res = await fetch(`${base}/estudos/1/avancado/custos/${cid}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, corpo: await res.json() };
}

test('#753 fiação: subcategoria → tipologia → quantidade, cada uma num PATCH próprio, sem 400 — e o saldo continua 422', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  // Tipologia do MESMO estudo (`estudo_id` numérico: `DadosFake.listar` e a
  // rota comparam por `===`/`Number()`), com 10 unidades, 2 alocadas em
  // Receitas → saldo 2 para permuta (a permuta sai das unidades ALOCADAS).
  dados.semear('avancado_tipologias', { id: 11, estudo_id: 1, nome: 'Studio', quantidade: 10, area_privativa_m2: 30, preco_m2: 10_000 });
  dados.semear('avancado_alocacoes', { id: 501, tipologia_id: 11, unidades: 2 });
  const cid = dados.semear('avancado_linhas_custo', precoTerrenoBase(1));

  await comServidor(criarApp(dados), async (base) => {
    // 1) A subcategoria sozinha — o passo que tomava 400 antes da #753.
    const r1 = await patch(base, cid, { subcategoria: 'Permuta física' });
    assert.equal(r1.status, 200, `passo 1 esperava 200, veio ${r1.status}: ${JSON.stringify(r1.corpo)}`);
    let linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(linha.subcategoria, 'Permuta física');
    // A linha de permuta física não tem valor monetário (#266/#338): a rota
    // zera o orçamento no mesmo PATCH, como já fazia quando o PATCH passava.
    assert.equal(linha.orcamento_valor, null);
    assert.equal(linha.orcamento_valor_canonico, null);
    assert.equal(linha.orcamento_unidade, 'rs');
    assert.equal(linha.permuta_tipologia_id, null, 'incompleta: ainda sem tipologia');

    // 2) A tipologia sozinha — quantidade gravada ainda é 0 (padrão do schema).
    const r2 = await patch(base, cid, { permuta_tipologia_id: 11 });
    assert.equal(r2.status, 200, `passo 2 esperava 200, veio ${r2.status}: ${JSON.stringify(r2.corpo)}`);
    linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.permuta_tipologia_id), 11);
    assert.equal(Number(linha.permuta_quantidade), 0, 'incompleta: ainda sem quantidade');

    // 3) A quantidade, dentro do saldo (2 disponíveis).
    const r3 = await patch(base, cid, { permuta_quantidade: 2 });
    assert.equal(r3.status, 200, `passo 3 esperava 200, veio ${r3.status}: ${JSON.stringify(r3.corpo)}`);
    linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.permuta_quantidade), 2);

    // 4) Controle negativo: a ÚNICA porta dura que sobrou é o saldo.
    const r4 = await patch(base, cid, { permuta_quantidade: 3 });
    assert.equal(r4.status, 422, `passo 4 esperava 422, veio ${r4.status}: ${JSON.stringify(r4.corpo)}`);
    assert.equal(r4.corpo.codigo, 'PERMUTA_SALDO_EXCEDIDO');
    assert.match(r4.corpo.mensagem, /2 unidade/);
    linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.permuta_quantidade), 2, 'o 422 não grava');
  });
});

test('#753 fiação: a quantidade pode vir ANTES da tipologia — a ordem dos campos não importa', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_tipologias', { id: 11, estudo_id: 1, nome: 'Studio', quantidade: 10 });
  dados.semear('avancado_alocacoes', { id: 501, tipologia_id: 11, unidades: 10 });
  const cid = dados.semear('avancado_linhas_custo', precoTerrenoBase(1, { subcategoria: 'Permuta física', orcamento_valor: null, orcamento_valor_canonico: null }));

  await comServidor(criarApp(dados), async (base) => {
    // Antes da #753: 400 PERMUTA_TIPOLOGIA_OBRIGATORIA (a quantidade sozinha
    // deixava a linha "Permuta física" sem tipologia).
    const r1 = await patch(base, cid, { permuta_quantidade: 3 });
    assert.equal(r1.status, 200, `esperava 200, veio ${r1.status}: ${JSON.stringify(r1.corpo)}`);
    // Depois a tipologia: agora a linha está completa e o saldo (10 alocadas) é conferido.
    const r2 = await patch(base, cid, { permuta_tipologia_id: 11 });
    assert.equal(r2.status, 200, `esperava 200, veio ${r2.status}: ${JSON.stringify(r2.corpo)}`);
    const linha = await dados.buscar('avancado_linhas_custo', cid);
    assert.equal(Number(linha.permuta_quantidade), 3);
    assert.equal(Number(linha.permuta_tipologia_id), 11);
  });
});

test('#753 controle negativo: tipologia GRAVADA que não é deste estudo toma 400 com resposta (antes a requisição pendurava)', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('estudos', { id: 2, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_tipologias', { id: 99, estudo_id: 2, nome: 'De outro estudo', quantidade: 10 });
  // A tipologia inválida já está gravada — o PATCH não a envia, então
  // `validarPermutaTipologia` (que só olha o corpo) não a vê; quem a vê é
  // `validarPermutaFisica`, pelo `atual`. Era o caminho do `return false` mudo.
  const cid = dados.semear('avancado_linhas_custo', precoTerrenoBase(1, {
    subcategoria: 'Permuta física', orcamento_valor: null, orcamento_valor_canonico: null, permuta_tipologia_id: 99,
  }));

  await comServidor(criarApp(dados), async (base) => {
    const r = await patch(base, cid, { permuta_quantidade: 1 });
    assert.equal(r.status, 400, `esperava 400, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.equal(r.corpo.codigo, 'PERMUTA_TIPOLOGIA_INVALIDA');
  });
});

test('#753 controle negativo: tipologia GRAVADA que já não existe (apagada depois) toma 400 com resposta — o outro disjuntivo do `!tip ||`', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  // Nenhuma tipologia semeada: `buscar` devolve null → ramo `!tip`.
  const cid = dados.semear('avancado_linhas_custo', precoTerrenoBase(1, {
    subcategoria: 'Permuta física', orcamento_valor: null, orcamento_valor_canonico: null, permuta_tipologia_id: 77,
  }));

  await comServidor(criarApp(dados), async (base) => {
    const r = await patch(base, cid, { permuta_quantidade: 1 });
    assert.equal(r.status, 400, `esperava 400, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.equal(r.corpo.codigo, 'PERMUTA_TIPOLOGIA_INVALIDA');
  });
});

// #756 — "todas as linhas" é `varrerTudo`, nunca `por_pagina: 1000`. O saldo de
// permuta física lê TODAS as alocações da tipologia e TODAS as linhas de custo
// do estudo; com mais de uma página, `listar` subcontava e a guarda 422 falhava
// aberta. Mutação declarada: voltar qualquer das duas leituras a
// `listar(..., por_pagina: 1000)` deixa o cenário correspondente vermelho,
// porque o fake obedece `por_pagina` como o banco real.
test('#756 saldo de permuta com 1200 alocações (mais de uma página): a guarda 422 continua fechada', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_tipologias', { id: 11, estudo_id: 1, nome: 'Studio', quantidade: 1500, area_privativa_m2: 30, preco_m2: 10_000 });
  for (let i = 0; i < 1200; i++) dados.semear('avancado_alocacoes', { tipologia_id: 11, unidades: 1 });
  const cid = dados.semear('avancado_linhas_custo', { ...precoTerrenoBase(1), subcategoria: 'Permuta física', permuta_tipologia_id: 11 });

  await comServidor(criarApp(dados), async (base) => {
    // A permuta sai das 1200 alocadas: 1200 disponíveis. Só a primeira página
    // (1000) daria 1000, e 1100 tomaria 422 indevido.
    const r = await patch(base, cid, { permuta_quantidade: 1201 });
    assert.equal(r.status, 422, `esperava 422, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.equal(r.corpo.codigo, 'PERMUTA_SALDO_EXCEDIDO');
    assert.match(r.corpo.mensagem, /1200 unidade/);
    const ok = await patch(base, cid, { permuta_quantidade: 1100 });
    assert.equal(ok.status, 200, `esperava 200, veio ${ok.status}: ${JSON.stringify(ok.corpo)}`);
  });
});

test('#756 saldo de permuta com 1100 linhas de custo reservando (mais de uma página): a guarda 422 continua fechada', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_tipologias', { id: 11, estudo_id: 1, nome: 'Studio', quantidade: 1200, area_privativa_m2: 30, preco_m2: 10_000 });
  dados.semear('avancado_alocacoes', { tipologia_id: 11, unidades: 1200 });
  for (let i = 0; i < 1100; i++) {
    dados.semear('avancado_linhas_custo', { ...precoTerrenoBase(1), subcategoria: 'Permuta física', permuta_tipologia_id: 11, permuta_quantidade: 1 });
  }
  const cid = dados.semear('avancado_linhas_custo', { ...precoTerrenoBase(1), subcategoria: 'Permuta física', permuta_tipologia_id: 11 });

  await comServidor(criarApp(dados), async (base) => {
    // 1200 alocadas − 1100 reservadas = 100 disponíveis. Só a primeira página (1000)
    // daria 200, e 200 passaria.
    const r = await patch(base, cid, { permuta_quantidade: 200 });
    assert.equal(r.status, 422, `esperava 422, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.equal(r.corpo.codigo, 'PERMUTA_SALDO_EXCEDIDO');
    assert.match(r.corpo.mensagem, /100 unidade/);
    const ok = await patch(base, cid, { permuta_quantidade: 100 });
    assert.equal(ok.status, 200, `esperava 200, veio ${ok.status}: ${JSON.stringify(ok.corpo)}`);
  });
});

// ── #802: a semeadura das linhas obrigatórias é idempotente no servidor ─────
//
// Duas execuções concorrentes de `_garantirLinhasObrigatorias` (duas abas,
// remontagem do componente) criavam duas linhas "Preço" a 0,19 s uma da outra.
// O fake abaixo segura o `criar` por alguns milissegundos: sem isso a 1ª
// requisição terminaria inteira antes de a 2ª chegar, e o teste passaria com
// ou sem a fila em série da rota — não exerceria a corrida.
class DadosFakeLento extends DadosFake {
  async criar(tabela: string, dados: Record<string, any>) {
    await new Promise((r) => setTimeout(r, 40));
    return super.criar(tabela, dados);
  }
}

async function postCusto(base: string, estudoId: number, body: Record<string, any>) {
  const res = await fetch(`${base}/estudos/${estudoId}/avancado/custos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, corpo: await res.json() };
}

async function linhasDe(dados: DadosFake, estudoId: number, grupo: string, categoria: string) {
  return dados.varrerTudo('avancado_linhas_custo', { filtros: { estudo_id: estudoId, grupo, categoria } });
}

test('#802 duas criações CONCORRENTES de Preço/terreno num estudo sem Preço resultam em UMA linha; a 2ª devolve a existente (200)', async () => {
  const dados = new DadosFakeLento();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });

  await comServidor(criarApp(dados), async (base) => {
    const corpo = { grupo: 'terreno', categoria: 'Preço', cronograma_evento: 'customizado', ordem: 0, semeadura: true };
    const [a, b] = await Promise.all([postCusto(base, 1, corpo), postCusto(base, 1, corpo)]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201], `status: ${a.status}, ${b.status}`);
    assert.equal(a.corpo.id, b.corpo.id, 'as duas respostas têm de ser a MESMA linha');
    assert.equal((await linhasDe(dados, 1, 'terreno', 'Preço')).length, 1);

    // A 2ª linha legítima de "Preço" — com subcategoria (#444) — continua aceita.
    const permuta = await postCusto(base, 1, { grupo: 'terreno', categoria: 'Preço', subcategoria: 'Permuta física', semeadura: true });
    assert.equal(permuta.status, 201, JSON.stringify(permuta.corpo));
    assert.notEqual(permuta.corpo.id, a.corpo.id);
    assert.equal((await linhasDe(dados, 1, 'terreno', 'Preço')).length, 2);
  });
});

test('#802 cada linha do catálogo LINHAS_OBRIGATORIAS (o mesmo que a tela semeia) é idempotente sob concorrência', async () => {
  const entradas = Object.entries(LINHAS_OBRIGATORIAS).flatMap(([grupo, obrigs]) => obrigs.map((o) => ({ grupo, ...o })));
  // Contagem exata: catálogo crescendo sem este teste perceber é sinal de que
  // alguém mexeu na semeadura — confira a tela e a doc junto.
  assert.deepEqual(entradas.map((e) => `${e.grupo}::${e.categoria}`),
    ['terreno::Preço', 'obra::Construção', 'diretos::Corretagem de vendas']);

  const dados = new DadosFakeLento();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  await comServidor(criarApp(dados), async (base) => {
    for (const e of entradas) {
      const corpo: Record<string, any> = { grupo: e.grupo, categoria: e.categoria, ordem: e.posicao, semeadura: true };
      if (e.unidade) corpo.orcamento_unidade = e.unidade;
      const rs = await Promise.all([postCusto(base, 1, corpo), postCusto(base, 1, corpo), postCusto(base, 1, corpo)]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 200, 201], `${e.categoria}: ${JSON.stringify(rs)}`);
      assert.equal((await linhasDe(dados, 1, e.grupo, e.categoria)).length, 1, e.categoria);
    }
  });
});

test('#802 a guarda é por estudo e só para a semeadura: outro estudo cria a sua; a mesma categoria em grupo fora do catálogo continua livre', async () => {
  const dados = new DadosFakeLento();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('estudos', { id: 2, nivel_analise: 'avancado', status: 'em_analise' });
  await comServidor(criarApp(dados), async (base) => {
    const preco = { grupo: 'terreno', categoria: 'Preço', semeadura: true };
    const [a, b] = await Promise.all([postCusto(base, 1, preco), postCusto(base, 2, preco)]);
    assert.deepEqual([a.status, b.status], [201, 201]);
    assert.equal((await linhasDe(dados, 2, 'terreno', 'Preço')).length, 1);

    // "Preço" em OUTRO grupo não é a semeadura do terreno.
    const fora = { grupo: 'indireto', categoria: 'Preço', semeadura: true };
    await Promise.all([postCusto(base, 1, fora), postCusto(base, 1, fora)]);
    assert.equal((await linhasDe(dados, 1, 'indireto', 'Preço')).length, 2);
  });
});

test('#802 a busca da existente é filtrada por estudo: Preço do estudo 1 já semeado não é devolvido ao estudo 2', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('estudos', { id: 2, nivel_analise: 'avancado', status: 'em_analise' });
  await comServidor(criarApp(dados), async (base) => {
    const preco = { grupo: 'terreno', categoria: 'Preço', semeadura: true };
    const um = await postCusto(base, 1, preco);
    const dois = await postCusto(base, 2, preco);
    assert.equal(um.status, 201);
    assert.equal(dois.status, 201, `o estudo 2 recebeu a linha de outro estudo: ${JSON.stringify(dois.corpo)}`);
    assert.equal(dois.corpo.estudo_id, 2);
  });
});

test('#802 subcategoria só com espaços conta como "sem subcategoria" (a mesma regra da validação): continua UMA linha', async () => {
  const dados = new DadosFakeLento();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  await comServidor(criarApp(dados), async (base) => {
    const corpo = { grupo: 'terreno', categoria: 'Preço', subcategoria: '   ', semeadura: true };
    const rs = await Promise.all([postCusto(base, 1, corpo), postCusto(base, 1, { grupo: 'terreno', categoria: 'Preço', semeadura: true })]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 201], JSON.stringify(rs));
    assert.equal((await linhasDe(dados, 1, 'terreno', 'Preço')).length, 1);
  });
});

test('#802 estudo com duplicata LEGADA não muda de número: a criação devolve a mais antiga e nada é apagado', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_linhas_custo', { ...precoTerrenoBase(1, { subcategoria: null, orcamento_valor: null, orcamento_valor_canonico: null }), id: 78 });
  dados.semear('avancado_linhas_custo', { ...precoTerrenoBase(1, { subcategoria: null, orcamento_valor: null, orcamento_valor_canonico: null }), id: 77 });
  await comServidor(criarApp(dados), async (base) => {
    const r = await postCusto(base, 1, { grupo: 'terreno', categoria: 'Preço', semeadura: true });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.id, 77);
    assert.equal((await linhasDe(dados, 1, 'terreno', 'Preço')).length, 2);
  });
});

test('#802 POST comum (sem `semeadura: true`) cria como sempre, mesmo com a obrigatória já existente — os campos enviados não são descartados', async () => {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  const existente = dados.semear('avancado_linhas_custo', custoObraBase(1, { categoria: 'Construção' }));
  await comServidor(criarApp(dados), async (base) => {
    const r = await postCusto(base, 1, {
      grupo: 'obra', categoria: 'Construção', orcamento_valor: 2_500_000, orcamento_unidade: 'rs', duracao_meses: 12,
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.notEqual(r.corpo.id, existente);
    assert.equal(Number(r.corpo.orcamento_valor), 2_500_000, 'o valor enviado tem de ser gravado, não descartado');
    assert.equal((await linhasDe(dados, 1, 'obra', 'Construção')).length, 2);
  });
});

// ── #792: permuta física é PARTE das unidades alocadas ───────────────────────
//
// Decisão do autor (opção b): o backend segue o motor (`reservarPermutasFisicas`
// reserva a permuta de DENTRO das alocações de Receitas). Saldo de alocação =
// catálogo − alocado; permuta ≤ alocado; o catálogo não desce abaixo do alocado.
// Antes, a permuta era descontada também do saldo de alocação: com catálogo 200
// e 20 permutadas a tela só deixava alocar 180, e o motor tirava as 20 de novo —
// R$ 6 mi de VGV vendável sumiam no estado da issue. Requisições HTTP reais
// contra `rotasAvancado`, para provar a fiação das rotas, não só a função pura.

function semearEstudoPermuta(dados: DadosFake, alocadas: number) {
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise' });
  dados.semear('avancado_tipologias', { id: 11, estudo_id: 1, nome: 'Studio', quantidade: 200, area_privativa_m2: 25, preco_m2: 12_000 });
  dados.semear('avancado_fases', { id: 21, estudo_id: 1, tipo: 'receita', nome: 'G' });
  const aid = alocadas > 0 ? dados.semear('avancado_alocacoes', { estudo_id: 1, fase_id: 21, tipologia_id: 11, unidades: alocadas, ordem: 0 }) : null;
  const cid = dados.semear('avancado_linhas_custo', precoTerrenoBase(1, {
    subcategoria: 'Permuta física', orcamento_valor: null, orcamento_valor_canonico: null,
    permuta_tipologia_id: 11, permuta_quantidade: 20,
  }));
  return { aid, cid };
}

async function enviar(base: string, metodo: string, caminho: string, body: Record<string, any>) {
  const res = await fetch(`${base}${caminho}`, {
    method: metodo, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, corpo: await res.json() };
}

test('#792 alocação: com 20 permutadas, o catálogo de 200 aloca inteiro (POST) — a permuta não desconta do saldo', async () => {
  const dados = new DadosFake();
  semearEstudoPermuta(dados, 0);
  await comServidor(criarApp(dados), async (base) => {
    const r = await enviar(base, 'POST', '/estudos/1/avancado/fases/21/alocacoes', { tipologia_id: 11, unidades: 200 });
    assert.equal(r.status, 201, `esperava 201, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    // Controle: o catálogo continua sendo o teto.
    const r2 = await enviar(base, 'POST', '/estudos/1/avancado/fases/21/alocacoes', { tipologia_id: 11, unidades: 1 });
    assert.equal(r2.status, 422);
    assert.equal(r2.corpo.codigo, 'SALDO_ESGOTADO');
  });
});

test('#792 alocação: estudo na regra antiga (180 + 20 = 200) completa as 200 pelo PATCH, e 201 continua 422', async () => {
  const dados = new DadosFake();
  const { aid } = semearEstudoPermuta(dados, 180);
  await comServidor(criarApp(dados), async (base) => {
    const passa = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/21/alocacoes/${aid}`, { unidades: 200 });
    assert.equal(passa.status, 200, `esperava 200, veio ${passa.status}: ${JSON.stringify(passa.corpo)}`);
    const barra = await enviar(base, 'PATCH', `/estudos/1/avancado/fases/21/alocacoes/${aid}`, { unidades: 201 });
    assert.equal(barra.status, 422);
    assert.equal(barra.corpo.codigo, 'SALDO_EXCEDIDO');
    assert.match(barra.corpo.mensagem, /200 unidade/);
  });
});

test('#792 permuta: o teto é o ALOCADO, não o catálogo — sem alocação não há o que permutar', async () => {
  const dados = new DadosFake();
  const { cid } = semearEstudoPermuta(dados, 15);
  await comServidor(criarApp(dados), async (base) => {
    // 15 alocadas: 20 permutadas não cabem, ainda que o catálogo tenha 200.
    const r = await patch(base, cid, { permuta_quantidade: 16 });
    assert.equal(r.status, 422, `esperava 422, veio ${r.status}: ${JSON.stringify(r.corpo)}`);
    assert.equal(r.corpo.codigo, 'PERMUTA_SALDO_EXCEDIDO');
    assert.match(r.corpo.mensagem, /15 unidade/);
    const ok = await patch(base, cid, { permuta_quantidade: 15 });
    assert.equal(ok.status, 200, `esperava 200, veio ${ok.status}: ${JSON.stringify(ok.corpo)}`);
  });
});

test('#792 catálogo: reduzir a quantidade vai até o ALOCADO (permuta inclusa), não até alocado + permutado', async () => {
  const dados = new DadosFake();
  semearEstudoPermuta(dados, 180);
  await comServidor(criarApp(dados), async (base) => {
    // Regra antiga: 180 + 20 = 200 comprometidas, e reduzir para 180 tomava 422.
    const ok = await enviar(base, 'PATCH', '/estudos/1/avancado/tipologias/11', { quantidade: 180 });
    assert.equal(ok.status, 200, `esperava 200, veio ${ok.status}: ${JSON.stringify(ok.corpo)}`);
    const barra = await enviar(base, 'PATCH', '/estudos/1/avancado/tipologias/11', { quantidade: 179 });
    assert.equal(barra.status, 422);
    assert.equal(barra.corpo.codigo, 'SALDO_EXCEDIDO');
    assert.match(barra.corpo.mensagem, /180 unidade/);
  });
});
