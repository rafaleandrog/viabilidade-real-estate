# Rodada 13 — tornado de alavancas e margem de segurança (aba Cenários do Preliminar)

**Aberta em 2026-09-16.** Issues **#724–#736** (13). Fila estritamente serial.

## O que é

A **Fase 2** do handoff de UX que a Rodada 12 executou pela metade. Aquela rodada entregou as Fases
0 e 1 (auditoria + redesenho da aba Gráficos) e registrou o resto como fora de escopo:

- `docs/rodada-12/auditoria.md:48-50` — o tornado de alavancas (§4.2) *"depende de recalcular o
  proforma ±10% por premissa — **calculável hoje sem mudança de schema**, mas fora do escopo
  aprovado desta rodada. Fica registrado para uma rodada futura."*
- `docs/rodada-12/auditoria.md:63-65` — margem de segurança (§4.3) e benchmark por praça, fora por
  *"exigirem um campo `base_calculo` por linha de custo, hoje inexistente de forma uniforme"*.

Esta rodada executa as duas — e **a segunda premissa não se sustentou**, o que muda o custo da
rodada inteira (ver § Duas decisões técnicas).

## ⚠️ Risco declarado: o handoff não está versionado

`tela_kpis_viabilidade_handoff.md` é **documento fora do GitHub** (`CLAUDE.md`, linha da Rodada 12;
`docs/rodada-12/auditoria.md:3`). Dezesseis arquivos do repositório o **citam**; nenhum o contém.
Então `§4.2`, `§4.3` e `§4.6` existem aqui **só por referência indireta** — ninguém no repo pode
conferir se uma implementação cumpre a seção que ela alega cumprir.

Consequência prática: o critério de aceite de cada issue precisa ser **auto-contido** (descrever o
comportamento, não citar a seção), e divergência entre o que este doc diz e o que o autor lembra do
handoff resolve-se **perguntando a ele**, não relendo o repositório.

## Escopo — qual "aba Cenários"

Existem duas, e o handoff §4.6 descreve literalmente uma delas:

| | **Preliminar** (alvo) | Avançado (fora, a decidir) |
|---|---|---|
| Onde | sub-aba `cenarios` (`frontend/tela-preliminar.ts:57`) | página de nível 1 (`frontend/tela-cenarios.ts`) |
| Implementação | `frontend/tela-proforma.ts:655-791` (`_renderSensibilidade`) | componente próprio |
| Modelo | **dropdown de 1 variável** + colunas Bear/Base/Bull | 2 sliders + cenários salvos |
| Motor | `calcularProforma` — puro, estático | `calcularFluxo(aplicarCenario(...))` |

Os três defeitos que o handoff §4.6 nomeia — seletor sem indicação de relevância, três colunas de
valores absolutos, linhas invariantes ocupando o mesmo espaço visual — são, um a um, o que
`_renderSensibilidade` faz hoje.

**O Avançado fica fora**, e é decisão pendente do autor: ele tem só 2 alavancas (`CenarioParams` =
`precoVendaPct`, `custoObraPct`), então um tornado lá seria de 2 barras — degenerado.

## O motor hoje, medido

- `frontend/proforma.ts:100` — `VariavelSensibilidade` admite **5** valores: `preco`,
  `permuta_fisica`, `permuta_financeira`, `custo_infra`, `custo_obras`.
- `frontend/proforma.ts:442-443` — `fatorSens` devolve o fator **só** para a variável que casa,
  senão `1`. **Uma variável por vez** — é a limitação central para um tornado e para o cenário
  composto.
- Incide em 9 pontos: `:468`, `:469`, `:501` (o catálogo, fonte do VGV), `:579`, `:584`, `:638`,
  `:642`, `:655`, `:659`.
- `frontend/proforma.ts:849-885` — `precoSugeridoM2` faz **bisseção de 60 iterações** sobre
  `calcularProforma`, com guarda `P_MAX` e `null` quando não há raiz. É o **precedente** de inverter
  o motor numericamente neste repositório.
- `frontend/tela-proforma.ts:655-791` — `_renderSensibilidade`: `urbi-select` de variável
  (`:769-774`, alimentado por `_variaveis(lot)` em `:626-633`), 3 colunas bear/base/bull (`:724-728`),
  8 linhas monetárias (`:687-703`) e 2 linhas de indicador em % com pílula de faixa (`:704-705`,
  `:756-757`).

## Duas decisões técnicas que mudam o custo da rodada

**1 · A margem de segurança NÃO exige `base_calculo` no schema.** O motivo registrado pela Rodada 12
parte da decomposição analítica `Resultado(fp,fc) = fp·V + fp·Sv + fc·So + Sf` do handoff §4.3, que
de fato precisaria classificar cada linha de custo. Mas essa decomposição é **um jeito de calcular**,
não o resultado: `calcularProforma` é pura e já sabe, no código, qual custo é % do VGV, qual é % da
obra e qual é fixo. **Invertendo o motor numericamente** (secante + bisseção de garantia, com
verificação do resíduo) recuperam-se os mesmos números — sem campo novo, sem migração, e continua
correto se uma linha mudar de base amanhã.

**2 · O "Terreno máximo" nem precisa de inversão.** `custoTerreno` é puramente aditivo, então
`T_max = resultado(considerar_custo_terreno=false) − alvo` — fórmula fechada, uma execução do motor.

> **Consequência: nenhuma PR desta rodada toca `schema.json`, e a `versao` do manifesto não bumpa.**

## Fila — 12 PRs de produto, estritamente serial

Serial não é preferência: o `PROGRESSO.md` é prependado por todo PR (armadilha 10 do `CLAUDE.md`).

> **A #724 não está na fila, e isso é deliberado.** `licenciamento_modo` / `licenciamento_pct` /
> `licenciamento_valor_fixo` existem no `schema.json` e no `ProformaInput`, e **nenhum leitor os
> consome** — o usuário digita um custo de licenciamento e ele não entra no proforma. É bug de motor
> com dinheiro dentro, achado de passagem, e **consertá-lo muda número existente**: quando entra é
> decisão do autor, não desta fila. Fica registrada aqui para não sumir.

| # | Issue | Entrega |
|---|---|---|
| 1 | #725 | `VariavelSensibilidade` ganha `custo_terreno` e `custo_indireto`; `fatorSens` incide em `proforma.ts:646` e `:678,680`. Sem isso o tornado tem 4 barras e a imagem do autor tem 5 |
| 2 | #726 | **Achado, não conserto.** `fatorSens('custo_obras')` toca só `construcao` (`:659`), mas o KPI `custoObras` = `construcao + decoracao + gestaoConstrucao`. Estressar ±10% move menos que 10% do custo que a tela publica. Muda número existente ⇒ decisão do autor |
| 3 | #727 | `frontend/tornado-alavancas.ts` puro: uma execução por variável por lado, ordenação por **\|Δ R$\|** (escala-livre, definida com resultado base ≈ 0 — o caso da #720), exclusão da base circular que o §4.6.E manda excluir |
| 4 | #728 | Componente `viab-grafico-tornado`: barras simétricas em torno do tracejado central, grid `112px · trilho · valor` (o `grid-template-columns` de `frontend/grafico-barra-ranqueada.ts:26`), 3 primeiras em destaque |
| 5 | #729 | **Fiação**: sai o `urbi-select` (`tela-proforma.ts:769-774`), entra o tornado; passo configurável ±5/±10/±15 |
| 6 | #730 | Tabela com Δ% e amplitude, invariantes num grupo recolhido. Reusa `calcularVariacao`/`fmtVariacao` (`frontend/cenario-variacao.ts:38,55`) |
| 7 | #731 | Faixa bear–base–bull contra benchmark, no lugar das duas pílulas. Reusa `montarMedidor` (`frontend/medidor-faixas.ts:27`) |
| 8 | #732 | `frontend/margem-seguranca.ts` puro: inverte `calcularProforma` por variável, **verificando o resíduo** — sem raiz devolve `null`, nunca um número plausível |
| 9 | #733 | Bloco "Margem de segurança": 4 cartões 2×2, rodapé declarando a margem-alvo |
| 10 | #734 | Consumo do colchão, alerta de cenário inviável, mensagem de baixa alavanca (§4.6.E) |
| 11 | #735 | Cenário composto — as três maiores alavancas juntas. **Exige `fatorSens` multivariável** (hoje é uma por vez) |
| 12 | #736 | Fecha a rodada: este doc, a tabela do `CLAUDE.md` e o `PROGRESSO.md`, **na mesma alteração** que fecha a última issue |

## Duas armadilhas que a auditoria desta rodada já pagou

Os dois erros abaixo estavam no rascunho do plano e teriam entrado no código:

1. **O componente chama-se `viab-grafico-cadeia-areas`** (`frontend/grafico-cadeia-areas.ts:24-30`).
   O nome curto `viab-cadeia-areas` **não existe** — atributo ou elemento inexistente em Lit não dá
   erro, só não faz nada.
2. **A trava do `fmtR$Milhoes` não é um contador solto.** É `CONSUMIDOR = { arquivo, chamadas: 1 }`
   (`frontend/cascata-milhoes.test.ts:77`) mais a lista `EXCECOES` (`:121-130`), que reprova exceção
   **órfã ou desnecessária**. Hoje há **um** consumidor de produção
   (`frontend/grafico-cascata.ts:213`). Usá-lo no tornado ou nos cartões **quebra a suíte** até
   alguém editar aquilo deliberadamente — que é exatamente o que o teste foi desenhado para forçar.

## Verificação, por PR

```bash
bash scripts/validar-frontend.sh
node scripts/preflight-pr.mjs --corpo <corpo.md> --titulo "<título>"
```

Além da suíte, **a prova de cada PR de tela é um caso de render em Chromium**
(`frontend/render/*.render.test.ts`) — a única camada que enxerga "o componente não chamou", que é a
classe de defeito nº 1 do `CLAUDE.md`. O critério de aceite escrito na issue é o teste de mutação:
**apagar a chamada no componente tem de deixar algo vermelho.**

Contagem de testes declarada em PR sai de comando rodado na mesma sequência
(`node --test … | grep '^# tests'`), nunca de aritmética — armadilha 13.

## Como foi executada — encerrada em 2026-09-25

A fila de 12 saiu em **seis PRs de produto**, todos mergeados com revisão por lentes Kimi (o App do
Codex ficou sem cota a partir do PR 763) e merge autorizado pelo autor para a sessão inteira:

| PR | Issues | Entrega |
|---|---|---|
| 757 | #725, #727, #728, #729, #732, #733 | Tornado de alavancas (`frontend/tornado-alavancas.ts`, `viab-grafico-tornado`), passo ±5/±10/±15, margem de segurança (`frontend/margem-seguranca.ts`, os 4 cartões) — seis itens num PR só, desvio deliberado do serial por praticidade de sessão única |
| 774 | #730 | Tabela com Δ% dos dois lados, amplitude ordenável e o grupo recolhido de invariantes (`frontend/sensibilidade-tabela.ts`) |
| 775 | #731 | Faixa bear–base–bull contra o benchmark por indicador, numa escala única (`frontend/faixa-cenarios-motor.ts`, `viab-faixa-cenarios`) |
| 776 | #734 | Consumo do colchão, alerta de cenário inviável em palavras, baixa alavanca e base circular (`frontend/consumo-colchao.ts`) — a revisão achou e o PR consertou um bloqueante real: base já deficitária lida como consumo |
| 777 | #735 | Cenário composto: o motor aceita um conjunto de fatores (`fatoresDe`), as três maiores alavancas não circulares estressadas juntas (`frontend/cenario-composto.ts`), item do topo do tornado |
| (este) | #736 | Fechamento: este doc, a tabela do `CLAUDE.md`, as notas envelhecidas da auditoria da Rodada 12 e o `PROGRESSO.md` |

**Ficou de fora, e por quê:**

- **#726** (estressar "custo de obras" move menos que o custo de obras que a tela publica —
  `fatorSens('custo_obras')` toca só a construção, o KPI soma construção + decoração + gestão):
  **decisão do autor**, porque muda número existente em todo estudo. Segue aberta.
- **#724** (licenciamento): fechou pelo ramo (b), fora da fila, no PR 772 — a premissa da tela que
  "aceita e salva" não se sustentou (nunca houve tela); as três colunas ficaram aposentadas.
- **Aba Cenários do Avançado**: 2 alavancas só (`precoVendaPct`, `custoObraPct`), modelo de fluxo
  temporal — um tornado ali seria de duas barras. Decisão pendente do autor.
- **Benchmark por praça, versionado e editável** (handoff §5.3 / Fase 3): exige schema novo.
- **Segunda camada de indicadores físicos** (§3.2) e a **Fase 4** inteira (TIR, VPL, exposição):
  exigem fluxo de caixa, que o Preliminar não tem por definição.

**As duas premissas que não se sustentaram**, registradas onde nasceram
(`historico/rodada-12/auditoria.md`, notas datadas no lugar): o tornado "fica para uma rodada
futura" — foi entregue; a margem de segurança "exige `base_calculo` no schema" — a inversão
numérica do motor entregou os mesmos números sem campo novo, e nenhum PR da rodada tocou
`schema.json` nem bumpou a `versao`.

