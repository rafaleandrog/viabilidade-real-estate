import { html, css, nothing, type TemplateResult } from 'lit';
import { fmtR$, fmtPct } from './viab-format.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import { calcularVariacao } from './cenario-variacao.js';
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

// Rótulos e ordem espelham as 5 abas de Custos (#125): Terreno · Obra ·
// Diretos · Indiretos · Financeiro.
// Exportados (#184) para que a pizza de composição de custos do Resumo use
// exatamente os mesmos rótulos e a mesma ordem da tabela do Fluxo de Caixa.
export const GRUPOS_CUSTO = ['terreno', 'obra', 'diretos', 'indireto', 'financeiro'] as const;

export const GRUPO_CUSTO_LABEL: Record<string, string> = {
  terreno: 'Custos do Terreno',
  obra: 'Custos de Obra',
  diretos: 'Custos Diretos',
  indireto: 'Custos Indiretos',
  financeiro: 'Custos Financeiros',
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
  /* #186: controles (Recolher tudo, Mensal/Anual, filtro de fase) — compartilhados
     entre Fluxo de Caixa e Cenários via controlesFluxo, um só lugar para o CSS. */
  .controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
  .controles .espaco { flex: 1; }
  .controles urbi-select { min-width: 160px; }

  .fx-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }

  /* #132: a variacao vs. cenario real acompanha o card de KPI. urbi-kpi nao
     expoe slot nem prop de variacao (so rotulo/valor/variante), entao a celula
     do grid e quem ancora o indicador — sem tocar no primitivo e sem exigir
     bump de shell_min. */
  /* #176: min-width:0 no item do grid (default é min-width:auto, que segue o
     min-content do valor — R$ com muitos dígitos empurra o card por cima do
     vizinho). width:100% no urbi-kpi interno preenche o espaço liberado. */
  /* #262: o indicador vinha em position:absolute; top/right sobre o card e
     SOBREPUNHA o valor do urbi-kpi (que ocupa o topo da célula). Como o layout
     interno do primitivo é shadow DOM inacessível a esta folha, a correção
     determinística é tirá-lo do overlay: a célula vira coluna e o indicador
     entra em fluxo normal, alinhado à direita logo abaixo do KPI. Sem
     sobreposição, mantendo a associação visual com o card. */
  .fx-kpis .kpi-cel { display: flex; flex-direction: column; min-width: 0; }
  .fx-kpis .kpi-cel urbi-kpi { width: 100%; }
  .kpi-var {
    align-self: flex-end; margin-top: 4px;
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.72rem; font-weight: 700; font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .kpi-var.melhor { color: var(--cor-sucesso, #13a98d); }
  .kpi-var.pior { color: var(--cor-erro, #d45a3a); }

  .fx-wrap { overflow: auto; max-height: 72vh; border: 1px solid var(--cor-borda, rgba(255,255,255,0.12)); border-radius: 8px; }
  table.fx { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; width: max-content; min-width: 100%; }
  table.fx th, table.fx td {
    padding: 5px 8px; font-size: 0.75rem; white-space: nowrap;
    border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
    /* #122: fundo OPACO em todas as celulas — --cor-superficie e translucida (~4% alpha)
       e deixava o conteudo dos meses vazar por cima das colunas fixas ao rolar. */
    background: var(--cor-superficie-elevada, #16243A);
  }
  table.fx thead th {
    position: sticky; top: 0; z-index: 3; font-weight: 600; text-align: right;
    color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    background: var(--cor-superficie-elevada, #16243A);
  }
  table.fx td.num { text-align: right; }
  /* Colunas fixas a esquerda — largura TRAVADA (width = min = max, border-box) para
     que o "left" de cada sticky bata exatamente com a largura real da coluna anterior.
     #124: c2 (Inicio) e c3 (Duracao) ocultadas — apenas exibicao, nao afetam calculo.
     Cumulativo com c2/c3 ocultos: 0 · 220 · 340 (fim em 460). */
  .c1, .c4, .c5, .c6 { box-sizing: border-box; overflow: hidden; background: var(--cor-superficie-elevada, #16243A); }
  .c1 { position: sticky; left: 0;    z-index: 2; width: 220px; min-width: 220px; max-width: 220px; text-overflow: ellipsis; text-align: left; }
  .c2 { display: none; }
  .c3 { display: none; }
  .c4 { position: sticky; left: 220px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right; }
  .c5 { position: sticky; left: 340px; z-index: 2; width: 120px; min-width: 120px; max-width: 120px; text-align: right; }
  /* #189: coluna % sobre VGV — última coluna fixa (sticky), a borda que fechava
     o bloco congelado passa dela para o c5. */
  .c6 { position: sticky; left: 460px; z-index: 2; width: 76px; min-width: 76px; max-width: 76px; text-align: right;
    border-right: 2px solid var(--cor-borda, rgba(255,255,255,0.12)); }
  table.fx thead .c1, table.fx thead .c4, table.fx thead .c5, table.fx thead .c6 { z-index: 4; }
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

  /* #123: cores de fundo por tipo de linha — color-mix produz cor opaca (base opaca),
     especificidade [0,2,1] supera a regra de sticky .c1/.c4/.c5 [0,1,0], entao
     o fundo colorido tambem aparece nas colunas fixas da linha. */
  tr.grupo.receita td   { background: color-mix(in srgb, var(--cor-sucesso, #13a98d) 15%, var(--cor-superficie-elevada, #16243A)); }
  tr.subgrupo.receita td { background: color-mix(in srgb, var(--cor-sucesso, #13a98d)  8%, var(--cor-superficie-elevada, #16243A)); }
  tr.subitem.receita td  { background: color-mix(in srgb, var(--cor-sucesso, #13a98d)  4%, var(--cor-superficie-elevada, #16243A)); }
  tr.grupo.custo td     { background: color-mix(in srgb, var(--cor-erro, #d45a3a) 15%, var(--cor-superficie-elevada, #16243A)); }
  tr.subgrupo.custo td  { background: color-mix(in srgb, var(--cor-erro, #d45a3a)  8%, var(--cor-superficie-elevada, #16243A)); }
  tr.item.custo td      { background: color-mix(in srgb, var(--cor-erro, #d45a3a)  4%, var(--cor-superficie-elevada, #16243A)); }
`;

/** Resultado do fluxo = último ponto do acumulado. */
function resultadoDe(c: FluxoCalc): number {
  return c.fluxoAcumulado[c.fluxoAcumulado.length - 1] || 0;
}

/**
 * Seta ↑/↓ + variação % de um KPI contra o cenário real (#132). Devolve
 * `nothing` quando não há base (uso normal, fora de Cenários) ou quando a
 * variação é desprezível — ver `calcularVariacao`.
 */
function varKpi(novo: number | null, base: number | null | undefined, maiorMelhor: boolean) {
  if (base === undefined || base === null) return nothing;
  const v = calcularVariacao(novo, base, maiorMelhor);
  if (!v) return nothing;
  const seta = v.pct > 0 ? 'fa-solid fa-arrow-up' : 'fa-solid fa-arrow-down';
  return html`
    <span class="kpi-var ${v.melhor ? 'melhor' : 'pior'}"
      title=${`${v.melhor ? 'Melhor' : 'Pior'} que o cenário real (${v.texto})`}>
      <urbi-icone classe=${seta}></urbi-icone>${v.texto}
    </span>
  `;
}

/**
 * Os 6 KPIs do fluxo (Resultado, TIR, VPL, Payback, Exposição máxima,
 * Receita Bruta (VGV) — #188).
 *
 * `base` só é passada pela aba Cenários (#132): com ela, Resultado, TIR, VPL e
 * Exposição máxima ganham seta + variação % contra o cenário real. Payback é
 * uma data, não um escalar comparável — fica sem indicador. Sem `base` o
 * componente renderiza exatamente como antes (aba Fluxo de Caixa e Resumo).
 */
export function kpisFluxo(c: FluxoCalc, base?: FluxoCalc | null): TemplateResult {
  const resultado = resultadoDe(c);
  const tirTxt = c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`;
  const tirVar = c.tir === null ? '' : (c.tir > 0 ? 'sucesso' : 'erro');
  // Exposição máxima é min(fluxoAcumulado), tipicamente negativa: subir (ficar
  // menos negativa) é MELHOR — daí maiorMelhor = true nos quatro indicadores.
  return html`
    <div class="fx-kpis">
      <div class="kpi-cel">
        <urbi-kpi rotulo="Resultado" .valor=${fmtR$(resultado)} variante=${resultado >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        ${varKpi(resultado, base ? resultadoDe(base) : undefined, true)}
      </div>
      <div class="kpi-cel">
        <urbi-kpi rotulo="TIR" .valor=${tirTxt} variante=${tirVar}></urbi-kpi>
        ${varKpi(c.tir, base ? base.tir : undefined, true)}
      </div>
      <div class="kpi-cel">
        <urbi-kpi rotulo="VPL" .valor=${fmtR$(c.vpl)} variante=${c.vpl >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
        ${varKpi(c.vpl, base ? base.vpl : undefined, true)}
      </div>
      <div class="kpi-cel">
        <urbi-kpi rotulo="Payback" .valor=${c.paybackData ?? '—'}></urbi-kpi>
      </div>
      <div class="kpi-cel">
        <urbi-kpi rotulo="Exposição máxima" .valor=${fmtR$(c.exposicaoMaxima)} variante="erro"></urbi-kpi>
        ${varKpi(c.exposicaoMaxima, base ? base.exposicaoMaxima : undefined, true)}
      </div>
      <div class="kpi-cel"
        title=${`VGV Total ${fmtR$(c.vgvTotal)} · VGV Permuta Física ${fmtR$(c.vgvPermutaFisica)}`}>
        <urbi-kpi rotulo="Receita Bruta (VGV)" .valor=${fmtR$(c.receitaBrutaVgv)}></urbi-kpi>
        ${varKpi(c.receitaBrutaVgv, base ? base.receitaBrutaVgv : undefined, true)}
      </div>
    </div>
  `;
}

/** #189: peso da linha sobre a Receita Bruta (VGV) — vazio sem base ou linha sem sentido. */
function pctVgv(total: number, vgv: number, ocultar: boolean): string {
  if (ocultar || vgv <= 0) return '';
  return fmtPct((total / vgv) * 100);
}

/**
 * #186: controles da tabela do Fluxo de Caixa — Recolher/Expandir tudo,
 * Mensal/Anual e o filtro Global/por fase — extraídos de `tela-fluxo-ver.ts`
 * para serem reusados pela aba Cenários sem duplicar o markup. `extra` é um
 * slot livre no fim da barra (ex.: os botões CSV/PDF, que só a aba Fluxo de
 * Caixa tem).
 */
export interface ControlesFluxoProps {
  tudoRecolhido: boolean;
  onToggleTudo: () => void;
  visao: 'mensal' | 'anual';
  onVisao: (v: 'mensal' | 'anual') => void;
  fases: string[];
  faseFiltro: string;
  onFase: (v: string) => void;
  extra?: TemplateResult;
}

export function controlesFluxo(p: ControlesFluxoProps): TemplateResult {
  return html`
    <div class="controles">
      <urbi-botao variante="secundario" pequeno @click=${p.onToggleTudo}>
        ${p.tudoRecolhido ? 'Expandir tudo' : 'Recolher tudo'}
      </urbi-botao>
      <div role="group" aria-label="Período das colunas">
        <urbi-badge cor="info" interativo ?ativo=${p.visao === 'mensal'}
          @click=${() => p.onVisao('mensal')}
        >Mensal</urbi-badge>
        <urbi-badge cor="info" interativo ?ativo=${p.visao === 'anual'}
          @click=${() => p.onVisao('anual')}
        >Anual</urbi-badge>
      </div>
      ${p.fases.length > 1 ? html`
        <urbi-select
          .valor=${p.faseFiltro}
          .opcoes=${[{ valor: '', rotulo: 'Global (todas as fases)' },
            ...p.fases.map((f) => ({ valor: f, rotulo: f }))]}
          @urbi:select-change=${(e: CustomEvent) => p.onFase(e.detail.valor)}
        ></urbi-select>` : nothing}
      <span class="espaco"></span>
      ${p.extra ?? nothing}
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
  vgv: number,
  ocultarPct = false,
  expansivel = true,
): TemplateResult {
  const podeToggle = chaveToggle && expansivel;
  return html`
    <tr class=${`${classe} ${ehCusto ? 'custo' : 'receita'}`}>
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
      <td class="c6 num">${pctVgv(linha.total, vgv, ocultarPct)}</td>
      ${linha.mensal.map((v) => html`<td class="num">${celula(v, ehCusto)}</td>`)}
    </tr>
  `;
}

function linhaResultado(nome: string, valores: number[], vpl: number): TemplateResult {
  const total = nome.includes('Acumulado') ? valores[valores.length - 1] : valores.reduce((s, v) => s + v, 0);
  return html`
    <tr class="resultado">
      <td class="c1">${nome}</td>
      <td class="c2"></td><td class="c3"></td>
      <td class="c4 num ${total >= 0 ? 'pos' : 'neg'}">${celula(total, false)}</td>
      <td class="c5 num ${vpl >= 0 ? 'pos' : 'neg'}">${celula(vpl, false)}</td>
      <td class="c6"></td>
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
  // Ordem das 5 abas de Custos (#125): Terreno · Obra · Diretos · Indiretos · Financeiro.
  const grupos = GRUPOS_CUSTO.filter((g) => custosPorGrupo(g).length > 0);
  // VPL é linear no fluxo mensal, então o VPL de um agregado = Σ VPL das suas linhas (#126).
  const somaVpl = (linhas: LinhaCalc[]): number => linhas.reduce((s, l) => s + l.vpl, 0);

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
            <th class="c6">% VGV</th>
            ${c.meses.map((m) => html`<th>${m}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${linhaTabela('grupo', 'receita', 'Receita Bruta (VGV)',
            { mensal: c.receitaMensal, total: c.receitaMensal.reduce((s, v) => s + v, 0), vpl: somaVpl(c.linhasReceita) }, dataInicio, colapso, toggle, false, c.receitaBrutaVgv, true)}
          ${!colapso['receita'] ? c.linhasReceita.map((l) => html`
            ${linhaTabela('subgrupo', `r${l.id}`,
              l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome, l, dataInicio, colapso, toggle, false, c.receitaBrutaVgv)}
            ${!colapso[`r${l.id}`] ? (l.itens ?? []).map((t) =>
              linhaTabela('subitem', '', t.nome, t, dataInicio, colapso, toggle, false, c.receitaBrutaVgv)) : nothing}
          `) : nothing}

          ${linhaTabela('grupo', '', 'Custo Total',
            { mensal: c.custoMensal, total: c.custoMensal.reduce((s, v) => s + v, 0), vpl: somaVpl(c.linhasCusto) }, dataInicio, colapso, toggle, true, c.receitaBrutaVgv, false, false)}
          ${grupos.map((g) => html`
            ${linhaTabela('subgrupo', `custo-${g}`, GRUPO_CUSTO_LABEL[g],
              { mensal: somaLinhas(custosPorGrupo(g)), total: custosPorGrupo(g).reduce((s, x) => s + x.total, 0), vpl: somaVpl(custosPorGrupo(g)) }, dataInicio, colapso, toggle, true, c.receitaBrutaVgv)}
            ${!colapso[`custo-${g}`] ? custosPorGrupo(g).map((x) =>
              linhaTabela('item', '', x.nome, x, dataInicio, colapso, toggle, true, c.receitaBrutaVgv)) : nothing}
          `)}

          <tr class="divisoria"><td class="c1"></td><td class="c2"></td><td class="c3"></td><td class="c4"></td><td class="c5"></td>${c.meses.map(() => html`<td></td>`)}</tr>
          ${linhaResultado('Fluxo de Caixa Mensal', c.fluxoMensal, c.vpl)}
          ${linhaResultado('Fluxo de Caixa Acumulado', c.fluxoAcumulado, c.vpl)}
        </tbody>
      </table>
    </div>
  `;
}

/** Chaves de colapso de todos os grupos expansíveis (para "recolher/expandir tudo"). */
export function chavesColapso(c: FluxoCalc): string[] {
  return ['receita', 'custo-terreno', 'custo-obra', 'custo-diretos', 'custo-indireto', 'custo-financeiro',
    ...c.linhasReceita.map((l) => `r${l.id}`)];
}
