// Exportação de relatórios a partir da própria UI/formatação do app (§6.3).
// PDF: abre uma janela com HTML formatado (mesmos tokens/estilos) e chama print
// (o usuário salva como PDF). Excel: gera CSV (pt-BR, separador ';').
import type { Proforma } from './proforma.js';
import type { FluxoCalc, LinhaCalc } from './fluxo-caixa-motor.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';
import { fundingEntradasSaidasMensal, type ResultadoCapitalStack } from './capital-stack-motor.js';

const pct1 = (v: number) => v.toFixed(1).replace('.', ',');

function baixar(nome: string, conteudo: string, mime: string) {
  const blob = new Blob(['﻿' + conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface LinhaPf { l: string; v: number; }

export function linhasProforma(p: Proforma, lot: boolean): LinhaPf[] {
  // Espelha a estrutura da tabela da Proforma (#8/#9/#10/#13): totais consolidados
  // como header do grupo, "Deduções sobre VGV", permuta física R/NR e sem o memo
  // "Permuta física entregue".
  const temPermuta = p.areaPermutaFisica > 0.005;
  const deducoesVgv = p.imposto + p.corretagem + p.marketing + p.permutaFinResidencial + p.permutaFinNaoResidencial;
  const linhas: (LinhaPf & { soLot?: boolean; soInc?: boolean; ocultarSeZero?: boolean })[] = [
    ...(temPermuta ? [
      { l: 'VGV sem permuta física', v: p.vgv + p.vgvPermutaResidencial + p.vgvPermutaNaoResidencial },
      { l: '(-) Permuta física residencial', v: p.vgvPermutaResidencial, ocultarSeZero: true },
      { l: '(-) Permuta física não residencial', v: p.vgvPermutaNaoResidencial, soInc: true, ocultarSeZero: true },
    ] : []),
    { l: 'Receita bruta (VGV)', v: p.vgv },
    { l: '= Deduções sobre VGV', v: deducoesVgv },
    { l: '(-) Imposto', v: p.imposto },
    { l: '(-) Corretagem', v: p.corretagem },
    { l: '(-) Marketing', v: p.marketing },
    { l: '(-) Permuta financeira residencial', v: p.permutaFinResidencial, ocultarSeZero: true },
    { l: '(-) Permuta financeira não residencial', v: p.permutaFinNaoResidencial, ocultarSeZero: true },
    { l: '= Receita líquida', v: p.receitaLiquida },
    { l: '= Custo direto total', v: p.custoDiretoTotal },
    { l: '(-) Terreno', v: p.custoTerreno },
    { l: '(-) Projetos e aprovação', v: p.projetos },
    { l: '(-) Infraestrutura', v: p.infraestrutura, soLot: true },
    { l: '(-) Outorga', v: p.outorga, soInc: true },
    { l: '(-) Incorporação e registro', v: p.incorporacaoRegistro, soInc: true },
    { l: '(-) Construção', v: p.construcao, soInc: true },
    { l: '(-) Gestão da construção', v: p.gestaoConstrucao, soInc: true },
    { l: '(-) Decoração', v: p.decoracao, soInc: true },
    { l: '(-) Manutenção pós-obra', v: p.manutencao },
    { l: '(-) Contingências', v: p.contingencias, ocultarSeZero: true },
    { l: '= Receita operacional', v: p.receitaOperacional },
    { l: '= Custo indireto total', v: p.custoIndiretoTotal },
    { l: '(-) Marketing global e estrutura', v: p.marketingGlobal },
    { l: '(-) Gestão e outros custos indiretos', v: p.gestaoIndiretos },
    { l: '= Resultado', v: p.resultado },
  ];
  return linhas.filter((r) =>
    !(r.soLot && !lot) && !(r.soInc && lot) && !(r.ocultarSeZero && Math.abs(r.v) < 0.005));
}

export function exportarExcel(estudo: any, p: Proforma, lot: boolean) {
  const linhas = linhasProforma(p, lot);
  const rows: string[] = [];
  rows.push('Estudo;' + (estudo.nome_exibicao || estudo.nome));
  rows.push('Tipo;' + estudo.tipo_empreendimento);
  rows.push('');
  rows.push('Linha;R$;% VGV');
  for (const r of linhas) {
    const pct = p.vgv > 0 ? pct1(Math.abs(r.v) / p.vgv * 100) : '';
    rows.push(`${r.l};${fmtR$(r.v, false)};${pct}`);
  }
  rows.push('');
  rows.push(`Margem líquida (%);${pct1(p.margemLiquidaPct)}`);
  const nome = (estudo.id_legivel || 'estudo') + '_proforma.csv';
  baixar(nome, rows.join('\n'), 'text/csv;charset=utf-8');
}

export function exportarPDF(estudo: any, p: Proforma, lot: boolean) {
  const linhas = linhasProforma(p, lot);
  const linhasHtml = linhas.map((r) => {
    const sub = r.l.startsWith('=');
    const pct = p.vgv > 0 ? fmtPct(Math.abs(r.v) / p.vgv * 100) : '—';
    return `<tr class="${sub ? 'sub' : ''}"><td>${r.l}</td><td class="v">${fmtR$(r.v)}</td><td class="v">${pct}</td></tr>`;
  }).join('');

  const kpis = lot
    ? [['Área vendável', `${fmtNum(p.areaVendavel)} m²`], ['VGV', fmtR$(p.vgv)], ['Eficiência', fmtPct(p.eficienciaPct)], ['Margem líquida', fmtPct(p.margemLiquidaPct)]]
    : [['Área privativa', `${fmtNum(p.areaPrivativa)} m²`], ['VGV', fmtR$(p.vgv)], ['Custo obras/VGV', fmtPct(p.custoObrasVgvPct)], ['Margem líquida', fmtPct(p.margemLiquidaPct)]];

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
    @media print { button { display: none; } }
  </style></head><body>
    <h1>${estudo.nome_exibicao || estudo.nome}</h1>
    <div class="sub-h">${estudo.tipo_empreendimento} · ${estudo.status} · Estudo de Viabilidade — UrbiVerso</div>
    <div class="kpis">${kpis.map(([r, v]) => `<div class="kpi"><div class="r">${r}</div><div class="v">${v}</div></div>`).join('')}</div>
    <table><thead><tr><td>Linha</td><td class="v">R$</td><td class="v">% VGV</td></tr></thead>
    <tbody>${linhasHtml}<tr class="sub"><td>Margem líquida</td><td class="v">${fmtPct(p.margemLiquidaPct)}</td><td class="v"></td></tr></tbody></table>
    <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html); w.document.close();
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

interface LinhaFx {
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
}

/** Achata o fluxo calculado na hierarquia da tabela (grupos → itens). */
function linhasFluxo(c: FluxoCalc): LinhaFx[] {
  const soma = (xs: LinhaCalc[]): number[] => {
    const out = new Array<number>(c.prazo).fill(0);
    for (const l of xs) for (let i = 0; i < c.prazo; i++) out[i] += l.mensal[i];
    return out;
  };
  // VPL é linear no fluxo mensal, então o VPL de um agregado = Σ VPL das suas linhas (#126).
  const somaVpl = (xs: LinhaCalc[]): number => xs.reduce((s, l) => s + l.vpl, 0);
  const vgv = c.receitaBrutaVgv;
  const pct = (total: number) => (vgv > 0 ? (total / vgv) * 100 : undefined);
  const linhas: LinhaFx[] = [];
  // #229: rótulo corrigido — `c.receitaMensal` é o RECEBIMENTO LÍQUIDO que
  // entra no fluxo (pós-imposto, #228), não "Receita Bruta"; "VGV" também
  // confundia, já que o denominador do % é `vgv` (VGV vendável), não este
  // valor. Detalhamento completo de bruto/desconto/líquido/imposto é #241.
  linhas.push({
    nivel: 0, nome: 'Receita', custo: false,
    total: c.receitaMensal.reduce((s, v) => s + v, 0), vpl: somaVpl(c.linhasReceita), mensal: c.receitaMensal,
  });
  // #283: séries econômicas do contrato canônico. Carteira é estoque, por
  // isso a coluna Total mostra o pico, enquanto as demais linhas são fluxos.
  linhas.push(
    { nivel: 1, nome: 'Principal recebido', custo: false, total: c.principalRecebidoMensal.reduce((s, v) => s + v, 0), mensal: c.principalRecebidoMensal },
    { nivel: 1, nome: 'Juros de clientes', custo: false, total: c.jurosClientes, mensal: c.jurosClientesMensal },
    { nivel: 1, nome: 'Repasse', custo: false, total: c.repasseMensal.reduce((s, v) => s + v, 0), mensal: c.repasseMensal },
    { nivel: 1, nome: 'Carteira de clientes (pico)', custo: false, total: c.carteiraClientesMaxima, mensal: c.carteiraClientesMensal },
  );
  for (const l of c.linhasReceita) {
    linhas.push({
      nivel: 1, nome: l.faseLabel ? `${l.nome} (${l.faseLabel})` : l.nome, custo: false,
      inicio: l.inicio, duracao: l.duracao, total: l.total, vpl: l.vpl, mensal: l.mensal, pctVgv: pct(l.total),
    });
    for (const t of l.itens ?? []) {
      linhas.push({ nivel: 2, nome: t.nome, custo: false, inicio: t.inicio, duracao: t.duracao, total: t.total, vpl: t.vpl, mensal: t.mensal, pctVgv: pct(t.total) });
    }
  }
  linhas.push({
    nivel: 0, nome: 'Custo Total', custo: true, separadorAntes: true,
    total: c.custoMensal.reduce((s, v) => s + v, 0), vpl: somaVpl(c.linhasCusto), mensal: c.custoMensal,
    pctVgv: pct(c.custoMensal.reduce((s, v) => s + v, 0)),
  });
  for (const g of ['terreno', 'obra', 'diretos', 'indireto', 'financeiro'] as const) {
    const itens = c.linhasCusto.filter((x) => x.grupo === g);
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
  linhas.push({
    nivel: 0, nome: 'Fluxo de Caixa Mensal', custo: false, separadorAntes: true,
    total: c.fluxoMensal.reduce((s, v) => s + v, 0), vpl: c.vpl, mensal: c.fluxoMensal,
  });
  linhas.push({
    nivel: 0, nome: 'Fluxo de Caixa Acumulado', custo: false,
    total: c.fluxoAcumulado[c.prazo - 1] ?? 0, vpl: c.vpl, mensal: c.fluxoAcumulado,
  });
  return linhas;
}

/** Item 2 (docs/viabilidade/funding-capital-stack.md §10): mesmas linhas que `tabelaCapitalStack` (fluxo-tabela.ts) — nenhuma soma refeita, `fundingEntradasSaidasMensal` é a única fonte. */
function linhasCapitalStack(r: ResultadoCapitalStack, camadas: { nome: string; tipo: string }[], fluxoLivreMensal: number[]): LinhaFx[] {
  const prazo = fluxoLivreMensal.length;
  const a0 = (serie: number[]): number[] => serie.slice(1, prazo + 1);
  const nomesPorTipo = (tipo: string) => camadas.filter((x) => x.tipo === tipo).map((x) => x.nome);
  const somaPorNomes = (nomes: string[], rec: Record<string, number[]>): number[] => {
    const out = new Array<number>(prazo).fill(0);
    for (const nome of nomes) { const s = rec[nome]; if (!s) continue; for (let i = 0; i < prazo; i++) out[i] += s[i + 1] ?? 0; }
    return out;
  };
  const somaDuas = (a: number[], b: number[]): number[] => a.map((v, i) => v + b[i]);
  const total = (mensal: number[]) => mensal.reduce((s, v) => s + v, 0);
  const nomesDivida = [...nomesPorTipo('financiamento_producao'), ...nomesPorTipo('capital_giro')];
  const nomesPE = nomesPorTipo('preferred_equity');

  const { entradas, saidas } = fundingEntradasSaidasMensal(r);
  const entradas0 = a0(entradas);
  const saidas0 = a0(saidas);
  const fluxoLiquidoFunding = entradas0.map((v, i) => v - saidas0[i]);
  const fluxoAposFunding = fluxoLivreMensal.map((v, i) => v + fluxoLiquidoFunding[i]);
  const caixaFinal = a0(r.caixaProjetoMensal);

  const linhas: LinhaFx[] = [
    { nivel: 0, nome: 'Funding — Entradas', custo: false, separadorAntes: true, total: total(entradas0), mensal: entradas0 },
    { nivel: 1, nome: 'Financiamento à produção — liberações', custo: false, total: total(somaPorNomes(nomesPorTipo('financiamento_producao'), r.liberacaoPorInstrumento)), mensal: somaPorNomes(nomesPorTipo('financiamento_producao'), r.liberacaoPorInstrumento) },
    { nivel: 1, nome: 'Capital de giro — liberações', custo: false, total: total(somaPorNomes(nomesPorTipo('capital_giro'), r.liberacaoPorInstrumento)), mensal: somaPorNomes(nomesPorTipo('capital_giro'), r.liberacaoPorInstrumento) },
    { nivel: 1, nome: 'Equity preferencial — aportes', custo: false, total: total(somaPorNomes(nomesPE, r.aportePorInstrumentoPE)), mensal: somaPorNomes(nomesPE, r.aportePorInstrumentoPE) },
    { nivel: 1, nome: 'Sponsor Equity — aportes', custo: false, total: total(a0(r.aporteSponsorMensal)), mensal: a0(r.aporteSponsorMensal) },
    { nivel: 0, nome: 'Funding — Saídas', custo: true, separadorAntes: true, total: total(saidas0), mensal: saidas0 },
    { nivel: 1, nome: 'Juros e taxas de dívida', custo: true, total: total(somaPorNomes(nomesDivida, r.jurosPorInstrumento)), mensal: somaPorNomes(nomesDivida, r.jurosPorInstrumento) },
    { nivel: 1, nome: 'Amortização de principal', custo: true, total: total(somaPorNomes(nomesDivida, r.amortizacaoPorInstrumento)), mensal: somaPorNomes(nomesDivida, r.amortizacaoPorInstrumento) },
    { nivel: 1, nome: 'Devolução de Preferred Equity', custo: true, total: total(somaPorNomes(nomesPE, r.devolucaoPrincipalPE)), mensal: somaPorNomes(nomesPE, r.devolucaoPrincipalPE) },
    { nivel: 1, nome: 'Retorno preferencial', custo: true, total: total(somaPorNomes(nomesPE, r.remuneracaoPagaPE)), mensal: somaPorNomes(nomesPE, r.remuneracaoPagaPE) },
    { nivel: 1, nome: 'Participações sobre receita/residual', custo: true, total: total(somaDuas(somaPorNomes(nomesPE, r.participacaoReceitaPE), somaPorNomes(nomesPE, r.participacaoResidualPE))), mensal: somaDuas(somaPorNomes(nomesPE, r.participacaoReceitaPE), somaPorNomes(nomesPE, r.participacaoResidualPE)) },
    { nivel: 1, nome: 'Distribuições ao sponsor', custo: true, total: total(a0(r.distribuicaoSponsorMensal)), mensal: a0(r.distribuicaoSponsorMensal) },
    { nivel: 0, nome: 'Fluxo Líquido de Funding', custo: false, separadorAntes: true, total: total(fluxoLiquidoFunding), mensal: fluxoLiquidoFunding },
    { nivel: 0, nome: 'Fluxo após Funding', custo: false, total: total(fluxoAposFunding), mensal: fluxoAposFunding },
    { nivel: 0, nome: 'Caixa Final', custo: false, total: caixaFinal[caixaFinal.length - 1] ?? 0, mensal: caixaFinal },
    { nivel: 0, nome: 'Saldos', custo: false, separadorAntes: true, total: 0, mensal: new Array<number>(prazo).fill(0) },
    ...nomesDivida.map((nome): LinhaFx => ({ nivel: 1, nome: `Dívida — ${nome}`, custo: false, total: total(somaPorNomes([nome], r.saldoDividaPorInstrumento)), mensal: somaPorNomes([nome], r.saldoDividaPorInstrumento) })),
    ...nomesPE.map((nome): LinhaFx => ({ nivel: 1, nome: `Capital preferencial não devolvido — ${nome}`, custo: false, total: total(somaPorNomes([nome], r.capitalNaoDevolvidoPorInstrumentoPE)), mensal: somaPorNomes([nome], r.capitalNaoDevolvidoPorInstrumentoPE) })),
    ...nomesPE.map((nome): LinhaFx => ({ nivel: 1, nome: `Retorno preferencial acumulado — ${nome}`, custo: false, total: total(somaPorNomes([nome], r.remuneracaoAcumuladaPorInstrumentoPE)), mensal: somaPorNomes([nome], r.remuneracaoAcumuladaPorInstrumentoPE) })),
    { nivel: 1, nome: 'Lacuna de funding', custo: false, total: total(a0(r.lacunaFundingMensal)), mensal: a0(r.lacunaFundingMensal) },
  ];
  return linhas;
}

export interface CapitalStackExport {
  resultado: ResultadoCapitalStack;
  camadas: { nome: string; tipo: string }[];
}

export function exportarFluxoCSV(estudo: any, c: FluxoCalc, dataInicio: string | null, capitalStack?: CapitalStackExport) {
  const rows: string[] = [];
  rows.push('Estudo;' + (estudo.nome_exibicao || estudo.nome));
  rows.push('Nível;Avançado');
  rows.push('');
  rows.push(['Linha', 'Início', 'Duração', 'Total', 'VPL', '% VGV', ...c.meses].join(';'));
  const linhas = capitalStack
    ? [...linhasFluxo(c), ...linhasCapitalStack(capitalStack.resultado, capitalStack.camadas, c.fluxoMensal)]
    : linhasFluxo(c);
  for (const l of linhas) {
    if (l.separadorAntes) rows.push('');
    const indent = '  '.repeat(l.nivel);
    rows.push([
      indent + l.nome,
      l.duracao ? rotuloMesRelativo(dataInicio, l.inicio!) : '',
      l.duracao ? `${l.duracao}m` : '',
      fmtR$(l.total, false),
      l.vpl !== undefined ? fmtR$(l.vpl, false) : '',
      l.pctVgv !== undefined ? pct1(l.pctVgv) : '',
      ...l.mensal.map((v) => (Math.abs(v) < 0.005 ? '' : fmtR$(v, false))),
    ].join(';'));
  }
  rows.push('');
  rows.push(`TIR (% a.a.);${c.tir === null ? '' : pct1(c.tir)}`);
  rows.push(`VPL;${fmtR$(c.vpl, false)}`);
  rows.push(`Payback;${c.paybackData ?? ''}`);
  rows.push(`Exposição Máxima;${fmtR$(c.exposicaoMaxima, false)}`);
  // #241: as três grandezas de contratação (#227/#229) — mesmo cálculo-base
  // da tela (tooltip do KPI "VGV Vendável", fluxo-tabela.ts), nunca antes
  // exportadas.
  rows.push(`Venda Bruta Contratada;${fmtR$(c.vendaBrutaContratada, false)}`);
  rows.push(`Desconto Comercial;${fmtR$(c.descontoComercial, false)}`);
  rows.push(`Venda Líquida Contratada;${fmtR$(c.vendaLiquidaContratada, false)}`);
  rows.push(`Juros de Clientes;${fmtR$(c.jurosClientes, false)}`);
  rows.push(`Carteira Máxima;${fmtR$(c.carteiraClientesMaxima, false)}`);
  rows.push(`Mês da Carteira Máxima;${c.mesCarteiraClientesMaxima === null ? '' : c.meses[c.mesCarteiraClientesMaxima] ?? `M${c.mesCarteiraClientesMaxima + 1}`}`);
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
  capitalStack?: CapitalStackExport,
): boolean {
  const POR_PAGINA = 18; // colunas por página (paisagem)
  const linhas = capitalStack
    ? [...linhasFluxo(c), ...linhasCapitalStack(capitalStack.resultado, capitalStack.camadas, c.fluxoMensal)]
    : linhasFluxo(c);
  const kpis: [string, string][] = [
    ['TIR', c.tir === null ? '—' : `${fmtPct(c.tir)} a.a.`],
    ['VPL', fmtR$(c.vpl)],
    ['Payback', c.paybackData ?? '—'],
    ['Exposição Máx.', fmtR$(c.exposicaoMaxima)],
    // #241: mesmo cálculo-base da tela (tooltip do KPI "VGV Vendável").
    ['Venda Bruta Contratada', fmtR$(c.vendaBrutaContratada)],
    ['Desconto Comercial', fmtR$(c.descontoComercial)],
    ['Venda Líquida Contratada', fmtR$(c.vendaLiquidaContratada)],
    ['Juros de Clientes', fmtR$(c.jurosClientes)],
    ['Carteira Máxima', fmtR$(c.carteiraClientesMaxima)],
  ];
  const cab = `
    <h1>${estudo.nome_exibicao || estudo.nome}</h1>
    <div class="sub-h">Fluxo de Caixa (Avançado) · ${estudo.tipo_empreendimento} · Estudo de Viabilidade — UrbiVerso</div>
    <div class="kpis">${kpis.map(([r, v]) => `<div class="kpi"><div class="r">${r}</div><div class="v">${v}</div></div>`).join('')}</div>`;

  const fmtCel = (v: number, custo: boolean) => {
    if (!v || Math.abs(v) < 0.005) return '';
    const abs = fmtR$(Math.abs(v), false);
    return custo || v < 0 ? `(${abs})` : abs;
  };

  const paginas: string[] = [];
  for (let p = 0; p * POR_PAGINA < c.prazo; p++) {
    const ini = p * POR_PAGINA;
    const fim = Math.min(ini + POR_PAGINA, c.prazo);
    const ths = c.meses.slice(ini, fim).map((m) => `<th>${m}</th>`).join('');
    const trs = linhas.map((l) => {
      const cls = l.nivel === 0 ? 'g0' : l.nivel === 1 ? 'g1' : 'g2';
      const tds = l.mensal.slice(ini, fim).map((v) => `<td class="v">${fmtCel(v, l.custo)}</td>`).join('');
      return `<tr class="${cls}"><td class="nome">${'&nbsp;&nbsp;'.repeat(l.nivel)}${l.nome}</td>
        <td class="v">${l.duracao ? rotuloMesRelativo(dataInicio, l.inicio!) : ''}</td>
        <td class="v">${l.duracao ? `${l.duracao}m` : ''}</td>
        <td class="v">${fmtCel(l.total, l.custo)}</td>
        <td class="v">${l.vpl !== undefined ? fmtCel(l.vpl, l.custo) : ''}</td>
        <td class="v">${l.pctVgv !== undefined ? `${pct1(l.pctVgv)}%` : ''}</td>${tds}</tr>`;
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
