import { html, svg, nothing, type TemplateResult } from 'lit';
import { rotuloMesRelativo, type EventoCrono, type PeriodoAgregado } from './fluxo-shared.js';
import type { FluxoCalc } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────

export interface SerieEconomicaFluxo {
  rotulo: string;
  valores: number[];
  cor: string;
}

/** #241: séries comerciais exibidas no gráfico e derivadas diretamente do
 * mesmo FluxoCalc usado pela tabela/CSV/PDF. */
export function seriesEconomicasFluxo(c: FluxoCalc): SerieEconomicaFluxo[] {
  return [
    { rotulo: 'Venda líquida contratada', valores: c.vendaLiquidaContratadaMensal,
      cor: 'var(--cor-primaria, #7c5cff)' },
    { rotulo: 'Receita Bruta — VGV', valores: c.receitaBrutaMensal,
      cor: 'var(--cor-sucesso, #13a98d)' },
    { rotulo: 'Carteira de clientes', valores: c.carteiraClientesMensal,
      cor: 'var(--cor-info, #3b82f6)' },
    { rotulo: 'Repasse', valores: c.repasseMensal,
      cor: 'var(--cor-alerta, #d59b2d)' },
  ];
}
// ─────────────────────────────────────────────────────────────────────────
// #595 — as DUAS séries do card "Fluxo acumulado — cenário real × cenário
// simulado" (aba Cenários), montadas fora do template.
// ─────────────────────────────────────────────────────────────────────────

/** Uma série do gráfico de comparação. **Sem `cor`** — ver a nota de `comparacaoCenario`. */
export interface SerieComparacaoCenario {
  rotulo: string;
  valores: number[];
}

export interface ComparacaoCenario {
  categorias: string[];
  series: SerieComparacaoCenario[];
}

/**
 * #595 — alinha uma série ACUMULADA a `n` colunas.
 *
 * O gráfico consome `categorias` (eixo X) e `series[].valores` em paralelo, por
 * índice: uma série mais curta que o eixo entrega `undefined` na cauda, e uma
 * coordenada `NaN` **quebra o `path` inteiro** — o traço some e sobram só os
 * marcadores, que é exatamente o sintoma que a #595 relata ("hoje são só
 * pontos"). Como nada pode garantir isso do lado do primitivo, a garantia é do
 * app: o que ele entrega tem sempre o comprimento do eixo.
 *
 * ⚠️ **Repetir o último valor não é inventar dado — é a semântica de uma série
 * ACUMULADA.** Depois do último mês em que algo entra ou sai (#446), o saldo
 * acumulado permanece onde estava; a curva plana é a leitura correta, e é o que
 * o eixo mostraria se o horizonte daquele cenário fosse maior. Valor não finito
 * no meio da série cai na mesma regra (repete o último válido) em vez de
 * derrubar o desenho.
 *
 * Hoje o reparo é NO-OP: `frontend/fluxo-cenario-series.test.ts` assere que as
 * duas séries já chegam alinhadas e finitas. Ele existe para o dia em que o
 * horizonte voltar a mudar — a #446 já o mudou uma vez.
 */
function alinharAcumulado(valores: readonly number[], n: number): number[] {
  const saida: number[] = [];
  let ultimo = 0;
  for (let i = 0; i < n; i++) {
    const v = valores[i];
    if (Number.isFinite(v)) ultimo = v as number;
    saida.push(ultimo);
  }
  return saida;
}

/**
 * #595 — monta eixo e séries do card de comparação da aba Cenários.
 *
 * O eixo é o do cenário **mais longo** dos dois, não o da base: truncar pelo
 * eixo da base esconderia meses de um cenário que estique o horizonte, e é o
 * mesmo motivo pelo qual `tela-cenarios.ts` já calcula os períodos da view
 * Anual com `Math.max(base.prazo, cenario.prazo)`.
 *
 * ⚠️ **Nenhuma série carrega `cor`, e isso é decisão da #595.** O espelho
 * `docs/ui-urbiverso/primitivos.json` declara `series` como `Array` e **não
 * declara a forma dos itens** — ou seja, o repositório **não tem como afirmar**
 * que um item honra a chave `cor`. O que o espelho DECLARA são as custom
 * properties `--urbi-grafico-cor-1..8` no `:host` de `UrbiGraficoBase`, que o
 * próprio `scripts/guard-tokens-css.mjs` reconhece como ponto de customização
 * legítimo. Então a cor das duas séries é definida em CSS, pelo app, em
 * `frontend/tela-cenarios.ts` — onde `var()` de fato resolve, ao contrário de
 * uma string `'var(--x, #hex)'` entregue como dado, que só resolve se o
 * primitivo a injetar num valor de propriedade CSS e é **inválida** se ele a
 * injetar num atributo de apresentação SVG.
 */
export function comparacaoCenario(
  base: FluxoCalc,
  cenario: FluxoCalc,
  rotuloCenario: string,
): ComparacaoCenario {
  const categorias = cenario.meses.length > base.meses.length ? cenario.meses : base.meses;
  const n = categorias.length;
  return {
    categorias,
    series: [
      { rotulo: 'Cenário real', valores: alinharAcumulado(base.fluxoAcumulado, n) },
      { rotulo: rotuloCenario, valores: alinharAcumulado(cenario.fluxoAcumulado, n) },
    ],
  };
}

// Gráficos SVG autocontidos do Fluxo de Caixa (mensal + acumulado).
//
// Extraídos de tela-fluxo-ver.ts (Lote 8 · #23) para serem reusados pela aba
// Resumo sem duplicar ~100 linhas de SVG. São funções PURAS: recebem o cálculo
// do motor + data de início + cronograma e devolvem o TemplateResult — nenhum
// estado de componente. tela-fluxo-ver e tela-resumo renderizam gráficos
// idênticos a partir daqui.
// ─────────────────────────────────────────────────────────────────────────

/** R$ abreviado para eixos ("R$ 500K", "R$ 2,1M"). */
export function abrevR$(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}R$ ${(a / 1e9).toFixed(1).replace('.', ',')}B`;
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(1).replace('.', ',')}M`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3)}K`;
  return `${s}R$ ${Math.round(a)}`;
}

/** Marcos verticais do cronograma (Lançamento, Início/Fim da Obra). */
export function marcos(crono: EventoCrono[]): { mes: number; rotulo: string }[] {
  const lanc = crono.find((e) => e.evento === 'lancamento');
  const obra = crono.find((e) => e.evento === 'obra');
  const out: { mes: number; rotulo: string }[] = [];
  if (lanc) out.push({ mes: Number(lanc.inicio_mes), rotulo: 'Lançamento' });
  if (obra) {
    out.push({ mes: Number(obra.inicio_mes), rotulo: 'Início Obra' });
    out.push({ mes: Number(obra.inicio_mes) + Number(obra.duracao_meses) - 1, rotulo: 'Fim Obra' });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// #582: escalonamento de rótulos de texto no topo dos gráficos de fluxo.
//
// Quatro famílias de texto disputavam a mesma faixa superior com `y`
// CONSTANTE (marcos do cronograma, Payback, Exposição Máx.) — quando dois
// marcos do cronograma caem a poucos meses um do outro (Lançamento e Início
// da Obra, tipicamente), os textos imprimiam em cima um do outro. O
// `graficoFluxoMensal` já tinha uma tentativa (`(idx % 2) * 10`), mas ela só
// alterna DOIS níveis por paridade de índice — três marcos próximos ainda
// colidem dois a dois na mesma paridade, e ela não enxergava o Payback nem a
// Exposição Máx. porque nunca soube da existência deles.
// ─────────────────────────────────────────────────────────────────────────

/** Um rótulo de texto posicionável no topo do gráfico, antes de resolver colisão. */
export interface RotuloTopo {
  /** Posição X onde o texto começa (`text-anchor` default = `start`). */
  x: number;
  /** Posição Y preferida (linha de base) — usada se não colidir com nada. */
  y: number;
  texto: string;
  /** Cor do texto — carregada através da resolução para a chamada renderizar direto. */
  cor: string;
}

// Passo vertical entre linhas escalonadas. Maior que ALTURA_CAIXA_ROTULO de
// propósito: garante que UM bump já limpa a colisão vertical com a caixa
// imediatamente anterior, sem precisar de vários saltos para o mesmo par.
const ALTURA_LINHA_ROTULO = 11;
// Altura estimada da caixa do texto acima da linha de base, para font-size 9.
const ALTURA_CAIXA_ROTULO = 9;
// Largura média de glifo (px) para font-size 9 na fonte do design system —
// aproximação deliberada: o objetivo aqui é decidir "colide ou não colide",
// não medir pixel exato. Generosa de propósito (glifo real costuma ser mais
// estreito) para não deixar passar, na estimativa, uma colisão que o
// Chromium real ainda enxerga — quem mede o pixel de verdade é o harness de
// render (`frontend/render/casos/`), que usa `getBoundingClientRect` no
// `<text>` renderizado.
const LARGURA_MEDIA_GLIFO = 5.4;

/**
 * Escalona verticalmente rótulos que colidiriam no eixo X, dentro da mesma
 * faixa superior do gráfico. Determinístico: ordena por `x` crescente
 * (desempate por `y` preferido) e, para cada rótulo, sobe uma linha
 * (`ALTURA_LINHA_ROTULO`) enquanto a caixa estimada colidir com algum rótulo
 * já posicionado — até um teto de tentativas, para nunca fugir
 * indefinidamente do gráfico com um cronograma patológico.
 *
 * Cobre o caso extremo do critério de aceite #582 (três marcos no mesmo mês)
 * por construção: cada um colide com o anterior no mesmo `x` e recebe sua
 * própria linha, sem tratamento especial para "3".
 */
export function resolverColisoesRotulos<T extends RotuloTopo>(itens: readonly T[]): T[] {
  // Desempate final por `texto` (comparação simples, sem `localeCompare`: o
  // resultado não pode depender do locale ICU da máquina que roda o
  // harness) — sem ele, dois itens com `x`/`y` preferidos IDÊNTICOS (o caso
  // extremo #582.2, três marcos no mesmo mês) ficam ordenados pela posição no
  // array de entrada, e o mesmo cronograma pode escalonar diferente conforme
  // a ORDEM em que o chamador construiu a lista — mesmo sem mudar dado nenhum.
  const ordenados = [...itens].sort((a, b) =>
    a.x - b.x || a.y - b.y || (a.texto < b.texto ? -1 : a.texto > b.texto ? 1 : 0));
  const posicionados: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const TETO_TENTATIVAS = 10;
  return ordenados.map((item) => {
    const largura = Math.max(1, item.texto.length) * LARGURA_MEDIA_GLIFO;
    let y = item.y;
    for (let tentativa = 0; ; tentativa++) {
      const caixa = { x0: item.x, x1: item.x + largura, y0: y - ALTURA_CAIXA_ROTULO, y1: y };
      const colide = posicionados.some((p) =>
        caixa.x0 < p.x1 && caixa.x1 > p.x0 && caixa.y0 < p.y1 && caixa.y1 > p.y0);
      if (!colide || tentativa >= TETO_TENTATIVAS) { posicionados.push(caixa); break; }
      y += ALTURA_LINHA_ROTULO;
    }
    return { ...item, y };
  });
}

/**
 * Converte um MÊS relativo na posição (índice de coluna, fracionário) do eixo X.
 * Na view mensal é a identidade; na view agregada por período (#127) devolve o
 * índice do período que contém o mês + a fração percorrida dentro dele, para
 * que marcos e payback caiam no ponto certo do ano e não no início da coluna.
 */
function colunaDoMes(periodos?: PeriodoAgregado[]): (mes: number) => number {
  if (!periodos || periodos.length === 0) return (mes) => mes;
  return (mes) => {
    const i = periodos.findIndex((p) => mes >= p.inicio && mes <= p.fim);
    if (i < 0) return mes <= periodos[0].inicio ? 0 : periodos.length - 1;
    const p = periodos[i];
    return i + (mes - p.inicio) / (p.fim - p.inicio + 1);
  };
}

/**
 * Gráfico de barras do fluxo por coluna. `periodos` só é passado na view
 * agregada (#127) — nela `c` já vem de `agregarFluxoPorPeriodos` e serve para
 * posicionar no eixo os marcos do cronograma, que continuam em meses.
 */
export function graficoFluxoMensal(
  c: FluxoCalc,
  dataInicio: string | null,
  crono: EventoCrono[],
  periodos?: PeriodoAgregado[],
): TemplateResult {
  const col = colunaDoMes(periodos);
  const W = 900; const H = 260; const padL = 64; const padR = 10; const padT = 26; const padB = 24;
  const gw = W - padL - padR; const gh = H - padT - padB;
  const maxAbs = Math.max(1, ...c.fluxoMensal.map((v) => Math.abs(v)));
  const x = (i: number) => padL + (i / c.prazo) * gw;
  const bw = Math.max(1.5, gw / c.prazo - 1);
  const y = (v: number) => padT + (1 - (v + maxAbs) / (2 * maxAbs)) * gh;
  const y0 = y(0);
  const corTexto = 'var(--cor-texto-sec, #8a8f98)';
  const passo = Math.max(3, Math.ceil(c.prazo / 10 / 3) * 3);
  const ticks: number[] = [];
  for (let m = 0; m < c.prazo; m += passo) ticks.push(m);
  const marcosGrafico = marcos(crono);
  // #582: rótulo escalonado por colisão real, não por paridade de índice —
  // ver o bloco de comentário acima de `resolverColisoesRotulos`.
  const rotulosMarcos = resolverColisoesRotulos(marcosGrafico.map((m) => ({
    x: x(col(m.mes)) + 3, y: padT + 8, cor: corTexto,
    texto: `${m.rotulo} · ${rotuloMesRelativo(dataInicio, m.mes)} · M+${m.mes}`,
  })));
  return html`
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo de caixa mensal">
      ${[-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs].map((v) => svg`
        <line x1=${padL} y1=${y(v)} x2=${W - padR} y2=${y(v)} stroke="var(--cor-borda-sutil, rgba(128,128,128,0.15))" />
        <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
      ${ticks.map((i) => svg`
        <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${c.meses[i]}</text>`)}
      ${c.fluxoMensal.map((v, i) => svg`
        <rect x=${x(i)} y=${Math.min(y(v), y0)} width=${bw} height=${Math.max(Math.abs(y(v) - y0), 0.5)}
          fill=${v >= 0 ? 'var(--cor-sucesso, #13a98d)' : 'var(--cor-erro, #d45a3a)'} opacity="0.9" />`)}
      ${marcosGrafico.map((m) => svg`
        <line x1=${x(col(m.mes))} y1=${padT - 4} x2=${x(col(m.mes))} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.7" />`)}
      ${rotulosMarcos.map((r) => svg`
        <text x=${r.x} y=${r.y} font-size="9" fill=${r.cor}>${r.texto}</text>`)}
    </svg>
  `;
}

/**
 * Curva do acumulado por coluna. `periodos`: ver `graficoFluxoMensal` (#127).
 * `dataInicio` fica na assinatura por simetria com os demais gráficos — os
 * rótulos do eixo vêm de `c.meses`, que já traz o rótulo de cada coluna.
 */
export function graficoFluxoAcumulado(
  c: FluxoCalc,
  dataInicio: string | null,
  crono: EventoCrono[],
  periodos?: PeriodoAgregado[],
): TemplateResult {
  const col = colunaDoMes(periodos);
  const W = 900; const H = 280; const padL = 64; const padR = 10; const padT = 26; const padB = 24;
  const gw = W - padL - padR; const gh = H - padT - padB;
  const min = Math.min(0, ...c.fluxoAcumulado);
  const max = Math.max(1, ...c.fluxoAcumulado);
  const x = (i: number) => padL + (c.prazo <= 1 ? 0 : (i / (c.prazo - 1)) * gw);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * gh;
  const y0 = y(0);
  const linha = c.fluxoAcumulado.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(c.prazo - 1).toFixed(1)},${y0.toFixed(1)} L${x(0).toFixed(1)},${y0.toFixed(1)} Z`;
  const corTexto = 'var(--cor-texto-sec, #8a8f98)';
  // Exposição máxima é o pior saldo de um MÊS: na view agregada (#127) a curva
  // só passa pelos fins de período, então o marcador só aparece quando o pior
  // saldo cai exatamente no fim de um deles — nunca em cima de um ponto errado.
  // #456: lê o mês do motor em vez de recalcular por `indexOf` — era a
  // segunda fonte que a issue #456 pedia para evitar (`FluxoCalc.mesExposicaoMaxima`).
  const iExp = c.mesExposicaoMaxima ?? -1;
  const passo = Math.max(3, Math.ceil(c.prazo / 10 / 3) * 3);
  const ticks: number[] = [];
  for (let m = 0; m < c.prazo; m += passo) ticks.push(m);
  const marcosGrafico = marcos(crono);
  // #582: as TRÊS famílias que disputam a faixa superior (marcos, Payback,
  // Exposição Máx.) entram no MESMO pool de colisão — é o que faz o rótulo de
  // um marco escalonar para não colidir com o de Payback, e não só entre si.
  const rotulosTopo = resolverColisoesRotulos([
    ...marcosGrafico.map((m) => ({ x: x(col(m.mes)) + 3, y: padT + 8, texto: m.rotulo, cor: corTexto })),
    ...(c.paybackMes !== null ? [{
      x: x(col(c.paybackMes)) + 3, y: padT + 20,
      texto: `Payback: ${c.paybackData} · M+${c.paybackMes}`,
      cor: 'var(--cor-sucesso, #13a98d)',
    }] : []),
    ...(iExp >= 0 ? [{
      x: x(iExp) + 6, y: y(c.exposicaoMaxima) - 4,
      texto: `Exposição Máx.: ${abrevR$(c.exposicaoMaxima)}`,
      cor: 'var(--cor-erro, #d45a3a)',
    }] : []),
  ]);
  return html`
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo de caixa acumulado">
      <defs>
        <clipPath id="acima"><rect x="0" y="0" width=${W} height=${y0} /></clipPath>
        <clipPath id="abaixo"><rect x="0" y=${y0} width=${W} height=${H - y0} /></clipPath>
      </defs>
      ${ticks.map((i) => svg`
        <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${c.meses[i]}</text>`)}
      ${[min, 0, max].map((v) => svg`
        <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
      <path d=${area} fill="var(--cor-sucesso, #13a98d)" opacity="0.15" clip-path="url(#acima)" />
      <path d=${area} fill="var(--cor-erro, #d45a3a)" opacity="0.15" clip-path="url(#abaixo)" />
      <line x1=${padL} y1=${y0} x2=${W - padR} y2=${y0} stroke=${corTexto} stroke-dasharray="4,3" opacity="0.6" />
      <path d=${linha} fill="none" stroke="var(--cor-texto-forte, #e8e8ea)" stroke-width="2" />
      ${marcosGrafico.map((m) => svg`
        <line x1=${x(col(m.mes))} y1=${padT - 4} x2=${x(col(m.mes))} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />`)}
      ${c.paybackMes !== null ? svg`
        <line x1=${x(col(c.paybackMes))} y1=${padT} x2=${x(col(c.paybackMes))} y2=${H - padB}
          stroke="var(--cor-sucesso, #13a98d)" stroke-width="1.5" stroke-dasharray="2,2" />` : nothing}
      ${iExp >= 0 ? svg`
        <circle cx=${x(iExp)} cy=${y(c.exposicaoMaxima)} r="4" fill="var(--cor-erro, #d45a3a)" />` : nothing}
      ${rotulosTopo.map((r) => svg`
        <text x=${r.x} y=${r.y} font-size="9" fill=${r.cor}>${r.texto}</text>`)}
    </svg>
  `;
}
