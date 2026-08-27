// 036_fim_permuta_unidade.js — #566
//
// Aposenta o modo 'unidade' da Permuta física do Preliminar (seleção de
// produto do catálogo + quantidade, #317): a tela mantém só 'area_m2' e
// 'pct_area_venda' (frontend/tela-premissas.ts — PERMUTA_UNIDADE/PERMUTA_FIS_NR
// não oferecem mais a badge "Unidade").
//
// Converte todo estudo com `permuta_fisica_modo`/`permuta_fisica_nr_modo` =
// 'unidade' para 'area_m2', usando o VALOR JÁ RESOLVIDO no campo canônico
// (`permuta_fisica_area_canonica`/`_nr_area_canonica` — área média do produto
// × quantidade, gravado a cada edição por `_editarPermutaProduto`, que esta
// mesma issue removeu da tela) como fonte do m². Não recalcula a partir de
// `preliminar_produtos`: o canônico já É o resultado dessa conta, persistido
// no momento da edição — reabri-lo aqui duplicaria a lógica sem necessidade.
// `permuta_fisica_area_m2`/`_nr_area_m2` (o campo legado por unidade) também
// recebem o mesmo valor, para que o fallback de `_valorUnidade` (usado quando
// o canônico está ausente) não fique desatualizado.
//
// As colunas `permuta_fisica_produto_id`/`_quantidade` (e o par `_nr_`) NÃO
// são apagadas — remover coluna é mudança de schema, fora do escopo desta
// issue (#566 é só a opção na tela + a migração de dado). Elas ficam inertes
// no schema.json, sem leitor: `scripts/guard-tabelas-obsoletas.mjs` não as
// alcança porque o registro dele é por TABELA, não por coluna.
//
// Sem canônico (estudo com modo 'unidade' salvo mas nenhum produto/quantidade
// jamais selecionados) o m² migrado é 0 — mesmo valor que a tela já mostrava
// para esse caso (`_valorUnidade` sem canônico caía no campo legado, também
// vazio). Idempotente: só toca linha cujo modo ainda é 'unidade'. Padrão de
// backfill de `021_preliminar_produtos.js`/`015_permuta_financeira_subcategoria.js`
// — lista com `por_pagina` alto, atualiza só as linhas no modo aposentado.
// Forward-only.

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });

  for (const e of estudos) {
    const patch = {};
    if (e.permuta_fisica_modo === 'unidade') {
      patch.permuta_fisica_modo = 'area_m2';
      patch.permuta_fisica_area_m2 = round2(e.permuta_fisica_area_canonica);
    }
    if (e.permuta_fisica_nr_modo === 'unidade') {
      patch.permuta_fisica_nr_modo = 'area_m2';
      patch.permuta_fisica_nr_area_m2 = round2(e.permuta_fisica_nr_area_canonica);
    }
    if (Object.keys(patch).length > 0) {
      await dados.atualizar('estudos', e.id, patch);
    }
  }
}
