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

/**
 * % a.a. de uma linha, na precedência da #428. `null` = **a linha não tem voto**
 * — porque não declara taxa, ou porque o que ela declara não é um percentual
 * que possa virar decisão.
 *
 * ⚠️ **Taxa NEGATIVA não vota, e essa escolha é o conserto de um defeito que a
 * primeira versão desta migração tinha.** Antes, ela era achatada em `0` por um
 * clamp no fim; combinada com a regra de que `0` é voto legítimo e definitivo,
 * o resultado era **dado sujo virando "0% intencional" permanente e
 * indistinguível de escolha do autor** — e imune a reexecução, porque o filtro
 * de idempotência só olha `null`. Medido: linha com `juros_tabela_aa: -5`
 * gravava `0` na coluna e a reexecução não voltava atrás.
 *
 * Nunca houve validação de domínio para essa chave (a da #428 vivia na tela, e
 * a do backend só chegou com a #585), então taxa negativa em dado legado ou
 * gravada por API é possível. (`-0` **vota**, e está certo: ele é zero, não um
 * número negativo — `-0 >= 0` é `true` em JS, e o valor gravado é `0`.) Ignorá-la deixa a coluna nula quando ela é a
 * única fonte — e nulo é o estado "nunca configurado", que o autor VÊ na tela e
 * pode corrigir. É o oposto de gravar um número plausível e errado.
 */
function jurosAaDaLinha(fluxoPagamento) {
  const fp = fluxoPagamento ?? {};
  if (fp.juros_tabela_aa !== undefined && fp.juros_tabela_aa !== null) {
    const bruto = fp.juros_tabela_aa;
    // ⚠️ String vazia (ou só espaços) NÃO é zero. `Number('')` devolve `0`, e
    // sem esta linha um `juros_tabela_aa: ''` — shape que a validação antiga da
    // API deixava passar dentro do `fluxo_pagamento` — virava voto de "0%
    // explícito" e gravava a coluna permanentemente. É a mesma lavagem de dado
    // sujo que a guarda de negativo existe para impedir, por outra porta.
    // Achado do revisor externo.
    // Só `number`, ou string que SEJA um decimal — não o que `Number()` aceita.
    // `Number('0x10')` é `16` e `Number('1e3')` é `1000`: hexadecimal e notação
    // científica passam por "string numérica" e viram voto. Nenhum dos dois é
    // percentual que alguém tenha digitado; são dado sujo com aparência de
    // resposta, a mesma classe que as guardas de negativo e de string vazia
    // fecham por outras portas. `Number('')` também é `0`, e o padrão abaixo
    // exige ao menos um dígito.
    if (typeof bruto !== 'number' && typeof bruto !== 'string') return null;
    if (typeof bruto === 'string' && !/^\s*-?\d+(\.\d+)?\s*$/.test(bruto)) return null;
    const aa = Number(bruto);
    return Number.isFinite(aa) && aa >= 0 ? aa : null;
  }
  const comps = Array.isArray(fp.componentes) ? fp.componentes : [];
  for (const c of comps) {
    const m = Number(c?.taxaMensal);
    if (!Number.isFinite(m) || m === 0) continue;
    // ⚠️ O SINAL é conferido em `m`, ANTES da potência — e não no `aa` que sai
    // dela. O expoente é 12, par: `(1 + m)^12` com `m = -2` devolve `1`, ou
    // seja `aa = 0`, e com `m = -3` devolve `4096`, ou seja `aa = 409.500%`.
    // Conferir só o derivado deixava passar exatamente o dado mais sujo — um
    // vira voto de "0% intencional", o outro é limitado ao teto e gravado como
    // taxa válida. Achado do revisor externo.
    if (m < 0) return null;
    return (Math.pow(1 + m, 12) - 1) * 100;
  }
  return null;
}

/**
 * Chave de agrupamento — **2 casas, a precisão em que a coluna persiste**
 * (`decimal(5,2)`), e é o valor que de fato vai ser gravado.
 *
 * ⚠️ Já foi 1 casa, "a mesma que a tela exibia", e estava errado: taxas que
 * diferem só na segunda casa caíam no mesmo grupo, e o candidato guardava a
 * PRIMEIRA `aa` vista. Uma linha a 12,51% e dez a 12,54% viravam um grupo só
 * cujo valor era 12,51% — a taxa menos frequente, gravada como se fosse a mais.
 * Agrupar numa precisão mais grossa que a persistida é sempre isso: fundir
 * candidatos que o destino sabe distinguir. Achado do revisor externo.
 */
function chave(aa) {
  return Math.round(aa * 100) / 100;
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

    // Frequência por taxa. A ordem de inserção é a de `ordem` crescente (o
    // `.sort()` acima), e é ela que resolve o empate.
    const porTaxa = new Map();
    for (const linha of linhas) {
      const aa = jurosAaDaLinha(linha.fluxo_pagamento);
      // ⚠️ Só `null` é ausência. **0% explícito É voto**, e escrever o
      // contrário inverte o resultado no caso que mais importa: num estudo com
      // três linhas em 0% e uma em 12,5%, descartar os zeros elegia 12,5% e
      // ligava juros na MAIORIA das linhas — o oposto do que "a taxa mais
      // frequente" promete. É a mesma regra que o motor declarava antes da
      // #585: *"chave presente e igual a 0 é RESPOSTA, não ausência — é o
      // usuário tendo desligado os juros"*.
      // `continue`, não `return`: este laço é `for...of` dentro do laço de
      // estudos, e um `return` aqui abortaria a migração INTEIRA no primeiro
      // estudo sem taxa. (Era `forEach` com `return`, onde a semântica é a de
      // pular a iteração — a troca de laço mudou o significado da mesma
      // palavra, e o harness pegou.)
      if (aa === null) continue;
      const k = chave(aa);
      const ja = porTaxa.get(k);
      if (ja) ja.n += 1;
      // Guarda a CHAVE, não a primeira `aa` vista: são o mesmo número agora que
      // a chave está na precisão persistida, e guardar a chave torna isso
      // impossível de divergir de novo.
      else porTaxa.set(k, { n: 1, aa: k });
    }
    // `size === 0` só acontece quando NENHUMA linha declara taxa — nem 0
    // explícito. Aí a coluna fica nula, que é o estado "nunca configurado".
    // Estudo cujas linhas dizem 0% explicitamente cai no ramo de baixo e grava
    // `0`: é diferente, e a diferença é registrada de propósito.
    if (porTaxa.size === 0) continue;

    // O desempate por `ordem` é o `.sort()` lá em cima, e só ele: a ordem de
    // inserção no `Map` já é a de `ordem` crescente, e `cand.n > vencedora.n`
    // (estrito) preserva o primeiro candidato visto quando há empate.
    //
    // ⚠️ Houve aqui uma cláusula `cand.primeira < vencedora.primeira`, escrita
    // para "tornar o critério explícito". Ela era **redundante e intestável**:
    // apagá-la não mudava resultado nenhum, em fixture nenhuma. Pior, o
    // comentário dela afirmava um resultado de mutação que deixou de valer no
    // mesmo dia — a fixture perdeu o empate de frequência que o sustentava.
    // Defesa que não pode ficar vermelha não é defesa; o que protege o
    // desempate é o caso do estudo 9 no harness, que derruba a remoção do
    // `.sort()`.
    let vencedora = null;
    for (const cand of porTaxa.values()) {
      if (vencedora === null || cand.n > vencedora.n) vencedora = cand;
    }

    // `vencedora.aa` já é a chave, portanto já está em 2 casas. Só o TETO
    // continua necessário — o piso saiu junto com o clamp para `0`, que era o
    // que lavava taxa negativa em "0% intencional" (ver `jurosAaDaLinha`).
    const valor = Math.min(vencedora.aa, TETO_COLUNA_AA);
    await dados.atualizar('estudos', estudo.id, { juros_tabela_aa_padrao: valor });
  }
}
