// Comparação de estruturas de capital alternativas (Funding do Avançado).
//
// Módulo PURO, sem lit/html: recebe os resultados já simulados e devolve os
// quatro indicadores de comparação, o plano de "Usar esta" e a persistência
// local das alternativas. A simulação (fluxo + funding do estudo) é feita pela
// tela; aqui nada recalcula o motor.
//
// As alternativas vivem só no navegador (localStorage por estudo). Nada vai
// para a API até o usuário escolher "Usar esta", que aplica o plano abaixo
// pelas rotas existentes de operação de funding.
import type { FluxoCalc } from './fluxo-caixa-motor.js';
import { tirFluxo } from './fluxo-caixa-motor.js';
import type { FundingCalc, OperacaoFunding } from './funding-motor.js';

/** Máximo de alternativas guardadas por estudo. */
export const MAX_ALTERNATIVAS = 3;

export interface AlternativaFunding {
  id: string;
  nome: string;
  operacoes: OperacaoFunding[];
}

export interface IndicadoresEstrutura {
  /** Pior ponto do acumulado do fluxo alavancado, com piso em zero (nunca positivo, nunca -0). */
  exposicaoMaxima: number;
  /** TIR anual em % a.a. (mesma unidade e mesma função da TIR do projeto); null sem mudança de sinal. */
  tirAlavancada: number | null;
  /** Σ saídas − Σ entradas do funding no fluxo; 0 sem funding. */
  custoFinanceiro: number;
  /** Σ do fluxo alavancado; sem funding, Σ do fluxo livre. */
  resultadoAposFunding: number;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
/** round2 sem produzir -0. */
const r2 = (v: number): number => round2(v) || 0;
const soma = (xs: number[]): number => xs.reduce((s, v) => s + v, 0);

/**
 * Os quatro indicadores de uma estrutura. Sem funding (`null`), a estrutura é
 * o próprio projeto: TIR = TIR do projeto, custo financeiro 0 e resultado = Σ
 * do fluxo livre.
 *
 * O acumulado segue a convenção do motor de fluxo: `round2` a cada passo.
 * `custoFinanceiro` é a soma das saídas menos a das entradas arredondada só no
 * fim; por isso, contra "resultado sem funding − resultado após funding" (cada
 * mês do alavancado é arredondado em separado) pode haver diferença de centavos.
 */
export function indicadoresEstrutura(
  calc: Pick<FluxoCalc, 'fluxoMensal'>,
  funding: FundingCalc | null,
): IndicadoresEstrutura {
  const nf = funding?.noFluxo;
  const fluxo = nf ? nf.fluxoMensal : calc.fluxoMensal;
  let acc = 0;
  let menor = 0;
  for (const v of fluxo) {
    acc = round2(acc + v);
    if (acc < menor) menor = acc;
  }
  return {
    exposicaoMaxima: menor < 0 ? menor : 0,
    tirAlavancada: tirFluxo(fluxo),
    custoFinanceiro: nf ? r2(soma(nf.saidas) - soma(nf.entradas)) : 0,
    resultadoAposFunding: r2(soma(fluxo)),
  };
}

const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Cópia profunda das operações salvas (preserva o `id` delas); não muta a entrada. */
export function alternativaDoSalvo(operacoes: OperacaoFunding[], nome: string, id?: string): AlternativaFunding {
  return {
    id: id ?? `alt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    nome,
    operacoes: clonar(operacoes),
  };
}

/** Operação nova para uma alternativa (sem `id`): os mesmos defaults que a tela usa ao adicionar. */
export function novaOperacaoAlternativa(tipo: 'divida' | 'equity', nome: string): OperacaoFunding {
  const base = { tipo, nome, valor: 0, inicio_mes: 0 };
  return tipo === 'divida'
    ? { ...base, taxa_anual: 12, periodo_amortizacao_meses: 36, periodo_carencia_meses: 12, aporte_meses: 1 }
    : { ...base, modo_retorno: 'permuta_financeira', pct_retorno: 0 };
}

type IdOp = number | string;

export interface PlanoUsarAlternativa {
  criar: OperacaoFunding[];
  atualizar: { id: IdOp; campos: Partial<OperacaoFunding> }[];
  remover: IdOp[];
}

/** Um passo de gravação do plano, na ordem em que o servidor o aceita. */
export type PassoPlano =
  | { acao: 'remover'; id: IdOp }
  | { acao: 'atualizar'; id: IdOp; campos: Partial<OperacaoFunding> }
  | { acao: 'criar'; op: OperacaoFunding };

/** Chaves que começam com `__` são marcadores de tela e nunca chegam ao servidor. */
const semMarcadoresDeTela = <T extends object>(o: T): T => {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('__')) r[k] = v;
  return r as T;
};

/**
 * Ordem de gravação, pensada no teto do servidor (soma de `pct_retorno` dos
 * equities do MESMO `modo_retorno` <= 100%; `valor` não entra):
 * 1) remover; 2) zerar `pct_retorno` de quem troca de modo; 3) atualizar o que
 * não aumenta o pct nem troca de modo; 4) atualizar quem troca de modo (completo);
 * 5) atualizar o que aumenta o pct; 6) criar.
 * Prova: após 1-3 cada operação, em cada modo, contribui <= ao valor final; 4 e 5
 * só levam operações ao valor final; logo nenhuma soma intermediária passa da
 * final, que o usuário quer válida.
 */
export function passosDoPlano(plano: PlanoUsarAlternativa, salvas: OperacaoFunding[] = []): PassoPlano[] {
  const porId = new Map<IdOp, OperacaoFunding>();
  for (const s of salvas) if (s.id != null) porId.set(s.id, s);
  type U = PlanoUsarAlternativa['atualizar'][number];
  const efetivo = (u: U) => {
    const salva = porId.get(u.id) as any;
    const c = u.campos as any;
    const equity = (salva?.tipo ?? c.tipo) === 'equity';
    return {
      equity,
      modoAntes: String(salva?.modo_retorno ?? 'permuta_financeira'),
      modoDepois: String(c.modo_retorno ?? salva?.modo_retorno ?? 'permuta_financeira'),
      pctAntes: Number(salva?.pct_retorno) || 0,
      pctDepois: Number(c.pct_retorno ?? salva?.pct_retorno) || 0,
    };
  };
  const info = plano.atualizar.map((u) => ({ u, e: efetivo(u) }));
  const trocaModo = (x: (typeof info)[number]) => x.e.equity && x.e.modoAntes !== x.e.modoDepois;
  const sobePct = (x: (typeof info)[number]) => x.e.equity && !trocaModo(x) && x.e.pctDepois > x.e.pctAntes;
  const trocas = info.filter(trocaModo);
  const livres = info.filter((x) => !trocaModo(x) && !sobePct(x));
  const subidas = info.filter(sobePct);
  const upd = (x: (typeof info)[number]): PassoPlano => ({ acao: 'atualizar', id: x.u.id, campos: x.u.campos });
  const updTroca = (x: (typeof info)[number]): PassoPlano => ({
    acao: 'atualizar', id: x.u.id, campos: { ...x.u.campos, pct_retorno: x.e.pctDepois },
  });
  return [
    ...plano.remover.map((id): PassoPlano => ({ acao: 'remover', id })),
    ...trocas.filter((x) => x.e.pctAntes !== 0)
      .map((x): PassoPlano => ({ acao: 'atualizar', id: x.u.id, campos: { pct_retorno: 0 } })),
    ...livres.map(upd),
    ...trocas.map(updTroca),
    ...subidas.map(upd),
    ...plano.criar.map((op): PassoPlano => ({ acao: 'criar', op })),
  ];
}

export function planoVazio(p: PlanoUsarAlternativa): boolean {
  return p.criar.length === 0 && p.atualizar.length === 0 && p.remover.length === 0;
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * O que gravar para a alternativa virar o funding do estudo.
 * - sem `id` (ou `id` ausente do salvo) → criar (sem o `id`);
 * - `id` existente → atualizar só os campos que mudaram (por valor, sem `id`);
 * - salva que a alternativa não tem → remover; o Financiamento à produção
 *   nunca é removido: vira `ativo: false` (se já não estiver).
 * Mudar o `tipo` de uma operação existente equivale a tirar a antiga e criar
 * a nova.
 */
export function planoUsarAlternativa(salvas: OperacaoFunding[], alt: AlternativaFunding): PlanoUsarAlternativa {
  const plano: PlanoUsarAlternativa = { criar: [], atualizar: [], remover: [] };
  const porId = new Map<IdOp, OperacaoFunding>();
  for (const s of salvas) if (s.id != null) porId.set(s.id, s);
  const mantidas = new Set<IdOp>();

  for (const op of alt.operacoes) {
    const salva = op.id != null ? porId.get(op.id) : undefined;
    if (!salva || salva.tipo !== op.tipo) {
      const { id: _id, ...semId } = semMarcadoresDeTela(clonar(op));
      plano.criar.push(semId as OperacaoFunding);
      continue;
    }
    mantidas.add(salva.id as IdOp);
    const campos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(op)) {
      if (k === 'id' || k.startsWith('__')) continue;
      if (!igual((salva as any)[k], v)) campos[k] = clonar(v);
    }
    if (Object.keys(campos).length) plano.atualizar.push({ id: salva.id as IdOp, campos: campos as Partial<OperacaoFunding> });
  }

  for (const s of salvas) {
    if (s.id == null || mantidas.has(s.id)) continue;
    if (s.tipo === 'financiamento_producao') {
      if (s.ativo !== false) plano.atualizar.push({ id: s.id, campos: { ativo: false } });
    } else {
      plano.remover.push(s.id);
    }
  }
  return plano;
}

// ── persistência local ──────────────────────────────────────────────

const chaveDe = (estudoId: number | string): string => `viab:funding-alternativas:${estudoId}`;

function storagePadrao(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Lê as alternativas do estudo; qualquer falha ou dado inválido vira `[]`. */
export function lerAlternativas(estudoId: number | string, storage?: Storage | null): AlternativaFunding[] {
  try {
    const st = storage === undefined ? storagePadrao() : storage;
    const bruto = st?.getItem(chaveDe(estudoId));
    if (!bruto) return [];
    const dado = JSON.parse(bruto);
    if (!Array.isArray(dado)) return [];
    return dado
      .filter((a) => a && typeof a.id === 'string' && typeof a.nome === 'string' && Array.isArray(a.operacoes))
      .slice(0, MAX_ALTERNATIVAS);
  } catch {
    return [];
  }
}

/** Grava as alternativas (no máximo `MAX_ALTERNATIVAS`); devolve `false` se o storage falhou. */
export function gravarAlternativas(
  estudoId: number | string, alts: AlternativaFunding[], storage?: Storage | null,
): boolean {
  try {
    const st = storage === undefined ? storagePadrao() : storage;
    if (!st) return false;
    st.setItem(chaveDe(estudoId), JSON.stringify(alts.slice(0, MAX_ALTERNATIVAS)));
    return true;
  } catch {
    return false;
  }
}
