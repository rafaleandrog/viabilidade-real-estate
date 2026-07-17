// Exportação de relatórios a partir da própria UI/formatação do app (§6.3).
// PDF: abre uma janela com HTML formatado (mesmos tokens/estilos) e chama print
// (o usuário salva como PDF). Excel: gera CSV (pt-BR, separador ';').
import type { Proforma } from './proforma.js';
import { fmtR$, fmtNum, fmtPct } from './viab-format.js';

const R$ = (v: number) => v.toFixed(2).replace('.', ',');
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
    rows.push(`${r.l};${R$(r.v)};${pct}`);
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
