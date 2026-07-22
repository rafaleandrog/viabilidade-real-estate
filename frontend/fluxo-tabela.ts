import { html, css, nothing, type TemplateResult } from 'lit';
import { fmtR$, fmtPct } from './viab-format.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import type { FluxoCalc, LinhaCalc } from './fluxo-caixa-motor.js';

// ─────────────────────────────────────────────────────────────────────────
// Tabela + KPIs do Fluxo de Caixa (funções puras).
//
// Extraídos de tela-fluxo-ver.ts (Etapa 8 · #56) para serem reusados pela aba
// Cenários sem duplicar as ~150 linhas da tabela mensal (colunas fixas sticky
// + scroll horizontal) e os 4 KPIs. São funções PURAS: recebem o cálculo do
// motor + o mapa de colapso + um callback de toggle e devolvem o TemplateResult.
// O estado de colapso vive no componente hospedeiro (tela-fluxo-ver / cenários).
// ─────────────────────────────────────────────────────────────────────────

const GRUPO_CUSTO_LABEL: Record<string, string> = {
  terreno: 'Custos do Terreno',
  obra: 'Custos Diretos',
  indireto: 'Custos Indiretos',
};

/** Notação contábil da célula: vazio para zero; custos entre parênteses. */
function celula(v: number, negativoEntreParenteses: boolean): string {
  if (!v || Math.abs(v) < 0.5) return '';
  const abs = Math.round(Math.abs(v)).toLocaleString('pt-BR');
  if (negativoEntreParenteses) return `(${abs})`;
  return v < 0 ? `(${abs})` : abs;
}

/** Estilos da tabela + KPIs — o componente hospedeiro os adiciona a `static styles`. */
export const estiloFluxoTabela = css`
  .fx-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }

  .fx-wrap { overflow: auto; max-height: 72vh; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12)); border-radius: 8px; }
  table.fx { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; width: max-content; min-width: 100%; }
  table.fx th, table.fx td {
    padding: 5px 8px; font-size: 0.75rem; white-space: nowrap;
    border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
    background: var(--cor-superficie, #17181c);
  }
  table.fx thead th {
    position: sticky; top: 0; z-index: 3; font-weight: 600; text-align: right;
    color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
  }
  table.fx td.num { text-align: right; }
  /* 5 colunas fixas à esquerda — largura TRAVADA (width = min = max, border-box) para
     que o "left" de cada sticky bata exatamente com a largura real da coluna anterior.
     Cumulativo dos passos: 0 · 220 · 292 · 356 · 476 (fim em 596). */
  .c1, .c2, .c3, .c4, .c5 { box-sizing: border-box; overflow: hidden; background: var(--cor-superficie, #17181c); }
  .c1 { position: sticky; left: 0;    z-index: 2; width: 220px; min-width: 220px; max-width: 220px; text-overflow: ellipsis; text-align: left; }
  .c2 { position: sticky; left: 220px; z-index: 2; width: 72px;  min-width: 72px;  max-width: 72px;  text-align: right; }
  .c3 { position: sticky; left: 292px; z-index: 2; width: 64px;  min-width: 64px;  max-width: 64px;  text-align: right; }
  .c4 { position: sticky; left: 356px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right; }
  .c5 { position: sticky; left: 476px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right;
    border-right: 2px solid var(--cor-borda, rgba(255,255,255,0.12)); }
  table.fx thead .c1, table.fx thead .c2, table.fx thead .c3, table.fx thead .c4, table.fx thead .c5 { z-index: 4; }
  table.fx thead .c1 { text-align: left; }

  tr.grupo td { font-weight: 700; }
  tr.subgrupo td { font-weight: 600; }
  tr.item td.c1 { padding-left: 28px; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
  tr.subitem td.c1 { padding-left: 44px; color: var(--cor-texto-sec, rgba(255,255,255,0.6)); }
  tr.divisoria td { border-bottom: 2px solid var(--cor-borda, rgba(255,255,255,0.2)); padding: 0; height: 2px; }
  tr.resultado td { font-weight: 700; }
  td.pos { color: var(--cor-sucesso, #13a98d); }
  td.neg { color: var(--cor-erro, #d45a3a); }
  .toggle { cursor: pointer; user-select: none; background: none; border: none; color: inherit; font: inherit; padding: 0; }
  .toggle .seta { display: inline-block; width: 14px; }
`;

/** Os 4 KPIs do fluxo (TIR, VPL, Payback, Exposição máxima). */
export function kpisFluxo(c: FluxoCalc): TemplateResult {
  const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
  const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
  return html`
    <div class="fx-kpis">
      <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
      <urbi-kpi rotulo="VPL" .valor=${fmtR$(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      <urbi-kpi rotulo="Payback" .valor=${c.paybackData ?? '—'}></urbi-kpi>
      <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$(c.exposicaoMaxima)} variante="erro"></urbi-kpi>
    </div>
  `;
}

function linhaTabela(
  classe: 'grupo' | 'subgrupo' | 'item' | 'subitem',
  chaveToggle: string,
  nome: string,
  linha: Partial<LinhaCalc> & { mensal: number[]; total: number },
  dataInicio: string | null,
  colapso: Record<string, boolean>,
  toggle: (chave: string) => void,
  ehCusto: boolean,
  expansivel = true,
): TemplateResult {
  const podeToggle = chaveToggle && expansivel;
  return html`
    <tr class=${classe}>
      <td class="c1">
        ${podeToggle ? html`
          <button class="toggle" @click=${() => toggle(chaveToggle)} aria-expanded=${!colapso[chaveToggle]}>
            <span class="seta">${colapso[chaveToggle] ? '▸' : '▾'}</span>${nome}
          </button>` : nome}
      </td>
      <td class="c2">${linha.duracao ? rotuloMesRelativo(dataInicio, linha.inicio!) : ''}</td>
      <td class="c3">${linha.duracao ? `${linha.duracao}m` : ''}</td>
      <td class="c4 num">${celula(linha.total, ehCusto)}</td>
      <td class="c5 num">${linha.vpl !== undefined ? celula(linha.vpl, ehCusto) : ''}</td>
      ${linha.mensal.map((v) => html`<td class="num">${celula(v, ehCusto)}</td>`)}
    </tr>
  `;
}

function linhaResultado(nome: string, valores: number[], c: FluxoCalc): TemplateResult {
  const total = nome.includes('Acumulado') ? valores[valores.length - 1] : valores.reduce((s, v) => s + v, 0);
  return html`
    <tr class="resultado">
      <td class="c1">${nome}</td>
      <td class="c2"></td><td class="c3"></td>
      <td class="c4 num ${total >= 0 ? 'pos' : 'neg'}">${celula(total, false)}</td>
      <td class="c5"></td>
      ${valores.map((v) => html`<td class="num ${v >= 0 ? 'pos' : 'neg'}">${celula(v, false)}</td>`)}
    </tr>
  `;
}

/**
 * Tabela mensal completa do fluxo (mesmos campos da página Fluxo de Caixa):
 * Receita (por fase → tipologia), Custo Total (por grupo → linha) e as duas
 * linhas de resultado (Mensal, Acumulado), com colunas fixas Início/Duração/
 * Total/VPL + uma coluna por mês. `colapso`/`toggle` controlam a expansão.
 */
export function tabelaFluxo(
  c: FluxoCalc,
  dataInicio: string | null,
  colapso: Record<string, boolean>,
  toggle: (chave: string) => void,
): TemplateResult {
  const somaLinhas = (linhas: LinhaCalc[]): number[] => {
    const out = new Array<number>(c.prazo).fill(0);
    for (const l of linhas) for (let i = 0; i < c.prazo; i++) out[i] += l.mensal[i];
    return out;
  };
  const custosPorGrupo = (g: string) => c.linhasCusto.filter((x) => x.grupo === g);
  const grupos = (['terreno', 'obra', 'indireto'] as const).filter((g) => custosPorGrupo(g).length > 0);

  return html`
    <div class="fx-wrap">
      <table class="fx">
        <thead>
          <tr>
            <th class="c1">Linha</th>
            <th class="c2">Início</th>
            <th class="c3">Duração</th>
            <th class="c4">Total</th>
            <th class="c5">VPL</th>
            ${c.meses.map((m) => html`<th>${m}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${linhaTabela('grupo', 'receita', 'Receita',
            { mensal: c.receitaMensal, total: c.receitaMensal.reduce((s, v) => s + v, 0) }, dataInicio, colapso, toggle, false)}
          ${!colapso['receita'] ? c.linhasReceita.map((l) => html`
            ${linhaTabela('subgrupo', `r${l.id}`,
              l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome, l, dataInicio, colapso, toggle, false)}
            ${!colapso[`r${l.id}`] ? (l.itens ?? []).map((t) =>
              linhaTabela('subitem', '', t.nome, t, dataInicio, colapso, toggle, false)) : nothing}
          `) : nothing}

          ${linhaTabela('grupo', '', 'Custo Total',
            { mensal: c.custoMensal, total: c.custoMensal.reduce((s, v) => s + v, 0) }, dataInicio, colapso, toggle, true, false)}
          ${grupos.map((g) => html`
            ${linhaTabela('subgrupo', `custo-${g}`, GRUPO_CUSTO_LABEL[g],
              { mensal: somaLinhas(custosPorGrupo(g)), total: custosPorGrupo(g).reduce((s, x) => s + x.total, 0) }, dataInicio, colapso, toggle, true)}
            ${!colapso[`custo-${g}`] ? custosPorGrupo(g).map((x) =>
              linhaTabela('item', '', x.nome, x, dataInicio, colapso, toggle, true)) : nothing}
          `)}

          <tr class="divisoria"><td class="c1"></td><td class="c2"></td><td class="c3"></td><td class="c4"></td><td class="c5"></td>${c.meses.map(() => html`<td></td>`)}</tr>
          ${linhaResultado('Fluxo de Caixa Mensal', c.fluxoMensal, c)}
          ${linhaResultado('Fluxo de Caixa Acumulado', c.fluxoAcumulado, c)}
        </tbody>
      </table>
    </div>
  `;
}

/** Chaves de colapso de todos os grupos expansíveis (para "recolher/expandir tudo"). */
export function chavesColapso(c: FluxoCalc): string[] {
  return ['receita', 'custo-terreno', 'custo-obra', 'custo-indireto',
    ...c.linhasReceita.map((l) => `r${l.id}`)];
}
