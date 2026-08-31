import {
  componentesDoLegado, taxaMensalDoEstudo,
  type ComponentePagamento, type ResiduoAteMarco,
} from './fluxo-caixa-motor.js';
import type { EventoCrono } from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;
const lista = (v: any): any[] => Array.isArray(v)
  ? v.map((x) => ({ ...x }))
  : (v && typeof v === 'object' ? [{ ...v }] : []);

export interface FormularioPagamento {
  comissao: { ativo: boolean; tipo: string; pct: number };
  // #452: o sub-objeto de RET por linha SAIU do tipo e da leitura. A #346
  // tornou a RET global do estudo (`considerar_ret`/`ret_pct`, fora da linha),
  // mas `fluxoPagamentoParaSalvar` continuava regravando o sub-objeto morto
  // pelo spread `{ ...form }` — tirar só a leitura não bastava, o campo tinha
  // de sumir do tipo para o spread parar de reproduzi-lo.
  entrada: any[];
  parcelas: any[];
  // #345: apos_entrega_meses deixou de ser lido pelo motor (repasse travado
  // em 1 mês após o fim da obra, sempre). O campo sobrevive só como
  // passagem para não descartar o valor persistido de estudo legado — sem
  // migração, sem efeito no cálculo, sem controle editável na UI.
  repasse: { apos_entrega_meses: number };
  /**
   * #431 — MEMÓRIA do que este formulário não sabe editar. Não é campo
   * editável e não tem controle na tela: é o array canônico que veio
   * persistido na linha, guardado para que `componentesParaSalvar` saiba o
   * que preservar. `null` quando a linha nunca teve `componentes` — aí o
   * espelho legado é a única fonte e a regeneração é integral.
   */
  componentes: ComponentePagamento[] | null;
  // #585 — a chave `juros_tabela_aa` SAIU deste tipo. Ela era a taxa por
  // Grupo da #428 (D-Q02), e a decisão do autor de 2026-08-26 tornou a taxa
  // um valor do ESTUDO (`estudos.juros_tabela_aa_padrao`, aba Viabilidade →
  // Financeiro). O modal não a edita mais, e o formulário não a carrega:
  // tirá-la só da leitura não bastaria — `fluxoPagamentoParaSalvar` faz
  // `{ ...form }`, e o campo tinha de sumir do TIPO para o spread parar de
  // reproduzi-lo. É a mesma lição que o `ret` de linha ensinou na #452, logo
  // acima.
  /**
   * #460 — destino do resíduo de um `ate_marco` sem prazo (venda contratada
   * no mês do marco ou depois, `N_s ≤ 0`): rolar para o `concentrado` da
   * mesma linha (a regra da EVI, `cfINC!AH`) ou virar `imediato` (o
   * comportamento de sempre, e o default quando a chave não existe).
   *
   * ⚠️ OPCIONAL de propósito, MESMA disciplina do `juros_tabela_aa`: a chave
   * só existe no formulário quando já existia no persistido ou quando o
   * usuário escolhe no controle novo. Presente sempre, ela apareceria no JSON
   * de toda linha aplicada — e o "Aplicar" sem edição deixaria de ser
   * byte-idêntico (a regra de classe da #431). Este campo não afeta
   * `componentesParaSalvar`: ele não descreve NENHUM componente, só é lido
   * direto de `fluxo_pagamento.residuoAteMarco` pelo motor
   * (`componentesIntegradosSafra`), no momento do cálculo.
   */
  residuoAteMarco?: ResiduoAteMarco;
}

/**
 * #248: abre tanto o shape legado quanto o contrato canônico criado pela
 * própria tela. Durante a transição até #283, escritas novas mantêm o espelho
 * legado; ele garante que o motor vigente continue calculando exatamente o
 * mesmo fluxo enquanto `componentes` passa a ser a fonte canônica persistida.
 */
export function formularioPagamento(fluxoPagamento: any): FormularioPagamento {
  const fp = fluxoPagamento ?? {};
  // #431: o array canônico persistido, se houver. É ele que decide se os
  // placeholders abaixo podem nascer — e é ele que `componentesParaSalvar`
  // preserva.
  const componentes: ComponentePagamento[] | null =
    Array.isArray(fp.componentes) && fp.componentes.length > 0
      ? fp.componentes.map((c: any) => ({ ...c })) as ComponentePagamento[]
      : null;
  const entradas = lista(fp.entrada);
  const parcelas = lista(fp.parcelas);
  // #431 (Metade 1) — o placeholder de 15% só nasce em linha NOVA.
  //
  // Numa linha que já tem `componentes` canônicos, `entrada: []` não é
  // "ninguém configurou ainda": é "esta linha NÃO tem entrada". Fabricar 15%
  // aqui reescrevia o plano antes de o usuário tocar em nada — a linha
  // "Tabela longa" do estudo 5 (`entrada: []`, parcelamento 30%, repasse 70%)
  // abria mostrando uma entrada de 15% que não existe no dado, a validação
  // fechava em 100% porque `pctRepasseDerivado` caía para 55%, e "Aplicar"
  // gravava 15/30/55 no lugar de 0/30/70.
  //
  // São DOIS placeholders, e os dois têm o mesmo defeito: o de `entrada` e o
  // de `parcelas`. `componentes` manda nos dois.
  const semCanonicos = componentes === null;
  return {
    comissao: {
      ativo: fp.comissao?.ativo ?? true,
      tipo: fp.comissao?.tipo ?? 'embutida',
      pct: n(fp.comissao?.pct),
    },
    entrada: entradas.length || !semCanonicos ? entradas : [{ pct: 15, parcelas: 1, descontoPct: 0 }],
    parcelas: parcelas.length || !semCanonicos
      ? parcelas
      : [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 15 }],
    repasse: { apos_entrega_meses: n(fp.repasse?.apos_entrega_meses) },
    componentes,
    // #460: mesmo padrão — a chave só nasce no formulário se já existia no
    // persistido. Ver a nota de contrato em `FormularioPagamento`.
    ...(fp.residuoAteMarco === 'concentrado' || fp.residuoAteMarco === 'imediato'
      ? { residuoAteMarco: fp.residuoAteMarco as ResiduoAteMarco }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// #431 — o formulário é uma PROJEÇÃO do dado, não o dado
// ─────────────────────────────────────────────────────────────────────────
//
// A regra da classe, enunciada na issue: abrir um modal e aplicar sem alterar
// campo nenhum é NO-OP; e quando o usuário edita de verdade, o que o
// formulário não sabe representar SOBREVIVE à regeneração.
//
// Aqui o formulário é o espelho legado (`entrada`/`parcelas`/`repasse`) e o
// dado é `componentes`. O espelho não tem onde guardar `sinalPct`,
// `jurosNoMesDaContratacao` nem `rotulo`, e a tela não tem campo para nenhum
// deles. Regenerar tudo pelo espelho, que era o comportamento até a #431,
// apagava-os em toda escrita.
//
// #428 tinha dado a `taxaMensal` um EIXO — "o usuário mexeu no campo de juros
// nesta sessão de modal?" —, e enquanto ele não mexia ela seguia só-canônica,
// transplantada componente a componente.
//
// #585 apagou esse eixo junto com o campo: a taxa é do ESTUDO agora, e
// `taxaMensal` deixou de ser dado da linha para virar projeção dele. Ela é
// **sempre** regenerada, nunca transplantada — ver `camposSoCanonicos`. A
// função `taxaFoiEditada`, que decidia o eixo, não existe mais (a nota de
// remoção está logo abaixo). Os outros três — `sinalPct`,
// `jurosNoMesDaContratacao`, `rotulo` — seguem preservados como sempre.

/**
 * Os campos que o espelho legado (`entrada`/`parcelas`/`repasse`) SABE dizer.
 * São eles, e só eles, que decidem se o usuário mexeu na ESTRUTURA do plano.
 *
 * `taxaMensal` fica fora desta lista mesmo depois da #428: ela não é produzida
 * pelo espelho legado, e sim por um campo próprio do cabeçalho do modal, com
 * eixo próprio (`taxaFoiEditada`). Misturá-la aqui quebraria o pareamento por
 * identidade — dois componentes com a mesma estrutura e taxas diferentes
 * deixariam de casar, e o transplante levaria a taxa para o componente errado.
 *
 * `sinalPct` ENTRA aqui desde a #455, e por um motivo diferente do de
 * `taxaMensal`: ele é um campo POR LINHA (a issue pede "editável por
 * componente"), não um campo único do plano inteiro. `componentesDoLegado`
 * já o lê direto de `parcelas[i].sinalPct` — o espelho SABE dizê-lo, então
 * ele se comporta exatamente como `pct`/`descontoPct`: identidade e no-op
 * cuidam dele sozinhos, sem precisar do eixo "foi editado" que `taxaMensal`
 * exige. (Entrada parcelada continua fixando `sinalPct: 0` — decisão
 * declarada em `componentesDoLegado`, não um campo editável ali.)
 */
const CAMPOS_DO_ESPELHO = [
  'tipo', 'participacaoPct', 'descontoPct', 'sinalPct', 'prazoMeses',
  'defasagemMeses', 'marcoMes', 'mesPagamento',
] as const;

/**
 * O que o transplante move é o COMPLEMENTO de `CAMPOS_DO_ESPELHO`: toda chave
 * que o componente persistido tenha e que o formulário não saiba produzir.
 * Hoje isso dá `jurosNoMesDaContratacao`, `rotulo` e — só enquanto o campo de
 * juros não for tocado — `taxaMensal`. (`sinalPct` SAIU desta lista na #455:
 * o espelho passou a sabê-lo, então ele não é mais só-canônico.)
 *
 * ⚠️ É de propósito que este conjunto seja DERIVADO e não uma lista fechada.
 * Uma lista fechada envelheceria calada: no dia em que o contrato canônico
 * ganhar um quinto campo, ele começaria a ser apagado em toda edição, sem
 * nenhum teste ficar vermelho — exatamente o defeito que esta issue conserta,
 * de volta por outra porta.
 */
function camposSoCanonicos(doador: any): string[] {
  // #585 — `taxaMensal` deixou de ser só-canônica, SEMPRE, e não mais só
  // quando o usuário mexia no campo. Ela não é dado da linha: é projeção da
  // taxa do ESTUDO, e `componentesDoLegado` a regenera em todo componente
  // financiado a partir do 3º argumento. Transplantá-la do persistido
  // reintroduziria a taxa antiga por cima da nova — o campo da aba Financeiro
  // pareceria funcionar e não funcionaria.
  //
  // ⚠️ O eixo anterior (#428) era "o campo foi editado nesta sessão de modal",
  // e ele mantinha de pé um plano com taxas heterogêneas (residencial × não
  // residencial da EVI). Esse cenário deixou de ser representável por decisão
  // do autor — ver a nota em `taxaMensalDoEstudo`.
  const espelho: readonly string[] = [...CAMPOS_DO_ESPELHO, 'taxaMensal'];
  return Object.keys(doador ?? {}).filter((k) => !espelho.includes(k));
}

// #585 — `taxaFoiEditada` FOI REMOVIDA junto com o campo do modal. Ela
// respondia "o usuário mexeu no campo de juros de tabela?", e o campo não
// existe mais: a taxa é do estudo, entra por `componentesDoLegado` e vale para
// toda linha. Com ela sai também a constante `EPS_TAXA_MENSAL`, que existia só
// para essa comparação.

/** Assinatura de um componente restrita ao que o espelho legado enxerga. */
function projecaoDoEspelho(c: any): string {
  return JSON.stringify(CAMPOS_DO_ESPELHO.map((k) => (c?.[k] === undefined ? null : c[k])));
}

/**
 * Quantos campos do espelho dois componentes têm iguais. É o desempate do
 * passe 2 do transplante.
 *
 * Existe porque `find` guloso — "o primeiro doador não usado daquele tipo" —
 * escolhe errado quando há mais de um candidato: apagar a 1ª de duas linhas
 * `prazo_fixo` e mexer no percentual da que sobrou fazia a sobrevivente herdar
 * `taxaMensal` e `rotulo` da linha APAGADA, porque ela era a primeira da fila.
 * Comparar semelhança faz a sobrevivente achar o doador que de fato é dela.
 */
function semelhancaDeEspelho(a: any, b: any): number {
  return CAMPOS_DO_ESPELHO.reduce((n, k) => {
    const va = a?.[k] === undefined ? null : a[k];
    const vb = b?.[k] === undefined ? null : b[k];
    return n + (va === vb ? 1 : 0);
  }, 0);
}

/**
 * Decide o array de `componentes` que uma escrita do modal deve gravar.
 *
 * Três casos, em ordem:
 *
 *  1. linha SEM `componentes` persistidos → regenera pelo espelho legado, que
 *     é o comportamento de sempre (e o único possível: não há o que preservar);
 *  2. o regenerado tem a MESMA estrutura do persistido → devolve o persistido
 *     verbatim. É o no-op: abrir e aplicar sem mexer não move um bit — nem a
 *     ORDEM das chaves de cada componente, que o caso 3 reordenaria (ele monta
 *     o objeto a partir do regenerado). O critério de aceite da issue é um
 *     `GET` byte-idêntico, e byte-idêntico é mais forte que `deepEqual`;
 *  3. o usuário mexeu de verdade no espelho → regenera e TRANSPLANTA os campos
 *     só-canônicos dos componentes persistidos para os regenerados.
 *
 * Mais uma guarda, antes do caso 2: espelho legado inteiramente vazio (sem
 * `entrada` e sem `parcelas`) não tem de onde regenerar — `componentesDoLegado`
 * devolveria um repasse de 100% que ninguém pediu. O persistido fica de pé.
 *
 * 🔴 O transplante do caso 3 é por IDENTIDADE, nunca por índice. Parear por
 * posição faz "Adicionar entrada" deslocar todo mundo e matar a taxa dos
 * componentes preexistentes — o mesmo dano que esta função existe para
 * impedir, a um clique de distância. São dois passes: casamento exato de
 * estrutura primeiro, depois mesmo `tipo` escolhendo o doador MAIS PARECIDO
 * (`semelhancaDeEspelho`), com empate pela ordem de aparição.
 *
 * ⚠️ LIMITE DECLARADO, e ele é irredutível sem identidade estável de linha:
 * **permutar valores entre duas linhas do mesmo `tipo` move o campo
 * só-canônico junto com o VALOR, não com a linha.** Dois `prazo_fixo` de 30% e
 * 70% com taxas diferentes: se o usuário digita 70 na primeira e 30 na
 * segunda, o passe 1 casa a primeira regenerada com o componente que tinha 70%
 * — e a taxa troca de linha. Não há como distinguir isso de "o usuário
 * reordenou as duas linhas", que produz entrada byte-idêntica e cujo
 * comportamento correto é justamente esse (é o teste `identidade: REORDENAR`).
 * O espelho legado não guarda identidade de linha; enquanto não guardar, um
 * dos dois casos tem de perder, e o escolhido é o mais raro. Fixado por teste
 * para não virar surpresa.
 *
 * O que o caso 3 transplanta não é uma lista fixa de quatro campos: é TUDO o
 * que o doador carrega e o espelho legado não sabe produzir (ver
 * `camposSoCanonicos`).
 *
 * ⚠️ Componente regenerado que NÃO acha doador fica com o que o formulário
 * disser. Até a #428 isso era sempre `taxaMensal: 0`, e o comentário aqui
 * defendia esse zero contra "herdar a taxa do plano" — a defesa era de que
 * herdar fabricaria juros que ninguém pediu. Com a #428 a taxa do plano deixou
 * de ser fabricação: é um campo que o usuário preencheu, e `componentesDoLegado`
 * a escreve em todo componente financiado que gerar, novo ou não (D-Q02). Num
 * plano sem juros o resultado é literalmente o mesmo `0` de antes.
 */
export function componentesParaSalvar(
  form: FormularioPagamento,
  cronograma: EventoCrono[],
  // #585: OBRIGATÓRIO — a taxa de tabela do estudo. Omitir vira TS2554.
  jurosTabelaAaEstudo: number,
): ComponentePagamento[] {
  const regenerados = componentesDoLegado(form, cronograma, jurosTabelaAaEstudo);
  const persistidos = Array.isArray(form.componentes) && form.componentes.length > 0
    ? form.componentes
    : null;
  if (!persistidos) return regenerados;                                   // caso 1

  const copia = (c: any): ComponentePagamento => ({ ...c }) as ComponentePagamento;
  // #585: a taxa do ESTUDO é aplicada em toda saída, inclusive nos caminhos
  // que preservam o persistido verbatim. Sem isto, o array gravado ficaria
  // com a taxa antiga enquanto o motor calcula com a nova — dado
  // contradizendo cálculo, que é pior que qualquer um dos dois.
  const taxaMensal = taxaMensalDoEstudo(jurosTabelaAaEstudo);
  // #585 (rodada 2): por TIPO, não por presença da chave — mesma correção que
  // `componentesPagamento` recebeu, e pelo mesmo motivo. O backend aceita
  // componente financiado sem `taxaMensal`; testar a chave deixava essa linha
  // sem a taxa do estudo, no dado gravado e no cálculo.
  const comTaxaDoEstudo = (c: any): ComponentePagamento => {
    const saida = copia(c) as any;
    if (saida?.tipo !== 'imediato') saida.taxaMensal = taxaMensal;  // `imediato` paga no mês da venda
    return saida as ComponentePagamento;
  };

  // Guarda: sem espelho legado nenhum, não há edição a interpretar.
  if (form.entrada.length === 0 && form.parcelas.length === 0) {
    return persistidos.map(comTaxaDoEstudo);
  }

  const mesmaEstrutura = regenerados.length === persistidos.length
    && regenerados.every((r, i) => projecaoDoEspelho(r) === projecaoDoEspelho(persistidos[i]));
  // #428: `projecaoDoEspelho` NÃO inclui `taxaMensal` de propósito — ela é o
  // pareamento por identidade, e parear por taxa faria uma troca de juros
  // desalinhar componente com componente.
  // #585: o caso 2 preserva o persistido, MENOS a taxa — ver `comTaxaDoEstudo`.
  if (mesmaEstrutura) return persistidos.map(comTaxaDoEstudo);            // caso 2

  // caso 3 — regenera e transplanta por identidade
  const doadores = persistidos.map((c) => ({ c: c as any, usado: false }));
  const parDe: (any | null)[] = regenerados.map(() => null);
  // passe 1 — casamento EXATO da projeção do espelho
  regenerados.forEach((r, i) => {
    const chave = projecaoDoEspelho(r);
    const d = doadores.find((x) => !x.usado && projecaoDoEspelho(x.c) === chave);
    if (d) { d.usado = true; parDe[i] = d.c; }
  });
  // passe 2 — mesmo `tipo`, escolhendo o doador MAIS PARECIDO, não o primeiro
  // da fila. Empate resolve pela ordem de aparição, que é o critério antigo.
  regenerados.forEach((r, i) => {
    if (parDe[i]) return;
    let melhor: { c: any; usado: boolean } | null = null;
    let melhorNota = -1;
    for (const x of doadores) {
      if (x.usado || x.c?.tipo !== (r as any).tipo) continue;
      const nota = semelhancaDeEspelho(r, x.c);
      if (nota > melhorNota) { melhorNota = nota; melhor = x; }
    }
    if (melhor) { melhor.usado = true; parDe[i] = melhor.c; }
  });
  return regenerados.map((r, i) => {
    const doador = parDe[i];
    if (!doador) return r;
    const saida: any = { ...r };
    for (const campo of camposSoCanonicos(doador)) {
      if (doador[campo] !== undefined) saida[campo] = doador[campo];
    }
    return saida as ComponentePagamento;
  });
}

function percentualValido(v: any): boolean {
  const valor = Number(v);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

/** Validação local bloqueante; o backend repete o contrato por segurança. */
export function erroFormularioPagamento(form: FormularioPagamento, cronograma: EventoCrono[]): string | null {
  for (const e of form.entrada) {
    if (!percentualValido(e.pct)) return 'Cada percentual de entrada deve ficar entre 0% e 100%.';
    if (!Number.isInteger(Number(e.parcelas)) || Number(e.parcelas) < 1) {
      return 'A quantidade de parcelas da entrada deve ser um inteiro maior que zero.';
    }
  }
  for (const p of form.parcelas) {
    if (!percentualValido(p.pct)) return 'Cada percentual de parcelamento deve ficar entre 0% e 100%.';
    if (!p.ao_longo_obra && (!Number.isInteger(Number(p.parcelas)) || Number(p.parcelas) < 1)) {
      return 'O prazo fixo deve ter ao menos uma parcela mensal.';
    }
  }
  // #585: a validacao da taxa saiu daqui junto com o campo — ela e do ESTUDO
  // agora, e quem a valida e a aba Financeiro. A defesa de dominio do motor
  // (`taxaMensalDeAnual`, que devolve 0 para aa <= -100 em vez de NaN)
  // continua onde estava, e e ela que impede o NaN de virar `null` no JSON.
  const somaInformada = [...form.entrada, ...form.parcelas].reduce((s, item) => s + n(item.pct), 0);
  if (somaInformada > 100.01) {
    return `Entrada e parcelamento somam ${somaInformada.toFixed(2)}%; o total não pode superar 100%.`;
  }
  // #431: valida O ARRAY QUE VAI SER GRAVADO, não uma projeção parecida.
  // Enquanto `fluxoPagamentoParaSalvar` regenerava tudo pelo espelho, chamar
  // `componentesDoLegado` aqui era coincidentemente certo; depois do conserto,
  // deixá-lo faria o modal aprovar um array e persistir outro.
  const componentes = componentesParaSalvar(form, cronograma, 0);
  const somaComponentes = componentes.reduce((s, c) => s + n(c.participacaoPct), 0);
  if (Math.abs(somaComponentes - 100) > 0.01) {
    return `A soma dos componentes deve ser 100% (atual: ${somaComponentes.toFixed(2)}%).`;
  }
  return null;
}

/**
 * Persiste o contrato canônico e, temporariamente, o espelho legado. O espelho
 * será removível quando #283 ligar `componentes` ao cálculo consolidado.
 *
 * #431: o array canônico sai de `componentesParaSalvar`, que preserva o que o
 * espelho legado não sabe representar. Antes desta issue ele saía direto de
 * `componentesDoLegado`, e toda escrita zerava `taxaMensal`/`sinalPct`.
 */
export function fluxoPagamentoParaSalvar(
  form: FormularioPagamento,
  cronograma: EventoCrono[],
  // #585: OBRIGATÓRIO — a taxa de tabela do estudo. Omitir vira TS2554.
  jurosTabelaAaEstudo: number,
): Omit<FormularioPagamento, 'componentes'> & { componentes: ComponentePagamento[]; aplicado: true } {
  // #585: `juros_tabela_aa` saiu de `FormularioPagamento`, então este spread
  // já não a reproduz; o `delete` abaixo é para o dado LEGADO, que continua
  // nos JSONs gravados antes desta versão e é inerte desde ela. A primeira
  // escrita de cada linha o remove — nenhuma migração precisa varrer os JSONs
  // para isso.
  const semChaveLegada: any = { ...form };
  delete semChaveLegada.juros_tabela_aa;
  return {
    ...semChaveLegada,
    entrada: form.entrada.map((e) => ({ ...e })),
    parcelas: form.parcelas.map((p) => ({ ...p, periodicidade: p.periodicidade || 'mensal' })),
    repasse: { ...form.repasse },
    // #431: `componentesParaSalvar`, não `componentesDoLegado` — é esta linha
    // que faz "Aplicar" parar de apagar os juros de tabela.
    componentes: componentesParaSalvar(form, cronograma, jurosTabelaAaEstudo),
    aplicado: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// #436: juros de tabela já persistidos, em LEITURA
// ─────────────────────────────────────────────────────────────────────────

/** Uma taxa distinta encontrada nos componentes, com os componentes que a usam. */
export interface JurosDeTabela {
  /**
   * Taxa ANUAL equivalente, em pontos percentuais — `(1 + i_m)^12 − 1`, com
   * **precisão plena** (contrato C7: derivada não monetária arredonda só para
   * exibir). Quem exibe usa `fmtPct`, que dá 1 casa.
   */
  anualPct: number;
  /** Rótulo de cada componente que carrega esta taxa, na ordem em que aparecem. */
  rotulos: string[];
}

/**
 * Lê os juros de tabela que já estão persistidos em `fluxo_pagamento.componentes`
 * e os converte para taxa anual equivalente, agrupando por taxa.
 *
 * Existe porque hoje `taxaMensal` entra no resultado (VGV, margem, TIR) sem
 * aparecer em lugar nenhum da interface — o usuário lê a TIR e não tem como
 * descobrir de onde ela vem. Isto NÃO edita nem recalcula nada: só deixa de
 * esconder. O campo editável é issue própria, da qual esta é pré-requisito.
 *
 * Taxa `0` não entra: o bloco só existe para revelar juros que existem.
 * O agrupamento usa a taxa já arredondada para 1 casa — a mesma precisão em
 * que ela será exibida (contrato C7: % calculado carrega 1 casa) —, então
 * duas taxas que só divergem além da casa exibida aparecem como uma linha só,
 * que é o que a tela pode honestamente distinguir.
 */
// #585: `taxasDistintasDoPlano` FOI REMOVIDA. Ela respondia "este plano tem
// mais de uma taxa gravada?", e existia para UM consumidor: o aviso do modal de
// Fluxo de pagamento, que saiu junto com o campo de juros. Com uma taxa por
// ESTUDO não há plano heterogêneo a anunciar — a pergunta deixou de existir.
//
// A irmã `jurosDeTabelaConfigurados` (#436) fica: ela é anterior a este eixo e
// sua remoção não é escopo desta issue.

export function jurosDeTabelaConfigurados(fluxoPagamento: any): JurosDeTabela[] {
  const comps = Array.isArray(fluxoPagamento?.componentes) ? fluxoPagamento.componentes : [];
  const porTaxa = new Map<number, JurosDeTabela>();
  for (const c of comps) {
    const mensal = Number(c?.taxaMensal);
    if (!Number.isFinite(mensal) || mensal === 0) continue;
    const anualPct = (Math.pow(1 + mensal, 12) - 1) * 100;
    // A chave agrupa pela precisão EXIBIDA (1 casa) — duas taxas que só divergem
    // além dela aparecem numa linha só, que é o que a tela pode honestamente
    // distinguir. Mas o VALOR guardado é o cru: `anualPct` é derivada não
    // monetária, e o C7 manda carregar precisão plena e arredondar só para
    // exibir, o que `fmtPct` faz.
    const chave = Math.round(anualPct * 10) / 10;
    // ⚠️ E o filtro de "sem juros" é aqui, não só no `mensal === 0` acima: uma
    // taxa mensal minúscula (0,003% a.m. → 0,036% a.a.) exibiria
    // "0,0% a.a." acompanhada do aviso vermelho de destruição — anunciando juros
    // que a tela não consegue mostrar.
    if (chave === 0) continue;
    const rotulo = typeof c?.rotulo === 'string' && c.rotulo.trim() !== '' ? c.rotulo : String(c?.tipo ?? 'componente');
    const ja = porTaxa.get(chave);
    if (ja) ja.rotulos.push(rotulo);
    else porTaxa.set(chave, { anualPct, rotulos: [rotulo] });
  }
  return [...porTaxa.values()];
}
