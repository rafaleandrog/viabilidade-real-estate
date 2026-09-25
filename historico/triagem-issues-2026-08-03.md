# Triagem das 53 issues abertas — 2026-08-03

As Rodadas 5 (EVI) e 6 (lista de bugs) foram declaradas concluídas, mas **53 issues continuavam
abertas** no GitHub. A causa foi diagnosticada (menção `(#NNN)` em vez de `Closes #NNN` — ver
`PROGRESSO.md`) e já tem prevenção mecânica (`scripts/guard-issue-fechamento.mjs`).

Este documento é o **passivo**: o que de fato entrou, o que não entrou, e com que evidência.

## Método

Para cada issue: ler os **critérios de aceite** do corpo e conferir **contra o código atual da
`main`** — símbolo existe, teste dedicado existe, comportamento está lá.

> ⚠️ **A documentação do repo não foi usada como prova, e por bom motivo: ela mente nos dois
> sentidos.** O `CLAUDE.md` declarava as rodadas "concluídas, todas mergeadas" (53 abertas) e ao
> mesmo tempo afirmava que o app violava o contrato de 2 casas decimais, mandando "corrigir na
> #281" — quando `frontend/viab-format.ts:14` já usava 2 casas. Nem "tem commit citando a issue"
> nem "o doc diz que fez" valem. Só `arquivo:linha`.

**Regra anti-carimbo:** veredito ✅ exige evidência localizável em `arquivo:linha`. Sem isso, é 🟡
por definição. 11 vereditos ✅ foram re-conferidos manualmente, um a um, antes deste documento.

## Placar

| Veredito | Qtd | Ação |
|---|---:|---|
| ✅ CONFIRMADA | **23** | fecha |
| 🟡 PARCIAL | **29** | **fica aberta** — falta o que está descrito |
| ⚪ NÃO É CÓDIGO | **1** | fica aberta — depende de ação do autor |

**Menos da metade se confirma.** Fechar as 53 em bloco teria enterrado 29 pendências reais.

---

## O achado estrutural: o motor de safras não está ligado

Nove issues da cadeia EVI de recebíveis (**#230, #232–#237, #240, #241**) têm o mesmo padrão: a
**matemática foi construída e testada**, mas **não alimenta o cálculo real**. Não é inferência — o
próprio motor declara, em `frontend/fluxo-caixa-motor.ts:505-511`:

> *"NÃO estão ligadas a `receitaMensalLinha`/`calcularFluxo` nesta fase — nenhum estudo existente
> muda de resultado. A integração ao fluxo consolidado é trabalho de issue futura, quando a UI
> oferecer o novo modelo; até lá, o motor legado (`entrada`/`parcelas`/`repasse`) continua sendo o
> único caminho de cálculo real."*

`pmt`, `pagamentosPrazoFixo`, `pagamentosAteMarco`, `pagamentosConcentrado`, `receitaBrutaSafra`,
`jurosSafra`, `componentesEfetivosSafra` existem e têm teste; **nenhum estudo real passa por elas**.
As issues pedem que *o fluxo exiba* juros, carteira e repasse — e o fluxo não exibe.

Foi decisão de arquitetura deliberada e registrada no código. Mas os **critérios de aceite não foram
cumpridos**, então as 9 permanecem abertas. A issue que falta é a de **integração** — hoje ela não
existe no backlog.

---

## ✅ CONFIRMADAS (23) — fecham

| # | Título | Evidência (código hoje) | Commit |
|---|---|---|---|
| 220 | Fixture dourada Calliandra de recebíveis | `frontend/fixtures/calliandra-golden.ts:88,167` + 12 testes | `6285c02` |
| 221 | Inventário de dados legados | `docs/inventario-legado-avancado-2026-08-01.md` (matriz campo/formato/consumidor) | `46f5360` |
| 222 | "Grupo" em vez de "Fase" | `tela-fluxo-receitas.ts:241`, `fluxo-tabela.ts:249` | `a8ca323` |
| 223 | "Após-chaves" em vez de "Pós-obra" | `fluxo-shared.ts:102` `EVENTO_LABEL.pos_obra`, id interno intacto | `a7bf4bb` |
| 224 | Obra ancorada ao fim do Planejamento | `backend/rotas/avancado.ts:79-81` + teste `avancado.test.ts:68` | `b2fc8b1` |
| 225 | "Durante a obra" após o Lançamento | `fluxo-shared.ts:239` + 3 testes | `44e105b` |
| 226 | Após-chaves fixo em 12 meses | `fluxo-shared.ts:201` `APOS_CHAVES_MESES=12` + testes `:70,75` | `a84bc1e` |
| 227 | Série canônica bruto/desconto/líquido | `fluxo-caixa-motor.ts:304,324,349` + 6 testes | `ba5c0ae` |
| 228 | Desagregar deduções, imposto mensal | `fluxo-caixa-motor.ts:861,953,973,1020`; `fluxo-shared.ts:187` | `1b6eea9` |
| 229 | Taxonomia VGV/contratação/Receita Bruta | `fluxo-caixa-motor.ts:186-202` (6 grandezas); `fluxo-tabela.ts:343` | `88abe66` |
| 231 | Horizonte derivado, fallback removido | `fluxo-caixa-motor.ts:802`; `console.warn` em `:894` + 4 testes | `893c438` |
| 244 | Duplicar sem numéricos nulos nem clone parcial | `backend/rotas/estudos.ts:59` `montarCopiaEstudo` + rollback `:355` + 3 testes | `4f920a6` |
| 246 | Normalizar `travado_duracao` do Lançamento | `avancado.ts:69` + teste `avancado.test.ts:95` | `7bd6128` |
| 247 | Token de sucesso no indicador aplicado | `tela-fluxo-receitas.ts:120` `var(--cor-sucesso)` | `42d1670` |
| 249 | Travar Início/Duração de custo ancorado | `avancado.ts:148` `resolverTravamentoCusto` (422) + `avancado-ancoragem.test.ts:51` | `1179cc6` |
| 253 | Retirar "Unidades permutadas" de Tipologias | zero ocorrência em `tela-empreendimento-tipologias.ts`; migração `017` | `df08da5` |
| 258 | Epic — permuta física por tipologia | `fluxo-shared.ts:476`, UI `tela-fluxo-custos.ts:649`, motor `:1307,1447`, migr. 016/017 | `7ebf93c` |
| 261 | Largura uniforme do campo Duração | `tela-fluxo-custos.ts:333` `.mes-calc.mes-crono{width:140px}` | `1179cc6` |
| 265 | Larguras da tabela de Cenários salvos | `tela-cenarios.ts:120,124,130,133,135` | `003ad7c` |
| 267 | Migrar `unidades_permutadas` para a fonte nova | `migracoes/017_...js:27-56`, idempotente por `permuta_tipologia_id` | `38d0d56` |
| 270 | FIN-01 — ADR + 16 golden cases | `docs/viabilidade/funding-capital-stack.md` §14 + 16 testes | `fc9037c` |
| 271 | Camadas de capital + migração do Bloco G | `migracoes/019_...js:59,106`; `backend/rotas/capital-stack.ts:58` + 4 testes | `1a4e78b` |
| 278 | Funding no fluxo, cenários e exportações | `fluxo-tabela.ts:397`; `exportar.ts:209` (CSV+PDF); `tela-cenarios.ts:220` | `1b6eea9` |

---

## 🟡 PARCIAIS (29) — ficam abertas

| # | Título | O que entrou | **O que falta** |
|---|---|---|---|
| 230 | Contrato canônico de componentes | `fluxo-caixa-motor.ts:391` + 17 testes | motor de componentes não ligado a `calcularFluxo` (`:505-511`) |
| 232 | Tabela curta: sinal, parcelas, juros por safra | `:514` `pmt`, `:541` + 4 testes | não alimenta o fluxo consolidado |
| 233 | Componente Obra da tabela longa | `:574` `pagamentosAteMarco` + testes | idem — nenhuma parcela real varia por safra |
| 234 | Saldo a repassar capitalizado | `:614` `pagamentosConcentrado` | repasse real (`motor.ts:939`) segue sem juros |
| 235 | Após-chaves à vista no mês da contratação | `:774` `componentesEfetivosSafra` | regra não aplicada em `recebimentoBrutoMensal` |
| 236 | Carteira de clientes por safra | `:651` `carteiraSaldoSafra` + 5 testes | sem série/KPI de carteira em `FluxoCalc` |
| 237 | Receita Bruta = líquido + juros | `:704` `jurosSafra`, `:741` `receitaBrutaSafra` | `receitaBruta` de `calcularFluxo` continua sem juros |
| 238 | Permuta financeira bruta e líquida | `motor.ts:1072,1077,1402`; UI `tela-fluxo-custos.ts:697` | `permuta_financeira_base` sem controle na UI |
| 240 | Invariantes e reconciliação | `fluxo-invariantes.ts:57,82,155` + 15 testes | faltam produto/estoque, contratação, repasse, dívida; módulo não importado por tela/export |
| 241 | Exibir contratação, juros, carteira, repasse | `fluxo-tabela.ts:195`; funding em `:445` | juros de cliente, carteira e repasse sem linha em tabela/CSV/PDF |
| 245 | Início/Duração sem truncar | largura 148→184px (`tela-fluxo-cronograma.ts:59,83`) | sem unidades responsivas nem teste de render |
| 248 | Editor de pagamento por componentes | `tela-fluxo-receitas.ts:45,748-780` | sem validação bloqueante de soma=100% (backend `avancado.ts:214` admite); sem teste de UI |
| 252 | Cronograma em rascunho, salvamento atômico | `tela-fluxo-cronograma.ts:48` `draftCrono` | **sem endpoint em lote** — não há atomicidade entre eventos, nem guarda de saída |
| 255 | Matriz de regressão de ancoragem | `avancado-ancoragem.test.ts` 8 testes | dimensão "5 abas" não exercida; sem teste de `tela-fluxo-custos` |
| 256 | Linha Preço obrigatória única | migração `014` + `avancado.ts:1184,1267` | **`DELETE .../custos/:cid` não recusa a linha oficial** (`:1358-1376`) |
| 257 | Subcategorias canônicas de Preço | `tela-fluxo-custos.ts:58`; migração `015` | **`validarCamposCusto` não valida `subcategoria`** — backend aceita valor fora da lista |
| 259 | Epic — valor canônico reversível | `premissas-conversao.ts:60-66` + testes | `tela-fluxo-custos.ts:933-952` persiste `%` arredondado a 2 casas |
| 260 | Consumidores lêem o valor canônico | `fluxo-caixa-motor.ts:28` `round2`, 9 usos | quantização só nas séries de venda — custos, saldo e KPIs saem sem 2 casas |
| 266 | Modelo e UI da permuta física | `tela-fluxo-custos.ts:649-662,694`; migr. `016` | sem validação de saldo na UI; sem teste de UI |
| 268 | Permuta física reduz VGV sem gerar caixa | `fluxo-caixa-motor.ts:1307,1448` + 4 testes | redução de estoque/contratação fora de escopo — falta decidir qual Grupo perde estoque |
| 269 | Invariantes da permuta física | `fluxo-invariantes.ts:157-183` + 5 testes | módulo não importado por tela nem por `exportar.ts` |
| 272 | Necessidade de funding e saldos | `capital-stack-motor.ts:70,103,137` + testes | reserva mínima hardcoded `0` (`tela-capital-stack.ts:177`), sem coluna no schema |
| 273 | Financiamento à produção | `capital-stack-motor.ts:412-419,372-378`; golden 3/4/5/14 | **SAC não implementado** (`:157` só cash_sweep/bullet/price); saldo terminal >0 não bloqueia |
| 274 | Capital de giro / dívida ponte | `capital-stack-motor.ts:420,464`; golden 6/7 | carência>prazo não é recusada (zero `throw` no motor); SAC ausente |
| 275 | Sponsor e Preferred Equity | `capital-stack-motor.ts:206,241,309`; MOIC/TIR `:608-664` | sem validação de "ao menos uma camada Sponsor" nem de residuais somando 100% |
| 276 | Waterfall e revenue share | ordem §6.1 em `:309+`; regressão `capital-stack-motor.test.ts:168` | soma de participações >100% não falha; equity pode passar à frente de dívida vencida |
| 277 | Aba Capital Stack | `tela-capital-stack.ts:174,634,644,285-292` | **sem reordenação de camadas** (`ordem` só na criação `:225`); falta aviso do §17 |
| 279 | Remover controles inertes do Bloco G | `tela-financeiro.ts:44-55` | **7 campos seguem inertes** (`tarifas_bancarias_pct`, `taxa_adm_carteira_pct`, `taxa_estruturacao_divida_pct`, `taxa_gerenciamento_obra_pct`, `juros_financeiros_aa`, `indice_correcao_taxa_aa`, `taxa_juros_valor_futuro_aa`) |
| 281 | Monetário com 2 casas na tela e na entrada | `viab-format.ts:13-14` + teste; `tela-fluxo-custos.ts:673,933` | **`exportar.ts:10` ainda define seu próprio `R$ = v.toFixed(2)`** — critério "função única" não se sustenta |

---

## ⚪ NÃO É CÓDIGO (1) — fica aberta

| # | Título | Estado no código | O que depende de você |
|---|---|---|---|
| 264 | Confirmar as duas séries do gráfico e o estado 0% | 2 séries quando `alterado` (`tela-cenarios.ts:271-296`); decisão do 0% em comentário `:271-272`; sem teste | conferir a versão instalada na instância e registrar na issue |

---

## Como revisar

1. Leia a tabela **✅ CONFIRMADAS**. Se quiser **manter alguma aberta** mesmo confirmada (para
   rastrear trabalho relacionado, por exemplo), passe os números — elas não serão fechadas.
2. As **🟡** e a **⚪** ficam abertas de qualquer forma, e recebem comentário com o "o que falta"
   desta tabela, virando pendência acionável.
3. Se discordar de algum 🟡 (achar que na verdade está pronto), diga qual — eu re-verifico esse caso
   específico antes de qualquer coisa.

Nada muda de estado no GitHub até sua palavra.
