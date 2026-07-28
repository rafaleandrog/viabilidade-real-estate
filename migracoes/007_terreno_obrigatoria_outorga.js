// 007_terreno_obrigatoria_outorga.js — #180
//
// Duas mudanças em avancado_linhas_custo, no mesmo padrão do #178:
//
// 1. "Outorga" (contrapartida onerosa pelo potencial construtivo) sai do
//    grupo `terreno` e vai para `obra` — é custo de desenvolvimento da obra,
//    não de aquisição do terreno em si (mesmo raciocínio da Proforma, que já
//    trata Outorga como custo direto separado de Terreno). O frontend
//    (tela-fluxo-custos.ts) já reclassificou a categoria; esta migração só
//    move o dado existente.
// 2. "Compra" passa a ser a linha obrigatória de `terreno` (mirror de
//    "Construção" em `obra` e "Corretagem de vendas" em `diretos`, #178):
//    backfill de `obrigatoria=true` na linha de menor id por estudo.
//
// Forward-only. Instalação virgem não tem linhas de custo — inócua.

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });

  for (const c of custos) {
    if (String(c.grupo) === 'terreno' && String(c.categoria) === 'Outorga') {
      await dados.atualizar('avancado_linhas_custo', c.id, { grupo: 'obra' });
    }
  }

  const compraPorEstudo = new Map();
  for (const c of custos) {
    if (String(c.grupo) !== 'terreno' || String(c.categoria) !== 'Compra') continue;
    const atual = compraPorEstudo.get(c.estudo_id);
    if (!atual || Number(c.id) < Number(atual.id)) compraPorEstudo.set(c.estudo_id, c);
  }
  for (const linha of compraPorEstudo.values()) {
    if (linha.obrigatoria !== true) {
      await dados.atualizar('avancado_linhas_custo', linha.id, { obrigatoria: true });
    }
  }
}
