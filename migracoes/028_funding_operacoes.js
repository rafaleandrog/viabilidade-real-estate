// 028_funding_operacoes.js — item 48 da planilha (Rodada 7, #355)
//
// A tela de Funding foi reescrita do zero segundo `fluxo_investidor_FORMULAS`
// (transcrita em docs/viabilidade/fluxo-investidor-formulas.md). O modelo de 4
// instrumentos com waterfall (`avancado_capital_instrumentos`, migração 019) dá
// lugar a 3 operações independentes em `avancado_funding_operacoes`:
// Financiamento à produção (único por estudo), Dívida e Equity.
//
// ── O que esta migração carrega, e o que ela deliberadamente NÃO inventa ──
//
// A `019` nunca rodou em Postgres (ver CLAUDE.md § Pendências do autor), então
// na prática esta migração é inócua em toda instalação existente. Ela existe
// para o caso de não ser — e aí a regra é não fabricar número:
//
//  · DÍVIDA (`financiamento_producao`, `capital_giro`) converte SEM PERDA: os
//    dois modelos têm exatamente os mesmos parâmetros (valor, taxa anual,
//    carência, prazo de amortização). `capital_giro` vira `divida`.
//    `politicaAmortizacao` some — o modelo novo tem só Price com carência, que
//    é o que a planilha especifica; camadas `cash_sweep`/`bullet` viram Price
//    com o mesmo prazo, e é isso que o rótulo `[revisar]` sinaliza.
//
//  · EQUITY (`preferred_equity`, `sponsor_equity`) NÃO converte a remuneração.
//    O modelo antigo tinha 4 modos (A: taxa acumulada; B: % do residual num
//    evento; C: % da receita líquida; D: % do lucro parcelado). Só o C tem
//    equivalente exato (`permuta_financeira`); A e D não têm nenhum, e
//    converter produziria retorno inventado. Então o valor do aporte e o mês
//    são carregados, `pct_retorno` fica em 0 (operação inerte: aporta e não
//    remunera) e o nome ganha o prefixo `[revisar]` para o usuário completar.
//    Perder o aporte seria pior que carregá-lo inerte; adivinhar a remuneração
//    seria pior que as duas.
//
// A tabela antiga NÃO é apagada (a camada de dados das migrações só tem
// listar/atualizar/criar — não há DDL, e remoção física de tabela já era issue
// separada por funding-capital-stack.md §13.4). Ela some do app: nada mais a
// lê depois desta issue, exceto esta migração.
//
// Idempotente: pula o estudo que já tem qualquer linha em
// `avancado_funding_operacoes`. Forward-only.

const n = (v) => Number(v) || 0;

/** Modo A/B/C/D do Preferred Equity → modo de retorno do Equity novo. */
function modoRetornoDe(config) {
  // Só o modo C (% da receita líquida) mapeia 1:1 na permuta financeira.
  return config?.modo === 'C' ? 'permuta_financeira' : 'resultado_final';
}

/** % de retorno que dá para carregar sem inventar — só o modo C tem um. */
function pctRetornoDe(config) {
  if (config?.modo !== 'C') return 0;
  // Config guarda fração (0-1); a coluna guarda percentual.
  return n(config.percentualReceitaLiquida) * 100;
}

/** Mês do primeiro aporte/liberação programado, se houver. */
function primeiroMes(lista) {
  const meses = (Array.isArray(lista) ? lista : [])
    .map((a) => n(a?.mes))
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
  return meses.length > 0 ? meses[0] : 0;
}

export default async function ({ dados }) {
  const { dados: instrumentos } = await dados.listar('avancado_capital_instrumentos', { por_pagina: 100000 });
  if (instrumentos.length === 0) return; // caminho real de toda instalação hoje

  const { dados: jaExistem } = await dados.listar('avancado_funding_operacoes', { por_pagina: 100000 });
  const estudosComOperacao = new Set(jaExistem.map((o) => String(o.estudo_id)));

  // Financiamento à produção é único por estudo no modelo novo: se o antigo
  // tiver mais de um, o primeiro (por ordem, depois id) fica com o tipo e os
  // demais viram Dívida — em vez de a migração escolher calada quem sobrevive.
  const ordenados = [...instrumentos].sort((a, b) =>
    (n(a.ordem) - n(b.ordem)) || (n(a.id) - n(b.id)));
  const jaTemFinanciamento = new Set();

  for (const inst of ordenados) {
    if (estudosComOperacao.has(String(inst.estudo_id))) continue;

    const cfg = inst.config ?? {};
    const eDivida = inst.tipo === 'financiamento_producao' || inst.tipo === 'capital_giro';

    let tipo;
    if (inst.tipo === 'financiamento_producao' && !jaTemFinanciamento.has(String(inst.estudo_id))) {
      tipo = 'financiamento_producao';
      jaTemFinanciamento.add(String(inst.estudo_id));
    } else if (eDivida) {
      tipo = 'divida';
    } else {
      tipo = 'equity';
    }

    const liberacoes = eDivida ? cfg.liberacaoProgramada : (cfg.aportes ?? cfg.aportesProgramados);
    const mes = primeiroMes(liberacoes);

    // `[revisar]` marca o que o usuário precisa completar: política de
    // amortização que não existe mais, ou remuneração que não foi convertida.
    const precisaRevisao = eDivida
      ? (cfg.politicaAmortizacao && cfg.politicaAmortizacao !== 'price')
      : true;

    const base = {
      estudo_id: inst.estudo_id,
      tipo,
      nome: precisaRevisao ? `[revisar] ${inst.nome}` : inst.nome,
      ordem: n(inst.ordem),
      valor: n(inst.compromisso),
      cronograma_evento: 'customizado',
      inicio_mes: mes,
    };

    if (eDivida) {
      await dados.criar('avancado_funding_operacoes', {
        ...base,
        distribuir_aporte: Array.isArray(cfg.liberacaoProgramada) && cfg.liberacaoProgramada.length > 1,
        aporte_meses: Math.max(1, (cfg.liberacaoProgramada ?? []).length || 1),
        taxa_anual: n(cfg.taxaAnual) * 100,
        periodo_amortizacao_meses: n(cfg.prazoMeses),
        periodo_carencia_meses: n(cfg.carenciaMeses),
      });
    } else {
      await dados.criar('avancado_funding_operacoes', {
        ...base,
        modo_retorno: modoRetornoDe(cfg),
        pct_retorno: pctRetornoDe(cfg),
      });
    }
  }
}
