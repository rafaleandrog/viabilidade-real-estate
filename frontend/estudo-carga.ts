/**
 * Corrida na troca de estudo (#907): `tela-estudo` dispara `buscarEstudo(id)`
 * a cada mudança de `estudoId`, e nada garantia a ORDEM das respostas — a do
 * estudo anterior podia chegar depois e sobrescrever a tela do novo.
 *
 * A decisão mora aqui, função assíncrona sem DOM, para ser testável sem
 * montar o componente (convenção do repo). `idAtual` é lido DEPOIS do await:
 * é o id que a tela mostra agora, não o do momento do pedido.
 */
export type ResultadoCarga<T> = { atual: true; resposta: T } | { atual: false };

export async function carregarSeAindaAtual<T>(
  idPedido: number,
  buscar: (id: number) => Promise<T>,
  idAtual: () => number | undefined,
): Promise<ResultadoCarga<T>> {
  const resposta = await buscar(idPedido);
  if (idAtual() !== idPedido) return { atual: false };
  return { atual: true, resposta };
}
