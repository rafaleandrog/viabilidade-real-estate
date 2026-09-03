// 038_fim_deflator_area_aberta.js — issue #642 (Rodada 10)
//
// `estudos.deflator_area_aberta_pct` (inteiro, criada pela migração `034`/#462)
// sai do `schema.json`. Ela está INERTE desde a #584, que retirou o deflator de
// preço da área aberta do app: o PR #641 entregou o caminho A daquela issue —
// a UI e a fiação saíram e a coluna ficou declarada, sem nenhum leitor de valor.
// Esta migração é o caminho B, que a #584 oferecia como alternativa.
//
// A coluna sai do `schema.json` no mesmo commit; aqui só cai o DADO, com
// `dados.limparColuna` — caminho canônico desde que o retorno declarativo
// (`remover_colunas`) virou GATE da plataforma em 2026-08-23. Precedentes:
// `030_permuta_financeira_dois_flags.js` (última linha) e
// `003_receitas_fases_alocacoes.js` (idem).
//
// ── NENHUM NÚMERO MUDA ──
// Não há backfill porque não há para onde levar o valor: `vgvUnitarioTipologia`
// já precifica a área aberta a preço cheio desde a #584, e nenhum consumidor lê
// esta coluna. Esvaziá-la não altera cálculo nenhum.
//
// ⚠️ `avancado_tipologias.area_privativa_aberta_m2` — a OUTRA coluna da `034` —
// PERMANECE. Ela é insumo de área, continua somando ao VGV, e removê-la mudaria
// número em todo estudo que a usa. Não é escopo da #642.
//
// ── IDEMPOTÊNCIA (o harness reexecuta toda migração sobre o próprio resultado) ──
// `limparColuna` zera as células não-nulas e devolve quantas zerou. Na 2ª
// execução não há mais célula não-nula: ela vira no-op com log. Numa instância
// virgem a coluna nunca existiu — a poda pré-migrações já a derrubou a partir do
// `schema.json`, e `limparColuna` também é no-op ali. O mesmo release converge
// nas duas populações.
//
// Só transforma dado existente — nenhum seed, nenhuma linha criada, nenhum valor
// de negócio inventado. Sem retorno declarativo.

export default async function ({ dados }) {
  await dados.limparColuna('estudos', 'deflator_area_aberta_pct');
}
