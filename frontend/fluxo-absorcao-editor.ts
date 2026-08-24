// ─────────────────────────────────────────────────────────────────────────
// #431 — o editor de Absorção, fora do componente
// ─────────────────────────────────────────────────────────────────────────
//
// POR QUE ESTE ARQUIVO EXISTE, e não é refactor de gosto: até esta issue a
// lógica do modal de Absorção morava em `_abrirAbsorcao` e `_absorcaoJson`,
// dois métodos PRIVADOS de um `LitElement`. Nenhum `.test.ts` deste repositório
// importa componente — todos importam função pura exportada —, então o
// comportamento do modal não era verificável por teste nenhum. O modal de
// Pagamento só é testável porque a mesma extração já tinha sido feita nele
// (`fluxo-pagamento-editor.ts`); este arquivo é o espelho daquele.
//
// A REGRA DA CLASSE que os dois honram:
//
//   abrir um modal e aplicar sem alterar campo nenhum é NO-OP — o JSON
//   persistido resultante é `deepEqual` ao de entrada, e aplicar de novo sobre
//   o que foi gravado também não move nada;
//
//   e quando o usuário edita de verdade, o que o formulário NÃO SABE
//   REPRESENTAR sobrevive à regeneração. O formulário é uma projeção do dado,
//   não o dado.
//
// Aqui a projeção são quatro grandezas — a correção de estoque e os três
// percentuais de bloco — e o dado é o registro inteiro de `absorcao`, que pode
// estar em `modo: 'personalizado'` com uma curva própria em `meses[]`. Essa
// curva foi escrita pela PRÓPRIA app (o commit `2c0e793` tinha o seletor
// "Personalizado" na tela; a UI perdeu o modo depois e o motor continuou
// lendo), e o motor a consome até hoje em `absorcaoMensal`
// (`fluxo-shared.ts`). Reconstruir o JSON a partir do formulário apagava a
// curva inteira — 43 pontos, no estudo 6 de Pinguim — sem aviso e sem undo.
//
// O que este módulo NÃO faz: dar superfície para editar a curva ponto a ponto.
// Isso é feature; esta issue só impede a destruição.

/** A projeção que o formulário sabe carregar — e só ela. */
export interface FormularioAbsorcao {
  correcao_estoque: boolean;
  pre_lancamento_pct: number;
  lancamento_pct: number;
  obra_pct: number;
  /**
   * #431 — MEMÓRIA do que foi LIDO do persistido, antes de qualquer ajuste de
   * apresentação. Não é campo editável e não tem controle na tela: é a
   * referência contra a qual se decide se o usuário mexeu em alguma coisa.
   *
   * Guardar o valor CRU importa por causa do #347: quando o Cronograma não tem
   * a fase Pré-lançamento, a tela zera `pre_lancamento_pct` ao abrir, de
   * propósito (um percentual ali seria venda que desaparece em silêncio). Esse
   * zero é uma EDIÇÃO deliberada do app, e tem de contar como edição — se
   * `lido` guardasse o valor já zerado, o no-op engoliria a correção do #347 e
   * o percentual perdido continuaria gravado para sempre.
   */
  lido: ProjecaoAbsorcao;
}

/** As quatro grandezas que o formulário lê e escreve. */
export interface ProjecaoAbsorcao {
  correcao_estoque: boolean;
  pre_lancamento_pct: number;
  lancamento_pct: number;
  obra_pct: number;
}

const n = (v: any): number => Number(v) || 0;

/** Lê o % de um bloco de absorção por chave de evento (0 se ausente). */
function pctBloco(absorcao: any, evento: string): number {
  const blocos = Array.isArray(absorcao?.blocos) ? absorcao.blocos : [];
  return n((blocos.find((b: any) => b?.evento === evento) || {}).pct);
}

/**
 * Projeta o registro persistido de `absorcao` no formulário do modal.
 *
 * `temPreLancamento` vem do Cronograma (#330/#347): sem a fase, a linha some da
 * tela e o percentual é apresentado zerado. O valor cru continua em `lido`.
 *
 * ⚠️ `temPreLancamento` é OBRIGATÓRIO de propósito — não tem default. Com um
 * default, apagar `this._temPreLancamento()` da chamada da tela passava por
 * typecheck, pelos testes de unidade e pelos de render, e o estrago era mudo e
 * ao contrário do que a intuição diz: o formulário deixaria de zerar o
 * percentual legado, `editouOsBlocos` deixaria de acusar a zeragem deliberada
 * da #347, e aí o no-op da #431 ENGOLIRIA a correção — gravando para sempre o
 * percentual que a #347 existe para remover. Sem default, a omissão é erro de
 * compilação. Quem chama de teste passa `true` explicitamente.
 */
export function formularioAbsorcao(absorcao: any, temPreLancamento: boolean): FormularioAbsorcao {
  const lido: ProjecaoAbsorcao = {
    correcao_estoque: Boolean(absorcao?.correcao_estoque),
    pre_lancamento_pct: pctBloco(absorcao, 'pre_lancamento'),
    lancamento_pct: pctBloco(absorcao, 'lancamento'),
    obra_pct: pctBloco(absorcao, 'obra'),
  };
  return {
    ...lido,
    pre_lancamento_pct: temPreLancamento ? lido.pre_lancamento_pct : 0,
    lido,
  };
}

/** Os três percentuais de bloco mudaram em relação ao que foi lido? */
function editouOsBlocos(form: FormularioAbsorcao): boolean {
  return n(form.pre_lancamento_pct) !== n(form.lido.pre_lancamento_pct)
    || n(form.lancamento_pct) !== n(form.lido.lancamento_pct)
    || n(form.obra_pct) !== n(form.lido.obra_pct);
}

/** O registro tem alguma coisa que valha a pena preservar? */
function temDadoPreservavel(persistido: any): boolean {
  return Boolean(persistido) && typeof persistido === 'object'
    && (persistido.modo !== undefined
      || Array.isArray(persistido.blocos)
      || Array.isArray(persistido.meses));
}

/**
 * O registro persistido carrega uma curva que este formulário não sabe
 * desenhar? Devolve o modo e quantos pontos seriam descartados, ou `null`.
 *
 * É o que a tela usa para avisar ANTES de aplicar, e para pedir confirmação
 * explícita. Um `modo` diferente de `distribuido` já basta: o formulário só
 * sabe produzir `distribuido`.
 */
export function curvaNaoRepresentavel(persistido: any): { modo: string; pontos: number } | null {
  const modo = persistido?.modo;
  if (typeof modo !== 'string' || modo === '' || modo === 'distribuido') return null;
  return { modo, pontos: Array.isArray(persistido?.meses) ? persistido.meses.length : 0 };
}

/**
 * Esta aplicação, com este formulário, SUBSTITUIRIA a curva própria?
 *
 * Só quando as duas coisas valem: existe curva que o formulário não representa
 * E os blocos foram editados de verdade. Abrir e fechar não substitui nada, e
 * mexer só na correção de estoque também não — ver `absorcaoParaSalvar`.
 */
export function absorcaoSubstituiCurva(
  form: FormularioAbsorcao,
  persistido: any,
): { modo: string; pontos: number } | null {
  if (!editouOsBlocos(form)) return null;
  return curvaNaoRepresentavel(persistido);
}

/**
 * Decide o JSON de `absorcao` que uma escrita do modal deve gravar.
 *
 * Três casos, no mesmo desenho do editor de Pagamento:
 *
 *  1. não há registro persistido com nada a preservar → monta o `distribuido`
 *     do formulário, que é o comportamento de sempre;
 *  2. os três blocos NÃO foram editados → devolve o persistido verbatim, só
 *     carimbando o que o formulário legitimamente possui: `correcao_estoque` e
 *     `aplicado`. É o no-op — `modo` e `meses` chegam do jeito que estavam;
 *  3. os blocos foram editados → monta o `distribuido` novo. É a conversão
 *     de verdade, e é ela que a tela avisa e faz confirmar.
 *
 * ⚠️ `correcao_estoque` NÃO conta como edição de curva de propósito. É uma
 * grandeza ortogonal, que o formulário representa por inteiro; trocar o badge
 * "Não/Sim" não é motivo para converter uma curva de 43 pontos em três blocos.
 * (O destino desse controle é a #484.)
 */
export function absorcaoParaSalvar(form: FormularioAbsorcao, persistido: any): any {
  const novo = {
    modo: 'distribuido',
    correcao_estoque: Boolean(form.correcao_estoque),
    blocos: [
      { evento: 'pre_lancamento', pct: n(form.pre_lancamento_pct) },
      { evento: 'lancamento', pct: n(form.lancamento_pct) },
      { evento: 'obra', pct: n(form.obra_pct) },
      // #430: o 4º período continua gravado com `evento: 'pos_obra'` — é dado
      // em coluna `json`, e o backend o reconhece por esse nome. O `pct` nunca
      // é lido pelo motor: Pós-chaves é sempre derivado.
      { evento: 'pos_obra', pct: 0 },
    ],
    aplicado: true as const,
  };
  if (!temDadoPreservavel(persistido)) return novo;                       // caso 1
  if (!editouOsBlocos(form)) {                                            // caso 2
    return { ...persistido, correcao_estoque: Boolean(form.correcao_estoque), aplicado: true };
  }
  return novo;                                                            // caso 3
}
