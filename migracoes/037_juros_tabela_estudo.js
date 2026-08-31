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
// ⚠️ **E é justamente por não sobrescrever que existe um SEGUNDO caminho de
// mudança de número, que esta migração não vê e não pode ver.** Estudo cuja
// coluna JÁ estava preenchida antes da #585 — a `033` a criou como default de
// criação, e o backend a semeava em cada linha nova — e que depois teve uma
// linha editada para outra taxa: a `037` pula esse estudo (coluna não é nula),
// e mesmo assim a linha customizada passa a calcular pela taxa do estudo,
// porque quem manda agora é `componentesPagamento`, não o dado da linha.
//
// Não é defeito do backfill: é a decisão da issue chegando pela porta do
// código em vez da porta da migração. Fica escrito aqui porque é o caso que
// não aparece em diff nenhum — nem a migração escreve, nem a tela avisa.
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

/**
 * Teto da coluna `estudos.juros_tabela_aa_padrao`, que é `decimal(5,2)`
 * (`schema.json:137`) — cabe até `999.99`.
 *
 * Ele existe porque a taxa pode vir DERIVADA de uma `taxaMensal` persistida, e
 * `(1 + i_m)^12 − 1` com um `taxaMensal` sujo estoura qualquer ordem de
 * grandeza (`i_m = 1` já dá 409.500% a.a.). Sem o teto, `dados.atualizar`
 * falharia no meio da varredura e deixaria o backfill pela metade — pior que
 * gravar o teto, porque a falha é no meio e não tem volta.
 */
const TETO_COLUNA_AA = 999.99;

export default async function ({ dados }) {
  // `varrerTudo`, nunca `listar` com `por_pagina` grande: é a convenção escrita
  // em `003_receitas_fases_alocacoes.js` — *"o que não for copiado antes some
  // sem erro e sem volta"*. Aqui o risco é maior que num backfill de `estudos`,
  // porque `avancado_fases` guarda TODA linha de receita de TODO estudo da
  // instância: um teto fixo truncaria a varredura em silêncio e deixaria parte
  // dos estudos sem backfill, sem nada ficar vermelho. Exige shell 0.53.8, que
  // é o `shell_min` vigente.
  const estudos = await dados.varrerTudo('estudos');
  const alvos = estudos.filter(
    (e) => e.juros_tabela_aa_padrao === null || e.juros_tabela_aa_padrao === undefined,
  );
  if (alvos.length === 0) return;

  const fases = await dados.varrerTudo('avancado_fases');

  for (const estudo of alvos) {
    const linhas = fases
      .filter((f) => String(f.estudo_id) === String(estudo.id) && f.tipo === 'receita')
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));

    // Frequência por taxa, guardando a MENOR ordem em que ela apareceu — é o
    // desempate.
    const porTaxa = new Map();
    linhas.forEach((linha, posicao) => {
      const aa = jurosAaDaLinha(linha.fluxo_pagamento);
      // ⚠️ Só `null` é ausência. **0% explícito É voto**, e escrever o
      // contrário inverte o resultado no caso que mais importa: num estudo com
      // três linhas em 0% e uma em 12,5%, descartar os zeros elegia 12,5% e
      // ligava juros na MAIORIA das linhas — o oposto do que "a taxa mais
      // frequente" promete. É a mesma regra que o motor declarava antes da
      // #585: *"chave presente e igual a 0 é RESPOSTA, não ausência — é o
      // usuário tendo desligado os juros"*.
      if (aa === null) return;
      const k = chave(aa);
      const ja = porTaxa.get(k);
      if (ja) ja.n += 1;
      else porTaxa.set(k, { n: 1, primeira: posicao, aa });
    });
    // `size === 0` só acontece quando NENHUMA linha declara taxa — nem 0
    // explícito. Aí a coluna fica nula, que é o estado "nunca configurado".
    // Estudo cujas linhas dizem 0% explicitamente cai no ramo de baixo e grava
    // `0`: é diferente, e a diferença é registrada de propósito.
    if (porTaxa.size === 0) continue;

    // ⚠️ `primeira` é redundante com o `.sort()` acima — a ordem de inserção no
    // `Map` já é a de `ordem` crescente, e medido por mutação: apagar a
    // cláusula não muda nenhum resultado; apagar o `.sort()` muda. Ela fica
    // porque torna o critério EXPLÍCITO no lugar onde se lê o desempate, e
    // porque sobrevive a alguém trocar a estrutura de iteração.
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

    // `decimal(5,2)` — 2 casas e teto de 999,99, o que a coluna comporta.
    const bruto = Math.round(vencedora.aa * 100) / 100;
    const valor = Math.min(Math.max(bruto, 0), TETO_COLUNA_AA);
    await dados.atualizar('estudos', estudo.id, { juros_tabela_aa_padrao: valor });
  }
}
