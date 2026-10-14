// Aba Terrenos do Painel: glebas, todas; lotes, todos que NÃO são de regularização fundiária.
//
// Um lote não carrega o tipo do parcelamento — herda via `parcelamento_id` →
// `parcelamentos.regularizacao` (booleano do módulo imobiliário). O módulo não filtra lote
// por essa coluna no servidor, então a lista inteira é trazida e o corte acontece aqui.
// Lote sem parcelamento não é regularização: entra.
//
// FAIL-CLOSED: sem o conjunto de parcelamentos de regularização (flag de leitura de
// `parcelamentos` ausente, erro de rede) NENHUM lote passa. Sem saber quais são de
// regularização, mostrar todos exibiria justamente os lotes que a regra manda esconder.

/** `regularizacao` vem como booleano; aceita também `1` e `'true'` por tolerância de serialização. */
function ehRegularizacao(p: any): boolean {
  const v = p?.regularizacao;
  return v === true || v === 1 || v === 'true';
}

/** Ids dos parcelamentos marcados como regularização fundiária. */
export function idsParcelamentosRegularizacao(parcelamentos: any[]): Set<number> {
  const ids = new Set<number>();
  for (const p of parcelamentos) {
    if (ehRegularizacao(p) && p?.id != null) ids.add(Number(p.id));
  }
  return ids;
}

/**
 * Lote só entra se o parcelamento dele NÃO for de regularização; `null` (conjunto não resolvido)
 * não deixa passar nenhum. Lote sem `parcelamento_id` entra.
 */
export function loteForaDaRegularizacao(lote: any, idsRegularizacao: Set<number> | null): boolean {
  if (!idsRegularizacao) return false;
  if (lote?.parcelamento_id == null) return true;
  return !idsRegularizacao.has(Number(lote.parcelamento_id));
}

const TETO_PAGINAS = 500; // guarda contra laço infinito se o Núcleo ignorar `pagina`.

/**
 * Pagina em laço — o Núcleo não tem "trazer tudo" (`node_modules/@urbiverso/sdk/docs/nucleo.md`
 * § Paginação). Com `paginas` na resposta, ele manda: um teto de servidor menor que `porPagina`
 * (o `por_pagina` acima do máximo é clampeado sem erro) devolve páginas curtas e NÃO encerra a
 * coleta. Sem `paginas`, cai na regra "página incompleta termina"; página vazia sempre termina.
 */
export async function coletarPaginas(
  buscar: (pagina: number) => Promise<any>,
  porPagina: number,
): Promise<any[]> {
  const todos: any[] = [];
  for (let pagina = 1; pagina <= TETO_PAGINAS; pagina++) {
    const res = await buscar(pagina);
    const dados: any[] = res?.dados ?? [];
    todos.push(...dados);
    if (dados.length === 0) return todos;
    const totalPaginas = Number(res?.paginas);
    if (totalPaginas > 0 ? pagina >= totalPaginas : dados.length < porPagina) return todos;
  }
  // Chegou ao teto sem ver a última página: lista parcial NÃO é devolvida. Truncar a varredura de
  // parcelamentos faria lotes de parcelamento de regularização (que ficou de fora) aparecerem.
  throw new Error(`a listagem passou de ${TETO_PAGINAS} páginas e foi recusada por estar incompleta`);
}
