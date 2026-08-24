/**
 * #464 — inventário de configurações do Avançado que a UI hoje não expõe
 * (juros de tabela por componente, sinal, juros-na-contratação, absorção
 * personalizada) e do ramo legado (linha sem `componentes`).
 *
 * Função PURA, sem rede e sem DOM: recebe as linhas de receita já carregadas
 * (o shape de `avancado_linhas_receita`/`avancado_fases` tipo `receita`, com
 * `fluxo_pagamento.componentes` e `absorcao.modo`) e devolve os seis
 * contadores. Não reimplementa nada do motor (`fluxo-caixa-motor.ts`) — só
 * inspeciona o dado bruto, exatamente como ele chega da API.
 *
 * Item 2 da issue (o subcomando `GET`-only em `scripts/conferir-estudo.ts`
 * que USA esta função para varrer a instância viva) fica para uma PR
 * seguinte: `scripts/conferir-estudo.ts` está sob edição concorrente nesta
 * rodada (#446) e esta função não depende dele — importar dele SERIA a
 * colisão; ser importado por ele não é.
 */

/** Um componente de `fluxo_pagamento.componentes` — shape mínimo que este inventário lê. */
export interface ComponenteAuditavel {
  taxaMensal?: unknown;
  sinalPct?: unknown;
  jurosNoMesDaContratacao?: unknown;
}

/** Uma linha de receita (Grupo/`avancado_fases` tipo `receita`) — shape mínimo lido aqui. */
export interface LinhaReceitaAuditavel {
  fluxo_pagamento?: { componentes?: unknown } | null;
  absorcao?: { modo?: unknown } | null;
}

export interface ContagemConfiguracoesAvancadas {
  /** Total de linhas de receita inspecionadas. */
  total: number;
  /** Linhas com ao menos um componente cujo `taxaMensal` é um número ≠ 0. */
  comTaxa: number;
  /** Linhas com ao menos um componente cujo `sinalPct` é um número ≠ 0. */
  comSinal: number;
  /** Linhas com ao menos um componente com `jurosNoMesDaContratacao === true`. */
  comJurosNaContratacao: number;
  /** Linhas com `absorcao.modo === 'personalizado'`. */
  absorcaoPersonalizada: number;
  /**
   * Linhas no ramo LEGADO: `fluxo_pagamento.componentes` ausente ou não é um
   * array. Um array VAZIO (`[]`) não conta aqui — é um componente válido,
   * só sem nenhum item; a distinção importa porque `componentesDoLegado`
   * (`frontend/fluxo-caixa-motor.ts`) só é acionado no primeiro caso.
   */
  ramoLegado: number;
}

/** `Number(v)` é finito e diferente de zero — trata `null`/`undefined`/`''`/NaN como "ausente", não como zero explícito nem como valor. */
function numeroNaoZero(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0;
}

export function contarConfiguracoesAvancadas(
  linhas: readonly LinhaReceitaAuditavel[] | null | undefined,
): ContagemConfiguracoesAvancadas {
  const r: ContagemConfiguracoesAvancadas = {
    total: 0, comTaxa: 0, comSinal: 0, comJurosNaContratacao: 0,
    absorcaoPersonalizada: 0, ramoLegado: 0,
  };
  for (const linha of linhas ?? []) {
    r.total++;
    const componentes = linha?.fluxo_pagamento?.componentes;
    if (!Array.isArray(componentes)) {
      r.ramoLegado++;
    } else {
      const lista = componentes as ComponenteAuditavel[];
      if (lista.some((c) => numeroNaoZero(c?.taxaMensal))) r.comTaxa++;
      if (lista.some((c) => numeroNaoZero(c?.sinalPct))) r.comSinal++;
      if (lista.some((c) => c?.jurosNoMesDaContratacao === true)) r.comJurosNaContratacao++;
    }
    if (linha?.absorcao?.modo === 'personalizado') r.absorcaoPersonalizada++;
  }
  return r;
}
