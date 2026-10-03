// Aba Terrenos do Painel: só lotes do setor Urbitá aparecem; glebas, qualquer uma.
//
// Um lote não carrega o setor — herda via `parcelamento_id` → `parcelamentos.
// setor_habitacional_id` → `setores_habitacionais`. O Núcleo não filtra lote por
// setor no servidor (`camposFiltro` de /lotes só alcança `parcelamento_id`), então
// a lista inteira é trazida e o corte acontece aqui.
//
// FAIL-CLOSED: sem o conjunto de parcelamentos do setor (setor não encontrado,
// flag de leitura ausente, erro de rede) NENHUM lote passa. Diferente do filtro
// de regularização do seletor de lote, que desliga quando falha — aqui desligar
// mostraria justamente os lotes que a regra manda esconder.

/** Texto que identifica o setor no `slug` ou no `nome` (comparado sem acento nem caixa). */
export const SETOR_URBITA = 'urbita';

const TETO_PAGINAS = 500; // guarda contra laço infinito se o Núcleo ignorar `pagina`.

export function normalizarTexto(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Ids dos setores habitacionais cujo slug ou nome contém "urbitá". */
export function idsSetoresUrbita(setores: any[]): Set<number> {
  const ids = new Set<number>();
  for (const s of setores) {
    const casa = normalizarTexto(s?.slug).includes(SETOR_URBITA)
      || normalizarTexto(s?.nome).includes(SETOR_URBITA);
    if (casa && s?.id != null) ids.add(Number(s.id));
  }
  return ids;
}

/** Ids dos parcelamentos vinculados a algum dos setores. `!= null` de propósito: `0` seria um id. */
export function idsParcelamentosDosSetores(parcelamentos: any[], idsSetor: Set<number>): Set<number> {
  const ids = new Set<number>();
  for (const p of parcelamentos) {
    if (p?.setor_habitacional_id != null && idsSetor.has(Number(p.setor_habitacional_id))) {
      ids.add(Number(p.id));
    }
  }
  return ids;
}

/** Lote só entra se o parcelamento dele estiver no conjunto; `null` (setor não resolvido) não deixa passar nenhum. */
export function loteDoSetor(lote: any, idsParcelamento: Set<number> | null): boolean {
  if (!idsParcelamento || lote?.parcelamento_id == null) return false;
  return idsParcelamento.has(Number(lote.parcelamento_id));
}

/** Pagina em laço até a página vir incompleta — o Núcleo não tem "trazer tudo" (docs/shell/nucleo.md § Paginação). */
export async function coletarPaginas(
  buscar: (pagina: number) => Promise<any>,
  porPagina: number,
): Promise<any[]> {
  const todos: any[] = [];
  for (let pagina = 1; pagina <= TETO_PAGINAS; pagina++) {
    const res = await buscar(pagina);
    const dados: any[] = res?.dados ?? [];
    todos.push(...dados);
    const totalPaginas = Number(res?.paginas) || 1;
    if (dados.length < porPagina || pagina >= totalPaginas) break;
  }
  return todos;
}
