// 008_terreno_preco.js — #193
//
// Renomeia a categoria "Compra" para "Preço" no grupo `terreno` de
// avancado_linhas_custo — nome alinhado à referência visual da planilha de
// bugs ("View Custos Terreno"). Mesma linha obrigatória (#180), mesmas
// subcategorias; só o rótulo muda. O frontend (tela-fluxo-custos.ts) e o
// backend (LINHAS_OBRIGATORIAS_CUSTO em avancado.ts) já usam "Preço" — esta
// migração só move o dado existente.
//
// Forward-only. Instalação virgem não tem linhas de custo — inócua.

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });
  for (const c of custos) {
    if (String(c.grupo) === 'terreno' && String(c.categoria) === 'Compra') {
      await dados.atualizar('avancado_linhas_custo', c.id, { categoria: 'Preço' });
    }
  }
}
