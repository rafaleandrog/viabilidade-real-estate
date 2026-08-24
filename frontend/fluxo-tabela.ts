import { html, css, nothing, type TemplateResult } from 'lit';
import { fmtR$, fmtPct, fmtNum } from './viab-format.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import { calcularVariacao } from './cenario-variacao.js';
import { type FluxoCalc, type LinhaCalc, pctDeReceitaBruta } from './fluxo-caixa-motor.js';
import { type FundingNoFluxo } from './funding-motor.js';
import type { Divergencia, PermutaFisicaTipologia } from './fluxo-invariantes.js';

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
  .reconciliacao { margin-top: 16px; }
  .reconciliacao-resumo { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .reconciliacao-lista { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
  .reconciliacao-lista li { color: var(--cor-texto-sec, rgba(255,255,255,0.68)); }
  .reconciliacao-lista li.erro { color: var(--cor-erro, #d45a3a); }
  .reconciliacao-lista strong { color: inherit; }

  .fx-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }

  /* #352 (BUG7-44): a variação % (#132) precisa ficar DENTRO da mesma moldura
     do KPI, mas urbi-kpi (ui/src/urbi-kpi.ts, no monorepo) só declara 4 props
     (rotulo/valor/variante/formato) e o render() não tem slot — nada de
     markup filho sobrevive. Overlay por cima também não serve: o layout
     interno é shadow DOM inacessível a esta folha e sobrepunha o valor
     (#262). A saída determinística (D7) é abandonar urbi-kpi nesses 6 cards e
     desenhar com markup + tokens próprios do app — mesmo padrão do .comp de
     tela-analise-mercado.ts — para rótulo, valor e variação conviverem na
     mesma caixa, sem depender de slot inexistente. */
  .kpi-card {
    background: var(--cor-superficie, rgba(255,255,255,0.04));
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
    border-radius: 8px;
    padding: 14px 16px;
    min-width: 0;
  }
  .kpi-card .rotulo {
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.4px;
    color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700;
  }
  .kpi-card .valor {
    font-size: 1.4rem; font-weight: 700;
    color: var(--cor-texto-forte, rgba(255,255,255,0.95));
    margin-top: 4px;
  }
  .kpi-card.erro .valor { color: var(--cor-erro, #D45A3A); }
  .kpi-card.alerta .valor { color: var(--cor-alerta, #F7A111); }
  .kpi-card.sucesso .valor { color: var(--cor-sucesso, #13A98D); }
  .kpi-var {
    margin-top: 6px;
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.72rem; font-weight: 700; font-variant-numeric: tabular-nums;
    pointer-events: none;
  }
  .kpi-var.melhor { color: var(--cor-sucesso, #13a98d); }
  .kpi-var.pior { color: var(--cor-erro, #d45a3a); }
  /* #456: linha de detalhe (% + mês) dos três KPIs derivados — neutra, ao
     contrário de .kpi-var, que carrega semântica de melhor/pior. */
  .kpi-info {
    margin-top: 6px;
    font-size: 0.72rem;
    color: var(--cor-texto-sec, rgba(255,255,255,0.6));
  }

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

  /* #269: tabela pequena e simples (sem sticky/scroll) — poucas linhas, uma
     por tipologia com permuta física declarada. */
  table.tabela-permuta { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
  table.tabela-permuta th, table.tabela-permuta td {
    padding: 6px 10px; font-size: 0.8rem; text-align: left;
    border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06));
  }
  table.tabela-permuta th.num, table.tabela-permuta td.num { text-align: right; }

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

/** Relatório visível da #240. Divergência vazia também é informação: mostra
 * que o estudo passou pelas invariantes, em vez de deixar a validação oculta. */
export function relatorioReconciliacao(divergencias: Divergencia[]): TemplateResult {
  const erros = divergencias.filter((d) => d.severidade === 'erro');
  const alertas = divergencias.filter((d) => d.severidade === 'alerta');
  return html`
    <urbi-card titulo="Reconciliação do estudo" class="reconciliacao">
      <div class="reconciliacao-resumo">
        <urbi-badge cor=${erros.length ? 'erro' : alertas.length ? 'alerta' : 'sucesso'}>
          ${erros.length ? `${erros.length} erro(s)` : alertas.length ? `${alertas.length} alerta(s)` : 'Tudo reconciliado'}
        </urbi-badge>
        <span>Erros indicam quebra de cálculo; alertas indicam premissas de risco.</span>
      </div>
      ${divergencias.length ? html`
        <ol class="reconciliacao-lista">
          ${divergencias.map((d) => html`
            <li class=${d.severidade}>
              <strong>${d.codigo}</strong> — ${d.mensagem}
              ${d.linha ? html` Linha: ${d.linha}.` : nothing}
              ${d.mes !== undefined ? html` Mês: ${d.mes + 1}.` : nothing}
              Esperado: ${d.esperado}; encontrado: ${d.encontrado}; diferença: ${d.diferenca}.
            </li>`)}
        </ol>` : html`<span>Nenhuma divergência encontrada nas invariantes de produto, contratação, recebíveis e funding.</span>`}
    </urbi-card>`;
}

/**
 * #269: área e quantidade permutada por tipologia — mesma fonte
 * (`permutaFisicaPorTipologia`) usada pela exportação CSV/PDF, para tela e
 * arquivo nunca divergirem. Some da tela quando o estudo não tem permuta
 * física declarada.
 */
export function tabelaPermutaFisica(linhas: PermutaFisicaTipologia[]): TemplateResult | typeof nothing {
  if (linhas.length === 0) return nothing;
  return html`
    <urbi-card titulo="Permuta física — área e quantidade por tipologia" class="reconciliacao">
      <table class="tabela-permuta">
        <thead>
          <tr><th>Tipologia</th><th class="num">Permutada</th><th class="num">Catálogo</th><th class="num">Área permutada</th></tr>
        </thead>
        <tbody>
          ${linhas.map((l) => html`
            <tr>
              <td>${l.nome}</td>
              <td class="num">${fmtNum(l.quantidadePermutada)}</td>
              <td class="num">${fmtNum(l.quantidadeTotal)}</td>
              <td class="num">${fmtNum(l.areaPermutada)} m²</td>
            </tr>`)}
        </tbody>
      </table>
    </urbi-card>`;
}

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
 * Os KPIs do fluxo, incluindo a Receita Bruta canônica (#237).
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
  // #353 (BUG7-45): exposição máxima é min(fluxoAcumulado), tipicamente
  // negativa — mas o autor quer a leitura por MAGNITUDE (módulo): exposição
  // maior (mais dinheiro em risco) é PIOR, mesmo que numericamente mais
  // negativa. Por isso aqui, ao contrário dos outros KPIs, comparamos
  // Math.abs() e usamos maiorMelhor = false (magnitude subir é pior).
  const expMag = Math.abs(c.exposicaoMaxima);
  const expBaseMag = base ? Math.abs(base.exposicaoMaxima) : undefined;
  const expVariacao = expBaseMag !== undefined ? calcularVariacao(expMag, expBaseMag, false) : null;
  const expVariante = expVariacao ? (expVariacao.melhor ? 'sucesso' : 'erro') : 'erro';
  // #456: os três indicadores de decisão que a EVI trata como KPI de primeira
  // classe e que o app só publicava na exportação — juros de clientes,
  // carteira máxima e o mês/%VGV da exposição. Nada editável, tudo derivado
  // do que `calcularFluxo` já expõe (`jurosClientes`, `carteiraClientesMaxima`
  // + `mesCarteiraClientesMaxima`, `mesExposicaoMaxima`). O "VGV" dos três
  // percentuais é `receitaBruta` (grandeza 6, #229) — é o que corresponde ao
  // `VGVIncorpIndividual` da EVI, não `vgvTotal`/`vgvVendavel` (ver #456).
  const pctJuros = pctDeReceitaBruta(c.jurosClientes, c.receitaBruta);
  const pctCarteira = pctDeReceitaBruta(c.carteiraClientesMaxima, c.receitaBruta);
  const pctExp = pctDeReceitaBruta(expMag, c.receitaBruta);
  const mesTxt = (mes: number | null) => mes === null ? '' : ` — ${c.meses[mes] ?? `M${mes + 1}`}`;
  return html`
    <div class="fx-kpis">
      <div class="kpi-card ${resultado >= 0 ? 'sucesso' : 'erro'}">
        <div class="rotulo">Resultado</div>
        <div class="valor">${fmtR$(resultado)}</div>
        ${varKpi(resultado, base ? resultadoDe(base) : undefined, true)}
      </div>
      <div class="kpi-card ${tirVar}">
        <div class="rotulo">TIR</div>
        <div class="valor">${tirTxt}</div>
        ${varKpi(c.tir, base ? base.tir : undefined, true)}
      </div>
      <div class="kpi-card ${c.vpl >= 0 ? 'sucesso' : 'erro'}">
        <div class="rotulo">VPL</div>
        <div class="valor">${fmtR$(c.vpl)}</div>
        ${varKpi(c.vpl, base ? base.vpl : undefined, true)}
      </div>
      <div class="kpi-card">
        <div class="rotulo">Payback</div>
        <div class="valor">${c.paybackData ?? '—'}</div>
      </div>
      <div class="kpi-card ${expVariante}">
        <!-- #456 critério 6: o rótulo declara que é o fluxo LIVRE (desalavancado)
             — FluxoCalc.exposicaoMaxima nunca inclui funding. Sem esta
             declaração, um estudo com Capital Stack leria "exposição" e
             suporia que já é pós-financiamento. -->
        <div class="rotulo">Exposição máxima (fluxo livre)</div>
        <div class="valor">${fmtR$(expMag)}</div>
        ${varKpi(expMag, expBaseMag, false)}
        <div class="kpi-info">${fmtPct(pctExp)} do VGV${mesTxt(c.mesExposicaoMaxima)}</div>
      </div>
      <div class="kpi-card">
        <div class="rotulo">Juros de clientes</div>
        <div class="valor">${fmtR$(c.jurosClientes)}</div>
        <div class="kpi-info">${fmtPct(pctJuros)} da Receita Bruta</div>
      </div>
      <div class="kpi-card">
        <div class="rotulo">Carteira máxima de clientes</div>
        <div class="valor">${fmtR$(c.carteiraClientesMaxima)}</div>
        <div class="kpi-info">${fmtPct(pctCarteira)} do VGV${mesTxt(c.mesCarteiraClientesMaxima)}</div>
      </div>
      <div class="kpi-card">
        <div class="rotulo">Receita Bruta — VGV</div>
        <div class="valor">${fmtR$(c.receitaBruta)}</div>
        ${varKpi(c.receitaBruta, base ? base.receitaBruta : undefined, true)}
      </div>
      <div class="kpi-card"
        title=${`VGV Total ${fmtR$(c.vgvTotal)} · VGV Permuta Física ${fmtR$(c.vgvPermutaFisica)} · ` +
          // #241: as três grandezas de contratação (#227/#229) — bruto, desconto
          // comercial e líquido — não tinham lugar na tela nem na exportação.
          // Ficam aqui, junto das outras informativas, em vez de virarem 3 KPIs
          // novos — decisão que segue valendo depois da #456 (que já levou o
          // grid a 9 cards com os três indicadores novos de decisão).
          `Venda Bruta Contratada ${fmtR$(c.vendaBrutaContratada)} · ` +
          `Desconto Comercial ${fmtR$(c.descontoComercial)} · ` +
          `Venda Líquida Contratada ${fmtR$(c.vendaLiquidaContratada)}`}>
        <!-- #229: rótulo corrigido — este valor é VGV VENDÁVEL (potencial menos
             permuta física), não "Receita Bruta" no sentido de recebimento em
             caixa (#228); "Receita Bruta (VGV)" confundia as duas grandezas. -->
        <div class="rotulo">VGV Vendável</div>
        <div class="valor">${fmtR$(c.vgvVendavel)}</div>
        ${varKpi(c.vgvVendavel, base ? base.vgvVendavel : undefined, true)}
      </div>
    </div>
  `;
}

/** #189/#229: peso da linha sobre o VGV Vendável — vazio sem base ou linha sem sentido. */
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
          .opcoes=${[{ valor: '', rotulo: 'Global (todos os grupos)' },
            ...p.fases.map((f) => ({ valor: f, rotulo: f }))]}
          @urbi:select-change=${(e: CustomEvent) => p.onFase(e.detail.valor)}
        ></urbi-select>` : nothing}
      <span class="espaco"></span>
      ${p.extra ?? nothing}
    </div>
  `;
}

/**
 * Chaves que NASCEM recolhidas. Nenhuma hoje — o único caso, o detalhamento
 * de financiamento à produção (oito linhas de auditoria por camada), saiu da
 * tabela (#472, decisão D12). A função fica como infraestrutura genérica: se
 * um bloco futuro precisar nascer recolhido, o padrão já é conhecido pelos
 * três consumidores que têm de concordar — o render (que arrow desenhar), o
 * toggle de uma chave (`_t` nas telas) e o "recolher/expandir tudo". Se o
 * toggle não soubesse do padrão, o primeiro clique no bloco calcularia
 * `!undefined === true` e o "expandir" recolheria o que já estava recolhido.
 */
export function nasceRecolhido(chave: string): boolean {
  return false;
}

/** Um bloco está recolhido quando o estado diz que sim — ou, sem estado, quando nasce recolhido. */
export function estaColapsado(colapso: Record<string, boolean>, chave: string): boolean {
  return colapso[chave] ?? nasceRecolhido(chave);
}

/** Inverte o estado de colapso de uma chave, respeitando o padrão de quem nasce recolhido. */
export function alternarColapso(colapso: Record<string, boolean>, chave: string): Record<string, boolean> {
  return { ...colapso, [chave]: !estaColapsado(colapso, chave) };
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
  const recolhido = estaColapsado(colapso, chaveToggle);
  return html`
    <tr class=${`${classe} ${ehCusto ? 'custo' : 'receita'}`}>
      <td class="c1">
        ${podeToggle ? html`
          <button class="toggle" @click=${() => toggle(chaveToggle)} aria-expanded=${!recolhido}>
            <span class="seta">${recolhido ? '▸' : '▾'}</span>${nome}
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
 * Tabela mensal do fluxo — reconstruída pela #349 para conter só o que o autor
 * pediu: **Receita Bruta (VGV) com as divisões por grupo de Receitas · os 5
 * tipos de Custos · o Fluxo ao final**.
 *
 * Saíram daqui (eram "as várias linhas desnecessárias" da issue): o bloco
 * Vendas contratadas (com desconto comercial e venda líquida), os 6
 * "Componente · …" de receita, as duas linhas "Auditoria · …" e o bloco
 * Carteira de clientes com seus 3 componentes. Continuam existindo no motor
 * (`FluxoCalc`) e nos testes — o que mudou é que não são mais despejados
 * nesta tabela.
 *
 * As duas linhas que **ficaram** entre a Receita Bruta e o Custo Total
 * ("(-) Impostos e deduções sobre a receita" e "= Receita Líquida do
 * Projeto") não são decoração: sem elas a tabela não fecha, porque quem
 * alimenta o Fluxo é a receita LÍQUIDA (`receitaMensal`), não a bruta. Só
 * aparecem quando existe alguma dedução — sem RET e sem permuta financeira as
 * duas grandezas são a mesma e as linhas seriam ruído.
 *
 * `funding` (#349) substitui a tabela separada "Programa Financeiro (Capital
 * Stack)", removida: entradas viram um bloco de receita e saídas entram
 * dentro de "Custos Financeiros", que já era uma das 5 categorias. Com
 * `null` (estudo sem camadas) a tabela renderiza exatamente como sem funding.
 */
export function tabelaFluxo(
  c: FluxoCalc,
  dataInicio: string | null,
  colapso: Record<string, boolean>,
  toggle: (chave: string) => void,
  funding: FundingNoFluxo | null = null,
): TemplateResult {
  const somaLinhas = (linhas: LinhaCalc[]): number[] => {
    const out = new Array<number>(c.prazo).fill(0);
    for (const l of linhas) for (let i = 0; i < c.prazo; i++) out[i] += l.mensal[i];
    return out;
  };
  const custosPorGrupo = (g: string) => c.linhasCusto.filter((x) => x.grupo === g);
  // Ordem das 5 abas de Custos (#125): Terreno · Obra · Diretos · Indiretos · Financeiro.
  // #349: `financeiro` também aparece quando o estudo não tem linha de custo
  // financeiro própria mas TEM funding — é lá que as saídas de funding moram.
  const grupos = GRUPOS_CUSTO.filter((g) =>
    custosPorGrupo(g).length > 0 || (g === 'financeiro' && funding !== null));
  // VPL é linear no fluxo mensal, então o VPL de um agregado = Σ VPL das suas linhas (#126).
  const somaVpl = (linhas: LinhaCalc[]): number => linhas.reduce((s, l) => s + l.vpl, 0);
  const totalSerie = (serie: number[]): number => serie.reduce((s, v) => s + v, 0);

  // #349: linhas de funding que entram no grupo `financeiro`, e o quanto elas
  // acrescentam ao total daquele grupo e ao Custo Total — sem isso os
  // subtotais não bateriam com as linhas listadas abaixo deles.
  const saidasFunding = funding?.linhasSaida ?? [];
  const saidasFundingMensal = funding?.saidas ?? new Array<number>(c.prazo).fill(0);
  const custoMensalComFunding = c.custoMensal.map((v, i) => v + (saidasFundingMensal[i] ?? 0));
  const vplSaidasFunding = saidasFunding.reduce((s, l) => s + l.vpl, 0);
  const totalSaidasFunding = saidasFunding.reduce((s, l) => s + l.total, 0);

  // A receita que alimenta o Fluxo é a LÍQUIDA; a bruta é o VGV recebido. A
  // diferença (RET + permuta financeira) vira uma linha-ponte, e só existe
  // quando é diferente de zero.
  const receitaLiquidaMensal = c.receitaMensal;
  const deducoesMensal = receitaLiquidaMensal.map((v, i) => v - (c.receitaBrutaMensal[i] ?? 0));
  const totalDeducoes = totalSerie(deducoesMensal);
  const temDeducoes = Math.abs(totalDeducoes) > 0.005;

  // Rodapé: com funding, o Fluxo passa a ser o ALAVANCADO (o que o autor pediu
  // ao mandar refletir o funding na tabela principal) e o livre — que é o que
  // TIR/VPL/Payback continuam usando, §8.1 — fica visível na linha de cima.
  const fluxoMensalExib = funding?.fluxoMensal ?? c.fluxoMensal;
  const fluxoAcumuladoExib = funding?.fluxoAcumulado ?? c.fluxoAcumulado;
  const vplExib = c.vpl + (funding?.vplLiquido ?? 0);

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
          ${linhaTabela('grupo', 'receita-bruta', 'Receita Bruta — VGV',
            { mensal: c.receitaBrutaMensal, total: c.receitaBruta, vpl: somaVpl(c.linhasReceitaBruta) },
            dataInicio, colapso, toggle, false, c.vgvVendavel, true)}
          ${!colapso['receita-bruta'] ? c.linhasReceitaBruta.map((l) => html`
            ${linhaTabela('subgrupo', `rb${l.id}`,
              `Grupo · ${l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome}`,
              l, dataInicio, colapso, toggle, false, c.vgvVendavel)}
            ${!colapso[`rb${l.id}`] ? (l.itens ?? []).map((t) =>
              linhaTabela('subitem', '', t.nome, t, dataInicio, colapso, toggle, false, c.vgvVendavel)) : nothing}
          `) : nothing}

          ${temDeducoes ? html`
            ${linhaTabela('subgrupo', '', '(-) Impostos e deduções sobre a receita',
              { mensal: deducoesMensal, total: totalDeducoes },
              dataInicio, colapso, toggle, false, c.vgvVendavel, true, false)}
            ${linhaTabela('subgrupo', '', '= Receita Líquida do Projeto',
              { mensal: receitaLiquidaMensal, total: totalSerie(receitaLiquidaMensal), vpl: somaVpl(c.linhasReceita) },
              dataInicio, colapso, toggle, false, c.vgvVendavel, true, false)}
          ` : nothing}

          ${funding ? html`
            ${linhaTabela('grupo', 'funding-capital', 'Funding — Capital (entradas)',
              { mensal: funding.entradas, total: totalSerie(funding.entradas),
                vpl: funding.linhasEntrada.reduce((s, l) => s + l.vpl, 0) },
              dataInicio, colapso, toggle, false, c.vgvVendavel, true)}
            ${!colapso['funding-capital'] ? funding.linhasEntrada.map((l) =>
              linhaTabela('subgrupo', '', l.nome, l, dataInicio, colapso, toggle, false, c.vgvVendavel, true, false)) : nothing}
          ` : nothing}

          ${linhaTabela('grupo', '', 'Custo Total',
            { mensal: custoMensalComFunding, total: totalSerie(custoMensalComFunding), vpl: somaVpl(c.linhasCusto) + vplSaidasFunding }, dataInicio, colapso, toggle, true, c.receitaBrutaVgv, false, false)}
          ${grupos.map((g) => {
            const doGrupo = custosPorGrupo(g);
            // #349: as saídas de funding pertencem a "Custos Financeiros" — o
            // subtotal do grupo tem que somá-las, senão não bate com as linhas.
            //
            // ⚠️ #426 — "Custos Financeiros" NÃO significa o mesmo aqui e na
            // aba Resultados, e a diferença é de propósito:
            //   · aqui (aba Fluxo de Caixa) a visão é de CAIXA, e por isso as
            //     DUAS pontas do funding aparecem: a liberação no bloco
            //     "Funding — Capital (entradas)" logo acima, e o serviço da
            //     dívida neste subtotal. O principal devolvido cancela o
            //     principal liberado; os juros e o saldo devedor remanescente,
            //     não — as duas pontas NÃO se anulam;
            //   · na proforma (`proforma-avancado.ts`) a visão é ECONÔMICA,
            //     antes de decidir como o projeto é capitalizado, e NENHUMA
            //     ponta entra: lá o rótulo vale só as linhas de custo que o
            //     usuário classificou no grupo `financeiro`.
            // Quem quiser ler o efeito do funding lê esta aba, não aquela.
            // Esta tabela NÃO muda com a #426.
            const ehFinanceiroComFunding = g === 'financeiro' && saidasFunding.length > 0;
            const mensalGrupo = ehFinanceiroComFunding
              ? somaLinhas(doGrupo).map((v, i) => v + (saidasFundingMensal[i] ?? 0))
              : somaLinhas(doGrupo);
            const totalGrupo = doGrupo.reduce((s, x) => s + x.total, 0) + (ehFinanceiroComFunding ? totalSaidasFunding : 0);
            const vplGrupo = somaVpl(doGrupo) + (ehFinanceiroComFunding ? vplSaidasFunding : 0);
            return html`
            ${linhaTabela('subgrupo', `custo-${g}`, GRUPO_CUSTO_LABEL[g],
              { mensal: mensalGrupo, total: totalGrupo, vpl: vplGrupo }, dataInicio, colapso, toggle, true, c.receitaBrutaVgv)}
            ${!colapso[`custo-${g}`] ? html`
              ${doGrupo.map((x) => linhaTabela('item', '', x.nome, x, dataInicio, colapso, toggle, true, c.receitaBrutaVgv))}
              ${ehFinanceiroComFunding ? saidasFunding.map((l) =>
                linhaTabela('item', '', l.nome, l, dataInicio, colapso, toggle, true, c.receitaBrutaVgv)) : nothing}
            ` : nothing}
          `;})}

          <tr class="divisoria"><td class="c1"></td><td class="c2"></td><td class="c3"></td><td class="c4"></td><td class="c5"></td>${c.meses.map(() => html`<td></td>`)}</tr>
          ${linhaResultado('Fluxo de Caixa Mensal', fluxoMensalExib, vplExib)}
          ${linhaResultado('Fluxo de Caixa Acumulado', fluxoAcumuladoExib, vplExib)}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Chaves de colapso de todos os grupos expansíveis (para "recolher/expandir
 * tudo"). `funding` é aceito por compatibilidade de assinatura dos dois
 * chamadores (`tela-fluxo-ver.ts`, `tela-cenarios.ts`) mas não é mais
 * consultado: o bloco de detalhamento de financiamento à produção que
 * consumia essa informação saiu da tabela (#472, decisão D12) — a
 * informação continua nas linhas de funding dentro de Custos Financeiros.
 */
export function chavesColapso(c: FluxoCalc, funding?: FundingNoFluxo | null): string[] {
  return chavesColapsoBase(c);
}

function chavesColapsoBase(c: FluxoCalc): string[] {
  // #349: sumiram `vendas-contratadas`, `carteira-clientes`, `receita-liquida`
  // e os `vc*` junto com os blocos que a tabela deixou de ter; entrou
  // `funding-capital`, que substitui as 3 chaves da tabela separada de
  // Capital Stack (`CHAVES_COLAPSO_CAPITAL_STACK`, removida com ela).
  return ['receita-bruta', 'funding-capital',
    'custo-terreno', 'custo-obra', 'custo-diretos', 'custo-indireto', 'custo-financeiro',
    ...c.linhasReceitaBruta.map((l) => `rb${l.id}`)];
}
