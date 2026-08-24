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
  absorcaoMensal, periodoAbsorcao, vgvLinha, receitaLiquidaLinha,
  vgvVendavelTipologia, vgvVendavelLinha,
  areaPrivativaTotalLinhas, resolverCustoTotal, mesRelativoCompleto, rotuloMesRelativo,
  eCorretagem, vgvVendidoMensal, ePrecoTerreno, ePermutaFisica, ePermutaFinanceira,
  type EventoCrono, type ContextoCusto, type PeriodoAgregado,
} from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;

/** #260: quantiza a 2 casas — contrato C7, valor monetário resultado de fórmula. */
const round2 = (v: number): number => Math.round(v * 100) / 100;

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

type ReservaPermutaFisica = {
  porTipologia: Map<string, number>;
  vgv: number;
  usaFonteNova: boolean;
};

function chaveTipologiaLinha(linha: any, linhaIndex: number, tipologia: any, tipologiaIndex: number): string {
  return `${linha?.id ?? linhaIndex}:${tipologia?.id ?? tipologiaIndex}`;
}

/**
 * Aloca as unidades reservadas em Custos às alocações de Receitas da mesma
 * tipologia. A quantidade é consumida uma única vez, mesmo quando a tipologia
 * aparece em vários Grupos; o preço/m² da alocação correspondente é usado só
 * para medir o VGV informativo. Nenhuma parcela desta reserva entra no caixa.
 */
function reservarPermutasFisicas(linhasReceita: any[], linhasCusto: any[]): ReservaPermutaFisica {
  const custos = (linhasCusto ?? []).filter(ePermutaFisica);
  const usaFonteNova = custos.length > 0;
  const reservas = new Map<number, number>();
  for (const c of custos) {
    const tipologiaId = Number(c.permuta_tipologia_id);
    const quantidade = Math.max(0, Math.round(n(c.permuta_quantidade)));
    if (Number.isFinite(tipologiaId) && quantidade > 0) {
      reservas.set(tipologiaId, (reservas.get(tipologiaId) ?? 0) + quantidade);
    }
  }

  const porTipologia = new Map<string, number>();
  let vgv = 0;
  for (const [tipologiaId, reservadaInicial] of reservas) {
    let restante = reservadaInicial;
    for (let li = 0; li < (linhasReceita ?? []).length && restante > 0; li++) {
      const linha = linhasReceita[li];
      for (let ti = 0; ti < (linha.tipologias ?? []).length && restante > 0; ti++) {
        const t = linha.tipologias[ti];
        const id = Number(t?.tipologia_id ?? t?.id);
        if (id !== tipologiaId) continue;
        const chave = chaveTipologiaLinha(linha, li, t, ti);
        const disponivel = Math.max(0, n(t.quantidade) - (porTipologia.get(chave) ?? 0));
        const usada = Math.min(restante, disponivel);
        if (usada <= 0) continue;
        porTipologia.set(chave, usada);
        vgv += usada * n(t.area_privativa_m2) * n(t.preco_m2);
        restante -= usada;
      }
    }
  }
  return { porTipologia, vgv, usaFonteNova };
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
  // #346: RET é global do estudo (era por Grupo, `linhasReceita[i].fluxo_pagamento.ret`).
  ret?: { ativo: boolean; pct: number };
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
  // #238: só em linha de Permuta financeira em % VGV. O motor calcula as DUAS
  // bases (bruta e líquida) e usa a escolhida em `permuta_financeira_base`;
  // esta é a NÃO escolhida, exposta para auditoria — o critério da issue pede
  // que a outra visão fique disponível, não que seja descartada em silêncio.
  permutaAlternativa?: { base: 'bruta' | 'liquida'; total: number };
}

/**
 * Quantiza uma série monetária sem deixar centavos "sumirem" no total: todos
 * os meses recebem duas casas e o resíduo fica no último mês não nulo. Assim,
 * a soma da linha é exatamente o total informado, inclusive em rateios.
 */
function quantizarSerieMonetaria(valores: number[], total?: number): number[] {
  const alvo = round2(total ?? valores.reduce((s, v) => s + v, 0));
  const ultimo = valores.reduce((idx, v, i) => Math.abs(v) > 1e-9 ? i : idx, -1);
  if (ultimo < 0) return valores.map(() => 0);
  let acumulado = 0;
  return valores.map((v, i) => {
    if (i === ultimo) return round2(alvo - acumulado);
    const q = round2(v);
    acumulado += q;
    return q;
  });
}

function quantizarLinhaMonetaria(linha: LinhaCalc, taxaAa: number): LinhaCalc {
  if (linha.itens?.length) {
    const itens = linha.itens.map((item) => quantizarLinhaMonetaria(item, taxaAa));
    const mensal = linha.mensal.map((_, i) => round2(itens.reduce((s, item) => s + (item.mensal[i] ?? 0), 0)));
    const total = round2(mensal.reduce((s, v) => s + v, 0));
    return { ...linha, itens, mensal, total, vpl: round2(vplFluxo(mensal, taxaAa)) };
  }
  const mensal = quantizarSerieMonetaria(linha.mensal, linha.total);
  const total = round2(mensal.reduce((s, v) => s + v, 0));
  return { ...linha, mensal, total, vpl: round2(vplFluxo(mensal, taxaAa)) };
}

// ─────────────────────────────────────────────────────────────────
// #229 — Taxonomia de grandezas (EVI-009 + emenda Calliandra 2026-08-01)
// ─────────────────────────────────────────────────────────────────
//
// Oito grandezas, sem nome ambíguo entre si. Desde a #283, todas têm valor no
// motor para linhas que optam pelo contrato canônico de componentes; linhas
// legadas preservam o cálculo anterior e expõem juros/carteira/repasse zerados.
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
//  7. Principal recebido     = `principalRecebidoMensal` — caixa sem juros
//  8. Juros                  = `jurosClientesMensal` / `jurosClientes`
//
// `receitaMensal`/`fluxoMensal` (o que efetivamente entra no fluxo) usam o
// RECEBIMENTO LÍQUIDO (`recebimentoLiquidoMensal`, #228) — Receita Bruta menos
// o imposto (RET). Nenhuma dessas oito grandezas é o mesmo número que outra;
// consumidor que precisar de mais de uma tem de nomear qual está lendo.
//
// ✅ #260 (2026-08-02): as séries de #227/#228 (`vendaBrutaContratadaMensal`,
// `descontoComercialMensal`, `vendaLiquidaContratadaMensal`,
// `recebimentoBrutoMensal`, `impostoMensal`, `recebimentoLiquidoMensal`) e os
// quatro totais agregados de `calcularFluxo` (`vendaBrutaContratada`,
// `descontoComercial`, `vendaLiquidaContratada`, `receitaBruta`) agora
// quantizam a 2 casas (`round2`, contrato C7) — a dívida técnica registrada
// na verificação da Fase 4 foi fechada aqui.
//
// Também identificado na verificação: a corretagem (`corretagemMensal`,
// via `vgvVendidoMensal`) segue usando VGV BRUTO (`vgvLinha`) como base,
// enquanto a série canônica de contratação (`vendaBrutaContratadaMensal`)
// usa VGV VENDÁVEL. O corpo da #227 pedia uma função única para as duas — a
// unificação ficou incompleta (decisão do autor mantida — corretagem
// bruto/VGV — mas via caminho de código separado, não a mesma série).

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
  /**
   * #427 — total ISOLADO da dedução de Permuta financeira (`ePermutaFinanceira`),
   * já com o sinal ESTORNADO: positivo, pronto para SOMAR de volta ao Resultado
   * — o mesmo mecanismo de `Premissas e Resultados!P37 = P39 − P15 − P16` da
   * EVI. Soma direto de `calcDeducoesReceita` (que já filtra só essas linhas);
   * NÃO reconstruir por `Σ min(0, total)` sobre `linhasReceita` — funciona só
   * por acidente de sinal e quebra na primeira dedução nova. Zero quando não
   * há linha de permuta financeira.
   */
  permutaFinanceiraTotal: number;
  // #188/#229: nome histórico, MANTIDO por compatibilidade (8+ consumidores em
  // fluxo-tabela.ts/exportar.ts) — mas o valor NÃO é "Receita Bruta" no sentido
  // do EVI (recebimento em caixa); é VGV VENDÁVEL. Use `vgvVendavel` (idêntico,
  // nome correto) em código novo. O rótulo de UI já foi corrigido (fluxo-tabela.ts).
  receitaBrutaVgv: number;
  vgvVendavel: number;              // #229 — grandeza 2, alias correto de receitaBrutaVgv
  vendaBrutaContratada: number;     // #229 — grandeza 3: Σ vendaBrutaContratadaMensal
  descontoComercial: number;        // #229 — grandeza 4: Σ descontoComercialMensal
  vendaLiquidaContratada: number;   // #229 — grandeza 5: bruto − descontos
  vendaBrutaContratadaMensal: number[];
  descontoComercialMensal: number[];
  vendaLiquidaContratadaMensal: number[];
  receitaBruta: number;             // #229 — grandeza 6: Σ recebimentoBrutoMensal (#228)
  // #283: séries econômicas do contrato canônico por componentes. Em estudos
  // legados, `receitaBrutaMensal`/`principalRecebidoMensal` reproduzem o caixa
  // vigente e as séries novas ficam zeradas — nenhum resultado retroativo.
  receitaBrutaMensal: number[];
  principalRecebidoMensal: number[];
  jurosClientesMensal: number[];
  carteiraClientesMensal: number[];
  repasseMensal: number[];
  receitaPorComponenteMensal: SeriesComponentesReceita;
  carteiraPorComponenteMensal: SeriesComponentesCarteira;
  jurosClientes: number;
  carteiraClientesMaxima: number;
  mesCarteiraClientesMaxima: number | null;
  // #237/#241: mesma Receita Bruta canônica, aberta por linha de receita e
  // tipologia. `linhasReceita` permanece sendo o recebimento líquido que
  // alimenta o fluxo (incluindo deduções de permuta financeira).
  linhasReceitaBruta: LinhaCalc[];
  linhasVendasContratadas: LinhaCalc[];
  linhasReceita: LinhaCalc[];
  linhasCusto: LinhaCalc[];
}

// ─────────────────────────────────────────────────────────────────
// 6B. Motor de receita
// ─────────────────────────────────────────────────────────────────

const INTERVALO_PERIODICIDADE: Record<string, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12,
};

// #345: o Repasse é travado no 1º mês após o fim da Obra, em qualquer
// estudo (novo ou legado) — `fluxo_pagamento.repasse.apos_entrega_meses`
// persistido (se houver, de estudo legado) deixou de ser lido pelo motor.
const REPASSE_MESES_APOS_ENTREGA = 1;

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
  return saida.map(round2); // #260 — C7
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
  if (Array.isArray(linha?.fluxo_pagamento?.componentes)) {
    const obra = cronograma.find((e) => e.evento === 'obra');
    const mesEntrega = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;
    const componentes = componentesPagamento(linha.fluxo_pagamento, cronograma);
    for (let safra = 0; safra < bruto.length; safra++) {
      if (bruto[safra] <= 0) continue;
      for (const c of componentesIntegradosSafra(componentes, safra, mesEntrega)) {
        if (c.tipo === 'imediato' && c.descontoPct > 0) {
          saida[safra] += bruto[safra] * (c.participacaoPct / 100) * (c.descontoPct / 100);
        }
      }
    }
    return saida.map(round2);
  }
  const entradas = normalizarLinhasPagamento(linha?.fluxo_pagamento?.entrada);
  if (entradas.length === 0) return saida;
  for (let i = 0; i < bruto.length; i++) {
    if (bruto[i] <= 0) continue;
    for (const e of entradas) {
      const parcela = bruto[i] * (n(e?.pct) / 100);
      if (parcela > 0 && n(e?.descontoPct) > 0) saida[i] += parcela * (n(e.descontoPct) / 100);
    }
  }
  return saida.map(round2); // #260 — C7
}

/** #227: venda LÍQUIDA contratada = bruta − desconto comercial. */
export function vendaLiquidaContratadaMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): number[] {
  const bruto = vendaBrutaContratadaMensal(linha, cronograma, prazoTotal);
  const desconto = descontoComercialMensal(linha, cronograma, prazoTotal);
  return bruto.map((v, i) => round2(v - desconto[i])); // #260 — C7
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
// persistência se o ganho justificar. A #230 entregou o TIPO e o ADAPTER
// (`componentesDoLegado`); a matemática de safra/PMT veio em #232+; e a #283
// LIGOU as duas ao fluxo consolidado. Hoje `recebimentoBrutoMensal` (:1335)
// consulta `recebiveisComponentesLinha` PRIMEIRO e só cai no motor legado
// (`entrada`/`parcelas`/`repasse`) quando a linha não tem
// `fluxo_pagamento.componentes` persistido.

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
      taxaMensal: number;           // #234: juros entre a safra e o pagamento (0 = repasse legado)
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
 *    `REPASSE_MESES_APOS_ENTREGA`, travado em 1 — #345).
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
    const mesRepasse = fimObra + REPASSE_MESES_APOS_ENTREGA;
    componentes.push({ tipo: 'concentrado', participacaoPct: pctRepasse, mesPagamento: mesRepasse, taxaMensal: 0, rotulo: 'repasse (legado)' });
  }

  return componentes;
}

/**
 * Resolve o único contrato de domínio da #230. Novos estudos podem persistir
 * `fluxo_pagamento.componentes`; estudos existentes seguem pelo adaptador
 * legado, sem alteração de resultado. Desde a #283, o motor real consome o
 * contrato canônico quando ele está explicitamente persistido na linha.
 */
export function componentesPagamento(fluxoPagamento: any, cronograma: EventoCrono[]): ComponentePagamento[] {
  if (Array.isArray(fluxoPagamento?.componentes)) {
    return fluxoPagamento.componentes.map((c: any) => ({ ...c })) as ComponentePagamento[];
  }
  return componentesDoLegado(fluxoPagamento, cronograma);
}

// ─────────────────────────────────────────────────────────────────
// #232/#233/#234 — Motor de safras: PMT, prazo fixo, até marco, concentrado
// ─────────────────────────────────────────────────────────────────
//
// Cada mês de contratação (venda líquida contratada, #227) forma uma SAFRA.
// Estas funções calculam os pagamentos de UMA safra para UM componente —
// reconciliadas mês a mês contra o oráculo dourado Calliandra
// (`frontend/fixtures/calliandra-golden.ts`, #220). São o motor de cálculo
// que o corpo de #230 previa para #232+, e desde a #283 ele É o caminho de
// cálculo real: `calcularRecebiveisComponentes` (:1064) consolida as safras
// de uma linha e `calcularFluxo` (:2025-2053) agrega principal, juros,
// carteira, repasse e as séries por componente. A porta de entrada é
// `fluxo_pagamento.componentes` na linha; sem ele, a linha segue pelo motor
// legado (`entrada`/`parcelas`/`repasse`), que continua existindo para
// estudo nunca reeditado. Como `fluxoPagamentoParaSalvar`
// (`frontend/fluxo-pagamento-editor.ts:90`) grava `componentes` em toda
// escrita, todo Grupo já editado desde a #248 usa este caminho.
//
// ⚠️ A matemática de juros existe e é exercitada por estudo real; o que falta
// é a ENTRADA. Há linha em produção com `taxaMensal` diferente de 0 (estudo 5
// de Pinguim: 0.0098636 = 12,5% a.a., R$ 1.259.273,59). O modal não oferece
// campo de taxa nem de sinal, e o adaptador fixa `taxaMensal: 0` /
// `sinalPct: 0` (:589,601,608,617) — então abrir o modal e clicar "Aplicar"
// APAGA os juros da linha, sem undo — e, desde a #436, com aviso na tela (o
// bloco "Juros de tabela" do modal diz isso). Escrever "`jurosClientes` é
// sempre 0" é errado: os juros existem e viram zero no primeiro Aplicar.

/** PMT — parcela fixa que amortiza `principal` em `n` períodos à `taxaMensal`.
 * Taxa zero → divisão simples (sem juros). `n` ≤ 0 → 0 (guarda defensiva). */
export function pmt(taxaMensal: number, n: number, principal: number): number {
  if (n <= 0) return 0;
  if (taxaMensal === 0) return principal / n;
  return (principal * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -n));
}

/** Um pagamento de uma safra: sinal (no mês da contratação), parcela (prazo
 * fixo ou até marco) ou concentrado (repasse/liquidação). */
export interface PagamentoSafra {
  safra: number;    // mês da contratação (0-based)
  mes: number;       // mês do pagamento
  tipo: 'sinal' | 'parcela' | 'concentrado';
  valor: number;
}

/**
 * #232: pagamentos de um componente `prazo_fixo` para a safra iniciada em
 * `safra`, sobre `valorContratado` do mês (líquido de desconto, #227).
 *
 * Sinal (se `sinalPct > 0`) no próprio mês da safra. As `prazoMeses` parcelas
 * (PMT) começam em `safra + defasagemMeses` — por padrão do modelo novo,
 * `defasagemMeses = 1` (1º vencimento no mês SEGUINTE à contratação, nunca no
 * próprio mês — a convenção reconciliada contra o Anexo G.1); o adapter do
 * legado (`componentesDoLegado`) usa `defasagemMeses = 0` só para reproduzir
 * o comportamento atual de uma entrada parcelada (1ª parcela no mês da
 * venda), que é INTENCIONALMENTE diferente deste modelo novo.
 */
export function pagamentosPrazoFixo(
  c: Extract<ComponentePagamento, { tipo: 'prazo_fixo' }>,
  safra: number,
  valorContratado: number,
): PagamentoSafra[] {
  const valor = valorContratado * (c.participacaoPct / 100);
  if (valor <= 0) return [];
  // O plano de uma safra também é monetário (C7): sinal e principal já
  // nascem em centavos. As 36 PMTs podem deixar um resíduo de arredondamento;
  // ele vai exclusivamente para a última parcela, sem criar uma 37ª.
  const sinal = round2(valor * (c.sinalPct / 100));
  const principal = round2(valor - sinal);
  const out: PagamentoSafra[] = [];
  if (sinal > 0) out.push({ safra, mes: safra, tipo: 'sinal', valor: sinal });
  const parcelaBruta = pmt(c.taxaMensal, c.prazoMeses, principal);
  const totalParcelas = round2(parcelaBruta * c.prazoMeses);
  const parcela = round2(parcelaBruta);
  let parcelasAnteriores = 0;
  for (let k = 1; k <= c.prazoMeses; k++) {
    const valorParcela = k === c.prazoMeses
      ? round2(totalParcelas - parcelasAnteriores)
      : parcela;
    out.push({ safra, mes: safra + c.defasagemMeses + (k - 1), tipo: 'parcela', valor: valorParcela });
    parcelasAnteriores = round2(parcelasAnteriores + valorParcela);
  }
  return out;
}

/**
 * #233: pagamentos de um componente `ate_marco` para a safra iniciada em
 * `safra` — a regra que corrige a premissa errada do corpo publicado no
 * GitHub ("1ª parcela no mês da venda"). A correta, reconciliada contra o
 * Anexo G.2 (Calliandra até Obra + repasse):
 *
 *   N_s = marcoMes − safra    (varia por safra — venda tardia tem MENOS
 *                              parcelas e cada parcela é MAIOR, mesmo principal)
 *   1ª parcela em safra + defasagemMeses (default 1 — nunca no mês da venda)
 *   última parcela em marcoMes
 *
 * `N_s ≤ 0` (venda no mês do marco ou depois) é ERRO — o motor não cria
 * prazo negativo nem concentra tudo de qualquer jeito; quem chama decide se
 * bloqueia a configuração ou converte para `imediato`/`concentrado`.
 */
export function pagamentosAteMarco(
  c: Extract<ComponentePagamento, { tipo: 'ate_marco' }>,
  safra: number,
  valorContratado: number,
): PagamentoSafra[] {
  const valor = valorContratado * (c.participacaoPct / 100);
  if (valor <= 0) return [];
  const sinal = round2(valor * (c.sinalPct / 100));
  const principal = round2(valor - sinal);
  const nParcelas = c.marcoMes - safra - (c.defasagemMeses - 1);
  if (nParcelas <= 0) {
    throw new Error(
      `pagamentosAteMarco: N_s = ${nParcelas} ≤ 0 na safra ${safra} (marco ${c.marcoMes}). ` +
      'O motor não cria prazo negativo — converta o componente para imediato ou concentrado (#233).',
    );
  }
  const out: PagamentoSafra[] = [];
  if (sinal > 0) out.push({ safra, mes: safra, tipo: 'sinal', valor: sinal });
  const parcelaBruta = pmt(c.taxaMensal, nParcelas, principal);
  const totalParcelas = round2(parcelaBruta * nParcelas);
  const parcela = round2(parcelaBruta);
  let parcelasAnteriores = 0;
  for (let k = 1; k <= nParcelas; k++) {
    const valorParcela = k === nParcelas
      ? round2(totalParcelas - parcelasAnteriores)
      : parcela;
    out.push({ safra, mes: safra + c.defasagemMeses + (k - 1), tipo: 'parcela', valor: valorParcela });
    parcelasAnteriores = round2(parcelasAnteriores + valorParcela);
  }
  return out;
}

/**
 * #234: pagamento único (concentrado) de uma safra — repasse ou liquidação
 * final, num mês fixo (`mesPagamento`, independente da safra — quem chama já
 * aplica `Math.max(mesPagamento, safra)` se precisar garantir não pagar antes
 * da venda). Convenção de juros explícita: **juros começam DEPOIS da
 * contratação** — `saldo_s,s = principal_s` (a própria emenda da #234) — ou
 * seja, o principal só passa a capitalizar a partir do mês SEGUINTE à safra,
 * não no mês da venda. Com `taxaMensal = 0` (o repasse legado, #230), o
 * valor pago é exatamente o principal — "o repasse é apenas a soma dos
 * principais", como o Anexo G.2 reconcilia.
 *
 * Liquidação integral: por construção, um único pagamento no mês do marco
 * fecha o saldo daquela safra em zero (não sobra resíduo) — a carteira (#236)
 * confirma isso agregando por safra.
 */
export function pagamentosConcentrado(
  c: Extract<ComponentePagamento, { tipo: 'concentrado' }>,
  safra: number,
  valorContratado: number,
): PagamentoSafra[] {
  const principal = round2(valorContratado * (c.participacaoPct / 100));
  if (principal <= 0) return [];
  if (c.mesPagamento < safra) {
    throw new Error(
      `pagamentosConcentrado: mês de pagamento ${c.mesPagamento} anterior à safra ${safra}. ` +
      'O repasse não pode ser antecipado para antes da contratação (#234).',
    );
  }
  // #234: saldo_s,s = principal (0 períodos decorridos no próprio mês da
  // safra); em mesPagamento já decorreram (mesPagamento − safra) períodos —
  // nunca negativo, pagamento na própria safra ou antes não acumula juros.
  const mesesDeJuros = Math.max(0, c.mesPagamento - safra);
  const valor = round2(principal * Math.pow(1 + c.taxaMensal, mesesDeJuros));
  return [{ safra, mes: c.mesPagamento, tipo: 'concentrado', valor }];
}

/** Saldo devedor de UMA safra em UM mês (#236). */
export interface SaldoSafra {
  safra: number;
  mes: number;
  saldo: number;
}

/**
 * #236: carteira — saldo devedor por SAFRA e COMPONENTE, mês a mês. Nunca
 * agrega safras num saldo único: essa é exatamente a recorrência que produz
 * o defeito do Urbitá (saldo agregado que pode ficar negativo e depois
 * "ressurgir" quando uma safra nova aporta enquanto outra ainda amortiza).
 * Cada safra decai isolada, com sua própria taxa e seu próprio principal —
 * quem quiser a carteira total do estudo SOMA as séries desta função, nunca
 * substitui por um único acumulador recorrente.
 *
 * `saldo_{s,s} = principal_s` (após o sinal, se houver — mesma convenção da
 * #234: sem juros no mês da contratação); `saldo_{s,t} = saldo_{s,t-1} ×
 * (1+taxa) − pagamentos_s(t)`, nunca negativo — o último mês da safra é
 * grampeado em zero (liquidação exata; resíduo de ponto flutuante não é
 * saldo real). `imediato` não tem saldo (paga e encerra no mesmo mês).
 */
export function carteiraSaldoSafra(
  c: ComponentePagamento,
  safra: number,
  valorContratado: number,
): SaldoSafra[] {
  if (c.tipo === 'imediato') return [];

  if (c.tipo === 'concentrado') {
    const pagamentos = pagamentosConcentrado(c, safra, valorContratado);
    if (pagamentos.length === 0) return [];
    const principal = round2(valorContratado * (c.participacaoPct / 100));
    const out: SaldoSafra[] = [{ safra, mes: safra, saldo: principal }];
    let saldo = principal;
    for (let mes = safra + 1; mes <= c.mesPagamento; mes++) {
      saldo = mes === c.mesPagamento ? 0 : round2(saldo * (1 + c.taxaMensal));
      out.push({ safra, mes, saldo: Math.max(0, saldo) });
    }
    return out;
  }

  const pagamentos = c.tipo === 'prazo_fixo'
    ? pagamentosPrazoFixo(c, safra, valorContratado)
    : pagamentosAteMarco(c, safra, valorContratado);
  if (pagamentos.length === 0) return [];

  const valor = valorContratado * (c.participacaoPct / 100);
  const sinal = round2(valor * (c.sinalPct / 100));
  const principal = round2(valor - sinal);
  const porMes = new Map<number, number>();
  let ultimoMes = safra;
  for (const p of pagamentos) {
    if (p.tipo === 'sinal') continue;
    porMes.set(p.mes, (porMes.get(p.mes) ?? 0) + p.valor);
    ultimoMes = Math.max(ultimoMes, p.mes);
  }

  const out: SaldoSafra[] = [{ safra, mes: safra, saldo: principal }];
  let saldo = principal;
  for (let mes = safra + 1; mes <= ultimoMes; mes++) {
    saldo = round2(saldo * (1 + c.taxaMensal) - (porMes.get(mes) ?? 0));
    if (mes === ultimoMes) saldo = 0;
    out.push({ safra, mes, saldo: Math.max(0, saldo) });
  }
  return out;
}

/**
 * #237: juros pagos por UM componente de UMA safra — a diferença entre o
 * total efetivamente recebido (parcelas/liquidação, exclui o sinal, que não
 * carrega juros) e o principal daquele componente. Para `prazo_fixo`/
 * `ate_marco` a PMT já embute juros e amortização; para `concentrado` é a
 * capitalização entre a safra e `mesPagamento` (#234). `imediato` não gera
 * juros (paga no próprio mês). Taxa zero → sempre 0, por construção.
 */
export function jurosSafra(
  c: ComponentePagamento,
  safra: number,
  valorContratado: number,
): number {
  if (c.tipo === 'imediato') return 0;
  if (c.taxaMensal === 0) return 0;

  if (c.tipo === 'concentrado') {
    const pagamentos = pagamentosConcentrado(c, safra, valorContratado);
    if (pagamentos.length === 0) return 0;
    const principal = round2(valorContratado * (c.participacaoPct / 100));
    return round2(pagamentos[0].valor - principal);
  }

  const pagamentos = c.tipo === 'prazo_fixo'
    ? pagamentosPrazoFixo(c, safra, valorContratado)
    : pagamentosAteMarco(c, safra, valorContratado);
  if (pagamentos.length === 0) return 0;

  const valor = valorContratado * (c.participacaoPct / 100);
  const sinal = round2(valor * (c.sinalPct / 100));
  const principal = round2(valor - sinal);
  const totalParcelas = round2(pagamentos
    .filter((p) => p.tipo === 'parcela')
    .reduce((soma, p) => soma + p.valor, 0));
  return round2(totalParcelas - principal);
}

/**
 * #237: invariante da emenda — Receita Bruta = líquido + juros = bruto −
 * descontos + juros. Verificada aqui por SAFRA, na granularidade em que o
 * motor de componentes (#232–#236) já opera: soma de TODOS os pagamentos de
 * TODOS os componentes daquela safra (`receitaBrutaSafra`) contra o valor
 * líquido contratado da safra mais a soma dos juros de cada componente
 * (`jurosSafra`). Sem juros (taxa 0 em todo componente), a identidade se
 * reduz a "Receita Bruta = líquido" — o comportamento preservado para linhas
 * legadas; a #283 liga este motor a `calcularFluxo` somente por opt-in.
 */
export function receitaBrutaSafra(
  componentes: ComponentePagamento[],
  safra: number,
  valorContratado: number,
): number {
  if (componentes.every((c) => c.tipo === 'imediato' || c.taxaMensal === 0)) {
    const descontos = componentes
      .filter((c): c is Extract<ComponentePagamento, { tipo: 'imediato' }> => c.tipo === 'imediato')
      .reduce((total, c) => total + valorContratado * (c.participacaoPct / 100) * (c.descontoPct / 100), 0);
    return round2(valorContratado - descontos);
  }
  let total = 0;
  for (const c of componentes) {
    if (c.tipo === 'imediato') {
      total += valorContratado * (c.participacaoPct / 100) * (1 - c.descontoPct / 100);
    } else if (c.tipo === 'concentrado') {
      total += pagamentosConcentrado(c, safra, valorContratado).reduce((s, p) => s + p.valor, 0);
    } else {
      const pagamentos = c.tipo === 'prazo_fixo'
        ? pagamentosPrazoFixo(c, safra, valorContratado)
        : pagamentosAteMarco(c, safra, valorContratado);
      total += pagamentos.reduce((s, p) => s + p.valor, 0);
    }
  }
  return round2(total);
}

/**
 * #235: vendas contratadas DEPOIS da entrega (safra posterior ao fim da
 * Obra — janela "Após-chaves", #226) são recebidas 100% à vista no mês da
 * contratação, independentemente do fluxo de pagamento configurado no
 * Grupo: depois da entrega a incorporadora não concede o financiamento
 * direto do padrão (tabela curta/longa, até marco). O comprador pode
 * combinar entrada própria com financiamento bancário, mas ambos chegam no
 * mesmo mês para a incorporadora — sem sinal futuro, parcela nem repasse
 * para essa venda. Vendas anteriores ou NO próprio mês da entrega continuam
 * pelos componentes normais; contratos antigos (de safras anteriores) não
 * são afetados — cada safra é tratada isoladamente, como em todo este motor.
 */
export function ehVendaAposChaves(safra: number, mesEntrega: number): boolean {
  return safra > mesEntrega;
}

export function componentesEfetivosSafra(
  componentes: ComponentePagamento[],
  safra: number,
  mesEntrega: number,
): ComponentePagamento[] {
  if (!ehVendaAposChaves(safra, mesEntrega)) return componentes;
  return [{ tipo: 'imediato', participacaoPct: 100, descontoPct: 0 }];
}

/** Uma contratação mensal usada para consolidar a carteira econômica (#236). */
export interface ContratacaoSafra {
  safra: number;
  valorContratado: number;
}

/** Saldos mensais abertos pelas três famílias financiadas do contrato. */
export interface CarteiraClientesMensal {
  mes: number;
  prazoFixo: number;
  ateMarco: number;
  concentrado: number;
  total: number;
}

export interface CarteiraClientesConsolidada {
  mensal: CarteiraClientesMensal[];
  carteiraMaxima: number;
  mesCarteiraMaxima: number | null;
}

/** Séries que a integração da #283 entrega ao fluxo consolidado. */
export interface RecebiveisComponentesCalc {
  recebimentoBrutoMensal: number[];
  principalRecebidoMensal: number[];
  jurosMensal: number[];
  carteiraMensal: number[];
  repasseMensal: number[];
  receitaPorComponenteMensal: SeriesComponentesReceita;
  carteiraPorComponenteMensal: SeriesComponentesCarteira;
  carteiraMaxima: number;
  mesCarteiraMaxima: number | null;
}

/** #241: categorias econômicas estáveis compartilhadas por motor, tela e
 * exportações. `outros` preserva estudos legados sem reclassificá-los. */
export interface SeriesComponentesReceita {
  aVista: number[];
  tabelaCurta: number[];
  tabelaLongaObra: number[];
  repasse: number[];
  aposChaves: number[];
  outros: number[];
}

export interface SeriesComponentesCarteira {
  tabelaCurta: number[];
  tabelaLongaObra: number[];
  saldoARepassar: number[];
}

// #349: estes dois mapas ficaram SEM CONSUMIDOR quando a tabela e a exportação
// deixaram de listar os blocos "Componente · …" e Carteira de clientes. Não são
// código morto por descuido: as séries que eles rotulam
// (`receitaPorComponenteMensal`/`carteiraPorComponenteMensal`) continuam sendo
// calculadas, conservadas e testadas, e a aba "Análise Financeira" da #351 é o
// destino natural delas. Se a #351 fechar sem usá-los, aí sim vira remoção.
export const ROTULOS_COMPONENTES_RECEITA: Record<keyof SeriesComponentesReceita, string> = {
  aVista: 'À vista',
  tabelaCurta: 'Tabela curta',
  tabelaLongaObra: 'Tabela longa — Obra',
  repasse: 'Repasse',
  aposChaves: 'Após-chaves',
  outros: 'Legado / não classificado',
};

export const ROTULOS_COMPONENTES_CARTEIRA: Record<keyof SeriesComponentesCarteira, string> = {
  tabelaCurta: 'Curta',
  tabelaLongaObra: 'Longa — Obra',
  saldoARepassar: 'Saldo a repassar',
};

function componentesIntegradosSafra(
  componentes: ComponentePagamento[],
  safra: number,
  mesEntrega: number,
): ComponentePagamento[] {
  const efetivos = componentesEfetivosSafra(componentes, safra, mesEntrega);
  // #233 delega ao chamador a decisão para N_s <= 0. Na integração real, a
  // fração "até o marco" contratada no próprio marco vence imediatamente;
  // não se cria prazo negativo nem se invalida toda a safra.
  return efetivos.map((c) => c.tipo === 'ate_marco'
    && c.marcoMes - safra - (c.defasagemMeses - 1) <= 0
    ? { tipo: 'imediato' as const, participacaoPct: c.participacaoPct, descontoPct: 0, rotulo: c.rotulo }
    : c);
}

function pagamentosComponenteSafra(
  componente: ComponentePagamento,
  safra: number,
  valorContratado: number,
): PagamentoSafra[] {
  if (componente.tipo === 'imediato') {
    const valor = round2(valorContratado * (componente.participacaoPct / 100)
      * (1 - componente.descontoPct / 100));
    return valor > 0 ? [{ safra, mes: safra, tipo: 'parcela', valor }] : [];
  }
  if (componente.tipo === 'prazo_fixo') return pagamentosPrazoFixo(componente, safra, valorContratado);
  if (componente.tipo === 'ate_marco') return pagamentosAteMarco(componente, safra, valorContratado);
  return pagamentosConcentrado(componente, safra, valorContratado);
}

/**
 * #283: consolida pagamentos, principal, juros, carteira e repasse de todas as
 * safras de uma linha que optou por `fluxo_pagamento.componentes`.
 */
export function calcularRecebiveisComponentes(
  componentes: ComponentePagamento[],
  contratacoes: ContratacaoSafra[],
  mesEntrega: number,
  prazoTotal: number,
): RecebiveisComponentesCalc {
  const tamanho = Math.max(0, prazoTotal);
  const bruto = new Array<number>(tamanho).fill(0);
  const principal = new Array<number>(tamanho).fill(0);
  const juros = new Array<number>(tamanho).fill(0);
  const carteira = new Array<number>(tamanho).fill(0);
  const repasse = new Array<number>(tamanho).fill(0);
  const vazia = () => new Array<number>(tamanho).fill(0);
  const receitaPorComponenteMensal: SeriesComponentesReceita = {
    aVista: vazia(), tabelaCurta: vazia(), tabelaLongaObra: vazia(),
    repasse: vazia(), aposChaves: vazia(), outros: vazia(),
  };
  const carteiraPorComponenteMensal: SeriesComponentesCarteira = {
    tabelaCurta: vazia(), tabelaLongaObra: vazia(), saldoARepassar: vazia(),
  };

  const deposita = (serie: number[], mes: number, valor: number) => {
    if (valor === 0) return;
    if (mes >= 0 && mes < serie.length) serie[mes] = round2(serie[mes] + valor);
    else console.warn(
      `fluxo-caixa-motor: recebível canônico de ${valor.toFixed(2)} no mês ${mes} ` +
      `cai fora do horizonte (${serie.length} meses) e não foi computado.`,
    );
  };

  for (const contratacao of contratacoes) {
    if (contratacao.valorContratado <= 0) continue;
    const efetivos = componentesIntegradosSafra(componentes, contratacao.safra, mesEntrega);
    const aposChaves = ehVendaAposChaves(contratacao.safra, mesEntrega);
    for (const componente of efetivos) {
      const chaveReceita: keyof SeriesComponentesReceita = aposChaves ? 'aposChaves'
        : componente.tipo === 'imediato' ? 'aVista'
          : componente.tipo === 'prazo_fixo' ? 'tabelaCurta'
            : componente.tipo === 'ate_marco' ? 'tabelaLongaObra' : 'repasse';
      const chaveCarteira: keyof SeriesComponentesCarteira | null = componente.tipo === 'prazo_fixo'
        ? 'tabelaCurta' : componente.tipo === 'ate_marco'
          ? 'tabelaLongaObra' : componente.tipo === 'concentrado' ? 'saldoARepassar' : null;
      const pagamentos = pagamentosComponenteSafra(componente, contratacao.safra, contratacao.valorContratado);
      const jurosTotal = jurosSafra(componente, contratacao.safra, contratacao.valorContratado);
      const pagamentosComJuros = pagamentos.filter((p) => p.tipo !== 'sinal');
      const saldos = componente.tipo === 'imediato'
        ? new Map<number, number>()
        : new Map(carteiraSaldoSafra(componente, contratacao.safra, contratacao.valorContratado)
          .map((p) => [p.mes, p.saldo]));
      let jurosAlocados = 0;

      for (const pagamento of pagamentos) {
        let jurosPagamento = 0;
        if (componente.tipo !== 'imediato' && pagamento.tipo !== 'sinal' && jurosTotal > 0) {
          const ultimo = pagamento === pagamentosComJuros[pagamentosComJuros.length - 1];
          if (ultimo) {
            jurosPagamento = round2(jurosTotal - jurosAlocados);
          } else {
            const saldoAnterior = saldos.get(pagamento.mes - 1) ?? 0;
            jurosPagamento = round2(Math.min(pagamento.valor, saldoAnterior * componente.taxaMensal));
            jurosAlocados = round2(jurosAlocados + jurosPagamento);
          }
        }
        const principalPagamento = round2(pagamento.valor - jurosPagamento);
        deposita(bruto, pagamento.mes, pagamento.valor);
        deposita(receitaPorComponenteMensal[chaveReceita], pagamento.mes, pagamento.valor);
        deposita(principal, pagamento.mes, principalPagamento);
        deposita(juros, pagamento.mes, jurosPagamento);
        if (componente.tipo === 'concentrado') deposita(repasse, pagamento.mes, pagamento.valor);
      }

      if (componente.tipo !== 'imediato') {
        for (const ponto of carteiraSaldoSafra(componente, contratacao.safra, contratacao.valorContratado)) {
          deposita(carteira, ponto.mes, ponto.saldo);
          if (chaveCarteira) deposita(carteiraPorComponenteMensal[chaveCarteira], ponto.mes, ponto.saldo);
        }
      }
    }
  }

  let carteiraMaxima = 0;
  let mesCarteiraMaxima: number | null = null;
  for (let mes = 0; mes < carteira.length; mes++) {
    if (carteira[mes] > carteiraMaxima) {
      carteiraMaxima = carteira[mes];
      mesCarteiraMaxima = mes;
    }
  }
  return {
    recebimentoBrutoMensal: bruto,
    principalRecebidoMensal: principal,
    jurosMensal: juros,
    carteiraMensal: carteira,
    repasseMensal: repasse,
    receitaPorComponenteMensal,
    carteiraPorComponenteMensal,
    carteiraMaxima,
    mesCarteiraMaxima,
  };
}

function recebiveisComponentesLinha(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
): RecebiveisComponentesCalc | null {
  if (!Array.isArray(linha?.fluxo_pagamento?.componentes)) return null;
  const contratada = vendaBrutaContratadaMensal(linha, cronograma, prazoTotal);
  const contratacoes = contratada
    .map((valorContratado, safra) => ({ safra, valorContratado }))
    .filter((c) => c.valorContratado > 0);
  const obra = cronograma.find((e) => e.evento === 'obra');
  const mesEntrega = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;
  return calcularRecebiveisComponentes(
    componentesPagamento(linha.fluxo_pagamento, cronograma),
    contratacoes,
    mesEntrega,
    prazoTotal,
  );
}

/**
 * #236: soma as carteiras por safra sem criar uma recorrência agregada.
 * Vendas Após-chaves passam antes por `componentesEfetivosSafra` e, portanto,
 * entram à vista sem criar saldo. A série começa no mês zero e termina somente
 * quando todos os componentes financiados zeram.
 */
export function consolidarCarteiraClientes(
  componentes: ComponentePagamento[],
  contratacoes: ContratacaoSafra[],
  mesEntrega: number,
): CarteiraClientesConsolidada {
  type Parcial = Omit<CarteiraClientesMensal, 'mes' | 'total'>;
  const porMes = new Map<number, Parcial>();
  let ultimoMes = 0;

  for (const contratacao of contratacoes) {
    const efetivos = componentesEfetivosSafra(componentes, contratacao.safra, mesEntrega);
    for (const componente of efetivos) {
      if (componente.tipo === 'imediato') continue;
      const campo: keyof Parcial = componente.tipo === 'prazo_fixo'
        ? 'prazoFixo'
        : componente.tipo === 'ate_marco' ? 'ateMarco' : 'concentrado';
      for (const ponto of carteiraSaldoSafra(componente, contratacao.safra, contratacao.valorContratado)) {
        const atual = porMes.get(ponto.mes) ?? { prazoFixo: 0, ateMarco: 0, concentrado: 0 };
        atual[campo] = round2(atual[campo] + ponto.saldo);
        porMes.set(ponto.mes, atual);
        ultimoMes = Math.max(ultimoMes, ponto.mes);
      }
    }
  }

  const mensal: CarteiraClientesMensal[] = [];
  for (let mes = 0; mes <= ultimoMes; mes++) {
    const parcial = porMes.get(mes) ?? { prazoFixo: 0, ateMarco: 0, concentrado: 0 };
    mensal.push({
      mes,
      ...parcial,
      total: round2(parcial.prazoFixo + parcial.ateMarco + parcial.concentrado),
    });
  }

  let carteiraMaxima = 0;
  let mesCarteiraMaxima: number | null = null;
  for (const ponto of mensal) {
    if (ponto.total > carteiraMaxima) {
      carteiraMaxima = ponto.total;
      mesCarteiraMaxima = ponto.mes;
    }
  }
  return { mensal, carteiraMaxima, mesCarteiraMaxima };
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

  // #283: o contrato canônico é opt-in. Vendas posteriores à entrega são à
  // vista; por isso só a última safra até a entrega pode estender o horizonte.
  if (Array.isArray(fp.componentes)) {
    const obra = cronograma.find((ev) => ev.evento === 'obra');
    const mesEntrega = obra ? n(obra.inicio_mes) + n(obra.duracao_meses) - 1 : 0;
    const ultimaSafraFinanciada = Math.min(ultimoMesVenda, mesEntrega);
    let ultimo = ultimoMesVenda;
    for (const c of componentesPagamento(fp, cronograma)) {
      if (c.tipo === 'imediato') continue;
      if (c.tipo === 'prazo_fixo') {
        ultimo = Math.max(ultimo, ultimaSafraFinanciada + c.defasagemMeses + c.prazoMeses - 1);
      } else if (c.tipo === 'ate_marco') {
        ultimo = Math.max(ultimo, c.marcoMes);
      } else {
        ultimo = Math.max(ultimo, c.mesPagamento);
      }
    }
    return ultimo;
  }

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
    const mesRepasse = fimObra + REPASSE_MESES_APOS_ENTREGA;
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
  const canonico = recebiveisComponentesLinha(linha, cronograma, prazoTotal);
  if (canonico) return canonico.recebimentoBrutoMensal;
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
  const mesRepasse = fimObra + REPASSE_MESES_APOS_ENTREGA;

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
  return saida.map(round2); // #260 — C7
}

/**
 * #228: imposto mensal — RET, a ÚNICA entrada fiscal oficial do Avançado
 * (decisão do autor 2026-08-01; o regime da aba Financeiro é exclusivo do
 * Preliminar, `receitaLiquidaLinha` em fluxo-shared.ts). Zero sem RET ativo
 * — o default de todo estudo — o que preserva o Resultado de quem nunca
 * usou RET. Proporcional ao recebimento bruto do mesmo mês: como o % de RET
 * é constante, aplicá-lo por mês (linear) é matematicamente idêntico a
 * aplicá-lo por venda antes de distribuir no tempo — só muda ONDE a dedução
 * é contabilizada, nunca o Resultado final de quem usa RET.
 *
 * #346: RET é GLOBAL do estudo (era por Grupo, `linha.fluxo_pagamento.ret`)
 * — o único parâmetro que decide é `ret`, passado explicitamente por quem
 * chama (`calcularFluxo` usa `config.ret`); a função não lê mais o
 * `fluxo_pagamento` da linha para isso.
 */
export function impostoMensal(
  linha: any,
  cronograma: EventoCrono[],
  prazoTotal: number,
  ret?: { ativo: boolean; pct: number } | null,
): number[] {
  const bruto = recebimentoBrutoMensal(linha, cronograma, prazoTotal);
  if (!ret?.ativo) return bruto.map(() => 0);
  const pct = n(ret.pct) / 100;
  return bruto.map((v) => round2(v * pct)); // #260 — C7
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
  ret?: { ativo: boolean; pct: number } | null,
): number[] {
  const bruto = recebimentoBrutoMensal(linha, cronograma, prazoTotal);
  const imposto = impostoMensal(linha, cronograma, prazoTotal, ret);
  return bruto.map((v, i) => round2(v - imposto[i])); // #260 — C7
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
  ret?: { ativo: boolean; pct: number } | null,
): number[] {
  return recebimentoLiquidoMensal(linha, cronograma, prazoTotal, ret);
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

  if ((custo?.orcamento_unidade || 'rs') === 'pct_vgv'
    && (custo?.orcamento_valor_canonico === null || custo?.orcamento_valor_canonico === undefined)) {
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
  if ((custo?.orcamento_unidade || 'rs') === 'pct_vgv'
    && (custo?.orcamento_valor_canonico === null || custo?.orcamento_valor_canonico === undefined)) {
    const pct = n(custo?.orcamento_valor) / 100;
    return pesos.map((v) => v * pct);
  }
  const total = resolverCustoTotal(custo, ctx);
  return pesos.map((v) => (total * v) / somaPesos);
}

/**
 * #238 (padrao-incorporacao.md §15.2): duas visões da permuta financeira, no
 * regime de caixa — só quando o orçamento é `% VGV`; em valor fixo (`rs`)
 * não há distinção bruta/líquida (um total fixo distribuído proporcionalmente
 * à receita de caixa é o mesmo valor nas duas visões).
 *
 *   bruta   = receita de caixa × % de permuta
 *   líquida = (receita de caixa − imposto − corretagem) × % de permuta
 *
 * Ambas ficam disponíveis para auditoria (§15.3); qual alimenta o fluxo é
 * escolha do estudo (`permuta_financeira_base`, default `bruta` — preserva o
 * resultado de todo estudo existente, que hoje não deduz imposto/corretagem
 * da base). A base líquida nunca fica negativa (clamp em 0): imposto e
 * corretagem que excedam a receita do mês não geram permuta negativa.
 */
export function permutaFinanceiraBrutaMensal(receitaCaixaMensal: number[], pctPermuta: number): number[] {
  const f = pctPermuta / 100;
  return receitaCaixaMensal.map((v) => round2(v * f));
}

export function permutaFinanceiraLiquidaMensal(
  receitaCaixaMensal: number[],
  impostoMensalTotal: number[],
  corretagemMensalSerie: number[],
  pctPermuta: number,
): number[] {
  const f = pctPermuta / 100;
  return receitaCaixaMensal.map((v, i) => {
    const base = Math.max(0, v - (impostoMensalTotal[i] ?? 0) - (corretagemMensalSerie[i] ?? 0));
    return round2(base * f);
  });
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
    vendaBrutaContratadaMensal: soma(c.vendaBrutaContratadaMensal),
    descontoComercialMensal: soma(c.descontoComercialMensal),
    vendaLiquidaContratadaMensal: soma(c.vendaLiquidaContratadaMensal),
    receitaBrutaMensal: soma(c.receitaBrutaMensal),
    principalRecebidoMensal: soma(c.principalRecebidoMensal),
    jurosClientesMensal: soma(c.jurosClientesMensal),
    carteiraClientesMensal: ultimo(c.carteiraClientesMensal),
    repasseMensal: soma(c.repasseMensal),
    receitaPorComponenteMensal: {
      aVista: soma(c.receitaPorComponenteMensal.aVista),
      tabelaCurta: soma(c.receitaPorComponenteMensal.tabelaCurta),
      tabelaLongaObra: soma(c.receitaPorComponenteMensal.tabelaLongaObra),
      repasse: soma(c.receitaPorComponenteMensal.repasse),
      aposChaves: soma(c.receitaPorComponenteMensal.aposChaves),
      outros: soma(c.receitaPorComponenteMensal.outros),
    },
    carteiraPorComponenteMensal: {
      tabelaCurta: ultimo(c.carteiraPorComponenteMensal.tabelaCurta),
      tabelaLongaObra: ultimo(c.carteiraPorComponenteMensal.tabelaLongaObra),
      saldoARepassar: ultimo(c.carteiraPorComponenteMensal.saldoARepassar),
    },
    custoMensal: soma(c.custoMensal),
    fluxoMensal: soma(c.fluxoMensal),
    fluxoAcumulado: ultimo(c.fluxoAcumulado),
    linhasReceitaBruta: c.linhasReceitaBruta.map(agregarLinha),
    linhasVendasContratadas: c.linhasVendasContratadas.map(agregarLinha),
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
      c?.grupo === 'obra' ? {
        ...c,
        orcamento_valor: n(c?.orcamento_valor) * fCusto,
        ...(c?.orcamento_valor_canonico !== null && c?.orcamento_valor_canonico !== undefined
          ? { orcamento_valor_canonico: round2(n(c.orcamento_valor_canonico) * fCusto) } : {}),
      } : c
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
  const linhasReceitaOriginal = config.linhasReceita ?? [];
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
  const ultimoRecebivel = Math.max(0, ...linhasReceitaOriginal.map((l) => ultimoMesRecebivelLinha(l, crono)));
  const prazoDerivado = Math.max(ultimoCrono, ultimoRecebivel, ultimoCustos, 11) + 1;
  const prazo = Math.max(1, Math.round(n(config.prazoMeses) || prazoDerivado));

  const reservasPermuta = reservarPermutasFisicas(linhasReceitaOriginal, linhasCusto);
  const usaFonteNovaPermuta = reservasPermuta.usaFonteNova;

  // #268 (correção pós-CI): as séries mensais de caixa (`vendaBrutaContratadaMensal`,
  // `recebimentoBrutoMensal` e tudo que deriva delas) leem `t.unidades_permutadas`
  // diretamente da tipologia — não passam pelo `vgvVendavelLinhaMotor` abaixo, que só
  // alimenta os KPIs informativos e a proporção por tipologia. Sem este ajuste, a
  // reserva feita em Custos (#266) nunca chegava ao caixa: os testes confirmaram (ver
  // `receitaMensal`/`fluxoMensal` de `#268: permuta física...`) que o valor mensal
  // continuava contando a unidade permutada como vendida, mesmo com os KPIs corretos.
  // Escrever `unidades_permutadas` aqui, uma única vez, torna toda função antiga que já
  // sabe ler esse campo automaticamente correta — sem replicar a reserva função a função.
  const linhasReceita = usaFonteNovaPermuta
    ? linhasReceitaOriginal.map((l: any, li: number) => ({
      ...l,
      tipologias: (l.tipologias ?? []).map((t: any, ti: number) => ({
        ...t,
        unidades_permutadas: reservasPermuta.porTipologia.get(chaveTipologiaLinha(l, li, t, ti)) ?? 0,
      })),
    }))
    : linhasReceitaOriginal;
  const vgvVendavelLinhaMotor = (linha: any, linhaIndex: number): number =>
    (linha.tipologias ?? []).reduce((total: number, t: any, tipologiaIndex: number) => {
      const chave = chaveTipologiaLinha(linha, linhaIndex, t, tipologiaIndex);
      const unidades = usaFonteNovaPermuta ? (reservasPermuta.porTipologia.get(chave) ?? 0) : undefined;
      return total + vgvVendavelTipologia(t, unidades);
    }, 0);

  const ctxCusto: ContextoCusto = {
    areaPrivativaTotal: areaPrivativaTotalLinhas(linhasReceita),
    areaTerreno: n(config.areaTerreno),
    vgvTotal: linhasReceita.reduce((s, l) => s + vgvLinha(l.tipologias), 0),
  };
  ctxCusto.receitaTotal = linhasReceita.reduce(
    (s, l, i) => s + receitaLiquidaLinha(vgvVendavelLinhaMotor(l, i), config.ret), 0);
  ctxCusto.totalObra = linhasCusto
    .filter((c) => c.grupo === 'obra' && (c.orcamento_unidade || 'rs') !== 'pct_obra')
    .reduce((s, c) => s + resolverCustoTotal(c, ctxCusto), 0);

  // Receitas por linha (e por tipologia, proporcional ao VGV VENDÁVEL da
  // tipologia, #195 — uma tipologia 100% permutada não recebe fatia de caixa).
  // #237/#241: construímos as visões bruta e líquida pela mesma rotina para
  // que Grupo/tipologia reconciliem exatamente com seus respectivos totais.
  const montarLinhasReceita = (
    serie: (linha: any, cronograma: EventoCrono[], prazoTotal: number) => number[],
  ): LinhaCalc[] => linhasReceita.map((l) => {
    const mensal = serie(l, crono, prazo);
    const vgvVendavelL = vgvVendavelLinhaMotor(l, linhasReceita.indexOf(l));
    const r = recorte(mensal);
    const itens: LinhaCalc[] = (l.tipologias ?? []).map((t: any, tipologiaIndex: number) => {
      const chave = chaveTipologiaLinha(l, linhasReceita.indexOf(l), t, tipologiaIndex);
      const unidades = usaFonteNovaPermuta ? (reservasPermuta.porTipologia.get(chave) ?? 0) : undefined;
      const propor = vgvVendavelL > 0 ? vgvVendavelTipologia(t, unidades) / vgvVendavelL : 0;
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
  }).map((linha) => quantizarLinhaMonetaria(linha, taxa));
  const calcReceitasBrutas = montarLinhasReceita(recebimentoBrutoMensal);
  const calcVendasContratadas = montarLinhasReceita(vendaBrutaContratadaMensal);
  // #346: RET é global (config.ret) — a série líquida de cada linha usa o
  // mesmo valor para todas, em vez de ler `linha.fluxo_pagamento.ret`.
  const calcReceitas = montarLinhasReceita((l, c, p) => receitaMensalLinha(l, c, p, config.ret));

  // Receita mensal SÓ das vendas (caixa efetivo: entrada + parcelas + repasse
  // na entrega) — calculada aqui, antes dos custos, porque o modo
  // `unit_delivery` do Preço do Terreno (#194) e a Permuta financeira (#196)
  // precisam dela como peso de distribuição. A receita FINAL (com a dedução
  // da Permuta financeira) é calculada mais abaixo, depois de `calcCustos`.
  const receitaMensalVendas = new Array<number>(prazo).fill(0);
  for (const l of calcReceitas) for (let i = 0; i < prazo; i++) receitaMensalVendas[i] += l.mensal[i];

  // Permuta financeira (#196) é dedução da receita, não custo — sai de
  // `linhasCusto` antes do loop de custos. Permuta física (#268) não é custo
  // NEM receita — não há caixa envolvido (a unidade é entregue, não vendida
  // nem paga); o valor declarado (#266) só alimenta o KPI informativo
  // `vgvPermutaFisica` mais abaixo.
  const linhasCustoSemPermutas = linhasCusto.filter((c) => !ePermutaFinanceira(c) && !ePermutaFisica(c));
  const linhasPermutaFinanceira = linhasCusto.filter(ePermutaFinanceira);
  const linhasPermutaFisica = linhasCusto.filter(ePermutaFisica);

  // Custos por linha (valores positivos; sinal aplicado na consolidação).
  const curvasPorId = new Map<number, CurvaPersonalizada>(
    (config.curvas ?? []).map((k: any) => [Number(k.id), (k.valores ?? []) as CurvaPersonalizada]));
  let calcCustos: LinhaCalc[] = linhasCustoSemPermutas.map((c) => {
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
  calcCustos = calcCustos.map((linha) => quantizarLinhaMonetaria(linha, taxa));

  // Permuta financeira (#196/#238): sai da RECEITA DAS VENDAS (em caixa),
  // sempre — não é mais escolha de `distribuicao_modo` (armadilha A10, Anexo
  // D: quem classifica é a subcategoria; a UI antes lia `distribuicao_modo`,
  // que é curva de rateio do Preço do Terreno, não critério de permuta). O
  // resultado entra NEGATIVO em `linhasReceita` — dedução da receita, não
  // custo. Em `% VGV`, calcula as duas visões (bruta/líquida, §15.2) sobre a
  // receita de caixa BRUTA (`recebimentoBrutoMensal`, ANTES do RET — nunca
  // `receitaMensalVendas`, que já é líquida de RET/#228: usá-la subtrairia o
  // imposto duas vezes na visão líquida) para auditoria, e usa a escolhida
  // (`permuta_financeira_base`, default bruta) no fluxo; em valor fixo
  // (`rs`), distribui proporcionalmente à receita de caixa (sem distinção
  // bruta/líquida — um total fixo não tem base a que aplicar deduções).
  const receitaCaixaBrutaMensal = new Array<number>(prazo).fill(0);
  const impostoTotalMensal = new Array<number>(prazo).fill(0);
  for (const l of linhasReceita) {
    const bruto = recebimentoBrutoMensal(l, crono, prazo);
    const imp = impostoMensal(l, crono, prazo, config.ret);
    for (let i = 0; i < prazo; i++) {
      receitaCaixaBrutaMensal[i] += bruto[i] ?? 0;
      impostoTotalMensal[i] += imp[i] ?? 0;
    }
  }
  const linhaCorretagem = linhasCusto.find(eCorretagem);
  const corretagemSerie = linhaCorretagem
    ? corretagemMensal(linhaCorretagem, linhasReceita, crono, prazo, ctxCusto)
    : new Array<number>(prazo).fill(0);

  let calcDeducoesReceita: LinhaCalc[] = linhasPermutaFinanceira.map((c) => {
    const nome = nomeLinhaCusto(c);
    let mensalBruto: number[];
    // #238: a base NÃO escolhida vira auditoria em vez de ser descartada.
    let alternativa: { base: 'bruta' | 'liquida'; total: number } | undefined;
    if ((c.orcamento_unidade || 'rs') === 'pct_vgv') {
      // Quando existe canônico, o percentual é somente a representação dele.
      const pct = c.orcamento_valor_canonico !== null && c.orcamento_valor_canonico !== undefined
        ? (ctxCusto.vgvTotal > 0 ? resolverCustoTotal(c, ctxCusto) / ctxCusto.vgvTotal * 100 : 0)
        : n(c.orcamento_valor);
      const bruta = permutaFinanceiraBrutaMensal(receitaCaixaBrutaMensal, pct);
      const liquida = permutaFinanceiraLiquidaMensal(receitaCaixaBrutaMensal, impostoTotalMensal, corretagemSerie, pct);
      const eLiquida = c.permuta_financeira_base === 'liquida';
      mensalBruto = eLiquida ? liquida : bruta;
      const outra = eLiquida ? bruta : liquida;
      alternativa = {
        base: eLiquida ? 'bruta' : 'liquida',
        total: round2(outra.reduce((t, v) => t + v, 0)),
      };
    } else {
      mensalBruto = distribuirProporcional(c, receitaMensalVendas, ctxCusto);
    }
    const mensal = mensalBruto.map((v) => -v);
    const r = recorte(mensal);
    return {
      id: c.id, nome, grupo: 'receita' as const,
      inicio: r.inicio, duracao: r.duracao,
      total: mensal.reduce((s, v) => s + v, 0),
      vpl: vplFluxo(mensal, taxa),
      ...(alternativa ? { permutaAlternativa: alternativa } : {}),
      mensal,
    };
  });
  calcDeducoesReceita = calcDeducoesReceita.map((linha) => quantizarLinhaMonetaria(linha, taxa));

  // #427 — total isolado da permuta financeira, positivo (estornado): a
  // proforma do Avançado precisa dele para fechar `Resultado + Perm. Financ.`
  // sem agregar o RET junto (o que a linha única de deduções da proforma faz).
  const permutaFinanceiraTotal = round2(-calcDeducoesReceita.reduce((s, l) => s + l.total, 0)) || 0;

  const linhasReceitaFinal = [...calcReceitas, ...calcDeducoesReceita];
  const receitaMensal = new Array<number>(prazo).fill(0);
  for (const l of linhasReceitaFinal) for (let i = 0; i < prazo; i++) receitaMensal[i] = round2(receitaMensal[i] + l.mensal[i]);

  const custoMensal = new Array<number>(prazo).fill(0);
  for (const c of calcCustos) for (let i = 0; i < prazo; i++) custoMensal[i] = round2(custoMensal[i] + c.mensal[i]);

  const fluxoMensal = receitaMensal.map((r, i) => round2(r - custoMensal[i]));
  const fluxoAcumulado: number[] = [];
  let acc = 0;
  for (const v of fluxoMensal) { acc = round2(acc + v); fluxoAcumulado.push(acc); }

  const paybackMes = fluxoAcumulado.findIndex((v, i) => v >= 0 && fluxoMensal.slice(0, i + 1).some((x) => x < 0));
  const exposicaoMaxima = fluxoAcumulado.length ? Math.min(...fluxoAcumulado) : 0;

  // #188/#268 — VGV Total / VGV Permuta Física (sem caixa) / Receita Bruta
  // (VGV): grandezas informativas. A permuta física agora é medida pelas
  // unidades reservadas em Custos e pelas alocações/preços correspondentes em
  // Receitas; nunca é orçamento e nunca entra em calcCustos ou no caixa.
  // Sem linha de custo `Permuta física`, não há fallback para o campo legado
  // `unidades_permutadas` — decisão do autor (2026-08-02, ver #267): o campo é
  // código morto no Avançado real. O KPI é 0, não uma derivação da tipologia.
  const vgvPermutaFisica = usaFonteNovaPermuta ? reservasPermuta.vgv : 0;
  const receitaBrutaVgv = ctxCusto.vgvTotal - vgvPermutaFisica;

  // #283: séries econômicas agregadas. Apenas linhas com `componentes`
  // produzem juros/carteira/repasse novos; as legadas continuam com principal
  // igual ao recebimento bruto e zeros nas séries opt-in.
  const receitaBrutaMensal = new Array<number>(prazo).fill(0);
  const principalRecebidoMensal = new Array<number>(prazo).fill(0);
  const jurosClientesMensal = new Array<number>(prazo).fill(0);
  const carteiraClientesMensal = new Array<number>(prazo).fill(0);
  const repasseMensal = new Array<number>(prazo).fill(0);
  const vazia = () => new Array<number>(prazo).fill(0);
  const receitaPorComponenteMensal: SeriesComponentesReceita = {
    aVista: vazia(), tabelaCurta: vazia(), tabelaLongaObra: vazia(),
    repasse: vazia(), aposChaves: vazia(), outros: vazia(),
  };
  const carteiraPorComponenteMensal: SeriesComponentesCarteira = {
    tabelaCurta: vazia(), tabelaLongaObra: vazia(), saldoARepassar: vazia(),
  };
  for (const linha of linhasReceita) {
    const brutoLinha = recebimentoBrutoMensal(linha, crono, prazo);
    const detalhe = recebiveisComponentesLinha(linha, crono, prazo);
    for (let mes = 0; mes < prazo; mes++) {
      receitaBrutaMensal[mes] = round2(receitaBrutaMensal[mes] + (brutoLinha[mes] ?? 0));
      principalRecebidoMensal[mes] = round2(principalRecebidoMensal[mes]
        + (detalhe?.principalRecebidoMensal[mes] ?? brutoLinha[mes] ?? 0));
      jurosClientesMensal[mes] = round2(jurosClientesMensal[mes] + (detalhe?.jurosMensal[mes] ?? 0));
      carteiraClientesMensal[mes] = round2(carteiraClientesMensal[mes] + (detalhe?.carteiraMensal[mes] ?? 0));
      repasseMensal[mes] = round2(repasseMensal[mes] + (detalhe?.repasseMensal[mes] ?? 0));
      if (detalhe) {
        for (const chave of Object.keys(receitaPorComponenteMensal) as (keyof SeriesComponentesReceita)[]) {
          receitaPorComponenteMensal[chave][mes] = round2(receitaPorComponenteMensal[chave][mes]
            + (detalhe.receitaPorComponenteMensal[chave][mes] ?? 0));
        }
        for (const chave of Object.keys(carteiraPorComponenteMensal) as (keyof SeriesComponentesCarteira)[]) {
          carteiraPorComponenteMensal[chave][mes] = round2(carteiraPorComponenteMensal[chave][mes]
            + (detalhe.carteiraPorComponenteMensal[chave][mes] ?? 0));
        }
      } else {
        receitaPorComponenteMensal.outros[mes] = round2(
          receitaPorComponenteMensal.outros[mes] + (brutoLinha[mes] ?? 0));
      }
    }
  }
  const jurosClientes = round2(jurosClientesMensal.reduce((s, v) => s + v, 0));
  const carteiraClientesMaxima = Math.max(0, ...carteiraClientesMensal);
  const mesCarteiraClientesMaxima = carteiraClientesMaxima > 0
    ? carteiraClientesMensal.indexOf(carteiraClientesMaxima) : null;

  // #229 — grandezas 3–6 da taxonomia: contratação (bruto/desconto/líquido,
  // #227) e Receita Bruta (recebimento em caixa, #228). Somadas por linha de
  // receita ORIGINAL (`linhasReceita`, não `linhasReceitaFinal`) — a Permuta
  // Financeira (`calcDeducoesReceita`) é dedução de receita, não contratação.
  const somaMensal = (fn: (l: any, c: EventoCrono[], p: number) => number[]): number =>
    linhasReceita.reduce((s, l) => s + fn(l, crono, prazo).reduce((s2, v) => s2 + v, 0), 0);
  const agregarSerie = (fn: (l: any, c: EventoCrono[], p: number) => number[]): number[] => {
    const out = new Array<number>(prazo).fill(0);
    for (const linha of linhasReceita) {
      const serie = fn(linha, crono, prazo);
      for (let mes = 0; mes < prazo; mes++) out[mes] = round2(out[mes] + (serie[mes] ?? 0));
    }
    return out;
  };
  const vendaBrutaContratadaSerie = agregarSerie(vendaBrutaContratadaMensal);
  const descontoComercialSerie = agregarSerie(descontoComercialMensal);
  const vendaLiquidaContratadaSerie = vendaBrutaContratadaSerie.map((v, mes) =>
    round2(v - (descontoComercialSerie[mes] ?? 0)));
  const vendaBrutaContratada = round2(somaMensal(vendaBrutaContratadaMensal)); // #260 — C7
  const descontoComercial = round2(somaMensal(descontoComercialMensal));
  const vendaLiquidaContratada = round2(vendaBrutaContratada - descontoComercial);
  const receitaBruta = round2(receitaBrutaMensal.reduce((s, v) => s + v, 0));

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
    permutaFinanceiraTotal,
    receitaBrutaVgv,
    vgvVendavel: receitaBrutaVgv,
    vendaBrutaContratada,
    descontoComercial,
    vendaLiquidaContratada,
    vendaBrutaContratadaMensal: vendaBrutaContratadaSerie,
    descontoComercialMensal: descontoComercialSerie,
    vendaLiquidaContratadaMensal: vendaLiquidaContratadaSerie,
    receitaBruta,
    receitaBrutaMensal,
    principalRecebidoMensal,
    jurosClientesMensal,
    carteiraClientesMensal,
    repasseMensal,
    receitaPorComponenteMensal,
    carteiraPorComponenteMensal,
    jurosClientes,
    carteiraClientesMaxima,
    mesCarteiraClientesMaxima,
    linhasReceitaBruta: calcReceitasBrutas,
    linhasVendasContratadas: calcVendasContratadas,
    linhasReceita: linhasReceitaFinal,
    linhasCusto: calcCustos,
  };
}
