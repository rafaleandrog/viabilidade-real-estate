import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coletaMercadoDiaria } from './rotinas.js';

// Contexto falso com a mesma superfície que a rotina usa do ContextoListener.
function ctxFake(opts: {
  regioes?: any[];
  params?: Record<string, string>;
  ia?: { itens: any[] } | null;
  semDados?: boolean;
} = {}) {
  const regioes = opts.regioes ?? [];
  const criados: any[] = [];
  const atualizados: any[] = [];
  let consultas = 0;
  const ctx: any = {
    dados: opts.semDados ? undefined : {
      async listar(tabela: string) {
        if (tabela === 'mercado_regioes') return { dados: regioes, total: regioes.length };
        return { dados: [], total: 0 };
      },
      async criar(tabela: string, dados: any) { criados.push({ tabela, dados }); return { id: 1, ...dados }; },
      async atualizar(tabela: string, id: number, dados: any) { atualizados.push({ tabela, id, dados }); return { id, ...dados }; },
    },
    parametros: { async obter(slug: string) { return opts.params?.[slug] ?? ''; } },
    ia: opts.ia === null ? null : {
      async consultar() {
        consultas++;
        return { dados: { itens: opts.ia?.itens ?? [] }, modelo: 'fake-barato', tokens_entrada: 1, tokens_saida: 1, duracao_ms: 1 };
      },
    },
  };
  return { ctx, criados, atualizados, consultas: () => consultas };
}

test('#200 rotina sem região ativa não faz nada e reporta ok', async () => {
  const { ctx, criados } = ctxFake({ regioes: [] });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, true);
  assert.equal((r.resultado as any).regioes, 0);
  assert.equal(criados.length, 0);
});

test('#200 SEM fonte externa a rotina NÃO chama a IA e não grava nada', async () => {
  // Este é o comportamento central: sem fonte, nada de perguntar à IA "o que
  // você sabe da região" — conteúdo de memória de modelo entraria no app com
  // cara de notícia apurada e alimentaria a viabilidade.
  const { ctx, criados, atualizados, consultas } = ctxFake({
    regioes: [{ id: 7, nome: 'Ceilândia', uf: 'DF', ativa: true }],
    params: {}, // sem mercado_busca_url
    ia: { itens: [{ titulo: 'Inventado', resumo: 'x', relevancia: 5 }] },
  });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, true);
  assert.equal(consultas(), 0, 'a IA não pode ser consultada sem fonte externa');
  assert.equal(criados.length, 0, 'nenhum item pode ser gravado');
  assert.equal(atualizados[0].dados.ultima_coleta_status, 'sem_fonte_externa');
  assert.match(String((r.resultado as any).resumo), /Sem fonte de busca configurada/);
});

test('#200 região sem nome é registrada como erro, sem derrubar a rotina', async () => {
  const { ctx, atualizados } = ctxFake({
    regioes: [{ id: 1, nome: '', uf: 'DF', ativa: true }],
    params: { mercado_busca_url: 'https://exemplo.test/buscar' },
  });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, true);
  assert.equal(atualizados[0].dados.ultima_coleta_status, 'erro');
});

test('#200 sem IA disponível a rotina degrada, não quebra', async () => {
  const { ctx, atualizados } = ctxFake({
    regioes: [{ id: 1, nome: 'Águas Claras', uf: 'DF', ativa: true }],
    params: { mercado_busca_url: 'https://exemplo.test/buscar' },
    ia: null,
  });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, true);
  assert.equal(atualizados[0].dados.ultima_coleta_status, 'sem_ia');
});

test('#200 sem persistência a rotina falha explicitamente', async () => {
  const { ctx } = ctxFake({ semDados: true });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, false);
  assert.ok(r.erro);
});

test('#200 uma região quebrada não impede as outras de serem processadas', async () => {
  const { ctx, atualizados } = ctxFake({
    regioes: [
      { id: 1, nome: '', uf: 'DF', ativa: true },          // erro
      { id: 2, nome: 'Noroeste', uf: 'DF', ativa: true },  // sem fonte
    ],
    params: {},
  });
  const r = await coletaMercadoDiaria(ctx);
  assert.equal(r.ok, true);
  assert.equal(atualizados.length, 2, 'as duas regiões precisam ter status gravado');
  assert.equal((r.resultado as any).regioes, 2);
});
