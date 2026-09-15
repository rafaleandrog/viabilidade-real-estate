// Utilitário compartilhado pela duplicação de estudo (`POST /estudos/:id/duplicar`).
// Vive em arquivo próprio para evitar import circular: `estudos.ts` já importa de
// `avancado.ts` (via `duplicarDadosAvancado`), então `avancado.ts` não pode importar
// de volta de `estudos.ts`.

/**
 * Remove do objeto as chaves cujo valor é `null` — o validador do shell rejeita `null`
 * explícito em coluna `decimal`/`inteiro` na criação (`req.dados!.criar`), mesmo quando
 * a coluna é `nullable`, e sem alternativa: o mesmo validador recusa `null` também no
 * `atualizar` (PATCH — #694), então não existe um "cria sem o campo, depois grava null
 * por cima" que escape da rejeição. Omitir a chave é a ÚNICA forma de a criação suceder.
 *
 * Aplicar SÓ nesta fronteira de escrita, nunca dentro de `montarCopiasFilhas`/
 * `extrairCampos`: essas funções preservam `null` de propósito (#609), para
 * distinguir "usuário apagou o valor" de "campo nunca existiu" na representação
 * intermediária da linha copiada.
 *
 * ⚠️ **Limite conhecido, não coberto por este helper: coluna com `padrao` NÃO-nulo no
 * `schema.json`.** Omitir a chave nesse caso não reproduz `null` — o shell aplica o
 * `padrao` da coluna, e a cópia diverge do original nesse campo específico (achado
 * cruzado do Codex e da lente L1 na revisão do PR que introduziu este arquivo). Não é
 * um caso novo: é o MESMO comportamento que `montarCopiaEstudo`, abaixo, já tem — e já
 * tinha antes deste arquivo existir — para as 45 colunas de `estudos` com `padrao`
 * não-nulo, aceito e testado (`estudos.test.ts` "omite numéricos nulos do Avançado").
 * A razão de continuar aceitável: nenhum caminho de escrita deste app grava `null`
 * numa coluna com `padrao` não-nulo — todo formulário que edita um desses campos
 * coage para um número real antes de mandar ao backend (ex.: `_num` em
 * `tela-funding.ts` faz `e.detail.valor ?? 0`), então o cenário em que a divergência
 * se manifestaria não é alcançável pela app hoje. Se um caminho de escrita novo
 * algum dia permitir gravar `null` explícito num campo com `padrao` (ex.: uma rota
 * de API chamada fora da tela), essa nota deixa de valer e o achado reabre.
 */
export function omitirValoresNulos<T extends Record<string, any>>(obj: T): Partial<T> {
  const saida: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) continue;
    saida[k as keyof T] = v;
  }
  return saida;
}
