// 003_receitas_fases_alocacoes.js — Lote 6 (#19 #20 #21)
//
// O modelo de Receitas do nível Avançado foi reestruturado:
//  - "Fase" deixou de ser um rótulo de texto na linha de receita
//    (`avancado_linhas_receita.fase_label`) e virou entidade própria
//    (`avancado_fases`), dona da Absorção e do Fluxo de Pagamento (#21).
//  - Tipologias viraram CATÁLOGO do estudo (desacopladas da linha de receita);
//    a venda é uma "alocação" (`avancado_alocacoes`) que referencia a tipologia
//    do catálogo + fase + unidades + preço/m² (#19).
//  - Absorção: só "Distribuído" em 3 períodos (pós-obra derivado) (#20).
//  - Fluxo de Pagamento: Entrada e Parcelamento viram LISTAS de linhas; o
//    Repasse é derivado (100 − entradas − parcelas) (#20).
//
// Esta migração transforma o dado legado:
//  1. cada `avancado_linhas_receita` → uma `avancado_fases` (absorção/fluxo
//     convertidos para o novo formato; nome = fase_label || nome);
//  2. cada `avancado_tipologias` (que tinha `linha_receita_id`) → permanece no
//     catálogo (já tem `estudo_id`) E gera uma `avancado_alocacoes` na fase da
//     sua linha de origem (unidades = quantidade, preço/m² = preco_m2);
//  3. remove a coluna `avancado_tipologias.linha_receita_id` (retorno
//     declarativo).
//
// A tabela `avancado_linhas_receita` é preservada no schema (vestigial) para
// não exigir drop de tabela — o app não a lê nem escreve mais.
//
// Forward-only. Numa instalação virgem não há dado avançado — o runner faz
// baseline e esta migração é inócua.

// Absorção Distribuída padrão (Pré+Lançamento 30 / Obra 40 / Pós-obra derivado).
function absorcaoPadrao() {
  return {
    modo: 'distribuido',
    correcao_estoque: false,
    blocos: [
      { evento: 'lancamento', pct: 30 },
      { evento: 'obra', pct: 40 },
      { evento: 'pos_obra', pct: 0 },
    ],
  };
}

// Converte a absorção legada para o formato Distribuído (3 períodos).
function converterAbsorcao(a) {
  if (a && a.modo === 'distribuido' && Array.isArray(a.blocos) && a.blocos.length > 0) {
    // Já é distribuído — mantém os blocos (o pós-obra passa a ser derivado, mas
    // como o legado somava 100, o derivado bate com o valor antigo).
    return { modo: 'distribuido', correcao_estoque: Boolean(a.correcao_estoque), blocos: a.blocos };
  }
  return absorcaoPadrao();
}

// Converte o fluxo de pagamento legado (objeto único) para o novo formato
// (Entrada/Parcelas em listas; Repasse sem pct — derivado).
function converterFluxo(fp) {
  if (!fp || typeof fp !== 'object') return null;
  const entrada = Array.isArray(fp.entrada)
    ? fp.entrada
    : (fp.entrada ? [{ pct: Number(fp.entrada.pct) || 0, parcelas: Number(fp.entrada.parcelas) || 1 }] : []);
  const parcelas = Array.isArray(fp.parcelas)
    ? fp.parcelas
    : (fp.parcelas ? [{
        periodicidade: fp.parcelas.periodicidade || 'mensal',
        parcelas: Number(fp.parcelas.parcelas) || 0,
        ao_longo_obra: fp.parcelas.ao_longo_obra !== false,
        juros: Boolean(fp.parcelas.juros),
        pct: Number(fp.parcelas.pct) || 0,
      }] : []);
  return {
    comissao: fp.comissao || { ativo: true, tipo: 'embutida', pct: 6 },
    ret: fp.ret || { ativo: false, pct: 4 },
    entrada,
    parcelas,
    repasse: { apos_entrega_meses: Number(fp.repasse?.apos_entrega_meses) || 0 },
  };
}

export default async function ({ dados }) {
  // 1. Linhas de receita → fases (mapeando linha antiga → nova fase).
  const { dados: linhas } = await dados.listar('avancado_linhas_receita', { por_pagina: 100000 });
  const faseDaLinha = new Map(); // linha_receita_id → fase_id
  for (const l of linhas) {
    const fase = await dados.criar('avancado_fases', {
      estudo_id: l.estudo_id,
      nome: String(l.fase_label || l.nome || 'Fase 1').trim() || 'Fase 1',
      ordem: Number(l.ordem) || 0,
      absorcao: converterAbsorcao(l.absorcao),
      fluxo_pagamento: converterFluxo(l.fluxo_pagamento),
    });
    faseDaLinha.set(Number(l.id), Number(fase.id));
  }

  // 2. Tipologias legadas → alocação na fase da sua linha de origem.
  const { dados: tipologias } = await dados.listar('avancado_tipologias', { por_pagina: 100000 });
  for (const t of tipologias) {
    const faseId = faseDaLinha.get(Number(t.linha_receita_id));
    if (!faseId) continue; // tipologia sem linha (não deveria ocorrer no legado)
    await dados.criar('avancado_alocacoes', {
      estudo_id: t.estudo_id,
      fase_id: faseId,
      tipologia_id: t.id,
      unidades: Number(t.quantidade) || 0,
      preco_m2: Number(t.preco_m2) || 0,
      ordem: Number(t.ordem) || 0,
    });
  }

  // 3. Tipologia vira catálogo puro — remove o vínculo com a linha de receita.
  return { remover_colunas: { avancado_tipologias: ['linha_receita_id'] } };
}
