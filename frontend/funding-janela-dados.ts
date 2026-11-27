// A janela de criar e editar operação do Funding, sem lit: as etapas de cada
// tipo, os valores iniciais, o que vai ao servidor ao confirmar, a recusa no
// próprio lugar (por etapa), os quatro KPIs do "Resumo", a série da "Prévia do
// fluxo" e os termos que a página da operação mostra em leitura.
//
// Tudo aqui é função pura sobre dados já simulados: a janela recebe a
// simulação da tela (`simular`) e chama estas funções com o resultado. Nada
// aqui recalcula o motor.
//
// As etapas trazem SÓ os campos que já existiam no formulário da página da
// operação, com os mesmos rótulos, sufixos e casas decimais. Nenhum campo novo.
import { fmtNum, fmtPct, fmtR$ } from './viab-format.js';
import {
  eDivida, indicadoresAntecipacao, indicadoresOperacao,
  type OperacaoFunding, type SerieOperacao, type TipoOperacao,
} from './funding-motor.js';
import { kpisDaOperacao, maiorSaldoDevedor, type PassoEstrutura } from './funding-estrutura.js';
import { rotuloMesRelativo } from './fluxo-shared.js';
import {
  errosRetornoPorModo, recusaDoNome, recusaDoPatchComoServidor, recusaDoPostComoServidor,
} from './funding-validacao.js';

/** Os tipos que a janela cria e edita. O Financiamento à produção tem aba própria. */
export const TIPOS_DA_JANELA = ['divida', 'equity', 'antecipacao_recebiveis'] as const;
export type TipoDaJanela = typeof TIPOS_DA_JANELA[number];

export const ehTipoDaJanela = (t: unknown): t is TipoDaJanela =>
  (TIPOS_DA_JANELA as readonly unknown[]).includes(t);

// ─────────────────────────────────────────────────────────────────────────
// Etapas e campos
// ─────────────────────────────────────────────────────────────────────────

/** Um campo da janela, na ordem em que aparece na etapa. */
export type CampoJanela =
  | { tipo: 'tipo' }
  | { tipo: 'nome' }
  | { tipo: 'num'; campo: string; rotulo: string; sufixo: string; casas: number; so?: 'distribuir' }
  /** A âncora do mês: o evento do Cronograma e, em "Mês específico", o mês. */
  | { tipo: 'ancora'; rotulo: string }
  | { tipo: 'checkbox'; campo: string; rotulo: string }
  | { tipo: 'modo'; rotulo: string }
  /** Texto informativo, sem campo (o sistema Price da dívida). */
  | { tipo: 'info'; rotulo: string; texto: string };

export interface EtapaJanela {
  id: string;
  label: string;
  campos: CampoJanela[];
}

/** O mês quando a âncora é "Mês específico" — o mesmo campo `inicio_mes` de sempre. */
export const CAMPO_MES = { tipo: 'num', campo: 'inicio_mes', rotulo: 'Mês', sufixo: 'º mês', casas: 0 } as const;

const GERAL: EtapaJanela = { id: 'geral', label: 'Detalhes gerais', campos: [{ tipo: 'tipo' }, { tipo: 'nome' }] };

const ETAPAS: Record<TipoDaJanela, EtapaJanela[]> = {
  divida: [
    GERAL,
    {
      id: 'aporte', label: 'Aporte', campos: [
        { tipo: 'num', campo: 'valor', rotulo: 'Valor', sufixo: 'R$', casas: 2 },
        { tipo: 'ancora', rotulo: 'Mês do aporte' },
        { tipo: 'checkbox', campo: 'distribuir_aporte', rotulo: 'Distribuir aporte' },
        { tipo: 'num', campo: 'aporte_meses', rotulo: 'Aporte em', sufixo: 'meses', casas: 0, so: 'distribuir' },
      ],
    },
    {
      id: 'amortizacao', label: 'Amortização', campos: [
        { tipo: 'num', campo: 'periodo_amortizacao_meses', rotulo: 'Amortização', sufixo: 'meses', casas: 0 },
        { tipo: 'num', campo: 'periodo_carencia_meses', rotulo: 'Carência', sufixo: 'meses', casas: 0 },
        { tipo: 'info', rotulo: 'Sistema', texto: 'Price' },
      ],
    },
    {
      id: 'juros', label: 'Juros', campos: [
        { tipo: 'num', campo: 'taxa_anual', rotulo: 'Taxa', sufixo: '% a.a.', casas: 2 },
      ],
    },
    {
      id: 'custos', label: 'Custos', campos: [
        { tipo: 'num', campo: 'taxa_estruturacao_pct', rotulo: 'Estruturação', sufixo: '%', casas: 2 },
        { tipo: 'num', campo: 'taxa_administracao_mensal', rotulo: 'Administração', sufixo: 'R$/mês', casas: 2 },
        { tipo: 'num', campo: 'outros_encargos_iniciais', rotulo: 'Outros encargos', sufixo: 'R$', casas: 2 },
      ],
    },
  ],
  equity: [
    GERAL,
    {
      id: 'aporte', label: 'Aporte', campos: [
        { tipo: 'num', campo: 'valor', rotulo: 'Valor do aporte', sufixo: 'R$', casas: 2 },
        { tipo: 'ancora', rotulo: 'Mês do aporte' },
      ],
    },
    {
      id: 'retorno', label: 'Retorno', campos: [
        { tipo: 'modo', rotulo: 'Modo' },
        { tipo: 'num', campo: 'pct_retorno', rotulo: '% de retorno', sufixo: '%', casas: 2 },
      ],
    },
  ],
  antecipacao_recebiveis: [
    GERAL,
    {
      id: 'cessao', label: 'Cessão', campos: [
        { tipo: 'ancora', rotulo: 'Mês da cessão' },
        { tipo: 'num', campo: 'pct_carteira_cedida', rotulo: 'Carteira cedida', sufixo: '%', casas: 2 },
      ],
    },
    {
      id: 'desconto', label: 'Desconto', campos: [
        { tipo: 'num', campo: 'taxa_anual', rotulo: 'Taxa de desconto', sufixo: '% a.a.', casas: 2 },
      ],
    },
    {
      id: 'custos', label: 'Custos', campos: [
        { tipo: 'num', campo: 'taxa_estruturacao_pct', rotulo: 'Estruturação', sufixo: '%', casas: 2 },
        { tipo: 'num', campo: 'taxa_administracao_mensal', rotulo: 'Administração', sufixo: 'R$/mês', casas: 2 },
        { tipo: 'num', campo: 'outros_encargos_iniciais', rotulo: 'Outros custos', sufixo: 'R$', casas: 2 },
      ],
    },
  ],
};

export function etapasDoTipo(tipo: TipoDaJanela): EtapaJanela[] {
  return ETAPAS[tipo];
}

/** Os campos gravados por um tipo, na ordem das etapas (sem `tipo`). */
export function camposGravadosDoTipo(tipo: TipoDaJanela): string[] {
  const campos: string[] = [];
  for (const etapa of ETAPAS[tipo]) {
    for (const c of etapa.campos) {
      if (c.tipo === 'nome') campos.push('nome');
      else if (c.tipo === 'num' || c.tipo === 'checkbox') campos.push(c.campo);
      else if (c.tipo === 'ancora') campos.push('cronograma_evento', 'inicio_mes');
      else if (c.tipo === 'modo') campos.push('modo_retorno');
    }
  }
  return campos;
}

// Mesmas âncoras das linhas de Custo — número de mês absoluto quebra quando o
// Cronograma muda; âncora acompanha.
export const EVENTOS_ANCORA: { valor: string; rotulo: string }[] = [
  { valor: 'planejamento', rotulo: 'Planejamento' },
  { valor: 'pre_lancamento', rotulo: 'Pré-lançamento' },
  { valor: 'lancamento', rotulo: 'Lançamento' },
  { valor: 'obra', rotulo: 'Obra' },
  { valor: 'pos_obra', rotulo: 'Pós-obras' },
  { valor: 'customizado', rotulo: 'Mês específico' },
];

export const MODOS_RETORNO: { valor: string; rotulo: string }[] = [
  { valor: 'permuta_financeira', rotulo: 'Permuta financeira (% da receita líquida, mês a mês)' },
  { valor: 'resultado_final', rotulo: '% do resultado final (pago no repasse)' },
];

// ─────────────────────────────────────────────────────────────────────────
// Valores iniciais, o que vai ao servidor
// ─────────────────────────────────────────────────────────────────────────

/** Os padrões de uma operação nova — os mesmos que a tela usava ao criar direto. */
export function padroesDoTipo(tipo: TipoDaJanela): Record<string, any> {
  if (tipo === 'antecipacao_recebiveis') {
    // A cessão típica de loteamento: depois das chaves, metade do lastro.
    return { cronograma_evento: 'pos_obra', inicio_mes: 0, pct_carteira_cedida: 50, taxa_anual: 18 };
  }
  if (tipo === 'divida') {
    return {
      valor: 0, cronograma_evento: 'customizado', inicio_mes: 0,
      taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, aporte_meses: 1,
    };
  }
  return { valor: 0, cronograma_evento: 'customizado', inicio_mes: 0, modo_retorno: 'permuta_financeira', pct_retorno: 0 };
}

/** Nome padrão por tipo: maior sufixo numérico do tipo + 1 ("3º Dívida"), não contagem. */
export function nomePadrao(tipo: TipoOperacao, operacoes: readonly { tipo: string; nome?: unknown }[]): string {
  if (tipo === 'financiamento_producao') return 'Financiamento à produção';
  const rotulo = tipo === 'divida' ? 'Dívida' : tipo === 'equity' ? 'Equity' : 'Antecipação';
  const usados = operacoes
    .filter((o) => o.tipo === tipo)
    .map((o) => /^(\d+)/.exec(String(o.nome ?? ''))?.[1])
    .map((s) => Number(s) || 0);
  const proximo = (usados.length ? Math.max(...usados) : 0) + 1;
  return `${proximo}º ${rotulo}`;
}

/**
 * O corpo do POST: tipo, nome, ordem e os campos do tipo. A antecipação não
 * manda `valor` (o motor não o lê nesse tipo). Com âncora do Cronograma, não
 * manda `inicio_mes`: o servidor o resolve a partir do evento.
 */
export function corpoDeCriacao(tipo: TipoDaJanela, valores: Record<string, any>, ordem: number): Record<string, any> {
  const corpo: Record<string, any> = { tipo, nome: valores.nome, ordem };
  for (const campo of camposGravadosDoTipo(tipo)) {
    if (campo === 'nome') continue;
    if (valores[campo] === undefined) continue;
    corpo[campo] = valores[campo];
  }
  if (tipo === 'antecipacao_recebiveis') delete corpo.valor;
  if (corpo.cronograma_evento && corpo.cronograma_evento !== 'customizado') delete corpo.inicio_mes;
  return corpo;
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * O corpo do PATCH de uma edição: só os campos alterados, nunca `tipo`.
 * Âncora do Cronograma sem mês: o servidor deriva o mês do evento.
 */
export function patchDaEdicao(gravada: Record<string, any>, valores: Record<string, any>): Record<string, any> {
  const tipo = gravada.tipo as TipoDaJanela;
  const patch: Record<string, any> = {};
  for (const campo of camposGravadosDoTipo(tipo)) {
    if (!(campo in valores)) continue;
    if (!igual(gravada[campo], valores[campo])) patch[campo] = valores[campo];
  }
  const evento = String(valores.cronograma_evento ?? gravada.cronograma_evento ?? 'customizado');
  if (evento !== 'customizado') delete patch.inicio_mes;
  return patch;
}

/**
 * A operação que a simulação usa: na criação, o corpo do POST sem `id` (entra
 * por último entre as do tipo); na edição, a gravada com os valores por cima
 * (mantém `id` e `ordem`, e com isso a posição dela). O mês da âncora é o
 * derivado do Cronograma — quem aplica é `operacaoComRascunho`, na janela.
 */
export function valoresDaOperacao(gravada: Record<string, any>): Record<string, any> {
  const valores: Record<string, any> = { nome: gravada.nome ?? '' };
  for (const campo of camposGravadosDoTipo(gravada.tipo as TipoDaJanela)) {
    if (campo in gravada) valores[campo] = gravada[campo];
  }
  valores.cronograma_evento ??= 'customizado';
  return valores;
}

// ─────────────────────────────────────────────────────────────────────────
// Recusa no próprio lugar
// ─────────────────────────────────────────────────────────────────────────

/** A etapa dona de um campo gravado; `geral` para tipo, nome e o desconhecido. */
export function etapaDoCampo(tipo: TipoDaJanela, campo: string): string {
  for (const etapa of ETAPAS[tipo]) {
    for (const c of etapa.campos) {
      if ((c.tipo === 'num' || c.tipo === 'checkbox') && c.campo === campo) return etapa.id;
      if (c.tipo === 'ancora' && (campo === 'cronograma_evento' || campo === 'inicio_mes')) return etapa.id;
      if (c.tipo === 'modo' && campo === 'modo_retorno') return etapa.id;
    }
  }
  return 'geral';
}

/** Os campos de um tipo com o rótulo da janela, mais tipo e nome. */
function rotulosDoTipo(tipo: TipoDaJanela): Map<string, string> {
  const m = new Map<string, string>([['tipo', 'Tipo'], ['nome', 'Nome'], ['cronograma_evento', 'Mês'], ['inicio_mes', 'Mês']]);
  for (const etapa of ETAPAS[tipo]) {
    for (const c of etapa.campos) {
      if (c.tipo === 'num' || c.tipo === 'checkbox') m.set(c.campo, c.rotulo);
      if (c.tipo === 'ancora') { m.set('cronograma_evento', c.rotulo); m.set('inicio_mes', c.rotulo); }
      if (c.tipo === 'modo') m.set('modo_retorno', c.rotulo);
    }
  }
  return m;
}

/** O primeiro campo citado numa mensagem do servidor (a mais à esquerda). */
function campoDaMensagem(tipo: TipoDaJanela, msg: string): string | null {
  let melhor: { campo: string; pos: number } | null = null;
  for (const campo of rotulosDoTipo(tipo).keys()) {
    const m = new RegExp(`(^|[^a-z_])${campo}([^a-z_]|$)`).exec(msg);
    if (!m) continue;
    const pos = m.index + m[1].length;
    if (!melhor || pos < melhor.pos) melhor = { campo, pos };
  }
  return melhor?.campo ?? null;
}

/** A mensagem com o nome técnico de cada campo trocado pelo rótulo da janela. */
export function mensagemDaJanela(tipo: TipoDaJanela, msg: string): string {
  let texto = msg;
  const rotulos = [...rotulosDoTipo(tipo)].sort((a, b) => b[0].length - a[0].length);
  for (const [campo, rotulo] of rotulos) {
    texto = texto.replace(new RegExp(`"?\\b${campo}\\b"?`, 'g'), `“${rotulo}”`);
  }
  texto = texto.replace(/^Campo /, '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface ErroJanela { etapa: string; mensagem: string }

export interface EntradaErros {
  modo: 'criar' | 'editar';
  tipo: TipoDaJanela;
  valores: Record<string, any>;
  /** A operação gravada, na edição. */
  gravada?: Record<string, any> | null;
  /** As operações gravadas do estudo (para a soma de retorno do equity). */
  salvas: readonly OperacaoFunding[];
  ordem?: number;
}

/**
 * Tudo o que o servidor recusaria ao confirmar, na etapa dona do campo:
 * nome (vazio ou longo, também na edição), as regras de campo do POST ou do
 * PATCH e a soma de retorno do equity por modo sobre as gravadas mais o
 * rascunho. Lista vazia = pode gravar.
 */
export function errosDaJanela(e: EntradaErros): ErroJanela[] {
  const erros: ErroJanela[] = [];
  const add = (msg: string | null) => {
    if (!msg) return;
    const etapa = etapaDoCampo(e.tipo, campoDaMensagem(e.tipo, msg) ?? 'nome');
    const mensagem = mensagemDaJanela(e.tipo, msg);
    if (!erros.some((x) => x.mensagem === mensagem)) erros.push({ etapa, mensagem });
  };
  add(recusaDoNome(e.valores.nome));
  let efetiva: Record<string, any>;
  if (e.modo === 'criar' || !e.gravada) {
    const corpo = corpoDeCriacao(e.tipo, e.valores, e.ordem ?? 0);
    add(recusaDoPostComoServidor(corpo));
    efetiva = corpo;
  } else {
    const patch = patchDaEdicao(e.gravada, e.valores);
    add(recusaDoPatchComoServidor(e.gravada, patch));
    efetiva = { ...e.gravada, ...patch };
  }
  if (e.tipo === 'equity') {
    const outras = e.salvas.filter((o) => e.modo === 'criar' || String(o.id) !== String(e.gravada?.id));
    const modo = String(efetiva.modo_retorno ?? 'permuta_financeira');
    const soDoModo = [...outras, efetiva as OperacaoFunding]
      .filter((o) => o.tipo === 'equity' && String((o as any).modo_retorno ?? 'permuta_financeira') === modo);
    for (const msg of errosRetornoPorModo(soDoModo)) erros.push({ etapa: 'retorno', mensagem: msg });
  }
  return erros;
}

// ─────────────────────────────────────────────────────────────────────────
// Resumo e prévia
// ─────────────────────────────────────────────────────────────────────────

export interface KpiResumo { rotulo: string; texto: string }

const SEM = '—';
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const soma = (xs: readonly number[] | undefined) => (xs ?? []).reduce((a, b) => a + b, 0);
const reais = (v: number | null | undefined) => (finito(v) ? fmtR$(v) : SEM);
const pct = (v: number | null | undefined, anual = false) => (finito(v) ? (anual ? `${fmtPct(v)} a.a.` : fmtPct(v)) : SEM);

/**
 * Os quatro KPIs do "Resumo", por tipo. Valores em reais cheios (2 casas),
 * percentuais com uma casa; sem base de cálculo, "—", nunca zero.
 *
 * "Capital do incorporador no pico" é a exposição máxima do projeto DEPOIS
 * desta operação (o passo dela na sequência por senioridade), em módulo.
 */
export function resumoDaJanela(
  tipo: TipoDaJanela, serie: SerieOperacao | null, passo: PassoEstrutura | null, vgvTotal: number,
): KpiResumo[] {
  const pico: KpiResumo = {
    rotulo: 'Capital do incorporador no pico',
    texto: reais(passo ? Math.abs(passo.depois.exposicaoMaxima) : null),
  };
  const k = serie ? kpisDaOperacao(serie, vgvTotal, passo) : null;
  if (tipo === 'divida') {
    const principal = serie ? soma(serie.entradas) : 0;
    const comBase = principal > 0;
    const saldo = serie ? maiorSaldoDevedor(serie) : null;
    return [
      { rotulo: 'Custo efetivo', texto: pct(k?.tipo === 'divida' ? k.custoEfetivoPct : null, true) },
      { rotulo: 'Custo financeiro', texto: reais(comBase && serie ? soma(serie.juros) + soma(serie.tarifas) : null) },
      { rotulo: 'Maior saldo devedor', texto: reais(comBase && saldo !== null && saldo > 0 ? saldo : null) },
      pico,
    ];
  }
  if (tipo === 'equity') {
    const retorno = serie ? indicadoresOperacao(serie, 0).retornoTotal : null;
    return [
      { rotulo: 'ROI do investidor', texto: pct(k?.tipo === 'equity' ? k.roiInvestidorPct : null) },
      { rotulo: 'TIR do investidor', texto: pct(k?.tipo === 'equity' ? k.tirInvestidorPct : null, true) },
      { rotulo: 'Retorno total', texto: reais(retorno !== null && retorno > 0 ? retorno : null) },
      pico,
    ];
  }
  const ind = serie ? indicadoresAntecipacao(serie) : null;
  const comLastro = !!ind && ind.valorFace > 0;
  return [
    { rotulo: 'Valor antecipado', texto: reais(comLastro ? ind!.valorPresente : null) },
    { rotulo: 'Deságio', texto: pct(k?.tipo === 'antecipacao_recebiveis' ? k.desagioPct : null) },
    { rotulo: 'Custo efetivo', texto: pct(k?.tipo === 'antecipacao_recebiveis' ? k.custoEfetivoPct : null, true) },
    pico,
  ];
}

export interface SerieGrafico {
  entradas: number[];
  saidas: number[];
  saldo: number[];
  /** "Saldo devedor" na dívida; "Saldo acumulado" (entradas − saídas) nos demais. */
  rotuloSaldo: string;
}

/**
 * A série do gráfico da operação — o mesmo na "Prévia do fluxo" da janela e na
 * página: entradas, saídas e saldo, mês a mês. O saldo é o devedor na dívida e,
 * nos demais tipos (que não têm saldo devedor), o acumulado de entradas menos
 * saídas. Série toda zerada não desenha: devolve `null`.
 */
export function serieDoGrafico(serie: SerieOperacao | null): SerieGrafico | null {
  if (!serie) return null;
  const temMovimento = [...serie.entradas, ...serie.saidas].some((v) => Math.abs(v) >= 0.005);
  if (!temMovimento) return null;
  if (eDivida(serie.operacao.tipo)) {
    return { entradas: serie.entradas, saidas: serie.saidas, saldo: serie.saldo, rotuloSaldo: 'Saldo devedor' };
  }
  let acc = 0;
  const saldo = serie.entradas.map((e, i) => (acc += e - (serie.saidas[i] ?? 0)));
  return { entradas: serie.entradas, saidas: serie.saidas, saldo, rotuloSaldo: 'Saldo acumulado' };
}

// ─────────────────────────────────────────────────────────────────────────
// Termos da página da operação (leitura)
// ─────────────────────────────────────────────────────────────────────────

export interface TermoLeitura { rotulo: string; texto: string }
export interface GrupoTermos { etapa: string; label: string; termos: TermoLeitura[] }

const num = (v: unknown): number => Number(v) || 0;

function textoNumero(c: Extract<CampoJanela, { tipo: 'num' }>, v: unknown): string {
  const n = num(v);
  if (c.sufixo === 'R$') return fmtR$(n);
  if (c.sufixo === 'R$/mês') return `${fmtR$(n)}/mês`;
  if (c.sufixo === 'º mês') return `${fmtNum(n, 0)}º mês`;
  const casas = c.casas;
  const texto = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(n);
  return c.sufixo.startsWith('%') ? `${texto}${c.sufixo}` : `${texto} ${c.sufixo}`;
}

/** O mês do aporte/cessão como a página mostra: o evento e o mês relativo dele. */
export function textoAncora(op: Record<string, any>, dataInicio: string | null): string {
  const evento = String(op.cronograma_evento ?? 'customizado');
  const rot = EVENTOS_ANCORA.find((e) => e.valor === evento)?.rotulo ?? evento;
  return `${rot} · ${rotuloMesRelativo(dataInicio, num(op.inicio_mes))}`;
}

/**
 * Os termos da operação gravada, por etapa (sem Detalhes gerais), com os rótulos
 * da janela — a página da operação os mostra em leitura.
 */
export function termosDaOperacao(op: Record<string, any>, dataInicio: string | null): GrupoTermos[] {
  if (!ehTipoDaJanela(op.tipo)) return [];
  const grupos: GrupoTermos[] = [];
  for (const etapa of ETAPAS[op.tipo]) {
    if (etapa.id === 'geral') continue;
    const termos: TermoLeitura[] = [];
    for (const c of etapa.campos) {
      if (c.tipo === 'num') {
        if (c.so === 'distribuir' && op.distribuir_aporte !== true) continue;
        termos.push({ rotulo: c.rotulo, texto: textoNumero(c, op[c.campo]) });
      } else if (c.tipo === 'ancora') {
        termos.push({ rotulo: c.rotulo, texto: textoAncora(op, dataInicio) });
      } else if (c.tipo === 'checkbox') {
        termos.push({ rotulo: c.rotulo, texto: op[c.campo] === true ? 'Sim' : 'Não' });
      } else if (c.tipo === 'modo') {
        const m = String(op.modo_retorno ?? 'permuta_financeira');
        termos.push({ rotulo: c.rotulo, texto: MODOS_RETORNO.find((x) => x.valor === m)?.rotulo ?? m });
      } else if (c.tipo === 'info') {
        termos.push({ rotulo: c.rotulo, texto: c.texto });
      }
    }
    grupos.push({ etapa: etapa.id, label: etapa.label, termos });
  }
  return grupos;
}

/** O que a etapa já tem preenchido, numa linha — a `descricao` do item do trilho. */
export function resumoDaEtapa(tipo: TipoDaJanela, etapaId: string, valores: Record<string, any>, rotuloTipo: string, dataInicio: string | null): string {
  if (etapaId === 'geral') return rotuloTipo;
  const grupo = termosDaOperacao({ ...valores, tipo }, dataInicio).find((g) => g.etapa === etapaId);
  return (grupo?.termos ?? []).filter((t) => t.rotulo !== 'Sistema').slice(0, 2).map((t) => t.texto).join(' · ');
}
