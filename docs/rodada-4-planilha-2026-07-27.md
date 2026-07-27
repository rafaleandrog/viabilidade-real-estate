---
titulo: Rodada 4 — roteiro por issue da planilha lista_bugs.xlsx
descricao: Mapa mestre da Rodada 4 (issues #165–#169 e #172–#201). Uma issue por sessão, com pré-requisitos, portões de merge e ordem sugerida.
tipo: app
ordem: 9
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Rodada 4 — roteiro por issue (`lista_bugs.xlsx`, 2026-07-27)

⚠️ **DOCUMENTO OFICIAL — backlog ATIVO.** Toda sessão de Claude Code que for resolver um destes
itens **deve consultar este arquivo antes de escrever código**: é aqui que estão os pré-requisitos,
a decisão de merge e a ordem.

**Origem:** planilha `lista_bugs.xlsx` enviada pelo autor (28 itens na aba `bugs` + 3 pedidos que só
existiam nas abas de referência)
**Issues:** **#165–#169** (abertas na rodada anterior, não implementadas) + **#172–#201** (30 novas)
**Modo de trabalho:** **uma issue por sessão** — não há lote, etapa nem agrupamento.

---

## 1. Como disparar uma sessão

```
Resolva a issue #NNN
```

Uma issue de cada vez. A sessão carrega a issue no GitHub, lê a linha dela no §4 deste documento,
executa o protocolo do §2 e termina com PR aberto — **mergeado ou não conforme o §3**.

---

## 2. Protocolo de sessão (obrigatório, em ordem)

### 2.1 Abertura — antes de escrever qualquer código

1. `git fetch origin main` e conferir que a árvore de trabalho está limpa
   (`git status`, `git diff --stat`).
2. Ler a issue no GitHub e **a linha dela na tabela do §4**.
3. **Checar os pré-requisitos.** Para cada issue listada em `Pré-req.`, confirmar que o código dela
   **já está na `main`** — não basta o PR existir, tem que estar mergeado:
   ```
   git log origin/main --oneline | grep -i "#<pré-req>"
   ```
   ou conferir o estado do PR no GitHub.
   **Se algum pré-requisito não estiver na `main`: parar e avisar o autor**, nomeando qual falta.
   Não implementar por cima de uma dependência ausente — o resultado passa nos testes e está errado.
4. Criar a branch a partir da `main` atualizada:
   ```
   git checkout -B claude/r4-<nnn>-<slug> origin/main
   ```
5. Se a linha do §4 apontar **`Arquivo quente`** e houver PR aberto e não mergeado tocando o mesmo
   arquivo, avisar o autor: ou ele mergeia aquele PR antes, ou esta sessão parte da branch dele.
   Trabalhar em paralelo no mesmo arquivo garante conflito.

### 2.2 Implementação

6. Implementar **só o escopo da issue**. Cada issue tem seus próprios `Cuidados` e `Aceite` — são o
   contrato.
7. Se a issue trouxer migração: numerar o arquivo como `max(existente) + 1` **na `main`
   atualizada** (não pré-reservar número — a ordem real de merge manda) e **bumpar o `z` da
   `versao`** no `manifesto.json` no mesmo commit.
8. Se o comportamento descrito em `docs/viabilidade/padrao-incorporacao.md` mudar, **corrigir o doc
   no mesmo PR**.

### 2.3 Validação

9. `bash scripts/validar-frontend.sh` — obrigatório em **toda** sessão, mesmo nas de backend
   (o guard de aspas curvas roda ali).
10. Mudou backend, schema ou migração: registrar no PR que typecheck de backend, `pnpm test`
    completo, execução da migração e `urbi-empacotar` **ficam para o ambiente autenticado do
    autor** — o `@urbiverso/sdk` é privado e o `pnpm install` daqui sempre toma 401. Isso é
    esperado; não gastar tempo caçando token.

### 2.4 Fechamento

11. Commit e `git push -u origin claude/r4-<nnn>-<slug>`.
12. Abrir o PR contra a `main`, com `Closes #NNN`.
13. **Decidir o merge pelo §3.**
14. Atualizar o `PROGRESSO.md` com o que foi feito e o que ficou pendente de validação.

---

## 3. A decisão de merge — regra automática

O critério é único e está na coluna **`Portão?`** do §4:

| Situação | O que a sessão faz |
|---|---|
| **`Portão?` = SIM** — outras issues precisam deste código funcionando na `main` para poderem ser implementadas | Depois da validação verde, **a sessão mergeia o PR na `main`** e diz ao autor quais issues foram destravadas. |
| **`Portão?` = não** — nenhuma outra issue depende deste código | A sessão **abre o PR e para**. O merge é decisão do autor, sem pressa. |

> 📌 **Autorização permanente, com escopo.** O autor autorizou (2026-07-27) que as sessões da
> Rodada 4 **mergeiem sozinhas** os PRs de issue marcada como **portão** — e **somente** essas.
> Isso é uma exceção deliberada à regra geral do `CLAUDE.md` ("merge é sempre decisão do autor"),
> e existe porque um portão não mergeado trava toda a fila atrás dele. Vale só para a Rodada 4,
> só para issue com `Portão? = SIM`, e **só com a validação verde**. Qualquer outro merge continua
> sendo do autor.

**Condições para a sessão mergear um portão** — todas obrigatórias:

- `bash scripts/validar-frontend.sh` **verde**;
- todos os pré-requisitos da issue **já na `main`**;
- o PR fecha **uma** issue e o diff é **não vazio** (o `pr-guards.yml` barra diff vazio que declara
  fechar issue — foi o caso do PR #142);
- se houver migração, o número está correto contra a `main` do momento do merge e a `versao` foi
  bumpada.

Falhou qualquer uma → **não mergeia**, avisa o autor e explica o quê.

### Os 16 portões e o que cada um destrava

Alcance **direto + indireto** (fecho transitivo). Quanto maior o alcance, mais caro deixar o portão
parado:

| Portão | Destrava | Quem |
|---|---|---|
| **#178** | **7** | #179, #180, #192, #193, #194, #195, #196 |
| **#188** | **5** | #182, #183, #184, #189, #195 |
| **#180** | 4 | #193, #194, #195, #196 |
| **#193** | 3 | #194, #195, #196 |
| **#182** | 2 | #183, #184 |
| **#199** | 2 | #200, #201 |
| #165 · #166 | 1 | #197 |
| #168 | 1 | #167 |
| #173 · #174 · #175 · #198 | 1 | #181 |
| #190 | 1 | #191 |
| #194 | 1 | #196 |
| #200 | 1 | #201 |

**#178 e #188 são os dois gargalos da rodada** — juntos destravam 12 das 35. Se a ideia for abrir
frente de trabalho rápido, são eles.

As outras 19 issues (`#167` `#169` `#172` `#176` `#177` `#179` `#181` `#183` `#184` `#185` `#186`
`#187` `#189` `#191` `#192` `#195` `#196` `#197` `#201`) **não são portão**: PR aberto e o autor
decide.

### Propriedades verificadas do grafo

Conferidas por script na revisão de 2026-07-27, e que devem continuar valendo se alguém editar a
tabela do §4:

- **sem ciclo** de dependências;
- **todo pré-requisito é portão** — se uma issue é pré-requisito de outra, ela é marcada `SIM`,
  senão a dependente ficaria esperando um merge que nunca vem por regra;
- **todo portão tem ao menos um dependente** — nenhum merge automático sem motivo;
- **a ordem sugerida do §5 não viola nenhuma dependência.**

---

## 4. Catálogo — uma linha por issue

**Pré-req.** = precisa estar **mergeado na `main`** antes de começar.
**Portão?** = se SIM, a sessão mergeia ao terminar (§3), e a coluna diz quem depende.
**Arquivo quente** = arquivo muito disputado; ver §2.1 item 5.
**Ver.** = bumpa o `z` da `versao` (só quem traz migração).

| # | Issue | O que é | Pré-req. | Portão? | Arquivo quente | Ver. | Dif. |
|---|---|---|---|---|---|---|---|
| 1 | **#165** | Cronograma: Pré-lançamento = fim do Planejamento | — | **SIM** → #197 | `avancado.ts`, `tela-fluxo-cronograma.ts` | não | M |
| 2 | **#166** | Cronograma: duração do Lançamento editável | — | **SIM** → #197 | `avancado.ts` (mesma função do #165) | não | M |
| 3 | **#167** | Fases do Cronograma como âncora de Custos | **#168** | não | `tela-fluxo-custos.ts` | **sim** | D |
| 4 | **#168** | Separar fases Cronograma × Receitas | — | **SIM** → #167 | `avancado.ts`, `tela-fluxo-cronograma.ts`, `tela-fluxo-receitas.ts` | **sim** | C |
| 6 | **#169** | Cor do botão "Absorção de Vendas" | — | não | `tela-fluxo-receitas.ts` | não | F |
| 8 | **#172** | Botão de remover só com lixeira | — | não | várias telas (fazer cedo) | não | F |
| 9 | **#173** | Remover coluna Subcategoria (exceto Terreno) | — | **SIM** → #181 | `tela-fluxo-custos.ts`, `fluxo-caixa-motor.ts` | não | M |
| 10 | **#180** | Terreno: obrigatórias; Outorga → Obras | **#178** | **SIM** → #193 | `tela-fluxo-custos.ts` | **sim** | M |
| 11 | **#178** | Obras: obrigatórias + fim da duplicação | — | **SIM** → #179, #180, #192 | `tela-fluxo-custos.ts`, `schema.json` | **sim** | D |
| 12 | **#179** | Diretos: Corretagem obrigatória + duplicação | **#178** | não | `tela-fluxo-custos.ts` | **sim** | M |
| 13 | **#174** | Largura dos campos de Duração/Início | — | **SIM** → #181 | `tela-fluxo-custos.ts` (CSS) | não | F |
| 14 | **#182** | Resumo: KPIs zerados | **#188** | **SIM** → #183, #184 | `tela-resumo.ts` | não | D |
| 15 | **#176** | urbi-kpis sobrepostos | — | não | `fluxo-tabela.ts`, `tela-resumo.ts` (CSS) | não | F |
| 16 | **#185** | Cenários: migrar para `urbi-grafico-linha` | — | não | `tela-cenarios.ts`, `fluxo-graficos.ts` | não | M |
| 17 | **#186** | Cenários: trazer controles do Fluxo de Caixa | — | não | `tela-cenarios.ts`, `tela-fluxo-ver.ts`, `fluxo-tabela.ts` | não | M |
| 18 | **#187** | Cenários: colunas + variação % em coluna própria | — | não | `tela-cenarios.ts` | não | M |
| 19 | **#184** | Resumo: composição de custos vazia + filtro | **#182** | não | `tela-resumo.ts` | não | D |
| 20 | **#183** | Resumo: medidores zerados + renome do rótulo | **#182** | não | `tela-resumo.ts`, `tela-graficos.ts`, `tela-proforma.ts` | não | D |
| 21 | **#175** | Coluna Resultado sempre preenchida | — | **SIM** → #181 | `tela-fluxo-custos.ts` | não | F |
| 22 | **#192** | Obras: gráficos de avanço (só Projetado) | **#178** | não | `tela-fluxo-custos.ts`, `fluxo-shared.ts` | não | D |
| 23 | **#190** | Nº de parcelas — "Ao longo da obra" Mensal | — | **SIM** → #191 | `fluxo-caixa-motor.ts`, `tela-fluxo-receitas.ts` | não | D |
| 24 | **#191** | Nº de parcelas — Trimestral/Semestral/Anual | **#190** | não | `fluxo-caixa-motor.ts` | não | C |
| 25 | **#177** | % sempre com 2 casas decimais | — | não | `viab-num.ts`, `tela-fluxo-custos.ts` | não | M |
| 26a | **#193** | Terreno: `Compra` → `Preço` + subcategorias | **#180** | **SIM** → #194, #195, #196 | `tela-fluxo-custos.ts` | **sim** | M |
| 26b | **#194** | Modos `Unit Delivery` e `Sales Revenue` | **#193** | **SIM** → #196 | `tela-fluxo-custos.ts`, `avancado.ts`, `fluxo-caixa-motor.ts` | **sim** | D |
| 26c | **#195** | Permuta física reduz VGV/unidades/Resultado | **#193**, **#188** | não | `fluxo-caixa-motor.ts`, `fluxo-shared.ts` | não | C |
| 26d | **#196** | Permuta financeira como dedução da receita | **#193**, **#194** | não | `fluxo-caixa-motor.ts` | não | D |
| 27 | **#181** | Financeiro alinhado às outras abas | **#173**, **#174**, **#175**, **#198** | não | `tela-fluxo-custos.ts` | não | M |
| 28 | **#189** | Fluxo de Caixa: coluna % sobre VGV | **#188** | não | `fluxo-tabela.ts`, `exportar.ts` | não | M |
| 29 | **#188** | VGV Total / VGV Permuta Física / Receita Bruta | — | **SIM** → #189, #182, #195 | `fluxo-tabela.ts`, `fluxo-caixa-motor.ts` | não | D |
| E1 | **#197** | Cronograma: stepper com mês inline | **#165**, **#166** | não | `viab-num.ts`, `tela-fluxo-cronograma.ts` | não | M |
| E2 | **#198** | Linha de totais destacada nas tabelas | — | **SIM** → #181 | `tela-fluxo-custos.ts` | não | M |
| E3a | **#199** | Análise de Mercado: schema e tela | — | **SIM** → #200, #201 | (arquivos novos) | **sim** | C |
| E3b | **#200** | Análise de Mercado: rota de IA | **#199** | **SIM** → #201 | (backend novo) | não | C |
| E3c | **#201** | Análise de Mercado: sinais de risco e insights | **#199**, **#200** | não | (frontend novo) | não | M |
| 7 | #170 | ✅ Saldo de tipologias — **concluído** | — | — | — | — | — |

**Dificuldade:** `F` fácil (CSS/texto) · `M` médio (1 arquivo) · `D` difícil (multi-arquivo) ·
`C` complexo (motor + backend + schema).

---

## 5. Ordem sugerida

A ordem abaixo respeita **todas** as dependências do §4 e agrupa por arquivo, para reduzir
conflito. **Não é obrigatória** — qualquer ordem serve, desde que os pré-requisitos de cada issue
já estejam na `main`. Ela existe para quem quiser só seguir a fila.

| # | Issue | Por que aqui |
|---|---|---|
| 1 | #169 | trivial, isolada |
| 2 | #172 | mexe em várias telas — melhor cedo, antes que as outras as alterem |
| 3 | #176 | CSS, isolada |
| 4 | ★ #165 | abre o Cronograma |
| 5 | ★ #166 | mesma função do #165 — logo depois, nunca em paralelo |
| 6 | #197 | precisa de #165 e #166 na `main` |
| 7 | #177 | mesmo `viab-num.ts` do #197 |
| 8 | ★ #174 | começa o bloco `tela-fluxo-custos.ts` pelo mais simples |
| 9 | ★ #175 | — |
| 10 | ★ #173 | — |
| 11 | ★ #178 | primeira migração; destrava #179, #180, #192 |
| 12 | #179 | precisa de #178 |
| 13 | ★ #198 | — |
| 14 | #181 | precisa de #173, #174, #175, #198 |
| 15 | #192 | precisa de #178 |
| 16 | ★ #188 | cria o VGV líquido; destrava #189, #182, #195 |
| 17 | #189 | precisa de #188 |
| 18 | ★ #182 | precisa de #188; destrava #183, #184 |
| 19 | #183 | precisa de #182 |
| 20 | #184 | precisa de #182 |
| 21 | ★ #180 | precisa de #178; destrava #193 |
| 22 | ★ #193 | precisa de #180; destrava #194, #195, #196 |
| 23 | ★ #194 | precisa de #193 |
| 24 | #195 | precisa de #193 e #188 |
| 25 | #196 | precisa de #193 e #194 |
| 26 | ★ #190 | destrava #191 |
| 27 | #191 | precisa de #190 |
| 28 | ★ #168 | estrutural; destrava #167 |
| 29 | #167 | precisa de #168 |
| 30 | #185 | bloco `tela-cenarios.ts` |
| 31 | #186 | — |
| 32 | #187 | — |
| 33 | ★ #199 | destrava #200, #201 |
| 34 | ★ #200 | precisa de #199 |
| 35 | #201 | precisa de #199 e #200 |

★ = portão de merge (§3).

> **Correção em relação ao planejamento inicial:** a versão por sessões dizia que as issues de
> parcelas (#190, #191) dependiam das de Cronograma. **Não dependem.** Elas usam a duração do evento
> `obra`, que `recalcularTravados` (`backend/rotas/avancado.ts:50-69`) não altera — ele deriva
> `lancamento` de `pre_lancamento` e `pos_obra` de `obra`. Podem ser feitas a qualquer momento.

---

## 6. O achado que originou esta rodada

O autor pediu, junto com o planejamento, a verificação de que "os itens até o #7 da planilha já
foram implementados". A verificação contra o HEAD `7c9d59f` **contrariou a premissa**: das seis
issues abertas a partir desta planilha, **só a #170 foi implementada**.

| Item | Issue | Estado real | Evidência |
|---|---|---|---|
| 1 | **#165** | ❌ não implementado | `tela-fluxo-cronograma.ts:283-288` ainda faz `inicio_mes + 1`, ignora `duracao_meses` e só dispara com `'inicio_mes' in dados`. `avancado.ts:50-69` não deriva `pre_lancamento`. `cronogramaPadrao()` (`:36`) nasce com `travado_inicio: false` enquanto a tela trava o campo (`:167-168`). O default `6` acerta por coincidência (`0+6`). |
| 2 | **#166** | ⚠️ meia-implementação **quebrada** | Frontend liberou (`:169-170`), backend força `duracao_meses = 1` (`avancado.ts:56-61`) e o PATCH devolve **422** (`:377-378`). O usuário digita, toma erro e o valor volta. Os testes ainda **afirmam a trava** (`avancado.test.ts:26-27,41`). |
| 3 | **#167** | ❌ não implementado | `EVENTOS_ANCORA` estático em `tela-fluxo-custos.ts:134-140`, `avancado.ts:168` e `schema.json:317`. `ancorarLinhaCusto()` (`:76-84`) só olha `avancado_cronograma`. |
| 4 | **#168** | ❌ não implementado | As duas telas fazem CRUD na **mesma** `avancado_fases` pelas **mesmas** funções (`tela-fluxo-cronograma.ts:12`, `tela-fluxo-receitas.ts:14`). Sem discriminador em `schema.json:263-275`. |
| 6 | **#169** | ❌ não implementado | `tela-fluxo-receitas.ts:252` = `primario` vs `:255` = `secundario`. Aspas retas — diferença real, não atributo inerte. |
| 7 | **#170** | ✅ implementado | `fluxo-shared.ts:328-348` (`totalAntesAlocacao`), `tela-fluxo-receitas.ts:329-330`, `_saldoAntes` removido, fixture da aba `#7` em `fluxo-shared.test.ts:219-280`. |

O que gerou a impressão: a sessão anterior (PR #171) **abriu as seis issues** e implementou **uma**.

> **Corolário, que já era a lição do PR #142:** *"fechou a issue" não é evidência de entrega — o diff
> é.* E agora, um segundo corolário: *"abriu a issue" também não.*

---

## 7. O que a planilha contém

**Aba `bugs`:** 28 linhas úteis — `Item` 1–4 e 6–29. **O item 5 não existe**: a numeração pula de 4
para 6. Todos os itens são de nível **Avançado**.

**Abas de referência:** seis abas com **uma imagem cada** (screenshots de um produto externo — as
abas de topo daquele produto são `Resumo · Produto · Financeiro · Análise de mercado · Unidades ·
Obra · Fluxo de Caixa · Simulação · Cenários · Data Room`, que não são as nossas) mais uma instrução
em texto. **São referência visual, não especificação de UI para copiar** — o contrato de UI do
UrbiVerso prevalece.

| Aba | Instrução | Vira |
|---|---|---|
| `View Cenários` | "A view dos cenários deve ser igual a isso aqui. Foque nas linhas do gráfico…" | **#185** |
| `#7` | "Verifique a lógica da aba #7…" | #170 ✅ |
| `View cronograma` | Stepper com o mês inline nos campos de Início/Duração | **#197** |
| `View Custos Terreno` | Terreno com `Preço` + subcategorias e distribuições `Unit Delivery`/`Sales Revenue` | **#193**–**#196** |
| `Referência para Tabelas` | "Linha de totais ao final deve ter uma separação do restante das linhas" | **#198** |
| `Análise de Mercado` | "Verifique como incorporar essa mesma view… e a lógica do uso de IA" | **#199**–**#201** |
| `View Custo -> Obras` | Gráficos de avanço + tabela mensal | **#192** |

> ⚠️ **Três pedidos não tinham linha na tabela principal** (`View cronograma`,
> `Referência para Tabelas`, `Análise de Mercado`). Sem issue própria eles se perderiam — foi assim
> que a #91 sumiu na rodada 3. Viraram #197, #198 e #199–#201.

---

## 8. Decisões do autor (2026-07-27) — não relitigar

| Issue | Decisão | Consequência aceita |
|---|---|---|
| **#185** | **Migrar para `urbi-grafico-linha`** com 2 séries, diferenciadas por cor | ⚠️ **Abre mão da linha tracejada** (que o texto do item pede) **e dos marcos rotulados** de Payback/Exposição/Obra da imagem — `SerieGrafico` declara só `{ rotulo, valores, cor }` (`ui/src/urbi-grafico-base.ts:5-15`) e nenhum gráfico do `ui/src` tem `dasharray` ou anotação. Mitigação: cores de alto contraste, `legenda="sempre"`, marcos como texto fora do gráfico. Alternativa conhecida: estender `SerieGrafico` no monorepo `urbiverso`. |
| **#190**, **#191** | **O motor muda** — nº de parcelas fixo, ancorado no cronograma da obra | Mensal = duração da obra; demais = `floor(duração/intervalo)`. **Estudos existentes mudam de números.** Exige testes novos no `fluxo-caixa-motor.test.ts` e cuidado com a conservação de receita. |
| **#192** | **Só a linha `Projetado`** | Sem schema, sem migração, sem bump. Realizado/Desvio/Forecast ficam **fora de escopo** e não têm issue. |
| **#199**–**#201** | Análise de Mercado com IA **entra na rodada** | Feature greenfield → **bumpa `versao`**. Inclui decidir o destino da aba "Análise de mercado", hoje ocupada pelo Apelo Comercial. |

---

## 9. Causas raiz compartilhadas

Três causas explicam boa parte da rodada. Quem for implementar precisa conhecê-las antes.

### 9.1 O Resumo morreu junto com a aba Premissas (#182, #183, #184)

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

### 9.2 A duplicação de linhas de custo tem três causas somadas (#178, #179)

1. **Conflito migração × constante.** `migracoes/002_grupos_custo.js:18-27` move `Gestão da obra` e
   `Decoração` de `obra` → `diretos`, mas `LINHAS_OBRIGATORIAS.obra`
   (`tela-fluxo-custos.ts:147-156`) continua exigindo `Gestão da obra` **no grupo `obra`**. Em todo
   estudo migrado a checagem de existência falha e uma **segunda** linha é criada.
2. **Sem idempotência nem unicidade.** `_garantirLinhasObrigatorias` (`:521-537`) roda para todos os
   grupos a cada carga com POST fire-and-forget; `schema.json:307-323` declara só
   `"indices": [["estudo_id"]]`, **sem `unicos`**; `validarCamposCusto` (`avancado.ts:940-954`) não
   guarda categoria.
3. **A duplicata nasce indeletável.** `eObrigatoria` (`:165-167`) casa por **categoria**, não por
   identidade → as duas cópias ficam travadas e as duas perdem o botão Remover (`:494`).

### 9.3 VGV tem duas definições no app (#182, #184, #188, #189, #195, #196)

- **Motor (Avançado):** `vgvTipologia = quantidade × area_privativa_m2 × preco_m2`
  (`fluxo-shared.ts:138-145`) — **não desconta permuta física**, por decisão documentada em
  `fluxo-caixa-motor.ts:10-12`. `avancado_tipologias.unidades_permutadas` **nunca chega ao motor**.
- **Proforma (Preliminar):** desconta (`proforma.ts:119-145`).

**Toda issue que toca VGV precisa dizer explicitamente qual definição está usando.** A #188 é quem
cria o conceito de `Receita Bruta (VGV) = VGV Total − VGV Permuta Física` no Avançado — por isso ela
é pré-requisito de #189, #182 e #195.

---

## 10. Riscos e cuidados transversais

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
5. **Migração:** numerar contra a `main` atualizada, no momento do PR, e bumpar a `versao` no mesmo
   commit. Migração **só transforma dado existente** — seed fica fora. Nunca adicionar migração sem
   bumpar (foi o erro da `004_fases_gantt.js`).
6. **Doc e código andam juntos.** Mudou comportamento descrito em
   `docs/viabilidade/padrao-incorporacao.md`, o doc muda **no mesmo PR**. E se o doc divergir do
   código, **quem se corrige é o doc**.
7. **Sessões paralelas:** nunca duas na mesma branch; `main` é só para puxar; cada árvore de
   trabalho tem seu próprio `pnpm install`.

---

## Veja também

- `docs/sessoes-bugs-2026-07-25.md` — rodada 3 (#71–#132), **histórico**
- `docs/etapas-bugs-2026-07-22.md` — rodada 2 (#33–#56), **histórico**
- `docs/lotes-bugs-2026-07-20.md` — rodada 1 (#9–#24), **histórico**
- `docs/viabilidade/padrao-incorporacao.md` — contexto de negócio (consultivo, não normativo)
- `PROGRESSO.md` — memória entre sessões
