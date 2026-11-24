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

/**
 * O início de uma operação ancorada (evento do cronograma ou fase) é resolvido
 * pelo servidor a cada gravação, a partir do cronograma ATUAL. Uma alternativa
 * guardada antes de a âncora andar teria o mês velho: aqui as operações que
 * existem no funding salvo e estão ancoradas lá recebem a âncora e o mês de
 * hoje, para a simulação e o plano verem o que o servidor vai gravar.
 * Não muta a entrada; devolve a mesma lista quando nada muda.
 */
export function sincronizarAncoras(ops: OperacaoFunding[], salvas: OperacaoFunding[]): OperacaoFunding[] {
  const porId = new Map<IdOp, OperacaoFunding>();
  for (const s of salvas) if (s.id != null) porId.set(s.id, s);
  let mudou = false;
  const saida = ops.map((o) => {
    const salva = o.id != null ? (porId.get(o.id) as any) : undefined;
    if (!salva || salva.tipo !== o.tipo) return o;
    const ev = salva.cronograma_evento;
    const ancoradaNoSalvo = (!!ev && ev !== 'customizado') || salva.fase_ancora_id != null;
    if (!ancoradaNoSalvo) return o;
    const atual = o as any;
    if (atual.inicio_mes === salva.inicio_mes && atual.cronograma_evento === ev
      && (atual.fase_ancora_id ?? null) === (salva.fase_ancora_id ?? null)) return o;
    mudou = true;
    return { ...o, inicio_mes: salva.inicio_mes, cronograma_evento: ev, fase_ancora_id: salva.fase_ancora_id ?? null } as OperacaoFunding;
  });
  return mudou ? saida : ops;
}

/**
 * Depois de "Usar esta", as operações que o plano CRIOU ganham id no servidor,
 * mas a alternativa aplicada ainda as tem sem id — reaplicá-la apagaria e
 * recriaria cada uma. Esta função religa SÓ a alternativa aplicada, com os ids
 * que o POST devolveu, na ordem em que o plano as criou: a mesma ordem das
 * operações da alternativa que `planoUsarAlternativa` manda criar (incluídas,
 * sem id ou com id que o salvo não tem, ou com tipo trocado). Sem heurística
 * de nome: nenhuma outra alternativa é tocada. `idsCriados` mais curto (plano
 * que parou no meio) religa só o que foi criado.
 * Não muta a entrada.
 */
export function religarAposUsar(
  alt: AlternativaFunding, salvasAntes: OperacaoFunding[], idsCriados: IdOp[],
): AlternativaFunding {
  const porId = new Map<IdOp, OperacaoFunding>();
  for (const s of salvasAntes) if (s.id != null) porId.set(s.id, s);
  let k = 0;
  const operacoes = alt.operacoes.map((op) => {
    if ((op as { __fora?: boolean }).__fora) return op;
    const salva = op.id != null ? porId.get(op.id) : undefined;
    const criada = !salva || salva.tipo !== op.tipo;
    if (!criada || k >= idsCriados.length) return op;
    return { ...op, id: idsCriados[k++] } as OperacaoFunding;
  });
  return { ...alt, operacoes };
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
    // Operação dispensada na tela (`__fora`) é AUSENTE da alternativa: a salva
    // é removida (o Financiamento à produção, desligado) e a nova não é criada.
    if ((op as { __fora?: boolean }).__fora) continue;
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

// ── validação do estado final ──────────────────────────────────────

const ROTULO_MODO: Record<string, string> = {
  permuta_financeira: 'Permuta financeira',
  resultado_final: 'Resultado final',
};

// Espelham as listas de `backend/rotas/funding.ts` (o frontend não importa de
// `backend/`: bundles separados). O teste de paridade em
// `funding-alternativas.test.ts` trava a divergência contra `validarCamposOperacao`.
const TIPOS_OPERACAO = ['financiamento_producao', 'divida', 'equity', 'antecipacao_recebiveis'];
const MODOS_RETORNO = ['permuta_financeira', 'resultado_final'];
const EVENTOS_ANCORA = ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra', 'customizado'];
const CAMPOS_NAO_NEGATIVOS = [
  'valor', 'inicio_mes', 'aporte_meses', 'taxa_anual',
  'periodo_amortizacao_meses', 'periodo_carencia_meses', 'pct_retorno',
  'exposicao_minima', 'percentual_financiavel',
  'taxa_estruturacao_pct', 'taxa_administracao_mensal', 'outros_encargos_iniciais',
  'pct_carteira_cedida',
];
const CAMPOS_PERCENTUAL_0_100 = ['exposicao_minima', 'percentual_financiavel', 'pct_retorno', 'taxa_estruturacao_pct', 'pct_carteira_cedida'];

/**
 * Reproduz TODAS as regras de `validarCamposOperacao` (backend/rotas/funding.ts),
 * na mesma ordem e com as mesmas condições. Devolve a mensagem ou `null`.
 * Fail-closed: o que o servidor recusaria, o painel recusa antes de gravar.
 */
export function validarOperacaoComoServidor(dados: Record<string, any>): string | null {
  if (dados.tipo !== undefined && !TIPOS_OPERACAO.includes(dados.tipo)) {
    return `tipo deve ser um de: ${TIPOS_OPERACAO.join(', ')}`;
  }
  if (dados.modo_retorno !== undefined && !MODOS_RETORNO.includes(dados.modo_retorno)) {
    return `modo_retorno deve ser um de: ${MODOS_RETORNO.join(', ')}`;
  }
  if (dados.cronograma_evento !== undefined && !EVENTOS_ANCORA.includes(dados.cronograma_evento)) {
    return `cronograma_evento deve ser um de: ${EVENTOS_ANCORA.join(', ')}`;
  }
  for (const campo of CAMPOS_NAO_NEGATIVOS) {
    if (dados[campo] === undefined || dados[campo] === null) continue;
    const v = Number(dados[campo]);
    if (!Number.isFinite(v)) return `${campo} deve ser numérico`;
    if (v < 0) return `${campo} não pode ser negativo`;
  }
  for (const campo of CAMPOS_PERCENTUAL_0_100) {
    if (dados[campo] === undefined || dados[campo] === null) continue;
    if (Number(dados[campo]) > 100) return `${campo} não pode passar de 100`;
  }
  if (dados.custo_linha_ids !== undefined && dados.custo_linha_ids !== null) {
    const lista = dados.custo_linha_ids;
    if (!Array.isArray(lista) || !lista.every((v: any) => Number.isFinite(Number(v)))) {
      return 'custo_linha_ids deve ser uma lista de números';
    }
  }
  const amort = dados.periodo_amortizacao_meses;
  const carencia = dados.periodo_carencia_meses;
  if (amort !== undefined && carencia !== undefined && Number(carencia) >= Number(amort) && Number(amort) > 0) {
    return 'periodo_carencia_meses deve ser menor que periodo_amortizacao_meses';
  }
  if (dados.aporte_meses !== undefined && Number(dados.aporte_meses) < 1) {
    return 'aporte_meses deve ser pelo menos 1';
  }
  if (dados.ativo !== undefined && typeof dados.ativo !== 'boolean') {
    return 'ativo deve ser um booleano';
  }
  if (dados.ativo === false && dados.tipo !== 'financiamento_producao') {
    return 'ativo só é aplicável ao Financiamento à produção';
  }
  return null;
}

// Campos numéricos de `avancado_funding_operacoes` no `schema.json` (cópia local: o
// frontend não importa de `backend/`); `true` = inteiro (`inteiro`/`referencia`), que
// `coagirNumericosDeclarados` exige inteiro. O teste de paridade trava a divergência.
const NUMERICOS_OPERACAO: Record<string, boolean> = {
  estudo_id: true, ordem: true, fase_ancora_id: true, inicio_mes: true, aporte_meses: true,
  periodo_amortizacao_meses: true, periodo_carencia_meses: true,
  valor: false, taxa_anual: false, pct_retorno: false, exposicao_minima: false, percentual_financiavel: false,
  taxa_estruturacao_pct: false, taxa_administracao_mensal: false, outros_encargos_iniciais: false, pct_carteira_cedida: false,
};
const RE_DECIMAL_ESTRITO = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/;

/** Espelha `numeroEstrito` (backend/rotas/coercao-numerica.ts): número finito ou string decimal estrita. */
function numeroEstritoComoServidor(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !RE_DECIMAL_ESTRITO.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Espelha `coagirNumericosDeclarados` (a `coagirOuRecusar` do POST/PATCH): `null` e
 * `undefined` passam; os demais precisam ser número estrito e, nos inteiros, inteiro.
 * Devolve a mensagem do primeiro campo que o servidor recusaria, ou `null`.
 */
export function coagirComoServidor(op: Record<string, any>): string | null {
  for (const [campo, inteiro] of Object.entries(NUMERICOS_OPERACAO)) {
    const v = op[campo];
    if (v === null || v === undefined) continue;
    const n = numeroEstritoComoServidor(v);
    if (n === null) return `Campo "${campo}" deve ser um número`;
    if (inteiro && !Number.isInteger(n)) return `Campo "${campo}" deve ser um número inteiro`;
  }
  return null;
}

const LIMITE_NOME = 100; // `limite` da coluna `nome` no schema.json

/**
 * Tudo o que o POST de uma operação recusa, na ordem do servidor: coerção numérica,
 * `tipo` e `nome` obrigatórios, depois `validarCamposOperacao`. Mais conservador que o
 * servidor no `nome` (só espaços conta como vazio; o schema declara `obrigatorio` e
 * `limite: 100`).
 */
export function recusaDoPostComoServidor(op: Record<string, any>): string | null {
  const coercao = coagirComoServidor(op);
  if (coercao) return coercao;
  if (!op.tipo) return 'tipo é obrigatório';
  if (typeof op.nome !== 'string' || !op.nome.trim()) return 'nome é obrigatório';
  if (op.nome.length > LIMITE_NOME) return `nome não pode passar de ${LIMITE_NOME} caracteres`;
  return validarOperacaoComoServidor(op);
}

/**
 * Espelho das regras do servidor (`somaRetornoExcede` e `validarCamposOperacao`
 * de `backend/rotas/funding.ts`) sobre o ESTADO FINAL da alternativa, antes de
 * gravar qualquer passo. Considera as operações que ficam gravadas: todas menos
 * as marcadas `__fora`, que o plano remove. O Financiamento à produção desligado
 * continua gravado e o servidor o valida inteiro no PATCH, então ele entra. Aplica `recusaDoPostComoServidor` a cada uma (coerção
 * numérica estrita, `tipo` e `nome` obrigatórios, `validarCamposOperacao`: tudo o que o
 * POST ou o PATCH recusariam no meio do plano, depois das remoções) e soma
 * `pct_retorno` dos equities por modo <= 100 (tolerância 100.01; modo padrão
 * permuta_financeira). Devolve uma mensagem por problema.
 */
export function errosDoEstadoFinal(alt: AlternativaFunding): string[] {
  const erros: string[] = [];
  const incluidas = (alt.operacoes as (OperacaoFunding & { __fora?: boolean })[])
    .filter((o) => !o.__fora);
  const porModo = new Map<string, number>();
  for (const o of incluidas) {
    const nome = o.nome || ROTULO_TIPO_ERRO[o.tipo] || o.tipo;
    const msg = recusaDoPostComoServidor(o as any);
    if (msg) erros.push(`"${nome}": ${msg}.`);
    if (o.tipo !== 'equity') continue;
    const pct = Number((o as any).pct_retorno) || 0;
    const modo = String((o as any).modo_retorno ?? 'permuta_financeira');
    porModo.set(modo, (porModo.get(modo) ?? 0) + pct);
  }
  for (const [modo, total] of porModo) {
    if (total > 100.01) {
      erros.push(`Equity em "${ROTULO_MODO[modo] ?? modo}": o retorno soma ${total.toFixed(2)}% e não pode passar de 100%.`);
    }
  }
  return erros;
}

const ROTULO_TIPO_ERRO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção', divida: 'Dívida', equity: 'Equity', antecipacao_recebiveis: 'Antecipação',
};

// ── persistência local ──────────────────────────────────────────────

const chaveDe = (estudoId: number | string): string => `viab:funding-alternativas:${estudoId}`;

/**
 * Cache em memória do módulo, por estudo: sem `localStorage` (bloqueado, cota
 * cheia) as alternativas sobrevivem à troca de aba, que desmonta o painel, até
 * recarregar a página.
 */
const memoria = new Map<string, AlternativaFunding[]>();

/** Só para teste: esvazia o cache em memória. */
export function limparCacheAlternativas(): void {
  memoria.clear();
}

function storagePadrao(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const daMemoria = (estudoId: number | string): AlternativaFunding[] =>
  (memoria.get(chaveDe(estudoId)) ?? []).slice(0, MAX_ALTERNATIVAS);

/**
 * Lê as alternativas do estudo. A memória da página, quando tem a chave, vence:
 * ela é gravada junto com o storage e é pelo menos tão nova (com a cota cheia o
 * `setItem` falha e o `getItem` devolveria a versão velha). O storage só é lido
 * na primeira leitura da página; dado inválido vira `[]`.
 */
export function lerAlternativas(estudoId: number | string, storage?: Storage | null): AlternativaFunding[] {
  if (memoria.has(chaveDe(estudoId))) return daMemoria(estudoId);
  let bruto: string | null | undefined;
  try {
    const st = storage === undefined ? storagePadrao() : storage;
    bruto = st?.getItem(chaveDe(estudoId));
  } catch {
    return [];
  }
  if (!bruto) return [];
  try {
    const dado = JSON.parse(bruto);
    if (!Array.isArray(dado)) return [];
    return dado
      .filter((a) => a && typeof a.id === 'string' && typeof a.nome === 'string' && Array.isArray(a.operacoes)
        && a.operacoes.every((o: any) => o && typeof o === 'object' && !Array.isArray(o) && typeof o.tipo === 'string'))
      .slice(0, MAX_ALTERNATIVAS);
  } catch {
    return [];
  }
}

/** Grava as alternativas (no máximo `MAX_ALTERNATIVAS`) no cache e no storage; devolve `false` se o storage falhou. */
export function gravarAlternativas(
  estudoId: number | string, alts: AlternativaFunding[], storage?: Storage | null,
): boolean {
  const corte = alts.slice(0, MAX_ALTERNATIVAS);
  memoria.set(chaveDe(estudoId), corte.map((a) => clonar(a)));
  try {
    const st = storage === undefined ? storagePadrao() : storage;
    if (!st) return false;
    st.setItem(chaveDe(estudoId), JSON.stringify(corte));
    return true;
  } catch {
    return false;
  }
}
