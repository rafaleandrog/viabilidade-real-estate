// Motor de cálculo do Fluxo de Caixa (nível Avançado).
// Funções puras, sem DOM e sem I/O — espelha o padrão de proforma.ts e é
// coberto por fluxo-caixa-motor.test.ts. Usado APENAS quando
// estudo.nivel_analise === 'avancado'; o Preliminar não passa por aqui.
//
// Convenções:
// - Tempo em meses RELATIVOS 0-based (mês 0 = data_inicio_projeto).
// - Arrays mensais são 0-based e o índice coincide com o número do mês: índice i = mês i.
// - Receitas positivas; custos positivos nos próprios arrays (o sinal entra na
//   consolidação: fluxo = receita − custo).
// - Permuta física NÃO gera receita em caixa (#195): a unidade permutada é
//   entregue em troca do terreno/serviço, não vendida — a absorção de vendas
//   e o rateio por tipologia usam o VGV VENDÁVEL (`vgvVendavelLinha`), não o
//   VGV bruto. `vgvTotal` continua contando a tipologia inteira — é o KPI
//   informativo do #188 (`vgvTotal`/`vgvPermutaFisica`/`receitaBrutaVgv`).

import {
  absorcaoMensal, periodoAbsorcao, vgvLinha, receitaLiquidaLinha, vgvPermutaFisicaLinha,
  vgvVendavelTipologia, vgvVendavelLinha,
  areaPrivativaTotalLinhas, resolverCustoTotal, mesRelativoCompleto, rotuloMesRelativo,
  eCorretagem, vgvVendidoMensal, ePrecoTerreno,
  type EventoCrono, type ContextoCusto, type PeriodoAgregado,
} from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;

/**
 * Nome de exibição de uma linha de custo: categoria + subcategoria — mas só
 * para `terreno`, o único grupo com subcategoria editável na tela (#173).
 * Dado legado de subcategoria em outro grupo (categoria "Outro" aceitava
 * texto livre em todos os grupos antes desta issue) fica sem editor na UI e
 * não deve aparecer pendurado no nome.
 */
function nomeLinhaCusto(c: any): string {
  const partes = c.grupo === 'terreno' ? [c.categoria, c.subcategoria] : [c.categoria];
  return partes.filter(Boolean).join(' — ') || 'Custo';
}

export type CurvaPersonalizada = { mes: number; pct: number }[];

// ─────────────────────────────────────────────────────────────────
// 6A. Distribuição mensal de uma linha
// ─────────────────────────────────────────────────────────────────

/**
 * Distribui `total` ao longo de `duracaoMeses` a partir de `inicioMes`
 * (0-based), devolvendo um array de `prazoTotal` posições (zeros fora do
 * intervalo).
 *
 * - 'linear': total/duracao em cada mês
 * - curva personalizada: os percentuais da curva são reamostrados (interpolação
 *   linear do acumulado) para a duração real e normalizados para somar 100%.
 */
export function distribuirLinha(
  total: number,
  inicioMes: number,
  duracaoMeses: number,
  curva: 'linear' | CurvaPersonalizada,
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  const dur = Math.max(1, Math.round(duracaoMeses));
  const inicio = Math.max(0, Math.round(inicioMes));

  let pesos: number[];
  if (curva === 'linear' || !Array.isArray(curva) || curva.length === 0) {
    pesos = new Array(dur).fill(1 / dur);
  } else {
    pesos = reamostrarCurva(curva, dur);
  }

  for (let i = 0; i < dur; i++) {
    const idx = inicio + i; // mês 0-based coincide com o índice do array
    if (idx >= 0 && idx < saida.length) saida[idx] += total * pesos[i];
  }
  return saida;
}

/**
 * Reamostra uma curva de N pontos (% por mês) para `dur` meses via
 * interpolação linear do ACUMULADO, normalizando para somar 1.
 */
export function reamostrarCurva(curva: CurvaPersonalizada, dur: number): number[] {
  const ordenada = [...curva].sort((a, b) => n(a.mes) - n(b.mes));
  const brutos = ordenada.map((p) => Math.max(0, n(p.pct)));
  const somaBruta = brutos.reduce((s, x) => s + x, 0) || 1;
  // Acumulado da curva-fonte em N+1 nós: 0, c1, c1+c2, ... , 1
  const N = brutos.length;
  const acum: number[] = [0];
  for (let i = 0; i < N; i++) acum.push(acum[i] + brutos[i] / somaBruta);

  // Acumulado alvo avaliado em frações j/dur (interp. linear entre nós i/N).
  const acumEm = (f: number): number => {
    if (f <= 0) return 0;
    if (f >= 1) return 1;
    const pos = f * N;
    const i = Math.floor(pos);
    const frac = pos - i;
    return acum[i] + (acum[i + 1] - acum[i]) * frac;
  };
  const pesos: number[] = [];
  for (let j = 1; j <= dur; j++) pesos.push(acumEm(j / dur) - acumEm((j - 1) / dur));
  return pesos;
}

// ─────────────────────────────────────────────────────────────────
// Tipos do fluxo consolidado
// ─────────────────────────────────────────────────────────────────

export interface FluxoConfig {
  dataInicio: string | null;       // "mmm/AAAA" (ancora os rótulos; pode faltar)
  prazoMeses?: number;             // horizonte fixo; se ausente, é derivado
  taxaDescontoAa: number;          // % a.a. para o VPL
  cronograma: EventoCrono[];
  linhasReceita: any[];            // { id, nome, fase_label, tipologias[], absorcao, fluxo_pagamento }
  linhasCusto: any[];              // { id, grupo, categoria, subcategoria, orcamento_*, curva_id, inicio_mes, duracao_meses }
  curvas?: any[];                  // avancado_curvas (lookup de curva_id → valores)
  areaTerreno: number;             // m² (Premissas)
}

export interface LinhaCalc {
  id: any;
  nome: string;
  grupo: 'receita' | 'terreno' | 'obra' | 'diretos' | 'indireto' | 'financeiro';
  faseLabel?: string;
  inicio: number;                  // 1º mês com valor (0-based; use duracao===0 p/ "sem valores")
  duracao: number;                 // nº de meses entre o 1º e o último valor (0 = sem valores)
  total: number;
  vpl: number;
  mensal: number[];
  itens?: LinhaCalc[];             // tipologias (receita) — sub-linhas
}

// ─────────────────────────────────────────────────────────────────
// #229 — Taxonomia de grandezas (EVI-009 + emenda Calliandra 2026-08-01)
// ─────────────────────────────────────────────────────────────────
//
// Oito grandezas, sem nome ambíguo entre si. As seis primeiras já têm valor
// nesta fase; as duas últimas (safra/juros, #232+) ainda não existem no motor
// — citadas aqui só para fixar o vocabulário, sem campo `FluxoCalc` correspondente
// ainda (evita expor placeholder sempre-zero antes de haver cálculo real).
//
//  1. VGV potencial          = `vgvTotal`          — produto inteiro, antes da permuta física
//  2. VGV vendável           = `vgvVendavel`        — potencial − permuta física (#195)
//     (nome correto de `receitaBrutaVgv`, preservado por compat — ver nota abaixo)
//  3. Valor bruto contratado = `vendaBrutaContratada` — Σ `vendaBrutaContratadaMensal` (#227)
//  4. Descontos              = `descontoComercial`    — Σ `descontoComercialMensal` (#227)
//  5. Valor contratado líquido = `vendaLiquidaContratada` — bruto − descontos (#227)
//  6. Receita Bruta          = `receitaBruta`        — Σ `recebimentoBrutoMensal` (#228);
//     "sem juros, Receita Bruta = vendas contratadas" (critério de aceite da #228) —
//     verificado em fluxo-caixa-motor.test.ts
//  7. Principal recebido     — ainda não existe; populado quando as safras (#232+)
//     separarem principal de juros na carteira
//  8. Juros                  — idem, #232+
//
// `receitaMensal`/`fluxoMensal` (o que efetivamente entra no fluxo) usam o
// RECEBIMENTO LÍQUIDO (`recebimentoLiquidoMensal`, #228) — Receita Bruta menos
// o imposto (RET). Nenhuma dessas oito grandezas é o mesmo número que outra;
// consumidor que precisar de mais de uma tem de nomear qual está lendo.

export interface FluxoCalc {
  prazo: number;
  meses: string[];                 // rótulos "jan/27" (ou "M1" sem data)
  receitaMensal: number[];
  custoMensal: number[];
  fluxoMensal: number[];
  fluxoAcumulado: number[];
  vgvTotal: number;                // #229 — grandeza 1: VGV potencial
  vpl: number;
  tir: number | null;              // % a.a.
  paybackMes: number | null;       // índice 0-based no array mensal
  paybackData: string | null;      // "jul/2030"
  exposicaoMaxima: number;         // min(fluxoAcumulado) — tipicamente negativo
  vgvPermutaFisica: number;        // #188 — VGV atribuído às unidades permutadas (informativo)
  // #188/#229: nome histórico, MANTIDO por compatibilidade (8+ consumidores em
  // fluxo-tabela.ts/exportar.ts) — mas o valor NÃO é "Receita Bruta" no sentido
  // do EVI (recebimento em caixa); é VGV VENDÁVEL. Use `vgvVendavel` (idêntico,
  // nome correto) em código novo. O rótulo de UI já foi corrigido (fluxo-tabela.ts).
  receitaBrutaVgv: number;
  vgvVendavel: number;              // #229 — grandeza 2, alias correto de receitaBrutaVgv
  vendaBrutaContratada: number;     // #229 — grandeza 3: Σ vendaBrutaContratadaMensal
  descontoComercial: number;        // #229 — grandeza 4: Σ descontoComercialMensal
  vendaLiquidaContratada: number;   // #229 — grandeza 5: bruto − descontos
  receitaBruta: number;             // #229 — grandeza 6: Σ recebimentoBrutoMensal (#228)
  linhasReceita: LinhaCalc[];
  linhasCusto: LinhaCalc[];
}

// ─────────────────────────────────────────────────────────────────
// 6B. Motor de receita
// ─────────────────────────────────────────────────────────────────

const INTERVALO_PERIODICIDADE: Record<string, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
};

/**
 * Normaliza um bloco de pagamento (Entrada / Parcelamento) para uma LISTA de
 * linhas. O modelo vigente (Lote 6 · #20) permite múltiplas linhas em cada
 * bloco; o legado guardava um único objeto — aqui ele vira uma lista de 1.
 */
export function normalizarLinhasPagamento(bloco: any): any[] {
  if (Array.isArray(bloco)) return bloco.filter(Boolean);
  if (bloco && typeof bloco === 'object') return [bloco];
  return [];
}

/**
 * #190/#191: nº de parcelas do parcelamento "Ao longo da obra", fixo pela
 * duração do evento `obra` do Cronograma e pela PERIODICIDADE da linha:
 *
 *     nº de parcelas = max(1, floor(duração da obra / intervalo))
 *
 * Mensal (intervalo 1) → uma parcela por mês de obra (regra do #190, que este
 * caso geral reproduz exatamente). Trimestral/Semestral/Anual (3/6/12) → uma a
 * cada `intervalo` meses (#191). O RESTO da divisão não vira parcela: obra de
 * 10 meses em Trimestral dá 3 parcelas (meses 0, 3, 6) e sobra 1 mês sem
 * vencimento — é a regra pedida na issue, não arredondamento acidental.
 *
 * É o número que a tela mostra no campo "Nº parcelas" (travado) e o mesmo que
 * `vencimentosAoLongoObra` distribui, para não haver duas fontes de verdade.
 * Obra ausente, sem duração, ou duração menor que um intervalo → 1 parcela.
 */
export function parcelasAoLongoObra(cronograma: EventoCrono[], periodicidade?: string): number {
  const obra = cronograma.find((e) => e.evento === 'obra');
  const dur = Math.max(0, Math.round(n(obra?.duracao_meses)));
  const intervalo = INTERVALO_PERIODICIDADE[periodicidade ?? 'mensal'] ?? 1;
  return Math.max(1, Math.floor(dur / intervalo));
}

/**
 * #190/#191: meses de vencimento do parcelamento "Ao longo da obra".
 *
 * ANTES: as parcelas saíam do mês da venda (`fimObra − mesVenda` parcelas, uma
 * por mês a partir de `mesVenda + 1`), então CADA mês de venda gerava um número
 * diferente de parcelas — não existia um "nº de parcelas" único para exibir na
 * tela, e o campo ficava travado e vazio. A periodicidade era simplesmente
 * ignorada neste ramo: Trimestral/Semestral/Anual pagavam todo mês (#191).
 *
 * AGORA os vencimentos saem do CRONOGRAMA DA OBRA: o primeiro no `inicio_mes`
 * e os demais a cada `intervalo` meses (1/3/6/12 conforme a periodicidade),
 * `parcelasAoLongoObra` vencimentos ao todo — independentes do mês da venda. O
 * parcelamento acompanha o andamento da obra, que é o que "ao longo da obra"
 * significa.
 *
 * Venda depois do início da obra: parcelas já vencidas não são recuperadas — a
 * primeira cai no primeiro vencimento **≥ mês da venda** e o total é repartido
 * entre os vencimentos restantes (o valor da parcela sobe; a receita se
 * conserva). Venda depois do último vencimento, obra sem duração ou sem evento
 * de obra: 1 parcela no mês da venda.
 */
export function vencimentosAoLongoObra(
  cronograma: EventoCrono[],
  mesVenda: number,
  periodicidade?: string,
): number[] {
  const obra = cronograma.find((e) => e.evento === 'obra');
  const dur = Math.max(0, Math.round(n(obra?.duracao_meses)));
  if (!obra || dur <= 0) return [mesVenda];
  const intervalo = INTERVALO_PERIODICIDADE[periodicidade ?? 'mensal'] ?? 1;
  const nParc = parcelasAoLongoObra(cronograma, periodicidade);
  const inicio = n(obra.inicio_mes);
  const meses: number[] = [];
  for (let k = 0; k < nParc; k++) {
    const mes = inicio + k * intervalo;
    if (mes >= mesVenda) meses.push(mes);
  }
  return meses.length > 0 ? meses : [mesVenda];
}

// ─────────────────────────────────────────────────────────────────
// 6B.1 Série canônica de contratação — bruto / desconto / líquido (#227)
// ─────────────────────────────────────────────────────────────────
//
// Três grandezas distintas, todas em meses relativos, SEM juros futuros:
//  - venda BRUTA contratada = área vendável × %absorção do mês × preço/m²;
//  - desconto comercial = abatimento sobre a parcela de ENTRADA (à vista),
//    quando configurado (`entrada[].descontoPct`) — série própria, nunca
//    embutida multiplicativamente no recebível;
//  - venda LÍQUIDA contratada = bruto − desconto.
// É a fonte única reusada pela baixa de estoque, pela corretagem (base = bruto,
// decisão do autor 2026-08-01) e pelas safras (#232+). `receitaMensalLinha`
// usa `vendaBrutaContratadaMensal` como a "venda" de cada mês e aplica o
// desconto na formação do recebível — ver ali.

/** #227: venda BRUTA contratada de uma linha/fase, por mês — SEM desconto e SEM
 * juros futuros. Usa o VGV VENDÁVEL (#195): permuta física não contrata caixa. */
export function vendaBrutaContratadaMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  const vgv = vgvVendavelLinha(linha?.tipologias ?? []);
  if (vgv <= 0) return saida;
  const abs = absorcaoMensal(linha?.absorcao ?? { modo: 'linear' }, cronograma);
  if (!abs) return saida;
  for (let i = 0; i < abs.pcts.length; i++) {
    const idx = abs.inicio + i; // mês 0-based coincide com o índice
    if (idx >= 0 && idx < saida.length) saida[idx] += (vgv * abs.pcts[i]) / 100;
  }
  return saida;
}

/**
 * #227: desconto comercial mensal de uma linha — soma, mês a mês, o abatimento
 * configurado em cada linha de Entrada (`entrada[].descontoPct`, ex.: 5% no
 * pagamento à vista) sobre a fração da venda bruta que cabe a essa entrada.
 * Sem `entrada[]` configurada (fluxo_pagamento ausente/legado sem desconto),
 * a série é zero — nenhum estudo existente muda de valor.
 */
export function descontoComercialMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const bruto = vendaBrutaContratadaMensal(linha, cronograma, prazoTotal);
  const saida = new Array<number>(bruto.length).fill(0);
  const entradas = normalizarLinhasPagamento(linha?.fluxo_pagamento?.entrada);
  if (entradas.length === 0) return saida;
  for (let i = 0; i < bruto.length; i++) {
    if (bruto[i] <= 0) continue;
    for (const e of entradas) {
      const parcela = bruto[i] * (n(e?.pct) / 100);
      if (parcela > 0 && n(e?.descontoPct) > 0) saida[i] += parcela * (n(e.descontoPct) / 100);
    }
  }
  return saida;
}

/** #227: venda LÍQUIDA contratada = bruta − desconto comercial. */
export function vendaLiquidaContratadaMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const bruto = vendaBrutaContratadaMensal(linha, cronograma, prazoTotal);
  const desconto = descontoComercialMensal(linha, cronograma, prazoTotal);
  return bruto.map((v, i) => v - desconto[i]);
}

/** % do Repasse = 100 − Σ(entrada) − Σ(parcelas), derivado (Lote 6 · #20). */
export function pctRepasseDerivado(fp: any): number {
  const somaEntrada = normalizarLinhasPagamento(fp?.entrada).reduce((s, e) => s + n(e?.pct), 0);
  const somaParcelas = normalizarLinhasPagamento(fp?.parcelas).reduce((s, p) => s + n(p?.pct), 0);
  return Math.max(0, 100 - somaEntrada - somaParcelas);
}

// ─────────────────────────────────────────────────────────────────
// #230 — Contrato de componentes de pagamento (EVI-010 + emenda Calliandra)
// ─────────────────────────────────────────────────────────────────
//
// Substitui o modelo rígido por rótulo comercial (à vista / tabela curta /
// tabela longa) por QUATRO REGRAS ECONÔMICAS, a mesma taxonomia do oráculo
// dourado (`frontend/fixtures/calliandra-golden.ts`, #220):
//
//  - `imediato`     — pago no mês da contratação, com desconto comercial (#227).
//  - `prazo_fixo`   — N parcelas iguais para toda safra; 1º vencimento em
//                     `s + defasagemMeses` (default 1, salvo legado de entrada
//                     parcelada, que usa 0 — 1ª parcela no próprio mês).
//  - `ate_marco`    — parcelas de `s + defasagemMeses` até um MARCO fixo M;
//                     N_s = M − s varia com a safra (implementado em #232+).
//  - `concentrado`  — pagamento único num mês fixo (repasse/liquidação).
//
// ESTRATÉGIA CONSERVADORA (corpo da #230): definir o shape canônico → criar o
// normalizador do dado ATUAL → preservar a leitura legada → só migrar
// persistência se o ganho justificar. Este PR entrega o TIPO e o ADAPTER
// (`componentesDoLegado`); a matemática de safra/PMT que os CONSOME é #232+ —
// `receitaMensalLinha` continua lendo o `fluxo_pagamento` legado diretamente,
// sem mudança de comportamento nesta issue.

/** Componente de pagamento — 4 regras econômicas, campos mínimos da #230. */
export type ComponentePagamento =
  | {
      tipo: 'imediato';
      participacaoPct: number;
      descontoPct: number;
      rotulo?: string;
    }
  | {
      tipo: 'prazo_fixo';
      participacaoPct: number;
      sinalPct: number;
      prazoMeses: number;
      defasagemMeses: number;      // 1º vencimento = s + defasagemMeses (default 1)
      taxaMensal: number;
      jurosNoMesDaContratacao: boolean; // default false (#234)
      rotulo?: string;
    }
  | {
      tipo: 'ate_marco';
      participacaoPct: number;
      sinalPct: number;
      marcoMes: number;            // N_s = marcoMes − s (#233)
      defasagemMeses: number;
      taxaMensal: number;
      jurosNoMesDaContratacao: boolean;
      rotulo?: string;
    }
  | {
      tipo: 'concentrado';
      participacaoPct: number;
      mesPagamento: number;
      rotulo?: string;
    };

/**
 * Adapter do JSON legado (`fluxo_pagamento`: `entrada[]`/`parcelas[]`/
 * `repasse`) para o contrato de componentes (#230). Leitura pura, sem
 * persistência — não substitui `normalizarLinhasPagamento` nem
 * `pctRepasseDerivado`, que continuam sendo o que o motor usa até #232+
 * migrar o cálculo para os componentes.
 *
 * Mapeamento (preserva 100% da semântica atual):
 *  - cada linha de `entrada` com `parcelas ≤ 1` → `imediato` (paga no mês da
 *    venda, com o desconto de #227); com `parcelas > 1` → `prazo_fixo` com
 *    `defasagemMeses = 0` (1ª parcela NO mês da venda, como hoje — distinto
 *    do padrão `1` de uma tabela curta/longa nova, #232+);
 *  - cada linha de `parcelas` com `ao_longo_obra` → `ate_marco`, com
 *    `marcoMes` = fim do evento Obra do cronograma (o "marco" de hoje);
 *    sem `ao_longo_obra` → `prazo_fixo` com `defasagemMeses` = a periodicidade
 *    (1/3/6/12, conforme hoje) e 1ª parcela em `s + intervalo`;
 *  - `repasse` (% derivado) → `concentrado`, no mês fixo (fim da Obra +
 *    `apos_entrega_meses`).
 * Sem `fluxo_pagamento` (null/legado sem config) → um único `imediato` de
 * 100%, sem desconto — o "recebe à vista no mês da venda" de hoje.
 */
export function componentesDoLegado(
  fluxoPagamento: any,
  cronograma: EventoCrono[],
): ComponentePagamento[] {
  const fp = fluxoPagamento ?? null;
  if (!fp) return [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }];

  const componentes: ComponentePagamento[] = [];

  for (const e of normalizarLinhasPagamento(fp.entrada)) {
    const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
    if (nParc <= 1) {
      componentes.push({ tipo: 'imediato', participacaoPct: n(e?.pct), descontoPct: n(e?.descontoPct) });
    } else {
      componentes.push({
        tipo: 'prazo_fixo', participacaoPct: n(e?.pct), sinalPct: 0, prazoMeses: nParc,
        defasagemMeses: 0, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'entrada (legado)',
      });
    }
  }

  const obra = cronograma.find((ev) => ev.evento === 'obra');
  const fimObra = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;

  for (const p of normalizarLinhasPagamento(fp.parcelas)) {
    if (p?.ao_longo_obra) {
      componentes.push({
        tipo: 'ate_marco', participacaoPct: n(p?.pct), sinalPct: 0, marcoMes: fimObra,
        defasagemMeses: 1, taxaMensal: 0, jurosNoMesDaContratacao: false, rotulo: 'ao longo da obra (legado)',
      });
    } else {
      const intervalo = INTERVALO_PERIODICIDADE[p?.periodicidade] ?? 1;
      componentes.push({
        tipo: 'prazo_fixo', participacaoPct: n(p?.pct), sinalPct: 0,
        prazoMeses: Math.max(1, Math.round(n(p?.parcelas) || 1)),
        defasagemMeses: intervalo, taxaMensal: 0, jurosNoMesDaContratacao: false,
        rotulo: `parcelamento ${p?.periodicidade ?? 'mensal'} (legado)`,
      });
    }
  }

  const pctRepasse = pctRepasseDerivado(fp);
  if (pctRepasse > 0) {
    const mesRepasse = fimObra + Math.max(0, Math.round(n(fp?.repasse?.apos_entrega_meses)));
    componentes.push({ tipo: 'concentrado', participacaoPct: pctRepasse, mesPagamento: mesRepasse, rotulo: 'repasse (legado)' });
  }

  return componentes;
}

// ─────────────────────────────────────────────────────────────────
// #231 — Horizonte derivado de todos os componentes e todas as safras
// ─────────────────────────────────────────────────────────────────

/**
 * #231: último mês com recebimento possível de UMA linha — considera TODOS
 * os componentes do fluxo de pagamento (entrada, parcelamento — ao longo da
 * obra ou por periodicidade — e repasse), não só o cronograma e o repasse
 * como antes (`ultimoCrono + maxRepasse`, que ignorava entrada/parcelamento
 * longos). Usado por `calcularFluxo` para derivar o horizonte sem truncar
 * nenhum recebimento.
 *
 * Cobre o "pior caso" por SAFRA sem iterar mês a mês: como entrada e
 * parcelamento (fora de "ao longo da obra") têm deslocamento CONSTANTE a
 * partir do mês da venda, o pior caso é sempre a ÚLTIMA safra (`periodo.fim`
 * — o fim do Após-chaves). "Ao longo da obra" já é absoluto (ancorado no
 * Cronograma da Obra, não no mês da venda — #190/#191), então seu horizonte
 * não depende da safra.
 */
export function ultimoMesRecebivelLinha(linha: any, cronograma: EventoCrono[]): number {
  const periodo = periodoAbsorcao(cronograma);
  if (!periodo) return 0;
  const ultimoMesVenda = periodo.fim;
  const fp = linha?.fluxo_pagamento ?? null;
  if (!fp) return ultimoMesVenda; // sem config → à vista no mês da venda (#190/#191 não se aplicam)

  let ultimo = ultimoMesVenda;

  // Entrada: nParc parcelas consecutivas a partir do mês da venda.
  for (const e of normalizarLinhasPagamento(fp.entrada)) {
    const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
    ultimo = Math.max(ultimo, ultimoMesVenda + nParc - 1);
  }

  const obra = cronograma.find((ev) => ev.evento === 'obra');
  const fimObra = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;

  // Parcelamento.
  for (const p of normalizarLinhasPagamento(fp.parcelas)) {
    if (p?.ao_longo_obra) {
      // Vencimentos ancorados no Cronograma da Obra (absoluto) — o último
      // possível é o fim da própria janela de vencimentos.
      const nParcObra = parcelasAoLongoObra(cronograma, p?.periodicidade);
      const intervalo = INTERVALO_PERIODICIDADE[p?.periodicidade ?? 'mensal'] ?? 1;
      const inicioObra = obra ? n(obra.inicio_mes) : 0;
      ultimo = Math.max(ultimo, inicioObra + (nParcObra - 1) * intervalo);
    } else {
      // nParc parcelas espaçadas por `intervalo`, a partir de mesVenda+intervalo.
      const intervalo = INTERVALO_PERIODICIDADE[p?.periodicidade] ?? 1;
      const nParc = Math.max(1, Math.round(n(p?.parcelas) || 1));
      ultimo = Math.max(ultimo, ultimoMesVenda + intervalo * nParc);
    }
  }

  // Repasse: mês fixo (fim da Obra + carência), independente da safra.
  const pctRepasse = pctRepasseDerivado(fp);
  if (pctRepasse > 0) {
    const mesRepasse = fimObra + Math.max(0, Math.round(n(fp?.repasse?.apos_entrega_meses)));
    ultimo = Math.max(ultimo, mesRepasse);
  }

  return ultimo;
}

/**
 * #228: recebimento BRUTO mensal de uma linha — o que o cliente efetivamente
 * paga, em meses relativos, SEM nenhuma dedução fiscal ou de corretagem (essas
 * são séries próprias — ver `impostoMensal` e a linha de custo obrigatória de
 * Corretagem, #227). O desconto comercial de #227 JÁ está aqui: é uma redução
 * real do valor devido pelo cliente, não um imposto — reduz o bruto, não o
 * líquido.
 *
 * Aplica a venda BRUTA contratada do mês (#227) ao fluxo de pagamento: cada
 * linha de Entrada (parcelável a partir do mês da venda, com desconto sobre
 * sua própria fração), cada linha de Parcelamento (ao longo da obra ou por
 * periodicidade) e o Repasse — % derivado (100 − entradas − parcelas) —
 * concentrado N meses após a Obra.
 */
export function recebimentoBrutoMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const saida = new Array<number>(Math.max(prazoTotal, 0)).fill(0);
  const bruto = vendaBrutaContratadaMensal(linha, cronograma, prazoTotal);
  const vgv = vgvVendavelLinha(linha?.tipologias ?? []);
  if (vgv <= 0) return saida;

  const fp = linha?.fluxo_pagamento ?? null;
  const entradas = normalizarLinhasPagamento(fp?.entrada);
  const parcelasLinhas = normalizarLinhasPagamento(fp?.parcelas);
  const pctRepasse = pctRepasseDerivado(fp);
  // Sem fluxo configurado (null) → recebe à vista no mês da venda.
  const semConfig = !fp;

  const obra = cronograma.find((e) => e.evento === 'obra');
  const fimObra = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;
  const mesRepasse = fimObra + Math.max(0, Math.round(n(fp?.repasse?.apos_entrega_meses)));

  // #231: o fallback SILENCIOSO que empilhava excedente no último mês foi
  // removido — `ultimoMesRecebivelLinha` agora deriva o horizonte para caber
  // todo recebimento desta linha, então este ramo não deveria disparar nunca
  // em uso normal. Se disparar (ex.: `config.prazoMeses` explícito mais curto
  // que o necessário), o aviso é visível — nunca mais um número errado sem
  // rastro. Também não estoura fora do array: em vez de deslocar o valor,
  // funciona como um limite (o total da linha deixa de bater com a soma dos
  // meses, e o aviso aponta a causa).
  const deposita = (mes: number, valor: number) => {
    if (valor === 0) return;
    const idx = Math.max(0, mes); // mês 0-based = índice; recebimentos antes do mês 0 caem no mês 0
    if (idx < saida.length) { saida[idx] += valor; return; }
    console.warn(
      `fluxo-caixa-motor: recebimento de ${valor.toFixed(2)} no mês ${mes} cai fora do horizonte ` +
      `(${saida.length} meses) — prazoMeses explícito menor que o necessário? Valor NÃO computado.`,
    );
  };

  for (let i = 0; i < bruto.length; i++) {
    const mesVenda = i;
    const venda = bruto[i]; // #227: venda BRUTA contratada do mês — série canônica
    if (venda <= 0) continue;

    if (semConfig) { deposita(mesVenda, venda); continue; }

    // Entrada — cada linha parcelável a partir do mês da venda. #227: o
    // desconto comercial (ex.: 5% no pagamento à vista) reduz o valor ANTES
    // da formação do recebível — a base é a venda bruta contratada, e a
    // dedução se aplica só à fração desta entrada, nunca ao total da linha.
    for (const e of entradas) {
      const totalBruto = venda * (n(e?.pct) / 100);
      if (totalBruto <= 0) continue;
      const total = totalBruto * (1 - n(e?.descontoPct) / 100);
      const nParc = Math.max(1, Math.round(n(e?.parcelas) || 1));
      for (let k = 0; k < nParc; k++) deposita(mesVenda + k, total / nParc);
    }

    // Parcelamento — cada linha ao longo da obra ou por periodicidade.
    for (const p of parcelasLinhas) {
      const total = venda * (n(p?.pct) / 100);
      if (total <= 0) continue;
      if (p?.ao_longo_obra) {
        // #190/#191 — "Ao longo da obra": vencimentos ancorados no CRONOGRAMA
        // da obra (a cada `intervalo` meses, conforme a periodicidade), não
        // contados a partir do mês da venda (ver `vencimentosAoLongoObra`).
        // Σ das parcelas = `total` sempre.
        const vencimentos = vencimentosAoLongoObra(cronograma, mesVenda, p?.periodicidade);
        for (const mes of vencimentos) deposita(mes, total / vencimentos.length);
      } else {
        const intervalo = INTERVALO_PERIODICIDADE[p?.periodicidade] ?? 1;
        const nParc = Math.max(1, Math.round(n(p?.parcelas) || 1));
        for (let k = 1; k <= nParc; k++) deposita(mesVenda + intervalo * k, total / nParc);
      }
    }

    // Repasse — % derivado, concentrado na entrega (independe do mês da venda).
    deposita(Math.max(mesRepasse, mesVenda), venda * (pctRepasse / 100));
  }
  return saida;
}

/**
 * #228: imposto mensal — RET por Grupo, a ÚNICA entrada fiscal oficial do
 * Avançado (decisão do autor 2026-08-01; o regime da aba Financeiro é
 * exclusivo do Preliminar, `receitaLiquidaLinha` em fluxo-shared.ts). Zero
 * sem RET ativo — o default de todo estudo — o que preserva o Resultado de
 * quem nunca usou RET. Proporcional ao recebimento bruto do mesmo mês: como
 * o % de RET é constante, aplicá-lo por mês (linear) é matematicamente
 * idêntico a aplicá-lo por venda antes de distribuir no tempo — só muda ONDE
 * a dedução é contabilizada, nunca o Resultado final de quem usa RET.
 */
export function impostoMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const bruto = recebimentoBrutoMensal(linha, cronograma, prazoTotal);
  const ret = linha?.fluxo_pagamento?.ret;
  if (!ret?.ativo) return bruto.map(() => 0);
  const pct = n(ret.pct) / 100;
  return bruto.map((v) => v * pct);
}

/**
 * #228: recebimento LÍQUIDO = bruto − imposto. É o valor que entra no fluxo
 * consolidado (`receitaMensal`, via `receitaMensalLinha`) — a corretagem NÃO
 * participa desta conta: já é uma linha de custo separada em `linhasCusto`
 * (#227), somada uma única vez no consolidado. Somar aqui TAMBÉM a
 * duplicaria — exatamente o defeito que esta issue corrige (marcar a
 * comissão como "Destacada" não muda mais o Resultado).
 */
export function recebimentoLiquidoMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const bruto = recebimentoBrutoMensal(linha, cronograma, prazoTotal);
  const imposto = impostoMensal(linha, cronograma, prazoTotal);
  return bruto.map((v, i) => v - imposto[i]);
}

/**
 * Recebimentos mensais de uma linha de receita (fase), em meses relativos —
 * a série que alimenta o fluxo consolidado. Alias de `recebimentoLiquidoMensal`
 * (#228); o nome é mantido por compatibilidade com os chamadores existentes.
 */
export function receitaMensalLinha(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  return recebimentoLiquidoMensal(linha, cronograma, prazoTotal);
}

// ─────────────────────────────────────────────────────────────────
// 6C. Corretagem de vendas (#121)
// ─────────────────────────────────────────────────────────────────

/**
 * Distribuição mensal da linha de Corretagem de vendas (Custos Diretos, #121).
 *
 * Regra de negócio: a corretagem é paga INTEGRALMENTE no mês em que a unidade é
 * vendida — não é espalhada por um período como os demais custos. Por isso a
 * linha não tem Distribuição/Cronograma/Início/Duração: seu calendário é o das
 * vendas (absorção das linhas de receita).
 *
 * Em `pct_vgv` (única unidade oferecida na UI) aplica o % sobre o VGV vendido em
 * cada mês. Outras unidades (dado legado) caem no mesmo calendário: o total
 * resolvido é rateado proporcionalmente ao VGV vendido no mês. Sem vendas no
 * horizonte, não há corretagem a pagar.
 *
 * #227/#228 — base única de corretagem (decisão do autor, 2026-08-01):
 * **bruto/VGV**, exatamente esta linha de custo obrigatória em `pct_vgv`. A
 * dedução concorrente que existia em `vglLinha` (comissão `destacada`, que
 * reduzia o recebível) foi REMOVIDA pela #228 — contaria a corretagem duas
 * vezes se as duas ficassem ativas ao mesmo tempo (o defeito do EVI-008).
 * Esta linha de custo é a única fonte oficial.
 */
export function corretagemMensal(
  custo: any,
  linhasReceita: any[],
  cronograma: EventoCrono[],
  prazoTotal: number,
  ctx: ContextoCusto,
): number[] {
  const vendas = vgvVendidoMensal(linhasReceita, cronograma, prazoTotal);
  const somaVendas = vendas.reduce((s, v) => s + v, 0);
  if (somaVendas <= 0) return new Array<number>(Math.max(prazoTotal, 0)).fill(0);

  if ((custo?.orcamento_unidade || 'rs') === 'pct_vgv') {
    const pct = n(custo?.orcamento_valor) / 100;
    return vendas.map((v) => v * pct);
  }
  const total = resolverCustoTotal(custo, ctx);
  return vendas.map((v) => (total * v) / somaVendas);
}

/**
 * Rateia o total resolvido de `custo` proporcionalmente a `pesos` (mesmo
 * mecanismo de `corretagemMensal`, generalizado para os modos `unit_delivery`/
 * `sales_revenue` da linha de Preço do Terreno, #194): em `pct_vgv` aplica o %
 * direto sobre cada peso; nas demais unidades, rateia o total resolvido
 * proporcionalmente. Sem peso no horizonte (soma ≤ 0), não distribui nada.
 */
export function distribuirProporcional(custo: any, pesos: number[], ctx: ContextoCusto): number[] {
  const somaPesos = pesos.reduce((s, v) => s + v, 0);
  if (somaPesos <= 0) return pesos.map(() => 0);
  if ((custo?.orcamento_unidade || 'rs') === 'pct_vgv') {
    const pct = n(custo?.orcamento_valor) / 100;
    return pesos.map((v) => v * pct);
  }
  const total = resolverCustoTotal(custo, ctx);
  return pesos.map((v) => (total * v) / somaPesos);
}

/**
 * Permuta financeira (#196): a subcategoria "Permuta" da linha de Preço do
 * Terreno — parte do preço paga em % da receita (ou valor fixo), não em
 * caixa. Ao contrário da permuta física (#195, que reduz o VGV vendável),
 * ela é uma DEDUÇÃO DA RECEITA: sai de `linhasCusto`/`custoMensal` e entra em
 * `linhasReceita`/`receitaMensal` com valor negativo — mesmo tratamento do
 * Preliminar (`proforma.ts`), onde permuta financeira reduz `receitaLiquida`.
 */
function ePermutaFinanceira(custo: any): boolean {
  return ePrecoTerreno(custo) && String(custo?.subcategoria || '') === 'Permuta';
}

// ─────────────────────────────────────────────────────────────────
// Indicadores financeiros
// ─────────────────────────────────────────────────────────────────

/** VPL de um fluxo mensal à taxa anual dada (desconto mensal equivalente). */
export function vplFluxo(fluxoMensal: number[], taxaAa: number): number {
  const tm = Math.pow(1 + n(taxaAa) / 100, 1 / 12) - 1;
  return fluxoMensal.reduce((s, cf, i) => s + cf / Math.pow(1 + tm, i + 1), 0);
}

/**
 * TIR anual (%) por Newton-Raphson sobre a taxa mensal.
 * Retorna null se o fluxo não muda de sinal ou se não convergir.
 */
export function tirFluxo(fluxoMensal: number[]): number | null {
  const temPos = fluxoMensal.some((v) => v > 0);
  const temNeg = fluxoMensal.some((v) => v < 0);
  if (!temPos || !temNeg) return null;

  const npv = (r: number) => fluxoMensal.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i + 1), 0);
  const dnpv = (r: number) => fluxoMensal.reduce((s, cf, i) => s - ((i + 1) * cf) / Math.pow(1 + r, i + 2), 0);

  let r = 0.01;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-7) break;
    const d = dnpv(r);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
    const novo = r - f / d;
    if (!Number.isFinite(novo) || novo <= -0.999) return null;
    if (Math.abs(novo - r) < 1e-10) { r = novo; break; }
    r = novo;
  }
  if (Math.abs(npv(r)) > 1e-3) return null; // não convergiu
  return (Math.pow(1 + r, 12) - 1) * 100;
}

// ─────────────────────────────────────────────────────────────────
// View agregada (S17 · #127) — colunas por período em vez de por mês
// ─────────────────────────────────────────────────────────────────

/**
 * Reagrupa um `FluxoCalc` mensal em COLUNAS POR PERÍODO (view "Anual", #127) —
 * função pura, não muta a entrada. Cada coluna passa a valer uma faixa de meses
 * (`periodosAnuais` produz as faixas de ano-calendário).
 *
 * Como cada tipo de série é agregado:
 * - **Séries de fluxo** (receita, custo, cada linha e cada tipologia, fluxo do
 *   período): SOMA dos meses da faixa. Como as faixas são contíguas e cobrem
 *   todos os meses, `Σ colunas = Σ meses` em toda linha — o total de cada linha
 *   continua batendo com a coluna "Total".
 * - **Acumulado**: ÚLTIMO mês da faixa (somar acumulados seria contar o mesmo
 *   caixa várias vezes); o valor da coluna é o saldo no fim do período.
 * - **Indicadores** (`vpl`, `tir`, `exposicaoMaxima`, `paybackMes`,
 *   `paybackData`, `vgvTotal`, `vgvPermutaFisica`, `receitaBrutaVgv`,
 *   `vgvVendavel`, `vendaBrutaContratada`, `descontoComercial`,
 *   `vendaLiquidaContratada`, `receitaBruta` (#229), e o
 *   `total`/`vpl` de cada linha): **inalterados**.
 *   São grandezas do fluxo mensal e independem de como as colunas são exibidas —
 *   o VPL desconta mês a mês e a exposição máxima é o pior saldo de um MÊS, não
 *   de um fim de ano. Agrupar colunas não pode mexer nesses números.
 * - `paybackMes` e o `inicio`/`duracao` das linhas continuam em MESES relativos
 *   (é o calendário real da linha); quem desenha as colunas converte para índice
 *   de período.
 */
export function agregarFluxoPorPeriodos(c: FluxoCalc, periodos: PeriodoAgregado[]): FluxoCalc {
  const soma = (serie: number[]): number[] => periodos.map((p) => {
    let acc = 0;
    for (let i = p.inicio; i <= p.fim; i++) acc += serie[i] ?? 0;
    return acc;
  });
  const ultimo = (serie: number[]): number[] => periodos.map((p) => serie[p.fim] ?? 0);
  const agregarLinha = (l: LinhaCalc): LinhaCalc => ({
    ...l,
    mensal: soma(l.mensal),
    itens: l.itens ? l.itens.map(agregarLinha) : undefined,
  });

  return {
    ...c,
    prazo: periodos.length,
    meses: periodos.map((p) => p.rotulo),
    receitaMensal: soma(c.receitaMensal),
    custoMensal: soma(c.custoMensal),
    fluxoMensal: soma(c.fluxoMensal),
    fluxoAcumulado: ultimo(c.fluxoAcumulado),
    linhasReceita: c.linhasReceita.map(agregarLinha),
    linhasCusto: c.linhasCusto.map(agregarLinha),
  };
}

// ─────────────────────────────────────────────────────────────────
// Cenários (Etapa 8 · #56) — reparametrização do fluxo
// ─────────────────────────────────────────────────────────────────

/**
 * Parâmetros de um cenário: variações percentuais (deltas) aplicadas sobre a
 * configuração-base. `0` = cenário-base (sem alteração).
 *  - `precoVendaPct`: varia o preço/m² de TODAS as tipologias de receita.
 *  - `custoObraPct`: varia o orçamento das linhas de custo do grupo `obra`.
 */
export interface CenarioParams {
  precoVendaPct: number;
  custoObraPct: number;
}

/**
 * Devolve uma NOVA `FluxoConfig` com o cenário aplicado — função pura, não muta
 * a entrada. Escala `preco_m2` das tipologias (preço de venda) e `orcamento_valor`
 * das linhas de obra (custo de obra) pelos fatores derivados dos deltas. As demais
 * linhas de custo (terreno/indiretos/…) e o restante da config ficam intactos.
 * `calcularFluxo(aplicarCenario(base, params))` produz o fluxo do cenário.
 */
export function aplicarCenario(config: FluxoConfig, params: CenarioParams): FluxoConfig {
  const fPreco = 1 + n(params?.precoVendaPct) / 100;
  const fCusto = 1 + n(params?.custoObraPct) / 100;
  return {
    ...config,
    linhasReceita: (config.linhasReceita ?? []).map((l) => ({
      ...l,
      tipologias: (l.tipologias ?? []).map((t: any) => ({ ...t, preco_m2: n(t?.preco_m2) * fPreco })),
    })),
    linhasCusto: (config.linhasCusto ?? []).map((c) => (
      c?.grupo === 'obra' ? { ...c, orcamento_valor: n(c?.orcamento_valor) * fCusto } : c
    )),
  };
}

// ─────────────────────────────────────────────────────────────────
// 6D. Fluxo consolidado
// ─────────────────────────────────────────────────────────────────

function recorte(mensal: number[]): { inicio: number; duracao: number } {
  let primeiro = -1; let ultimo = -1;
  for (let i = 0; i < mensal.length; i++) {
    if (Math.abs(mensal[i]) > 1e-9) { if (primeiro < 0) primeiro = i; ultimo = i; }
  }
  // mês 0-based coincide com o índice → o 1º mês com valor é o próprio índice.
  if (primeiro < 0) return { inicio: 0, duracao: 0 };
  return { inicio: primeiro, duracao: ultimo - primeiro + 1 };
}

export function calcularFluxo(config: FluxoConfig): FluxoCalc {
  const crono = config.cronograma ?? [];
  const linhasReceita = config.linhasReceita ?? [];
  const linhasCusto = config.linhasCusto ?? [];
  const taxa = n(config.taxaDescontoAa) || 12;

  // Horizonte: usa prazoMeses se dado; senão deriva do conteúdo. Meses
  // 0-based: o último mês usado é `ultimo*`, então o comprimento do array é
  // `ultimo* + 1`.
  //
  // #231: `ultimoRecebivel` considera TODOS os componentes de pagamento de
  // cada linha (entrada, parcelamento — ao longo da obra ou por
  // periodicidade —, repasse), não só o repasse como antes
  // (`ultimoCrono + maxRepasse` ignorava entrada/parcelamento longos — ex.:
  // uma tabela de 36 parcelas mensais iniciada no Pré-lançamento facilmente
  // extrapola o fim da Obra, e o horizonte antigo não via isso).
  const ultimoCrono = Math.max(0, ...crono.map((e) => n(e.inicio_mes) + n(e.duracao_meses) - 1));
  const ultimoCustos = Math.max(0, ...linhasCusto.map((c) => n(c.inicio_mes) + n(c.duracao_meses) - 1));
  const ultimoRecebivel = Math.max(0, ...linhasReceita.map((l) => ultimoMesRecebivelLinha(l, crono)));
  const prazoDerivado = Math.max(ultimoCrono, ultimoRecebivel, ultimoCustos, 11) + 1;
  const prazo = Math.max(1, Math.round(n(config.prazoMeses) || prazoDerivado));

  const ctxCusto: ContextoCusto = {
    areaPrivativaTotal: areaPrivativaTotalLinhas(linhasReceita),
    areaTerreno: n(config.areaTerreno),
    vgvTotal: linhasReceita.reduce((s, l) => s + vgvLinha(l.tipologias), 0),
  };
  ctxCusto.receitaTotal = linhasReceita.reduce(
    (s, l) => s + receitaLiquidaLinha(vgvLinha(l.tipologias), l.fluxo_pagamento), 0);
  ctxCusto.totalObra = linhasCusto
    .filter((c) => c.grupo === 'obra' && (c.orcamento_unidade || 'rs') !== 'pct_obra')
    .reduce((s, c) => s + resolverCustoTotal(c, ctxCusto), 0);

  // Receitas por linha (e por tipologia, proporcional ao VGV VENDÁVEL da
  // tipologia, #195 — uma tipologia 100% permutada não recebe fatia de caixa).
  const calcReceitas: LinhaCalc[] = linhasReceita.map((l) => {
    const mensal = receitaMensalLinha(l, crono, prazo);
    const vgvVendavelL = vgvVendavelLinha(l.tipologias);
    const r = recorte(mensal);
    const itens: LinhaCalc[] = (l.tipologias ?? []).map((t: any) => {
      const propor = vgvVendavelL > 0 ? vgvVendavelTipologia(t) / vgvVendavelL : 0;
      const mensalTip = mensal.map((v) => v * propor);
      const rt = recorte(mensalTip);
      return {
        id: t.id, nome: t.nome || 'Tipologia', grupo: 'receita' as const,
        inicio: rt.inicio, duracao: rt.duracao,
        total: mensalTip.reduce((s, v) => s + v, 0),
        vpl: vplFluxo(mensalTip, taxa),
        mensal: mensalTip,
      };
    });
    return {
      id: l.id, nome: l.nome || 'Receita', grupo: 'receita' as const,
      faseLabel: l.fase_label || undefined,
      inicio: r.inicio, duracao: r.duracao,
      total: mensal.reduce((s, v) => s + v, 0),
      vpl: vplFluxo(mensal, taxa),
      mensal, itens,
    };
  });

  // Receita mensal SÓ das vendas (caixa efetivo: entrada + parcelas + repasse
  // na entrega) — calculada aqui, antes dos custos, porque o modo
  // `unit_delivery` do Preço do Terreno (#194) e a Permuta financeira (#196)
  // precisam dela como peso de distribuição. A receita FINAL (com a dedução
  // da Permuta financeira) é calculada mais abaixo, depois de `calcCustos`.
  const receitaMensalVendas = new Array<number>(prazo).fill(0);
  for (const l of calcReceitas) for (let i = 0; i < prazo; i++) receitaMensalVendas[i] += l.mensal[i];

  // Permuta financeira (#196) é dedução da receita, não custo — sai de
  // `linhasCusto` antes do loop de custos.
  const linhasCustoSemPermutaFinanceira = linhasCusto.filter((c) => !ePermutaFinanceira(c));
  const linhasPermutaFinanceira = linhasCusto.filter(ePermutaFinanceira);

  // Custos por linha (valores positivos; sinal aplicado na consolidação).
  const curvasPorId = new Map<number, CurvaPersonalizada>(
    (config.curvas ?? []).map((k: any) => [Number(k.id), (k.valores ?? []) as CurvaPersonalizada]));
  const calcCustos: LinhaCalc[] = linhasCustoSemPermutaFinanceira.map((c) => {
    const nome = nomeLinhaCusto(c);
    // Preserva o grupo real (5 grupos das abas de Custos: Terreno · Obra ·
    // Diretos · Indiretos · Financeiro, #125) para o Proforma exibir cada seção;
    // grupo desconhecido/legado cai em 'indireto'.
    const grupo = (['terreno', 'obra', 'diretos', 'indireto', 'financeiro'].includes(c.grupo)
      ? c.grupo : 'indireto') as LinhaCalc['grupo'];

    // Corretagem: paga no mês da venda, sem cronograma próprio (#121). Início e
    // duração são o RECORTE das vendas, e o total é o que de fato entra no fluxo.
    if (eCorretagem(c)) {
      const mensal = corretagemMensal(c, linhasReceita, crono, prazo, ctxCusto);
      const r = recorte(mensal);
      return {
        id: c.id, nome, grupo,
        inicio: r.inicio, duracao: r.duracao,
        total: mensal.reduce((s, v) => s + v, 0),
        vpl: vplFluxo(mensal, taxa),
        mensal,
      };
    }

    // Preço do Terreno em `unit_delivery`/`sales_revenue` (#194): sem
    // cronograma próprio, distribuído proporcionalmente a um peso mensal —
    // `sales_revenue` acompanha o VGV VENDIDO (igual à Corretagem, absorção
    // das vendas); `unit_delivery` acompanha a RECEITA EM CAIXA (entrada +
    // parcelas + repasse na entrega das unidades). `fixo` (padrão) cai no
    // caminho normal abaixo, igual às demais linhas de Terreno.
    if (ePrecoTerreno(c) && (c.distribuicao_modo === 'unit_delivery' || c.distribuicao_modo === 'sales_revenue')) {
      const pesos = c.distribuicao_modo === 'sales_revenue'
        ? vgvVendidoMensal(linhasReceita, crono, prazo)
        : receitaMensalVendas;
      const mensal = distribuirProporcional(c, pesos, ctxCusto);
      const r = recorte(mensal);
      return {
        id: c.id, nome, grupo,
        inicio: r.inicio, duracao: r.duracao,
        total: mensal.reduce((s, v) => s + v, 0),
        vpl: vplFluxo(mensal, taxa),
        mensal,
      };
    }

    const total = resolverCustoTotal(c, ctxCusto);
    const curva = c.curva_id ? (curvasPorId.get(Number(c.curva_id)) ?? 'linear') : 'linear';
    const mensal = distribuirLinha(total, n(c.inicio_mes), n(c.duracao_meses), curva, prazo);
    return {
      id: c.id, nome, grupo,
      inicio: n(c.inicio_mes), duracao: n(c.duracao_meses),
      total,
      vpl: vplFluxo(mensal, taxa),
      mensal,
    };
  });

  // Permuta financeira (#196): mesmo mecanismo de distribuição do Preço do
  // Terreno (`fixo`/`unit_delivery`/`sales_revenue`, #194), mas o resultado
  // entra NEGATIVO em `linhasReceita` — dedução da receita, não custo.
  const calcDeducoesReceita: LinhaCalc[] = linhasPermutaFinanceira.map((c) => {
    const nome = nomeLinhaCusto(c);
    let mensalBruto: number[];
    if (c.distribuicao_modo === 'unit_delivery' || c.distribuicao_modo === 'sales_revenue') {
      const pesos = c.distribuicao_modo === 'sales_revenue'
        ? vgvVendidoMensal(linhasReceita, crono, prazo)
        : receitaMensalVendas;
      mensalBruto = distribuirProporcional(c, pesos, ctxCusto);
    } else {
      const total = resolverCustoTotal(c, ctxCusto);
      const curva = c.curva_id ? (curvasPorId.get(Number(c.curva_id)) ?? 'linear') : 'linear';
      mensalBruto = distribuirLinha(total, n(c.inicio_mes), n(c.duracao_meses), curva, prazo);
    }
    const mensal = mensalBruto.map((v) => -v);
    const r = recorte(mensal);
    return {
      id: c.id, nome, grupo: 'receita' as const,
      inicio: r.inicio, duracao: r.duracao,
      total: mensal.reduce((s, v) => s + v, 0),
      vpl: vplFluxo(mensal, taxa),
      mensal,
    };
  });

  const linhasReceitaFinal = [...calcReceitas, ...calcDeducoesReceita];
  const receitaMensal = new Array<number>(prazo).fill(0);
  for (const l of linhasReceitaFinal) for (let i = 0; i < prazo; i++) receitaMensal[i] += l.mensal[i];

  const custoMensal = new Array<number>(prazo).fill(0);
  for (const c of calcCustos) for (let i = 0; i < prazo; i++) custoMensal[i] += c.mensal[i];

  const fluxoMensal = receitaMensal.map((r, i) => r - custoMensal[i]);
  const fluxoAcumulado: number[] = [];
  let acc = 0;
  for (const v of fluxoMensal) { acc += v; fluxoAcumulado.push(acc); }

  const paybackMes = fluxoAcumulado.findIndex((v, i) => v >= 0 && fluxoMensal.slice(0, i + 1).some((x) => x < 0));
  const exposicaoMaxima = fluxoAcumulado.length ? Math.min(...fluxoAcumulado) : 0;

  // #188 — VGV Total / VGV Permuta Física / Receita Bruta (VGV): grandezas
  // informativas, consumidas pelo Resumo (#182), pela coluna % VGV do Fluxo
  // de Caixa (#189) e pela permuta física (#195, que reduz a absorção de
  // vendas ao VGV vendável). `vgvTotal` continua contando a tipologia
  // inteira — só expõe o quanto do VGV Total é atribuível a unidades
  // permutadas fisicamente.
  const vgvPermutaFisica = linhasReceita.reduce((s, l) => s + vgvPermutaFisicaLinha(l.tipologias), 0);
  const receitaBrutaVgv = ctxCusto.vgvTotal - vgvPermutaFisica;

  // #229 — grandezas 3–6 da taxonomia: contratação (bruto/desconto/líquido,
  // #227) e Receita Bruta (recebimento em caixa, #228). Somadas por linha de
  // receita ORIGINAL (`linhasReceita`, não `linhasReceitaFinal`) — a Permuta
  // Financeira (`calcDeducoesReceita`) é dedução de receita, não contratação.
  const somaMensal = (fn: (l: any, c: EventoCrono[], p: number) => number[]): number =>
    linhasReceita.reduce((s, l) => s + fn(l, crono, prazo).reduce((s2, v) => s2 + v, 0), 0);
  const vendaBrutaContratada = somaMensal(vendaBrutaContratadaMensal);
  const descontoComercial = somaMensal(descontoComercialMensal);
  const vendaLiquidaContratada = vendaBrutaContratada - descontoComercial;
  const receitaBruta = somaMensal(recebimentoBrutoMensal);

  return {
    prazo,
    meses: Array.from({ length: prazo }, (_, i) => rotuloMesRelativo(config.dataInicio, i)),
    receitaMensal, custoMensal, fluxoMensal, fluxoAcumulado,
    vgvTotal: ctxCusto.vgvTotal,
    vpl: vplFluxo(fluxoMensal, taxa),
    tir: tirFluxo(fluxoMensal),
    paybackMes: paybackMes >= 0 ? paybackMes : null,
    paybackData: paybackMes >= 0 ? mesRelativoCompleto(config.dataInicio, paybackMes) : null,
    exposicaoMaxima,
    vgvPermutaFisica,
    receitaBrutaVgv,
    vgvVendavel: receitaBrutaVgv,
    vendaBrutaContratada,
    descontoComercial,
    vendaLiquidaContratada,
    receitaBruta,
    linhasReceita: linhasReceitaFinal,
    linhasCusto: calcCustos,
  };
}
