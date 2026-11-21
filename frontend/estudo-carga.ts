/**
 * Corrida nas cargas do estudo (#907): `tela-estudo` dispara `buscarEstudo`
 * na montagem, a cada mudança de `estudoId`, em `terreno-alterado` e após a
 * troca de status, e nada garantia a ORDEM das respostas.
 *
 * Garantia deste módulo: cada pedido recebe um token crescente, e só a
 * resposta (ou o erro) do ÚLTIMO pedido emitido é aplicada — o que cobre a
 * troca A→B, A→B→A (elemento reaproveitado) e duas recargas do mesmo estudo.
 * Comparar só o id não bastaria: dois pedidos do mesmo id seguiriam sem ordem.
 * Sem DOM, para ser testável (convenção do repo).
 */
export type ResultadoCarga<T> =
  | { ultimo: true; resposta: T }
  | { ultimo: true; erro: unknown }
  | { ultimo: false };

export class SequenciaDeCargas {
  private _ultimo = 0;

  /** Verdadeiro só para o pedido mais recente. */
  ehUltimo(token: number): boolean {
    return token === this._ultimo;
  }

  /** Emite um pedido e devolve o resultado só se ele ainda for o último. */
  async carregar<T>(buscar: () => Promise<T>): Promise<ResultadoCarga<T>> {
    const token = ++this._ultimo;
    try {
      const resposta = await buscar();
      return this.ehUltimo(token) ? { ultimo: true, resposta } : { ultimo: false };
    } catch (erro) {
      return this.ehUltimo(token) ? { ultimo: true, erro } : { ultimo: false };
    }
  }
}
