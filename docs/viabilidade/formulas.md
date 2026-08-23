---
titulo: Fórmulas da Proforma
descricao: Referência das linhas e cálculos da Proforma (Loteamento e Incorporação).
tipo: app
ordem: 3
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fórmulas da Proforma

As fórmulas rodam no **frontend em tempo real** (engine `frontend/proforma.ts`, coberta por testes). O backend persiste apenas os inputs.

## Áreas e VGV

- **Loteamento:** `área vendável = área da gleba × (1 − Σ percentuais de dedução)` (APP, faixas, viário, ELUP, EPC, EPU, priv. não vendáveis, todos % da gleba). Após permuta física → **área vendável líquida**. `VGV = área vendável líquida × preço/m²`.
- **Incorporação:** `VGV = (Área PVT R Fechada × preço residencial) + (Área PVT NR Fechada × preço não residencial)` — usa as **áreas fechadas**.

## Deduções da receita

Imposto (`4%` se sujeito a RET, senão `imposto_percentual`), corretagem, marketing e permutas financeiras (% do VGV residencial/não residencial). `Receita líquida = VGV − deduções`.

## Custos diretos

Terreno (`custo/m² × área do terreno`, zerável pelo checkbox “considerar”), projetos, manutenção, contingências (% VGV) e, por tipo: **Loteamento** → infraestrutura (toggle R$/m² ou % VGV); **Incorporação** → construção, decoração, gestão da construção, outorga, incorporação e registro.

## Custos indiretos

Marketing global/estrutura (+ stand de vendas no Loteamento) e gestão/indiretos (% VGV).

## Resultado

`Resultado = Receita líquida − Custo direto total − Custo indireto total`. Também: `+ permutas financeiras` e `+ permutas físicas`. `Margem líquida (%) = Resultado / VGV × 100`.

## Preço Sugerido/m²

Menor preço de venda por m² para a margem atingir o **piso do benchmark `resultado_final`**. Resolvido por bisseção sobre o preço (valor único, mesmo na Incorporação). Ver [Benchmarks](benchmarks).

## Fluxo avançado por safras — onde as fórmulas vivem

> ⚠️ **Nada desta seção descreve a Proforma.** As fórmulas acima são a **Proforma** (Preliminar),
> que roda em `frontend/proforma.ts`. Esta seção é o **Avançado**, que roda em
> `frontend/fluxo-caixa-motor.ts`.

As fórmulas do **fluxo de caixa avançado por safras** — contratação bruta/desconto/líquido,
componentes de pagamento (imediato, prazo fixo, até marco, concentrado), PMT, primeiro vencimento
em `s + defasagemMeses`, carteira por safra e repasse — estão descritas nos dois documentos EVI:

- [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao) — significado econômico;
- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) §11 a §14 — dinâmica funcional, com
  os cenários dourados no Anexo G.

**Estão implementadas desde a #283** e são o caminho de cálculo real de toda linha de receita com
`fluxo_pagamento.componentes` persistido — o que a tela grava em toda escrita
(`frontend/fluxo-pagamento-editor.ts:90`). O motor legado (`entrada`/`parcelas`/`repasse`) sobrevive
apenas para linha nunca reeditada.

| Grandeza | Onde vive |
|---|---|
| Safra (mês de contratação) | `fluxo-caixa-motor.ts:958-962`, laço em `:1094` |
| PMT | `fluxo-caixa-motor.ts:653` |
| Pagamentos de uma safra | `pagamentosComponenteSafra`, `:1045` |
| Juros e principal separados | `:1113-1131` |
| Carteira por safra | `carteiraSaldoSafra`; consolidação em `:1191` |
| Agregação no `FluxoCalc` | `calcularFluxo`, `:2025-2053` |
| Regra Após-chaves (venda pós-entrega é à vista) | `ehVendaAposChaves` `:945`, aplicada em `:1096` |

> ⚠️ **A matemática de juros existe e é exercitada por estudo real; o que falta é a ENTRADA.** Há
> linha em produção com `taxaMensal` diferente de 0 persistida em `fluxo_pagamento.componentes`
> (estudo 5 de Pinguim: `0.0098636` = 12,5% a.a., R$ 1.259.273,59 de juros de clientes). O modal de
> Fluxo de Pagamento não oferece campo de **taxa** nem de **sinal**
> (`frontend/tela-fluxo-receitas.ts:741-816`), e o adaptador `componentesDoLegado` fixa
> `taxaMensal: 0` / `sinalPct: 0` (`frontend/fluxo-caixa-motor.ts:589,601,608,617`) porque o espelho
> legado não tem onde guardar essas grandezas. Como `fluxoPagamentoParaSalvar`
> (`frontend/fluxo-pagamento-editor.ts:90`) regenera os componentes do espelho em toda escrita,
> **abrir o modal e clicar "Aplicar" apaga os juros da linha**, sem aviso e sem undo. Escrever
> "`jurosClientes` é sempre 0" é errado: o certo é **"os juros existem e viram zero no primeiro
> Aplicar"**.

> 🚫 **Não copiar fórmula de carteira do arquivo Urbitá.** As fórmulas de carteira daquele arquivo
> admitem saldo negativo e saldo que volta a crescer depois da última parcela. A recorrência correta
> é por safra: `saldo_s,s = principal_s`, depois
> `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t` — que é o que
> `validarComponentesSafra` (`frontend/fluxo-invariantes.ts:404`) fiscaliza.

## Funding — onde as fórmulas vivem

As fórmulas de **dívida** (aporte único ou em tranches, carência, PMT Price, quitação),
**equity** (aporte, retorno progressivo sobre receita líquida ou concentrado sobre o resultado
final, MOIC/TIR/ROI do investidor) e **financiamento à produção** (base de custos elegíveis,
gatilho de exposição mínima, catch-up retroativo, juros capitalizados e cash sweep) estão
**implementadas** em `frontend/funding-motor.ts`, tela em `frontend/tela-funding.ts`, rotas em
`backend/rotas/funding.ts`, tabela `avancado_funding_operacoes` (migração `029`).

| Documento | Papel hoje |
|---|---|
| [Fluxo do Investidor — fórmulas das operações de Funding](fluxo-investidor-formulas) | **Spec vigente** de `divida` e `equity` |
| [Funding, Capital Stack e Retorno do Capital](funding-capital-stack) | **ADR histórico** do modelo de 4 instrumentos com waterfall, apagado pela #355 — **exceto a §4.3**, que continua vigente e é a spec de `financiamento_producao` |

Duas identidades que o motor mantém:

```text
fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t
```

fiscalizada por `validarFunding` (`frontend/fluxo-invariantes.ts:363-374`), que também acusa saldo
de dívida negativo, dívida que não zera no horizonte e — decisão **D14** — caixa acumulado negativo
depois do funding (`:376-387`, severidade `alerta`).

**Funding nunca integra a Receita Bruta — VGV.** Liberação de dívida e aporte de equity aparecem
**somente** no bloco de funding; o repasse continua sendo recebimento do cliente, ainda que o caixa
alimente o cash sweep.

> ⚠️ **Linha rotativa e empréstimo-ponte não existem.** Os tipos aceitos são exatamente
> `['financiamento_producao','divida','equity']` (`backend/rotas/funding.ts:43`); `capital_giro` é
> rejeitado com `tipo deve ser um de…` (`backend/rotas/funding.test.ts:26`).

> ⚠️ **O que continua inerte na aba `Viabilidade → Financeiro`**, e só isso: `regime_tributario` e
> os cinco `aliquota_*_pct` (`frontend/tela-financeiro.ts:187-193`), mais
> `imposto_sobre_permuta_fisica` (`:182`). Nenhum motor os lê. Os campos de financiamento,
> investidor, estrutura de capital e correção monetária **saíram da tela** (#279/#355); as colunas
> continuam no schema, sem formulário e sem leitor.

## Valor canônico dos campos multiunidade

**ADR #259 — valor canônico (implementado).** Todo campo multiunidade guarda uma quantidade
canônica: R$ a duas casas para custos e permutas financeiras; m² a duas casas para permuta física.
A unidade exibida é apresentação. Alternar a badge não regrava uma conversão. Estudos antigos
permanecem legíveis: seu valor ativo é adotado como canônico apenas na primeira interação deliberada.

No Preliminar, os novos campos `*_canonico` coexistem com os campos legados por unidade. No
Avançado, `orcamento_valor_canonico` coexiste com `orcamento_valor` + `orcamento_unidade`; o
resolver já prefere o canônico. A migração dos demais consumidores é a #260.

**Modelo funcional de referência:** cada premissa multiunidade tem uma quantidade econômica
**canônica**; a unidade exibida é apresentação. Toda fórmula — Proforma, Fluxo, Resumo, benchmarks,
sensibilidade, cenários e exportações — consome o **valor resolvido**, e cada percentual declara seu
denominador. Fundação em **#259**, consumidores em **#260**.

### Precisão de resultado — contrato de 2026-08-01

> **Todo valor monetário que é resultado de fórmula tem 2 casas decimais** — na apresentação, na
> entrada e no motor. Convenção **C7** do
> [Padrão de Viabilidade](padrao-incorporacao#anexo-a--convenções-de-cálculo-do-app).

É essa regra que define **qual** representação é canônica: o **valor monetário**. `% do VGV` e
`R$/m²` são **derivados** — carregam precisão plena internamente e arredondam **só para exibir**.

```text
canônico (R$, 2 casas)  ──derivação exata──▶  % do VGV, R$/m²   (exibidos com arredondamento)
        ▲                                              │
        └──────── só muda por edição deliberada ───────┘
```

`converterUnidade` quantiza somente o destino de identidade (R$ ou m²). Percentuais e R$/m² seguem
com precisão plena até a apresentação. Assim, R$ 10.000.000 pode atravessar uma porcentagem com
dízima e retornar exatamente ao mesmo canônico.

**Estado de conformidade, conferido em 2026-08-23:**

| Ponto | Casas hoje | Conforme? |
|---|---|---|
| `frontend/viab-format.ts:11-23` — `fmtR$` (`CASAS_DECIMAIS_MONETARIAS = 2`) | 2 | ✅ |
| `frontend/exportar.ts:10` — importa `fmtR$`, sem formatador próprio | 2 | ✅ |
| `frontend/exportar.ts:167` — `celulaFx` (CSV e PDF) | 2 | ✅ corte em R$ 0,005 |
| `frontend/tela-financeiro.ts:143` | 2 | ✅ |
| `frontend/tela-empreendimento-tipologias.ts:178` | 2 (default) | ✅ |
| `frontend/tela-fluxo-custos.ts:673,933` — Orçamento em `rs` | 2 | ✅ |
| `frontend/tela-proforma.ts:458` — sensibilidade, via `fmtR$(v, false)` | 2 | ✅ desde a #492 |
| `frontend/fluxo-caixa-motor.ts` — resultados monetários (`round2`, C7) | 2 | ✅ |
| **`frontend/fluxo-tabela.ts:34`** — `celula` da tabela do Fluxo | **0** | ❌ formatador próprio: `Math.round`, e célula **vazia** abaixo de R$ 0,50 → #281 |

> ⚠️ **Esta tabela diverge do texto substituto publicado na #482, e a divergência é deliberada.**
> Aquele texto listava um segundo ❌ para `fmtNum` (`frontend/viab-format.ts:24-25`), porque
> `frontend/tela-proforma.ts` chamava `fmtNum(v, 2)` e número redondo saía sem casas. **A #492
> fechou isso** (PR #499, 2026-08-23): a linha hoje é `fmtR$(v, false)`. O `fmtNum` continua
> declarando só `maximumFractionDigits`, mas **não tem mais consumidor monetário** — os que restam
> são m², hectare e percentual, grandezas não monetárias, que por contrato carregam precisão plena
> e arredondam só para exibir. Manter o ❌ seria mandar consertar o que já foi consertado, que é
> exatamente o defeito que esta issue existe para corrigir.

Áreas (m²) seguem `decimal(12,2)` na persistência; a regra de resultado acima é declarada para
**valor monetário**.

## Interpretações

Onde a spec era ambígua/contraditória, seguimos o app-protótipo e o bom senso: custo do terreno incide sobre a **área do terreno**; “obras” = infraestrutura (Loteamento) / construção+decoração+gestão (Incorporação); projetos e licenciamento no modo % incidem sobre o **VGV**. Detalhes no cabeçalho de `frontend/proforma.ts`.
