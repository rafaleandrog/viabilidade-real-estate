import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasEstudos } from './estudos.js';
import esquemaApp from '../../schema.json';

// #634 — PROVA DE FIAÇÃO DE PONTA A PONTA. A leitura de `avancado_linhas_custo`
// dentro de `duplicarDadosAvancado` usava `listar(..., por_pagina: 500)`: um
// estudo com MAIS de 500 linhas de custo perdia, em silêncio, tudo além da
// 500ª na cópia — e `mapaCusto` (que remapeia `custo_linha_ids` das operações
// de funding) cobria só as 500 lidas, então uma operação cujo `custo_linha_ids`
// apontasse para uma linha além da página 1 a tratava como órfã e a
// descartava, mesmo a linha existindo no original.
//
// Teste de rota, não de função pura (mesma exigência do PR #643/#590): monta
// um Express real, registra `rotasEstudos` como o shell faria, e faz um
// `POST /estudos/:id/duplicar` de verdade. `duplicarDadosAvancado` é I/O puro
// (só `req.dados`), então o fake abaixo tem que se comportar como o backend
// REAL quanto a `por_pagina` — obedecendo-o como escrito — para que a
// mutação "trocar varrerTudo de volta por listar(..., por_pagina: 500)"
// derrube o teste. `varrerTudo` é implementado aqui como um LAÇO genuíno de
// páginas sobre `listar`, replicando `docs/shell/banco-de-dados.md`
// § "varrerTudo" (no monorepo): pagina até esgotar e devolve o array de
// linhas, sem envelope `{dados, total}`.

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

  // Obedece `por_pagina` COMO ESCRITO — mesmo contrato do backend real
  // (`docs/shell/banco-de-dados.md` § "por_pagina no backend é obedecido").
  // Sem isso o fake não reproduziria o bug: um `listar(..., por_pagina: 500)`
  // teria que devolver só 500 das 501+ linhas seedadas, exatamente como o
  // banco real devolveria.
  async listar(tabela: string, opts: {
    filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc';
    pagina?: number; por_pagina?: number;
  } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    let linhas = todas.filter((l) => Object.entries(filtros).every(([k, v]) => l[k] === v));
    if (opts.ordenar) {
      const campo = opts.ordenar;
      const dir = opts.ordem === 'desc' ? -1 : 1;
      linhas = [...linhas].sort((a, b) => {
        const av = a[campo]; const bv = b[campo];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * dir;
      });
    }
    const total = linhas.length;
    const pagina = opts.pagina ?? 1;
    const porPagina = opts.por_pagina ?? 20;
    const inicio = (pagina - 1) * porPagina;
    const dados = linhas.slice(inicio, inicio + porPagina);
    return { dados, total };
  }

  // Pagina em laço até esgotar e devolve o ARRAY de linhas — mesmo contrato
  // do `varrerTudo` real (sem `total`/`paginas`, porque não há página).
  async varrerTudo(tabela: string, opts: {
    filtros?: Record<string, any>; ordenar?: string; ordem?: 'asc' | 'desc'; lote?: number;
  } = {}) {
    const lote = opts.lote ?? 500;
    const todas: any[] = [];
    let pagina = 1;
    for (;;) {
      const r = await this.listar(tabela, { ...opts, pagina, por_pagina: lote });
      todas.push(...r.dados);
      if (todas.length >= r.total || r.dados.length === 0) break;
      pagina++;
    }
    return todas;
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

  async remover(tabela: string, id: number, _atorId?: number) {
    return this.atualizar(tabela, id, { removido_em: new Date().toISOString() });
  }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1, nome: 'Teste' } };
    req.eventos = {
      publicar: async () => {},
      inscreverUsuario: async () => {},
      cancelarInscricao: async () => {},
    };
    next();
  });
  app.use(rotasEstudos);
  return app;
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

// Semeia um estudo Avançado com `n` linhas de custo (grupo/categoria triviais,
// só o suficiente para `extrairCampos`/`validarCamposCusto` não terem nada a
// reclamar) e devolve o id do estudo original + o id da linha de índice
// `linhaAlvoIdx` (0-based), que o teste usa como base de uma operação de
// funding.
function semearEstudoComCustos(dados: DadosFake, n: number) {
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo original', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  const idsCusto: number[] = [];
  for (let i = 0; i < n; i++) {
    const cid = dados.semear('avancado_linhas_custo', {
      estudo_id: origId, grupo: 'diretos', categoria: 'Outro', subcategoria: null,
      orcamento_valor: 1000 + i, orcamento_valor_canonico: 1000 + i, orcamento_unidade: 'rs',
      curva_id: null, cronograma_evento: 'customizado', fase_ancora_id: null,
      inicio_mes: 0, duracao_meses: 1, ordem: i, distribuicao_modo: 'fixo',
      permuta_tipologia_id: null, permuta_quantidade: 0,
      permuta_financeira_deduzir_imposto: false, permuta_financeira_deduzir_corretagem: false,
    });
    idsCusto.push(cid);
  }
  return { origId, idsCusto };
}

test('#634 fiação: POST /estudos/:id/duplicar copia TODAS as 501 linhas de custo, não só as primeiras 500', async () => {
  const dados = new DadosFake();
  const { origId, idsCusto } = semearEstudoComCustos(dados, 501);
  const idLinha501 = idsCusto[500]; // índice 500 = a 501ª linha, ordem 500

  // Operação de funding cujo `custo_linha_ids` inclui EXATAMENTE a linha 501ª
  // — critério de aceite (b) da issue: `mapaCusto` precisa cobrir essa linha
  // para o remapeamento não a descartar como órfã.
  dados.semear('avancado_funding_operacoes', {
    estudo_id: origId, tipo: 'financiamento_producao', nome: 'Financiamento à produção',
    ordem: 0, valor: 0, cronograma_evento: 'customizado', fase_ancora_id: null,
    inicio_mes: 0, distribuir_aporte: false, aporte_meses: 1, taxa_anual: 0,
    periodo_amortizacao_meses: 0, periodo_carencia_meses: 0,
    modo_retorno: 'permuta_financeira', pct_retorno: 0,
    exposicao_minima: 20, percentual_financiavel: 80, amortizar_com_caixa_disponivel: true,
    custo_linha_ids: [idLinha501],
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201, `esperado 201, veio ${res.status}: ${JSON.stringify(corpo)}`);
    const novoId = Number(corpo.id);
    assert.notEqual(novoId, origId);

    // Critério de aceite (a): total de linhas de custo copiadas == original.
    const custosCopia = await dados.listar('avancado_linhas_custo', {
      filtros: { estudo_id: novoId }, por_pagina: 10000,
    });
    assert.equal(custosCopia.total, 501, 'a cópia perdeu linhas de custo além da página 1 (500)');

    // Critério de aceite (b): a operação de funding copiada preserva a
    // seleção de custo_linha_ids — a linha 501ª não foi tratada como órfã.
    const opsCopia = await dados.listar('avancado_funding_operacoes', {
      filtros: { estudo_id: novoId }, por_pagina: 10,
    });
    assert.equal(opsCopia.total, 1, 'a operação de funding não foi copiada');
    const idsRemapeados: number[] = opsCopia.dados[0].custo_linha_ids;
    assert.equal(idsRemapeados.length, 1,
      'custo_linha_ids da cópia veio vazio — a linha 501ª foi tratada como órfã e descartada ' +
      '(exatamente o defeito da #634: mapaCusto não cobria além da página 1)');
    // O id remapeado tem que apontar para uma linha de custo QUE EXISTE na
    // cópia (não o id antigo, de outro estudo).
    const idsCopiaSet = new Set(custosCopia.dados.map((c: any) => Number(c.id)));
    assert.ok(idsCopiaSet.has(idsRemapeados[0]),
      'custo_linha_ids da cópia aponta para um id que não existe na cópia');
  });
});

// ── Bug relatado: "Campo X deve ser um número" ao duplicar ──
//
// ⚠️ **Este dublê já implementou a regra ERRADA, e foi ELE que deixou quatro
// correções passarem verdes enquanto o bug seguia vivo em produção.** Ele se
// chamava `DadosFakeComValidadorDeNulo` e lançava quando o valor era `null` —
// o oposto do shell. A suíte media a crença da app, não o shell.
//
// Regra do shell 0.55.22, a versão que a instância roda
// (`shell/backend/src/dados/validacao-dados.ts`, `validarInsert`/`validarUpdate`):
//
//   1. `null`/`undefined` em coluna OPCIONAL: `continue` — **aceito**, sem
//      olhar o tipo;
//   2. o resto passa por `validarValor`, e `decimal` é `typeof valor !==
//      'number'` → "Campo X deve ser um número"; `inteiro`/`referencia` exigem
//      ainda `Number.isInteger`.
//
// O que importa aqui é o item 2 sobre STRING: coluna `decimal` volta do
// Postgres como string (`"4.00"`), porque o shell só registra type parser
// customizado para `DATE`. É essa string, e não o `null`, que quebrava a
// duplicação.
class DadosFakeComValidadorDoShell extends DadosFake {
  // ⚠️ **A tabela de tipos é derivada AQUI, do `schema.json` cru — nunca de
  // `colunasNumericas()`.** Usar o helper do módulo sob revisão faria do dublê
  // um oráculo CIRCULAR: por construção ele só validaria os campos que a
  // própria coerção já converteu, e o conjunto de falha possível seria vazio.
  // Perder um tipo em `TIPOS_NUMERICOS` cegaria correção e oráculo juntos, com
  // a suíte verde. Achado convergente de duas lentes na revisão do PR.
  private static tipoDaColuna(tabela: string, campo: string): string | undefined {
    const t = (esquemaApp as any)?.tabelas?.[tabela]?.colunas?.[campo];
    return t?.tipo;
  }

  private static validar(tabela: string, dados: Record<string, any>): void {
    const erros: string[] = [];
    for (const [campo, valor] of Object.entries(dados)) {
      if (valor === null || valor === undefined) continue; // coluna opcional: aceito
      const tipo = DadosFakeComValidadorDoShell.tipoDaColuna(tabela, campo);
      if (tipo === 'decimal') {
        if (typeof valor !== 'number') erros.push(`Campo "${campo}" deve ser um número`);
      } else if (tipo === 'inteiro' || tipo === 'referencia') {
        // O shell exige `Number.isInteger`, não só `typeof` — sem isto o dublê
        // é MAIS FROUXO que o shell que ele diz reproduzir, e um `unidades:
        // 12.5` passaria verde aqui e seria recusado em produção. Achado P2 do
        // Codex nesta revisão.
        if (typeof valor !== 'number' || !Number.isInteger(valor)) {
          erros.push(`Campo "${campo}" deve ser um número inteiro`);
        }
      }
    }
    // Mesma forma do shell: UM erro por campo, juntos por '; ', lançados como
    // `Error` cru (`helper-dados.ts`) — sem status e sem código.
    if (erros.length > 0) throw new Error(`Erros de validação: ${erros.join('; ')}`);
  }

  async criar(tabela: string, dados: Record<string, any>) {
    DadosFakeComValidadorDoShell.validar(tabela, dados);
    return super.criar(tabela, dados);
  }

  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    DadosFakeComValidadorDoShell.validar(tabela, patch);
    return super.atualizar(tabela, id, patch);
  }
}

test('reproduz o bug: duplicar um estudo com Apelo Comercial recém-anexado (scores nulos) não quebra mais', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo com apelo comercial pendente', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  // Estado real assim que um documento é anexado, antes de a IA gerar o
  // resultado (`backend/rotas/apelo-comercial.ts` § garantirApelo).
  dados.semear('apelo_comercial', {
    estudo_id: origId, resultado: null,
    score_localizacao: null, score_infraestrutura: null, score_vetor_crescimento: null,
    score_concorrencia: null, score_demanda: null, score_seguranca_juridica: null,
    score_geral: null,
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201,
      `duplicar deveria suceder mesmo com Apelo Comercial vazio, veio ${res.status}: ${JSON.stringify(corpo)}`);
    const novoId = Number(corpo.id);

    const apeloCopia = await dados.listar('apelo_comercial', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(apeloCopia.total, 1, 'a linha de apelo comercial deveria ter sido copiada');
    assert.equal(apeloCopia.dados[0].score_geral, undefined,
      'campo nulo vira ausente na cópia — não é reenviado ao criar()');
  });
});

test('reproduz o bug: duplicar um estudo Avançado com tipologia sem dormitorios/vagas não quebra mais', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo com tipologia incompleta', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  dados.semear('avancado_tipologias', {
    estudo_id: origId, nome: 'Studio', tipo_unidade: 'apartamento',
    area_privativa_m2: 32.5, area_privativa_aberta_m2: null,
    dormitorios: null, vagas: null, quantidade: 40, unidades_permutadas: 0,
    preco_m2: 9000, ordem: 0,
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201,
      `duplicar deveria suceder mesmo com tipologia incompleta, veio ${res.status}: ${JSON.stringify(corpo)}`);
  });
});

test('#634 controle: com só 3 linhas de custo (bem abaixo do antigo teto de 500), a duplicação sempre funcionou — prova que o teste acima mede o caso de BORDA, não qualquer duplicação', async () => {
  const dados = new DadosFake();
  const { origId } = semearEstudoComCustos(dados, 3);

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201);
    const novoId = Number(corpo.id);
    const custosCopia = await dados.listar('avancado_linhas_custo', {
      filtros: { estudo_id: novoId }, por_pagina: 100,
    });
    assert.equal(custosCopia.total, 3);
  });
});

// ── O defeito de verdade: `decimal` chega do Postgres como STRING ───────────
//
// Este é o caso que os quatro consertos anteriores nunca exerciram, porque o
// dublê antigo media `null`. `semear` aqui grava o que o `pg` de verdade
// devolve numa coluna `NUMERIC`: string. Sem `coagirNumericosOuLancar` em
// `montarCopiaEstudo`/`duplicarDadosAvancado`, a duplicação estoura no
// primeiro `criar`.
test('duplicar um estudo cujos decimais vêm do banco como STRING (o que o pg devolve) sucede', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo com decimais em string', uf: 'DF', status: 'rascunho', sequencia: 1,
    // Exatamente o shape de `GET /estudos/:id`: `decimal` string, `inteiro` número.
    ret_pct: '4.00',
    gabarito_maximo: '12.00',
    coef_aproveitamento_maximo: '3.00',
    custo_construcao_m2: '4800.00',
    permuta_fisica_pct: '18.00',
    num_unidades_residencial: 120,
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201,
      `duplicar deveria suceder com decimais em string, veio ${res.status}: ${JSON.stringify(corpo)}`);
    const novo = await dados.buscar('estudos', Number(corpo.id));
    // A cópia guarda NÚMERO, não a string — é o que o shell aceita gravar.
    assert.equal(novo!.ret_pct, 4, 'ret_pct deveria ter sido coagido para número');
    assert.equal(novo!.gabarito_maximo, 12, 'gabarito_maximo deveria ter sido coagido para número');
    assert.equal(novo!.custo_construcao_m2, 4800);
    assert.equal(novo!.permuta_fisica_pct, 18);
    assert.equal(novo!.num_unidades_residencial, 120, 'inteiro já vem número e passa intacto');
  });
});

// ── O BUG RELATADO, de ponta a ponta: "Salvar premissas" ───────────────────
//
// Vive neste arquivo por causa do harness (`DadosFake` + `criarApp` +
// `comServidor` montam `rotasEstudos` inteiro); o assunto é a mesma fiação.
//
// É a prova que faltava nas quatro correções anteriores: elas testavam
// `montarPatchEstudo` como função pura, com `null`. Aqui o payload é o que a
// tela realmente manda — o registro inteiro que o `GET` devolveu, com os
// `decimal` em string — e o dublê recusa como o shell recusa.
test('fiação: PATCH /estudos/:id com o registro inteiro (decimais em string) grava, não dá "deve ser um número"', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const estudoId = dados.semear('estudos', {
    id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    nome: 'INC - [teste] PU 2 Esquadra', uf: 'DF', status: 'em_analise', sequencia: 1,
    gabarito_maximo: '12.00', ret_pct: '4.00', coef_aproveitamento_maximo: '3.00',
    permuta_fisica_pct: '18.00', num_unidades_residencial: 120,
  });

  await comServidor(criarApp(dados), async (base) => {
    // O eco integral que `tela-premissas.ts` produzia: tudo que veio do GET.
    const corpoDoEco = {
      nome: 'INC - [teste] PU 2 Esquadra',
      gabarito_maximo: '12.00',
      ret_pct: '4.00',
      coef_aproveitamento_maximo: 3,     // este a tela coagia (tem controle)
      permuta_fisica_pct: 18,            // idem
      num_unidades_residencial: 120,
    };
    const res = await fetch(`${base}/estudos/${estudoId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpoDoEco),
    });
    const corpo = await res.json();
    assert.equal(res.status, 200,
      `Salvar premissas deveria gravar, veio ${res.status}: ${JSON.stringify(corpo)}`);

    const persistido = await dados.buscar('estudos', estudoId);
    assert.equal(persistido!.gabarito_maximo, 12, 'gabarito_maximo não foi gravado como número');
    assert.equal(persistido!.ret_pct, 4, 'ret_pct não foi gravado como número');
  });
});

test('fiação: valor sujo num campo numérico devolve 400 CAMPO_INVALIDO, não 500', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const estudoId = dados.semear('estudos', {
    id: 1, nivel_analise: 'preliminar', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo', uf: 'DF', status: 'em_analise', sequencia: 1,
  });
  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${estudoId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ret_pct: '0x10' }),
    });
    const corpo = await res.json();
    assert.equal(res.status, 400);
    assert.equal(corpo.codigo, 'CAMPO_INVALIDO');
    // E NÃO gravou 16.
    const persistido = await dados.buscar('estudos', estudoId);
    assert.equal(persistido!.ret_pct, undefined);
  });
});


// ── Fiação das TABELAS FILHAS com decimal em string ────────────────────────
//
// Achado da revisão do PR desta correção: dos 11 pontos onde a coerção foi
// ligada, só 2 ficavam vermelhos ao apagar a chamada — os testes acima semeiam
// as filhas com NÚMERO, e número é no-op da coerção. Este teste semeia a linha
// FILHA como o Postgres a devolve (decimal em STRING) e exercita os pontos de
// `estudo_imoveis`, do laço `FILHAS_SIMPLES` e dos sete `criar` de
// `duplicarDadosAvancado`.
test('fiação: duplicar copia FILHAS cujos decimais vêm do banco como string', async () => {
  const dados = new DadosFakeComValidadorDoShell();
  const origId = dados.semear('estudos', {
    id: 1, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao',
    nome: 'Estudo com filhas em string', uf: 'DF', status: 'rascunho', sequencia: 1,
  });
  // `estudo_imoveis` — `imovel_nucleo_id` é `inteiro`.
  dados.semear('estudo_imoveis', { estudo_id: origId, imovel_nucleo_id: 77, tipo_imovel: 'lote' });
  // `FILHAS_SIMPLES` → `analise_mercado`, com os indicadores em string.
  dados.semear('analise_mercado', {
    estudo_id: origId, abrangencia: 'cidade', localidade: 'Brasília',
    preco_medio_m2: '9500.00', custo_obra_m2: '4800.00', vso_pct: '12.50',
    ipca_pct: '4.20', selic_pct: '10.50', incc_pct: null,
  });
  // Avançado: tipologia, fase, alocação, linha de custo, cenário — decimais em
  // string, inteiros como número (é o que o `pg` devolve de cada tipo).
  const tipId = dados.semear('avancado_tipologias', {
    estudo_id: origId, nome: 'Studio', tipo_unidade: 'apartamento',
    area_privativa_m2: '32.50', area_privativa_aberta_m2: null,
    dormitorios: 1, vagas: 1, quantidade: 40, unidades_permutadas: 0,
    preco_m2: '9000.00', ordem: 0,
  });
  // ⚠️ `avancado_fases` NÃO tem coluna `decimal` (`absorcao`/`fluxo_pagamento`
  // são `json`), então a coerção é no-op ali — o teste não finge o contrário.
  const faseId = dados.semear('avancado_fases', {
    estudo_id: origId, tipo: 'lancamento', nome: 'Lançamento', ordem: 0,
    inicio_mes: 0, duracao_meses: 6, absorcao: null, fluxo_pagamento: null,
  });
  dados.semear('avancado_alocacoes', {
    estudo_id: origId, fase_id: faseId, tipologia_id: tipId,
    unidades: 20, preco_m2: '9100.00', ordem: 0,
  });
  dados.semear('avancado_cronograma', { estudo_id: origId, inicio_mes: 3, duracao_meses: 12 });
  dados.semear('avancado_linhas_custo', {
    estudo_id: origId, nome: 'Obra', orcamento_valor: '1250000.00',
    orcamento_valor_canonico: null, inicio_mes: 0, duracao_meses: 24, ordem: 0,
  });
  dados.semear('avancado_funding_operacoes', {
    estudo_id: origId, tipo: 'equity', nome: 'Aporte',
    valor: '5000000.00', taxa_anual: '18.00', ordem: 0,
  });
  dados.semear('avancado_cenarios', {
    estudo_id: origId, nome: 'Base', preco_venda_pct: '0.00',
    custo_obra_pct: '5.00', ordem: 0,
  });

  await comServidor(criarApp(dados), async (base) => {
    const res = await fetch(`${base}/estudos/${origId}/duplicar`, { method: 'POST' });
    const corpo = await res.json();
    assert.equal(res.status, 201,
      `duplicar deveria suceder com decimais de FILHA em string, veio ${res.status}: ${JSON.stringify(corpo)}`);
    const novoId = Number(corpo.id);

    const imoveis = await dados.listar('estudo_imoveis', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(imoveis.total, 1, 'estudo_imoveis não foi copiado');

    const mercado = await dados.listar('analise_mercado', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(mercado.dados[0].preco_medio_m2, 9500, 'analise_mercado: decimal não coagido');
    assert.equal(mercado.dados[0].vso_pct, 12.5);

    const tips = await dados.listar('avancado_tipologias', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(tips.dados[0].area_privativa_m2, 32.5, 'tipologia: decimal não coagido');

    const custos = await dados.listar('avancado_linhas_custo', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(custos.dados[0].orcamento_valor, 1250000, 'linha de custo: decimal não coagido');

    const funding = await dados.listar('avancado_funding_operacoes', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(funding.dados[0].valor, 5000000, 'funding: decimal não coagido');
    assert.equal(funding.dados[0].taxa_anual, 18);

    const alocs = await dados.listar('avancado_alocacoes', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(alocs.dados[0].preco_m2, 9100, 'alocação: decimal não coagido');

    const cens = await dados.listar('avancado_cenarios', { filtros: { estudo_id: novoId }, por_pagina: 10 });
    assert.equal(cens.dados[0].custo_obra_pct, 5, 'cenário: decimal não coagido');
  });
});
