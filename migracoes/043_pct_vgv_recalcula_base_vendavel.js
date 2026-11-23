// 043_pct_vgv_recalcula_base_vendavel.js — fatia 2 de 5 da base do % do VGV.
//
// O motor do Avançado passa a aplicar o `% do VGV` sobre o VGV VENDÁVEL (a
// fatia 1 põe a base nova no motor). Uma linha de `avancado_linhas_custo` com
// `orcamento_unidade = 'pct_vgv'` guarda, porém, dois números: o percentual
// digitado (`orcamento_valor`) e o R$ canônico congelado
// (`orcamento_valor_canonico`) — que a tela gravou na época sobre a base ANTIGA
// (VGV bruto). Com o canônico presente, `resolverCustoTotal` o devolve direto e
// o percentual nunca é reaplicado: a linha continuaria presa ao R$ velho.
//
// Decisão do dono (recalcular sobre a base nova): ANULAR o canônico dessas
// linhas. Sem canônico, o motor resolve pelo percentual:
//   · `resolverCustoTotal` cai no `switch` e calcula `(orcamento_valor / 100) × vgv`;
//   · `corretagemMensal` e `distribuirProporcional` usam `orcamento_valor / 100`;
//   · a permuta financeira usa `orcamento_valor` como pct.
// A tela volta a congelar o canônico no próximo edit da linha.
//
// ── ESCOPO ──
// Só `pct_vgv`. `rs`, `rs_m2_*`, `pct_obra`, `pct_receita`, `pct_recebido` e
// `pct_constr` ficam intactos — o R$ congelado deles não depende da base do VGV.
//
// ── GUARDA FAIL-CLOSED ──
// Anular só é seguro quando `orcamento_valor` é, de fato, o percentual. Na
// coluna única de Custos a troca de unidade reconverte o número (ver
// `camposDaTrocaDeUnidade`), então em `pct_vgv` ele é o %. Dado legado que fuja
// disso NÃO é anulado (o R$ congelado é a única informação que sobra dele):
//   · `orcamento_valor` nulo, vazio ou não numérico (aceita só decimal simples,
//     nunca `0x10`, `1e3`, `NaN`);
//   · percentual fora de [0, 100];
//   · percentual 0 com canônico ≠ 0 (o % e o R$ discordam: um dos dois é lixo).
//
// ── IDEMPOTÊNCIA ──
// Depois da 1ª passada o canônico é nulo e a linha cai em `continue`; a 2ª
// passada não escreve nada. Não pode usar `limparColuna`: ela esvaziaria a
// coluna de TODAS as unidades.
//
// ⚠️ Instalação VIRGEM não executa esta função: o `schema.json` é o genesis e
// não há linha alguma. Só transforma dado existente — nenhum seed.

function percentual(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

function canonicoNumerico(v) {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export default async function ({ dados }) {
  const linhas = await dados.varrerTudo('avancado_linhas_custo');
  for (const linha of linhas) {
    if (linha.orcamento_unidade !== 'pct_vgv') continue;
    if (linha.orcamento_valor_canonico === null || linha.orcamento_valor_canonico === undefined) continue;
    const pct = percentual(linha.orcamento_valor);
    if (pct === null || pct < 0 || pct > 100) continue;
    const canonico = canonicoNumerico(linha.orcamento_valor_canonico);
    if (pct === 0 && canonico !== 0) continue;
    await dados.atualizar('avancado_linhas_custo', linha.id, { orcamento_valor_canonico: null });
  }
}
