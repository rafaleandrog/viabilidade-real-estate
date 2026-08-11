// 028_financiamento_producao_retroativo.js — Financiamento à Produção
//
// Normaliza a `config` das camadas `financiamento_producao` para o modelo
// contratual único do produto: liberação por medição de custo com catch-up
// retroativo, gatilho de exposição mínima e cash sweep
// (docs/viabilidade/funding-capital-stack.md §4.3, decodificado da aba
// `Incorp Individual` da planilha de referência).
//
// DE → PARA
//
//   Removidos (deixam de existir para este tipo de camada):
//     · sistemaAmortizacao / politicaAmortizacao — o produto não tem
//       prestação contratual. A dívida é liquidada por cash sweep, conforme o
//       caixa do projeto; SAC e Price não se aplicam. Quem precisa de
//       prestação fixa usa uma camada `capital_giro`, que continua com as
//       três políticas.
//     · prazoMeses / carenciaMeses / vencimentoMes — idem: são parâmetros de
//       Price/bullet. O prazo do financiamento é emergente (a dívida acaba
//       quando o caixa a liquida), não digitado.
//     · liberacaoProgramada — a liberação é dirigida pela medição do custo
//       elegível; um calendário manual por cima dela produziria desembolso em
//       duplicidade com o alvo acumulado.
//
//   Preenchidos quando ausentes (valores da planilha, `Premissas e
//   Resultados!D25:D28`) — persistidos em vez de ficarem implícitos no código,
//   para que apareçam editáveis na tela:
//     · exposicaoMinima            → 0.20
//     · percentualFinanciavel      → 0.80
//     · amortizarComCaixaDisponivel→ true
//
// Camadas criadas pela migração `019` são exatamente o caso de origem: elas
// nasceram com `sistemaAmortizacao`/`prazoMeses`/`carenciaMeses` copiados do
// Bloco G legado (`estudos.financiamento_*`), campos que nunca chegaram a ter
// efeito e que agora contradizem o modelo. `percentualFinanciavel` delas vem
// de `financiamento_obra_pct` e é PRESERVADO — é dado real do usuário.
//
// `custoLinhaIds` NÃO é preenchido aqui de propósito: a base financiável
// padrão é resolvida em runtime (`linhasFinanciaveisPadrao`, em
// `frontend/capital-stack-motor.ts`) sempre que a camada não tem seleção
// própria. Persistir a lista congelaria uma seleção que envelhece assim que o
// usuário adiciona ou remove uma linha de custo.
//
// Idempotente: reexecutar não muda nada, porque as chaves já foram removidas
// e os defaults já estão gravados. Forward-only. Inócua em instalação virgem
// (nenhuma camada) e em banco sem estudo Avançado.

const CHAVES_REMOVIDAS = [
  'sistemaAmortizacao',
  'politicaAmortizacao',
  'prazoMeses',
  'carenciaMeses',
  'vencimentoMes',
  'liberacaoProgramada',
];

export default async function ({ dados }) {
  const { dados: camadas } = await dados.listar('avancado_capital_instrumentos', { por_pagina: 100000 });
  const financiamentos = (camadas || []).filter((c) => c?.tipo === 'financiamento_producao');
  if (financiamentos.length === 0) return;

  for (const camada of financiamentos) {
    const config = { ...(camada.config ?? {}) };
    let mudou = false;

    for (const chave of CHAVES_REMOVIDAS) {
      if (chave in config) { delete config[chave]; mudou = true; }
    }
    if (config.exposicaoMinima === undefined) { config.exposicaoMinima = 0.20; mudou = true; }
    if (config.percentualFinanciavel === undefined) { config.percentualFinanciavel = 0.80; mudou = true; }
    if (config.amortizarComCaixaDisponivel === undefined) { config.amortizarComCaixaDisponivel = true; mudou = true; }

    if (mudou) await dados.atualizar('avancado_capital_instrumentos', camada.id, { config });
  }
}
