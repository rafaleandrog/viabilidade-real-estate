import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { rotasApelo } from './apelo-comercial.js';
import { FATORES } from '../apelo-comercial.js';

// #862 — PROVA DE FIAÇÃO do `POST /estudos/:id/apelo-comercial`, por HTTP contra
// um Express real, com a IA fake. As funções puras (`normalizarRespostaApelo`,
// `contarNotasValidas`) são testadas em `backend/apelo-comercial.test.ts`; este
// arquivo prova que o HANDLER as usa: que uma resposta identificada só pelo nome
// vira notas gravadas (apagar a normalização deixa isto vermelho), que a resposta
// bruta é gravada em `resultado.bruto`, e que uma resposta sem nota nenhuma
// responde 422 `IA_SEM_NOTAS` sem tocar no resultado anterior e sem evento.

class DadosFake {
  tabelas = new Map<string, Map<number, any>>();
  atualizacoes: { tabela: string; id: number; patch: Record<string, any> }[] = [];
  private proximoId = 1000;
  semear(tabela: string, linha: Record<string, any>): number {
    if (!this.tabelas.has(tabela)) this.tabelas.set(tabela, new Map());
    const id = linha.id ?? this.proximoId++;
    this.tabelas.get(tabela)!.set(id, { ...linha, id });
    return id;
  }
  async buscar(tabela: string, id: number) { return this.tabelas.get(tabela)?.get(Number(id)) ?? null; }
  async listar(tabela: string, opts: { filtros?: Record<string, any>; pagina?: number; por_pagina?: number } = {}) {
    const todas = [...(this.tabelas.get(tabela)?.values() ?? [])];
    const linhas = todas.filter((l) => Object.entries(opts.filtros ?? {}).every(([k, v]) => l[k] === v));
    const pp = opts.por_pagina ?? 20; const ini = ((opts.pagina ?? 1) - 1) * pp;
    return { dados: linhas.slice(ini, ini + pp), total: linhas.length };
  }
  async varrerTudo(tabela: string, opts: { filtros?: Record<string, any> } = {}) {
    return (await this.listar(tabela, { ...opts, por_pagina: 100000 })).dados;
  }
  async atualizar(tabela: string, id: number, patch: Record<string, any>) {
    this.atualizacoes.push({ tabela, id: Number(id), patch });
    const t = this.tabelas.get(tabela)!; const a = { ...t.get(Number(id)), ...patch }; t.set(Number(id), a); return a;
  }
  async criar(tabela: string, dados: Record<string, any>) { return this.buscar(tabela, this.semear(tabela, dados)); }
  async deletar(tabela: string, id: number) { this.tabelas.get(tabela)?.delete(Number(id)); }
}

const EDITOR = 26;

function cenario() {
  const dados = new DadosFake();
  const estudoId = dados.semear('estudos', {
    status: 'rascunho', nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao', nome: 'e', uf: 'DF',
  });
  dados.semear('estudo_membros', { estudo_id: estudoId, usuario_id: EDITOR, funcao: 'editor' });
  const apeloId = dados.semear('apelo_comercial', {
    estudo_id: estudoId, score_geral: 3.5, resultado: { anterior: true },
  });
  dados.semear('apelo_comercial_documentos', {
    apelo_id: apeloId, texto_adicional: 'Área central de Brasília, próxima ao metrô.', tipo_dado: 'descricao',
  });
  return { dados, estudoId, apeloId };
}

async function analisar(dados: DadosFake, estudoId: number, respostaIa: unknown) {
  const eventos: { tipo: string; payload: any }[] = [];
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.dados = dados;
    req.contexto = { nivelApp: 'escrita', usuario: { id: EDITOR, nome: 'Editor' } };
    req.eventos = {
      publicar: async (tipo: string, payload: any) => { eventos.push({ tipo, payload }); },
      inscreverUsuario: async () => {}, cancelarInscricao: async () => {},
    };
    req.ia = {
      consultar: async () => ({ dados: respostaIa }),
      extrairConteudo: async () => ({ conteudo: '' }),
    };
    next();
  });
  app.use(rotasApelo);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/estudos/${estudoId}/apelo-comercial`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    return { status: r.status, j: await r.json(), eventos };
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
}

/** A resposta que a reprodução da Pinguim sugere: fatores pelo NOME, sem a chave canônica. */
function respostaPorNome() {
  return {
    fatores: FATORES.map((def, i) => ({
      chave: def.nome,
      nome: def.nome,
      perguntas: def.perguntas.map((p) => ({ pergunta: p, nota: i === 0 ? 5 : 4, justificativa: 'evidência' })),
      nota_consolidada: null,
      justificativa_geral: `geral ${def.nome}`,
    })),
    relatorio: { vantagens: ['v'], desvantagens: [], ganhos: ['metrô'], riscos: ['r'] },
  };
}

test('#862 fiação: resposta com fatores pelo nome é normalizada, gravada com o bruto, e publica o score real', async () => {
  const { dados, estudoId, apeloId } = cenario();
  const bruto = respostaPorNome();
  const { status, j, eventos } = await analisar(dados, estudoId, bruto);
  assert.equal(status, 200, JSON.stringify(j));

  const gravado = await dados.buscar('apelo_comercial', apeloId);
  assert.equal(gravado.score_localizacao, 5);
  assert.equal(gravado.score_infraestrutura, 4);
  // 4 notas 5 + 20 notas 4 = 100 / 24 = 4,1666… → 4,2
  assert.equal(gravado.score_geral, 4.2);
  assert.deepEqual(gravado.resultado.fatores.map((f: any) => f.chave), FATORES.map((f) => f.chave));
  assert.equal(gravado.resultado.fatores[1].justificativa_geral, 'geral Infraestrutura no Entorno');
  // a resposta da IA, como veio, para comparar bruto × normalizado no banco
  assert.deepEqual(gravado.resultado.bruto, bruto);

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].tipo, 'apelo_comercial_concluido');
  assert.equal(eventos[0].payload.score_geral, 4.2);
});

test('#862 fiação: nenhuma nota utilizável → 422 IA_SEM_NOTAS, resultado anterior intacto, nenhum evento', async () => {
  for (const respostaIa of [
    {},
    { fatores: [], relatorio: { ganhos: ['texto cheio, notas vazias'] } },
    {
      fatores: FATORES.map((def) => ({
        chave: def.chave, nome: def.nome,
        perguntas: def.perguntas.map((p) => ({ pergunta: p, nota: null, justificativa: '' })),
        nota_consolidada: null, justificativa_geral: '',
      })),
      relatorio: { ganhos: ['g'] },
    },
  ]) {
    const { dados, estudoId, apeloId } = cenario();
    const { status, j, eventos } = await analisar(dados, estudoId, respostaIa);
    assert.equal(status, 422, JSON.stringify(j));
    assert.equal(j.codigo, 'IA_SEM_NOTAS');
    assert.equal(dados.atualizacoes.length, 0, 'o handler sobrescreveu o resultado anterior');
    const intacto = await dados.buscar('apelo_comercial', apeloId);
    assert.equal(intacto.score_geral, 3.5);
    assert.deepEqual(intacto.resultado, { anterior: true });
    assert.equal(eventos.length, 0, 'publicou apelo_comercial_concluido sem nota');
  }
});
