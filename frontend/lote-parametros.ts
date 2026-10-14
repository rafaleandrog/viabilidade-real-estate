// Parâmetros urbanísticos de um LOTE (coeficiente mínimo e máximo, gabarito máximo), guardados no
// schema do app (`lote_parametros`) e ligados ao lote do módulo imobiliário pelo id dele. Lógica pura
// da tela: carimbo de conferência, status do vínculo e conciliação de uma planilha com os lotes do
// módulo. O backend (`backend/rotas/lote-parametros.ts`) valida de novo: a fronteira real é lá.

export interface LoteNucleo {
  id: number; id_legivel?: string; rua?: string | null; numero_lote?: string | number | null;
  quadra?: string | null; conjunto?: string | null; area?: string | number | null;
  parcelamento_id?: number | null; removido_em?: string | null;
}

/** Tolerância de área entre o carimbo e o lote de hoje, e entre a planilha e o lote (m²). */
export const TOLERANCIA_AREA = 0.01;

/** Sem acento, sem caixa, espaços aparados e colapsados — "Barcelona " casa com "BARCELONA". */
export function normalizarTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Chave natural de um lote dentro de um conjunto de lotes: rua + número. Vazia sem uma das duas. */
export function chaveRuaNumero(rua: unknown, numero: unknown): string {
  const r = normalizarTexto(rua); const n = normalizarTexto(numero);
  return r && n ? `${r}|${n}` : '';
}

/** O carimbo que o app grava junto do vínculo: tirado dos campos-fonte do lote, nunca do `id_legivel`. */
export function carimboDoLote(l: LoteNucleo): Record<string, any> {
  return {
    parcelamento_id: l.parcelamento_id ?? null,
    rua: l.rua ?? null,
    numero_lote: l.numero_lote != null ? String(l.numero_lote) : null,
    quadra: l.quadra ?? null,
    conjunto: l.conjunto ?? null,
    area_m2: paraNumero(l.area),
  };
}

export type StatusVinculo = 'sem-dados' | 'ok' | 'area' | 'identificacao' | 'removido';

export const ROTULO_STATUS: Record<StatusVinculo, string> = {
  'sem-dados': 'Sem dados', ok: 'Conferido', area: 'Área mudou', identificacao: 'Lote mudou', removido: 'Lote removido',
};

/**
 * Confere o registro (carimbo) contra o lote de hoje. `identificacao` (parcelamento, rua, número,
 * quadra ou conjunto diferentes) e `removido` invalidam o vínculo; só a `area` diferente ALERTA —
 * pode ser retificação —, e o registro continua valendo.
 */
export function statusVinculo(registro: any | null | undefined, lote: LoteNucleo | null | undefined): StatusVinculo {
  if (!registro) return 'sem-dados';
  if (!lote || lote.removido_em) return 'removido';
  const c = carimboDoLote(lote);
  const igual = (a: unknown, b: unknown) => normalizarTexto(a) === normalizarTexto(b);
  if (registro.parcelamento_id != null && c.parcelamento_id != null
    && Number(registro.parcelamento_id) !== Number(c.parcelamento_id)) return 'identificacao';
  for (const campo of ['rua', 'numero_lote', 'quadra', 'conjunto'] as const) {
    if (!igual(registro[campo], c[campo])) return 'identificacao';
  }
  const a = paraNumero(registro.area_m2); const b = paraNumero(c.area_m2);
  if (a != null && b != null && Math.abs(a - b) > TOLERANCIA_AREA) return 'area';
  return 'ok';
}

/** Registros cujo lote não está mais na lista COMPLETA do módulo (lote apagado ou removido). */
export function registrosOrfaos(registros: any[], lotes: LoteNucleo[]): any[] {
  const ids = new Set(lotes.filter((l) => !l.removido_em).map((l) => Number(l.id)));
  return registros.filter((r) => !ids.has(Number(r.imovel_nucleo_id)));
}

/** Índice dos registros por id do lote no módulo. */
export function indexarParametros(registros: any[]): Map<number, any> {
  const m = new Map<number, any>();
  for (const r of registros) if (r?.imovel_nucleo_id != null) m.set(Number(r.imovel_nucleo_id), r);
  return m;
}

// ── Planilha (CSV) ──────────────────────────────────────────────────────────

export interface LinhaPlanilha {
  linha: number; rua: string; numero: string; area: number | null;
  coef_maximo: number | null; coef_minimo: number | null; gabarito_maximo: number | null;
  uos: string; uso: string;
}

/** Número de planilha: "3.5", "3,5", "1.234,56" ou "1,234.56"; qualquer outra coisa é `null`. */
export function numeroPlanilha(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const ultimoPonto = s.lastIndexOf('.'); const ultimaVirg = s.lastIndexOf(',');
  let limpo = s;
  if (ultimoPonto >= 0 && ultimaVirg >= 0) {
    limpo = ultimaVirg > ultimoPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (ultimaVirg >= 0) limpo = s.replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const ALIAS: Record<string, keyof LinhaPlanilha> = {
  logradouro: 'rua', rua: 'rua', numero: 'numero', numero_lote: 'numero', lote: 'numero',
  area: 'area', area_m2: 'area', cmax: 'coef_maximo', coef_maximo: 'coef_maximo', coeficiente_maximo: 'coef_maximo',
  cmin: 'coef_minimo', coef_minimo: 'coef_minimo', coeficiente_minimo: 'coef_minimo',
  gabarito: 'gabarito_maximo', gabarito_maximo: 'gabarito_maximo', uos: 'uos', uso: 'uso',
};

/**
 * Lê o texto de um CSV (separador `;` ou `,`, detectado no cabeçalho). Devolve as linhas com dados e
 * os erros de leitura (cabeçalho sem rua/número, linha curta). Aspas simples de CSV são tratadas.
 */
export function lerCsv(texto: string): { linhas: LinhaPlanilha[]; erros: string[] } {
  const bruto = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (bruto.length < 2) return { linhas: [], erros: ['O arquivo precisa de um cabeçalho e ao menos uma linha.'] };
  const sep = (bruto[0].match(/;/g)?.length ?? 0) >= (bruto[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (l: string): string[] => {
    const out: string[] = []; let atual = ''; let aspas = false;
    for (const ch of l) {
      if (ch === '"') { aspas = !aspas; continue; }
      if (ch === sep && !aspas) { out.push(atual); atual = ''; continue; }
      atual += ch;
    }
    out.push(atual); return out;
  };
  const cab = partir(bruto[0]).map((c) => ALIAS[normalizarTexto(c).replace(/ /g, '_')] ?? null);
  const erros: string[] = [];
  if (!cab.includes('rua') || !cab.includes('numero')) {
    return { linhas: [], erros: ['O cabeçalho precisa ter "logradouro" (ou "rua") e "numero".'] };
  }
  const linhas: LinhaPlanilha[] = [];
  bruto.slice(1).forEach((l, i) => {
    const cel = partir(l);
    const r: any = { linha: i + 2, rua: '', numero: '', area: null, coef_maximo: null, coef_minimo: null, gabarito_maximo: null, uos: '', uso: '' };
    cab.forEach((campo, j) => {
      if (!campo) return;
      const v = (cel[j] ?? '').trim();
      if (['area', 'coef_maximo', 'coef_minimo', 'gabarito_maximo'].includes(campo)) r[campo] = numeroPlanilha(v);
      else r[campo] = v;
    });
    if (!r.rua || !r.numero) { erros.push(`Linha ${r.linha}: sem rua ou sem número.`); return; }
    linhas.push(r as LinhaPlanilha);
  });
  return { linhas, erros };
}

export type StatusLinha = 'casado' | 'area-diverge' | 'sem-lote' | 'ambiguo' | 'duplicada' | 'sem-valor';

export interface ResultadoLinha { linha: LinhaPlanilha; lote?: LoteNucleo; status: StatusLinha; }

/**
 * Casa cada linha da planilha com UM lote do módulo pela chave rua + número (normalizadas) e confere
 * a área. Só `casado` é importável. `ambiguo` = a chave serve a mais de um lote do módulo;
 * `duplicada` = a chave se repete na planilha (a repetição não entra, para a última linha não vencer
 * a primeira em silêncio); `area-diverge` = casou pela chave, mas a área da planilha difere do lote;
 * `sem-valor` = nenhum coeficiente nem gabarito para registrar.
 */
export function casarPlanilha(linhas: LinhaPlanilha[], lotes: LoteNucleo[]): ResultadoLinha[] {
  const porChave = new Map<string, LoteNucleo[]>();
  for (const l of lotes) {
    if (l.removido_em) continue;
    const k = chaveRuaNumero(l.rua, l.numero_lote);
    if (!k) continue;
    porChave.set(k, [...(porChave.get(k) ?? []), l]);
  }
  const vistas = new Set<string>();
  return linhas.map((linha): ResultadoLinha => {
    const k = chaveRuaNumero(linha.rua, linha.numero);
    if (vistas.has(k)) return { linha, status: 'duplicada' };
    vistas.add(k);
    const cands = porChave.get(k) ?? [];
    if (cands.length === 0) return { linha, status: 'sem-lote' };
    if (cands.length > 1) return { linha, status: 'ambiguo' };
    const lote = cands[0];
    if (linha.coef_maximo == null && linha.coef_minimo == null && linha.gabarito_maximo == null) {
      return { linha, lote, status: 'sem-valor' };
    }
    const a = paraNumero(lote.area);
    if (linha.area != null && a != null && Math.abs(linha.area - a) > TOLERANCIA_AREA) {
      return { linha, lote, status: 'area-diverge' };
    }
    return { linha, lote, status: 'casado' };
  });
}

export const ROTULO_LINHA: Record<StatusLinha, string> = {
  casado: 'Casado com o lote do módulo',
  'area-diverge': 'Casou pela rua e número, mas a área difere do módulo',
  'sem-lote': 'Nenhum lote do módulo com essa rua e número',
  ambiguo: 'Mais de um lote do módulo com essa rua e número',
  duplicada: 'Rua e número repetidos na planilha',
  'sem-valor': 'Sem coeficiente nem gabarito para registrar',
};

/** Itens prontos para `POST /lote-parametros/importar`: só as linhas `casado`. */
export function itensDaImportacao(resultado: ResultadoLinha[], origem: string): Record<string, any>[] {
  return resultado.filter((r) => r.status === 'casado' && r.lote).map((r) => ({
    imovel_nucleo_id: Number(r.lote!.id),
    ...carimboDoLote(r.lote!),
    coef_maximo: r.linha.coef_maximo,
    coef_minimo: r.linha.coef_minimo,
    gabarito_maximo: r.linha.gabarito_maximo,
    uos: r.linha.uos || null,
    uso: r.linha.uso || null,
    origem: origem || null,
  }));
}

// ── Formulário do modal ─────────────────────────────────────────────────────

export type FormParametros = Record<string, string | number | null>;
const NUMERICOS = ['coef_minimo', 'coef_maximo', 'gabarito_maximo'] as const;
const TEXTOS = ['uos', 'uso'] as const;

export function formDoRegistro(r: any | null): FormParametros {
  const f: FormParametros = {};
  for (const c of TEXTOS) f[c] = r?.[c] ?? '';
  for (const c of NUMERICOS) f[c] = paraNumero(r?.[c]);
  return f;
}

/** Formulário → corpo do PUT. Manda TODOS os campos editáveis: limpar na tela limpa no banco. O carimbo vai junto no cadastro. */
export function corpoDoForm(form: FormParametros, lote: LoteNucleo, existente: boolean): Record<string, any> {
  const p: Record<string, any> = {};
  for (const c of TEXTOS) p[c] = String(form[c] ?? '').trim() || null;
  for (const c of NUMERICOS) p[c] = form[c] ?? null;
  return existente ? p : { ...carimboDoLote(lote), ...p };
}

export function validarForm(form: FormParametros): string {
  for (const c of NUMERICOS) {
    const v = form[c];
    if (typeof v === 'number' && v < 0) return 'Os valores não podem ser negativos.';
  }
  const { coef_minimo: min, coef_maximo: max } = form;
  if (typeof min === 'number' && typeof max === 'number' && min > max) return 'O coeficiente mínimo não pode ser maior que o máximo.';
  return '';
}
