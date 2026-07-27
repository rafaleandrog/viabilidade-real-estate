---
titulo: Rodada 4 — mapa das issues da planilha lista_bugs.xlsx
descricao: Mapa mestre da Rodada 4 (issues #165–#169 e #172–#201), com classificação, diagnóstico e sequenciamento em 14 sessões.
tipo: app
ordem: 9
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Rodada 4 — mapa das issues (`lista_bugs.xlsx`, 2026-07-27)

⚠️ **DOCUMENTO OFICIAL — backlog ATIVO.** Este é o mapa mestre da Rodada 4. Toda sessão de Claude
Code que for implementar um destes itens **deve consultar este arquivo** para saber o escopo da sua
sessão, as dependências e as decisões já tomadas.

**Data:** 2026-07-27
**Origem:** planilha `lista_bugs.xlsx` enviada pelo autor (28 itens na aba `bugs` + 3 pedidos que só
existem nas abas de referência)
**Issues:** **#165–#169** (abertas na rodada anterior, não implementadas) + **#172–#201** (30 novas)
**Branch de cada sessão:** `claude/r4-sX-<slug>` a partir da `main` atualizada

---

## Como disparar cada sessão

```
Siga para a Sessão R4-SX
```

A sessão carrega as issues da sua linha na tabela do §5, implementa, valida e **abre o PR contra a
`main`**. **O merge é sempre decisão do autor** — nenhuma sessão mergeia sozinha.

---

## 1. O achado que originou esta rodada

O autor pediu, junto com o planejamento, a verificação de que "os itens até o #7 da planilha já
foram implementados". A verificação contra o HEAD `7c9d59f` (idêntico à `main`) **contrariou a
premissa**: das seis issues abertas a partir desta planilha, **só a #170 foi implementada**.

| Item | Issue | Estado real | Evidência |
|---|---|---|---|
| 1 — Pré-lançamento no mês seguinte ao fim do Planejamento | **#165** | ❌ não implementado | `tela-fluxo-cronograma.ts:283-288` ainda faz `inicio_mes + 1`, ignora `duracao_meses` e só dispara com `'inicio_mes' in dados`. `avancado.ts:50-69` não deriva `pre_lancamento`. `cronogramaPadrao()` (`:36`) nasce com `travado_inicio: false` enquanto a tela trava o campo (`:167-168`) — UI e backend discordam de quem é dono do campo. O default `6` acerta por coincidência (`0+6`). |
| 2 — Duração do Lançamento editável | **#166** | ⚠️ meia-implementação **quebrada** | Frontend liberou (`:169-170`), backend força `duracao_meses = 1` (`avancado.ts:56-61`) e o PATCH devolve **422** (`:377-378`). O usuário digita, toma erro e o valor volta. Os testes ainda **afirmam a trava** (`avancado.test.ts:26-27,41`). |
| 3 — Fases como âncora de Custos | **#167** | ❌ não implementado | `EVENTOS_ANCORA` estático em `tela-fluxo-custos.ts:134-140`, `avancado.ts:168` e `schema.json:317`. `ancorarLinhaCusto()` (`:76-84`) só olha `avancado_cronograma`. |
| 4 — Separar fases Cronograma × Receitas | **#168** | ❌ não implementado | As duas telas fazem CRUD na **mesma** `avancado_fases` pelas **mesmas** funções (`tela-fluxo-cronograma.ts:12`, `tela-fluxo-receitas.ts:14`). Sem discriminador em `schema.json:263-275`. |
| 6 — Cor do botão "Absorção de Vendas" | **#169** | ❌ não implementado | `tela-fluxo-receitas.ts:252` = `primario` vs `:255` = `secundario`. Aspas retas — diferença real, não atributo inerte. |
| 7 — Saldo de tipologias nas Fases da Receita | **#170** | ✅ **implementado** | `fluxo-shared.ts:328-348` (`totalAntesAlocacao`), `tela-fluxo-receitas.ts:329-330`, `_saldoAntes` removido, fixture da aba `#7` em `fluxo-shared.test.ts:219-280`. |

O que gerou a impressão: a sessão anterior (PR #171) **abriu as seis issues** e implementou **uma**.

> **Corolário, que já era a lição do PR #142:** *"fechou a issue" não é evidência de entrega — o diff
> é.* E agora, um segundo corolário: *"abriu a issue" também não.*

---

## 2. O que a planilha contém

### 2.1 Aba `bugs`

28 linhas úteis — `Item` 1–4 e 6–29. **O item 5 não existe**: a numeração da planilha pula de 4 para
6. Todos os itens são de nível **Avançado**.

### 2.2 Abas de referência

Seis abas com **uma imagem cada** (screenshots de um produto externo — as abas de topo daquele
produto são `Resumo · Produto · Financeiro · Análise de mercado · Unidades · Obra · Fluxo de Caixa ·
Simulação · Cenários · Data Room`, que não são as nossas) mais uma instrução em texto.

**São referência visual, não especificação de UI para copiar.** O contrato de UI do UrbiVerso
prevalece: só primitivos do `ui.md`, só as props que eles declaram, tokens CSS do design system.

| Aba | Instrução | Vira |
|---|---|---|
| `View Cenários` | "A view dos cenários deve ser igual a isso aqui. Foque nas linhas do gráfico…" | item 16 → **#185** |
| `#7` | "Verifique a lógica da aba #7…" | item 7 → #170 ✅ |
| `View cronograma` | Stepper com o mês inline nos campos de Início/Duração | **EXTRA** → **#197** |
| `View Custos Terreno` | Terreno com `Preço` + subcategorias e distribuições `Unit Delivery`/`Sales Revenue` | item 26 → **#193**–**#196** |
| `Referência para Tabelas` | "Linha de totais ao final deve ter uma separação do restante das linhas" | **EXTRA** → **#198** |
| `Análise de Mercado` | "Verifique como incorporar essa mesma view… e a lógica do uso de IA" | **EXTRA** → **#199**–**#201** |
| `View Custo -> Obras` | Gráficos de avanço + tabela mensal | item 22 → **#192** |

> ⚠️ **Três pedidos não tinham linha na tabela principal** (`View cronograma`,
> `Referência para Tabelas`, `Análise de Mercado`). Sem issue própria eles se perderiam — foi assim
> que a #91 sumiu na rodada 3. Viraram #197, #198 e #199–#201.

---

## 3. Mapa item → issue

| Planilha | Issue | Título curto | Tipo | Camada | Dif. | Bumpa versão | Sessão |
|---|---|---|---|---|---|---|---|
| 1 | **#165** | Pré-lançamento = fim do Planejamento | bug | B+F | M | não | R4-S2 |
| 2 | **#166** | Duração do Lançamento editável | bug | B+F | M | não | R4-S2 |
| 3 | **#167** | Fases do Cronograma como âncora de Custos | feature | S+B+F | D | **sim** | R4-S6 |
| 4 | **#168** | Separar fases Cronograma × Receitas | bug | S+B+F | C | **sim** | R4-S5 |
| 6 | **#169** | Cor do botão "Absorção de Vendas" | melhoria | F | F | não | R4-S1 |
| 7 | #170 | ✅ Saldo de tipologias — **concluído** | — | — | — | — | — |
| 8 | **#172** | Botão de remover só com lixeira | melhoria | F | F | não | R4-S1 |
| 9 | **#173** | Remover coluna Subcategoria (exceto Terreno) | melhoria | F+M | M | não | R4-S4 |
| 10 | **#180** | Terreno: obrigatórias; Outorga → Obras | melhoria | F+S | M | **sim** | R4-S11 |
| 11 | **#178** | Obras: obrigatórias + fim da duplicação | bug | F+B+S | D | **sim** | R4-S3 |
| 12 | **#179** | Diretos: Corretagem obrigatória + duplicação | bug | F+B+S | M | **sim** | R4-S3 |
| 13 | **#174** | Largura dos campos de Duração | melhoria | F | F | não | R4-S1 |
| 14 | **#182** | Resumo: KPIs zerados | bug | F+M | D | não | R4-S8 |
| 15 | **#176** | urbi-kpis sobrepostos | bug | F | F | não | R4-S1 |
| 16 | **#185** | Cenários: migrar para urbi-grafico-linha | melhoria | F | M | não | R4-S9 |
| 17 | **#186** | Cenários: trazer controles do Fluxo de Caixa | melhoria | F | M | não | R4-S9 |
| 18 | **#187** | Cenários: colunas + variação % em coluna própria | melhoria | F | M | não | R4-S9 |
| 19 | **#184** | Resumo: composição de custos vazia + filtro | bug+feature | F+M | D | não | R4-S8 |
| 20 | **#183** | Resumo: medidores zerados + renome do rótulo | bug | F+M | D | não | R4-S8 |
| 21 | **#175** | Coluna Resultado sempre preenchida | bug | F | F | não | R4-S1 |
| 22 | **#192** | Obras: gráficos de avanço (só Projetado) | feature | F+M | D | não | R4-S12 |
| 23 | **#190** | Nº de parcelas — "Ao longo da obra" Mensal | melhoria | F+M | D | não | R4-S10 |
| 24 | **#191** | Nº de parcelas — Trimestral/Semestral/Anual | feature | F+M | C | não | R4-S10 |
| 25 | **#177** | % sempre com 2 casas decimais | melhoria | F | M | não | R4-S4 |
| 26a | **#193** | Terreno: `Compra` → `Preço` + subcategorias | feature | S+F | M | **sim** | R4-S11 |
| 26b | **#194** | Modos `Unit Delivery` e `Sales Revenue` | feature | S+B+M+F | D | **sim** | R4-S11 |
| 26c | **#195** | Permuta física reduz VGV/unidades/Resultado | feature | M+F | C | não | R4-S11 |
| 26d | **#196** | Permuta financeira como dedução da receita | feature | M+F | D | não | R4-S11 |
| 27 | **#181** | Financeiro alinhado às outras abas | melhoria | F | M | não | R4-S4 |
| 28 | **#189** | Fluxo de Caixa: coluna % sobre VGV | melhoria | F+M | M | não | R4-S7 |
| 29 | **#188** | VGV Total / VGV Permuta Física / Receita Bruta | feature | F+M | D | não | R4-S7 |
| E1 | **#197** | Cronograma: stepper com mês inline | melhoria | F | M | não | R4-S2 |
| E2 | **#198** | Linha de totais destacada nas tabelas | melhoria | F | M | não | R4-S13 |
| E3a | **#199** | Análise de Mercado: schema e tela | feature | S+B+F | C | **sim** | R4-S14 |
| E3b | **#200** | Análise de Mercado: rota de IA | feature | B | C | não | R4-S14 |
| E3c | **#201** | Análise de Mercado: sinais de risco e insights | feature | F | M | não | R4-S14 |

**Legenda de camada:** `F` frontend · `B` backend · `M` motor de cálculo · `S` schema + migração.
**Legenda de dificuldade:** `F` fácil (CSS/texto) · `M` médio (1 arquivo) · `D` difícil
(multi-arquivo) · `C` complexo (motor + backend + schema).

---

## 4. Decisões do autor (2026-07-27) — não relitigar

| Item | Decisão | Consequência aceita |
|---|---|---|
| **16** (#185) | **Migrar para `urbi-grafico-linha`** com 2 séries, diferenciadas por cor | ⚠️ **Abre mão da linha tracejada** (que o texto do item pede) **e dos marcos rotulados** de Payback/Exposição/Obra da imagem — `SerieGrafico` declara só `{ rotulo, valores, cor }` (`ui/src/urbi-grafico-base.ts:5-15`) e nenhum gráfico do `ui/src` tem `dasharray` ou anotação. Mitigação: cores de alto contraste, `legenda="sempre"`, marcos como texto fora do gráfico. Alternativa conhecida: estender `SerieGrafico` no monorepo `urbiverso`. |
| **23/24** (#190, #191) | **O motor muda** — nº de parcelas fixo, ancorado no cronograma da obra | Mensal = duração da obra; demais = `floor(duração/intervalo)`. **Estudos existentes mudam de números.** Exige testes novos no `fluxo-caixa-motor.test.ts` e cuidado com a conservação de receita. |
| **22** (#192) | **Só a linha `Projetado`** | Sem schema, sem migração, sem bump. Realizado/Desvio/Forecast ficam **fora de escopo** e não têm issue. |
| **E3** (#199–#201) | **Entra na Rodada 4** como sessão própria | Feature greenfield → **bumpa `versao`**. Inclui decidir o destino da aba "Análise de mercado", hoje ocupada pelo Apelo Comercial. |

---

## 5. Sessões

| Sessão | Tema | Issues | Dif. | Pré-requisito |
|---|---|---|---|---|
| **R4-S1** | Correções rápidas de UI | #169 #172 #174 #175 #176 | F | — |
| **R4-S2** | Cronograma: regras + stepper | #165 #166 #197 | M | — |
| **R4-S3** | Custos: obrigatórias e duplicação | #178 #179 | D | — |
| **R4-S4** | Custos: Subcategoria, %, Financeiro | #173 #177 #181 | M | S3 |
| **R4-S5** | Fases: separar Cronograma × Receita | #168 | C | S2 |
| **R4-S6** | Fases como âncora de Custos | #167 | D | S5 |
| **R4-S7** | VGV, permuta e Fluxo de Caixa | #188 #189 | D | — |
| **R4-S8** | Resumo: KPIs, medidores, composição de custos | #182 #183 #184 | D | S7 |
| **R4-S9** | Cenários: gráfico, controles, variação % | #185 #186 #187 | D | — |
| **R4-S10** | Receitas: parcelas ao longo da obra | #190 #191 | C | S2 |
| **R4-S11** | Terreno: Preço + permutas | #180 #193 #194 #195 #196 | C | S3, S7 |
| **R4-S12** | Obras: gráficos de avanço | #192 | D | S3 |
| **R4-S13** | Transversal: linha de totais | #198 | M | S3 |
| **R4-S14** | Análise de Mercado com IA | #199 #200 #201 | C | — |

**Caminho crítico:** S7 destrava S8 e S11 · S2 destrava S5 · S5 destrava S6.
**Independentes, podem correr em paralelo:** S1, S3, S9, S10, S12, S13, S14 — uma branch por sessão,
**nunca duas sessões na mesma branch**.

**Bumpam `versao`** (migração nova): **S3, S5, S6, S11, S14**. Numerar as migrações na ordem em que
os PRs forem mergeados, não na ordem das sessões — e **nunca adicionar migração sem bumpar** (foi o
erro da `004_fases_gantt.js`, registrado no `PROGRESSO.md`).

---

## 6. Diagnósticos que atravessam várias issues

Três causas raiz explicam boa parte da rodada. Quem for implementar precisa conhecê-las antes.

### 6.1 O Resumo morreu junto com a aba Premissas (#182, #183, #184)

`frontend/tela-resumo.ts:105` chama `calcularProforma({ ...this.estudo })`, que consome
**exclusivamente colunas estáticas da tabela `estudos`** — as Premissas. O commit `301396a` (#88)
**removeu a aba Premissas do Avançado** e deixou este consumidor para trás; o próprio
`frontend/tela-avancado.ts:63-70` documenta:

> *"Os campos seguem no schema — **proforma.ts ainda os lê para os KPIs do Resumo** — mas sem
> superfície de edição aqui."*

Num estudo criado direto como Avançado, `area_pvt_r_fechada`, `preco_venda_m2_*`,
`custo_construcao_m2` etc. são `NULL` → `vgv = 0` → resultado, margem, ROI, `custoObrasVgvPct` e as
12 fatias da pizza, tudo zero. Os KPIs de fluxo (VPL/TIR/Payback/Exposição) do mesmo card estão
certos porque vêm do motor — daí a inconsistência visível.

**Os dados certos já estão carregados no componente e não são usados:** `c.vgvTotal`
(`fluxo-caixa-motor.ts:429,518`), `resultadoDe(c)` (`fluxo-tabela.ts:107-109`) e `c.linhasCusto`
(`fluxo-caixa-motor.ts:467-499`), com rótulos em `GRUPO_CUSTO_LABEL` (`fluxo-tabela.ts:19-25`).

### 6.2 A duplicação de linhas de custo tem três causas somadas (#178, #179)

1. **Conflito migração × constante.** `migracoes/002_grupos_custo.js:18-27` move `Gestão da obra` e
   `Decoração` de `obra` → `diretos`, mas `LINHAS_OBRIGATORIAS.obra`
   (`tela-fluxo-custos.ts:147-156`) continua exigindo `Gestão da obra` **no grupo `obra`**. Em todo
   estudo migrado, a checagem de existência falha e uma **segunda** linha é criada.
2. **Sem idempotência nem unicidade.** `_garantirLinhasObrigatorias` (`:521-537`) roda para todos os
   grupos a cada carga com POST fire-and-forget; `schema.json:307-323` declara só
   `"indices": [["estudo_id"]]`, **sem `unicos`**; `validarCamposCusto` (`avancado.ts:940-954`) não
   guarda categoria.
3. **A duplicata nasce indeletável.** `eObrigatoria` (`:165-167`) casa por **categoria**, não por
   identidade → as duas cópias ficam travadas e as duas perdem o botão Remover (`:494`).

### 6.3 VGV tem duas definições no app (#182, #184, #188, #189, #195, #196)

- **Motor (Avançado):** `vgvTipologia = quantidade × area_privativa_m2 × preco_m2`
  (`fluxo-shared.ts:138-145`) — **não desconta permuta física**, por decisão documentada em
  `fluxo-caixa-motor.ts:10-12`. `avancado_tipologias.unidades_permutadas` **nunca chega ao motor**.
- **Proforma (Preliminar):** desconta (`proforma.ts:119-145`).

**Toda issue que toca VGV precisa dizer explicitamente qual definição está usando.** A #188 é quem
cria o conceito de `Receita Bruta (VGV) = VGV Total − VGV Permuta Física` no Avançado — por isso ela
vem antes de #189, #182 e #195.

---

## 7. Riscos e cuidados transversais

1. **Aspa curva em posição de atributo.** `variante=”x”` deixa o atributo **inerte** e passa por
   typecheck, testes e build **em verde**. Guard 1/5 do `scripts/validar-frontend.sh` +
   `.github/workflows/pr-guards.yml`. Rodar o script em **toda** sessão.
2. **Props que o primitivo não declara.** Atributo inexistente **não dá erro, só não faz nada**.
   Vale especialmente para os gráficos: `SerieGrafico` é só `{ rotulo, valores, cor }`. Ler
   `ui/src/urbi-<nome>.ts` no monorepo antes de usar prop nova.
3. **`viab-num` é nosso, `urbi-*` não é.** `frontend/viab-num.ts` é componente do app — estendê-lo
   (props `casas-minimas` da #177, `passo`/setas da #197) é legítimo e não viola o contrato de UI.
4. **Mudanças que alteram números de estudos existentes** (#190, #191, #195, #196, #179): registrar
   no `PROGRESSO.md` **e** no corpo do PR. Não é detalhe — é o estudo do usuário mudando de valor.
5. **Doc e código andam juntos.** Mudou comportamento descrito em
   `docs/viabilidade/padrao-incorporacao.md`, o doc muda **no mesmo PR**. E vale a regra do
   `CLAUDE.md`: se o doc divergir do código, **quem se corrige é o doc**.
6. **Validação neste ambiente.** `bash scripts/validar-frontend.sh` fecha 100% de mudança
   só-frontend. Backend, migração, `pnpm test` completo e `urbi-empacotar` **só no ambiente
   autenticado do autor** — o `@urbiverso/sdk` é privado e o `pnpm install` daqui sempre toma 401.
   Isso é esperado; não perder tempo caçando token.
7. **Sessões paralelas:** nunca duas na mesma branch; `main` é só para puxar; cada árvore de
   trabalho tem seu próprio `pnpm install`.

---

## Veja também

- `docs/sessoes-bugs-2026-07-25.md` — rodada 3 (#71–#132), **histórico**
- `docs/etapas-bugs-2026-07-22.md` — rodada 2 (#33–#56), **histórico**
- `docs/lotes-bugs-2026-07-20.md` — rodada 1 (#9–#24), **histórico**
- `docs/viabilidade/padrao-incorporacao.md` — contexto de negócio (consultivo, não normativo)
- `PROGRESSO.md` — memória entre sessões
