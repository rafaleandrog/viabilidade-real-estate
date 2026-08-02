// 019_capital_stack_camadas.js — FIN-02 (#271)
//
// Cria a tabela `avancado_capital_instrumentos` (camadas do Capital Stack,
// §2.4/§4 de docs/viabilidade/funding-capital-stack.md) e migra os campos
// legados do Bloco G (`estudos.financiamento_*`/`investidor_*`) para camadas
// RASCUNHO — regra conservadora do §13:
//
//  - `financiamento_*` preenchido (`financiamento_obra_pct > 0`) → camada
//    `financiamento_producao`;
//  - `investidor_*` preenchido (`investidor_aporte_valor > 0`) → camada
//    `preferred_equity`;
//  - `estrutura_*_pct` e `regime_tributario`/`aliquota_*` NÃO são tocados —
//    o primeiro fica como metadado legado (§13.2), o segundo é fora desta
//    epic (#228).
//
// Instrumentos migrados nascem com status `revisao_necessaria` e SEM efeito
// no motor (§13.3) — nenhum estudo muda de resultado. Estudos Aprovados,
// Reprovados ou Arquivados nunca têm instrumento migrado automaticamente
// (a regra de negócio pede confirmação humana antes de ativar; migrar uma
// linha rascunho sozinha não altera nada, mas evitamos até isso para não
// tocar dado de um estudo travado).
//
// Idempotente: se o estudo já tem uma camada com o mesmo `origem_legado`,
// não cria outra — cobre reexecução do harness e de produção.
//
// ⚠️ Achado na segunda verificação (2026-08-02), corrigido antes de rodar em
// produção (confirmado pendente no ambiente autenticado do autor — ver
// CLAUDE.md): a config de `preferred_equity` gravava `aporteValor` (escalar)
// e só uma pista `retornoTipoLegado`, mas `instrumentoDeRegistro`
// (frontend/capital-stack-motor.ts, FIN-04..06/#273-276) lê `aportes`
// (array `{mes,valor}`) e `modo` diretamente — um instrumento migrado com o
// shape antigo ficaria PERMANENTEMENTE inerte mesmo depois de o usuário
// confirmar `status: 'ativo'`, o oposto do que a #271 promete. Corrigido
// para já nascer no shape que o motor consome; `retornoTipoLegado` continua
// gravado como registro de onde `modo` veio (mapeamento §4.2: remunerado→A,
// pct_receita→C, pct_resultado→B). Como o legado só tinha `investidor_juros_aa`
// como único "percentual", ele é reaproveitado como taxa/percentual
// aproximado nos modos B/C — por isso o status nasce `revisao_necessaria`,
// nunca `ativo`: a aproximação PRECISA de revisão humana antes de valer.
//
// Forward-only. Tabela nova, sem linhas — inócua em banco vazio.

export default async function ({ dados }) {
  const { dados: estudos } = await dados.listar('estudos', { por_pagina: 100000 });
  const avancados = estudos.filter((e) => e.nivel_analise === 'avancado'
    && e.status !== 'aprovado' && e.status !== 'reprovado' && e.status !== 'arquivado');
  if (avancados.length === 0) return;

  const { dados: existentes } = await dados.listar('avancado_capital_instrumentos', { por_pagina: 100000 });

  for (const e of avancados) {
    if (Number(e.financiamento_obra_pct) > 0) {
      const jaMigrado = existentes.some((c) => Number(c.estudo_id) === Number(e.id) && c.origem_legado === 'financiamento_bloco_g');
      if (!jaMigrado) {
        const nova = await dados.criar('avancado_capital_instrumentos', {
          estudo_id: e.id,
          tipo: 'financiamento_producao',
          nome: 'Financiamento à produção (migrado)',
          status: 'revisao_necessaria',
          prioridade_funding: 0,
          prioridade_pagamento: 0,
          compromisso: 0,
          config: {
            percentualFinanciavel: Number(e.financiamento_obra_pct) / 100,
            taxaAnual: Number(e.financiamento_juros_aa) / 100,
            sistemaAmortizacao: e.financiamento_sistema_amortizacao || 'price',
            prazoMeses: Number(e.financiamento_prazo_meses) || 0,
            carenciaMeses: Number(e.financiamento_carencia_meses) || 0,
          },
          origem_legado: 'financiamento_bloco_g',
          ordem: 0,
        });
        existentes.push(nova);
      }
    }

    if (Number(e.investidor_aporte_valor) > 0) {
      const jaMigrado = existentes.some((c) => Number(c.estudo_id) === Number(e.id) && c.origem_legado === 'investidor_bloco_g');
      if (!jaMigrado) {
        // §4.2: remunerado→A (retorno preferencial), pct_receita→C
        // (participação na receita líquida), pct_resultado→B (participação
        // no residual em evento). O legado só tinha `investidor_juros_aa`
        // como único "percentual" — reaproveitado como taxa/percentual
        // aproximado nos três modos; PRECISA de revisão humana (daí o
        // status nascer `revisao_necessaria`, nunca `ativo`).
        const retornoTipoLegado = e.investidor_retorno_tipo || 'remunerado';
        const modo = retornoTipoLegado === 'pct_receita' ? 'C' : retornoTipoLegado === 'pct_resultado' ? 'B' : 'A';
        const taxaOuPct = Number(e.investidor_juros_aa) / 100;
        const config = {
          modo,
          // Aporte único no mês 1 — o legado não tinha calendário de aportes,
          // só um valor total; o usuário ajusta o mês pela UI se precisar.
          aportes: [{ mes: 1, valor: Number(e.investidor_aporte_valor) }],
          retornoTipoLegado,
          carenciaMesesLegado: Number(e.investidor_carencia_meses) || 0,
          parcelasLegado: Number(e.investidor_parcelas) || 0,
        };
        if (modo === 'A') { config.taxaAnual = taxaOuPct; config.capitalizacao = 'simples'; }
        if (modo === 'B') { config.percentualResidualEvento = taxaOuPct; config.mesEvento = Number(e.investidor_carencia_meses) || undefined; }
        if (modo === 'C') { config.percentualReceitaLiquida = taxaOuPct; }

        const nova = await dados.criar('avancado_capital_instrumentos', {
          estudo_id: e.id,
          tipo: 'preferred_equity',
          nome: 'Investidor (migrado)',
          status: 'revisao_necessaria',
          prioridade_funding: 0,
          prioridade_pagamento: 0,
          compromisso: Number(e.investidor_aporte_valor),
          config,
          origem_legado: 'investidor_bloco_g',
          ordem: 0,
        });
        existentes.push(nova);
      }
    }
  }
}
