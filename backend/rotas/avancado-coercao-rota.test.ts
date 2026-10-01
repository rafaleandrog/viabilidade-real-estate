import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasAvancado } from './avancado.js';
import { rotasFunding } from './funding.js';

// Coerção numérica na fronteira de escrita das rotas `/avancado/*` — prova de
// FIAÇÃO de ponta a ponta. O shell recusa string em coluna numérica, e sem a
// coerção a recusa do CLIENTE voltava como `500 ERRO_INTERNO`. A função pura
// (`coagirNumericosDeclarados`) já tem teste próprio; o que se prova aqui é que
// cada rota a CHAMA. Um Express real, com `DadosFake` que reproduz a regra do
// shell (`typeof valor !== 'number'` → lança), para que a ausência da chamada
// apareça como 500 e não passe calada.

const COLUNAS_NUMERICAS: Record<string, string[]> = {
  avancado_tipologias: ['area_privativa_m2', 'area_privativa_aberta_m2', 'dormitorios', 'vagas', 'quantidade', 'preco_m2', 'ordem'],
  avancado_linhas_custo: ['orcamento_valor', 'orcamento_valor_canonico', 'inicio_mes', 'duracao_meses', 'ordem', 'permuta_quantidade'],
  avancado_funding_operacoes: ['valor', 'taxa_anual', 'inicio_mes', 'ordem'],
  avancado_cenarios: ['preco_venda_pct', 'custo_obra_pct', 'ordem'],
};

class DadosFake {
  private tabelas = new Map<string, Map<number, any>>();
  private proximoId = 1000;

  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }

  /** O que o shell faz antes de qualquer SQL: recusa o que não é `number`. */
  private validar(tabela: string, dados: Record<string, any>) {
    const erros: string[] = [];
    for (const c of COLUNAS_NUMERICAS[tabela] ?? []) {
      const v = dados[c];
      if (v === null || v === undefined) continue;
      if (typeof v !== 'number') erros.push(`Campo "${c}" deve ser um número`);
    }
    if (erros.length) throw new Error(`Erros de validação: ${erros.join('; ')}`);
  }

  total(tabela: string) { return this.tabelas.get(tabela)?.size ?? 0; }
  async buscar(tabela: string, id: number) { return this.tabelas.get(tabela)?.get(Number(id)) ?? null; }

  async listar(tabela: string, opts: { filtros?: Record<string, any>; pagina?: number; por_pagina?: number } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const filtros = opts.filtros ?? {};
    const linhas = todas.filter((l) => Object.entries(filtros).every(([k, v]) => l[k] === v));
    const pagina = opts.pagina ?? 1;
    const porPagina = opts.por_pagina ?? 20;
    const ini = (pagina - 1) * porPagina;
    return { dados: linhas.slice(ini, ini + porPagina), total: linhas.length };
  }

  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    return (await this.listar(tabela, { ...opts, por_pagina: 100000 })).dados;
  }

  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    this.validar(tabela, patch);
    const atual = this.tabelas.get(tabela)?.get(Number(id));
    if (!atual) throw new Error(`DadosFake: ${tabela}#${id} não existe`);
    const novo = { ...atual, ...patch };
    this.tabelas.get(tabela)!.set(Number(id), novo);
    return novo;
  }

  async criar(tabela: string, dados: Record<string, any>) {
    this.validar(tabela, dados);
    return this.buscar(tabela, this.semear(tabela, dados));
  }
}

function criarApp(dados: DadosFake) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'admin', usuario: { id: 1 } };
    next();
  });
  app.use(rotasAvancado);
  app.use(rotasFunding);
  return app;
}

async function comServidor(app: ReturnType<typeof express>, fn: (base: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => { server.once('listening', () => resolve()); server.once('error', reject); });
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function enviar(base: string, metodo: 'POST' | 'PATCH', caminho: string, corpo: unknown) {
  const res = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json() as any };
}

interface Familia {
  nome: string;
  tabela: string;
  caminho: string;
  /** Corpo mínimo válido para o POST; `campo` entra por cima. */
  base: Record<string, any>;
  /** Campos numéricos exercitados — `inteiro` só aceita inteiros. */
  campos: { campo: string; inteiro: boolean }[];
  /** Linha semeada para o PATCH. */
  semente: Record<string, any>;
}

const FAMILIAS: Familia[] = [
  {
    nome: 'tipologias', tabela: 'avancado_tipologias', caminho: '/estudos/1/avancado/tipologias',
    base: { nome: 'T', quantidade: 1 },
    campos: [{ campo: 'area_privativa_m2', inteiro: false }, { campo: 'quantidade', inteiro: true }, { campo: 'preco_m2', inteiro: false }],
    semente: { estudo_id: 1, nome: 'T', tipo_unidade: 'apartamento', quantidade: 5, preco_m2: 10, area_privativa_m2: 50, ordem: 0 },
  },
  {
    nome: 'custos', tabela: 'avancado_linhas_custo', caminho: '/estudos/1/avancado/custos',
    base: { grupo: 'obra', categoria: 'Gestão da obra', orcamento_unidade: 'rs' },
    campos: [{ campo: 'orcamento_valor', inteiro: false }, { campo: 'inicio_mes', inteiro: true }],
    semente: {
      estudo_id: 1, grupo: 'obra', categoria: 'Gestão da obra', subcategoria: null, orcamento_valor: 1, orcamento_valor_canonico: null,
      orcamento_unidade: 'rs', cronograma_evento: 'customizado', fase_ancora_id: null, inicio_mes: 0, duracao_meses: 1, ordem: 0,
      distribuicao_modo: 'fixo', permuta_tipologia_id: null, permuta_quantidade: 0,
    },
  },
  {
    nome: 'funding', tabela: 'avancado_funding_operacoes', caminho: '/estudos/1/avancado/funding',
    base: { tipo: 'divida', nome: 'D' },
    campos: [{ campo: 'taxa_anual', inteiro: false }, { campo: 'valor', inteiro: false }],
    semente: { estudo_id: 1, tipo: 'divida', nome: 'D', valor: 1, taxa_anual: 1, ordem: 0 },
  },
  {
    nome: 'cenarios', tabela: 'avancado_cenarios', caminho: '/estudos/1/avancado/cenarios',
    base: { nome: 'C' },
    campos: [{ campo: 'preco_venda_pct', inteiro: false }, { campo: 'ordem', inteiro: true }],
    semente: { estudo_id: 1, nome: 'C', preco_venda_pct: 0, custo_obra_pct: 0, ordem: 0 },
  },
];

const INVALIDOS = ['abc', '12,5', '1e3', '0x10', ''];

function novoCenario(f: Familia) {
  const dados = new DadosFake();
  dados.semear('estudos', { id: 1, nivel_analise: 'avancado', status: 'em_analise', tipo_empreendimento: 'incorporacao' });
  const id = dados.semear(f.tabela, f.semente);
  return { dados, id };
}

for (const f of FAMILIAS) {
  for (const { campo, inteiro } of f.campos) {
    test(`coerção /avancado/${f.nome}: POST e PATCH de ${campo} — inválidos viram 400 CAMPO_INVALIDO`, async () => {
      for (const invalido of INVALIDOS) {
        const { dados, id } = novoCenario(f);
        const antes = dados.total(f.tabela);
        await comServidor(criarApp(dados), async (base) => {
          const post = await enviar(base, 'POST', f.caminho, { ...f.base, [campo]: invalido });
          assert.equal(post.status, 400, `POST ${campo}=${JSON.stringify(invalido)} → ${JSON.stringify(post.corpo)}`);
          assert.equal(post.corpo.codigo, 'CAMPO_INVALIDO');
          assert.match(post.corpo.mensagem, new RegExp(`"${campo}"`));
          assert.equal(dados.total(f.tabela), antes, 'POST recusado não pode gravar');

          const patch = await enviar(base, 'PATCH', `${f.caminho}/${id}`, { [campo]: invalido });
          assert.equal(patch.status, 400, `PATCH ${campo}=${JSON.stringify(invalido)} → ${JSON.stringify(patch.corpo)}`);
          // `quantidade` de tipologia tem contrato próprio e anterior: o que nem
          // é número sai como `QUANTIDADE_INVALIDA` (400) antes da coerção.
          const esperados = f.tabela === 'avancado_tipologias' && campo === 'quantidade'
            ? ['CAMPO_INVALIDO', 'QUANTIDADE_INVALIDA'] : ['CAMPO_INVALIDO'];
          assert.ok(esperados.includes(patch.corpo.codigo), `código ${patch.corpo.codigo}`);
          assert.equal((await dados.buscar(f.tabela, id))[campo], f.semente[campo], 'PATCH recusado não pode gravar');
        });
      }
      if (inteiro) {
        const { dados, id } = novoCenario(f);
        await comServidor(criarApp(dados), async (base) => {
          const patch = await enviar(base, 'PATCH', `${f.caminho}/${id}`, { [campo]: '2.5' });
          assert.equal(patch.status, 400);
          assert.equal(patch.corpo.codigo, 'CAMPO_INVALIDO');
        });
      }
    });

    test(`coerção /avancado/${f.nome}: POST e PATCH de ${campo} — número e string decimal estrita são gravados como número`, async () => {
      for (const valido of [inteiro ? 3 : 12.5, inteiro ? '3' : '12.5']) {
        const esperado = Number(valido);
        const { dados, id } = novoCenario(f);
        await comServidor(criarApp(dados), async (base) => {
          const post = await enviar(base, 'POST', f.caminho, { ...f.base, [campo]: valido });
          assert.equal(post.status, 201, `POST ${campo}=${JSON.stringify(valido)} → ${JSON.stringify(post.corpo)}`);
          assert.equal(post.corpo[campo], esperado);
          assert.equal(typeof post.corpo[campo], 'number');

          const patch = await enviar(base, 'PATCH', `${f.caminho}/${id}`, { [campo]: valido });
          assert.equal(patch.status, 200, `PATCH ${campo}=${JSON.stringify(valido)} → ${JSON.stringify(patch.corpo)}`);
          assert.equal((await dados.buscar(f.tabela, id))[campo], esperado);
        });
      }
    });
  }
}

test('coerção /avancado: vários campos inválidos na mesma escrita são nomeados juntos', async () => {
  const f = FAMILIAS[0];
  const { dados } = novoCenario(f);
  await comServidor(criarApp(dados), async (base) => {
    const r = await enviar(base, 'POST', f.caminho, { ...f.base, area_privativa_m2: 'abc', preco_m2: '12,5' });
    assert.equal(r.status, 400);
    assert.match(r.corpo.mensagem, /"area_privativa_m2"/);
    assert.match(r.corpo.mensagem, /"preco_m2"/);
  });
});

test('coerção /avancado: `null` em coluna opcional continua passando (limpar um valor é escrita legítima)', async () => {
  const f = FAMILIAS[1];
  const { dados, id } = novoCenario(f);
  await comServidor(criarApp(dados), async (base) => {
    const r = await enviar(base, 'PATCH', `${f.caminho}/${id}`, { orcamento_valor_canonico: null });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
  });
});
