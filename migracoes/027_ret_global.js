// 027_ret_global.js — item 33 da planilha, linha "32-Definições" (Rodada 7, #346)
//
// RET deixa de ser um controle POR GRUPO (`avancado_fases.fluxo_pagamento.ret`,
// JSON) e vira um controle GLOBAL do estudo: `estudos.considerar_ret` (booleano,
// padrão false) + `estudos.ret_pct` (decimal, padrão 4) — mesmo padrão de
// `considerar_contingencias`/`contingencias_pct` (migração 023).
//
// Backfill, por estudo: entre as fases com `fluxo_pagamento.ret.ativo === true`,
// a de menor `id` decide `ret_pct` (não deveria haver divergência entre fases —
// RET é imposto do projeto inteiro, não do grupo comercial — mas esta migração
// não presume). Sem nenhuma fase com RET ativo, o estudo nasce com
// `considerar_ret=false` e `ret_pct` no padrão do formulário (4), preservando o
// efeito exatamente nulo que RET já tinha no motor (`receitaLiquidaLinha`
// retorna o VGV intacto quando `ativo` é falso, então "nenhuma fase com RET"
// hoje já significa "RET não afeta o cálculo" — o global correspondente é
// desativado).
//
// Forward-only. Instalação virgem não tem fases — inócua.

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });
  const { dados: fases } = await dados.listar('avancado_fases', { por_pagina: 100000 });

  const porEstudo = new Map();
  for (const f of fases) {
    const ret = f?.fluxo_pagamento?.ret;
    if (!ret?.ativo) continue;
    if (!porEstudo.has(f.estudo_id)) porEstudo.set(f.estudo_id, []);
    porEstudo.get(f.estudo_id).push(f);
  }

  for (const e of estudos) {
    const ativas = (porEstudo.get(e.id) ?? []).sort((a, b) => Number(a.id) - Number(b.id));
    if (ativas.length === 0) continue; // sem RET ativo em nenhuma fase — mantém o padrão (false/4)
    const pct = Number(ativas[0].fluxo_pagamento.ret.pct) || 0;
    await dados.atualizar('estudos', e.id, { considerar_ret: true, ret_pct: pct });
  }
}
