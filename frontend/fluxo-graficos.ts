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
      ${marcos(crono).map((m, idx) => svg`
        <line x1=${x(col(m.mes))} y1=${padT - 4} x2=${x(col(m.mes))} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.7" />
        <text x=${x(col(m.mes)) + 3} y=${padT + 8 + (idx % 2) * 10} font-size="9" fill=${corTexto}>
          ${m.rotulo} · ${rotuloMesRelativo(dataInicio, m.mes)} · M+${m.mes}
        </text>`)}
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
  const iExp = c.fluxoAcumulado.indexOf(c.exposicaoMaxima);
  const passo = Math.max(3, Math.ceil(c.prazo / 10 / 3) * 3);
  const ticks: number[] = [];
  for (let m = 0; m < c.prazo; m += passo) ticks.push(m);
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
      ${marcos(crono).map((m) => svg`
        <line x1=${x(col(m.mes))} y1=${padT - 4} x2=${x(col(m.mes))} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />
        <text x=${x(col(m.mes)) + 3} y=${padT + 8} font-size="9" fill=${corTexto}>${m.rotulo}</text>`)}
      ${c.paybackMes !== null ? svg`
        <line x1=${x(col(c.paybackMes))} y1=${padT} x2=${x(col(c.paybackMes))} y2=${H - padB}
          stroke="var(--cor-sucesso, #13a98d)" stroke-width="1.5" stroke-dasharray="2,2" />
        <text x=${x(col(c.paybackMes)) + 3} y=${padT + 20} font-size="9" fill="var(--cor-sucesso, #13a98d)">
          Payback: ${c.paybackData} · M+${c.paybackMes}
        </text>` : nothing}
      ${iExp >= 0 ? svg`
        <circle cx=${x(iExp)} cy=${y(c.exposicaoMaxima)} r="4" fill="var(--cor-erro, #d45a3a)" />
        <text x=${x(iExp) + 6} y=${y(c.exposicaoMaxima) - 4} font-size="9" fill="var(--cor-erro, #d45a3a)">
          Exposição Máx.: ${abrevR$(c.exposicaoMaxima)}
        </text>` : nothing}
    </svg>
  `;
}
