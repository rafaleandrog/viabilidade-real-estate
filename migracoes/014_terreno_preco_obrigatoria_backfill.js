// 014_terreno_preco_obrigatoria_backfill.js — #256
//
// Garante EXATAMENTE UMA linha `Preço` (terreno) marcada `obrigatoria=true`
// por estudo — inclusive nos legados que os backfills anteriores (#178/#180,
// migrações 007/008) não alcançaram. 007 só marcou `obrigatoria=true` na
// linha `Compra` de menor id que existia NO MOMENTO em que rodou; um estudo
// cuja linha `Preço` nasceu (ou foi reclassificada via PATCH de categoria)
// DEPOIS disso nunca passou por ela — fica sem nenhuma linha oficial no
// grupo `terreno`. #256 fecha esse caminho também pra frente, no backend
// (POST e PATCH de avancado_linhas_custo já verificam antes de criar uma
// segunda linha obrigatória).
//
// Regra do backfill, por estudo: se NENHUMA linha `terreno`/`Preço` já tem
// `obrigatoria=true`, a de menor id recebe `true`. Se, por qualquer motivo,
// MAIS de uma já tiver `true` (não deveria acontecer com o código atual, mas
// esta migração não presume), mantém só a de menor id e desmarca as demais —
// nunca duas linhas oficiais no mesmo estudo. Nenhuma linha é apagada; nenhum
// dado do usuário é perdido, mesmo nas duplicatas.
//
// Forward-only. Instalação virgem não tem linhas de custo — inócua.

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });

  const porEstudo = new Map();
  for (const c of custos) {
    if (String(c.grupo) !== 'terreno' || String(c.categoria) !== 'Preço') continue;
    if (!porEstudo.has(c.estudo_id)) porEstudo.set(c.estudo_id, []);
    porEstudo.get(c.estudo_id).push(c);
  }

  for (const linhas of porEstudo.values()) {
    linhas.sort((a, b) => Number(a.id) - Number(b.id));
    const [oficial, ...demais] = linhas;
    if (oficial.obrigatoria !== true) {
      await dados.atualizar('avancado_linhas_custo', oficial.id, { obrigatoria: true });
    }
    for (const extra of demais) {
      if (extra.obrigatoria === true) {
        await dados.atualizar('avancado_linhas_custo', extra.id, { obrigatoria: false });
      }
    }
  }
}
