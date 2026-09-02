// Exportação de relatórios a partir da própria UI/formatação do app (§6.3).
// PDF: abre uma janela com HTML formatado (mesmos tokens/estilos) e chama print
// (o usuário salva como PDF). Excel: gera CSV (pt-BR, separador ';').
//
// #443: "Margem sobre VGV" (era "Margem líquida") — `p.margemLiquidaPct` é
// SEMPRE do Preliminar aqui (`p: Proforma`, o tipo de `proforma.ts`), a leitura
// `resultado / vgv`. O Avançado tem sua PRÓPRIA "Margem sobre Receita Bruta"
// (`proforma-avancado.ts`), com denominador diferente — ver
// `frontend/rotulos-indicador.ts` para o inventário completo.
import type { Proforma } from './proforma.js';
// #349: `ROTULOS_COMPONENTES_*` saíram daqui junto com os blocos "Componente ·
// …" e Carteira, que a exportação deixou de listar para espelhar a tabela.
// Continuam exportados pelo motor e usados por quem ainda os precisa.
import { type FluxoCalc, type LinhaCalc } from './fluxo-caixa-motor.js';
import { rotuloMesRelativo, DEDUCOES_RECEITA_EH_CUSTO } from './fluxo-shared.js';
import { fmtR$, fmtNum, fmtPct, fmtPctOuIndef, celula as celulaCompartilhada } from './viab-format.js';
import { type FundingNoFluxo, type FormatoLinhaFinanciamento } from './funding-motor.js';
import type { Divergencia, PermutaFisicaTipologia } from './fluxo-invariantes.js';

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob(['﻿' + conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * O que a NOTAÇÃO de uma linha da Proforma precisa saber sobre ela. Estrutural
 * de propósito: a `Linha` da tela (`frontend/tela-proforma.ts`) é assinável a
 * este tipo sem conversão, e é o que permite a tela e a exportação passarem
 * pela mesma função.
 */
export interface NotacaoLinha {
  v: number;
  tipo?: 'receita' | 'consolidado' | 'resultado';
  natureza?: 'receita';
}

// #567: receita (VGV, sub-linhas de produto, consolidados marcados
// `natureza: 'receita'`) e resultado mostram o SINAL REAL — negativo entre
// parênteses, positivo sem marca nenhuma. Toda outra linha (custo/dedução,
// inclusive os headers `tipo: 'consolidado'` sem `natureza`, como "Custo
// direto total") é notação contábil pura: SEMPRE entre parênteses,
// independente do sinal — a app grava custo como valor positivo.
//
// ⚠️ ESTAS DUAS FUNÇÕES MORAM AQUI, e não em `tela-proforma.ts`, pela mesma
// razão de `avisoPermutaCapada` logo abaixo: **a direção que o grafo de
// imports já tem**. A tela importa este módulo (`exportarPDF`/`exportarExcel`);
// se a notação ficasse lá, a exportação teria de importar a tela e o ciclo se
// fecharia. A tela as reexporta, para quem já as importava de lá continuar
// funcionando.
export function ehLinhaReceitaOuResultado(r: Pick<NotacaoLinha, 'tipo' | 'natureza'>): boolean {
  return r.tipo === 'receita' || r.natureza === 'receita' || r.tipo === 'resultado';
}

/**
 * Célula monetária da Proforma — TELA, CSV e PDF. Delega para `celula`
 * (`frontend/viab-format.ts`), a mesma fonte única de 2 casas decimais (C7) e
 * da regra de parênteses que o Fluxo de Caixa usa desde a #449.
 *
 * `sempreExibir` porque a Proforma controla visibilidade por LINHA
 * (`ocultarSeZero`), não por célula perto de zero: um header como "Custo
 * indireto total" que fecha em zero precisa mostrar "(0,00)", não sumir.
 *
 * Sem símbolo "R$" — o cabeçalho da coluna já o informa, nos três destinos.
 */
export function celulaProforma(r: NotacaoLinha): string {
  return celulaCompartilhada(r.v, { comParenteses: true, custo: !ehLinhaReceitaOuResultado(r), sempreExibir: true });
}

/**
 * Uma linha do relatório da Proforma. `nota: true` marca a linha de TEXTO — o
 * rótulo carrega a mensagem inteira e não há número nas colunas R$/% VGV.
 *
 * `tipo`/`natureza` são os MESMOS campos da `Linha` da tela, e existem aqui
 * pelo mesmo motivo: são eles que decidem a notação de sinal da célula. Sem
 * eles, o CSV e o PDF formatavam com `fmtR$` cru — uma Receita operacional
 * negativa saía `-R$ …` no arquivo e `(…)` na tela, sobre o mesmo número
 * (achado 10 da auditoria #574).
 */
interface LinhaPf extends NotacaoLinha { l: string; nota?: boolean; }

/**
 * A frase do excedente de permuta física, ÚNICA para a tela e para as duas
 * exportações.
 *
 * Ela mora aqui, e não em `tela-proforma.ts`, por causa da direção que o grafo
 * de imports já tem: a tela importa este módulo (para os botões de exportar) e
 * o contrário criaria ciclo. Mora numa função, e não duplicada nos três
 * lugares, porque foi exatamente a divergência tela × exportação que a revisão
 * apontou — o banner avisava do corte e o CSV/PDF saíam com a permuta efetiva,
 * sem dizer que houve corte.
 *
 * Declara as três grandezas que o leitor precisa para conferir o corte:
 * a área informada (que NÃO é capada — as áreas exibidas seguem o que foi
 * digitado), o valor que ela pedia, e o valor que acabou considerado.
 *
 * ⚠️ A frase dizia "a receita bruta do catálogo é X", com X = permuta efetiva.
 * Isso valia enquanto o cap era GLOBAL: capado, o efetivo era exatamente o
 * catálogo inteiro. Com o cap por categoria (#570) as duas grandezas se
 * separaram — uma categoria pode capar enquanto a outra ainda tem folga, e aí
 * o efetivo é menor que o bruto do catálogo. Dizer "a receita bruta do catálogo
 * é X" passou a ser falso; o que X sempre foi, de fato, é o que entrou no
 * cálculo.
 */
export function avisoPermutaCapada(p: Proforma): string {
  const considerada = p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial;
  return `Permuta física informada (${fmtNum(p.areaPermutaFisica)} m²) vale `
    + `${fmtR$(p.vgvPermutaSolicitada)} e a permuta considerada é ${fmtR$(considerada)}. `
    + 'O excedente foi desconsiderado: cada categoria é capada no VGV bruto da própria categoria, '
    + 'e o VGV da categoria capada para em zero, nunca negativo; '
    + 'as áreas exibidas seguem as informadas.';
}

/**
 * Coluna "% VGV" de uma linha da Proforma — a MESMA regra da tela
 * (`_pctVgv`, `frontend/tela-proforma.ts`): no **Resultado** a fração leva o
 * SINAL (é a margem, e uma margem negativa não pode aparecer como positiva);
 * em toda outra linha é a MAGNITUDE sobre o VGV. Sem VGV, "—" nos três
 * destinos (#571).
 *
 * Antes da unificação a exportação usava `Math.abs` em TODAS as linhas: um
 * Resultado negativo saía com % positiva no CSV e no PDF, e negativa na tela.
 */
export function pctVgvProforma(r: NotacaoLinha, p: Proforma): string {
  if (p.vgv <= 0) return '—';
  return r.tipo === 'resultado'
    ? fmtPct(r.v / p.vgv * 100)
    : fmtPct(Math.abs(r.v) / p.vgv * 100);
}

export function linhasProforma(p: Proforma, lot: boolean): LinhaPf[] {
  // Espelha a estrutura da tabela da Proforma (#8/#9/#10/#13): totais consolidados
  // como header do grupo, "Deduções sobre VGV", permuta física R/NR e sem o memo
  // "Permuta física entregue".
  //
  // ⚠️ `tipo`/`natureza` de cada linha são os MESMOS de `montarLinhasProforma`
  // (`frontend/tela-proforma.ts`) — não é decoração, é o que decide a NOTAÇÃO
  // de sinal da célula. Uma linha que ganhar classificação diferente aqui passa
  // a sair do arquivo com sinal diferente do da tela, sobre o mesmo número;
  // o teste de paridade de `frontend/proforma-ordem-linhas.test.ts` compara as
  // duas listas célula a célula justamente por isso. Linha sem `tipo` nem
  // `natureza` é custo/dedução, e sai entre parênteses — inclusive
  // "VGV sem permuta física" e as duas de permuta física, como na tela.
  const temPermuta = p.areaPermutaFisica > 0.005;
  const deducoesVgv = p.imposto + p.corretagem + p.marketing + p.permutaFinResidencial + p.permutaFinNaoResidencial;
  const linhas: (LinhaPf & { soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean })[] = [
    // O aviso vem ANTES das linhas de permuta que ele explica. Sem ele o
    // relatório mostrava a permuta EFETIVA sem sinal nenhum do corte — quem
    // lesse o CSV veria um número menor que o informado nas Premissas e não
    // teria como saber por quê.
    ...(p.permutaCapada ? [{ l: avisoPermutaCapada(p), v: 0, nota: true }] : []),
    ...(temPermuta ? [
      { l: 'VGV sem permuta física', v: p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial, ocultarSeZero: true },
      // #574 (achado 7): rótulo espelha o que a tela já usa no Loteamento
      // (`tela-proforma.ts`, `montarLinhasProforma`) — não é rótulo novo, é a
      // exportação parar de divergir da tela.
      { l: lot ? '(-) Permuta física' : '(-) Permuta física residencial', v: p.vgvPermutaResidencial, ocultarSeZero: true },
      { l: '(-) Permuta física não residencial', v: p.vgvPermutaNaoResidencial, soInc: true, ocultarSeZero: true },
    ] : []),
    { l: 'Receita bruta (VGV)', v: p.vgv, tipo: 'receita' },
    { l: '= Deduções sobre VGV', v: deducoesVgv, tipo: 'consolidado' },
    { l: '(-) Imposto', v: p.imposto, ocultarSeZero: true },
    { l: '(-) Corretagem', v: p.corretagem, ocultarSeZero: true },
    { l: '(-) Marketing', v: p.marketing, ocultarSeZero: true },
    { l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, ocultarSeZero: true },
    { l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, ocultarSeZero: true },
    { l: '= Receita líquida', v: p.receitaLiquida, tipo: 'consolidado', natureza: 'receita' },
    { l: '= Custo direto total', v: p.custoDiretoTotal, tipo: 'consolidado' },
    { l: '(-) Terreno', v: p.custoTerreno, ocultarSeZero: true },
    { l: '(-) Projetos e aprovação', v: p.projetos, ocultarSeZero: true },
    { l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true, ocultarSeZero: true },
    { l: '(-) Outorga', v: p.outorga, soInc: true, ocultarSeZero: true },
    { l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true, ocultarSeZero: true },
    { l: '(-) Construção', v: p.construcao, soInc: true, ocultarSeZero: true },
    { l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true, ocultarSeZero: true },
    { l: '(-) Decoração', v: p.decoracao, soInc: true, ocultarSeZero: true },
    { l: '(-) Manutenção pós-obra', v: p.manutencao, ocultarSeZero: true },
    { l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true },
    { l: '= Receita operacional', v: p.receitaOperacional, tipo: 'consolidado', natureza: 'receita' },
    { l: '= Custo indireto total', v: p.custoIndiretoTotal, tipo: 'consolidado' },
    { l: '(-) Marketing global e estrutura', v: p.marketingGlobal, ocultarSeZero: true },
    { l: '(-) Gestão e outros custos indiretos', v: p.gestaoIndiretos, ocultarSeZero: true },
    { l: '= Resultado', v: p.resultado, tipo: 'resultado' },
  ];
  return linhas.filter((r) =>
    !(r.soLot && !lot) && !(r.soInc && lot) && !(r.ocultarSeZero && Math.abs(r.v) < 0.005));
}

/**
 * O CSV da Proforma, como texto — separado de `exportarExcel` para poder ser
 * conferido por teste. `exportarExcel` só faz o download, que precisa de
 * `Blob`/`document` e não existe fora do navegador; a decisão de o que vai no
 * arquivo é toda daqui.
 */
export function csvProforma(estudo: any, p: Proforma, lot: boolean): string {
  const linhas = linhasProforma(p, lot);
  const rows: string[] = [];
  rows.push('Estudo;' + (estudo.nome_exibicao || estudo.nome));
  rows.push('Tipo;' + estudo.tipo_empreendimento);
  rows.push('');
  rows.push('Linha;R$;% VGV');
  for (const r of linhas) {
    // Linha de nota: o texto ocupa a coluna do rótulo e as outras duas ficam
    // vazias. "0,00" ali seria um número inventado.
    if (r.nota) { rows.push(`${r.l};;`); continue; }
    // #571: "—", igual à tela (`_pctVgv`, tela-proforma.ts) e ao PDF logo
    // abaixo — antes saía vazio aqui, e vazio não é a mesma coisa que
    // indefinido para quem lê o CSV.
    rows.push(`${r.l};${celulaProforma(r)};${pctVgvProforma(r, p)}`);
  }
  rows.push('');
  rows.push(`Margem sobre VGV;${fmtPctOuIndef(p.margemLiquidaPct)}`);
  return rows.join('\n');
}

export function exportarExcel(estudo: any, p: Proforma, lot: boolean) {
  const nome = (estudo.id_legivel || 'estudo') + '_proforma.csv';
  baixar(nome, csvProforma(estudo, p, lot), 'text/csv;charset=utf-8');
}

/**
 * O documento HTML da Proforma que vira PDF — separado de `exportarPDF` pelo
 * mesmo motivo que `csvProforma`: `window.open`/`print` não existem fora do
 * navegador, e sem esta separação nenhum teste conseguia afirmar o que sai no
 * arquivo.
 */
export function htmlProforma(estudo: any, p: Proforma, lot: boolean): string {
  const linhas = linhasProforma(p, lot);
  const linhasHtml = linhas.map((r) => {
    // Linha de nota: uma célula só, atravessando as três colunas — não há
    // número para alinhar à direita.
    if (r.nota) return `<tr class="nota"><td colspan="3">${r.l}</td></tr>`;
    const sub = r.l.startsWith('=');
    return `<tr class="${sub ? 'sub' : ''}"><td>${r.l}</td><td class="v">${celulaProforma(r)}</td><td class="v">${pctVgvProforma(r, p)}</td></tr>`;
  }).join('');

  // #571: VGV ≤ 0 → "—", não "0,0%" (mesmo padrão do CSV e da tela).
  const kpis = lot
    // #613: era 'Eficiência' aqui e 'Vendável / gleba' na tela — o MESMO número
    // com dois nomes. O rótulo único é o da tela, e o inventário
    // `frontend/rotulos-indicador.ts` passou a travar o par (rótulo, fórmula).
    ? [['Área vendável', `${fmtNum(p.areaVendavel)} m²`], ['VGV', fmtR$(p.vgv)], ['Vendável / gleba', fmtPctOuIndef(p.eficienciaPct)], ['Margem sobre VGV', fmtPctOuIndef(p.margemLiquidaPct)]]
    : [['Área privativa', `${fmtNum(p.areaPrivativa)} m²`], ['VGV', fmtR$(p.vgv)], ['Custo obras/VGV', fmtPctOuIndef(p.custoObrasVgvPct)], ['Margem sobre VGV', fmtPctOuIndef(p.margemLiquidaPct)]];

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${estudo.nome_exibicao || estudo.nome}</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 18px; margin: 0 0 2px; } .sub-h { color: #666; font-size: 12px; margin-bottom: 18px; }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
    .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px; }
    .kpi .r { font-size: 10px; color: #666; text-transform: uppercase; } .kpi .v { font-size: 15px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; } td.v { text-align: right; font-variant-numeric: tabular-nums; }
    tr.sub td { font-weight: 700; border-top: 1px solid #bbb; }
    tr.nota td { font-size: 11px; font-style: italic; color: #8a5a00; background: #fdf5e3; }
    @media print { button { display: none; } }
  </style></head><body>
    <h1>${estudo.nome_exibicao || estudo.nome}</h1>
    <div class="sub-h">${estudo.tipo_empreendimento} · ${estudo.status} · Estudo de Viabilidade — UrbiVerso</div>
    <div class="kpis">${kpis.map(([r, v]) => `<div class="kpi"><div class="r">${r}</div><div class="v">${v}</div></div>`).join('')}</div>
    <table><thead><tr><td>Linha</td><td class="v">R$</td><td class="v">% VGV</td></tr></thead>
    <tbody>${linhasHtml}<tr class="sub"><td>Margem sobre VGV</td><td class="v">${fmtPctOuIndef(p.margemLiquidaPct)}</td><td class="v"></td></tr></tbody></table>
    <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
  </body></html>`;
  return html;
}

export function exportarPDF(estudo: any, p: Proforma, lot: boolean) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(htmlProforma(estudo, p, lot)); w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}

// ─────────────────────────────────────────────────────────────────
// Exportação do Fluxo de Caixa (nível Avançado)
// ─────────────────────────────────────────────────────────────────

// Rótulos e ordem espelham as 5 abas de Custos (#125): Terreno · Obra ·
// Diretos · Indiretos · Financeiro.
const GRUPO_CUSTO_ROTULO: Record<string, string> = {
  terreno: 'Custos do Terreno',
  obra: 'Custos de Obra',
  diretos: 'Custos Diretos',
  indireto: 'Custos Indiretos',
  financeiro: 'Custos Financeiros',
};

export interface LinhaFx {
  nivel: 0 | 1 | 2;
  nome: string;
  inicio?: number;
  duracao?: number;
  total: number;
  vpl?: number;
  mensal: number[];
  custo: boolean;
  separadorAntes?: boolean;
  // #189/#229: peso sobre o VGV Vendável (`receitaBrutaVgv`/`vgvVendavel`) —
  // undefined na própria linha de Receita e no Fluxo de Caixa Mensal/Acumulado
  // (linhas sem sentido para o indicador).
  pctVgv?: number;
  /**
   * §38: nem toda linha do detalhamento de financiamento à produção é
   * dinheiro — `% incorrido` é fração e `liberação habilitada` é sinal.
   * Ausente = `moeda`, o caso de todas as outras linhas do relatório.
   */
  formato?: FormatoLinhaFinanciamento;
  /** `true` nas linhas cuja coluna Total não teria significado (estoques, %, sinais). */
  ocultarTotal?: boolean;
}

/**
 * Célula do relatório, respeitando o formato da linha. Fonte ÚNICA para CSV e
 * PDF: as duas exportações têm de mostrar o mesmo texto, e antes desta função
 * cada uma tinha a sua própria expressão de formatação.
 */
export function celulaFx(v: number, l: Pick<LinhaFx, 'custo' | 'formato'>, comParenteses: boolean): string {
  return celulaCompartilhada(v, {
    comParenteses, custo: l.custo,
    formato: l.formato === 'moeda' ? undefined : l.formato,
  });
}

/**
 * Achata o fluxo calculado na hierarquia da tabela (grupos → itens).
 *
 * #349: espelha exatamente `tabelaFluxo` (fluxo-tabela.ts) — Receita Bruta
 * (VGV) com as divisões por grupo de Receitas · a ponte de deduções até a
 * Receita Líquida · os 5 tipos de Custos (com as saídas de funding dentro de
 * Custos Financeiros) · o Fluxo. Saíram daqui, junto com a tela, os blocos
 * Vendas contratadas, "Componente · …", "Auditoria · …" e Carteira de
 * clientes: o contrato desta app é que tela e arquivo mostrem as MESMAS
 * linhas, então reduzir só um dos dois seria reintroduzir a divergência que
 * a #241 tinha fechado.
 */
export function linhasFluxo(c: FluxoCalc, funding: FundingNoFluxo | null = null): LinhaFx[] {
  const soma = (xs: LinhaCalc[]): number[] => {
    const out = new Array<number>(c.prazo).fill(0);
    for (const l of xs) for (let i = 0; i < c.prazo; i++) out[i] += l.mensal[i];
    return out;
  };
  // VPL é linear no fluxo mensal, então o VPL de um agregado = Σ VPL das suas linhas (#126).
  const somaVpl = (xs: LinhaCalc[]): number => xs.reduce((s, l) => s + l.vpl, 0);
  const vgv = c.receitaBrutaVgv;
  const pct = (total: number) => (vgv > 0 ? (total / vgv) * 100 : undefined);
  const totalSerie = (serie: number[]) => serie.reduce((s, v) => s + v, 0);
  const linhas: LinhaFx[] = [];

  linhas.push({
    nivel: 0, nome: 'Receita Bruta — VGV', custo: false,
    total: c.receitaBruta, vpl: somaVpl(c.linhasReceitaBruta), mensal: c.receitaBrutaMensal,
  });
  for (const l of c.linhasReceitaBruta) {
    linhas.push({
      nivel: 1, nome: `Grupo · ${l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome}`, custo: false,
      inicio: l.inicio, duracao: l.duracao, total: l.total, vpl: l.vpl, mensal: l.mensal, pctVgv: pct(l.total),
    });
    for (const t of l.itens ?? []) {
      linhas.push({ nivel: 2, nome: t.nome, custo: false, inicio: t.inicio, duracao: t.duracao, total: t.total, vpl: t.vpl, mensal: t.mensal, pctVgv: pct(t.total) });
    }
  }

  // Ponte bruta → líquida: quem alimenta o Fluxo é a líquida. Só entra quando
  // há dedução (RET/permuta financeira); sem elas as duas são a mesma coisa.
  const deducoesMensal = c.receitaMensal.map((v, i) => v - (c.receitaBrutaMensal[i] ?? 0));
  const totalDeducoes = totalSerie(deducoesMensal);
  if (Math.abs(totalDeducoes) > 0.005) {
    linhas.push(
      // #591: `custo` é o espelho do `ehCusto` da tela — a mesma constante
      // compartilhada, para CSV/PDF não poderem divergir da tabela (#449). A
      // linha "= Receita Líquida do Projeto" continua `custo: false`: é um
      // total de receita, não uma redução.
      { nivel: 1, nome: '(-) Impostos e deduções sobre a receita', custo: DEDUCOES_RECEITA_EH_CUSTO, total: totalDeducoes, mensal: deducoesMensal },
      { nivel: 1, nome: '= Receita Líquida do Projeto', custo: false, total: totalSerie(c.receitaMensal), vpl: somaVpl(c.linhasReceita), mensal: c.receitaMensal },
    );
  }

  // #592 (O1/O2): as duas pontas do funding saíram do meio do relatório — as
  // entradas não vêm mais logo depois da Receita Líquida, e as saídas não
  // moram mais dentro de Custos Financeiros. As duas foram para o fim, entre
  // o Fluxo de Caixa Livre e o Fluxo de Caixa, exatamente como na tela
  // (`tabelaFluxo`, `frontend/fluxo-tabela.ts`).
  linhas.push({
    nivel: 0, nome: 'Custo Total', custo: true, separadorAntes: true,
    total: totalSerie(c.custoMensal), vpl: somaVpl(c.linhasCusto),
    mensal: c.custoMensal, pctVgv: pct(totalSerie(c.custoMensal)),
  });
  for (const g of ['terreno', 'obra', 'diretos', 'indireto', 'financeiro'] as const) {
    const itens = c.linhasCusto.filter((x) => x.grupo === g);
    // #592 (O1): sem linha do usuário, o grupo não aparece — nem `financeiro`,
    // que antes existia só para receber o serviço da dívida.
    if (itens.length === 0) continue;
    const totalGrupo = itens.reduce((s, x) => s + x.total, 0);
    linhas.push({
      nivel: 1, nome: GRUPO_CUSTO_ROTULO[g], custo: true,
      total: totalGrupo, vpl: somaVpl(itens), mensal: soma(itens), pctVgv: pct(totalGrupo),
    });
    for (const x of itens) {
      linhas.push({ nivel: 2, nome: x.nome, custo: true, inicio: x.inicio, duracao: x.duracao, total: x.total, vpl: x.vpl, mensal: x.mensal, pctVgv: pct(x.total) });
    }
  }

  // #472 (D12): o bloco de detalhamento de financiamento à produção saiu da
  // tabela principal (`fluxo-tabela.ts`) — a exportação acompanha, para não
  // divergir tela × arquivo (#449).

  // #592 (O3/O6) — o fecho em duas seções, ESPELHANDO `tabelaFluxo` linha a
  // linha. O Livre volta a aparecer aqui, com o VPL DESALAVANCADO (`c.vpl`),
  // que é o que TIR/VPL/Payback leem por §8.1; o Fluxo de Caixa carrega
  // `c.vpl + vplLiquido`. Sem funding sai só a segunda seção, com os rótulos e
  // o VPL de sempre — o relatório de um estudo sem funding não muda em nada.
  const vplLivre = c.vpl;
  // #512 — soma de dois valores já publicados é, ela mesma, valor publicado:
  // o C7 vale para ela. Sem o `round2` a soma de duas parcelas de 2 casas pode
  // reintroduzir fração (ruído binário de ponto flutuante), e este é o número
  // que a tela e o relatório mostram. Achado do revisor externo no PR da #512.
  const vplAlavancado = Math.round((c.vpl + (funding?.vplLiquido ?? 0)) * 100) / 100;
  if (funding) {
    linhas.push({
      nivel: 0, nome: 'Fluxo de Caixa Livre Mensal', custo: false, separadorAntes: true,
      total: totalSerie(c.fluxoMensal), vpl: vplLivre, mensal: c.fluxoMensal,
    });
    linhas.push({
      nivel: 0, nome: 'Fluxo de Caixa Livre Acumulado', custo: false,
      total: c.fluxoAcumulado[c.fluxoAcumulado.length - 1] ?? 0, vpl: vplLivre, mensal: c.fluxoAcumulado,
    });
    linhas.push({
      nivel: 0, nome: 'Funding — Capital (entradas)', custo: false, separadorAntes: true,
      total: totalSerie(funding.entradas), vpl: funding.linhasEntrada.reduce((s, l) => s + l.vpl, 0),
      mensal: funding.entradas,
    });
    for (const l of funding.linhasEntrada) {
      linhas.push({ nivel: 1, nome: l.nome, custo: false, total: l.total, vpl: l.vpl, mensal: l.mensal });
    }
    linhas.push({
      nivel: 0, nome: 'Funding — Serviço (saídas)', custo: true,
      total: totalSerie(funding.saidas), vpl: funding.linhasSaida.reduce((s, l) => s + l.vpl, 0),
      mensal: funding.saidas,
    });
    for (const l of funding.linhasSaida) {
      linhas.push({ nivel: 1, nome: l.nome, custo: true, total: l.total, vpl: l.vpl, mensal: l.mensal });
    }
  }
  const fluxoMensal = funding?.fluxoMensal ?? c.fluxoMensal;
  const fluxoAcumulado = funding?.fluxoAcumulado ?? c.fluxoAcumulado;
  linhas.push({
    nivel: 0, nome: 'Fluxo de Caixa Mensal', custo: false, separadorAntes: true,
    total: totalSerie(fluxoMensal), vpl: vplAlavancado, mensal: fluxoMensal,
  });
  linhas.push({
    nivel: 0, nome: 'Fluxo de Caixa Acumulado', custo: false,
    total: fluxoAcumulado[fluxoAcumulado.length - 1] ?? 0, vpl: vplAlavancado, mensal: fluxoAcumulado,
  });
  return linhas;
}

export function exportarFluxoCSV(
  estudo: any,
  c: FluxoCalc,
  dataInicio: string | null,
  funding: FundingNoFluxo | null = null,
  divergencias: Divergencia[] = [],
  permutaFisica: PermutaFisicaTipologia[] = [],
) {
  const rows: string[] = [];
  rows.push('Estudo;' + (estudo.nome_exibicao || estudo.nome));
  rows.push('Nível;Avançado');
  rows.push('');
  rows.push(['Linha', 'Início', 'Duração', 'Total', 'VPL', '% VGV', ...c.meses].join(';'));
  const linhas = linhasFluxo(c, funding);
  for (const l of linhas) {
    if (l.separadorAntes) rows.push('');
    const indent = '  '.repeat(l.nivel);
    rows.push([
      indent + l.nome,
      l.duracao ? rotuloMesRelativo(dataInicio, l.inicio!) : '',
      l.duracao ? `${l.duracao}m` : '',
      l.ocultarTotal ? '' : fmtR$(l.total, false),
      l.vpl !== undefined ? fmtR$(l.vpl, false) : '',
      l.pctVgv !== undefined ? fmtPct(l.pctVgv) : '',
      ...l.mensal.map((v) => celulaFx(v, l, false)),
    ].join(';'));
  }
  rows.push('');
  rows.push(`TIR (a.a.);${c.tir === null ? '' : fmtPct(c.tir)}`);
  rows.push(`VPL;${fmtR$(c.vpl, false)}`);
  rows.push(`Payback;${c.paybackData ?? ''}`);
  rows.push(`Exposição Máxima;${fmtR$(c.exposicaoMaxima, false)}`);
  // #241: as três grandezas de contratação (#227/#229) — mesmo cálculo-base
  // da tela (tooltip do KPI "VGV Vendável", fluxo-tabela.ts), nunca antes
  // exportadas.
  rows.push(`Venda Bruta Contratada;${fmtR$(c.vendaBrutaContratada, false)}`);
  rows.push(`Desconto Comercial;${fmtR$(c.descontoComercial, false)}`);
  rows.push(`Venda Líquida Contratada;${fmtR$(c.vendaLiquidaContratada, false)}`);
  rows.push(`Receita Bruta — VGV;${fmtR$(c.receitaBruta, false)}`);
  rows.push(`Juros de Clientes;${fmtR$(c.jurosClientes, false)}`);
  rows.push(`Carteira Máxima;${fmtR$(c.carteiraClientesMaxima, false)}`);
  rows.push(`Mês da Carteira Máxima;${c.mesCarteiraClientesMaxima === null ? '' : c.meses[c.mesCarteiraClientesMaxima] ?? `M${c.mesCarteiraClientesMaxima + 1}`}`);
  rows.push('');
  rows.push('Relatório de Reconciliação');
  rows.push('Código;Severidade;Linha;Safra;Mês;Esperado;Encontrado;Diferença;Mensagem');
  if (divergencias.length === 0) rows.push('OK;sucesso;;;;0;0;0;Todas as invariantes reconciliadas');
  for (const d of divergencias) rows.push([
    d.codigo, d.severidade, d.linha ?? '', d.safra ?? '',
    d.mes === undefined ? '' : d.mes + 1, d.esperado, d.encontrado, d.diferenca,
    d.mensagem.replaceAll(';', ','),
  ].join(';'));
  // #269: área e quantidade permutada por tipologia — mesma fonte da tela
  // (`permutaFisicaPorTipologia`), sem cálculo próprio da exportação.
  if (permutaFisica.length > 0) {
    rows.push('');
    rows.push('Permuta Física — Área e Quantidade por Tipologia');
    rows.push('Tipologia;Permutada;Catálogo;Área Permutada (m²)');
    for (const p of permutaFisica) rows.push([
      p.nome, p.quantidadePermutada, p.quantidadeTotal, fmtNum(p.areaPermutada),
    ].join(';'));
  }
  const nome = (estudo.id_legivel || 'estudo') + '_fluxo-caixa.csv';
  baixar(nome, rows.join('\n'), 'text/csv;charset=utf-8');
}

/** SVG (string) de barras do fluxo mensal para o PDF (tema claro). */
function svgFluxoMensal(c: FluxoCalc): string {
  const W = 1000; const H = 240; const padL = 70; const padR = 8; const padT = 12; const padB = 22;
  const gw = W - padL - padR; const gh = H - padT - padB;
  const maxAbs = Math.max(1, ...c.fluxoMensal.map((v) => Math.abs(v)));
  const x = (i: number) => padL + (i / c.prazo) * gw;
  const bw = Math.max(1, gw / c.prazo - 1);
  const y = (v: number) => padT + (1 - (v + maxAbs) / (2 * maxAbs)) * gh;
  const barras = c.fluxoMensal.map((v, i) =>
    `<rect x="${x(i).toFixed(1)}" y="${Math.min(y(v), y(0)).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(Math.abs(y(v) - y(0)), 0.5).toFixed(1)}" fill="${v >= 0 ? '#13a98d' : '#d45a3a'}"/>`).join('');
  const passo = Math.max(3, Math.round(c.prazo / 10));
  let eixo = `<line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="#999"/>`;
  for (let i = 0; i < c.prazo; i += passo) {
    eixo += `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="8" fill="#666" text-anchor="middle">${c.meses[i]}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${eixo}${barras}</svg>`;
}

/** SVG (string) do acumulado (linha) para o PDF (tema claro). */
function svgFluxoAcumulado(c: FluxoCalc): string {
  const W = 1000; const H = 240; const padL = 70; const padR = 8; const padT = 12; const padB = 22;
  const gw = W - padL - padR; const gh = H - padT - padB;
  const min = Math.min(0, ...c.fluxoAcumulado);
  const max = Math.max(1, ...c.fluxoAcumulado);
  const x = (i: number) => padL + (c.prazo <= 1 ? 0 : (i / (c.prazo - 1)) * gw);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * gh;
  const linha = c.fluxoAcumulado.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const passo = Math.max(3, Math.round(c.prazo / 10));
  let eixo = `<line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="#999" stroke-dasharray="4,3"/>`;
  for (let i = 0; i < c.prazo; i += passo) {
    eixo += `<text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="8" fill="#666" text-anchor="middle">${c.meses[i]}</text>`;
  }
  const payback = c.paybackMes !== null
    ? `<line x1="${x(c.paybackMes)}" y1="${padT}" x2="${x(c.paybackMes)}" y2="${H - padB}" stroke="#13a98d" stroke-dasharray="2,2"/>` +
      `<text x="${(x(c.paybackMes) + 3).toFixed(1)}" y="${padT + 10}" font-size="8" fill="#13a98d">Payback ${c.paybackData}</text>`
    : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${eixo}<path d="${linha}" fill="none" stroke="#111" stroke-width="1.5"/>${payback}</svg>`;
}

/**
 * PDF do fluxo. `rotuloColunas` nomeia a unidade das colunas no rodapé de cada
 * página — "Meses" na view mensal, "Anos" quando o fluxo vem agregado por ano
 * (#127). As colunas Início/Duração e os KPIs são sempre em meses.
 */
export function exportarFluxoPDF(
  estudo: any,
  c: FluxoCalc,
  dataInicio: string | null,
  rotuloColunas = 'Meses',
  funding: FundingNoFluxo | null = null,
  divergencias: Divergencia[] = [],
  permutaFisica: PermutaFisicaTipologia[] = [],
): boolean {
  const POR_PAGINA = 18; // colunas por página (paisagem)
  const linhas = linhasFluxo(c, funding);
  const kpis: [string, string][] = [
    ['TIR', c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`],
    ['VPL', fmtR$(c.vpl)],
    ['Payback', c.paybackData ?? '—'],
    ['Exposição Máx.', fmtR$(c.exposicaoMaxima)],
    // #241: mesmo cálculo-base da tela (tooltip do KPI "VGV Vendável").
    ['Venda Bruta Contratada', fmtR$(c.vendaBrutaContratada)],
    ['Desconto Comercial', fmtR$(c.descontoComercial)],
    ['Venda Líquida Contratada', fmtR$(c.vendaLiquidaContratada)],
    ['Receita Bruta — VGV', fmtR$(c.receitaBruta)],
    ['Juros de Clientes', fmtR$(c.jurosClientes)],
    ['Carteira Máxima', fmtR$(c.carteiraClientesMaxima)],
  ];
  const cab = `
    <h1>${estudo.nome_exibicao || estudo.nome}</h1>
    <div class="sub-h">Fluxo de Caixa (Avançado) · ${estudo.tipo_empreendimento} · Estudo de Viabilidade — UrbiVerso</div>
    <div class="kpis">${kpis.map(([r, v]) => `<div class="kpi"><div class="r">${r}</div><div class="v">${v}</div></div>`).join('')}</div>`;

  const fmtCel = (v: number, custo: boolean) => celulaFx(v, { custo }, true);

  const paginas: string[] = [];
  for (let p = 0; p * POR_PAGINA < c.prazo; p++) {
    const ini = p * POR_PAGINA;
    const fim = Math.min(ini + POR_PAGINA, c.prazo);
    const ths = c.meses.slice(ini, fim).map((m) => `<th>${m}</th>`).join('');
    const trs = linhas.map((l) => {
      const cls = l.nivel === 0 ? 'g0' : l.nivel === 1 ? 'g1' : 'g2';
      const tds = l.mensal.slice(ini, fim).map((v) => `<td class="v">${celulaFx(v, l, true)}</td>`).join('');
      return `<tr class="${cls}"><td class="nome">${'&nbsp;&nbsp;'.repeat(l.nivel)}${l.nome}</td>
        <td class="v">${l.duracao ? rotuloMesRelativo(dataInicio, l.inicio!) : ''}</td>
        <td class="v">${l.duracao ? `${l.duracao}m` : ''}</td>
        <td class="v">${l.ocultarTotal ? '' : fmtCel(l.total, l.custo)}</td>
        <td class="v">${l.vpl !== undefined ? fmtCel(l.vpl, l.custo) : ''}</td>
        <td class="v">${l.pctVgv !== undefined ? fmtPct(l.pctVgv) : ''}</td>${tds}</tr>`;
    }).join('');
    paginas.push(`
      <section class="pagina">
        ${cab}
        <div class="faixa">${rotuloColunas} ${ini + 1}–${fim} de ${c.prazo}</div>
        <table>
          <thead><tr><th class="nome">Linha</th><th>Início</th><th>Duração</th><th>Total</th><th>VPL</th><th>% VGV</th>${ths}</tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </section>`);
  }
  paginas.push(`
    <section class="pagina">
      ${cab}
      <h2>Fluxo de Caixa Mensal</h2>${svgFluxoMensal(c)}
      <h2>Fluxo de Caixa Acumulado</h2>${svgFluxoAcumulado(c)}
    </section>`);
  const linhasReconciliacao = divergencias.length
    ? divergencias.map((d) => `<tr class="${d.severidade === 'erro' ? 'div-erro' : 'div-alerta'}">
        <td class="nome">${d.codigo}</td><td>${d.severidade}</td><td>${d.linha ?? ''}</td>
        <td>${d.mes === undefined ? '' : d.mes + 1}</td><td>${d.esperado}</td>
        <td>${d.encontrado}</td><td>${d.diferenca}</td><td class="nome">${d.mensagem}</td></tr>`).join('')
    : '<tr><td class="nome" colspan="8">Todas as invariantes reconciliadas.</td></tr>';
  paginas.push(`
    <section class="pagina">
      ${cab}
      <h2>Relatório de Reconciliação</h2>
      <p>Erros indicam quebra de cálculo; alertas indicam premissas de risco.</p>
      <table><thead><tr><th class="nome">Código</th><th>Severidade</th><th>Linha</th><th>Mês</th>
        <th>Esperado</th><th>Encontrado</th><th>Diferença</th><th class="nome">Mensagem</th></tr></thead>
        <tbody>${linhasReconciliacao}</tbody></table>
    </section>`);

  // #269: mesma fonte da tela — sem cálculo próprio da exportação.
  if (permutaFisica.length > 0) {
    const linhasPermuta = permutaFisica.map((p) => `<tr>
        <td class="nome">${p.nome}</td><td>${fmtNum(p.quantidadePermutada)}</td>
        <td>${fmtNum(p.quantidadeTotal)}</td><td>${fmtNum(p.areaPermutada)} m²</td></tr>`).join('');
    paginas.push(`
    <section class="pagina">
      ${cab}
      <h2>Permuta Física — Área e Quantidade por Tipologia</h2>
      <table><thead><tr><th class="nome">Tipologia</th><th>Permutada</th><th>Catálogo</th><th>Área Permutada</th></tr></thead>
        <tbody>${linhasPermuta}</tbody></table>
    </section>`);
  }

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${estudo.nome_exibicao || estudo.nome} — Fluxo de Caixa</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'Inter', system-ui, sans-serif; color: #111; margin: 16px; }
    h1 { font-size: 15px; margin: 0 0 2px; } h2 { font-size: 12px; margin: 12px 0 6px; }
    .sub-h { color: #666; font-size: 10px; margin-bottom: 8px; }
    .kpis { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 4px 10px; }
    .kpi .r { font-size: 8px; color: #666; text-transform: uppercase; } .kpi .v { font-size: 11px; font-weight: 700; }
    .faixa { font-size: 9px; color: #666; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; }
    th, td { padding: 2px 4px; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap; }
    th.nome, td.nome { text-align: left; max-width: 190px; overflow: hidden; }
    th { color: #666; border-bottom: 1px solid #bbb; }
    tr.g0 td { font-weight: 700; border-top: 1px solid #bbb; }
    tr.g1 td { font-weight: 600; }
    tr.g2 td { color: #444; }
    tr.div-erro td { color: #a8321d; }
    tr.div-alerta td { color: #8a6200; }
    td.v { font-variant-numeric: tabular-nums; }
    section.pagina { page-break-after: always; }
    section.pagina:last-child { page-break-after: auto; }
    svg { width: 100%; height: auto; }
    @media print { button { display: none; } }
  </style></head><body>
    ${paginas.join('')}
    <button onclick="window.print()" style="margin-top:12px;padding:8px 16px">Imprimir / Salvar PDF</button>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html); w.document.close();
  setTimeout(() => w.print(), 400);
  return true;
}
