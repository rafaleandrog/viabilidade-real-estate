import { componentesDoLegado, type ComponentePagamento } from './fluxo-caixa-motor.js';
import type { EventoCrono } from './fluxo-shared.js';

const n = (v: any): number => Number(v) || 0;
const lista = (v: any): any[] => Array.isArray(v)
  ? v.map((x) => ({ ...x }))
  : (v && typeof v === 'object' ? [{ ...v }] : []);

export interface FormularioPagamento {
  comissao: { ativo: boolean; tipo: string; pct: number };
  ret: { ativo: boolean; pct: number };
  entrada: any[];
  parcelas: any[];
  repasse: { apos_entrega_meses: number };
}

/**
 * #248: abre tanto o shape legado quanto o contrato canônico criado pela
 * própria tela. Durante a transição até #283, escritas novas mantêm o espelho
 * legado; ele garante que o motor vigente continue calculando exatamente o
 * mesmo fluxo enquanto `componentes` passa a ser a fonte canônica persistida.
 */
export function formularioPagamento(fluxoPagamento: any): FormularioPagamento {
  const fp = fluxoPagamento ?? {};
  const entradas = lista(fp.entrada);
  const parcelas = lista(fp.parcelas);
  return {
    comissao: {
      ativo: fp.comissao?.ativo ?? true,
      tipo: fp.comissao?.tipo ?? 'embutida',
      pct: n(fp.comissao?.pct),
    },
    ret: { ativo: fp.ret?.ativo ?? false, pct: n(fp.ret?.pct) },
    entrada: entradas.length ? entradas : [{ pct: 15, parcelas: 1, descontoPct: 0 }],
    parcelas: parcelas.length
      ? parcelas
      : [{ periodicidade: 'mensal', parcelas: 0, ao_longo_obra: true, pct: 15 }],
    repasse: { apos_entrega_meses: n(fp.repasse?.apos_entrega_meses) },
  };
}

function percentualValido(v: any): boolean {
  const valor = Number(v);
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

/** Validação local bloqueante; o backend repete o contrato por segurança. */
export function erroFormularioPagamento(form: FormularioPagamento, cronograma: EventoCrono[]): string | null {
  for (const e of form.entrada) {
    if (!percentualValido(e.pct)) return 'Cada percentual de entrada deve ficar entre 0% e 100%.';
    if (!Number.isInteger(Number(e.parcelas)) || Number(e.parcelas) < 1) {
      return 'A quantidade de parcelas da entrada deve ser um inteiro maior que zero.';
    }
  }
  for (const p of form.parcelas) {
    if (!percentualValido(p.pct)) return 'Cada percentual de parcelamento deve ficar entre 0% e 100%.';
    if (!p.ao_longo_obra && (!Number.isInteger(Number(p.parcelas)) || Number(p.parcelas) < 1)) {
      return 'O prazo fixo deve ter ao menos uma parcela mensal.';
    }
  }
  if (!Number.isInteger(Number(form.repasse.apos_entrega_meses)) || Number(form.repasse.apos_entrega_meses) < 0) {
    return 'O prazo do repasse deve ser um número inteiro não negativo.';
  }

  const somaInformada = [...form.entrada, ...form.parcelas].reduce((s, item) => s + n(item.pct), 0);
  if (somaInformada > 100.01) {
    return `Entrada e parcelamento somam ${somaInformada.toFixed(2)}%; o total não pode superar 100%.`;
  }
  const componentes = componentesDoLegado(form, cronograma);
  const somaComponentes = componentes.reduce((s, c) => s + n(c.participacaoPct), 0);
  if (Math.abs(somaComponentes - 100) > 0.01) {
    return `A soma dos componentes deve ser 100% (atual: ${somaComponentes.toFixed(2)}%).`;
  }
  return null;
}

/**
 * Persiste o contrato canônico e, temporariamente, o espelho legado. O espelho
 * será removível quando #283 ligar `componentes` ao cálculo consolidado.
 */
export function fluxoPagamentoParaSalvar(
  form: FormularioPagamento,
  cronograma: EventoCrono[],
): FormularioPagamento & { componentes: ComponentePagamento[]; aplicado: true } {
  return {
    ...form,
    entrada: form.entrada.map((e) => ({ ...e })),
    parcelas: form.parcelas.map((p) => ({ ...p, periodicidade: p.periodicidade || 'mensal' })),
    repasse: { ...form.repasse },
    componentes: componentesDoLegado(form, cronograma),
    aplicado: true,
  };
}
