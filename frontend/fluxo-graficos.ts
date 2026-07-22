import { html, svg, nothing, type TemplateResult } from 'lit';
import { rotuloMesRelativo, type EventoCrono } from './fluxo-shared.js';
import type { FluxoCalc } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────
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
function marcos(crono: EventoCrono[]): { mes: number; rotulo: string }[] {
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

export function graficoFluxoMensal(
  c: FluxoCalc,
  dataInicio: string | null,
  crono: EventoCrono[],
): TemplateResult {
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
        <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${rotuloMesRelativo(dataInicio, i)}</text>`)}
      ${c.fluxoMensal.map((v, i) => svg`
        <rect x=${x(i)} y=${Math.min(y(v), y0)} width=${bw} height=${Math.max(Math.abs(y(v) - y0), 0.5)}
          fill=${v >= 0 ? 'var(--cor-sucesso, #13a98d)' : 'var(--cor-erro, #d45a3a)'} opacity="0.9" />`)}
      ${marcos(crono).map((m, idx) => svg`
        <line x1=${x(m.mes)} y1=${padT - 4} x2=${x(m.mes)} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.7" />
        <text x=${x(m.mes) + 3} y=${padT + 8 + (idx % 2) * 10} font-size="9" fill=${corTexto}>
          ${m.rotulo} · ${rotuloMesRelativo(dataInicio, m.mes)} · M+${m.mes}
        </text>`)}
    </svg>
  `;
}

export function graficoFluxoAcumulado(
  c: FluxoCalc,
  dataInicio: string | null,
  crono: EventoCrono[],
): TemplateResult {
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
        <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${rotuloMesRelativo(dataInicio, i)}</text>`)}
      ${[min, 0, max].map((v) => svg`
        <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
      <path d=${area} fill="var(--cor-sucesso, #13a98d)" opacity="0.15" clip-path="url(#acima)" />
      <path d=${area} fill="var(--cor-erro, #d45a3a)" opacity="0.15" clip-path="url(#abaixo)" />
      <line x1=${padL} y1=${y0} x2=${W - padR} y2=${y0} stroke=${corTexto} stroke-dasharray="4,3" opacity="0.6" />
      <path d=${linha} fill="none" stroke="var(--cor-texto-forte, #e8e8ea)" stroke-width="2" />
      ${marcos(crono).map((m) => svg`
        <line x1=${x(m.mes)} y1=${padT - 4} x2=${x(m.mes)} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />
        <text x=${x(m.mes) + 3} y=${padT + 8} font-size="9" fill=${corTexto}>${m.rotulo}</text>`)}
      ${c.paybackMes !== null ? svg`
        <line x1=${x(c.paybackMes)} y1=${padT} x2=${x(c.paybackMes)} y2=${H - padB}
          stroke="var(--cor-sucesso, #13a98d)" stroke-width="1.5" stroke-dasharray="2,2" />
        <text x=${x(c.paybackMes) + 3} y=${padT + 20} font-size="9" fill="var(--cor-sucesso, #13a98d)">
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

/**
 * Fluxo acumulado do CENÁRIO (Etapa 8 · #56): a curva-base (linha cheia) e a
 * curva do cenário em avaliação (linha TRACEJADA), na mesma escala, para
 * comparação direta do efeito dos deltas. As duas curvas compartilham o eixo
 * (min/max sobre ambas) e o comprimento é o maior dos dois prazos.
 */
export function graficoCenarioAcumulado(
  base: FluxoCalc,
  cenario: FluxoCalc,
  dataInicio: string | null,
  crono: EventoCrono[],
): TemplateResult {
  const W = 900; const H = 280; const padL = 64; const padR = 10; const padT = 26; const padB = 24;
  const gw = W - padL - padR; const gh = H - padT - padB;
  const prazo = Math.max(base.prazo, cenario.prazo);
  const todos = [...base.fluxoAcumulado, ...cenario.fluxoAcumulado];
  const min = Math.min(0, ...todos);
  const max = Math.max(1, ...todos);
  const x = (i: number) => padL + (prazo <= 1 ? 0 : (i / (prazo - 1)) * gw);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * gh;
  const y0 = y(0);
  const caminho = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const corTexto = 'var(--cor-texto-sec, #8a8f98)';
  const passo = Math.max(3, Math.ceil(prazo / 10 / 3) * 3);
  const ticks: number[] = [];
  for (let m = 0; m < prazo; m += passo) ticks.push(m);
  return html`
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fluxo acumulado — base e cenário">
      ${ticks.map((i) => svg`
        <text x=${x(i)} y=${H - 8} font-size="9" fill=${corTexto} text-anchor="middle">${rotuloMesRelativo(dataInicio, i)}</text>`)}
      ${[min, 0, max].map((v) => svg`
        <line x1=${padL} y1=${y(v)} x2=${W - padR} y2=${y(v)} stroke="var(--cor-borda-sutil, rgba(128,128,128,0.15))" />
        <text x=${padL - 6} y=${y(v) + 3} font-size="9" fill=${corTexto} text-anchor="end">${abrevR$(v)}</text>`)}
      <line x1=${padL} y1=${y0} x2=${W - padR} y2=${y0} stroke=${corTexto} stroke-dasharray="4,3" opacity="0.6" />
      ${marcos(crono).map((m) => svg`
        <line x1=${x(m.mes)} y1=${padT - 4} x2=${x(m.mes)} y2=${H - padB}
          stroke=${corTexto} stroke-width="1" stroke-dasharray="4,3" opacity="0.5" />
        <text x=${x(m.mes) + 3} y=${padT + 8} font-size="9" fill=${corTexto}>${m.rotulo}</text>`)}
      <path d=${caminho(base.fluxoAcumulado)} fill="none" stroke="var(--cor-texto-forte, #e8e8ea)" stroke-width="2" />
      <path d=${caminho(cenario.fluxoAcumulado)} fill="none" stroke="var(--cor-primaria, #7c5cff)" stroke-width="2" stroke-dasharray="6,4" />
      <g font-size="9">
        <line x1=${W - 190} y1=${padT - 12} x2=${W - 168} y2=${padT - 12} stroke="var(--cor-texto-forte, #e8e8ea)" stroke-width="2" />
        <text x=${W - 164} y=${padT - 9} fill=${corTexto}>Base</text>
        <line x1=${W - 120} y1=${padT - 12} x2=${W - 98} y2=${padT - 12} stroke="var(--cor-primaria, #7c5cff)" stroke-width="2" stroke-dasharray="6,4" />
        <text x=${W - 94} y=${padT - 9} fill=${corTexto}>Cenário</text>
      </g>
    </svg>
  `;
}
