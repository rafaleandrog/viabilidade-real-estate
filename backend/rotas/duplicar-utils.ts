// Utilitário compartilhado pela duplicação de estudo (`POST /estudos/:id/duplicar`).
// Vive em arquivo próprio para evitar import circular: `estudos.ts` já importa de
// `avancado.ts` (via `duplicarDadosAvancado`), então `avancado.ts` não pode importar
// de volta de `estudos.ts`.

/**
 * Remove do objeto as chaves cujo valor é `null` — o validador do shell rejeita `null`
 * explícito em coluna `decimal`/`inteiro` na criação (`req.dados!.criar`), mesmo quando
 * a coluna é `nullable`. Omitir a chave cai no `padrao` da coluna, que para as colunas
 * tratadas aqui é a ausência de valor — ausente e `null` chegam ao mesmo estado
 * persistido, então a cópia continua exata.
 *
 * Aplicar SÓ nesta fronteira de escrita, nunca dentro de `montarCopiasFilhas`/
 * `extrairCampos`: essas funções preservam `null` de propósito (#609), para
 * distinguir "usuário apagou o valor" de "campo nunca existiu" na representação
 * intermediária da linha copiada.
 */
export function omitirValoresNulos<T extends Record<string, any>>(obj: T): Partial<T> {
  const saida: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) continue;
    saida[k as keyof T] = v;
  }
  return saida;
}
