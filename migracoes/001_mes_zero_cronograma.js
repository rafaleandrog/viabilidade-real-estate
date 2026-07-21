// 001_mes_zero_cronograma.js — Lote 4 (#16)
//
// A convenção de mês do Fluxo de Caixa (nível Avançado) mudou de 1-based para
// 0-based (mês 0 = início do projeto). Esta migração desloca em -1 todos os
// `inicio_mes` já persistidos e os meses relativos da absorção personalizada
// das linhas de receita, mantendo os cronogramas existentes ancorados no mesmo
// mês de calendário de antes.
//
// Forward-only. Numa instalação virgem o schema.json já nasce 0-based
// (padrão `inicio_mes` = 0) e o runner faz baseline — esta migração é pulada.
//
// Só desloca dados absolutos em meses: NÃO toca `duracao_meses`,
// `absorcao.blocos` (referenciam eventos, não meses) nem `fluxo_pagamento`
// (offsets relativos, ex.: `apos_entrega_meses`).

export default async function ({ dados }) {
  // Cronograma (5 eventos por estudo).
  const { dados: cronos } = await dados.listar('avancado_cronograma', { por_pagina: 100000 });
  for (const ev of cronos) {
    const novo = Math.max(0, Number(ev.inicio_mes) - 1);
    if (novo !== Number(ev.inicio_mes)) {
      await dados.atualizar('avancado_cronograma', ev.id, { inicio_mes: novo });
    }
  }

  // Linhas de custo (o `inicio_mes` persistido desloca igual, ancorado ou não).
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });
  for (const c of custos) {
    const novo = Math.max(0, Number(c.inicio_mes) - 1);
    if (novo !== Number(c.inicio_mes)) {
      await dados.atualizar('avancado_linhas_custo', c.id, { inicio_mes: novo });
    }
  }

  // Linhas de receita: a absorção personalizada guarda meses relativos absolutos.
  const { dados: receitas } = await dados.listar('avancado_linhas_receita', { por_pagina: 100000 });
  for (const r of receitas) {
    const abs = r.absorcao;
    if (abs && abs.modo === 'personalizado' && Array.isArray(abs.meses)) {
      const meses = abs.meses.map((m) => ({ ...m, mes: Math.max(0, Number(m.mes) - 1) }));
      await dados.atualizar('avancado_linhas_receita', r.id, { absorcao: { ...abs, meses } });
    }
  }
}
