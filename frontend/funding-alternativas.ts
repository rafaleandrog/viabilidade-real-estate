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
import type { FundingCalc, OperacaoFunding } from './funding-motor.js';
import { CAMPOS_OPERACAO_ESPELHO, errosDoEstadoFinal as errosDoEstadoFinalDasOperacoes } from './funding-validacao.js';

/** Máximo de alternativas guardadas por estudo. */
export const MAX_ALTERNATIVAS = 3;

export interface AlternativaFunding {
  id: string;
  nome: string;
  operacoes: OperacaoFunding[];
}

// Os indicadores de uma estrutura moraram aqui e se mudaram para
// `funding-estrutura.ts`, o núcleo de cálculo da Estrutura de capital. A
// reexportação mantém os importadores de hoje (a tela de Funding, o teste deste
// módulo e o caso de render da comparação) compilando sem mudança.
export { indicadoresEstrutura, type IndicadoresEstrutura } from './funding-estrutura.js';

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
 * guardada antes de a âncora andar teria o mês velho, e uma guardada antes de a
 * fase ser apagada teria uma âncora que não existe mais: aqui as operações que
 * existem no funding salvo e estão ancoradas lá OU na alternativa recebem a
 * âncora e o mês do salvo, para a simulação e o plano verem o que o servidor
 * vai gravar.
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
    const atual = o as any;
    const ancoradaNoSalvo = (!!ev && ev !== 'customizado') || salva.fase_ancora_id != null;
    const ancoradaNaAlternativa = (!!atual.cronograma_evento && atual.cronograma_evento !== 'customizado')
      || atual.fase_ancora_id != null;
    // As duas direções: âncora que andou, e âncora que deixou de existir (fase
    // apagada anula `fase_ancora_id` no salvo; o mês ficou customizado lá).
    if (!ancoradaNoSalvo && !ancoradaNaAlternativa) return o;
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
 * recriaria cada uma. Esta função religa SÓ a alternativa aplicada, com as
 * linhas que o POST devolveu, na ordem em que o plano as criou: a mesma ordem
 * das operações da alternativa que `planoUsarAlternativa` manda criar
 * (incluídas, sem id ou com id que o salvo não tem, ou com tipo trocado).
 * A operação religada passa a ser a linha COMPLETA do servidor com os valores
 * da alternativa por cima: um campo que só o servidor preencheu (padrão do
 * schema) entra na comparação do plano, e uma edição posterior dele no funding
 * salvo aparece como diferença. Sem heurística de nome: nenhuma outra
 * alternativa é tocada. Lista mais curta (plano que parou no meio) religa só o
 * que foi criado. Não muta a entrada.
 */
export function religarAposUsar(
  alt: AlternativaFunding, salvasAntes: OperacaoFunding[], criadas: OperacaoFunding[],
): AlternativaFunding {
  const porId = new Map<IdOp, OperacaoFunding>();
  for (const s of salvasAntes) if (s.id != null) porId.set(s.id, s);
  let k = 0;
  const operacoes = alt.operacoes.map((op) => {
    if ((op as { __fora?: boolean }).__fora) return op;
    const salva = op.id != null ? porId.get(op.id) : undefined;
    const criada = !salva || salva.tipo !== op.tipo;
    if (!criada || k >= criadas.length) return op;
    const linha = criadas[k++];
    if (!linha || linha.id == null) return op;
    const { id: _id, ...valores } = op;
    return { ...clonar(linha), ...valores, id: linha.id } as OperacaoFunding;
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
const CAMPOS_GRAVAVEIS = new Set(CAMPOS_OPERACAO_ESPELHO.filter((c) => c !== 'ordem'));

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
      // Só os campos que a rota grava: metadado da linha (updated_at e afins)
      // e `ordem` nunca viram diferença — um PATCH só com eles volta 400.
      if (!CAMPOS_GRAVAVEIS.has(k)) continue;
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

// O espelho das regras do servidor (`validarOperacaoComoServidor`,
// `recusaDoPostComoServidor`, `coagirComoServidor`, a soma de retorno do equity
// por modo e `CAMPOS_OPERACAO_ESPELHO`) mudou para `funding-validacao.ts`, que a
// janela de operação também usa e que sobrevive à saída desta aba. A
// reexportação mantém os importadores de hoje compilando sem mudança.
export {
  validarOperacaoComoServidor, recusaDoPostComoServidor, coagirComoServidor, CAMPOS_OPERACAO_ESPELHO,
} from './funding-validacao.js';

/**
 * O estado final da ALTERNATIVA: as operações que ficam gravadas, isto é,
 * todas menos as marcadas `__fora`, que o plano remove (o Financiamento à
 * produção desligado continua gravado e entra). Só delega a
 * `errosDoEstadoFinal` de `funding-validacao.ts`, que opera sobre a lista.
 */
export function errosDoEstadoFinal(alt: AlternativaFunding): string[] {
  const incluidas = (alt.operacoes as (OperacaoFunding & { __fora?: boolean })[]).filter((o) => !o.__fora);
  return errosDoEstadoFinalDasOperacoes(incluidas);
}

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
