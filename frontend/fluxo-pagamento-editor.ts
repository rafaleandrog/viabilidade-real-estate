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
  // #345: apos_entrega_meses deixou de ser lido pelo motor (repasse travado
  // em 1 mês após o fim da obra, sempre). O campo sobrevive só como
  // passagem para não descartar o valor persistido de estudo legado — sem
  // migração, sem efeito no cálculo, sem controle editável na UI.
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

// ─────────────────────────────────────────────────────────────────────────
// #436: juros de tabela já persistidos, em LEITURA
// ─────────────────────────────────────────────────────────────────────────

/** Uma taxa distinta encontrada nos componentes, com os componentes que a usam. */
export interface JurosDeTabela {
  /**
   * Taxa ANUAL equivalente, em pontos percentuais — `(1 + i_m)^12 − 1`, com
   * **precisão plena** (contrato C7: derivada não monetária arredonda só para
   * exibir). Quem exibe usa `fmtPct`, que dá 1 casa.
   */
  anualPct: number;
  /** Rótulo de cada componente que carrega esta taxa, na ordem em que aparecem. */
  rotulos: string[];
}

/**
 * Lê os juros de tabela que já estão persistidos em `fluxo_pagamento.componentes`
 * e os converte para taxa anual equivalente, agrupando por taxa.
 *
 * Existe porque hoje `taxaMensal` entra no resultado (VGV, margem, TIR) sem
 * aparecer em lugar nenhum da interface — o usuário lê a TIR e não tem como
 * descobrir de onde ela vem. Isto NÃO edita nem recalcula nada: só deixa de
 * esconder. O campo editável é issue própria, da qual esta é pré-requisito.
 *
 * Taxa `0` não entra: o bloco só existe para revelar juros que existem.
 * O agrupamento usa a taxa já arredondada para 1 casa — a mesma precisão em
 * que ela será exibida (contrato C7: % calculado carrega 1 casa) —, então
 * duas taxas que só divergem além da casa exibida aparecem como uma linha só,
 * que é o que a tela pode honestamente distinguir.
 */
export function jurosDeTabelaConfigurados(fluxoPagamento: any): JurosDeTabela[] {
  const comps = Array.isArray(fluxoPagamento?.componentes) ? fluxoPagamento.componentes : [];
  const porTaxa = new Map<number, JurosDeTabela>();
  for (const c of comps) {
    const mensal = Number(c?.taxaMensal);
    if (!Number.isFinite(mensal) || mensal === 0) continue;
    const anualPct = (Math.pow(1 + mensal, 12) - 1) * 100;
    // A chave agrupa pela precisão EXIBIDA (1 casa) — duas taxas que só divergem
    // além dela aparecem numa linha só, que é o que a tela pode honestamente
    // distinguir. Mas o VALOR guardado é o cru: `anualPct` é derivada não
    // monetária, e o C7 manda carregar precisão plena e arredondar só para
    // exibir, o que `fmtPct` faz.
    const chave = Math.round(anualPct * 10) / 10;
    // ⚠️ E o filtro de "sem juros" é aqui, não só no `mensal === 0` acima: uma
    // taxa mensal minúscula (0,003% a.m. → 0,036% a.a.) exibiria
    // "0,0% a.a." acompanhada do aviso vermelho de destruição — anunciando juros
    // que a tela não consegue mostrar.
    if (chave === 0) continue;
    const rotulo = typeof c?.rotulo === 'string' && c.rotulo.trim() !== '' ? c.rotulo : String(c?.tipo ?? 'componente');
    const ja = porTaxa.get(chave);
    if (ja) ja.rotulos.push(rotulo);
    else porTaxa.set(chave, { anualPct, rotulos: [rotulo] });
  }
  return [...porTaxa.values()];
}
