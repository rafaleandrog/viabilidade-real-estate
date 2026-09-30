// 041_fim_marketing_global_valor_venal.js — pedido direto do autor (sem issue)
//
// Saem do Preliminar (Incorporação e Loteamento), na aba Premissas › Custos, os
// campos "Marketing global / estrutura" e "Valor venal do terreno (outorga)":
//
//   · `estudos.marketing_global_pct`         — % do VGV, alimentava o custo indireto;
//   · `estudos.considerar_marketing_global`  — o interruptor "Considerar Marketing
//                                              global / estrutura" desse campo;
//   · `estudos.valor_venal_terreno_m2`       — R$/m², único insumo do custo de
//                                              outorga, que sai junto do motor.
//
// As três colunas saem do `schema.json` no mesmo commit; aqui só cai o DADO, com
// `dados.limparColuna` — caminho canônico do retorno declarativo (o mesmo de
// `038_fim_deflator_area_aberta.js`). A poda do reconciliador derruba a estrutura
// vazia no mesmo boot.
//
// ── OS NÚMEROS DOS ESTUDOS EXISTENTES MUDAM, DE PROPÓSITO ──
// Diferente da `038`, estas colunas NÃO estavam inertes: um estudo que tinha
// marketing global de 1 % do VGV ou valor venal preenchido deixa de carregar esses
// custos na Proforma, e o Resultado sobe na mesma medida. É o que o autor pediu
// ("retire de todos os estudos preliminares esses campos") — o efeito é remover
// o custo, não migrá-lo para outro campo. O `stand_vendas_valor` do Loteamento
// PERMANECE e continua entrando no custo indireto.
//
// ── IDEMPOTÊNCIA (o harness reexecuta toda migração sobre o próprio resultado) ──
// `limparColuna` zera as células não-nulas e devolve quantas zerou; na 2ª execução
// não há mais célula não-nula e cada chamada vira no-op com log.
//
// ⚠️ Instalação VIRGEM não executa esta função: o `schema.json` é o genesis, nasce
// já sem as colunas, e as migrações são registradas sem rodar.
//
// Só transforma dado existente — nenhum seed, nenhuma linha criada.

export default async function ({ dados }) {
  await dados.limparColuna('estudos', 'marketing_global_pct');
  await dados.limparColuna('estudos', 'considerar_marketing_global');
  await dados.limparColuna('estudos', 'valor_venal_terreno_m2');
}
