// 037_juros_tabela_estudo.js — #585 (Rodada 10, leva Avançado item 8).
//
// A taxa de juros de tabela deixou de ser da LINHA DE RECEITA e passou a ser do
// ESTUDO. Decisão do autor de 2026-08-26: *"campo juros de tabela funciona para
// todos os imóveis igualmente e o valor não é inserido aqui. será na aba
// financeiro"*. Ela supersede a granularidade da #428 (uma taxa por Grupo,
// D-Q02) e o papel da coluna criada pela #477 — que era DEFAULT DE CRIAÇÃO e
// passa a ser o VALOR VIGENTE, lido pelo motor a cada cálculo.
//
// ⚠️ Sem este backfill, todo estudo existente que tem juros gravados nas linhas
// abriria em 0% de juros na versão nova, porque a coluna do estudo nasceu nula
// na `033` e o motor deixou de ler a taxa de dentro da linha. Não é cosmético:
// é a diferença entre manter e apagar os juros de clientes do estudo.
//
// ── A saída de transição escolhida: T1, a taxa MAIS FREQUENTE ────────────────
//
// A issue oferecia três (`T1` mais frequente, `T2` a da linha de maior VGV,
// `T3` exigir decisão do usuário). Escolhida **T1**, e o motivo é operacional,
// não de gosto:
//
//   · **T2 não é implementável aqui sem duplicar o motor.** "Maior VGV" exige
//     tipologias × área × preço × deflator de área aberta — a conta de
//     `vgvVendavelLinha`, que vive no frontend e não é importável de uma
//     migração. Reimplementá-la aqui criaria uma segunda cópia que envelhece
//     sozinha, e um backfill errado é pior que um heurístico declarado.
//   · **T3 deixaria o estudo em 0% até alguém abrir a tela.** Com a taxa vindo
//     do estudo, "campo em branco" não é estado neutro: é venda sem juros. A
//     saída que "não muda número sem consentimento" muda o número de TODOS os
//     estudos divergentes, e para pior.
//
// **O custo de T1, declarado:** num estudo cujas linhas tinham taxas diferentes
// (o caso Residencial × Não Residencial da EVI Urbitá), as linhas minoritárias
// mudam de taxa **sem ninguém confirmar**. É a objeção que a própria issue
// levanta contra T1, e ela procede — só que as alternativas custam mais. O
// autor decide se quer revisar estudo a estudo depois de instalar.
//
// Desempate, quando duas taxas empatam em frequência: vence a da linha de menor
// `ordem` (a primeira do estudo, na ordem em que a tela as lista). Critério
// determinístico e explicável em uma frase — sem ele o resultado dependeria da
// ordem de iteração do banco.
//
// ── O que ele lê, e por que a lógica está copiada aqui ───────────────────────
//
// A taxa de uma linha tem duas fontes, na mesma precedência que
// `jurosTabelaAnualPct` usava antes da #585:
//   1. `fluxo_pagamento.juros_tabela_aa` — o dígito que o usuário escreveu;
//   2. na falta dela, a primeira `taxaMensal` não nula dos componentes
//      persistidos, por `(1 + i_m)^12 − 1` (o caso do estudo 5 de Pinguim, que
//      recebeu a taxa pela API sem a chave).
//
// Essa função foi REMOVIDA do motor pela #585 — não há de onde importá-la, e
// migração não importa frontend de qualquer forma. A cópia aqui é deliberada e
// tem o mesmo caráter do `ALCADAS_EM_0_53_18` do monorepo: **migração é retrato
// de um instante**. Ela não pode divergir do motor no futuro porque não há
// futuro a acompanhar — o conceito "taxa por linha" deixou de existir.
//
// Idempotente e forward-only: só toca estudo cujo `juros_tabela_aa_padrao`
// ainda é nulo. Reexecutar não mexe em nada, e um estudo em que o autor já
// digitou a taxa (inclusive 0) nunca é sobrescrito.
//
// As chaves `fluxo_pagamento.juros_tabela_aa` das linhas NÃO são apagadas:
// ficam inertes e `fluxoPagamentoParaSalvar` as descarta na primeira gravação
// de cada linha. Apagá-las aqui seria escrita em massa sem ganho — nada as lê.

/** % a.a. de uma linha, na precedência da #428. `null` = a linha não declara taxa. */
function jurosAaDaLinha(fluxoPagamento) {
  const fp = fluxoPagamento ?? {};
  if (fp.juros_tabela_aa !== undefined && fp.juros_tabela_aa !== null) {
    const aa = Number(fp.juros_tabela_aa);
    return Number.isFinite(aa) ? aa : null;
  }
  const comps = Array.isArray(fp.componentes) ? fp.componentes : [];
  for (const c of comps) {
    const m = Number(c?.taxaMensal);
    if (Number.isFinite(m) && m !== 0) return (Math.pow(1 + m, 12) - 1) * 100;
  }
  return null;
}

/** Chave de agrupamento: 1 casa decimal, a mesma que a tela exibia. */
function chave(aa) {
  return Math.round(aa * 10) / 10;
}

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });
  const alvos = estudos.filter(
    (e) => e.juros_tabela_aa_padrao === null || e.juros_tabela_aa_padrao === undefined,
  );
  if (alvos.length === 0) return;

  const { dados: fases } = await dados.listar('avancado_fases', { por_pagina: 100000 });

  for (const estudo of alvos) {
    const linhas = fases
      .filter((f) => String(f.estudo_id) === String(estudo.id) && f.tipo === 'receita')
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

    // Frequência por taxa, guardando a MENOR ordem em que ela apareceu — é o
    // desempate.
    const porTaxa = new Map();
    linhas.forEach((linha, posicao) => {
      const aa = jurosAaDaLinha(linha.fluxo_pagamento);
      if (aa === null || chave(aa) === 0) return;   // linha sem juros não vota
      const k = chave(aa);
      const ja = porTaxa.get(k);
      if (ja) ja.n += 1;
      else porTaxa.set(k, { n: 1, primeira: posicao, aa });
    });
    if (porTaxa.size === 0) continue;               // nenhum juro no estudo: fica nulo

    let vencedora = null;
    for (const cand of porTaxa.values()) {
      if (
        vencedora === null
        || cand.n > vencedora.n
        || (cand.n === vencedora.n && cand.primeira < vencedora.primeira)
      ) {
        vencedora = cand;
      }
    }

    // `decimal(5,2)` — 2 casas, o mesmo que a coluna comporta.
    const valor = Math.round(vencedora.aa * 100) / 100;
    await dados.atualizar('estudos', estudo.id, { juros_tabela_aa_padrao: valor });
  }
}
