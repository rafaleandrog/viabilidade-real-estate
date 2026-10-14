// Complemento de terreno: dados de viabilidade de uma gleba ou de um lote que o módulo
// imobiliário não guarda (tabela `terrenos_complemento`). Lógica pura da tela — rótulos, ida e
// volta entre o registro e o formulário. O backend (`backend/rotas/terrenos-complemento.ts`)
// valida de novo: a fronteira real é lá.

import type { CorBadge } from './viab-shared.js';

export interface OpcaoRotulada { valor: string; rotulo: string; }

export const SITUACOES: OpcaoRotulada[] = [
  { valor: 'prospeccao', rotulo: 'Prospecção' },
  { valor: 'em_negociacao', rotulo: 'Em negociação' },
  { valor: 'opcao_compra', rotulo: 'Opção de compra' },
  { valor: 'adquirido', rotulo: 'Adquirido' },
  { valor: 'descartado', rotulo: 'Descartado' },
];
export const TOPOGRAFIAS: OpcaoRotulada[] = [
  { valor: 'plana', rotulo: 'Plana' },
  { valor: 'leve', rotulo: 'Levemente inclinada' },
  { valor: 'acentuada', rotulo: 'Acentuada' },
];
export const INFRAESTRUTURAS: OpcaoRotulada[] = [
  { valor: 'completa', rotulo: 'Completa' },
  { valor: 'parcial', rotulo: 'Parcial' },
  { valor: 'inexistente', rotulo: 'Inexistente' },
];

/** Cor do badge de situação (variantes do `urbi-badge`, as mesmas de `COR_STATUS`). */
export const COR_SITUACAO: Record<string, CorBadge> = {
  prospeccao: 'padrao', em_negociacao: 'alerta', opcao_compra: 'info', adquirido: 'sucesso', descartado: 'perigo',
};

export function rotuloDe(opcoes: OpcaoRotulada[], valor: unknown): string {
  return opcoes.find((o) => o.valor === valor)?.rotulo ?? '';
}

const NUMERICOS = ['preco_pedido', 'coeficiente_aproveitamento', 'taxa_ocupacao_pct', 'gabarito_pavimentos'] as const;
const TEXTOS = [
  'situacao_negociacao', 'proprietario', 'contato', 'zoneamento', 'topografia', 'infraestrutura',
  'restricoes', 'observacoes',
] as const;

/** `decimal` chega do backend como string (`"1500000.00"`); a tela trabalha com número. */
export function paraNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type FormComplemento = Record<string, string | number | null>;

/** Registro (ou nada) → estado do formulário: texto nunca nulo, número `number | null`. */
export function formDoComplemento(registro: any | null): FormComplemento {
  const f: FormComplemento = {};
  for (const c of TEXTOS) f[c] = registro?.[c] ?? '';
  for (const c of NUMERICOS) f[c] = paraNumero(registro?.[c]);
  return f;
}

/**
 * Formulário → corpo do PUT. Manda TODOS os campos: limpar um campo na tela tem que limpá-lo no
 * banco (texto vazio e `null` o zeram no backend). Um PUT parcial deixaria o valor antigo.
 */
export function payloadDoForm(form: FormComplemento): Record<string, any> {
  const p: Record<string, any> = {};
  for (const c of TEXTOS) p[c] = String(form[c] ?? '').trim() || null;
  for (const c of NUMERICOS) p[c] = form[c] ?? null;
  return p;
}

/** Erro local antes de ir ao servidor — só o que a tela consegue dizer melhor que o 400. */
export function validarForm(form: FormComplemento): string {
  const taxa = form.taxa_ocupacao_pct;
  if (typeof taxa === 'number' && (taxa < 0 || taxa > 100)) return 'A taxa de ocupação deve estar entre 0 e 100%.';
  for (const c of NUMERICOS) {
    const v = form[c];
    if (typeof v === 'number' && v < 0) return 'Os valores numéricos não podem ser negativos.';
  }
  const pav = form.gabarito_pavimentos;
  if (typeof pav === 'number' && !Number.isInteger(pav)) return 'O gabarito deve ser um número inteiro de pavimentos.';
  return '';
}

/** Índice dos registros por id do imóvel no módulo. */
export function indexarComplementos(registros: any[]): Map<number, any> {
  const m = new Map<number, any>();
  for (const r of registros) if (r?.imovel_nucleo_id != null) m.set(Number(r.imovel_nucleo_id), r);
  return m;
}
