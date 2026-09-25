# Rodada 8 — B2 · Os 3 bugs confirmados — **ESPECIFICAÇÃO DE CONSERTO, NÃO CONSERTO**

> 🔴 **DECISÃO DO AUTOR, 2026-08-22, POSTERIOR A ESTE DOCUMENTO — LEIA ANTES DE TUDO.**
>
> **O código foi REVERTIDO. Nada aqui está aplicado.** O autor autorizou o conserto, e depois
> reverteu a autorização: *"O B2 não deve consertar bugs, só escrever issues."* Os 8 arquivos
> que este documento diz ter alterado foram devolvidos ao estado da `main` com `git checkout --`,
> e a árvore de trabalho **não tem mudança de código nenhuma**.
>
> **O que este documento vale agora:** ele deixou de ser relatório de conserto e virou o **corpo
> pronto de três issues** — cada uma com diagnóstico em `arquivo:linha`, consequência medida em
> R$, a correção projetada e os testes que a provariam. É material de issue de qualidade
> incomum: a solução já foi escrita, revisada por outro agente e **executada em verde**
> (typecheck exit 0, 414 testes de frontend e 104 de backend passando) antes de ser revertida.
>
> **Três correções ao texto abaixo, para quem for abrir as issues:**
>
> 1. O conserto do BUG 2 descrito no corpo original casava os componentes **por índice**, e o
>    agente A2 achou o buraco: adicionar ou remover uma linha desloca os índices e **a taxa
>    morre nos dois componentes preexistentes** — o mesmo dano que o conserto existia para
>    impedir, a um clique de distância. A versão final (também revertida) parea por
>    **identidade em dois passes**: casamento exato de estrutura primeiro, depois mesmo tipo na
>    ordem de aparição. **A issue tem de exigir o pareamento por identidade**, com os três
>    testes de adicionar / remover / reordenar linha.
> 2. Tirar o funding da proforma faz **"Custos Financeiros" significar coisas diferentes** na
>    proforma (visão econômica) e na tabela do fluxo (visão de caixa). A issue precisa carregar
>    a desambiguação do rótulo, senão alguém reabre o bug ao contrário — *"sumiu o custo
>    financeiro"*.
> 3. O agente A3 mediu que abrir o modal **encolhe o retorno do investidor** em ≈ R$ 50.371 no
>    estudo 5 — consequência **de funding** de um bug catalogado como **de receitas**. O teste de
>    regressão precisa assertar o funding, não só a receita.
>
> ⚠️ **O que este conserto NÃO cobria, e continua sendo issue própria:** o descarte silencioso de
> vendas em `absorcaoMensal` (`frontend/fluxo-shared.ts:374-377`), que soma só quando
> `idx < tamanho`, **sem `else` e sem aviso**, e joga fora R$ 2.007.856,95 do estudo 6.

    Branch   claude/rodada-8-auditoria   (código REVERTIDO — a árvore está idêntica à main)
    Data     2026-08-22
    Escopo   D14 (proforma × funding) · D10 (modal de pagamento destrói o plano) · D3 (PATCH de tipologias sem guarda)
    Fontes   docs/rodada-8/05-conferencia-numerica.md · docs/rodada-8/06-auditoria-ui.md

**`manifesto.json` NÃO foi tocado.** Nenhum dos três consertos tem migração; a `versao` descreve o
schema e nada de schema mudou.

Arquivos alterados (8):

| Arquivo | Bug |
|---|---|
| `frontend/proforma-avancado.ts` | 1 |
| `frontend/tela-fluxo-ver.ts` | 1 |
| `frontend/tela-dashboard.ts` | 1 |
| `scripts/conferir-estudo.ts` | 1 (call site do script do A5) |
| `frontend/fluxo-apresentacao.test.ts` | 1 |
| `frontend/fluxo-pagamento-editor.ts` | 2 |
| `frontend/fluxo-pagamento-editor.test.ts` | 2 |
| `backend/rotas/avancado.ts` + `backend/rotas/avancado.test.ts` | 3 |

---

## BUG 1 — a proforma do Avançado contava o principal do funding como custo (D14)

### A decisão: alternativa **(a)** — a proforma não inclui funding nenhum, dos dois lados

`proformaAvancado` **deixou de receber o parâmetro `funding`**. Não foi ignorado: foi **removido da
assinatura**, para que reintroduzi-lo exija uma mudança deliberada em quatro call sites em vez de
uma linha esquecida.

Justificativa, escrita no topo de `frontend/proforma-avancado.ts:21-64`:

1. **Financiamento é atividade de financiamento, não custo econômico.** Amortização é devolução de
   principal — o dinheiro que volta ao credor é o mesmo que entrou. O custo do capital já é
   remunerado no VPL/TIR, que descontam a TMA; somá-lo de novo na proforma é contá-lo duas vezes.
2. **Coerência com o resto do app.** TIR, VPL, Payback e Exposição já são desalavancados por decisão
   explícita (§8.1 de `docs/viabilidade/funding-capital-stack.md`, preservada na reescrita da #355).
   Uma proforma alavancada no meio de indicadores desalavancados produz uma margem que nenhum outro
   número da tela reconcilia — que é exatamente o defeito que `proformaAvancado` existe para evitar
   (é a razão declarada de ela não reusar `calcularProforma` do Preliminar).
3. **O painel de estudos compara Preliminar com Avançado nas MESMAS colunas** (VGV · Resultado ·
   Margem · ROI), e o Preliminar não modela funding. Alavancar só um dos lados compara coisas
   diferentes na mesma coluna.
4. **Por que (b) — creditar as duas pontas — foi descartada.** Ela não é neutra: deixa no Resultado
   o resíduo `Σ entradas − Σ saídas`, que só coincide com o custo financeiro quando a operação
   amortiza inteira dentro do horizonte. Medido na fixture `CONFIG_COMPLETA`, as duas pontas
   **não** se cancelam (o teste novo afirma isso explicitamente). Qualquer saldo devedor
   remanescente vazaria para o Resultado como se fosse lucro. Além disso, creditar `linhasEntrada`
   contradiz o que o próprio arquivo já dizia — "aporte de funding NÃO é receita".

### Isto contradiz `fluxo-tabela.ts`? Não — e o motivo está declarado no código

`frontend/fluxo-tabela.ts:560-580` continua mostrando as **duas pontas**: entradas como bloco de
receita ("Funding — Capital (entradas)") e saídas dentro de "Custos Financeiros", com o rodapé
virando o fluxo **alavancado** (`FundingNoFluxo.fluxoMensal`). É legítimo porque **as duas
superfícies têm propósitos diferentes**:

| Superfície | Visão | Funding |
|---|---|---|
| `fluxo-tabela.ts` (aba Fluxo de Caixa) | **caixa** | as duas pontas, e por isso o principal se cancela |
| `proforma-avancado.ts` (aba Resultados) | **econômica**, antes de decidir como o projeto é capitalizado | nenhuma ponta |

A diferença está escrita nos dois arquivos, com a frase "quem quiser ler o efeito do funding lê a
aba Fluxo de Caixa, não esta".

### Diff conceitual

`frontend/proforma-avancado.ts`

    - const totalDoGrupo = (g) => linhasDoGrupo(g).reduce(...)
    -   + (g === 'financeiro' ? (funding?.linhasSaida ?? []).reduce((s, l) => s + l.total, 0) : 0);
    + const totalDoGrupo = (g) => linhasDoGrupo(g).reduce((s, x) => s + x.total, 0);

    - const temLinha = linhasDoGrupo(g).length > 0 || (g === 'financeiro' && (funding?.linhasSaida.length ?? 0) > 0);
    - if (!temLinha) continue;
    + if (linhasDoGrupo(g).length === 0) continue;

- `frontend/proforma-avancado.ts:1-3` — o `import type { FundingNoFluxo }` saiu.
- `frontend/proforma-avancado.ts:100-110` — assinatura passa a `(c, areaPrivativa)`.
- `frontend/proforma-avancado.ts:128-137` — `totalDoGrupo` e o filtro de grupo.
- `frontend/tela-fluxo-ver.ts:226-233` — `proformaAvancado(c, area)`; `this.funding` continua
  servindo à tabela do fluxo, que não mudou.
- `frontend/tela-dashboard.ts:5-16` — três imports removidos (`mesRepasse`,
  `receitaLiquidaComCorretagemMensal`/`fundingDoEstudo`/`FundingNoFluxo`, `listarFundingOperacoes`).
- `frontend/tela-dashboard.ts:219-256` — o bloco que montava `funding` sumiu junto com a chamada
  `listarFundingOperacoes(estudo.id)`: era o único consumidor. **Efeito colateral positivo: um
  request a menos por estudo Avançado da página.**
- `scripts/conferir-estudo.ts:240-243` — call site do script reexecutável do A5.

### O que muda em número, nos dois estudos de Pinguim

| Indicador | Estudo 5 antes | Estudo 5 agora | Estudo 6 antes | Estudo 6 agora |
|---|---:|---:|---:|---:|
| Resultado | −R$ 62.364.749,03 | **R$ 24.668.189,10** | −R$ 62.950.054,14 | **R$ 28.358.402,21** |
| Margem | −47,87% | **18,94%** | −44,84% | **20,20%** |
| ROI | −33,27% | **24,57%** | −31,86% | **26,69%** |
| Investimento total | R$ 187.423.251,83 | **R$ 100.390.313,70** | R$ 197.559.191,50 | **R$ 106.250.735,15** |

Os valores da coluna "agora" são os que o A5 já mediu rodando `proformaAvancado(calc, area, null)`
(§ D14 de `05-conferencia-numerica.md`) — com a mudança, esse passa a ser o único caminho possível.

### Teste

`frontend/fluxo-apresentacao.test.ts` — o teste `#351 proforma: custo do funding entra em Custos
Financeiros; aporte NÃO vira receita` **travava o defeito**: ele afirmava que o Resultado tinha de
cair exatamente `Σ linhasSaida`. Foi substituído por:

> `proforma do Avançado é DESALAVANCADA: existir funding não move nenhum número (D14)`

Ele monta a mesma operação de dívida, prova que **as duas pontas não se cancelam sozinhas**
(`|Σ entradas − Σ saídas| > 0,01` — é isto que reprova também a alternativa (b)) e então trava três
invariantes: `p.resultado === Σ c.fluxoMensal` (reconcilia com o fluxo livre), a linha
"(-) Custos Financeiros" vale **exatamente** o custo financeiro próprio do estudo (R$ 100.000 da
fixture, não o serviço da dívida) e `p.investimentoTotal === Σ c.custoMensal`.

---

## BUG 2 — reabrir o modal de Condições de pagamento reescrevia o plano (D10)

### O critério de aceite

> Abrir o modal e aplicar sem alterar nada é **NO-OP**. O `fluxo_pagamento` resultante é igual ao de
> entrada, `taxaMensal` e `sinalPct` inclusive.

**Atendido sem campo novo na UI.** Nenhum controle de taxa de juros foi adicionado — isso continua
sendo feature, não conserto.

### As duas metades, e o que cada uma virou

**Metade 1 — `formularioPagamento` fabricava dado que não existe.**
`frontend/fluxo-pagamento-editor.ts:60-63`: os placeholders de 15% (`entrada` e `parcelas`) agora só
nascem quando a linha **não tem `componentes` canônicos**. O espelho legado de uma Entrada de 0% **é
vazio** — era por isso que abrir o modal de uma linha `0/30/70` já a mostrava como `15/30/55` na
tela, antes de o usuário tocar em nada. O default continua valendo para linha nova; para linha
existente, o dado manda.

O form ganhou o campo `componentes: ComponentePagamento[] | null`
(`frontend/fluxo-pagamento-editor.ts:18-29`), declarado como **não editável**: é a memória do que o
modal não sabe editar.

**Metade 2 — `fluxoPagamentoParaSalvar` regenerava tudo pelo legado.**
Nova função `componentesParaSalvar` (`frontend/fluxo-pagamento-editor.ts:67-146`), com três casos
em ordem:

| Caso | Condição | O que faz |
|---|---|---|
| 1 | linha **sem** `componentes` persistidos | regenera pelo legado — comportamento de sempre |
| 2 | o regenerado tem a **mesma estrutura** do persistido | devolve o persistido **verbatim** ← é o no-op |
| 3 | o usuário mexeu de verdade no espelho legado | regenera e **transplanta por índice+tipo** `taxaMensal`, `sinalPct`, `jurosNoMesDaContratacao` e `rotulo` |

"Mesma estrutura" (`mesmaEstrutura`, `:101-104`) compara **só o que o espelho legado sabe dizer** —
`participacaoPct`, `descontoPct`, `prazoMeses`, `defasagemMeses`, `marcoMes`, `mesPagamento`.
Diferença em `taxaMensal`/`sinalPct` é justamente o que **não pode** contar como "o usuário mudou
algo", já que a UI não tem como mudá-los.

Há ainda um guarda para espelho legado inteiramente vazio (`:128-130`): sem `entrada` e sem
`parcelas` não existe nada de onde regenerar, e `componentesDoLegado` devolveria um repasse de 100%
que ninguém pediu — o persistido fica de pé.

**Terceira mudança, pequena e necessária:** `erroFormularioPagamento` (`:170-174`) passou a validar
o array que `fluxoPagamentoParaSalvar` **vai gravar**, e não uma projeção parecida. Com dois
caminhos diferentes, o modal poderia aprovar uma coisa e persistir outra.

### O que isto NÃO faz — de propósito

Não adiciona campo de taxa nem de sinal no modal. A lacuna §4.5-1 do dossiê (juros de tabela sem
superfície de edição) **continua aberta** e é issue do bloco 8-B. O conserto trata a **destruição**:
um plano com juros que passe pelo modal deixa de ser zerado. Não foi preciso escopo extra: a
fidelidade de ida-e-volta é alcançável sem campo novo.

### Testes — `frontend/fluxo-pagamento-editor.test.ts:66-153`

A fixture `FP_TABELA_LONGA` reproduz o shape real da linha "Tabela longa" do estudo 5: `entrada: []`
(0%), parcelamento ao longo da obra de 30%, repasse derivado de 70%, e `taxaMensal = 0,0098636`
(12,5% a.a.) no componente `ate_marco`.

1. **`abrir o modal e aplicar SEM MUDAR NADA é no-op — inclusive taxaMensal e sinalPct`** — trava a
   invariante inteira: `form.entrada` continua `[]` (metade 1), `salvo.componentes` é
   `deepEqual` ao original (metade 2), `taxaMensal` intacta, `0/30/70` continua `0/30/70`. E mais
   uma volta: aplicar de novo sobre o que foi gravado também não move nada (idempotência).
2. **`editar de verdade o espelho legado regenera — e preserva o que o legado não sabe dizer`** —
   muda o parcelamento de 30% para 40%, confirma que a estrutura acompanha (`ate_marco 40` +
   `concentrado 60`) e que a taxa **sobrevive** à regeneração.
3. **`linha sem componentes canônicos segue no comportamento de sempre`** — regressão do caminho
   antigo: sem `componentes` persistidos os placeholders continuam nascendo (`15/15/70`) e a
   regeneração é integral.

---

## BUG 3 — `PATCH` de tipologias gravava quantidade sem validar saldo (D3)

### Diff conceitual

Nova função pura exportada, `erroQuantidadeTipologia`
(`backend/rotas/avancado.ts:751-773`), e o portão na rota
(`backend/rotas/avancado.ts:848-864`):

    if (dados.quantidade !== undefined) {
      const saldo = await saldoTipologiaNoEstudo(req, tip);
      const comprometidas = (Number(tip.quantidade) || 0) - saldo;
      const msg = erroQuantidadeTipologia(dados.quantidade, comprometidas);
      if (msg) { erro(res, 422, 'SALDO_EXCEDIDO', msg); return; }
    }

**A contagem do comprometido não foi reescrita.** Ela sai de `saldoTipologiaNoEstudo`
(`backend/rotas/avancado.ts:1079-1091`) — a **mesma** função que a porta das alocações usa, e que já
desconta alocações **e** permutas via `unidadesPermutadasNoEstudo` (`:1066-1077`). O comprometido é o
complemento aritmético do saldo: `quantidade − saldo`.

O código de erro é **`SALDO_EXCEDIDO`, 422** — o mesmo que POST e PATCH de alocações já emitem. É a
mesma família semântica (a operação levaria o saldo a negativo) e nenhuma tela mapeia códigos, então
não há regressão de mensagem.

Por que a regra é uma função **pura** separada: a contagem é assíncrona e depende de `req.dados`,
mas a **decisão** não. Assim ela é testável sem servidor nem banco — o mesmo desenho de
`validarCamposOperacao` em `backend/rotas/funding.ts`, que o enunciado indicou como modelo.

`POST` de tipologia não precisa do portão: uma tipologia recém-criada tem zero comprometido.

### Testes — `backend/rotas/avancado.test.ts:394-427`

1. **`reduzir a quantidade abaixo do comprometido é barrado`** — reproduz o estado real da
   instância: 234 alocadas + 42 permutadas = 276 comprometidas, estoque não pode voltar para 234.
2. **`quantidade igual ou acima do comprometido passa`** — 276 e 300 passam; tipologia sem nada
   comprometido aceita 0.
3. **`campo ausente ou não numérico não é assunto desta regra`** — PATCH parcial sem `quantidade`
   não pode ser barrado; comprometido inválido degrada para 0 em vez de barrar tudo com `NaN`.

---

## Validação — resultado exato, e o que NÃO deu para rodar

### `bash scripts/validar-frontend.sh` — **abortou na etapa 2/5, por ambiente**

    == 1/5 guards estáticos (aspas curvas + JSON estrito + ciclos de schema) ==
      ok: schema.json, manifesto.json são JSON estrito
    guard-schema-ciclos: ok (21 tabelas, nenhum ciclo)
      ok: nenhuma aspa curva em atributo
    == 2/5 pnpm install (401 do @urbiverso/sdk é esperado e ignorado) ==
    ERRO: node_modules/.pnpm não existe — o pnpm não conseguiu baixar nem os pacotes públicos (sem rede?).

> ⚠️ **A causa não é o 401 do SDK: é que o `pnpm` NÃO EXISTE nesta máquina** (`command -v pnpm`
> devolve vazio). O `node_modules/` daqui é um install **flat, do npm**, com 79 pacotes — lit,
> typescript, tsx, esbuild, express e um **stub** de `@urbiverso/sdk`. As etapas 2/5 e 3/5 do
> script existem só para reconstituir esses symlinks a partir do store `.pnpm`; sem `.pnpm` elas
> não têm o que fazer, mas o que elas produziriam **já está no disco**.

Por isso rodei **as mesmas etapas 1/5, 4/5 e 5/5, com os mesmos comandos**, pulando só as duas de
instalação. Todas verdes:

| Etapa | Comando | Resultado |
|---|---|---|
| 1/5 guards | `node scripts/guard-json.mjs` · `node scripts/guard-schema-ciclos.mjs` · grep de aspas curvas | ✅ JSON estrito ok · 21 tabelas, nenhum ciclo · nenhuma aspa curva |
| 4/5 typecheck | `tsc --noEmit -p tsconfig.frontend.json` (o mesmo tsconfig gerado pelo script) | ✅ **exit 0** |
| 5/5 testes | `node --import tsx/esm --test --test-timeout=60000 frontend/*.test.ts` | ✅ **411 pass · 0 fail** (432 ms) |
| 5/5 build | `esbuild frontend/index.ts --bundle --external:@urbiverso/ui --format=esm --minify --target=es2022` | ✅ **438,1 kb, exit 0** |

`frontend/fixtures/*.test.ts` não casa com nenhum arquivo hoje (o `compgen` do script confirma), então
o glob único é o correto — mesma decisão que o próprio script toma.

### `bash scripts/validar-backend.sh` — **abortou na etapa 1/5, como previsto no dossiê**

    == 0/5 guard: JSON estrito (schema.json, manifesto.json) ==
      ok: schema.json, manifesto.json são JSON estrito
    == 1/5 dependências públicas (express) ==
    ERRO: node_modules/.pnpm não existe — rode antes: bash scripts/validar-frontend.sh

**"Não deu para rodar" não é "passou".** O que consegui rodar do backend, e o que fica pendente:

| Passo do `validar-backend.sh` | Estado |
|---|---|
| 0/5 guard de JSON estrito | ✅ verde |
| 1/5 portão do SDK | ❌ **abortou** — sem `.pnpm` e sem `pnpm` |
| typecheck do backend | ⚠️ **rodado à mão, com ressalva** (abaixo) |
| testes de lógica pura das rotas | ✅ **74 pass · 0 fail**, rodados à mão com `node --import tsx/esm --test backend/rotas/*.test.ts` |
| harness de migrações | ⏸️ **não rodado** — não há migração nova neste diff |
| guard de `versao` | ⏸️ **não rodado** — `manifesto.json` intocado, e é o que a regra manda |

**A ressalva do typecheck do backend:** `tsc --noEmit -p tsconfig.json` (frontend + backend) devolve
**8 erros pré-existentes**, todos consequência do stub do SDK e **nenhum** em arquivo deste diff:

    backend/rotas/empreendimento.ts(37,38) · (38,31)   Property 'arquivos' does not exist on type 'Request'
    backend/rotas/estudos.ts(80,36) · (96,46)          idem
    backend/rotinas.ts(1,59)                           Cannot find module '@urbiverso/sdk'
    backend/rotinas.ts(130,14) · (131,12) · (131,15)   Parameter implicitly has an 'any' type

`backend/rotas/avancado.ts` **não aparece na lista** — o arquivo que este conserto tocou compila
limpo. Mesmo assim, **o typecheck de backend com o SDK real continua sendo do autor**, no ambiente
autenticado, junto com `urbi-empacotar`, a sincronização do `schema.json` pelo SDK e a execução das
migrações no Postgres.

### Contratos da casa conferidos

| Contrato | Estado |
|---|---|
| Valor monetário de fórmula com 2 casas | ✅ nenhuma formatação nova foi introduzida — os três consertos mexem em motor e rota, não em apresentação |
| Tokens CSS, nunca cor literal | ✅ nenhum CSS tocado |
| Só props que os primitivos declaram | ✅ nenhum template `urbi-*` alterado |
| `versao` do `manifesto.json` | ✅ **não bumpada** — sem migração |
| Não tocar em `funding-motor.ts:58-67` | ✅ `funding-motor.ts` não foi alterado em linha nenhuma |
