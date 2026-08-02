// 017_permuta_fisica_fonte_verdade.js — #267
//
// Cria a NOVA fonte de verdade da permuta física (linha de custo do Terreno,
// #266) a partir da fonte ANTIGA (`avancado_tipologias.unidades_permutadas`,
// #195) — sem apagar nem zerar a antiga. As duas coexistem até o #253 (que só
// pode rodar depois desta migração ter fechado, por isso ela é o "portão").
//
// Para cada tipologia com `unidades_permutadas > 0`, cria uma linha nova em
// `avancado_linhas_custo`: grupo `terreno`, categoria `Preço`, subcategoria
// `Permuta física` (#257), `permuta_tipologia_id` = a tipologia,
// `permuta_quantidade` = `unidades_permutadas`. NÃO é a linha obrigatória
// (`obrigatoria` fica `false` — a linha oficial de aquisição continua sendo a
// que o #256 garante). O `orcamento_valor` fica em branco: o ADR da #266
// proíbe DERIVAR esse valor (nem média, nem preço do Grupo de origem) — é o
// usuário quem declara. A linha migrada aparece na tela sem valor até alguém
// preencher; isso é intencional e visível, não um bug.
//
// Idempotente: se o estudo já tem uma linha `Permuta física` referenciando
// aquela tipologia (`permuta_tipologia_id`), não cria outra — cobre tanto a
// reexecução do harness quanto rodar esta migração mais de uma vez em
// produção. Nenhuma linha existente é alterada; nenhum dado é apagado.
//
// Forward-only. Instalação virgem não tem tipologias — inócua.

export default async function ({ dados }) {
  const { dados: tipologias } = await dados.listar('avancado_tipologias', { por_pagina: 100000 });
  const permutadas = tipologias.filter((t) => Number(t.unidades_permutadas) > 0);
  if (permutadas.length === 0) return;

  const { dados: custos } = await dados.listar('avancado_linhas_custo', { por_pagina: 100000 });

  for (const tip of permutadas) {
    const jaMigrada = custos.some(
      (c) => Number(c.estudo_id) === Number(tip.estudo_id) && Number(c.permuta_tipologia_id) === Number(tip.id),
    );
    if (jaMigrada) continue;

    const doEstudo = custos.filter((c) => Number(c.estudo_id) === Number(tip.estudo_id) && c.grupo === 'terreno');
    const nova = await dados.criar('avancado_linhas_custo', {
      estudo_id: tip.estudo_id,
      grupo: 'terreno',
      categoria: 'Preço',
      subcategoria: 'Permuta física',
      obrigatoria: false,
      permuta_tipologia_id: tip.id,
      permuta_quantidade: Number(tip.unidades_permutadas),
      orcamento_unidade: 'rs',
      cronograma_evento: 'customizado',
      inicio_mes: 0,
      duracao_meses: 1,
      ordem: doEstudo.length,
    });
    custos.push(nova); // mantém a lista local coerente para as próximas iterações/estudos
  }
}
