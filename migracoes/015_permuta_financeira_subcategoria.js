// 015_permuta_financeira_subcategoria.js — #257
//
// Subcategoria da linha `Preço` (terreno) passa de quatro valores livres
// (`Valor à vista`, `Permuta`, `Parcelado`, `Outro`) para quatro CANÔNICOS:
// `Valor à vista`, `Parcelado`, `Permuta física`, `Permuta financeira`. O
// motor (`ePermutaFinanceira`, frontend/fluxo-caixa-motor.ts) já tratava toda
// linha `Preço/Permuta` como dedução financeira da receita — não existia
// distinção física×financeira na prática, então a migração aprovada é
// simples: toda `Permuta` legada vira `Permuta financeira`, preservando
// exatamente o mesmo resultado (mesma dedução, só o rótulo muda).
//
// `Outro` e `Valor à vista`/`Parcelado` não são tocados — não há regra para
// remapear `Outro` em um dos quatro canônicos, então o dado legado fica como
// está (a UI simplesmente não oferece mais essa opção no seletor daqui pra
// frente; o valor antigo continua visível/editável até o usuário trocar).
//
// Forward-only. Instalação virgem não tem linhas de custo — inócua.

export default async function ({ dados }) {
  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });

  for (const c of custos) {
    if (String(c.grupo) === 'terreno' && String(c.categoria) === 'Preço' && String(c.subcategoria) === 'Permuta') {
      await dados.atualizar('avancado_linhas_custo', c.id, { subcategoria: 'Permuta financeira' });
    }
  }
}
