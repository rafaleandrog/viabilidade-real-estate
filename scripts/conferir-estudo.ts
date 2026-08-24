/**
 * Conferência de contas de um estudo, contra a instância viva.
 *
 *     URBI_BASE=https://homolog.urbiverso.com.br \
 *     URBI_TOKEN=<token> \
 *     node --import tsx/esm scripts/conferir-estudo.ts <id> [<id> ...]
 *
 * Por que este script existe: **o backend do app não calcula nada**. Todas as
 * rotas são CRUD sobre `req.dados` e devolvem apenas INPUTS — não existe `GET`
 * de fluxo, proforma, TIR ou VPL, e o `schema.json` não tem uma coluna
 * derivada sequer. Conferir número, portanto, exige puxar os inputs pela API e
 * **reexecutar os motores do próprio repo** (funções puras, sem DOM).
 *
 * O `FluxoConfig` montado aqui é cópia literal de `frontend/tela-fluxo-ver.ts`
 * (`_carregar` + `_recalcular`); o `ProformaInput`, de `frontend/tela-proforma.ts`
 * (`_entrada`). Se um dos dois mudar, este script mente — mantenha-os juntos.
 *
 * ⚠️ O token NUNCA é embutido nem impresso: vem só de `process.env.URBI_TOKEN`.
 * ⚠️ Só emite `GET`. A credencial de auditoria *pode* escrever (a flag
 *    `somente_leitura` é falsa e imutável) — a postura é disciplina, não trava.
 *
 * #474 (Passos 23–25, D-Q03 2026-08-22): a montagem `resultadoFinal →
 * fundingDoEstudo` logo abaixo (`:141-142`) é LOCAL — o app não tem uma
 * função única para essa sequência
 * (`docs/viabilidade/inteligencia-evi-incorporacao.md:1584-1594`). Cada
 * consumidor remonta à mão e pode divergir (R-A36); fonte única foi
 * CONSIDERADA E RECUSADA pelo autor — ver
 * `docs/viabilidade/fluxo-investidor-formulas.md` §9. Os outros quatro:
 * frontend/tela-fluxo-ver.ts:179 · frontend/tela-funding.ts:216 ·
 * frontend/tela-cenarios.ts:240 · frontend/tela-resumo.ts:182 (só remonta
 * resultadoFinal, não chama fundingDoEstudo).
 */

import { calcularFluxo, type FluxoCalc, type FluxoConfig } from '../frontend/fluxo-caixa-motor.js';
import { calcularProforma, type ProformaInput } from '../frontend/proforma.js';
import {
  fundingDoEstudo, receitaLiquidaComCorretagemMensal,
  type FundingCalc, type OperacaoFunding,
} from '../frontend/funding-motor.js';
import { proformaAvancado } from '../frontend/proforma-avancado.js';
import {
  mesRepasse, areaPrivativaTotalLinhas, absorcaoMensal, pctPosChavesDerivado,
  type EventoCrono,
} from '../frontend/fluxo-shared.js';
import {
  validarFluxoCalc, validarProduto, validarContratacao, validarSafrasReceita,
  validarFunding, validarPermutaFisica, validarCustosDuplicados, validarReconciliacaoCamadas,
  permutaFisicaPorTipologia,
  type Divergencia,
} from '../frontend/fluxo-invariantes.js';

const BASE = process.env.URBI_BASE || 'https://homolog.urbiverso.com.br';
const TOKEN = process.env.URBI_TOKEN || '';
if (!TOKEN) {
  console.error('Defina URBI_TOKEN no ambiente (nunca em arquivo).');
  process.exit(2);
}

/** Único verbo permitido. Erro de rede/HTTP vira `{ _http }` para o chamador decidir. */
async function GET(rota: string): Promise<any> {
  const r = await fetch(`${BASE}/api/viabilidade${rota}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  const txt = await r.text();
  let body: any;
  try { body = JSON.parse(txt); } catch { body = { _naoJson: txt.slice(0, 200) }; }
  if (!r.ok) return { _http: r.status, ...body };
  return body;
}

const n = (v: any): number => Number(v ?? 0) || 0;
const R$ = (v: number): string =>
  (v < 0 ? '-' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface Conferencia {
  id: number;
  nivel: string;
  nome: string;
  estudo: any;
  proforma: ReturnType<typeof calcularProforma> | null;
  calc: FluxoCalc | null;
  funding: FundingCalc | null;
  divergencias: Divergencia[];
  /** Checagens aritméticas próprias deste script (não são invariantes do app). */
  contas: { rotulo: string; esperado: number; obtido: number; delta: number; ok: boolean }[];
  brutos: Record<string, any>;
}

export async function conferir(id: number): Promise<Conferencia> {
  const estudo = await GET(`/estudos/${id}`);
  const cfg = await GET('/config');
  const produtos = (await GET(`/estudos/${id}/preliminar/produtos`))?.dados ?? [];
  const nivel = estudo?.nivel_analise ?? estudo?.nivel ?? '?';

  const out: Conferencia = {
    id, nivel, nome: estudo?.nome ?? '?', estudo,
    proforma: null, calc: null, funding: null, divergencias: [], contas: [], brutos: {},
  };

  // ── Preliminar: só a proforma (tela-proforma.ts:168) ──
  const entrada = {
    ...estudo,
    aliquota_ret_pct: Number(cfg?.parametros?.aliquota_ret_pct) || 4,
    produtos,
  } as ProformaInput;
  out.proforma = calcularProforma(entrada);

  if (nivel !== 'avancado') return out;

  // ── Avançado: o FluxoConfig de tela-fluxo-ver.ts:103-147 ──
  const [receitas, custos, curvas, crono, params, operacoes, tipologias] = await Promise.all([
    GET(`/estudos/${id}/avancado/receitas`),
    GET(`/estudos/${id}/avancado/custos`),
    GET('/avancado/curvas'),
    GET(`/estudos/${id}/avancado/cronograma`),
    GET(`/estudos/${id}/avancado/parametros`),
    GET(`/estudos/${id}/avancado/funding`),
    GET(`/estudos/${id}/avancado/tipologias`),
  ]);

  const d = {
    receitas: receitas?.erro || receitas?._http ? [] : (receitas.dados || []),
    custos: custos?.erro || custos?._http ? [] : (custos.dados || []),
    curvas: curvas?.erro || curvas?._http ? [] : (curvas.dados || []),
    tipologias: tipologias?.erro || tipologias?._http ? [] : (tipologias.dados || []),
    crono: (crono?.erro || crono?._http ? [] : (crono.dados || [])) as EventoCrono[],
    dataInicio: params?.erro || params?._http ? null : (params.data_inicio_projeto ?? null),
    taxa: params?.erro || params?._http ? 12 : Number(params.taxa_desconto_aa ?? 12),
    ret: params?.erro || params?._http
      ? { ativo: false, pct: 4 }
      : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
  };
  const ops: OperacaoFunding[] = (operacoes?.erro || operacoes?._http ? [] : (operacoes.dados || []));
  out.brutos = { ...d, operacoes: ops, params };

  const config: FluxoConfig = {
    dataInicio: d.dataInicio,
    taxaDescontoAa: d.taxa,
    cronograma: d.crono,
    linhasReceita: d.receitas,
    linhasCusto: d.custos,
    curvas: d.curvas,
    areaTerreno: Number(estudo?.terreno_manual_area) || Number(estudo?.area_terreno_nucleo) || 0,
    ret: d.ret,
    // #473: default true preserva o comportamento histórico (VGV bruto).
    corretagemSobrePermutaFisica: estudo?.corretagem_sobre_permuta_fisica !== false,
    // #446: o horizonte precisa cobrir a quitação das operações, senão a série
    // é cortada e `saldoFinal` exibe um saldo truncado.
    operacoesFunding: ops,
  };
  const calc = calcularFluxo(config);
  out.calc = calc;

  // #445: içada para fora do `if` — a checagem (b) de `validarFunding` a
  // usa mesmo com `out.funding` nulo.
  let receitaLiquida: number[] | undefined;
  if (ops.length > 0) {
    receitaLiquida = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, d.custos);
    const resultadoFinal = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] ?? 0;
    out.funding = fundingDoEstudo(
      ops, calc.fluxoMensal, receitaLiquida, resultadoFinal, mesRepasse(d.crono), d.taxa,
      { custosRaw: d.custos, linhasCusto: calc.linhasCusto, cronograma: d.crono },
    );
  }

  out.divergencias = [
    ...validarProduto(d.receitas, d.custos, d.tipologias, d.crono, calc.prazo),
    ...validarPermutaFisica(d.custos, d.tipologias),
    ...validarCustosDuplicados(d.custos),
    ...validarContratacao(d.receitas, d.crono, calc.prazo, calc.vendaBrutaContratada, undefined, d.custos),
    ...validarSafrasReceita(d.receitas, d.crono, calc.prazo, undefined, d.custos),
    ...validarFluxoCalc(calc),
    ...(out.funding ? validarFunding(out.funding, calc.fluxoMensal, undefined, receitaLiquida) : []),
    // #441: reconciliação Catálogo × Premissas.
    ...validarReconciliacaoCamadas(estudo, d.custos, d.tipologias),
  ];

  // ── Contas próprias (b): o que TEM que somar ──
  const conta = (rotulo: string, esperado: number, obtido: number, tol = 0.01) =>
    out.contas.push({ rotulo, esperado, obtido, delta: obtido - esperado, ok: Math.abs(obtido - esperado) <= tol });

  // VGV do catálogo × VGV das linhas de receita × VGV do motor
  const vgvCatalogo = d.tipologias.reduce((s: number, t: any) => s + n(t.quantidade) * n(t.area_privativa_m2) * n(t.preco_m2), 0);
  const vgvLinhas = d.receitas.reduce((s: number, l: any) =>
    s + (l.tipologias ?? []).reduce((a: number, t: any) => a + n(t.quantidade) * n(t.area_privativa_m2) * n(t.preco_m2), 0), 0);
  conta('VGV Σ tipologias do catálogo → vgvTotal do motor', vgvCatalogo, calc.vgvTotal);
  conta('VGV Σ alocações nas linhas → vgvTotal do motor', vgvLinhas, calc.vgvTotal);

  // Unidades: catálogo × alocado + permutado
  for (const t of d.tipologias) {
    const alocado = d.receitas.reduce((s: number, l: any) =>
      s + (l.tipologias ?? []).filter((a: any) => Number(a.tipologia_id) === Number(t.id))
        .reduce((a: number, x: any) => a + n(x.quantidade), 0), 0);
    const permutado = d.custos.filter((c: any) => Number(c.permuta_tipologia_id) === Number(t.id))
      .reduce((s: number, c: any) => s + n(c.permuta_quantidade), 0);
    conta(`unidades "${t.nome}" (alocado ${alocado} + permutado ${permutado}) vs estoque`, n(t.quantidade), alocado + permutado);
  }

  // Absorção: cada linha tem que fechar 100% no calendário efetivo do motor
  for (const l of d.receitas) {
    const abs = absorcaoMensal(l.absorcao ?? { modo: 'linear' }, d.crono);
    const soma = abs ? abs.pcts.reduce((a, b) => a + b, 0) : NaN;
    conta(`absorção efetiva "${l.nome}" (modo=${l.absorcao?.modo})`, 100, soma, 0.01);
    const blocos = (l.absorcao?.blocos ?? []);
    const somaBlocos = blocos.reduce((a: number, b: any) => a + n(b.pct), 0);
    const posGravado = blocos.find((b: any) => b.evento === 'pos_obra');
    if (posGravado) {
      conta(`pós-chaves "${l.nome}": pct GRAVADO vs DERIVADO (100−pre−lanc−obra)`,
        pctPosChavesDerivado(blocos), n(posGravado.pct));
    }
    void somaBlocos;
    // Σ participacaoPct dos componentes canônicos
    const comp = l.fluxo_pagamento?.componentes;
    if (Array.isArray(comp)) {
      conta(`Σ participacaoPct "${l.nome}"`, 100, comp.reduce((a: number, c: any) => a + n(c.participacaoPct), 0));
    }
    // Σ do legado (entrada + parcelas), que é o que a UI ainda edita
    const ent = (l.fluxo_pagamento?.entrada ?? []).reduce((a: number, e: any) => a + n(e.pct), 0);
    const par = (l.fluxo_pagamento?.parcelas ?? []).reduce((a: number, e: any) => a + n(e.pct), 0);
    conta(`Σ legado entrada+parcelas "${l.nome}"`, 100, ent + par);
  }

  // Custos: Σ das séries por linha vs Σ da série mensal consolidada
  const somaLinhasCusto = calc.linhasCusto.reduce((s: number, l: any) => s + l.mensal.reduce((a: number, b: number) => a + b, 0), 0);
  const somaCustoMensal = calc.custoMensal.reduce((a: number, b: number) => a + b, 0);
  conta('Σ linhasCusto[].mensal vs Σ custoMensal', somaCustoMensal, somaLinhasCusto);

  // Fluxo: receita − custo = fluxo, mês a mês
  let maxDeltaFluxo = 0;
  for (let i = 0; i < calc.prazo; i++) {
    maxDeltaFluxo = Math.max(maxDeltaFluxo, Math.abs((calc.receitaMensal[i] - calc.custoMensal[i]) - calc.fluxoMensal[i]));
  }
  conta('max |receitaMensal − custoMensal − fluxoMensal|', 0, maxDeltaFluxo);

  return out;
}

// ── Relatório ──
function imprimir(c: Conferencia) {
  console.log('');
  console.log('━'.repeat(78));
  console.log(`ESTUDO ${c.id} — ${c.nome}  [${c.nivel}]`);
  console.log('━'.repeat(78));

  if (c.proforma) {
    const p: any = c.proforma;
    console.log('PROFORMA (motor do Preliminar)');
    console.log(`  VGV .................. ${R$(p.vgv)}`);
    console.log(`  Receita líquida ...... ${R$(p.receitaLiquida)}`);
    console.log(`  Custo direto ......... ${R$(p.custoDiretoTotal)}`);
    console.log(`  Custo indireto ....... ${R$(p.custoIndiretoTotal)}`);
    console.log(`  Investimento total ... ${R$(p.investimentoTotal)}`);
    console.log(`  Resultado ............ ${R$(p.resultado)}`);
    console.log(`  Margem líquida ....... ${(p.margemLiquidaPct ?? 0).toFixed(2)}%`);
    console.log(`  ROI .................. ${(p.roiPct ?? 0).toFixed(2)}%`);
  }

  if (c.calc) {
    const k = c.calc;
    const areaPriv = areaPrivativaTotalLinhas(k.linhasReceita.length ? c.brutos.receitas : []);
    // Desalavancada nos dois lados desde o conserto do D14 — a função não
    // recebe mais `funding`. Ver a nota do topo de `proforma-avancado.ts`.
    const pa = proformaAvancado(k, areaPriv);
    console.log('FLUXO (motor do Avançado)');
    console.log(`  prazo ................ ${k.prazo} meses  (início ${c.brutos.dataInicio}, taxa ${c.brutos.taxa}% a.a.)`);
    console.log(`  VGV potencial ........ ${R$(k.vgvTotal)}`);
    console.log(`  VGV vendável ......... ${R$(k.vgvVendavel)}`);
    console.log(`  VGV permuta física ... ${R$(k.vgvPermutaFisica)}`);
    console.log(`  Venda bruta contrat. . ${R$(k.vendaBrutaContratada)}`);
    console.log(`  Desconto comercial ... ${R$(k.descontoComercial)}`);
    console.log(`  Venda líq. contrat. .. ${R$(k.vendaLiquidaContratada)}`);
    console.log(`  Receita bruta (caixa)  ${R$(k.receitaBruta)}`);
    console.log(`  Receita líquida ...... ${R$(k.receitaMensal.reduce((a, b) => a + b, 0))}`);
    console.log(`  Custo total .......... ${R$(k.custoMensal.reduce((a, b) => a + b, 0))}`);
    console.log(`  Resultado (acum.) .... ${R$(k.fluxoAcumulado[k.fluxoAcumulado.length - 1] ?? 0)}`);
    console.log(`  VPL .................. ${R$(k.vpl)}`);
    console.log(`  TIR .................. ${k.tir === null ? 'n/d' : k.tir.toFixed(2) + '% a.a.'}`);
    console.log(`  Payback .............. ${k.paybackData ?? 'n/d'} (mês ${k.paybackMes === null ? '—' : k.paybackMes + 1})`);
    console.log(`  Exposição máxima ..... ${R$(k.exposicaoMaxima)}`);
    console.log(`  Juros de clientes .... ${R$(k.jurosClientes)}`);
    console.log(`  Carteira máxima ...... ${R$(k.carteiraClientesMaxima)} (mês ${k.mesCarteiraClientesMaxima === null ? '—' : k.mesCarteiraClientesMaxima + 1})`);
    console.log(`  Repasse Σ ............ ${R$(k.repasseMensal.reduce((a, b) => a + b, 0))}`);
    console.log(`  [proformaAvancado] resultado ${R$(pa.resultado)} · margem ${pa.margemPct.toFixed(2)}% · ROI ${pa.roiPct.toFixed(2)}%`);
  }

  if (c.funding) {
    const f = c.funding.noFluxo;
    console.log('FUNDING');
    for (const s of c.funding.operacoes) {
      const ent = s.entradas.reduce((a, b) => a + b, 0);
      const sai = s.saidas.reduce((a, b) => a + b, 0);
      console.log(`  ${s.operacao.tipo} "${s.operacao.nome}": entradas ${R$(ent)} · saídas ${R$(sai)} · custo ${R$(sai - ent)}`);
    }
    console.log(`  fluxo alavancado final ${R$(f.fluxoAcumulado[f.fluxoAcumulado.length - 1] ?? 0)} · VPL líq. funding ${R$(f.vplLiquido)}`);
    console.log(`  mín. do alavancado ... ${R$(Math.min(...f.fluxoAcumulado))}`);
  }

  console.log('CONTAS');
  for (const t of c.contas) {
    console.log(`  ${t.ok ? 'ok  ' : 'FALHA'} ${t.rotulo}: esperado ${t.esperado.toFixed(2)} · obtido ${t.obtido.toFixed(2)} · Δ ${t.delta.toFixed(2)}`);
  }

  console.log(`INVARIANTES DO APP — ${c.divergencias.length} divergência(s)`);
  for (const d of c.divergencias) {
    const num = Number.isFinite(d.esperado) && Number.isFinite(d.encontrado)
      ? `  [esperado ${d.esperado} · encontrado ${d.encontrado} · Δ ${d.diferenca}]` : '';
    console.log(`  [${d.severidade}] ${d.codigo}${d.linha ? ' · ' + d.linha : ''}${d.mes !== undefined ? ' · mês ' + (d.mes + 1) : ''}: ${d.mensagem}${num}`);
  }
}

// Só roda o CLI quando ESTE arquivo é o ponto de entrada — o módulo também é
// importado por scripts de análise, que só querem `conferir()`.
const ehEntrada = /conferir-estudo\.ts$/.test(String(process.argv[1] ?? '').replace(/\\/g, '/'));
if (ehEntrada) {
  const ids = process.argv.slice(2).map(Number).filter((x) => Number.isFinite(x));
  if (ids.length === 0) {
    console.error('uso: node --import tsx/esm scripts/conferir-estudo.ts <id> [<id> ...]');
    process.exit(2);
  }
  console.log(`HOST ${BASE}`);
  for (const id of ids) {
    imprimir(await conferir(id));
  }
}
