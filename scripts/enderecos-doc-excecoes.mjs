// Endereços `arquivo:linha` que o `guard-enderecos-doc.mjs` NÃO acusa — cada um
// com o motivo escrito ao lado.
//
// ── Por que esta lista existe, e por que ela é uma lista e não um comentário ─
// O guard nasceu com 32 violações vivas nesta árvore. Consertá-las é mudança de
// documentação de PRODUTO, e a regra R1 do CLAUDE.md proíbe que isso viaje no
// mesmo PR que introduz o guard — então o guard entra com a dívida DECLARADA,
// em vez de entrar desligado ou de nascer vermelho e ser ignorado.
//
// A alternativa seria um marcador espalhado pelos documentos (um `<!-- ignore -->`
// por citação). Ela foi recusada: marcador espalhado não tem inventário, ninguém
// consegue responder "quantos ainda faltam", e ele envelhece dentro do próprio
// texto que deveria descrever. Aqui a dívida é UM arquivo, contável e revisável.
//
// ── A trava que impede esta lista de virar papel de parede ──────────────────
// ⚠️ O guard REPROVA quando uma exceção deixa de ser necessária — endereço que
// voltou a resolver, ou citação que sumiu do documento. Sem isso a lista só
// cresceria: cada conserto deixaria para trás uma entrada morta, e a entrada
// morta é pior que a violação, porque desliga a conferência daquele endereço
// PARA SEMPRE, calada, inclusive contra uma quebra futura por outro motivo.
//
// ── A chave é `arquivo` + `endereco`, e NÃO leva o número da linha citante ──
// De propósito: a linha de onde a citação parte anda tanto quanto a linha citada
// — é o mesmo defeito. Uma chave com número de linha exigiria mexer nesta lista
// a cada edição de parágrafo, e a lista que precisa de manutenção por ruído é a
// lista que alguém apaga inteira. O preço é que uma exceção cobre TODAS as
// ocorrências daquele mesmo endereço naquele mesmo arquivo; três entradas aqui
// já cobrem duas ocorrências cada.
//
// ── As três classes, e o que fazer com cada uma ─────────────────────────────
//   · `LIMITE DO GUARD` — a citação está CERTA e o guard é que não alcança
//     (caminho de outro repositório; frase que afirma a AUSÊNCIA de um símbolo).
//     Não há conserto: a entrada é permanente enquanto a frase existir.
//   · `VENCIDO DE VERDADE` — o endereço envelheceu e precisa do número corrigido.
//     O diagnóstico traz onde o símbolo está hoje. Sai em PR próprio.
//   · Uma classe nova só se justifica com o motivo escrito por extenso. O guard
//     recusa motivo com menos de 20 caracteres — "ok", "ver acima" e "TODO" não
//     passam.
//
// ⚠️ NÃO acrescente entrada aqui para calar um endereço que você mesmo quebrou
// no seu PR. A lista é para dívida herdada e para limite do guard; endereço que
// o seu diff deslocou, o seu diff conserta.

export const EXCECOES = [
  {
    arquivo: "backend/rotas/estudos.ts",
    endereco: "frontend/proforma.ts:229",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :229 — \"calcularProforma\" está em :233. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "backend/rotas/funding.ts",
    endereco: "frontend/fluxo-shared.ts:349",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :349 — \"erroFormularioAbsorcao\" está em :414. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "backend/rotas/funding.ts",
    endereco: "frontend/fluxo-pagamento-editor.ts:66",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :66 — \"erroFormularioPagamento\" está em :364. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/fluxo-investidor-formulas.md",
    endereco: "frontend/fluxo-shared.ts:502-509",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :502-509 — \"eCorretagem\" está em :643. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/fluxo-investidor-formulas.md",
    endereco: "frontend/fluxo-caixa-motor.ts:1584",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :1584 — \"permutaFinanceiraLiquidaMensal\" está em :1849. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/formulas.md",
    endereco: "frontend/fluxo-caixa-motor.ts:591,603,610,619",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :591,603,610,619 — \"taxaMensal\" está em :691; \"sinalPct\" está em :688. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/formulas.md",
    endereco: "frontend/tela-fluxo-ver.ts:122",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :122 — \"considerar_ret\" está em :132; \"ret_pct\" está em :132. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/formulas.md",
    endereco: "frontend/fluxo-caixa-motor.ts:2125-2133",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :2125-2133 — \"FluxoCalc\" está em :2076. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/funding-capital-stack.md",
    endereco: "shell/backend/src/dados/validador-schema.ts:45-58",
    motivo:
      "LIMITE DO GUARD — caminho do monorepo `urbiverso/urbiverso`, que NAO esta nesta arvore. Nao e verificavel daqui, e nunca sera: a citacao e legitima e continua valendo.",
  },
  {
    arquivo: "docs/viabilidade/funding-capital-stack.md",
    endereco: "docs/shell/banco-de-dados.md:200-212",
    motivo:
      "LIMITE DO GUARD — caminho do monorepo `urbiverso/urbiverso`, que NAO esta nesta arvore. Nao e verificavel daqui, e nunca sera: a citacao e legitima e continua valendo.",
  },
  {
    arquivo: "docs/viabilidade/funding-capital-stack.md",
    endereco: "schema.json:106-108",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :106-108 — \"estrutura_investidores_pct\" está em :141. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/funding-capital-stack.md",
    endereco: "schema.json:136",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :136 — \"pct_receita\" está em :169; \"pct_resultado\" está em :169. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/modelo-de-dados.md",
    endereco: "frontend/exportar.ts:9",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :9 — \"maximumFractionDigits\" não aparece em frontend/exportar.ts; \"toFixed\" está em :20. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "backend/rotas/estudos.ts:180",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :180 — \"NIVEL_IMUTAVEL\" está em :84. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/proforma.ts:186",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :186 — \"CASCATA_LOTEAMENTO\" está em :190. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-shared.ts:237",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :237 — \"APOS_CHAVES_MESES\" está em :295. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-shared.ts:345-353",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :345-353 — \"erroFormularioAbsorcao\" está em :414. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "fluxo-caixa-motor.ts:591,603,610,619",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :591,603,610,619 — \"sinalPct\" está em :688. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "fluxo-caixa-motor.ts:519-550",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :519-550 — \"ComponentePagamento\" está em :678. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "fluxo-invariantes.ts:496",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :496 — \"validarComponentesSafra\" está em :524. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/tela-fluxo-custos.ts:704-716",
    motivo:
      "LIMITE DO GUARD — a frase afirma a AUSENCIA do simbolo no alvo (\"nao le X\", \"sem ler X\", \"nao ha campo\"). Exigir que ele apareca inverte o sentido do texto. Classe conhecida, sem deteccao automatica confiavel.",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-caixa-motor.ts:85",
    motivo:
      "LIMITE DO GUARD — a frase afirma a AUSENCIA do simbolo no alvo (\"nao le X\", \"sem ler X\", \"nao ha campo\"). Exigir que ele apareca inverte o sentido do texto. Classe conhecida, sem deteccao automatica confiavel.",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-caixa-motor.ts:1570-1573",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :1570-1573 — \"permutaFinanceiraBrutaMensal\" está em :1844. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/proforma.ts:245",
    motivo:
      "LIMITE DO GUARD — a frase afirma a AUSENCIA do simbolo no alvo (\"nao le X\", \"sem ler X\", \"nao ha campo\"). Exigir que ele apareca inverte o sentido do texto. Classe conhecida, sem deteccao automatica confiavel.",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-caixa-motor.ts:1807-1808",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :1807-1808 — \"calcularFluxo\" está em :1718. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "backend/rotas/avancado.ts:1134,1148",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :1134,1148 — \"inicio_mes\" está em :1084. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "docs/viabilidade/padrao-incorporacao.md",
    endereco: "frontend/fluxo-shared.ts:601-603",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :601-603 — \"ePermutaFinanceira\" está em :670. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
  {
    arquivo: "frontend/premissas-conversao.ts",
    endereco: "fluxo-shared.ts:426-440",
    motivo:
      "VENCIDO DE VERDADE — nada em ±3 linhas de :426-440 — \"resolverCustoTotal\" está em :578. Conserto e mudanca de documentacao de PRODUTO: sai em PR separado (regra R3), nunca no PR que introduz o guard (regra R1).",
  },
];
