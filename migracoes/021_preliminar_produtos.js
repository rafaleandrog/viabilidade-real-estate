// 021_preliminar_produtos.js — #315 (item 3, reestruturação do Preliminar)
//
// Cria a tabela `preliminar_produtos` (catálogo de produtos do Preliminar —
// Nome, Área média, Preço de venda, Unidades, VGV calculado) e migra os
// campos fixos legados (`area_media_lote_m2`/`preco_venda_m2` no Loteamento;
// `area_pvt_*_fechada`/`preco_venda_m2_*`/`num_unidades_*` na Incorporação)
// para linhas do catálogo — sem isso, um estudo existente perderia a
// visibilidade dos seus produtos na aba nova (a UI passa a mostrar só a
// tabela, os campos fixos saem do formulário).
//
// Os campos legados NÃO são apagados nem zerados — continuam no schema como
// histórico.
//
// ⚠️ A redação anterior dizia que `frontend/proforma.ts` "só os lê quando
// `produtos` está vazio", e isso deixou de valer: o motor NUNCA MAIS lê o par
// legado como fonte de VGV. Sem catálogo efetivo — nenhuma linha com área,
// preço e unidades preenchidos — o estudo não tem receita modelada, e a
// Proforma mostra estado vazio em vez de números tirados de campos que não
// têm mais formulário. Isso torna esta migração o ÚNICO caminho de
// continuidade dos estudos anteriores ao catálogo: sem a linha que ela cria,
// um estudo antigo abre zerado. O corpo dela não mudou.
//
// ── Continuidade de VGV ──
//
// Incorporação: VGV hoje é `área_fechada × preço` (não depende de unidades).
// A linha migrada usa área_média = área_fechada ÷ unidades (para que
// área_média × preço × unidades feche exatamente com o valor de hoje, a
// menos de arredondamento de centavos). Se `num_unidades_*` for 0 mas
// área/preço estiverem preenchidos (estado legado possível — a validação só
// exige unidades>0 pra exigir os outros dois), usa unidades=1 em vez de
// dividir por zero, preservando o VGV.
//
// Loteamento: VGV hoje é `áreaVendável(cascata) × preço`, e nº de lotes é
// DERIVADO (nunca persistido) por `floor(áreaVendável / área_média_lote)`.
// Migração roda em JS puro (sem acesso ao motor TS do frontend), então
// `alvLoteamento` abaixo replica só a "passada 1" (resolução de m²) das 10
// linhas de `frontend/areas-cascata.ts` → `CASCATA_LOTEAMENTO` — o
// suficiente pra obter a Área Líquida de Venda (ALV). O floor() já existia
// no cálculo de hoje (só rodava a cada render, nunca persistido); aqui ele
// roda uma vez e fica congelado na quantidade de unidades migrada — a
// diferença entre `unidades × área_média × preço` e `ALV × preço` é, no
// pior caso, o valor de um lote (resíduo do floor), nunca mais que isso.
//
// Idempotente: pula estudo que já tem alguma linha em `preliminar_produtos`.
// Só migra estudos com `nivel_analise !== 'avancado'` — Avançado não lê
// estes campos (própria `tela-premissas.ts` já retorna vazio para ele).
// Forward-only.

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}
function n(v) {
  return Number(v) || 0;
}

// Réplica mínima (só "passada 1" — resolução de m²) de CASCATA_LOTEAMENTO.
function alvLoteamento(e) {
  const modoValor = (modoCampo, valorCampo, ancoras) => {
    const modo = e[modoCampo] || 'm2';
    const valor = n(e[valorCampo]);
    if (modo === 'm2') return valor;
    if (modo === 'pct_poligonal') return ancoras.poligonal * (valor / 100);
    if (modo === 'pct_parcelavel') return ancoras.parcelavel != null ? ancoras.parcelavel * (valor / 100) : 0;
    return 0;
  };
  const poligonal = e.origem_terreno === 'nucleo' ? n(e.area_terreno_nucleo) : n(e.terreno_manual_area);
  const app = modoValor('area_app_modo', 'area_app_valor', { poligonal, parcelavel: null });
  const parcelavel = poligonal - app;
  const anc = { poligonal, parcelavel };
  const elupEpu = modoValor('area_elup_epu_modo', 'area_elup_epu_valor', anc);
  const epc = modoValor('area_epc_modo', 'area_epc_valor', anc);
  const viarioPublico = modoValor('area_viario_publico_modo', 'area_viario_publico_valor', anc);
  const liquida = parcelavel - elupEpu - epc - viarioPublico;
  const viarioPrivado = modoValor('area_viario_privado_modo', 'area_viario_privado_valor', anc);
  const comunsPrivadas = modoValor('area_comuns_privadas_modo', 'area_comuns_privadas_valor', anc);
  const verdes = modoValor('area_verdes_modo', 'area_verdes_valor', anc);
  return liquida - viarioPrivado - comunsPrivadas - verdes;
}

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });
  const preliminares = estudos.filter((e) => e.nivel_analise !== 'avancado');
  if (preliminares.length === 0) return;

  const { dados: existentes } = await dados.listar('preliminar_produtos', { por_pagina: 100000 });
  const jaMigrado = new Set(existentes.map((p) => Number(p.estudo_id)));

  for (const e of preliminares) {
    if (jaMigrado.has(Number(e.id))) continue; // idempotente

    if (e.tipo_empreendimento === 'loteamento') {
      const areaMedia = n(e.area_media_lote_m2);
      const preco = n(e.preco_venda_m2);
      if (areaMedia <= 0 && preco <= 0) continue; // nada preenchido, nada a migrar

      const alv = alvLoteamento(e);
      const unidades = areaMedia > 0 ? Math.max(0, Math.floor(alv / areaMedia)) : 0;
      await dados.criar('preliminar_produtos', {
        estudo_id: e.id, nome: 'Lote',
        area_media_m2: round2(areaMedia), preco_venda_m2: round2(preco),
        unidades, ordem: 0,
      });
      continue;
    }

    // Incorporação — até 2 linhas: Residencial e Não residencial.
    const lados = [
      { nome: 'Residencial', area: e.area_pvt_r_fechada, preco: e.preco_venda_m2_residencial, un: e.num_unidades_residencial },
      { nome: 'Não residencial', area: e.area_pvt_nr_fechada, preco: e.preco_venda_m2_nao_residencial, un: e.num_unidades_nao_residencial },
    ];
    let ordem = 0;
    for (const lado of lados) {
      const areaTotal = n(lado.area);
      const preco = n(lado.preco);
      const unidadesInformadas = n(lado.un);
      if (areaTotal <= 0 && preco <= 0 && unidadesInformadas <= 0) continue;

      const unidades = unidadesInformadas > 0 ? unidadesInformadas : 1;
      const areaMedia = unidadesInformadas > 0 ? areaTotal / unidadesInformadas : areaTotal;
      await dados.criar('preliminar_produtos', {
        estudo_id: e.id, nome: lado.nome,
        area_media_m2: round2(areaMedia), preco_venda_m2: round2(preco),
        unidades, ordem: ordem++,
      });
    }
  }
}
