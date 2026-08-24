// 030_permuta_financeira_dois_flags.js — issue #459 (Rodada 8, R8-34)
//
// `avancado_linhas_custo.permuta_financeira_base` (enum `bruta|liquida`,
// migração `018`/#238) dá lugar a DOIS booleanos independentes:
// `permuta_financeira_deduzir_imposto` e `permuta_financeira_deduzir_corretagem`
// — a EVI declara exatamente essa dupla (`Premissas!N17`/`N18`), e as duas
// combinações mistas (só imposto, só corretagem) não eram representáveis com
// um único enum.
//
// `bruta` ≡ ambas false; `liquida` ≡ ambas true — nenhum estudo existente
// muda de número. As colunas novas já nascem com "padrao": false, então só
// as linhas hoje em 'liquida' precisam de escrita.
//
// Depois do backfill, a coluna enum sai do `schema.json` e é esvaziada com
// `dados.limparColuna` — caminho canônico desde que o retorno declarativo
// (`remover_colunas`) virou GATE da plataforma em 2026-08-23. Precedente:
// migracoes/003_receitas_fases_alocacoes.js (última linha).
//
// ── IDEMPOTÊNCIA (o harness reexecuta toda migração sobre o próprio resultado) ──
// Esta migração só ESCREVE no ramo 'liquida' — nunca grava false/false
// explicitamente no ramo contrário, porque o default da coluna já cobre esse
// caso. Na 2ª execução, `permuta_financeira_base` já foi zerada por
// `limparColuna` na 1ª passada: nenhuma linha casa mais com 'liquida', então
// a 2ª passada não escreve nada, e os true/true gravados na 1ª sobrevivem.
// Se a migração escrevesse false/false no ramo "não é líquida", a 2ª
// execução APAGARIA o backfill da 1ª — é esta a armadilha que a issue
// documenta, e o motivo de o código abaixo nunca tocar o ramo `false`.
//
// Só transforma dado existente — nenhum seed, nenhuma linha criada,
// nenhum valor de negócio inventado.

export default async function ({ dados }) {
  const linhas = await dados.varrerTudo('avancado_linhas_custo');
  for (const linha of linhas) {
    if (linha.permuta_financeira_base !== 'liquida') continue;
    await dados.atualizar('avancado_linhas_custo', linha.id, {
      permuta_financeira_deduzir_imposto: true,
      permuta_financeira_deduzir_corretagem: true,
    });
  }
  await dados.limparColuna('avancado_linhas_custo', 'permuta_financeira_base');
}
