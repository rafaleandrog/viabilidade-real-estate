import {
  componentesDoLegado, taxaMensalDoPlano,
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
  /**
   * #428 — juros de tabela do plano, em % a.a. UMA taxa por Grupo (D-Q02): a
   * mesma vai para todos os componentes financiados.
   *
   * ⚠️ OPCIONAL de propósito, e isto é contrato, não descuido. A chave só
   * existe no formulário quando existe no dado persistido ou quando o usuário
   * digita — `fluxoPagamentoParaSalvar` faz `{ ...form }`, então uma chave
   * sempre presente apareceria no JSON gravado de TODA linha, e um "Aplicar"
   * sem edição deixaria de ser byte-idêntico ao que estava lá (a regra de
   * classe da #431, `modais-json-regra-classe.test.ts`).
   *
   * Para LER a taxa efetiva — a chave se houver, senão a derivada dos
   * componentes persistidos — use `jurosTabelaAnualPct(form)`, nunca
   * `form.juros_tabela_aa` cru.
   */
  juros_tabela_aa?: number;
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
    // #428: só propaga a chave quando ela EXISTE no persistido. Ausente aqui,
    // o campo do modal mostra a taxa derivada dos componentes
    // (`jurosTabelaAnualPct`) e nada de novo entra no JSON até o usuário
    // digitar. Ver a nota de contrato em `FormularioPagamento`.
    ...(fp.juros_tabela_aa !== undefined && fp.juros_tabela_aa !== null
      ? { juros_tabela_aa: Number(fp.juros_tabela_aa) || 0 }
      : {}),
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
// #428 mudou o quarto da lista: `taxaMensal` GANHOU campo na tela. Ele não
// saiu da preservação — passou a ter um eixo. Enquanto o usuário não mexe no
// campo de juros, `taxaMensal` continua só-canônica e é transplantada
// componente a componente; no instante em que ele mexe, ela vira o que o
// formulário está dizendo e o valor digitado manda em todo o plano (D-Q02).
// Ver `camposSoCanonicos` e `taxaFoiEditada`.

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
function camposSoCanonicos(doador: any, taxaEditada: boolean): string[] {
  // #428 — a consequência direta de a taxa virar EDITÁVEL: no momento em que o
  // usuário mexe no campo, `taxaMensal` deixa de ser "o que o formulário não
  // sabe dizer" e passa a ser exatamente o que ele está dizendo. Continuar
  // transplantando-a do persistido faria o campo novo parecer funcionar e não
  // funcionar — o valor digitado seria sobrescrito pelo velho na volta.
  //
  // O eixo é o CAMPO TER SIDO EDITADO, não o campo existir. Com a taxa
  // intocada, `taxaMensal` segue só-canônica e o transplante a preserva
  // componente a componente — que é o que mantém de pé um plano com taxas
  // heterogêneas (residencial × não residencial da EVI) e o no-op da #431.
  const espelho: readonly string[] = taxaEditada
    ? [...CAMPOS_DO_ESPELHO, 'taxaMensal']
    : CAMPOS_DO_ESPELHO;
  return Object.keys(doador ?? {}).filter((k) => !espelho.includes(k));
}

/**
 * #428 — o usuário mexeu no campo de juros de tabela?
 *
 * Compara a taxa MENSAL que o formulário produz com a que o plano persistido
 * carrega, as duas por `taxaMensalDoPlano`, para que "não mexeu" seja
 * exatamente igual e não quase igual.
 *
 * A tolerância é rede: `taxaMensalDoPlano` foi escrita justamente para NÃO
 * fazer a ida e volta `mensal → % a.a. → mensal`, que devolve
 * `0,009863600000000083` no lugar de `0,0098636` e faria abrir-e-aplicar um
 * estudo legado ser lido como edição — achatando o plano inteiro na taxa do
 * primeiro componente e matando o no-op da #431 por arredondamento. Hoje os
 * dois lados são o mesmo número; 1e-12 garante que continue verdade se alguém
 * reintroduzir uma conversão no caminho. É folgado contra o float e apertado
 * contra usuário: 0,0001 ponto percentual ao ano já move a mensal em ~8e-9.
 */
const EPS_TAXA_MENSAL = 1e-12;
function taxaFoiEditada(form: FormularioPagamento, persistidos: ComponentePagamento[]): boolean {
  // Revisao da #428, B1 — porta 1: a AUSENCIA da chave e o sinal de "nao
  // tocou". `_setJurosTabela` e o unico caminho que a escreve, e
  // `formularioPagamento` so a propaga quando ela ja estava no persistido —
  // entao chave ausente significa, com certeza, que o campo nao foi mexido
  // nesta sessao de modal. E ela que mantem de pe o no-op byte-identico da
  // #431 num plano de taxas heterogeneas.
  if (form.juros_tabela_aa === undefined || form.juros_tabela_aa === null) return false;

  // Porta 2: com a chave presente, "editado" e o plano AINDA NAO ESTAR todo na
  // taxa do campo. A versao anterior comparava so com a PRIMEIRA taxa
  // persistida, e por isso ficava inerte no caso que mais importa: num plano
  // heterogeneo (residencial 12,5% x nao residencial 13% da EVI) quem digitava
  // 12,5 justamente para UNIFORMIZAR o plano batia com o primeiro componente,
  // era lido como "nao editou", caia no no-op — e gravava
  // `juros_tabela_aa: 12.5` sobre componentes que seguiam em 13%. A chave
  // passava a contradizer o dado, e digitar 12,5 de novo nunca consertava.
  const doForm = taxaMensalDoPlano(form);
  return persistidos.some((c: any) => {
    if (!c || !('taxaMensal' in c)) return false;   // `imediato` nao tem taxa, e nao deve ter
    const t = Number(c.taxaMensal);
    // Taxa persistida ilegivel conta como divergencia: e melhor reescrever com
    // o que o usuario digitou do que preservar lixo em silencio.
    return !Number.isFinite(t) || Math.abs(t - doForm) > EPS_TAXA_MENSAL;
  });
}

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
): ComponentePagamento[] {
  const regenerados = componentesDoLegado(form, cronograma);
  const persistidos = Array.isArray(form.componentes) && form.componentes.length > 0
    ? form.componentes
    : null;
  if (!persistidos) return regenerados;                                   // caso 1

  const copia = (c: any): ComponentePagamento => ({ ...c }) as ComponentePagamento;
  const taxaEditada = taxaFoiEditada(form, persistidos);

  // Guarda: sem espelho legado nenhum, não há edição a interpretar.
  if (form.entrada.length === 0 && form.parcelas.length === 0) {
    if (!taxaEditada) return persistidos.map(copia);
    // #428: não há espelho de onde regenerar, mas a taxa é campo do PLANO e o
    // usuário mexeu nela. Aplicá-la onde ela cabe é o mínimo — devolver o
    // persistido verbatim deixaria o campo inerte justamente na linha
    // "Tabela longa" do estudo 5, que é `entrada: []` com repasse derivado.
    const nova = taxaMensalDoPlano(form);
    return persistidos.map((c) => {
      const saida = copia(c) as any;
      if ('taxaMensal' in saida) saida.taxaMensal = nova;  // `imediato` não tem, e não deve ter
      return saida as ComponentePagamento;
    });
  }

  const mesmaEstrutura = regenerados.length === persistidos.length
    && regenerados.every((r, i) => projecaoDoEspelho(r) === projecaoDoEspelho(persistidos[i]));
  // #428: `projecaoDoEspelho` NÃO inclui `taxaMensal` de propósito — ela é o
  // pareamento por identidade, e parear por taxa faria uma troca de juros
  // desalinhar componente com componente. Quem tira a taxa do no-op é este
  // `&& !taxaEditada`: sem ele, digitar 13% num plano cuja estrutura não mudou
  // cairia no caso 2, devolveria o persistido verbatim e o campo seria inerte.
  if (mesmaEstrutura && !taxaEditada) return persistidos.map(copia);      // caso 2

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
    for (const campo of camposSoCanonicos(doador, taxaEditada)) {
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
  // Revisao da #428, B2 — a taxa alimenta TODO componente financiado do plano,
  // e ate aqui nada a validava: `viab-num` aceita o sinal de menos
  // (`parseNumeroBR` preserva `-`), e `-150` produzia `NaN` que virava `null`
  // no JSON, apagando a taxa persistida. Bloquear no formulario e o que
  // desabilita o "Aplicar"; o motor tem a sua propria defesa em
  // `taxaMensalDeAnual`.
  if (form.juros_tabela_aa !== undefined && form.juros_tabela_aa !== null) {
    const aa = Number(form.juros_tabela_aa);
    if (!Number.isFinite(aa) || aa < 0) {
      return 'Os juros de tabela devem ser um percentual ao ano maior ou igual a zero.';
    }
  }
  const somaInformada = [...form.entrada, ...form.parcelas].reduce((s, item) => s + n(item.pct), 0);
  if (somaInformada > 100.01) {
    return `Entrada e parcelamento somam ${somaInformada.toFixed(2)}%; o total não pode superar 100%.`;
  }
  // #431: valida O ARRAY QUE VAI SER GRAVADO, não uma projeção parecida.
  // Enquanto `fluxoPagamentoParaSalvar` regenerava tudo pelo espelho, chamar
  // `componentesDoLegado` aqui era coincidentemente certo; depois do conserto,
  // deixá-lo faria o modal aprovar um array e persistir outro.
  const componentes = componentesParaSalvar(form, cronograma);
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
): Omit<FormularioPagamento, 'componentes'> & { componentes: ComponentePagamento[]; aplicado: true } {
  return {
    ...form,
    entrada: form.entrada.map((e) => ({ ...e })),
    parcelas: form.parcelas.map((p) => ({ ...p, periodicidade: p.periodicidade || 'mensal' })),
    repasse: { ...form.repasse },
    // #431: `componentesParaSalvar`, não `componentesDoLegado` — é esta linha
    // que faz "Aplicar" parar de apagar os juros de tabela.
    componentes: componentesParaSalvar(form, cronograma),
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
/**
 * #428 (revisao, B3) — as taxas de tabela DISTINTAS do plano, **contando o
 * zero**, entre os componentes que tem `taxaMensal` (os financiados).
 *
 * Irma de `jurosDeTabelaConfigurados` e deliberadamente diferente dela numa
 * coisa so: aquela existe para o bloco somente-leitura da #436 — "revelar
 * juros que EXISTEM" — e por isso descarta taxa zero, o que esta certo la.
 * Como gatilho do aviso do campo unico, esse mesmo filtro erra, e erra no caso
 * de maior dinheiro: a linha "Tabela longa" do estudo 5 tem 12,5% no
 * `ate_marco` (30% do plano) e **0% no Repasse** (70%). Com o zero descartado
 * o aviso nao aparecia, e quem mexesse a taxa de 12,5 para 13 ligava juros em
 * 70% do plano que estavam desligados — sem ver nada. O saldo a repassar
 * capitalizado e o maior item de juros da EVI.
 *
 * O agrupamento usa a mesma chave de 1 casa de `jurosDeTabelaConfigurados`:
 * duas taxas que so divergem alem da casa exibida nao sao "diferentes" para
 * quem le a tela, e prometer o contrario seria aviso que nao se pode honrar.
 */
export function taxasDistintasDoPlano(fluxoPagamento: any): JurosDeTabela[] {
  const comps = Array.isArray(fluxoPagamento?.componentes) ? fluxoPagamento.componentes : [];
  const porTaxa = new Map<number, JurosDeTabela>();
  for (const c of comps) {
    // Componente sem `taxaMensal` (`imediato`) nao entra: ele nao tem taxa a
    // divergir, e conta-lo faria todo plano com pagamento no ato parecer
    // heterogeneo.
    if (!c || !('taxaMensal' in c)) continue;
    const mensal = Number(c.taxaMensal);
    const anualPct = Number.isFinite(mensal) && mensal !== 0 ? (Math.pow(1 + mensal, 12) - 1) * 100 : 0;
    const chave = Math.round(anualPct * 10) / 10;
    const rotulo = typeof c?.rotulo === 'string' && c.rotulo.trim() !== '' ? c.rotulo : String(c?.tipo ?? 'componente');
    const ja = porTaxa.get(chave);
    if (ja) ja.rotulos.push(rotulo);
    else porTaxa.set(chave, { anualPct, rotulos: [rotulo] });
  }
  return [...porTaxa.values()];
}

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
