// 020_areas_cascata_loteamento.js — reestruturação do Preliminar (2026-08-03)
//
// Migra os 7 campos antigos de % de área do Loteamento (`app_pct`,
// `faixas_nao_edificaveis_pct`, `sistema_viario_pct`, `elup_pct`, `epc_pct`,
// `epu_pct`, `areas_privativas_nao_vendaveis_pct`) para a tabela em cascata
// nova (`area_*_modo`/`area_*_valor`, ver `frontend/areas-cascata.ts`), que
// tem só 7 linhas EDITÁVEIS — mas a imagem de referência (`padrao_areas.png`)
// não tem uma linha para "faixas não edificáveis" nem para "áreas privativas
// não vendáveis". Decisão do autor (2026-08-03): em vez de perder essas duas
// deduções do CÁLCULO (o que mudaria o resultado de qualquer estudo existente
// que as tivesse preenchidas), elas são somadas dentro de linhas que
// sobrevivem — `faixas_nao_edificaveis_pct` dentro de `area_app_valor`,
// `areas_privativas_nao_vendaveis_pct` dentro de `area_viario_privado_valor`.
// A soma final de todas as deduções (e portanto o VGV/margem calculados) fica
// IDÊNTICA à de antes — só a rotulagem interna de duas linhas passa a incluir
// um componente que antes tinha campo próprio.
//
// Todos os campos migrados nascem em modo `pct_poligonal` — a mesma base
// ("% gleba") que os campos antigos já usavam. `sistema_viario_pct` tem
// padrão 25 no schema; todo estudo de Loteamento que nunca tocou o campo já
// tinha esse valor implícito, então é migrado também (preserva o padrão).
//
// Idempotente: um estudo já migrado tem `area_app_modo === 'pct_poligonal'`
// (o padrão de coluna nova é `m2`) — reexecução pula.
//
// Forward-only. Sem tipologias/estudos de Loteamento no banco, inócua.

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });
  const loteamentos = estudos.filter((e) => e.tipo_empreendimento === 'loteamento');
  if (loteamentos.length === 0) return;

  for (const e of loteamentos) {
    if (e.area_app_modo === 'pct_poligonal') continue; // já migrado

    const app = Number(e.app_pct) || 0;
    const faixas = Number(e.faixas_nao_edificaveis_pct) || 0;
    const elup = Number(e.elup_pct) || 0;
    const epu = Number(e.epu_pct) || 0;
    const epc = Number(e.epc_pct) || 0;
    const viario = Number(e.sistema_viario_pct) || 0;
    const privNaoVend = Number(e.areas_privativas_nao_vendaveis_pct) || 0;

    await dados.atualizar('estudos', e.id, {
      area_app_modo: 'pct_poligonal',
      area_app_valor: round2(app + faixas),
      area_elup_epu_modo: 'pct_poligonal',
      area_elup_epu_valor: round2(elup + epu),
      area_epc_modo: 'pct_poligonal',
      area_epc_valor: round2(epc),
      area_viario_publico_modo: 'pct_poligonal',
      area_viario_publico_valor: round2(viario),
      area_viario_privado_modo: 'pct_poligonal',
      area_viario_privado_valor: round2(privNaoVend),
    });
  }
}
