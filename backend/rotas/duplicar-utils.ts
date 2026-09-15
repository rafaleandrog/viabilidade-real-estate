// Utilitário compartilhado pela duplicação de estudo (`POST /estudos/:id/duplicar`).
// Vive em arquivo próprio para evitar import circular: `estudos.ts` já importa de
// `avancado.ts` (via `duplicarDadosAvancado`), então `avancado.ts` não pode importar
// de volta de `estudos.ts`.

/**
 * Remove do objeto as chaves cujo valor é `null`.
 *
 * ⚠️ **A justificativa original desta função era FALSA, e foi corrigida em
 * 2026-09-15.** Ela dizia que *"o validador do shell rejeita `null` explícito em
 * coluna `decimal`/`inteiro`, mesmo quando a coluna é nullable"*. Medido contra
 * o shell 0.55.22, `shell/backend/src/dados/validacao-dados.ts` faz, tanto em
 * `validarInsert` quanto em `validarUpdate`:
 *
 *     if (valor === null || valor === undefined) continue;  // optional field set to null is fine
 *
 * `null` em coluna opcional é **aceito**. O que o shell recusa é
 * `typeof valor !== 'number'` — ou seja **string**, que é como toda coluna
 * `decimal` volta do Postgres (o shell só registra type parser customizado para
 * `DATE`). Era essa string, e não o `null`, que quebrava a duplicação na #714 e
 * o "Salvar premissas" na #694. Quem resolve isso é `./coercao-numerica.ts`,
 * que tem o histórico completo.
 *
 * **Então por que esta função continua?** Porque removê-la é uma mudança de
 * comportamento de DUPLICAÇÃO, não de validação, e merece decisão própria:
 * omitir a chave faz o shell aplicar o `padrao` da coluna, enquanto mandar
 * `null` reproduziria o `null` do original. Hoje, para as 76 colunas de
 * `estudos` com `padrao` (este helper é agnóstico a tipo — 45 delas são
 * numéricas), a cópia diverge do original quando o campo está `null` na origem — comportamento que já existia antes deste arquivo e
 * que está aceito e testado (`estudos.test.ts`). Manter é o status quo;
 * remover é o conserto de fidelidade. **Não é mais uma defesa contra erro de
 * validação, e não deve ser citada como tal.**
 *
 * Aplicar SÓ na fronteira de escrita, nunca dentro de `montarCopiasFilhas`/
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
