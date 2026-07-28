// 010_fases_tipo.js — #168
//
// Adiciona `tipo` a avancado_fases: até aqui, Cronograma e Receitas faziam
// CRUD na MESMA lista de fases sem discriminador — uma fase criada em
// qualquer uma das duas telas aparecia (e podia ser editada/removida) na
// outra. `tipo` separa as fases do Cronograma (`cronograma`, marcadores do
// gantt sem alocação) das fases de Receitas (`receita`, donas de
// Absorção/Fluxo de Pagamento/Alocações — o que o motor de fluxo consome).
//
// Backfill: a única forma confiável de saber a origem de uma fase existente é
// checar se ela tem alocação de venda — só Receitas cria alocações
// (avancado_alocacoes). Fase com pelo menos uma alocação → 'receita'. Sem
// nenhuma → 'cronograma' (o caso mais comum de fase criada só para marcar um
// período no gantt, via "Adicionar fase" do Cronograma). Nenhuma linha é
// apagada; o pior caso é uma fase de receita vazia (sem alocação, criada em
// Receitas mas nunca usada) ser reclassificada como 'cronograma' — ela
// continua existindo, só passa a aparecer na lista do Cronograma em vez da de
// Receitas, e o usuário pode recriá-la na aba certa se notar a ausência.

export default async function ({ dados }) {
  const { dados: fases } = await dados.listar('avancado_fases', { por_pagina: 100000 });
  const { dados: alocacoes } = await dados.listar('avancado_alocacoes', { por_pagina: 100000 });

  const fasesComAlocacao = new Set(alocacoes.map((a) => Number(a.fase_id)));

  for (const f of fases) {
    const tipo = fasesComAlocacao.has(Number(f.id)) ? 'receita' : 'cronograma';
    if (f.tipo !== tipo) {
      await dados.atualizar('avancado_fases', f.id, { tipo });
    }
  }
}
