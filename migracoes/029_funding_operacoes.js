// 029_funding_operacoes.js — item 48 da planilha (Rodada 7, #355)
//
// A tela de Funding foi reescrita do zero segundo `fluxo_investidor_FORMULAS`
// (transcrita em docs/viabilidade/fluxo-investidor-formulas.md). O modelo de 4
// instrumentos com waterfall (`avancado_capital_instrumentos`, migração 019)
// dá lugar a 3 operações independentes em `avancado_funding_operacoes`:
// Financiamento à produção (único por estudo), Dívida e Equity.
//
// ── Financiamento à produção NÃO perde o catch-up retroativo ──
//
// A reescrita original (planilha `fluxo_investidor_FORMULAS`) modelava
// Financiamento à produção com a MESMA matemática de calendário da Dívida —
// aporte num mês, amortização Price após carência. Decisão do autor
// (2026-08-12): **isso reverteria o modelo aprovado da #405** (planilha
// `Incorp Individual`: gatilho de exposição mínima, catch-up retroativo,
// cash sweep sem parcela fixa). As duas planilhas especificam produtos
// diferentes — o app precisa das duas. Por isso `financiamento_producao`
// AQUI não converte como dívida de calendário: ele lê as colunas que a
// migração `028_financiamento_producao_retroativo.js` já normalizou em
// `avancado_capital_instrumentos.config` (`exposicaoMinima`,
// `percentualFinanciavel`, `amortizarComCaixaDisponivel`, `custoLinhaIds`) e
// as carrega para as colunas correspondentes da tabela nova — sem inventar
// calendário nenhum, porque este produto não tem um.
//
// Leitura DEFENSIVA com os MESMOS defaults de `028` (`exposicaoMinima` 0.20,
// `percentualFinanciavel` 0.80, `amortizarComCaixaDisponivel` true): a `028`
// só roda antes desta na cadeia real, mas o harness testa cada migração
// também ISOLADA (contra a fixture crua, sem a `028` ter passado por cima) —
// sem a leitura defensiva, essa segunda checagem leria os campos ausentes e
// produziria 0% em vez do padrão.
//
// ── O que esta migração carrega, e o que ela deliberadamente NÃO inventa ──
//
// A `019` nunca rodou em Postgres (ver CLAUDE.md § Pendências do autor), então
// na prática esta migração é inócua em toda instalação existente. Ela existe
// para o caso de não ser — e aí a regra é não fabricar número:
//
//  · CAPITAL DE GIRO (`capital_giro`) converte SEM PERDA para `divida`: os
//    dois modelos têm exatamente os mesmos parâmetros (valor, taxa anual,
//    carência, prazo de amortização). `politicaAmortizacao` some — o modelo
//    novo tem só Price com carência, que é o que a planilha especifica;
//    camadas `cash_sweep`/`bullet` viram Price com o mesmo prazo, e é isso
//    que o rótulo `[revisar]` sinaliza.
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
// listar/atualizar/criar — não há DDL, e remoção física de tabela já era
// issue separada por funding-capital-stack.md §13.4). Ela some do app: nada
// mais a lê depois desta issue, exceto esta migração.
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

  // Financiamento à produção é único por estudo no modelo novo — assim como
  // já era no antigo (era a única regra de cardinalidade que o app impunha).
  // Se por algum motivo o antigo tiver mais de um, o primeiro (por ordem,
  // depois id) fica com o tipo e os demais viram Dívida.
  const ordenados = [...instrumentos].sort((a, b) =>
    (n(a.ordem) - n(b.ordem)) || (n(a.id) - n(b.id)));
  const jaTemFinanciamento = new Set();

  for (const inst of ordenados) {
    if (estudosComOperacao.has(String(inst.estudo_id))) continue;

    const cfg = inst.config ?? {};

    if (inst.tipo === 'financiamento_producao' && !jaTemFinanciamento.has(String(inst.estudo_id))) {
      jaTemFinanciamento.add(String(inst.estudo_id));
      await dados.criar('avancado_funding_operacoes', {
        estudo_id: inst.estudo_id,
        tipo: 'financiamento_producao',
        nome: inst.nome,
        ordem: n(inst.ordem),
        valor: n(inst.compromisso),
        taxa_anual: n(cfg.taxaAnual) * 100,
        // Defaults IDÊNTICOS aos de `028_financiamento_producao_retroativo.js`
        // — ver nota no cabeçalho sobre por que a leitura precisa ser
        // defensiva em vez de assumir que `028` já rodou.
        exposicao_minima: n(cfg.exposicaoMinima ?? 0.20) * 100,
        percentual_financiavel: n(cfg.percentualFinanciavel ?? 0.80) * 100,
        amortizar_com_caixa_disponivel: cfg.amortizarComCaixaDisponivel ?? true,
        custo_linha_ids: Array.isArray(cfg.custoLinhaIds) ? cfg.custoLinhaIds : null,
      });
      continue;
    }

    const eDivida = inst.tipo === 'financiamento_producao' || inst.tipo === 'capital_giro';
    const tipo = eDivida ? 'divida' : 'equity';

    const liberacoes = eDivida ? cfg.liberacaoProgramada : (cfg.aportes ?? cfg.aportesProgramados);
    const mes = primeiroMes(liberacoes);

    // `[revisar]` marca o que o usuário precisa completar: política de
    // amortização que não existe mais, ou remuneração que não foi convertida.
    // Um 2º `financiamento_producao` do mesmo estudo cai aqui como Dívida
    // (calendário) — ele NÃO tem exposição mínima/catch-up no modelo antigo
    // nem no novo, então não perde nada além da política de amortização.
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
