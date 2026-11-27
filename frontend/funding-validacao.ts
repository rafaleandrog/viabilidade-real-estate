// Espelho, no navegador, das regras com que o servidor recusa uma operação de
// funding (`backend/rotas/funding.ts` e a coerção numérica de
// `backend/rotas/coercao-numerica.ts`).
//
// Módulo PURO, sem lit/html. O frontend não importa de `backend/` (bundles
// separados), então as listas e as regras são cópia — e cada uma é travada
// contra a função real do servidor pelos testes de paridade em
// `funding-validacao.test.ts`, que carregam o módulo do servidor em tempo de
// execução.
//
// Quem usa: a janela de criar e editar operação (recusa no próprio lugar, antes
// de gravar). Fail-closed: o que o servidor recusaria, a tela recusa antes de
// mandar.
import type { OperacaoFunding } from './funding-motor.js';

/**
 * Os campos que as rotas de operação gravam — espelho exato de
 * `CAMPOS_OPERACAO` (backend/rotas/avancado.ts), travado pelo teste de
 * paridade.
 */
export const CAMPOS_OPERACAO_ESPELHO = [
  'tipo', 'nome', 'ordem', 'valor',
  'cronograma_evento', 'fase_ancora_id', 'inicio_mes',
  'distribuir_aporte', 'aporte_meses', 'taxa_anual',
  'periodo_amortizacao_meses', 'periodo_carencia_meses',
  'modo_retorno', 'pct_retorno',
  'exposicao_minima', 'percentual_financiavel', 'amortizar_com_caixa_disponivel', 'custo_linha_ids',
  'taxa_estruturacao_pct', 'taxa_administracao_mensal', 'outros_encargos_iniciais',
  'pct_carteira_cedida', 'ativo',
];

export const ROTULO_MODO: Record<string, string> = {
  permuta_financeira: 'Permuta financeira',
  resultado_final: 'Resultado final',
};

export const ROTULO_TIPO_ERRO: Record<string, string> = {
  financiamento_producao: 'Financiamento à produção', divida: 'Dívida', equity: 'Equity', antecipacao_recebiveis: 'Antecipação',
};

// Espelham as listas de `backend/rotas/funding.ts`.
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
export const NUMERICOS_OPERACAO: Record<string, boolean> = {
  estudo_id: true, ordem: true, fase_ancora_id: true, inicio_mes: true, aporte_meses: true,
  periodo_amortizacao_meses: true, periodo_carencia_meses: true,
  valor: false, taxa_anual: false, pct_retorno: false, exposicao_minima: false, percentual_financiavel: false,
  taxa_estruturacao_pct: false, taxa_administracao_mensal: false, outros_encargos_iniciais: false, pct_carteira_cedida: false,
};
const RE_DECIMAL_ESTRITO = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/;

/** Espelha `numeroEstrito` (backend/rotas/coercao-numerica.ts): número finito ou string decimal estrita. */
export function numeroEstritoComoServidor(v: unknown): number | null {
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

export const LIMITE_NOME = 100; // `limite` da coluna `nome` no schema.json

/**
 * O nome que a tela aceita: não vazio (só espaços conta como vazio) e até
 * `LIMITE_NOME` caracteres. É a regra do POST, e a tela a aplica também na
 * edição — mais estrito que o PATCH do servidor, que não recusa nome vazio.
 */
export function recusaDoNome(nome: unknown): string | null {
  if (typeof nome !== 'string' || !nome.trim()) return 'nome é obrigatório';
  if (nome.length > LIMITE_NOME) return `nome não pode passar de ${LIMITE_NOME} caracteres`;
  return null;
}

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
  const nome = recusaDoNome(op.nome);
  if (nome) return nome;
  return validarOperacaoComoServidor(op);
}

/** Espelha `trocaDeTipoBloqueada` (backend/rotas/funding.ts): o PATCH recusa troca de `tipo`. */
export function trocaDeTipoComoServidor(gravada: { tipo?: unknown }, patch: Record<string, any>): boolean {
  return patch.tipo !== undefined && patch.tipo !== gravada.tipo;
}

/**
 * O que o PATCH de uma operação recusa, na ordem do servidor: coerção numérica do
 * patch, troca de `tipo` (422 `TIPO_IMUTAVEL`) e `validarCamposOperacao` sobre o
 * estado FINAL (gravada + patch). A soma de retorno do equity não é regra de
 * campo: é `errosRetornoPorModo`.
 */
export function recusaDoPatchComoServidor(gravada: Record<string, any>, patch: Record<string, any>): string | null {
  const coercao = coagirComoServidor(patch);
  if (coercao) return coercao;
  if (trocaDeTipoComoServidor(gravada, patch)) return 'o tipo de uma operação não muda depois de criada';
  return validarOperacaoComoServidor({ ...gravada, ...patch });
}

/** Tolerância da soma de retorno por modo — a mesma de `somaRetornoExcede`. */
const TETO_RETORNO = 100.01;

/**
 * Espelha `somaRetornoExcede` (backend/rotas/funding.ts): a soma de
 * `pct_retorno` dos equities do MESMO `modo_retorno` não passa de 100%
 * (tolerância 100,01; modo padrão `permuta_financeira`). Uma mensagem por modo
 * que excede.
 */
export function errosRetornoPorModo(operacoes: readonly OperacaoFunding[]): string[] {
  const porModo = new Map<string, number>();
  for (const o of operacoes) {
    if (o.tipo !== 'equity') continue;
    const pct = Number((o as any).pct_retorno) || 0;
    const modo = String((o as any).modo_retorno ?? 'permuta_financeira');
    porModo.set(modo, (porModo.get(modo) ?? 0) + pct);
  }
  const erros: string[] = [];
  for (const [modo, total] of porModo) {
    if (total > TETO_RETORNO) {
      erros.push(`Equity em "${ROTULO_MODO[modo] ?? modo}": o retorno soma ${total.toFixed(2)}% e não pode passar de 100%.`);
    }
  }
  return erros;
}

/**
 * As regras do servidor sobre um ESTADO FINAL de operações gravadas, antes de
 * gravar qualquer passo: `recusaDoPostComoServidor` em cada uma (coerção
 * numérica estrita, `tipo` e `nome` obrigatórios, `validarCamposOperacao`) e a
 * soma de retorno do equity por modo. Devolve uma mensagem por problema.
 */
export function errosDoEstadoFinal(operacoes: readonly OperacaoFunding[]): string[] {
  const erros: string[] = [];
  for (const o of operacoes) {
    const nome = o.nome || ROTULO_TIPO_ERRO[o.tipo] || o.tipo;
    const msg = recusaDoPostComoServidor(o as any);
    if (msg) erros.push(`"${nome}": ${msg}.`);
  }
  return [...erros, ...errosRetornoPorModo(operacoes)];
}
