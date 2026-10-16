// Parâmetros urbanísticos de um LOTE (coeficiente mínimo e máximo, gabarito máximo), guardados no
// schema do app (`lote_parametros`) e ligados ao lote do módulo imobiliário pelo id dele. Lógica pura
// da tela: carimbo de conferência, status do vínculo e conciliação de uma planilha com os lotes do
// módulo. O backend (`backend/rotas/lote-parametros.ts`) valida de novo: a fronteira real é lá.

export interface LoteNucleo {
  id: number; id_legivel?: string; rua?: string | null; numero_lote?: string | number | null;
  quadra?: string | null; conjunto?: string | null; area?: string | number | null;
  parcelamento_id?: number | null; removido_em?: string | null;
}

/** O backend aceita até este número de lotes por chamada de importação (`MAX_ITENS_IMPORTACAO`, lá). */
export const MAX_ITENS_IMPORTACAO = 300;

/** Tolerância de área entre o carimbo e o lote de hoje, e entre a planilha e o lote (m²). */
export const TOLERANCIA_AREA = 0.01;

/** Sem acento, sem caixa, espaços aparados e colapsados — "Barcelona " casa com "BARCELONA". */
export function normalizarTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Áreas diferem além da tolerância? Compara em CENTÉSIMOS inteiros: `100.01 - 100` dá 0.010000000000005116
 * em ponto flutuante e estouraria o limite de 0,01 m² que a documentação promete.
 */
export function areaDiverge(a: number, b: number): boolean {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) > Math.round(TOLERANCIA_AREA * 100);
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
  // `null` é um valor: lote que ganha ou perde o parcelamento mudou de identidade.
  if ((paraNumero(registro.parcelamento_id) ?? null) !== (paraNumero(c.parcelamento_id) ?? null)) return 'identificacao';
  for (const campo of ['rua', 'numero_lote', 'quadra', 'conjunto'] as const) {
    if (!igual(registro[campo], c[campo])) return 'identificacao';
  }
  const a = paraNumero(registro.area_m2); const b = paraNumero(c.area_m2);
  if (a != null && b != null && areaDiverge(a, b)) return 'area';
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
  /** Campos numéricos cuja célula tinha texto que não é número (ex.: "abc", "3x"): a linha não é importável. */
  invalidos?: string[];
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
  // Numera ANTES de descartar as linhas em branco: a mensagem de erro precisa apontar a linha do ARQUIVO.
  const bruto = texto.replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((conteudo, i) => ({ conteudo, numero: i + 1 })).filter((l) => l.conteudo.trim() !== '');
  if (bruto.length < 2) return { linhas: [], erros: ['O arquivo precisa de um cabeçalho e ao menos uma linha.'] };
  const cabecalho = bruto[0].conteudo;
  const sep = (cabecalho.match(/;/g)?.length ?? 0) >= (cabecalho.match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (l: string): string[] => {
    const out: string[] = []; let atual = ''; let aspas = false;
    for (const ch of l) {
      if (ch === '"') { aspas = !aspas; continue; }
      if (ch === sep && !aspas) { out.push(atual); atual = ''; continue; }
      atual += ch;
    }
    out.push(atual); return out;
  };
  const cab = partir(cabecalho).map((c) => ALIAS[normalizarTexto(c).replace(/ /g, '_')] ?? null);
  const erros: string[] = [];
  if (!cab.includes('rua') || !cab.includes('numero')) {
    return { linhas: [], erros: ['O cabeçalho precisa ter "logradouro" (ou "rua") e "numero".'] };
  }
  const linhas: LinhaPlanilha[] = [];
  for (const { conteudo, numero } of bruto.slice(1)) {
    const cel = partir(conteudo);
    const r: any = { linha: numero, rua: '', numero: '', area: null, coef_maximo: null, coef_minimo: null, gabarito_maximo: null, uos: '', uso: '' };
    cab.forEach((campo, j) => {
      if (!campo) return;
      const v = (cel[j] ?? '').trim();
      const numerico = ['area', 'coef_maximo', 'coef_minimo', 'gabarito_maximo'].includes(campo);
      const valor = numerico ? numeroPlanilha(v) : v;
      // Texto que não é número NÃO pode virar "célula vazia": a área ignoraria a conferência e o coeficiente
      // limparia o valor gravado. A linha é marcada e não entra.
      if (numerico && v !== '' && valor === null) (r.invalidos ??= []).push(campo);
      // Dois cabeçalhos para o mesmo campo ("numero" e "lote"): a coluna vazia não apaga a preenchida.
      if (valor !== null && valor !== '') r[campo] = valor;
    });
    if (!r.rua || !r.numero) { erros.push(`Linha ${r.linha}: sem rua ou sem número.`); continue; }
    linhas.push(r as LinhaPlanilha);
  }
  return { linhas, erros };
}

export type StatusLinha = 'casado' | 'celula-invalida' | 'area-diverge' | 'sem-lote' | 'ambiguo' | 'duplicada' | 'sem-valor' | 'vinculo-mudou';

export interface ResultadoLinha { linha: LinhaPlanilha; lote?: LoteNucleo; status: StatusLinha; }

/**
 * Casa cada linha da planilha com UM lote do módulo pela chave rua + número (normalizadas) e confere
 * a área. Só `casado` é importável. `ambiguo` = a chave serve a mais de um lote do módulo;
 * `duplicada` = a chave se repete na planilha — TODAS as ocorrências ficam de fora, porque não há como
 * saber qual valia; `area-diverge` = casou pela chave, mas a área da planilha difere do lote;
 * `sem-valor` = nenhum coeficiente nem gabarito para registrar; `vinculo-mudou` = o lote já tem
 * registro e o carimbo dele não bate mais com o lote de hoje (parcelamento, rua, número, quadra ou
 * conjunto): importar por cima daria os valores de um lote a outro. Esse caso se resolve no modal,
 * com "Reconfirmar vínculo".
 */
export function casarPlanilha(
  linhas: LinhaPlanilha[], lotes: LoteNucleo[], registros: Map<number, any> = new Map(),
): ResultadoLinha[] {
  const porChave = new Map<string, LoteNucleo[]>();
  for (const l of lotes) {
    if (l.removido_em) continue;
    const k = chaveRuaNumero(l.rua, l.numero_lote);
    if (!k) continue;
    porChave.set(k, [...(porChave.get(k) ?? []), l]);
  }
  const ocorrencias = new Map<string, number>();
  for (const linha of linhas) {
    const k = chaveRuaNumero(linha.rua, linha.numero);
    ocorrencias.set(k, (ocorrencias.get(k) ?? 0) + 1);
  }
  return linhas.map((linha): ResultadoLinha => {
    const k = chaveRuaNumero(linha.rua, linha.numero);
    if (linha.invalidos?.length) return { linha, status: 'celula-invalida' };
    if ((ocorrencias.get(k) ?? 0) > 1) return { linha, status: 'duplicada' };
    const cands = porChave.get(k) ?? [];
    if (cands.length === 0) return { linha, status: 'sem-lote' };
    if (cands.length > 1) return { linha, status: 'ambiguo' };
    const lote = cands[0];
    if (linha.coef_maximo == null && linha.coef_minimo == null && linha.gabarito_maximo == null) {
      return { linha, lote, status: 'sem-valor' };
    }
    const a = paraNumero(lote.area);
    if (linha.area != null && a != null && areaDiverge(linha.area, a)) {
      return { linha, lote, status: 'area-diverge' };
    }
    if (statusVinculo(registros.get(Number(lote.id)), lote) === 'identificacao') {
      return { linha, lote, status: 'vinculo-mudou' };
    }
    return { linha, lote, status: 'casado' };
  });
}

export const ROTULO_LINHA: Record<StatusLinha, string> = {
  casado: 'Casado com o lote do módulo',
  'celula-invalida': 'Célula numérica com texto que não é número (área, cmax, cmin ou gabarito)',
  'area-diverge': 'Casou pela rua e número, mas a área difere do módulo',
  'sem-lote': 'Nenhum lote do módulo com essa rua e número',
  ambiguo: 'Mais de um lote do módulo com essa rua e número',
  duplicada: 'Rua e número repetidos na planilha (nenhuma das ocorrências entra)',
  'sem-valor': 'Sem coeficiente nem gabarito para registrar',
  'vinculo-mudou': 'O lote já tem registro e mudou no módulo: reconfirme o vínculo no modal do lote antes de importar',
};

/**
 * Itens prontos para `POST /lote-parametros/importar`: só as linhas `casado`. Só vão os valores que a
 * planilha TRAZ — célula vazia e coluna ausente significam "não mexer", nunca "limpar": reimportar o CSV
 * da etapa 1 (só `cmax`) não pode apagar o mínimo ou o gabarito que alguém editou no modal. O carimbo do
 * lote só vai no CADASTRO; num registro que já existe ele não é regravado (reconfirmar é ação do modal).
 */
export function itensDaImportacao(
  resultado: ResultadoLinha[], origem: string, registros: Map<number, any> = new Map(),
): Record<string, any>[] {
  return resultado.filter((r) => r.status === 'casado' && r.lote).map((r) => {
    const id = Number(r.lote!.id);
    const item: Record<string, any> = { imovel_nucleo_id: id };
    const registro = registros.get(id);
    if (!registro) Object.assign(item, carimboDoLote(r.lote!));
    // Registro existente: o servidor só aplica os valores se o carimbo gravado ainda for o que esta tela viu.
    else item.carimbo_esperado = Object.fromEntries(Object.keys(carimboDoLote(r.lote!)).map((c) => [c, registro[c] ?? null]));
    if (r.linha.coef_maximo != null) item.coef_maximo = r.linha.coef_maximo;
    if (r.linha.coef_minimo != null) item.coef_minimo = r.linha.coef_minimo;
    if (r.linha.gabarito_maximo != null) item.gabarito_maximo = r.linha.gabarito_maximo;
    // UOS do catálogo vai na grafia do catálogo e leva o uso dela; fora do catálogo, vale o que a planilha traz.
    const uos = uosDoCatalogo(r.linha.uos);
    if (r.linha.uos) item.uos = uos?.uos ?? r.linha.uos;
    const uso = uos?.uso ?? r.linha.uso;
    if (uso) item.uso = uso;
    if (origem) item.origem = origem;
    return item;
  });
}

/**
 * Área máxima construída do lote: área do lote no módulo × coeficiente de aproveitamento máximo, em 2 casas.
 * `null` sem uma das duas.
 */
export function areaMaxConstruida(area: unknown, coefMaximo: unknown): number | null {
  const a = paraNumero(area); const c = paraNumero(coefMaximo);
  return a == null || c == null ? null : Math.round(a * c * 100) / 100;
}

// ── UOS → uso ───────────────────────────────────────────────────────────────

export type UsoLote = 'Residencial' | 'Comercial' | 'Misto';

/**
 * Catálogo das UOS (LUOS do DF) que o modal oferece, com o uso que cada uma implica. O uso não é digitado:
 * sai daqui. RE e RO têm o residencial como uso exclusivo/obrigatório; CSIIR admite residencial junto do não
 * residencial; CSII e CSIInd não admitem residencial.
 */
export const UOS_CATALOGO: ReadonlyArray<{ uos: string; uso: UsoLote }> = [
  { uos: 'RE 1', uso: 'Residencial' }, { uos: 'RE 2', uso: 'Residencial' }, { uos: 'RE 3', uso: 'Residencial' },
  { uos: 'RO 1', uso: 'Residencial' }, { uos: 'RO 2', uso: 'Residencial' },
  { uos: 'CSIIR 1', uso: 'Misto' }, { uos: 'CSIIR 1 NO', uso: 'Misto' },
  { uos: 'CSIIR 2', uso: 'Misto' }, { uos: 'CSIIR 2 NO', uso: 'Misto' }, { uos: 'CSIIR 3', uso: 'Misto' },
  { uos: 'CSII 1', uso: 'Comercial' }, { uos: 'CSII 2', uso: 'Comercial' }, { uos: 'CSII 3', uso: 'Comercial' },
  { uos: 'CSIInd 1', uso: 'Comercial' }, { uos: 'CSIInd 2', uso: 'Comercial' }, { uos: 'CSIInd 3', uso: 'Comercial' },
];

/** UOS do catálogo que casa com o texto (sem acento, caixa ou espaço extra), ou `null`. */
export function uosDoCatalogo(v: unknown): { uos: string; uso: UsoLote } | null {
  const n = normalizarTexto(v);
  return n ? UOS_CATALOGO.find((c) => normalizarTexto(c.uos) === n) ?? null : null;
}

/** Uso implicado pela UOS; `null` quando a UOS não está no catálogo (valor antigo, digitado ou importado). */
export function usoDaUos(v: unknown): UsoLote | null {
  return uosDoCatalogo(v)?.uso ?? null;
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
export function corpoDoForm(form: FormParametros, lote: LoteNucleo, existente: boolean, registro: any | null = null): Record<string, any> {
  const p: Record<string, any> = {};
  for (const c of TEXTOS) p[c] = String(form[c] ?? '').trim() || null;
  for (const c of NUMERICOS) p[c] = form[c] ?? null;
  // Cadastro: `ausente` diz que o modal abriu sem registro; se outra pessoa cadastrou antes, o servidor recusa.
  if (!existente) return { ...carimboDoLote(lote), ...p, ausente: true };
  // Atualização: leva também o registro que o modal VIU (`base`). O corpo manda o formulário inteiro, então
  // sem isso um modal aberto antes de outra pessoa editar sobrescreveria a edição dela, ou aplicaria os
  // valores a um vínculo reconfirmado; o servidor recusa se o gravado já não for o que foi visto.
  const base: Record<string, any> = {};
  for (const c of [...Object.keys(carimboDoLote(lote)), ...NUMERICOS, ...TEXTOS]) base[c] = registro?.[c] ?? null;
  return { ...p, base };
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
