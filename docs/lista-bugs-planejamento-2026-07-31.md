# Planejamento da lista de bugs — 24 itens — 2026-08-01

**Sessão:** planejamento e abertura do backlog da lista de bugs (documental e diagnóstica)
**Branch:** `claude/viabilidade-buglist-matrix-t2yjz3` · **Commit-base:** `c0586ef`
**Escopo:** documentação e GitHub. **Nenhuma linha de runtime, schema, migração ou teste foi alterada.**

---

## 1. O que esta rodada é

A planilha `lista_bugs_revisada_para_issues_todos_itens.xlsx` trouxe **24 itens** levantados pelo
autor no app instalado. Esta sessão conferiu cada um contra a `main`, corrigiu o diagnóstico
recebido onde ele divergia do código, e abriu **24 destinos GitHub individuais**.

**Regra não negociável de completude:** nenhum item pode desaparecer por ser parecido com outro.
Sobreposição vira dependência, tracker, issue de UX, issue de teste ou emenda de issue existente —
**nunca** exclusão, e **nunca** implementação duplicada.

| Métrica | Valor |
|---|---:|
| Itens de origem com registro obrigatório | **24** |
| Novas issues, epics e trackers | **22** |
| Sub-issues da epic de permuta física | **4** |
| Issue existente atualizada (item 16) | **#238** |
| Issue existente convertida em epic (item 24) | **#239** |
| Sub-issues do programa financeiro | **10** (FIN-01…FIN-10) |
| **Itens sem destino GitHub** | **0** |
| Issues implementadas nesta sessão | **0** |

---

## 2. Matriz mestre dos 24 itens

| ID | Item | Issue | Título | Tipo de registro | Onda | Depende de | Migração |
|---|---:|---|---|---|---|---|---|
| BUGLIST-001 | 1 | **#244** | `fix(estudos)` duplicar estudo sem reenviar numéricos opcionais nulos | Nova issue | A | — | Não |
| BUGLIST-002 | 2 | **#245** | `fix(cronograma)` dimensionar Início e Duração sem truncar | Follow-up de #174/#197 | B | — | Não |
| BUGLIST-003 | 3 | **#246** | `fix(cronograma)` normalizar `travado_duracao` do Lançamento em legados | Follow-up de #166 | A | #224/#225 (conferência) | Preferir sem |
| BUGLIST-004 | 4 | **#247** | `fix(receitas)` token de sucesso no indicador aplicado | Nova issue | B | — | Não |
| BUGLIST-005 | 5 | **#248** | `feat(receitas)` editor de pagamento mensal por componentes | Issue de UX, ligada à Rodada 5 | R5 | #221, #230, #232–#237 | Nas executoras |
| BUGLIST-006 | 6 | **#249** | `fix(custos)` derivar e travar Início e Duração quando ancorada | Issue principal | C | #252 (coord.) | Não |
| BUGLIST-007 | 7 | **#250** | `fix(rotas)` `/custos` como slug público, `/obra` como alias | Nova issue | B | #251 (mesmo PR) | Não |
| BUGLIST-008 | 8 | **#251** | `feat(rotas)` subaba na URL, deep link e histórico | Nova issue | B | #250 | Não |
| BUGLIST-009 | 9 | **#252** | `feat(cronograma)` rascunho e salvamento atômico | Nova issue | C | #246, #249, #224/#225 | Não |
| BUGLIST-010 | 10 | **#253** | `chore(tipologias)` retirar Unidades permutadas | Issue **bloqueada** | D | **#267**, #221 | Sim + bump |
| BUGLIST-011 | 11 | **#254** | `epic(recebiveis)` reconciliar fluxo por safras e concluir o pacote EVI | **Epic de rastreio** | R5 | #220, #221, #227–#237, #240, #241 | Nas executoras |
| BUGLIST-012 | 12 | **#255** | `test(custos)` validar ancoragem em todas as abas e legados | Issue de validação | C | **#249**, #252 | Não |
| BUGLIST-013 | 13 | **#256** | `fix(terreno)` uma única linha Preço obrigatória, também em legados | Follow-up de #180/#193 | D | #221 | Provável + bump |
| BUGLIST-014 | 14 | **#257** | `feat(terreno)` subcategorias canônicas e migração da Permuta legada | Nova issue | D | **#256**, #221 | Sim + bump |
| BUGLIST-015 | 15 | **#258** | `epic(terreno)` permuta física por tipologia e quantidade | **Epic** + 4 sub-issues | D | #220, #221, #227, #229, #240, #256, #257 | Sim + bump |
| ↳ 015-A | 15 | **#266** | modelo e UI (contém o ADR de valoração) | Sub-issue | D | #256, #257 | Sim + bump |
| ↳ 015-B | 15 | **#267** | fonte de verdade e migração — **portão de #253** | Sub-issue | D | #266, #221 | Sim + bump |
| ↳ 015-C | 15 | **#268** | motor: estoque, contratação e VGV sem caixa | Sub-issue | D | #266, #267 | Herdada |
| ↳ 015-D | 15 | **#269** | relatórios, invariantes e reconciliação | Sub-issue | D | #268 | Não |
| BUGLIST-016 | 16 | **#238** | `feat(terreno)` permuta financeira bruta e líquida | **Emenda de issue existente** | R5 · 4 | #228, #237, #256, #257, #259, #260 | Conforme #238 |
| BUGLIST-017 | 17 | **#259** | `epic(valores)` valor canônico e conversão reversível | **Epic de fundação** | D | #220, #221, #229 | Possível + bump |
| BUGLIST-018 | 18 | **#260** | `fix(calculos)` fonte única de valor resolvido | Nova issue | D | **#259**, #220, #227–#229, #237 | Herdada |
| BUGLIST-019 | 19 | **#261** | `fix(custos)` largura e leitura do campo Duração | Issue visual | C | **#249** | Não |
| BUGLIST-020 | 20 | **#262** | `fix(ui)` sobreposição do indicador de variação nos KPIs | Follow-up de #176 | B | — | Não |
| BUGLIST-021 | 21 | **#263** | `test(cenarios)` validar KPIs compartilhados em Cenários | Issue de aceite | B | **#262** | Não |
| BUGLIST-022 | 22 | **#264** | `fix(cenarios)` confirmar as duas séries e decidir o estado 0% | Issue de verificação | B | #185, processo de release | Não |
| BUGLIST-023 | 23 | **#265** | `fix(cenarios)` redistribuir larguras da tabela de Cenários salvos | Follow-up de #187 | B | — | Não |
| BUGLIST-024 | 24 | **#239** | `epic(financeiro)` Capital Stack, dívida e retorno do equity | **Epic** + FIN-01…FIN-10 | Prog. Fin. | #220, #221, #228, #231, #237, #240, #241 | Em etapas + bump |

### Programa financeiro — sub-issues da #239

| # | Código | Entrega | Depende de |
|---|---|---|---|
| **#270** | FIN-01 | ADR, glossário, timing mensal e 16 golden cases | #239 — **portão** |
| **#271** | FIN-02 | Camadas de capital e migração do Bloco G como rascunho | FIN-01 |
| **#272** | FIN-03 | Necessidade de funding, fluxo após funding e saldos | FIN-01, FIN-02 |
| **#273** | FIN-04 | Financiamento à produção por custos elegíveis | FIN-03 + recebíveis estáveis |
| **#274** | FIN-05 | Capital de giro e dívida ponte | FIN-03 |
| **#275** | FIN-06 | Sponsor e Preferred Equity | FIN-03 |
| **#276** | FIN-07 | Waterfall, retorno preferencial, residual e revenue share | FIN-04, FIN-05, FIN-06 |
| **#277** | FIN-08 | Interface de Capital Stack e editor de camadas | FIN-02 a FIN-07 |
| **#278** | FIN-09 | Fluxo, KPIs, cenários e exportações | FIN-03 a FIN-08 |
| **#279** | FIN-10 | Limpeza, ativação definitiva e compatibilidade | FIN-02 a FIN-09 |

Especificação funcional completa: [`docs/viabilidade/funding-capital-stack.md`](viabilidade/funding-capital-stack.md).

---

## 3. Diagnóstico confirmado na `main`

Toda linha abaixo foi lida no código, não presumida.

| ID | Comportamento atual | Evidência |
|---|---|---|
| 001 | Duplicar copia todo campo fora de `CAMPOS_NAO_COPIAVEIS`, inclusive numéricos `null`; o shell recusa. Sem transação: falha em estrutura filha deixa clone parcial | `backend/rotas/estudos.ts:328-331`, `:46-50`; `backend/rotas/avancado.ts:1170+`; `schema.json:40,109,111-114` |
| 002 | Largura fixa: `.campo-mes viab-num{148px}`, `.params viab-num{160px}`; afixos na mesma escala tipográfica do número | `frontend/tela-fluxo-cronograma.ts:68,45-46`; `frontend/viab-num.ts:66-70,133-139` |
| 003 | `recalcularTravados` normaliza só `travado_inicio`; a flag de duração legada sobrevive e o PATCH devolve 422 | `backend/rotas/avancado.ts:53-75,278,299,422`; `frontend/tela-fluxo-cronograma.ts:177,202,206` |
| 004 | `.stat.ok` usa `var(--cor-info)` — azul comunica informação, não conclusão | `frontend/tela-fluxo-receitas.ts:105,256,259,413-417` |
| 005 | Editor expõe listas genéricas e 4 periodicidades; checkbox `juros` sem efeito | `frontend/tela-fluxo-receitas.ts:33-34,633-637,668-681,745-780` |
| 006 | Início trava em 3 casos, Duração só em Construção. **O backend permite sobrescrever a duração derivada** | `frontend/tela-fluxo-custos.ts:724-757` vs `:758-780`; `backend/rotas/avancado.ts:1130,1144` vs `:1134,1148` |
| 007 | `{ id:'obra', label:'Custos' }` — id preservado de propósito pela #40 | `frontend/tela-avancado.ts:49-58`; `frontend/tela-estudo.ts:135,144` |
| 008 | `parsearSubRota` lê só `partes[2]`; subaba vive em `@state subAtiva` | `frontend/index.ts:22-31`; `frontend/tela-avancado.ts:73-89,113-118` |
| 009 | Cada `input-numero-change` faz PATCH, reancora custos e emite toast | `frontend/tela-fluxo-cronograma.ts:193,204,280-304`; `backend/rotas/avancado.ts:428-431` |
| 010 | `unidades_permutadas` é a única fonte de permuta física, consumida pelo motor | `frontend/tela-empreendimento-tipologias.ts:212,186-189`; `schema.json:289`; `frontend/fluxo-shared.ts:149-154` |
| 011 | Motor rateia valor nominal por curva; sem safra, PMT, juros, carteira ou reconciliação | `frontend/fluxo-caixa-motor.ts`; matriz em `docs/rodada-5-evi-2026-07-31.md` §2, §2.1 |
| 012 | A matriz aba × âncora × tipo × legado nunca foi exercida | `frontend/tela-fluxo-custos.ts` sem teste; `backend/rotas/avancado.test.ts` não cobre |
| 013 | `obrigatoria` decidida no servidor; o backfill cobre só `terreno/Compra` de menor id por estudo | `frontend/tela-fluxo-custos.ts:207-212,228-231,591-593`; `migracoes/007:22-32`; `migracoes/008` |
| 014 | Subcategorias de Preço: `Valor à vista`, `Permuta`, `Parcelado`, `Outro` — uma só "Permuta" | `frontend/tela-fluxo-custos.ts:52` |
| 015 | Sem vínculo tipologia↔quantidade na linha de custo; `distribuicao_modo` não é entrega de unidades | `frontend/tela-fluxo-custos.ts:52,163-167,645-722`; `frontend/fluxo-shared.ts:149-154` |
| 016 | Classificação vem da **subcategoria**; só a visão líquida existe; campos vazios dependem de `distribuicao_modo` | `frontend/fluxo-caixa-motor.ts:385-387,591-594,654-670`; `frontend/tela-fluxo-custos.ts:697-699,728-730,762-764` |
| 017 | Duas arquiteturas: Premissas com campo por unidade + heurística #119; Custos com valor único arredondado | `frontend/premissas-conversao.ts:50-58`; `frontend/tela-premissas.ts:334-358`; `frontend/tela-fluxo-custos.ts:873-875,882-896` |
| 018 | Sem resolver comum; `resolverCustoTotal` serve só a Custos do Avançado | `frontend/tela-fluxo-custos.ts:678-681`; `proforma.ts`, `fluxo-shared.ts`, `fluxo-caixa-motor.ts`, `tela-resumo.ts` |
| 019 | `.campo-mes{140px}` serve os dois campos; travado vira `.mes-calc` sem largura reservada | `frontend/tela-fluxo-custos.ts:318,322,735-747,749-755,769-778` |
| 020 | `.kpi-var` absoluto sobre o card; o "empurra vizinho" já foi corrigido pela #176 | `frontend/fluxo-tabela.ts:47,53-65,154-186` |
| 021 | Cenários é o único caller que passa a base → é onde `.kpi-var` renderiza | `frontend/tela-cenarios.ts:268` vs `frontend/tela-fluxo-ver.ts:117` |
| 022 | **A `main` já mostra duas séries** quando há simulação; o estado 0% é decisão explícita | `frontend/tela-cenarios.ts:250-260`, decisão em `:231-232` |
| 023 | `width:auto` + colunas de 84px/68px — **decisão deliberada da #187** | `frontend/tela-cenarios.ts:99,110,113,384-394`; `PROGRESSO.md:547-551` |
| 024 | Bloco G inteiro inerte: ~25 colunas persistidas e renderizadas, zero referências no motor | `schema.json:106-139`; `frontend/tela-financeiro.ts`; grep = 0 em `fluxo-caixa-motor.ts`/`proforma.ts`/`fluxo-shared.ts` |

### 3.1 Diferença de release — descartada como causa

O último release publicado é **`viabilidade-v0.1.12_6655ac74`** (2026-07-29 15:18).
`git log 6655ac74..origin/main` devolve **somente commits de documentação**.

> **Não há código na `main` além do que já foi publicado.** Se o autor ainda vê o sintoma dos itens
> 2, 20, 22 e 23 no app instalado, a instância está rodando um **build anterior** (v0.1.4 ou mais
> antigo), e não "a `main` está atrás". Verificar isso é critério de aceite explícito da **#264**.

---

## 4. Cinco correções ao diagnóstico recebido

O backlog anexado à planilha divergia do código em cinco pontos. Todas as issues foram abertas já
com a versão corrigida.

1. **#249 (item 6) — a assimetria é de backend também.** O diagnóstico dizia que "a tela não aplica
   a regra". O backend **permite deliberadamente** editar `duracao_meses` de linha ancorada
   (`avancado.ts:1130,1144`) enquanto trava `inicio_mes` com 422 (`:1134,1148`). Corrigir só a UI
   deixaria a API divergente.

2. **#257 (item 14) — a regra de migração proposta era insustentável.** O backlog mandava migrar
   por `distribuicao_modo` (`unit_delivery`→física, `sales_revenue`→financeira). Mas
   `fluxo-caixa-motor.ts:385` trata **toda** linha `Preço/Permuta` como permuta *financeira*, e
   `distribuicao_modo` é curva de rateio (`tela-fluxo-custos.ts:163-167`). A permuta física vem de
   `unidades_permutadas`. **Regra aprovada pelo autor em 2026-08-01: toda `Permuta` legada →
   `Permuta financeira`**, preservando o resultado de todo estudo.

3. **#259 (item 17) — o Preliminar não é uniformemente correto.** `tela-premissas.ts:334-358` tem
   uma heurística de preservação de round-trip (#119) que funciona porque há **um campo persistido
   por unidade**; `tela-fluxo-custos.ts:882-896` tem **um único** `orcamento_valor` +
   `orcamento_unidade` e converte com arredondamento a cada clique, sem preservação. São
   arquiteturas diferentes — o contrato canônico precisa cobrir as duas.

4. **#262 (item 20) — escopo reduzido.** O "empurrar cards vizinhos" já foi corrigido pela #176
   (`min-width:0`, `fluxo-tabela.ts:53-57`). O que sobra é `.kpi-var` em `position:absolute`
   (`:58-63`) sobrepondo o valor **dentro** do card.

5. **#265 (item 23) — é reversão de decisão, não correção de descuido.** `table.cen{width:auto}` foi
   introduzido de propósito pela #187 (`PROGRESSO.md:547-551`). A issue registra isso e pede a
   reversão consciente.

---

## 5. Sobreposições e como são rastreadas sem duplicar código

| Sobreposição | Quem implementa | Quem valida / apresenta | Garantia |
|---|---|---|---|
| 6 · 12 · 19 | **#249** (regra funcional) | **#255** matriz de regressão; **#261** largura e legibilidade | #249 declara as outras fora de escopo; #261 pode ir no mesmo PR com aceite próprio; #255 não reimplementa |
| 20 · 21 | **#262** (`fluxo-tabela.ts`) | **#263** valida em Cenários | #263 proíbe duplicar o CSS; ajuste necessário volta ao compartilhado |
| 7 · 8 | **#251** define a gramática | **#250** é o caso `custos` dela | Mesmo PR, aceites separados |
| 10 · 15 | **#258/#267** criam a fonte nova | **#253** desliga a antiga | #253 nasce bloqueada até #267 fechar |
| 13 · 14 · 15 · 16 | #256 → #257 → #258 → #238 | — | Ordem estrita; cada uma declara a anterior |
| 17 · 18 | **#259** cria o contrato | **#260** faz os consumidores lerem | #260 não redefine o contrato; #259 não altera consumidor |
| 5 · 11 | Cadeia EVI #230, #232–#237 | **#248** UX; **#254** epic de rastreio | Nenhuma das duas escreve motor |

---

## 6. Ondas e precedências

| Onda | Issues | Portão de saída |
|---|---|---|
| **A — bloqueantes** | #244, #246 | Duplicação funciona nos 4 cruzamentos; nenhum Lançamento legado travado |
| **B — UX e navegação** | #245, #247, #250+#251, #262, #263, #264, #265 | Zero matemática alterada; `validar-frontend.sh` verde em cada PR |
| **C — cronograma e custos** | #249 (+#261), #252, #255 | Matriz da #255 executada antes de a onda D tocar Custos |
| **D — terreno e valor canônico** | #259 → #260 → #256 → #257 → #258 (#266→#267→#268→#269) → #253 | ADR de valor canônico e ADR de permuta física aprovados antes de código |
| **Rodada 5 (paralela)** | #248, #254 + cadeia #220–#241 | #254 só fecha quando as executoras fecharem com diff |
| **Programa Financeiro** | #239 + #270…#279 | #270 é portão documental; #271 só depois de #220, #221, #228, #231, #237 estáveis |

**Precedências não negociáveis** — somadas às três da Rodada 5 (#220/#221 antes de qualquer M2 ·
#231 antes de #232/#233 · #228 antes de #237, #238 e #239):

```text
#244, #246      antes de usar duplicação como fixture
#249            antes de #255 e #261
#251            junto/antes de #250
#267            antes de #253
#256 → #257 → #258   nesta ordem
#259            antes de #260
#262            antes de #263
#220,#221,#228,#231,#237 estáveis   antes de #271
```

**Um PR por issue**, exceto os pares declarados (#250+#251, #249+#261 e, opcionalmente,
#262+#263) — sempre com aceite verificado separadamente e `Closes #a, closes #b` (a keyword
**repetida** por issue; `Closes #a, #b` fecha só a primeira).

---

## 7. Documentação alterada nesta sessão

**Adicionados**

- `docs/lista-bugs-planejamento-2026-07-31.md` — este mapa mestre;
- `docs/viabilidade/funding-capital-stack.md` — especificação funcional do Item 24.

**Alterados por merge localizado**, preservando histórico, anexos e comportamento vigente:
`inteligencia-evi-incorporacao.md` · `padrao-incorporacao.md` · `modelo-de-dados.md` ·
`formulas.md` · `exportacao.md` · `visao-geral.md` · `rodada-5-evi-2026-07-31.md` ·
`issues-evi-propostas-2026-07-31.md` · `CLAUDE.md` · `PROGRESSO.md`.

**Apenas propostos, não aplicados**

`docs/spec/estudo-de-viabilidade-spec.md` é **fonte normativa** e exige aprovação própria. Ela
descreve o **Preliminar** — o Avançado é "v2" (`:80`) —, então nenhum dos itens 6–16 e 24 está
normatizado ali. As emendas que ela precisaria receber, quando o autor aprovar:

1. gramática de URL com subaba (`/detalhe/:id/:pagina/:subaba`) — itens 7 e 8;
2. as quatro subcategorias canônicas da linha Preço do Terreno — item 14;
3. permuta física por tipologia e quantidade como fonte única — item 15;
4. contrato de valor canônico para campos multiunidade — itens 17 e 18;
5. Capital Stack, funding e retorno do capital — item 24;
6. as seis emendas de recebíveis já listadas em `docs/revisao-recebiveis-calliandra-2026-07-31.md` §11.

**Não tocados**

`frontend/**` · `backend/**` · `schema.json` · `migracoes/**` · `manifesto.json` · `versao` ·
`package.json` · `scripts/**` · `.github/workflows/**` · monorepo `urbiverso/urbiverso`.

---

## 8. Dúvidas registradas

**Resolvidas pelo autor em 2026-08-01**

1. Alvo do Item 24 = **`Viabilidade → Financeiro`** (`tela-financeiro.ts`), conforme a
   especificação §1 e a #239. `Custos → Financeiro` permanece grupo de custos operacionais.
2. Taxonomia GitHub = **prefixo no título** (`[BUGLIST-0NN]`, `[FIN-0N]`), labels só
   `bug`/`enhancement`. Nenhum label novo, mesmo padrão de `[EVI-0NN]`.
3. Migração da `Permuta` legada = **toda para `Permuta financeira`**.

**Abertas — bloqueiam implementação, não o backlog**

1. **#259 — qual é a tela do caso relatado?** A aritmética não fecha: em Custos, `rs` é arredondado
   a **0 casas** (`tela-fluxo-custos.ts:873-875`), então R$ 9.999.998,**76** não pode sair de lá; nas
   Premissas, a heurística #119 deveria ter evitado o erro no round-trip simples. Reproduzir o caso
   é o **primeiro entregável** da epic.
2. **#256 e #258 — inventário de produção.** Quantos estudos têm linha `Preço` sem
   `obrigatoria=true`, ou mais de uma? Quantos têm `unidades_permutadas > 0`? Não é verificável no
   ambiente Claude Code — é o objeto de **#221**.
3. **#266 — valoração de tipologia com preços diferentes por Grupo.** `avancado_alocacoes` guarda
   `preco_m2` por alocação. Preço médio ponderado, preço do Grupo de origem, ou preço informado na
   linha de permuta? **Não usar média implícita** — decisão explícita em ADR antes de código.

**Registradas para concordância**

4. **#265 reverte a #187** — a decisão de `width:auto` está registrada no `PROGRESSO.md:547`.
5. **#264 pode ser só release** — se a instância estiver atrás, a issue fecha sem diff de código,
   exceto pela decisão do estado 0%.
6. **As 12 emendas EVI continuam em documento** — a autorização desta sessão cobria editar apenas
   #238 e #239. As demais ficam como estão no GitHub, rastreadas pela epic **#254**.

---

## 9. Declaração

Nenhuma linha de runtime foi alterada. `frontend/`, `backend/`, `schema.json`, `migracoes/`,
`manifesto.json` e `scripts/` estão intactos. Não há migração nesta sessão e a `versao` do manifesto
**não** foi bumpada — a regra da plataforma é que `z` só sobe quando há migração nova.

Nenhuma das 24 issues foi implementada. Nenhuma issue foi fechada. As #220–#241 da Rodada 5
continuam **todas abertas, nenhuma implementada**; as 12 emendas pendentes continuam pendentes.

## Veja também

- `docs/viabilidade/funding-capital-stack.md` — especificação do Item 24
- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência EVI, com a §2.2 de cruzamento com esta lista
- `docs/issues-evi-propostas-2026-07-31.md` — corpos das issues EVI e as emendas pendentes
- `docs/revisao-recebiveis-calliandra-2026-07-31.md` — reconciliação de recebíveis por safras
