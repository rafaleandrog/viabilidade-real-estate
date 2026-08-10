// 025_reverter_categorias_obrigatorias.js — item 36 da planilha (Rodada 7,
// BUG7-27, #335) — reverte deliberadamente a #179/#256.
//
// A categoria de uma linha de Custos deixou de travar renomeação/remoção e
// de sumir do combo das outras linhas (backend/rotas/avancado.ts não marca
// mais `obrigatoria=true` em nenhum POST/PATCH, e o bloqueio
// `bloqueioLinhaObrigatoria` foi removido). Uma categoria repetida no mesmo
// grupo agora é alerta na Reconciliação (validarCustosDuplicados,
// frontend/fluxo-invariantes.ts), não bloqueio.
//
// Esta migração zera `obrigatoria` em toda linha existente marcada `true`
// pelas migrações 006/007/014 — a coluna continua no schema (nenhum PATCH a
// lê mais para decidir comportamento), só o dado antigo deixa de refletir
// uma trava que não existe mais. Forward-only; idempotente (reexecução não
// encontra mais nenhuma linha com `obrigatoria=true`).

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });
  for (const c of custos) {
    if (c.obrigatoria === true) {
      await dados.atualizar('avancado_linhas_custo', c.id, { obrigatoria: false });
    }
  }
}
