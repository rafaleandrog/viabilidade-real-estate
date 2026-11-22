// Troca de unidade (m² ↔ %) de uma linha da cascata de áreas do Loteamento —
// #904. Função pura, para a decisão ter teste próprio; quem a chama é
// `frontend/tela-premissas.ts` (`_trocarModoArea` e `_renderSeletorArea`).
//
// O valor de uma linha em % só existe em relação a uma âncora: a Poligonal
// (`pct_poligonal`) ou a Parcelável (`pct_parcelavel`). Com a âncora em 0 não
// há conversão possível nos dois sentidos: ir para % daria 0 % de qualquer
// área, e sair de % daria 0 m² — nos dois casos o valor digitado se perdia.
// A troca fica bloqueada, o valor e o modo ficam como estão, e a tela diz o
// motivo.

export type ModoArea = 'm2' | 'pct_poligonal' | 'pct_parcelavel';

export const MOTIVO_SEM_POLIGONAL =
  'Sem área da poligonal, a unidade em % fica bloqueada: informe a área do terreno para converter.';
export const MOTIVO_SEM_PARCELAVEL =
  'Com a área parcelável em zero, a unidade % Parc. fica bloqueada: não há base para converter.';

function ancoraDoModo(modo: string, ancora1: number, ancora2: number | null): number | null {
  if (modo === 'pct_poligonal') return ancora1;
  if (modo === 'pct_parcelavel') return ancora2;
  return null; // m²: não depende de âncora
}

/** Motivo pelo qual a troca de `modoAtual` para `novoModo` não pode ser feita,
 *  ou `null` quando pode. Bloqueia se o modo de ORIGEM ou o de DESTINO depende
 *  de uma âncora que não é maior que zero. */
export function motivoBloqueioTrocaModoArea(
  modoAtual: string, novoModo: string, ancora1: number, ancora2: number | null,
): string | null {
  if (novoModo === modoAtual) return null;
  for (const modo of [modoAtual, novoModo]) {
    if (modo === 'm2') continue;
    const ancora = ancoraDoModo(modo, ancora1, ancora2);
    if (ancora == null || !(ancora > 0)) {
      return modo === 'pct_poligonal' ? MOTIVO_SEM_POLIGONAL : MOTIVO_SEM_PARCELAVEL;
    }
  }
  return null;
}

/** Valor da linha no modo novo, a partir do m² já resolvido. Só é chamada
 *  quando `motivoBloqueioTrocaModoArea` devolve `null`, então a âncora de um
 *  modo em % é sempre maior que zero aqui. */
export function valorNoModoArea(novoModo: string, m2: number, ancora1: number, ancora2: number | null): number {
  if (novoModo === 'pct_poligonal') return (m2 / ancora1) * 100;
  if (novoModo === 'pct_parcelavel') return (m2 / (ancora2 as number)) * 100;
  return m2;
}
