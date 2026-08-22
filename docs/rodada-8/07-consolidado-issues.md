# Rodada 8 · A1 — Consolidado de issues

> Compilação das seis entregas da Rodada 1 (`01-`…`06-`) num backlog único, deduplicado e ordenado.
> Escrito em 2026-08-22, branch `claude/rodada-8-auditoria`, base `main` @ `475dd24`.
>
> **Esta rodada especifica.** Nenhuma issue aqui foi implementada por mim. As três mais graves estão
> sendo consertadas **agora**, nesta branch, pelo agente B2 — e por isso **não** têm issue (§0.2).

---

## 0. Como ler este documento

### 0.1 Números

| | Qtd |
|---|---:|
| **Bloco 8-A** — dívida da Rodada 7 | **6** |
| **Bloco 8-B** — lacunas de modelo e defeitos novos | **27** |
| **Total pronto para `gh issue create`** | **33** |
| Consertos em andamento pelo B2, sem issue | 3 |
| Reservado para o B1 (auditoria dos 39 itens) | §3, em aberto |
| Perguntas ao autor, agrupadas | **24**, em 10 temas (§4) |
| Propostas **recusadas pelo autor**, registradas para não voltarem | 2 (§5) |

### 0.2 Os três bugs graves — **ABRA ISSUE PARA OS TRÊS**

> 🔴 **ESTA SEÇÃO FOI INVERTIDA PELA DECISÃO DO AUTOR EM 2026-08-22.** O título original dizia
> *"o que o B2 está consertando — não abra issue para isto"*. O autor reverteu a autorização de
> conserto: *"O B2 não deve consertar bugs, só escrever issues."* **O código foi revertido; a
> árvore está idêntica à `main`.** Os três defeitos abaixo **são issues do bloco 8-B**, e são as
> de maior consequência medida de todo o backlog.
>
> O corpo pronto de cada uma está em **`docs/rodada-8/09-consertos.md`**, que traz o diagnóstico,
> a correção projetada e os testes — tudo já escrito e executado em verde antes de reverter.
> Leia o aviso no topo daquele documento: há três correções ao texto original que as issues
> precisam carregar.

| Defeito | Onde | Consequência medida |
|---|---|---|
| `proformaAvancado` soma o **principal** do funding ao custo e nunca credita as entradas | `frontend/proforma-avancado.ts:92-93` | Estudo 5: Resultado exibido **−R$ 62.364.749,03** contra R$ 24.668.189,10 reais (Δ **R$ 87.032.938,13**, = Σ saídas de funding ao centavo). Estudo 6: Δ **R$ 91.308.456,35**. Atinge a aba Resultados **e** o painel de estudos (A5 §D14) |
| Modal de Fluxo de Pagamento reescreve `componentes` e zera `taxaMensal`/`sinalPct` | `frontend/tela-fluxo-receitas.ts:843` · `frontend/fluxo-pagamento-editor.ts:88-90` | Estudo 5: abrir e clicar Aplicar sem mudar nada destrói R$ 1.259.273,59 de juros; TIR 18,59% → 17,53% (A5 §D10, A6 §4.1) |
| `PATCH .../tipologias/:tid` grava `quantidade` **sem validar saldo** | `backend/rotas/avancado.ts:809-832` | Estoque de 234 unidades com 276 comprometidas nos dois estudos Avançados; estoque mensal negativo (−3,975 un. no mês 48 do estudo 5) (A5 §D3) |

⚠️ **O que fica de fora do conserto do BUG 2 é issue minha:** o **campo de taxa de juros e de sinal**
no modal é *feature*, não conserto — o B2 para de destruir o dado, mas continua **sem superfície para
digitá-lo**. É a issue **8-B.2**, a segunda de maior consequência de todo o backlog.

### 0.3 Como disparar

> 🔴 **Correção ao que escrevi em `01-verificacao-47-itens.md` §5 Q5.** Eu afirmei que *"o `gh` CLI
> não existe neste ambiente"*. **Existe** — está em `/c/Program Files/GitHub CLI`. O que falta é
> **autenticação** (`gh auth login`), que é do autor. Os corpos abaixo estão prontos para uso direto.

Cada issue traz **Título** e **Corpo**. O corpo é exatamente o que vai no `--body-file`:

    gh issue create \
      --title "fix(escopo): o que muda" \
      --label "rodada-8" \
      --body-file docs/rodada-8/corpos/8-B-02.md

Ou, sem arquivo intermediário:

    gh issue create --title "fix(escopo): …" --body-file - <<'CORPO'
    …cole o bloco Corpo aqui…
    CORPO

**Lembretes que já custaram 53 issues abertas neste repo** (`CLAUDE.md` § Fechamento de issue):
`Closes #NNN` só fecha **em inglês**, **no corpo do PR ou do commit — nunca no título**, e **uma
keyword por issue** (`closes #1, closes #2`). Para citar sem fechar, o corpo do PR declara
`Sem-fechamento: #NNN <motivo>` — é o que o guard `scripts/guard-issue-fechamento.mjs` exige.

### 0.4 Convergência entre lentes — por que ela vale como evidência

Vários agentes acharam o mesmo defeito por caminhos independentes. Onde isso aconteceu, a issue
**cita todas as fontes**, e o número de lentes convergentes está na tabela de prioridade. Três lentes
independentes chegando ao mesmo `arquivo:linha` é evidência forte; uma lente sozinha é hipótese.

| Convergência | Issue | Lentes |
|---|---|---|
| Juros de tabela nunca existem porque a UI zera a taxa | 8-B.2 | A2 (planilha) · A4 (código) · A5 (instância) · A6 (UI) — **4** |
| `pos_obra.duracao_meses` tem dois significados | 8-B.3 | A4 · A5 · A6 — **3** |
| `correcao_estoque` é controle vivo e inerte | 8-B.10 | A2 · A4 · A5 — **3** |
| `fmtNum` promete casas que não entrega | 8-A.1 | A1 · A4 · A6 — **3** |
| `urbi-kpi` transborda; o wrapper da #326 não corrige | 8-A.2 | A1 · A6 — **2**, com mecanismo idêntico achado em separado |
| Base de receita líquida do equity: doc ≠ código | 8-B.25 | A2 · A3 — **2** |
| Aba Financeiro majoritariamente inerte | 8-B.9 | A4 (7 controles) · A6 (9, refinado) — **2** |
| "Margem líquida" com definições diferentes por tela | 8-B.4 | A5 (números) · A6 (superfícies) — **2** |

### 0.5 Nota de ambiente, repetida porque importa

- **Nenhum navegador.** Todo veredito visual é por construção CSS e métrica tipográfica. Onde A1 e
  A6 divergiram, a issue **registra a divergência** em vez de escolher (8-A.4).
- **`validar-backend.sh` não roda aqui** — o `@urbiverso/sdk` desta máquina é stub (sem `dist/`, sem
  `docs/`) e o script aborta na etapa 1/5. Backend, `schema.json` e migração são validados pelo
  autor. *"Não deu para rodar" nunca é "passou".*
- **O monorepo `C:\Users\raafa\urbiverso` é só leitura.** As leituras de `ui/src/*.ts` e
  `compartilhado/tokens.css` citadas abaixo são o uso legítimo; elas estão na **`main`**, à frente do
  SDK publicado — qualquer PR que dependa de prop vista ali precisa declarar isso.

---

## 1. Bloco 8-A — dívida da Rodada 7

Seis issues. Todas de **frontend puro** exceto a 8-A.3, que depende da plataforma. Nenhuma toca
`schema.json` nem migração → **`versao` do `manifesto.json` não bumpa em nenhuma delas**
(`CLAUDE.md` § Versão do manifesto).

Origem: `01-verificacao-47-itens.md`, com os acréscimos do A6 (`06-auditoria-ui.md` §6) incorporados
nas 8-A.2 e 8-A.4.

---

### 8-A.1 — item 11 · sensibilidade com 2 casas fixas

**Título**

```
fix(proforma): sensibilidade com 2 casas decimais fixas, não "até 2"
```

**Corpo**

```markdown
**Contexto** — item 11 da `lista bugs 20260807.xlsx`; issue original #323 da Rodada 7, que entregou
duas das três cláusulas do pedido. A terceira ("mantenha o formato em número com duas casas
decimais") não foi entregue e ninguém percebeu porque nenhum teste cobre a formatação dessa tabela.
Achado por três lentes independentes nesta rodada: A1 (auditoria dos 47), A4 (comportamento
acidental A5) e A6 (mapa de formatação, achado B3).

**Comportamento atual**
- `frontend/tela-proforma.ts:453` — `const fmt = (m, v) => (m.pct ? fmtPct(v) : fmtNum(v, 2));`
- `frontend/viab-format.ts:24-25` — `fmtNum` declara **só** `maximumFractionDigits`, nunca
  `minimumFractionDigits`.

Resultado nas colunas Bear/Base/Bull da tabela de sensibilidade (Preliminar → Resultado → Cenários),
nas 6 linhas monetárias de `:441-447` (VGV, Receita bruta, Receita líquida, Custo direto total,
Receita operacional, Custo indireto total, Resultado): `21230000` → `"21.230.000"`;
`1500000.5` → `"1.500.000,5"`; `1500000.55` → `"1.500.000,55"`.

**Por que não atende** — o pedido literal do autor é *"retire o símbolo de dinheiro de todos os
campos, **mantenha o formato em número com duas casas decimais**"*. `fmtNum(v, 2)` entrega **até**
2 casas, não 2 casas. Numa coluna que a própria #323 acabou de alinhar à direita, a vírgula decimal
deixa de bater entre linhas — o defeito que o alinhamento existe para evitar. O comentário de
`tela-proforma.ts:452` (*"número puro com 2 casas decimais"*) **declara o contrato que o código não
cumpre**. Também colide com o contrato C7 do `CLAUDE.md`: *"todo valor monetário resultado de fórmula
tem 2 casas decimais — na apresentação, na entrada e no motor"*, e essas 6 linhas são resultado de
`calcularProforma`.

**Comportamento esperado** — os valores monetários das colunas Bear/Base/Bull exibem **sempre** 2
casas decimais, sem símbolo de moeda, com separador de milhar pt-BR. Use `fmtR$(v, false)`
(`frontend/viab-format.ts:13-22`), que já é a fonte única de arredondamento monetário do contrato C7
(#281) e devolve `min = max = 2` sem o símbolo. **Não** crie formatador novo, e **não** altere a
assinatura de `fmtNum` — ela tem 5 chamadores com semânticas diferentes.

As duas linhas de indicador (`Custo obras / VGV`, `Margem líquida`) continuam em `fmtPct` — são %
calculada, 1 casa, fora de escopo.

**Critério de aceite**
1. `grep -n "fmtNum(v, 2)" frontend/tela-proforma.ts` **não retorna nada**.
2. Teste novo provando `fmtR$(1500000, false) === '1.500.000,00'` e
   `fmtR$(1500000.5, false) === '1.500.000,50'`.
3. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- Os outros chamadores de `fmtNum` com casas (`tela-premissas.ts:924,925` m² e ha;
  `tela-proforma.ts:224` %; `viabilidade-config-benchmarks.ts:166`) — grandeza não monetária, que
  segue a regra "precisão plena internamente, arredonda só para exibir".
- A divergência tela × exportação na tabela de Fluxo de Caixa do Avançado
  (`fluxo-tabela.ts:33-39` × `exportar.ts:167-174`). É outro defeito, com outra causa, e tem issue
  própria — a que herdou o endereço da #281.

Sem-fechamento: #323 executora original do item 11 na Rodada 7, já fechada; esta issue cobre a
cláusula que ficou de fora
Sem-fechamento: #281 dívida vizinha de fonte única de formatação; o duplicado mudou de endereço e é
tratado em issue própria
```

---

### 8-A.2 — item 17 · `urbi-kpi` para de estourar a track

**Título**

```
fix(resumo): urbi-kpi para de estourar a track — remover width:100%, espelhar o Preliminar
```

**Corpo**

```markdown
**Contexto** — item 17 da `lista bugs 20260807.xlsx`; issue original #326 da Rodada 7. O autor
escreveu *"problema contínuo que ainda não foi resolvido mesmo pedindo várias vezes"* — é a terceira
passada (antes: #176, #326). E deu o gabarito na própria frase: *"nos estudos Preliminares isso já
está certo"*. Dois agentes chegaram ao mesmo mecanismo em separado (A1 §2.4, A6 §6/item 17).

**Comportamento atual**

Preliminar — `frontend/tela-proforma.ts:52-53` (o que o autor diz estar certo):
```css
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 220px)); gap: 12px; }
.kpis urbi-kpi { min-width: 0; }
```

Avançado — `frontend/tela-resumo.ts:66-67` (depois da #326):
```css
.kpis .kpi-cel { display: flex; flex-direction: column; min-width: 0; }
.kpis .kpi-cel urbi-kpi { width: 100%; }
```

**Por que não atende** — a #326 embrulhou o KPI num `.kpi-cel` mas **manteve o `width: 100%`**, só
desceu um nível. O `:host` do primitivo (`urbiverso/ui/src/urbi-kpi.ts:41-46`) declara
`padding: 14px 16px` + `border: 1px` e **não** declara `box-sizing: border-box`. A cadeia inteira foi
conferida e não há reset em lugar nenhum:

| Onde | Resultado |
|---|---|
| `:host` de `urbi-kpi.ts` | ausente |
| `UrbiPrimitivoDeConteudo.estiloConteudo` (`urbi-primitivo-conteudo.ts:39-48`) | só `display`/`flex-direction`/`min-height` |
| `urbi-primitivo-conteudo.ts` inteiro | uma ocorrência, em `:81`, dentro de `.estado-erro` — não alcança o `:host` |
| `urbiverso/compartilhado/tokens.css` | nenhum reset global |
| `frontend/*.ts` | só `.grid > *` e `.c1..c6` — nada alcança `urbi-kpi` |

`box-sizing` não é herdado. Logo `width: 100%` é largura de **conteúdo**: a caixa mede
`100% + 32px + 2px` e transborda o `.kpi-cel`, que não tem `overflow`. É a sobreposição reportada.

Duas agravantes:
1. O commit `bd1244e` **nomeia esse mecanismo** na própria mensagem — *"se o `:host` do primitivo
   tiver padding/border em content-box … o card estoura a track"* — e mantém o `width: 100%`.
2. O comentário `tela-resumo.ts:63-65` justifica o wrapper como *"o padrão já comprovado de
   `fluxo-tabela.ts:73-74`"*. **A analogia é falsa:** `fluxo-tabela.ts:65-82` não usa `urbi-kpi` —
   é uma `<div class="kpi-card">`, HTML do próprio app, com `min-width: 0` e **sem** `width: 100%`.
   Um `div` da sua folha é caixa que você controla; um custom element com `:host` estilizado no
   shadow DOM não é. Pior: `fluxo-tabela.ts:56-64` registra que a app **já concluiu**, na #352, que
   *"a saída determinística (D7) é abandonar `urbi-kpi` nesses 6 cards"* — e a #326 reintroduziu
   `urbi-kpi` com `width: 100%` citando essa mesma conclusão como prova de que dava certo.

**Comportamento esperado** — duas correções possíveis, **ambas de uma linha e ambas do lado do app**.
Escolha uma e diga qual no PR:

- **(a)** apagar `width: 100%` de `frontend/tela-resumo.ts:67`, removendo o wrapper `.kpi-cel` e
  deixando os `<urbi-kpi>` como itens diretos do grid (`:176-184`) com a regra idêntica à do
  Preliminar: `.kpis urbi-kpi { min-width: 0; }` — **recomendada**, é o que o autor apontou como já
  correto;
- **(b)** `.kpis urbi-kpi { box-sizing: border-box; }`. Funciona porque regra vinda de **fora** da
  shadow tree vence a regra `:host` de dentro (o hospedeiro pertence à árvore do app). Também não
  exige nada do monorepo.

Além disso: remover a classe órfã `kpi-cel` de `frontend/tela-cenarios.ts:363` — **não existe** regra
`.kpi-cel` no `static styles` daquele componente (`:92-135`) nem em `estiloFluxoTabela`
(`fluxo-tabela.ts` define `.kpi-card`, nunca `.kpi-cel`). É resíduo da `tela-capital-stack.ts`
apagada pela #355; hoje não sobrepõe nada (card único), mas é dívida da mesma origem.

**Critério de aceite**
1. `grep -rn "width: 100%" frontend/tela-resumo.ts` não retorna nenhuma linha com `urbi-kpi`.
2. `grep -rn "kpi-cel" frontend/*.ts` **não retorna nada**.
3. Se a saída for (a): a regra de `.kpis urbi-kpi` em `tela-resumo.ts` é **textualmente idêntica** à
   de `tela-proforma.ts:53`.
4. `bash scripts/validar-frontend.sh` verde.
5. **Confirmação visual na Pinguim** (Avançado → Resumo, janela estreita, VPL/VGV de 9+ dígitos, nos
   temas claro e escuro): nenhum card pinta sobre o vizinho. Este passo é do autor — não há navegador
   no ambiente Claude Code, e "não deu para rodar" nunca é "passou".

**Fora de escopo**
- Pedir slot ou prop nova em `urbi-kpi`. Não é necessário: o Preliminar prova que o primitivo, usado
  como está, não sobrepõe.
- Os `.kpi-card` de `frontend/fluxo-tabela.ts:67-92` (markup próprio da D7/#352). Estão corretos e
  são a referência do padrão oposto.

Sem-fechamento: #326 executora original do item 17; o wrapper que ela introduziu é a causa desta issue
Sem-fechamento: #176 primeira tentativa no mesmo sintoma, contexto histórico
Sem-fechamento: #352 origem do padrão .kpi-card, citada erradamente como precedente pela #326
```

---

### 8-A.3 — item 22 · Data de início por mês e ano

**Título**

```
feat(cronograma): Data de início do projeto selecionada só por mês e ano
```

**Corpo**

```markdown
**Contexto** — item 22 da `lista bugs 20260807.xlsx`; issue original #327 da Rodada 7, que entregou a
metade semântica e não a metade de interação.

**Comportamento atual** — `frontend/tela-fluxo-cronograma.ts:155-167` usa `urbi-input-data` com
`.valor=${mesAnoParaISO(...)}` e converte de volta com `isoParaMesAno(e.detail.valor)`
(`frontend/fluxo-shared.ts:33-46`). O dia é sempre emitido como `-01` e sempre descartado na volta;
o persistido segue `"mmm/AAAA"`.

Mas `urbiverso/ui/src/urbi-input-data.ts:86` renderiza `<input type="date">`, fixo, e as props
declaradas (`:18-24`) são `label`, `valor`, `min`, `max`, `obrigatorio`, `desabilitado`, `erro` —
**nenhuma de granularidade**. O seletor nativo abre grade de dias e exige escolher um. O próprio
comentário do app admite: `tela-fluxo-cronograma.ts:161-165`.

**Por que não atende** — o autor pediu quatro coisas e recebeu duas:

| Pedido literal | Estado |
|---|---|
| "selecionar em uma caixa de datas" | ✅ |
| "trave o dia como dia primeiro de qualquer mês" | ✅ (por descarte no handler, não na UI) |
| "**não precisar selecionar o dia**" | ❌ |
| "**eu seleciono somente o mês e ano**" | ❌ |

A semântica está certa; a interação, não. O que foi pedido é literalmente `type="month"`.

**Comportamento esperado** — quando `urbi-input-data` oferecer granularidade de mês, passar a usá-la
nesta tela; o formato persistido (`"mmm/AAAA"`) e o marco zero do fluxo **não mudam**.

**Pedido à plataforma** — texto pronto para o autor levar ao monorepo. **Nada aqui autoriza commit em
`urbiverso/urbiverso`** (`CLAUDE.md` § O monorepo é só leitura):

> **`urbi-input-data`: granularidade de mês.**
> **O que falta:** uma prop declarada — sugestão `granularidade: 'dia' | 'mes'`, default `'dia'`
> (retrocompatível) — que troque o `type="date"` de `ui/src/urbi-input-data.ts:86` por
> `type="month"`, emitindo `urbi:input-data-change` com `valor` no formato `"YYYY-MM"` e aceitando
> `valor` nesse mesmo formato.
> **Por que a app não contorna:** `type` não é prop do primitivo e o `<input>` mora no shadow DOM —
> inalcançável por CSS ou por atributo do lado do consumidor. As alternativas dentro da app são
> piores: dois `urbi-select` (mês + ano) abandonam a "caixa de datas" que o autor pediu
> explicitamente; um `<input type="month">` cru viola o contrato "só primitivos `urbi-*`".
> **Quem precisa:** app `viabilidade`, campo "Data de início do projeto" (Avançado → Empreendimento →
> Cronograma), que ancora o mês 0 de todo o fluxo de caixa. O caso é geral — qualquer campo de
> competência mensal.
> **Nota de piso:** se a prop entrar numa versão nova do shell, `shell_min` do `manifesto.json` sobe
> junto — e subir piso **não** bumpa `versao` (decisão da #422).

**Critério de aceite** — em duas etapas, e **a etapa 1 pode fechar sozinha**:

*Etapa 1 (nesta app, agora):* o campo ganha texto auxiliar dizendo que o dia é ignorado e sempre
tratado como o 1º do mês. Verificação: `grep` acha o texto no markup de `tela-fluxo-cronograma.ts` e
`bash scripts/validar-frontend.sh` verde.

*Etapa 2 (depois que a plataforma entregar):* `tela-fluxo-cronograma.ts:155-167` declara a prop nova;
`mesAnoParaISO`/`isoParaMesAno` convertem de/para `"YYYY-MM"`; os testes de ida-e-volta de
`frontend/fluxo-shared.test.ts` são atualizados e continuam verdes; o texto auxiliar da etapa 1 sai.
Verificação: o `<input>` do seletor é `type="month"` na instância.

**Fora de escopo**
- Trocar o formato persistido `"mmm/AAAA"` — é contrato do motor (`parseMesAno`/`REGEX_MES_ANO`), e o
  autor foi explícito: *"as regras e dependências de outras variações e campos continuam dependentes
  desse campo inicial"*.
- Substituir `urbi-input-data` por markup próprio.

Sem-fechamento: #327 executora original do item 22; entregou a semântica, não a interação
```

---

### 8-A.4 — item 24 · larguras da tabela de Tipologias

**Título**

```
fix(tipologias): larguras de coluna medidas contra a fonte certa, cabeçalho legível
```

**Corpo**

```markdown
**Contexto** — item 24 da `lista bugs 20260807.xlsx`; issue original #334 da Rodada 7. Dois agentes
auditaram (A1 §2.5, A6 §6/item 24) e **acharam problemas diferentes**. O do A6 é estrutural e ninguém
o tinha visto; o do A1 é o efeito colateral. Os dois estão descritos abaixo, e **eles divergem num
ponto** — a divergência está registrada de propósito (ver "Divergência não resolvida").

**Comportamento atual** — `frontend/tela-empreendimento-tipologias.ts:79-85`:
```css
col.c-area    { width: 16ch; }   /* 6 dígitos + milhar + decimais + sufixo "m²" */
col.c-dorm    { width: 7ch; }    /* 2 dígitos */
col.c-vagas   { width: 7ch; }    /* 2 dígitos */
col.c-un      { width: 8ch; }    /* 4 dígitos */
col.c-areatot { width: 17ch; }
```

**Problema 1 🔴 — `ch` está sendo medido contra a fonte errada, e isso é certeza, não estimativa.**

`1ch` é o avanço do glifo `0` **na fonte computada do elemento onde a largura é declarada**. Aqui o
elemento é `<col>`, e a folha **não dá `font-size` a `col`** — ele herda de `table` → host → `:root`
= **1rem = 16px**. Mas o conteúdo renderiza em `td { font-size: var(--texto-corpo, 0.8125rem) }`
(`:69`) = **13px**, e o cabeçalho em `th { font-size: var(--texto-rotulo, 0.75rem) }` (`:61`) =
**12px** (tokens em `urbiverso/compartilhado/tokens.css:193-194`).

As colunas são dimensionadas para dígitos de **16px** e preenchidas com dígitos de **13px** —
**~23% mais largas** que a intenção declarada. O comentário `:75-78` afirma *"cabe exatamente o
número de dígitos citado, **sem sobra**"*. Há sobra sistemática. Esta parte é **independente de
fonte** e vale para qualquer tema.

**Problema 2 🟡 — cabeçalho cortado.** `table-layout: fixed` (`:56`) + `th { overflow: hidden }`
(`:63`), sem `white-space`, `overflow-wrap` ou `hyphens`. Os rótulos (`:192-195`) são "Área
privativa", "Dormitórios", "Vagas", "Unidades", "Área total". **"Dormitórios" é palavra única de 11
caracteres e não quebra.** Antes da #334 a coluna era 90px, onde cabia.

**Problema 3 🟡 — `ch` é dependente de tema, e isso não estava no radar.** `urbiverso/compartilhado/tokens.css:188`
define `--fonte: 'Montserrat', sans-serif`; o tema **cyberpunk** (`:514`) troca para `'Chakra Petch'`,
de métrica diferente. **Toda largura em `ch` muda de tamanho ao trocar de tema**, e o
`overflow: hidden` corta em silêncio. Se o critério é "cabe N dígitos em qualquer tema", `ch` é a
unidade errada.

**Divergência não resolvida entre os dois auditores — decida com régua, não com argumento**

| Coluna | A1 (conta com `ch` ≈ 0,5em @12px) | A6 (conta com `ch` @16px Montserrat) |
|---|---|---|
| `c-dorm` "Dormitórios" | 🔴 cortado | 🔴 cortado — **os dois concordam** |
| `c-un` "Unidades" | 🔴 cortado | 🟡 no limite, **provavelmente cabe** |
| `c-vagas` "Vagas" | ⚠️ no limite | ✅ cabe |
| `c-area` "Área privativa" | ✅ | ✅ |

**Nenhum dos dois usou navegador** — este ambiente não tem um, por decisão do autor. O mecanismo (`ch`
em `<col>` resolve contra 1rem) é certeza; o **quanto** cada rótulo transborda precisa de medição.

**Por que não atende** — o autor pediu *"reduzir a coluna de Área privativa para caber … 6 dígitos, …
Dormitórios e Vagas para … 2 dígitos e … Unidades para … 4 dígitos"*. Ele falou de **campos**. Recebeu
colunas 23% mais largas que o pedido **e** um cabeçalho cortado — nas duas direções erradas ao mesmo
tempo.

**Comportamento esperado**
1. **Medir primeiro.** Abrir Avançado → Empreendimento → Tipologias na Pinguim, registrar no PR a
   largura renderizada de `c-dorm`/`c-un`/`c-vagas` e quais cabeçalhos estão cortados, em tema claro,
   escuro e cyberpunk. Isso resolve a divergência acima com fato.
2. **Trocar a unidade.** Sair de `ch` em `<col>` para largura absoluta em `px`, calculada para a
   métrica mais larga entre os temas, com o dígito em `font-variant-numeric: tabular-nums` (a tabela
   já declara em `:55`). Alternativa aceitável: manter `ch` mas declarar `font-size` explícito no
   `col`, igualando-o ao do `td` — o que torna a conta previsível, mas **não** resolve a troca de
   fonte por tema.
3. **Cabeçalho legível** sem desfazer a redução de largura. Escolha uma e diga qual no PR:
   **(a)** rótulos curtos ("Dorm.", "Unid.") com o texto integral em `title`;
   **(b)** deixar o `th` quebrar em duas linhas (`white-space: normal; overflow-wrap: anywhere`,
   tirando o `overflow: hidden` do `th` e mantendo-o no `td`) — **recomendada**, preserva o pedido do
   autor por inteiro e não inventa abreviação;
   **(c)** largura = `max(dígitos pedidos, cabeçalho)`, que contraria em parte o pedido.

**Critério de aceite**
1. As medições do passo 1 estão no corpo do PR, com print ou número.
2. `grep -n "col.c-" frontend/tela-empreendimento-tipologias.ts` **não retorna nenhuma largura em
   `ch`** — ou, se retornar, existe `font-size` declarado no seletor `col`.
3. Nenhum cabeçalho da tabela `.tip` fica truncado nos três temas.
4. Uma coluna calibrada para N dígitos continua cabendo N dígitos ao trocar de tema — verificável
   pelo mesmo print.
5. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- Larguras de `c-nome` (150px), `c-tipo` (160px) e `c-acao` (90px) — o autor não as citou.
- O espaçamento entre colunas, já uniforme via `td { padding: 6px 8px }` (`:66-71`).

Sem-fechamento: #334 executora original do item 24; entregou os dígitos, com a unidade errada e sem
avaliar o efeito no cabeçalho
Sem-fechamento: #332 criou a coluna "Área total" redimensionada pela #334
```

---

### 8-A.5 — item 31 · remover o bloco "Definições"

**Título**

```
fix(receitas): remover o bloco "Definições" do modal de Fluxo de pagamento
```

**Corpo**

```markdown
**Contexto** — item 31 da `lista bugs 20260807.xlsx`; issue original #346 da Rodada 7. A #346 fez a
migração pedida (a parte difícil) e não fez a remoção pedida (a parte fácil). Confirmado por A1 §3.3
e A6 §7 Q7.

**Comportamento atual** — `frontend/tela-fluxo-receitas.ts:727-738`, dentro do modal "Fluxo de
pagamento" de cada Grupo de Receitas:
```html
<div class="pag-secao">
  <h4>Definições</h4>
  <p class="sec">Corretagem: configurada na linha de custo obrigatória "Corretagem de vendas" (Custos → Diretos).</p>
  <p class="sec">RET: controle global do estudo, em Custos → Financeiro.</p>
</div>
```
Dois parágrafos estáticos, sem controle nenhum, ocupando a primeira coluna do `.pag-grid`. É título
de seção sem seção.

O destino **está certo e não precisa de nada**: o RET global vive em
`frontend/tela-fluxo-custos.ts:487-511` (grupo Financeiro da tela de Custos = "Custos → Custos
Financeiros"), persistido em `estudos.considerar_ret`/`ret_pct` via `/avancado/parametros`
(`:955-975`; backend `backend/rotas/avancado.ts:447-448,482-491`), migração `027_ret_global.js`.

**Por que não atende** — a primeira frase do pedido é *"**Pode retirar essa informação dessa tela** de
fluxo que existe para cada grupo em Viabilidade → Receitas"*. O autor não pediu uma placa apontando
para o novo lugar; pediu que a informação saísse.

**Comportamento esperado** — remover integralmente o `<div class="pag-secao">` (`:728-737`) **e o
`<div>` que o envolve** (`:727` / `:738`), que de outro modo fica como coluna vazia do `.pag-grid`.
A primeira coluna do modal passa a começar em "Condições de entrada". Nenhuma mudança de dado, de
rota ou de motor.

**Critério de aceite**
1. `grep -n "Definições" frontend/tela-fluxo-receitas.ts` **não retorna nada**.
2. `.pag-secao` **continua** definida (`:153-157`) — a classe é compartilhada com os outros 3 blocos
   do modal (`:740`, `:764`, `:807`). Não remova a regra CSS junto com o bloco.
3. O modal continua abrindo e salvando: `frontend/fluxo-pagamento-editor.test.ts` verde, sem
   alteração.
4. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo — e leia antes de "consertar"**
O autor também escreveu que o controle "destacada ou embutida" da corretagem deveria **ir** para
Custos. A #346 o **apagou** em vez de mover, e isso está **certo**: desde a #228, `comissao.tipo` não
tem efeito nenhum no motor — `grep -n "comissao" frontend/fluxo-caixa-motor.ts frontend/fluxo-shared.ts`
não retorna nada, e `frontend/fluxo-caixa-motor.test.ts:381-403` prova a equivalência (*"marcar
comissão 'Destacada' não muda mais o Resultado"*). Mover controle inerte para a aba Financeiro
violaria a #279. **Não ressuscite o controle nesta issue.** A divergência entre o modelo mental do
autor e o do código está na §4 tema T5 do `docs/rodada-8/07-consolidado-issues.md`.

Este modal também é alvo do conserto do BUG 2 (regeneração destrutiva de `componentes`) e da issue de
campo de taxa de juros. **Coordene a ordem no PR** para não haver conflito de merge no mesmo arquivo.

Sem-fechamento: #346 executora original do item 31; fez a migração, não fez a remoção
Sem-fechamento: #228 decidiu que comissão "destacada" não deduz do recebível — contexto do fora de escopo
Sem-fechamento: #279 "nenhum campo da aba Financeiro permanece inerte" — contexto do fora de escopo
```

---

### 8-A.6 — colateral do item 46 · Exposição máxima coerente

**Título**

```
fix(cenarios): Exposição máxima com a mesma leitura no KPI e na tabela de cenários
```

**Corpo**

```markdown
**Contexto** — achado na auditoria do item 46 da `lista bugs 20260807.xlsx` (A1 §2.8). A #353
inverteu a leitura da Exposição máxima para magnitude, **mas só no card de KPI**. A tabela de
cenários salvos, na mesma tela, ficou na convenção anterior. Não reprova a #353 — o item 46 falava só
do KPI — mas o resultado é uma tela que se contradiz.

**Comportamento atual**

| Onde | Valor exibido | Variação |
|---|---|---|
| KPI (`frontend/fluxo-tabela.ts:278-279`) | `fmtR$(Math.abs(exposicaoMaxima))` — módulo | `varKpi(expMag, expBaseMag, false)` — magnitude |
| Tabela, célula (`frontend/tela-cenarios.ts:559`, `:525`) | `fmtR$(calc.exposicaoMaxima)` — **com sinal** | — |
| Tabela, badge (`frontend/tela-cenarios.ts:560,539`) | — | `calcularVariacao(novo, base, true)` — **assinado** |
| Marcos da mesma tela (`frontend/tela-cenarios.ts:284`) | `fmtR$(c.exposicaoMaxima)` — **com sinal** | — |
| Resumo (`frontend/tela-resumo.ts:180`) | `fmtR$(Math.abs(...))` — módulo | sem variação |

O comentário de `frontend/tela-cenarios.ts:534-537` ainda afirma *"todos os indicadores da tabela são
'maior é melhor' — inclusive a exposição máxima, que sendo negativa melhora ao subir"* — exatamente a
premissa que a #353 aposentou.

**Por que não atende** — numa piora de exposição de −1,0M para −1,2M, a mesma tela mostra **`+20,0%`
no KPI e `−20,0%` no badge da tabela**, para o mesmo cenário e a mesma grandeza; e o valor aparece
como `1.200.000,00` no KPI e `-1.200.000,00` na tabela. A cor coincide por acidente aritmético (as
duas convenções concordam no veredito melhor/pior; discordam no sinal e no valor exibido), o que
torna a contradição mais difícil de notar e não menos errada.

**Comportamento esperado** — uma única convenção para Exposição máxima em toda a app, a que o autor
escolheu no item 46: **exibir a magnitude** (`Math.abs`) e **comparar por magnitude**
(`maiorMelhor = false`). Aplicar em:
1. `frontend/tela-cenarios.ts:525,559` — célula passa a `fmtR$(Math.abs(...))`;
2. `frontend/tela-cenarios.ts:560` — badge compara `Math.abs(calc.exposicaoMaxima)` contra
   `Math.abs(base.exposicaoMaxima)` com `maiorMelhor = false`. `_badgeVar` (`:538-542`) ganha o
   parâmetro em vez de fixar `true`; VPL e TIR continuam passando `true`;
3. `frontend/tela-cenarios.ts:284` — marcos passam a `Math.abs(...)`;
4. `frontend/tela-cenarios.ts:534-537` — corrigir o comentário, que hoje **mente** sobre a regra
   vigente.

**Critério de aceite**
1. Teste novo em `frontend/cenario-variacao.test.ts`: com base `-1_000_000` e novo `-1_200_000`, a
   leitura por magnitude devolve `pct ≈ +20` e `melhor === false`; e a leitura da tabela produz o
   **mesmo sinal e o mesmo veredito** do KPI para o mesmo par.
2. `grep -n "exposicaoMaxima" frontend/tela-cenarios.ts` — nenhuma ocorrência sem `Math.abs`.
3. `bash scripts/validar-frontend.sh` verde.

**Fora de escopo**
- `frontend/exportar.ts` — a exportação tem contrato de sinal próprio e dívida de formatação própria.
- Mudar o **sinal armazenado** de `exposicaoMaxima` em `FluxoCalc`. Ele é `min(fluxoAcumulado)` e deve
  continuar negativo no motor; a mudança é só de apresentação e de comparação.

Sem-fechamento: #353 inverteu a leitura no KPI (item 46) e deixou a tabela na convenção antiga
Sem-fechamento: #132 origem dos badges de variação da tabela de cenários
```

---
