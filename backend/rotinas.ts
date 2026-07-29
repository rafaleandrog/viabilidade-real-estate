import type { ContextoListener, ResultadoRotinaApp } from '@urbiverso/sdk';
import {
  SCHEMA_TRIAGEM, instrucoesSistemaTriagem, termosBusca, normalizarItemColeta,
} from './mercado-ia.js';

// ─────────────────────────────────────────────────────────────────────────
// ROTINAS agendadas da app (framework de agenda do UrbiVerso).
//
// Declaradas em `manifesto.json` → `rotinas.coleta_mercado_diaria`
// (`frequencia: "diaria"`) e exportadas de `backend/rotas.ts` como
// `export const rotinas`. O shell chama o handler uma vez por dia; a app não
// agenda nada por conta própria nem guarda cron.
//
// O que a rotina faz, por região ATIVA em `mercado_regioes`:
//   1. monta os termos de busca (nome + UF + palavras-chave do usuário);
//   2. busca na FONTE EXTERNA configurada em `parametros`
//      (`mercado_busca_url` + `mercado_busca_chave`);
//   3. manda o resultado bruto para a IA no slot **`barato`** — é triagem em
//      volume, não raciocínio caro — que classifica, resume e pontua
//      relevância pelos 6 eixos do Apelo Comercial;
//   4. grava os itens em `mercado_coletas` e o status da execução na região.
//
// DEGRADAÇÃO EXPLÍCITA, e este é o ponto mais importante: o framework de IA do
// UrbiVerso (`ia.consultar`) recebe texto e devolve JSON — ele NÃO navega na
// web. Sem fonte externa configurada a rotina NÃO pergunta à IA "o que você
// sabe sobre a região": ela registra `sem_fonte_externa` e não grava item
// nenhum. Conteúdo vindo da memória do modelo entraria no app com cara de
// notícia apurada e alimentaria a análise de viabilidade — é a mesma classe de
// risco que a #200 chama de central ("um preço inventado vira decisão de
// investimento"), e por isso não existe esse caminho no código.
// ─────────────────────────────────────────────────────────────────────────

const MAX_TERMOS_POR_REGIAO = 4;
const TIMEOUT_BUSCA_MS = 15_000;

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lê um parâmetro da app. Devolve '' quando o parâmetro não existe ou o helper
 * não está disponível — nunca lança.
 *
 * ⚠️ `mercado_busca_url` e `mercado_busca_chave` foram REMOVIDOS do manifesto
 * (2026-07-29): o pacote `0.1.12` foi reprovado na validação do shell e o
 * suspeito nº 1 era o `"tipo": "texto"` em `parametros` — todos os parâmetros
 * pré-existentes da app são `"numero"`, e o `Manifesto` do SDK sequer declara
 * `parametros`, então não havia como confirmar o vocabulário aceito.
 *
 * Consequência enquanto isso não é resolvido: `buscarExterno` nunca recebe URL,
 * a coleta diária roda em `sem_fonte_externa` e **não grava nada** — que é o
 * modo já testado e seguro (nada é inventado). As chamadas abaixo continuam
 * aqui de propósito: no dia em que o tipo certo for confirmado, basta redeclarar
 * os dois parâmetros no manifesto e a coleta volta a buscar, sem tocar em código.
 */
async function param(ctx: ContextoListener, slug: string): Promise<string> {
  try {
    const v = await ctx.parametros?.obter(slug);
    return v === null || v === undefined ? '' : String(v);
  } catch {
    return '';
  }
}

/**
 * Busca na fonte externa configurada. Devolve o texto bruto da resposta (a
 * triagem pela IA é que dá sentido a ele) ou `null` quando não há fonte.
 *
 * Deliberadamente agnóstico de provedor: qualquer endpoint que aceite `?q=` e
 * devolva texto/JSON serve. A app não embute nenhum provedor — a instância
 * escolhe, e a chave nunca é lida pelo frontend.
 */
async function buscarExterno(url: string, chave: string, termo: string): Promise<string | null> {
  if (!url) return null;
  const alvo = `${url}${url.includes('?') ? '&' : '?'}q=${encodeURIComponent(termo)}`;
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TIMEOUT_BUSCA_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json, text/plain;q=0.9' };
    if (chave) headers.Authorization = `Bearer ${chave}`;
    const r = await fetch(alvo, { headers, signal: controle.signal });
    if (!r.ok) return null;
    const texto = await r.text();
    // Corta respostas gigantes: a triagem roda no slot barato e não precisa do
    // HTML inteiro de um portal para extrair título/resumo/fonte.
    return texto.slice(0, 20_000);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Coleta de UMA região. Isolada para que uma região quebrada não derrube as outras. */
async function coletarRegiao(
  ctx: ContextoListener,
  regiao: any,
  cfg: { url: string; chave: string; max: number },
): Promise<{ status: string; itens: number; msg: string }> {
  const termos = termosBusca(regiao).slice(0, MAX_TERMOS_POR_REGIAO);
  if (termos.length === 0) return { status: 'erro', itens: 0, msg: 'Região sem nome' };
  if (!cfg.url) {
    return {
      status: 'sem_fonte_externa', itens: 0,
      msg: 'Sem fonte de busca configurada (parâmetro mercado_busca_url). Nada foi coletado.',
    };
  }
  if (!ctx.ia) return { status: 'sem_ia', itens: 0, msg: 'Framework de IA indisponível nesta instância' };

  const brutos: string[] = [];
  for (const termo of termos) {
    const texto = await buscarExterno(cfg.url, cfg.chave, termo);
    if (texto) brutos.push(`### Busca: ${termo}\n${texto}`);
  }
  if (brutos.length === 0) {
    return { status: 'erro', itens: 0, msg: 'A fonte externa não respondeu para nenhum termo' };
  }

  // Slot 'barato': triagem de volume, roda todo dia para toda região.
  const resposta = await ctx.ia.consultar({
    contexto: `Região: ${regiao.nome}${regiao.uf ? `/${regiao.uf}` : ''}\n\n${brutos.join('\n\n')}`,
    schema: SCHEMA_TRIAGEM,
    instrucoes_sistema: instrucoesSistemaTriagem(),
    slot: 'barato',
  });

  const itensBrutos = Array.isArray(resposta?.dados?.itens) ? resposta.dados.itens : [];
  const itens = itensBrutos
    .map(normalizarItemColeta)
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, cfg.max);

  const data = hoje();
  for (const item of itens) {
    await ctx.dados!.criar('mercado_coletas', {
      regiao_id: regiao.id,
      data_coleta: data,
      tipo: item.tipo,
      titulo: item.titulo,
      resumo: item.resumo,
      url: item.url,
      fonte: item.fonte,
      publicado_em: item.publicado_em,
      relevancia: item.relevancia,
      bruto: { modelo: resposta.modelo },
    });
  }
  return {
    status: 'ok', itens: itens.length,
    msg: itens.length === 0 ? 'Busca respondeu, mas nada relevante foi encontrado' : '',
  };
}

/** Handler da rotina diária (`HandlerRotinaApp`). */
export async function coletaMercadoDiaria(ctx: ContextoListener): Promise<ResultadoRotinaApp> {
  try {
    if (!ctx.dados) return { ok: false, erro: 'Persistência indisponível' };

    const r = await ctx.dados.listar('mercado_regioes', { filtros: { ativa: true }, por_pagina: 200 });
    const regioes = r.dados ?? [];
    if (regioes.length === 0) {
      return { ok: true, resultado: { resumo: 'Nenhuma região monitorada ativa', regioes: 0 } };
    }

    const cfg = {
      url: (await param(ctx, 'mercado_busca_url')).trim(),
      chave: (await param(ctx, 'mercado_busca_chave')).trim(),
      max: Math.max(1, Math.round(Number(await param(ctx, 'mercado_busca_max_itens')) || 10)),
    };

    let totalItens = 0;
    const porStatus: Record<string, number> = {};
    for (const regiao of regioes) {
      let res: { status: string; itens: number; msg: string };
      try {
        res = await coletarRegiao(ctx, regiao, cfg);
      } catch (e: any) {
        // Uma região que explode não pode impedir as outras de coletar.
        res = { status: 'erro', itens: 0, msg: String(e?.message ?? e).slice(0, 300) };
      }
      totalItens += res.itens;
      porStatus[res.status] = (porStatus[res.status] ?? 0) + 1;
      await ctx.dados.atualizar('mercado_regioes', regiao.id, {
        ultima_coleta_em: new Date().toISOString(),
        ultima_coleta_status: res.status,
        ultima_coleta_itens: res.itens,
        ultima_coleta_msg: res.msg,
      });
    }

    const semFonte = porStatus['sem_fonte_externa'] ?? 0;
    const resumo = semFonte === regioes.length
      ? `Sem fonte de busca configurada — ${regioes.length} região(ões) não coletadas`
      : `${totalItens} item(ns) coletado(s) em ${regioes.length} região(ões)`;
    return { ok: true, resultado: { resumo, regioes: regioes.length, itens: totalItens, status: porStatus } };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message ?? e) };
  }
}

/** Mapa exportado pelo entrypoint do backend (`export const rotinas`). */
export const rotinas = {
  coleta_mercado_diaria: coletaMercadoDiaria,
};
