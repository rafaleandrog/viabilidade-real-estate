// 006_linhas_custo_obrigatoria.js — #178
//
// Introduz a coluna `obrigatoria` em avancado_linhas_custo: até aqui, a linha
// "obrigatória" de um grupo (Construção em Obra, Corretagem de vendas em
// Diretos) era identificada por categoria — o que travava (sem botão Remover)
// toda e qualquer linha com aquele nome, inclusive duplicatas. A duplicata
// mais comum nascia de uma causa própria: a migração 002 moveu "Gestão da
// obra" de `obra` para `diretos`, mas a lista de obrigatórias do frontend
// continuava marcando "Gestão da obra" como exigida em `obra` — a cada
// carregamento da tela, `_garantirLinhasObrigatorias` recriava essa linha em
// `obra` (a categoria "certa" estava no grupo errado, então a checagem de
// existência falhava sempre). O código já foi corrigido (removida do mapa de
// obrigatórias); esta migração só faz o backfill da coluna nova.
//
// Regra do backfill, por estudo + grupo + categoria: a linha de menor id que
// bate com a categoria hoje exigida naquele grupo (Construção/obra,
// Corretagem de vendas/diretos) recebe `obrigatoria = true`. Qualquer outra —
// incluindo a "Gestão da obra" órfã criada em `obra` pelo bug — fica com o
// padrão `false` e, com isso, passa a ter categoria editável e botão Remover
// na tela. Nenhuma linha é apagada: nenhum dado do usuário é perdido, mesmo
// nas duplicatas.
//
// Forward-only. Instalação virgem não tem linhas de custo — inócua.

const CATEGORIAS_OBRIGATORIAS = {
  obra: 'Construção',
  diretos: 'Corretagem de vendas',
};

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });

  const porEstudoGrupo = new Map();
  for (const c of custos) {
    const categoriaAlvo = CATEGORIAS_OBRIGATORIAS[String(c.grupo)];
    if (!categoriaAlvo || String(c.categoria) !== categoriaAlvo) continue;
    const chave = `${c.estudo_id}:${c.grupo}`;
    const atual = porEstudoGrupo.get(chave);
    if (!atual || Number(c.id) < Number(atual.id)) porEstudoGrupo.set(chave, c);
  }

  for (const linha of porEstudoGrupo.values()) {
    if (linha.obrigatoria !== true) {
      await dados.atualizar('avancado_linhas_custo', linha.id, { obrigatoria: true });
    }
  }
}
