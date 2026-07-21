// 002_grupos_custo.js — Lote 5 (#17)
//
// Os custos do nível Avançado passaram de 3 grupos (`terreno` / `obra` /
// `indireto`) para 5 (`terreno` / `obra` / `diretos` / `indireto` /
// `financeiro`), refletindo as 5 abas de Viabilidade › Custos.
//
// Reclassificação por categoria (decisão do autor — Lote 5): as linhas hoje em
// `obra` cujo trabalho é de entrega do produto (categorias "Decoração" e
// "Gestão da obra") migram para `diretos`; o restante de `obra` (obra física,
// contingência, etc.) permanece em `obra`. `terreno` e `indireto` ficam onde
// estão. Os grupos `diretos` (o que sobra da reclassificação) e `financeiro`
// (sem dados legados) recebem novas linhas pelo usuário.
//
// Forward-only. Numa instalação virgem não há linhas de custo — o runner faz
// baseline e esta migração é inócua.

const CATEGORIAS_DIRETOS = new Set(['Decoração', 'Gestão da obra']);

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });
  for (const c of custos) {
    if (String(c.grupo) === 'obra' && CATEGORIAS_DIRETOS.has(String(c.categoria))) {
      await dados.atualizar('avancado_linhas_custo', c.id, { grupo: 'diretos' });
    }
  }
}
