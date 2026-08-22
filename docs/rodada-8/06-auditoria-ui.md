# A6 — Auditoria de UI e coerência visual

> Rodada 8 · branch `claude/rodada-8-auditoria` · escrito em 2026-08-21.
> Método: **leitura de código + dados reais da API**. Sem navegador (decisão do autor, §1 do dossiê).
> Base: `main` em `475dd24`; app instalada em Pinguim é `viabilidade@0.1.28`, a mesma do `manifesto.json`.

---

## 0. Aviso de fonte — leia antes de confiar em qualquer linha da §2

> ⚠️ **As props de primitivo `urbi-*` foram conferidas contra o `main` do monorepo
> `C:\Users\raafa\urbiverso`, NÃO contra o SDK/shell publicado que a instância roda.**
>
> A fonte canônica normal (`node_modules/@urbiverso/sdk/dist/index.d.ts`) **não existe aqui**: o
> pacote instalado é um **stub** (só `express.d.ts`/`express.js`, sem `dist/` e sem `docs/`), e
> `npm view @urbiverso/sdk` dá `E401`. Não dá nem para perguntar ao registry o que está publicado.
>
> Uma prop pode existir no `main` e **não** na versão que a instância roda — isso produz um falso
> "está tudo certo". **Quantifiquei essa janela em vez de deixá-la como ressalva vaga:**
>
> | Fato | Evidência |
> |---|---|
> | `manifesto.json:4` declara `shell_min = "0.53.8"` | o piso do app |
> | O `manifesto.json` **não declara `sdk_min`** | o piso de capacidade do SDK fica implícito |
> | Monorepo `main` está em **0.53.11**, HEAD `7c57fbc5` (2026-08-21) | `urbiverso/package.json:3` |
> | O commit que cunhou 0.53.8 é `f9b17fe5` (2026-08-11) | `git log -S'"version": "0.53.8"' -- package.json` |
> | **Props adicionadas a `ui/src/` depois do 0.53.8:** 12 | `git diff f9b17fe5..HEAD -- ui/src/ \| grep '^+.*@property'` |
> | **Dessas 12, quantas o app usa:** **zero** | são de `urbi-avatar`, `urbi-changelog-release`, `urbi-3-colunas`, `urbi-input-score`, `urbi-badge[quebra-linha]` — nenhuma aparece em `frontend/` |
> | **Props REMOVIDAS depois do 0.53.8:** 2 | ambas substituições in-place (`natureza` de `urbi-avatar`, `corOn` de `urbi-input-score`) — nenhuma usada pelo app |
>
> **Conclusão honesta:** a janela `main` × publicado é real, mas para **este** app ela está vazia —
> nenhuma prop que o `frontend/` usa foi criada ou removida no intervalo 0.53.8→0.53.11. O veredito
> da §2 é seguro **para o piso declarado**. O que continua **não verificável daqui** é se a instância
> Pinguim de fato roda ≥ 0.53.8 (não há GET de versão de shell exposto pelas rotas da app).

Também não rodou, e o PR/consumidor deste documento precisa saber:

| Não executado | Motivo |
|---|---|
| `scripts/validar-backend.sh` | aborta na etapa 1/5, portão do SDK (stub) — **"não deu para rodar" nunca é "passou"** |
| Camada de contratos da revisão | lê `node_modules/@urbiverso/sdk/docs/`, inexistente |
| Medição tipográfica em navegador | sem browser; a §6, item 24, é veredito por construção CSS, não por pixel medido |

O que **rodou** e está verde: `node scripts/guard-json.mjs` (`schema.json`/`manifesto.json` são JSON
estrito) e a varredura de aspas curvas em três formas, incluindo duas que o guard oficial não pega
(§3.1).

---

## 1. Resumo executivo

| Frente | Achados | Gravidade máxima |
|---|---|---|
| (a) Props de primitivo `urbi-*` | **0 bugs reais** em 391 usos / 29 primitivos / ~1.100 atributos | — |
| (b) Falhas silenciosas | 5 (1 token inexistente, 1 paleta literal, 3 de formatação) | 🔴 alta |
| (c) Textos órfãos / rótulos / estados condicionais | 12 | 🔴 alta |
| Itens cosméticos 6/17/24 | vereditos na §6 | 🔴 (17) |

**Os três achados mais graves**, em ordem — todos da frente (c), e todos da mesma família:
**a tela afirma uma coisa e o dado é outra, sem que nada avise.**

1. 🔴 **Um rótulo, quatro números — "Margem líquida", "VGV" e "ROI" têm definições diferentes por
   tela** (§5.4). Três fontes de cálculo concorrentes (`proformaAvancado`, `calcularFluxo` inline,
   `calcularProforma`) alimentam 12 superfícies. O **Resumo** mede margem em regime de **caixa**
   sobre **VGV potencial** (`tela-resumo.ts:165`); a aba **Resultados** e o **painel de estudos**
   medem em **competência** sobre **Receita Bruta** (`proforma-avancado.ts:123`) — e essa segunda
   ainda carrega o bug de sinal que o A5 mediu (`:92-93` soma `linhasSaida` e nunca credita
   `linhasEntrada`). O estudo 5 mostra **−47,87%** na aba Resultados e margem **positiva** no
   Resumo, no mesmo instante, com o mesmo rótulo. **Consertar o sinal resolve metade: as duas
   definições continuariam divergindo.** A única superfície que rotula certo é a exportação do
   Avançado — "Receita Bruta — VGV" (`exportar.ts:433`).
2. 🔴 **Dois modais destroem dado ao serem reabertos, e os dois anunciam "sucesso"** (§4.1 e §5.5).
   O modal de **Pagamento** regenera `componentes` do formulário legado e zera `taxaMensal`
   (estudo 5 perde os juros de tabela de 12,5% a.a. já gravados — R$ 1.259.273,59, TIR de 18,59%
   para 17,53%); numa das linhas ele ainda **exibe um plano diferente do persistido** e grava o
   fabricado. O modal de **Absorção** força `modo: 'distribuido'` e apaga a curva personalizada de
   43 meses que existe no estudo 6 (VPL −R$ 360.591,41). **Nenhum dos dois tem aviso, confirmação
   ou undo** — os dois terminam com `notificar(…, 'sucesso')`.
3. 🔴 **Rótulos que mentem sobre o efeito do campo** — três casos independentes:
   `pos_obra.duracao_meses` é editável, sem cadeado, e o motor o **obedece para custo e descarta
   para vendas** (§5.3/C2): esticar a janela faz **vender menos**, e o estudo 6 perde 1,41% das
   vendas — R$ 2.007.856,95 — em silêncio. "Sujeito a RET" na aba Financeiro do Avançado
   (`tela-financeiro.ts:174`) **não é lido por nenhum motor do Avançado**; a caixa viva é outra,
   noutra aba (§5.1) — e **9 dos 10 controles daquela aba são inertes onde são editáveis**. E a
   mesma célula do Fluxo de Caixa sai com **0 casas na tela** e **2 no PDF** (§3.3/B4), contra o
   contrato C7 do `CLAUDE.md`.

---

## 2. Props de primitivo `urbi-*` — inexistentes ou não declaradas

### 2.1 Método

Extraí **mecanicamente**, não por amostragem:

- **Do monorepo:** os 70 `@customElement` de `C:\Users\raafa\urbiverso\ui\src\*.ts`, com
  `@property` **resolvidos pela cadeia de herança** (`UrbiGraficoLinha` → `UrbiGraficoBase` →
  `UrbiPrimitivoDeConteudo` → `LitElement`), respeitando `attribute: 'nome-kebab'` e
  `attribute: false`, mais os `CustomEvent` emitidos.
- **Do app:** um tokenizador de tags que consome valores citados e `${…}` de chaves balanceadas —
  necessário porque template literal do lit tem `=>`, `>` e `}` dentro de atributo. Cobertura
  conferida contra `grep -o "<urbi-[a-z0-9-]*"`: **391 tags = 391 tags**, cobertura total dos 15
  arquivos `frontend/*.ts` não-teste.

Além do nome, conferi a **forma de binding** contra o tipo declarado — a classe de bug mais
insidiosa e que o typecheck não pega:

| Erro procurado | Por que é silencioso | Achados |
|---|---|---|
| prop `attribute: false` passada como atributo simples | o atributo é **ignorado**; a prop fica no default | **0** |
| prop `type: Boolean` com atributo dinâmico (`attr=${x}` em vez de `?attr=${x}`) | `false` vira a string `"false"`, que é **truthy** | **0** |
| prop `type: Array`/`Object` como atributo | vira string, nunca o objeto | **0** |
| evento `@nome` que o primitivo não emite | listener nunca dispara | **0** (ver 2.3) |

### 2.2 Tabela dos 7 sinais brutos — e por que nenhum é bug

| arquivo:linha | elemento | atributo | Veredito |
|---|---|---|---|
| `frontend/tela-dashboard.ts:321` | `urbi-abas` | `expandir` | ✅ **inofensivo, mas redundante** — `urbi-abas` estende `UrbiPrimitivoDeLayout`, que **põe `expandir` sozinho** no `connectedCallback` (`urbiverso/ui/src/urbi-primitivo.ts:37-40`). Escrever à mão não muda nada; o opt-out seria `sem-expandir`. |
| `frontend/tela-dashboard.ts:532` | `urbi-tabela` | `expandir` | ✅ **correto** — não é `@property`, é **atributo de convenção** consumido por CSS: `:host([expandir]) .wrap` em `urbiverso/ui/src/urbi-tabela.ts:142`. |
| `frontend/tela-dashboard.ts:582` | `urbi-tabela` | `expandir` | ✅ idem |
| `frontend/tela-fluxo-custos.ts:465` | `urbi-tabela` | `expandir` | ✅ idem |
| `frontend/viabilidade-config-curvas.ts:78` | `urbi-tabela` | `expandir` | ✅ idem |
| `frontend/tela-estudo.ts:100` | `urbi-shell-page` | `@viab:terreno-alterado` | ✅ **correto** — evento **da app**, não do primitivo. Emitido em `frontend/tela-terreno-nucleo.ts:123` com `bubbles: true, composed: true`; o `urbi-shell-page` é só o ancestral onde o listener foi posto. |
| `frontend/tela-estudo.ts:101` | `urbi-shell-page` | `@viab:premissas-change` | ✅ idem — `frontend/tela-premissas.ts:409-411`, `bubbles: true, composed: true`. |

> **`expandir` merece uma nota de contrato.** Ele é um **atributo de convenção do design system**
> (documentado em `urbiverso/ui/src/urbi-primitivo-conteudo.ts:36-47`), não uma prop declarada. A
> regra "só as props que o primitivo declara" **não o alcança**, mas o risco correlato existe: usar
> `expandir` num primitivo que **não** tenha a regra `:host([expandir])` é falha 100% silenciosa.
> Os primitivos do monorepo que o honram são `urbi-card`, `urbi-data-table`, `urbi-grafico-base`,
> `urbi-inbox-lista`, `urbi-linha`, `urbi-lista`, `urbi-tabela` e todo `UrbiPrimitivoDeConteudo`.
> **Os 4 usos do app estão todos dentro dessa lista.**

### 2.3 Dois falsos positivos que valem registrar, para a próxima varredura não os reabrir

- `@urbi:seletor-arquivo-change` (3 usos: `tela-apelo.ts:97`, `tela-empreendimento-info.ts:172`,
  `viab-imagem-principal.ts:116`) **é emitido**, em
  `urbiverso/ui/src/urbi-seletor-arquivo.ts:279`. Uma varredura ingênua não o acha porque a chamada
  é `new CustomEvent<SeletorArquivoChange>('urbi:seletor-arquivo-change', …)` — o **parâmetro de
  tipo genérico** entre `CustomEvent` e o `(`. Qualquer regex `new CustomEvent\(` erra aqui.
- `urbi-modal maxWidth="…"` (17 usos) **funciona**: `urbiverso/ui/src/urbi-modal.ts:7` declara
  `@property() maxWidth`, e o lit derreteu o nome de atributo para `maxwidth` — que é
  exatamente o que o parser HTML produz ao ler `maxWidth=`. Não "corrija" para `max-width`: **essa**
  sim ficaria inerte.

### 2.4 Veredito da frente (a)

**Zero props inexistentes, zero props não declaradas, zero erros de forma de binding, zero eventos
mortos, em 391 usos.** É o resultado mais limpo desta auditoria e vale dizer por quê: 29 dos 89
primitivos são usados, e as props usadas são o núcleo estável (`variante`, `titulo`, `rotulo`,
`.valor`, `.opcoes`, `.colunas`, `.linhas`) — nada de superfície nova.

**O risco que sobra não está nas props, está no lado oposto: o app reimplementa primitivos.**

| Fork no app | Primitivo equivalente | Situação |
|---|---|---|
| `frontend/viab-num.ts` (`viab-num`, 210 l) | `urbi-input-numero` | **Motivo documentado e legítimo** (`viab-num.ts:5-13`): o primitivo usa `<input type="number">` e **não consegue** exibir separador de milhar pt-BR. O fork espelha a API e reemite `urbi:input-numero-change`. Consequência: **`urbi-input-numero` tem zero usos no app.** → texto pronto para o autor levar ao monorepo (§7, Q1). |
| `frontend/fluxo-tabela.ts:65-82` (`.kpi-card`) | `urbi-kpi` | Fork **por limitação real** (`fluxo-tabela.ts:56-64`): `urbi-kpi` não tem slot, então rótulo + valor + variação não cabem na mesma moldura. O CSS é cópia literal do `:host` do primitivo, fallbacks de cor inclusive. Ver §6, item 17 — este fork é a evidência de que o app **já concluiu uma vez** que a saída determinística era abandonar `urbi-kpi`. |

---

## 3. Falhas silenciosas de sintaxe e contrato

### 3.1 Aspas curvas — ✅ limpo, e o guard tem duas brechas

Varri em três formas, não só a do guard:

| Forma | Resultado |
|---|---|
| `=` seguido de aspa curva (o que `scripts/validar-frontend.sh:66` casa) | **0** |
| Aspa curva **dentro do valor** de um atributo já parseado (varredura pelo tokenizador de tags) | 2 ocorrências, **ambas legítimas** — texto entre aspas retas com tipografia curva no meio: `tela-cenarios.ts:503` e `tela-dashboard.ts:538` |
| Aspa curva em **conteúdo de texto** | 15 linhas, **todas tipografia legítima** |

**Brechas do guard `grep -rn '=\(”\|“\|‘\|’\)' frontend/`, hoje sem ocorrência mas sem rede:**

1. **Espaço entre `=` e a aspa** — `variante = ”alerta”` não casa. HTML permite o espaço.
2. **Aspa mista** — `variante="alerta”` (reta abrindo, curva fechando) não casa, e é a variante
   **mais perigosa**: o parser lê até a próxima aspa reta, engolindo os atributos seguintes.
   Verifiquei explicitamente e o repo está limpo, mas o guard não protege esse caso.

→ §7, Q2.

### 3.2 Cores literais e tokens CSS — 2 achados

**Achado B1 🟡 — `--cor-superficie-2` não existe em lugar nenhum do shell.**

`frontend/tela-dashboard.ts:131` e `:135`:

```css
background: var(--cor-superficie-2, rgba(255,255,255,0.06));
```

Cruzei os 21 tokens `var(--…)` que o app usa contra os definidos em
`urbiverso/compartilhado/tokens.css`. **20 existem. `--cor-superficie-2` não** — nem em `tokens.css`,
nem em nenhum `.ts`/`.css` do monorepo inteiro. O que existe é `--cor-superficie`,
`--cor-superficie-sutil`, `--cor-superficie-elevada`, `--cor-superficie-hover`.

Consequência: o fallback literal `rgba(255,255,255,0.06)` é a cor **efetiva, sempre**. É branco
translúcido — desenhado para tema escuro. Em **2026-08-19** o shell ganhou os temas **sépia e
cyberpunk** (`urbiverso` @ `043f652e`) e mantém tema claro; nesses, branco a 6% sobre fundo claro
some. É exatamente a falha silenciosa do contrato "tokens do design system, nunca cor literal" — só
que disfarçada de token.

**Achado B2 🟡 — paleta categórica literal fora da exceção de impressão.**

`frontend/tela-graficos.ts:13-16`:

```ts
const PALETA_CUSTOS = [
  '#2AA9E0', '#13A98D', '#F7A111', '#D45A3A', '#8E7CC3', '#5BAF7A',
  '#E0699B', '#7FB3D5', '#C0A16B', '#59C3C3', '#B57EDC', '#9AA5B1',
];
```

Usada em `:112` para colorir as fatias da pizza de custos. **12 cores literais, sem token, sem
fallback** — e isto **não** é `frontend/exportar.ts`, então a exceção do `CLAUDE.md` não cobre. O
comentário de `:11-12` justifica com "mais que os 6 da paleta padrão do gráfico"; o shell hoje expõe
**8** tokens categóricos (`--cor-categoria-1` … `--cor-categoria-8`) mais `--cor-escala-1..4` e
`--cor-escala-neutra`, todos theme-aware. A pizza de custos é o único gráfico do app que não segue o
tema.

**Verificado e limpo:** zero cores literais em qualquer propriedade CSS fora de `exportar.ts` — todas
as 200+ ocorrências de `#hex`/`rgba()` em `frontend/*.ts` estão na forma `var(--token, fallback)`,
que é o padrão dos próprios primitivos. As séries de gráfico passam `cor: 'var(--cor-…, #…)'`
(`fluxo-graficos.ts:18-24`, `tela-cenarios.ts:329-330`, `tela-fluxo-custos.ts:590-591,625`,
`tela-graficos.ts:111`) — corretas. O CSS de impressão de `exportar.ts` é a exceção legítima e **não
foi acusado**.

### 3.3 Formatação monetária — o mapa completo, e onde tela e exportação divergem

> ✅ **Correção ao dossiê, confirmada por mim.** `frontend/exportar.ts:10` **não** define mais
> `const R$ = v.toFixed(2)`. A linha hoje é
> `import { fmtR$, fmtNum, fmtPct } from './viab-format.js';`. A duplicação que a #281 mirava
> **acabou** — nesse ponto.
>
> 🔴 **Mas o `CLAUDE.md:471-477` continua afirmando que ela existe**, palavra por palavra. É a
> segunda vez que essa nota fica vencida (a primeira dizia que `fmtR$` usava
> `maximumFractionDigits: 0`, e a triagem de 2026-08-03 a corrigiu). **Achado próprio, §7 Q3.**

Mapa de **todos** os pontos de formatação de número do app:

| Ponto | `arquivo:linha` | Regra | Onde aparece |
|---|---|---|---|
| `fmtR$` | `viab-format.ts:13-23` | Intl pt-BR, **min=max=2** casas | canônico — tela e exportação |
| `fmtNum` | `viab-format.ts:24-25` | Intl, **só `maximumFractionDigits`** | 🔴 ver B3 |
| `fmtM2` | `viab-format.ts:32-36` | 2 casas + `m²`, `null` → `—` | correto |
| `fmtPct` | `viab-format.ts:38-39` | 1 casa + `%` (valor calculado) | correto |
| `fmtPctEntrada` | `viab-format.ts:42-43` | 2 casas + `%` (valor digitado) | correto |
| `celula` | `fluxo-tabela.ts:33-39` | 🔴 `Math.round` → **0 casas**; vazio se `< 0,5` | **tela** do Fluxo de Caixa |
| `celulaFx` | `exportar.ts:167-174` | `fmtR$(…, false)` → **2 casas**; vazio se `< 0,005` | **PDF e CSV** do mesmo fluxo |
| `pct1` | `exportar.ts:14` | `toFixed(1)` + vírgula, **sem separador de milhar** | só exportação |
| `abreviar` | `fluxo-graficos.ts:40-41` | `R$ x,yB` / `R$ x,yM` | eixo de gráfico — legítimo |
| `viab-num` | `viab-num.ts:105-120` | máscara pt-BR de **entrada** | legítimo |
| ad-hoc | `tela-fluxo-receitas.ts:367,585,814` | `toLocaleString` inline | ver B5 |

**Achado B3 🔴 — `fmtNum(v, 2)` promete 2 casas e não entrega.**

```ts
// viab-format.ts:24-25
export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);
```

Sem `minimumFractionDigits`, `fmtNum(21230000, 2)` devolve `21.230.000`, não `21.230.000,00`.

O chamador que mais dói é `frontend/tela-proforma.ts:453`:

```ts
// BUG7-12: sem símbolo "R$" — número puro com 2 casas decimais.
const fmt = (m: { pct?: boolean }, v: number) => (m.pct ? fmtPct(v) : fmtNum(v, 2));
```

**O comentário declara o contrato que o código não cumpre.** Vale para as 6 linhas monetárias da
tabela Bear/Base/Bull (`:441-447`: VGV, Receita bruta, Receita líquida, Custo direto total, Receita
operacional, Custo indireto total, Resultado). Números redondos saem com 0 casas e os quebrados com
2 — **casas decimais irregulares dentro da mesma coluna**, que é justamente o que o item 11 da lista
pediu para arrumar. Os outros dois chamadores (`tela-premissas.ts:924-925`, área em m² e ha) são
grandeza não monetária, onde o contrato admite arredondar só para exibir.

**Achado B4 🔴 — a mesma célula do Fluxo de Caixa tem duas implementações que discordam.**

| | tela — `fluxo-tabela.ts:34-38` | exportação — `exportar.ts:167-174` |
|---|---|---|
| decimais | `Math.round(Math.abs(v))` → **0** | `fmtR$(Math.abs(v), false)` → **2** |
| limiar de célula vazia | `Math.abs(v) < 0.5` | `Math.abs(v) < 0.005` |
| percentual | não trata (célula só monetária) | `pct1(v*100)` |

Efeitos concretos:

- **R$ 1.234,56** → `1.235` na tela, `1.234,56` no PDF/CSV.
- **R$ 0,20** → **célula em branco** na tela, `0,20` no PDF/CSV. O usuário vê a exportação inventar
  linhas que a tela nega.
- O contrato C7 do `CLAUDE.md` diz "todo valor monetário resultado de fórmula tem 2 casas decimais —
  **na apresentação**, na entrada e no motor". A tela do Fluxo de Caixa — a peça central do Avançado
  — não cumpre.

A ironia é que `exportar.ts:162-165` documenta a função como *"Fonte ÚNICA para CSV e PDF: as duas
exportações têm de mostrar o mesmo texto"*. Verdade para as duas exportações; **esqueceu a tela**.
Ou seja: a #281 não foi resolvida, foi **mudada de endereço** — o duplicado de formatação hoje é
`fluxo-tabela.ts`, não `exportar.ts`.

**Achado B5 🟡 — dois formatadores de percentual e três `toLocaleString` inline.**

`pct1` (`exportar.ts:14`) usa `toFixed(1)`, **sem separador de milhar**; `fmtPct`
(`viab-format.ts:38`) usa Intl, **com**. Para `1234.5%` a exportação escreve `1234,5` e a tela
`1.234,5%`. Percentual de quatro dígitos é raro mas existe (ROI de estudo alavancado). E três pontos
montam formatação à mão em vez de chamar o módulo: `tela-fluxo-receitas.ts:367` (m² — deveria ser
`fmtM2`), `:585` e `:814` (% derivado — deveria ser `fmtPct`/`fmtPctEntrada`).

---

## 4. Textos órfãos e rótulos errados

### 4.1 🔴 O modal de pagamento apaga dado que ele mesmo nunca mostrou

Não é texto, mas nasce de um texto que mente e é o achado mais caro desta auditoria — fica aqui
porque a UI é a causa.

**A cadeia, com diff:**

1. `frontend/tela-fluxo-receitas.ts:843` — `_aplicarPagamento` chama
   `fluxoPagamentoParaSalvar(this.pagForm, this.crono)`.
2. `frontend/fluxo-pagamento-editor.ts:88-90` — essa função grava
   `componentes: componentesDoLegado(form, cronograma)`, **regenerando** os componentes a partir do
   formulário legado.
3. `frontend/fluxo-caixa-motor.ts:589, 601, 608, 617` — `componentesDoLegado` fixa
   **`taxaMensal: 0`** e **`sinalPct: 0`** em **todos** os quatro ramos, e reescreve o `rotulo` para
   `'entrada (legado)'` / `'ao longo da obra (legado)'` / `'repasse (legado)'`.
4. `frontend/fluxo-pagamento-editor.ts:28-42` — `formularioPagamento`, que **abre** o modal, lê
   `comissao/ret/entrada/parcelas/repasse` e **nunca lê `fp.componentes`**.
5. `frontend/tela-fluxo-receitas.ts:741-816` — o modal **não tem campo de taxa de juros nem de
   sinal**. As três seções são "Condições de entrada", "Parcelamento" e "Repasse".

**Prova em dado real (`GET /estudos/5/avancado/receitas`)** — linha `Tabela curta (10%)`:

```json
"componentes": [
  { "tipo": "imediato",  "rotulo": "Sinal 15%", "participacaoPct": 15, "descontoPct": 0 },
  { "tipo": "ate_marco", "rotulo": "Tabela curta - parcelas ate a entrega, juros 12,5% a.a.",
    "marcoMes": 38, "sinalPct": 0, "taxaMensal": 0.0098636,
    "defasagemMeses": 1, "participacaoPct": 85, "jurosNoMesDaContratacao": false }
]
```

Abrir esse modal e clicar em **Aplicar — sem alterar nada** — grava
`{ tipo:'ate_marco', participacaoPct:85, sinalPct:0, marcoMes:38, defasagemMeses:1, taxaMensal:0,
rotulo:'ao longo da obra (legado)' }`. **A taxa de 12,5% a.a. some, o rótulo escrito pelo usuário
some, `jurosClientes` cai a zero e a Receita Bruta cai junto.** Sem erro, sem confirmação, sem
diferença visível no modal antes e depois.

**Pior, na linha `Tabela longa (80%)` do mesmo estudo:** o persistido é `entrada: []` +
`componentes: [ate_marco 30%, concentrado 70% no mês 39]`. Mas `formularioPagamento:37` substitui
lista vazia por um **default fabricado**:

```ts
entrada: entradas.length ? entradas : [{ pct: 15, parcelas: 1, descontoPct: 0 }],
```

Logo o modal **exibe** uma entrada de 15% que não existe no dado; a validação
(`erroFormularioPagamento:66-73`) fecha em 100% porque o repasse derivado
(`pctRepasseDerivado`, `fluxo-caixa-motor.ts:487-491`) vira 55%; e "Aplicar" grava **15/30/55** no
lugar de **0/30/70**. **15 pontos percentuais de plano de pagamento trocados de bolso, em silêncio.**

**Não há aviso, confirmação nem undo em nenhum ponto desse caminho** — a §5.5 traz a
comparação lado a lado com o modal de Absorção, que sofre do mesmo mecanismo. O caminho termina em
`urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso')` (`tela-fluxo-receitas.ts:848`).

Isso reposiciona a lacuna 1 da §4.5 do dossiê: não é só que "juros de tabela nunca chegam a existir"
— é que **quando existem, a UI os destrói ao ser aberta**. O dossiê presumia que só a escrita nova
zerava; o dado da instância prova que há escrita **de outra origem** que os cria, e que o modal é um
triturador.

### 4.2 🟡 Resíduos de conceito morto — o inventário completo

Varri `capital.?stack`, `waterfall`, `preferred.?equity`, `prioridade_pagamento`,
`prioridade de pagamento` e `capital_giro` em `frontend/`, `backend/`, `schema.json` e `migracoes/`.
Separei **o que o usuário vê** do que é comentário — a distinção que o dossiê não fazia.

**Visível ao usuário — 3 ocorrências:**

| `arquivo:linha` | Texto | Problema |
|---|---|---|
| `frontend/tela-fluxo-ver.ts:295` | "Este estudo não tem camadas de **Capital Stack**: sem funding, o Fluxo de Caixa real é igual ao Livre." | Conceito **apagado** pela reescrita do item 48. Hoje chama-se **Funding**, e são operações, não camadas. |
| `frontend/tela-fluxo-ver.ts:294` | "…leem o Fluxo de Caixa Livre (**funding-capital-stack.md §8.1**, para manter comparabilidade…)" | Cita um **arquivo interno do repo** — que é ADR histórico — no corpo do texto da tela. |
| `frontend/tela-fluxo-receitas.ts:810` | "…é pago de uma vez, sempre no 1º mês após o fim da obra **(#345)**." | **Número de issue** em texto de ajuda visível. |

**Visível como tooltip nativo (`title=`) — 2 ocorrências:**

| `arquivo:linha` | Texto |
|---|---|
| `frontend/tela-fluxo-custos.ts:766` | "…não segue curva nem evento próprio **(#238)**" |
| `frontend/tela-fluxo-custos.ts:774` | "…disponível para auditoria **(#238)**" |

**Comentário de código — 12 ocorrências, sem impacto de UI e com valor histórico:**
`fluxo-invariantes.ts:326-336`, `fluxo-shared.ts:552`, `fluxo-tabela.ts:633`,
`funding-motor.ts:7,10,154,295,650`, `proforma-avancado.ts:67`, `tela-avancado.ts:94`,
`tela-financeiro.ts:13,22,51,52`, `tela-fluxo-ver.ts:55,56,63`, `tela-funding.ts:25,26,27,146,612`,
`viabilidade-api.ts:257`, `backend/rotas/funding.ts:9`. **Não recomendo apagar** — são o registro de
por que o modelo mudou.

> ✅ **Correção ao dossiê, confirmada.** `frontend/tela-financeiro.ts:13,22` é **bloco de comentário
> de cabeçalho** (`:8-30`), não render. Ele lista os 9 controles que a #279 **removeu** da tela. O
> dossiê os citava como se fossem texto órfão de UI. **Não são.**

**Achado C1 🟡 — o resíduo estrutural que ninguém citou: `schema.json:380-394`.**

A tabela **`avancado_capital_instrumentos` continua declarada no schema**, com a taxonomia inteira do
modelo morto:

```json
"tipo": { "opcoes": ["financiamento_producao", "capital_giro", "preferred_equity", "sponsor_equity"] },
"prioridade_funding":   { "tipo": "inteiro", "padrao": 0 },
"prioridade_pagamento": { "tipo": "inteiro", "padrao": 0 },
"status": { "opcoes": ["rascunho", "ativo", "encerrado", "revisao_necessaria"] }
```

**Nenhum arquivo de runtime a lê.** As únicas referências são migrações:
`migracoes/019_capital_stack_camadas.js` (que a criou), `028_financiamento_producao_retroativo.js` e
`029_funding_operacoes.js:88` (que migra **para fora** dela, para
`avancado_funding_operacoes`). O modelo vivo é `backend/rotas/funding.ts`, cujos tipos aceitos são
`['financiamento_producao','divida','equity']` (`:43`).

Enquanto ela estiver no `schema.json`, **o shell continua provisionando a tabela em toda instância**,
com colunas que descrevem um modelo que não existe mais — inclusive `prioridade_pagamento`, que a
§13.4 do ADR registra como "nunca lida/editável" desde antes da reescrita.

> 🔁 **Nota para o A3, via barramento.** O A3 propõe reintroduzir capital de giro como um tipo
> `linha_credito`. **Nem todo esse resíduo é lixo:** `avancado_capital_instrumentos` já tem
> `tipo: 'capital_giro'`, `compromisso decimal(15,2)`, `config json` e `origem_legado`. Se houver
> instância de produção com linhas `capital_giro` gravadas pela migração `019`, elas ainda estão
> **lá dentro** — a `029` migra `financiamento_producao`, e é preciso conferir o que ela faz com os
> outros três tipos antes de qualquer `remover_colunas`. **A decisão de apagar a tabela deve esperar
> a decisão do A3**, e a issue precisa dizer isso. → §7, Q4.

### 4.3 🟡 Rótulos que não batem com o que o campo faz

| `arquivo:linha` | Rótulo exibido | O que o campo faz de verdade |
|---|---|---|
| `frontend/tela-financeiro.ts:174` | "Sujeito a RET (patrimônio de afetação)" | Grava `sujeito_ret`, **lido só por `proforma.ts:245`**, que é a proforma do **Preliminar**. Esta tela só renderiza no **Avançado** (`:155`). Ver §5.1. |
| `frontend/tela-financeiro.ts:187` | "Regime tributário" | `regime_tributario` — **zero leitores** em qualquer motor. Única menção é o comentário `fluxo-shared.ts:211`. |
| `frontend/tela-financeiro.ts:181` | "Tributar permuta física" | `imposto_sobre_permuta_fisica` — **zero leitores**. |
| `frontend/tela-financeiro.ts:188` vs `frontend/tela-premissas.ts:154` | "Imposto s/ vendas (se não RET)" vs "Imposto (se não RET)" | **Mesmo campo** (`imposto_percentual`), **dois rótulos diferentes**, em duas telas. |
| `frontend/tela-fluxo-custos.ts:497` vs `frontend/tela-financeiro.ts:174` | "RET (Regime Especial de Tributação — patrimônio de afetação)" vs "Sujeito a RET (patrimônio de afetação)" | Dois checkboxes, dois campos (`considerar_ret` × `sujeito_ret`), **um vivo e um morto**, no mesmo estudo Avançado. |

**Unidades:** conferi R$ × m² × % × R$/m² em todas as telas. **Nenhuma unidade errada encontrada.**
`fmtM2` está aplicado onde deve; `fmtPct` (calculado, 1 casa) e `fmtPctEntrada` (digitado, 2 casas)
respeitam a taxonomia. O único desvio de unidade é o de *precisão*, não de grandeza (§3.3).

---

## 5. Estados condicionais — o que os dados reais de fato exercitam

Base: os 6 estudos de Pinguim, lidos por `GET` (nenhuma escrita emitida). **Todos os 6 são
`incorporacao`, `status: rascunho`, `origem_terreno: manual`, `uf: DF`, autor `id 10`.** Quatro
`preliminar` (1–4) e dois `avancado` (5, 6).

### 5.1 🔴 A aba Financeiro do Avançado: 9 de 10 controles não fazem nada ali

Cruzei cada controle renderizado em `frontend/tela-financeiro.ts:154-197` com quem o lê nos motores
(`fluxo-caixa-motor.ts`, `fluxo-shared.ts`, `proforma.ts`, `proforma-avancado.ts`,
`funding-motor.ts`, `fluxo-invariantes.ts`):

| # | Controle | `arquivo:linha` do render | Lido por | Efeito no Avançado |
|---|---|---|---|---|
| 1 | `taxa_desconto_aa` | `:166` | `tela-fluxo-ver.ts:120,139` → `FluxoConfig.taxaDescontoAa` | ✅ **vivo** |
| 2 | `sujeito_ret` | `:172-178` | `proforma.ts:245` (**Preliminar**) | 🔴 inerte |
| 3 | `imposto_sobre_permuta_fisica` | `:179-184` | **ninguém** | 🔴 inerte |
| 4 | `regime_tributario` | `:187` | **ninguém** (só comentário) | 🔴 inerte |
| 5 | `imposto_percentual` | `:188` | `proforma.ts:245` (**Preliminar**) | 🔴 inerte |
| 6 | `aliquota_pis_pct` | `:189` | **ninguém** | 🔴 inerte |
| 7 | `aliquota_cofins_pct` | `:190` | **ninguém** | 🔴 inerte |
| 8 | `aliquota_csll_pct` | `:191` | **ninguém** | 🔴 inerte |
| 9 | `aliquota_irpj_pct` | `:192` | **ninguém** | 🔴 inerte |
| 10 | `aliquota_itbi_pct` | `:193` | **ninguém** | 🔴 inerte |

> **Precisão pedida pelo barramento.** O A4 contou **7** (`regime_tributario` + 5 × `aliquota_*` +
> `imposto_sobre_permuta_fisica`). **Confirmo os 7 como inertes em TODO o app.** Acrescento **2**
> que são inertes **onde são editáveis**: `sujeito_ret` e `imposto_percentual` só têm leitor na
> proforma do Preliminar, e `tela-financeiro.ts:155` faz `return html\`${nothing}\`` quando
> `nivel_analise !== 'avancado'`. Total: **7 globalmente inertes, 9 inertes em contexto, de 10**.
> A documentação que fala em "~25" está contando as colunas do schema, não os controles da tela.

**Dado real confirma que a divergência já está gravada:** os 4 Preliminares têm
`sujeito_ret: true` **e** `considerar_ret: false`; os 2 Avançados têm ambos `true`. O par 2↔5 é o
mesmo empreendimento ("PU 1 Ideia 1") em dois níveis, e os dois campos de RET **divergem** entre eles
sem que nada na UI diga que são campos diferentes.

E `regime_tributario: 'ret'` está gravado nos 6, com **todas** as `aliquota_*` em `0.00`: o regime
não-RET nunca foi exercitado por dado real, e não teria efeito se fosse.

### 5.2 Estados que NUNCA ocorrem com dado real — onde bug se esconde

| Estado condicional | Guarda no código | Dado real | Consequência |
|---|---|---|---|
| **Loteamento** (todo o ramo) | `tipo_empreendimento === 'loteamento'` em **13 lugares**: `tela-empreendimento-tipologias.ts:135`, `tela-fluxo-receitas.ts:312`, `tela-graficos.ts:50`, `tela-premissas.ts:439,491`, `tela-proforma.ts:175,223,529`, `tela-terreno-nucleo.ts:63`, `proforma.ts:164,372`, `premissas-validacao.ts:26,67` | **0 de 6** estudos | Metade da taxonomia do app **nunca é executada na instância**. Colunas correlatas todas `null` nos 6: `preco_venda_m2`, `num_unidades`, `area_media_lote_m2`. |
| **Terreno do núcleo** (integração `imoveis`) | `origem_terreno === 'nucleo'` — `tela-empreendimento-info.ts:182,267`, `tela-premissas.ts:513,866` | **0 de 6** (todos `manual`) | `area_terreno_nucleo` é `null` nos 6; a montagem do `FluxoConfig` cai sempre no `terreno_manual_area`. A dependência de núcleo declarada em `manifesto.json` (`dependencias_nucleo: ["imoveis"]`) nunca é exercida. |
| **Catálogo de produtos do Preliminar** | `e.produtos && e.produtos.length > 0` — `proforma.ts:232`; `this.produtos.length === 0` — `tela-premissas.ts:735` | `GET /estudos/N/preliminar/produtos` devolve **`total: 0` nos 6** | O dossiê chama produtos de "**fonte de VGV quando não-vazio**". **Nunca é não-vazio.** O ramo `produtosTotal !== null` de `proforma.ts` é código sem cobertura de dado real. |
| **Cenários salvos** | `GET /estudos/{5,6}/avancado/cenarios` | **`total: 0` nos dois** | Só o estado vazio de `tela-cenarios.ts:502` é exercido. A tabela de cenários (`:298-330`) e o comparativo de duas séries nunca renderizam com dado real. |
| **Fases de cronograma** | `GET /estudos/{5,6}/avancado/fases?tipo=cronograma` | **`total: 0`** | `fase_ancora_id` é `null` em **todas** as 4 operações de funding, e `custo_linha_ids` idem. A ancoragem por fase — o mecanismo mais sofisticado do funding — **nunca foi usada**. |
| **Permuta física** | `unidades_permutadas > 0`; `permuta_fisica_quantidade`; `permuta_fisica_produto_id` | `unidades_permutadas: 0` nas **4 tipologias**; `permuta_fisica_produto_id: null` nos 6; `permuta_fisica_quantidade: 0` nos 6 | Confirma a lacuna já conhecida (`unidades_permutadas` nunca chega em `calcularFluxo`): **nem o dado existe**. A redução de VGV por permuta física é código morto **e** sem dado. Curiosamente, os 4 Preliminares têm `permuta_fisica_pct: 18.00` com `modo: 'pct_area_venda'` — e os 2 Avançados, que são o mesmo empreendimento, têm `modo: 'area_m2'` com `area_m2: null` e `pct: null`. **A conversão Preliminar → Avançado perdeu os 18%.** |
| **Correção monetária** | `indice_correcao` | `'nenhum'` nos **6**, `indice_correcao_taxa_aa: 0.00` nos 6 | Casa com a lacuna 3 do dossiê (persistido, zero leitura no motor) — e nem o dado exercita. |
| **Estrutura de capital legada** | `estrutura_*_pct`, `financiamento_*`, `investidor_*`, `taxa_*`, `juros_*` (17 colunas) | **`0.00` / `0` nos 6, sem exceção** | São as colunas que a #279 tirou da tela e deixou no schema. Confirmado: nada as preenche. |
| **Análise de mercado por região** | `regiao_mercado_id` | `null` nos 6 | Toda a cadeia `mercado_regioes`/`mercado_coletas` sem dado. |
| **Sensibilidade personalizada** | `sensibilidade_variacao_positiva_pct` / `_negativa_pct` | `null` nos 6 | A tela de sensibilidade roda sempre no default. |
| **Status ≠ rascunho** | `_renderAcoesStatus(p, st)` — `tela-estudo.ts:104` | `rascunho` nos 6 | Os ramos de "Em análise", "Aprovado", "Reprovado", "Arquivado" e as ações de aprovador **não têm nenhum estudo para exercê-los**. `_permissao.podeEditar` é sempre `true`. |

### 5.3 Estados que ocorrem e mostram algo estranho

**C2 🔴 — `pos_obra.duracao_meses` é um campo com DOIS significados: um obedecido e um sobrescrito em silêncio. Esticar a janela faz vender MENOS.**

`GET /estudos/5/avancado/cronograma` → `pos_obra.duracao_meses: 12`;
`GET /estudos/6/…` → **`13`**. Os dois vêm com `travado_duracao: false`, e a tela desabilita o campo
só quando essa flag é `true` (`tela-fluxo-cronograma.ts:269,276`) — logo o campo aparece **editável,
sem cadeado**, na linha rotulada **"Pós-obras"** (`fluxo-shared.ts:128`).

**O detalhe que muda o veredito, e que não estava no dossiê:** o campo não é ignorado — ele é
**parcialmente** ignorado, e o comentário de `fluxo-shared.ts:229-232` diz qual metade:

> *"…não campo editável. Antes a duração vinha de `pos_obra.duracao_meses` … Editar essa duração no
> Cronograma não muda mais a absorção — **só as âncoras de custo continuam livres**, com a duração
> que já tinham."*

| Consumidor de `pos_obra.duracao_meses` | Comportamento |
|---|---|
| **Janela de absorção** (`fluxo-shared.ts:281`) | 🔴 **descartado** — `fim = inicio_mes + APOS_CHAVES_MESES − 1`, com `APOS_CHAVES_MESES = 12` fixo (`:237`) |
| **Ancoragem de custo** (linhas ancoradas em `pos_obra`) | ✅ **obedecido** — a duração real vale |

**Um único campo, um único rótulo, dois destinos opostos.** O usuário que estica a fase para 13
meses esperando vender por mais tempo consegue exatamente o contrário: a janela de vendas continua
com 12 meses, e o percentual que sobrava para o 13º **não é redistribuído — some**.

**Custo medido pelo A5 nos dados reais:** o estudo 6 **descarta 1,41% das vendas — R$ 2.007.856,95 —
em silêncio**, e nenhuma tela reporta a perda. Não há aviso, não há cadeado, não há nota de rodapé;
o `erroFormularioAbsorcao` (`fluxo-shared.ts:337-345`) tampouco olha para isso, porque só valida a
soma dos três primeiros blocos.

Note o contraste dentro da própria tela: ela **tem** o vocabulário para dizer isso — o cadeado 🔒 com
`title="Calculado automaticamente"` (`tela-fluxo-cronograma.ts:269`) existe e é usado nos campos que
o backend trava. **`pos_obra.duracao_meses` é o único campo do Cronograma que o motor sobrescreve
sem que a tela avise.** A correção mínima de UI é honesta e barata: manter o campo editável (as
âncoras de custo precisam dele) e **anotar ao lado que a janela de vendas é fixa em 12 meses**,
ou — melhor — passar a respeitar a duração também na absorção, que é a decisão do autor, não minha.

**C3 🟡 — o usuário nomeou uma `divida` de "Capital de giro" nos dois estudos.**
`GET /estudos/{5,6}/avancado/funding`:

```json
{ "tipo": "divida", "nome": "Capital de giro", "valor": "10000000.00",
  "taxa_anual": "14.00", "periodo_carencia_meses": 12, "periodo_amortizacao_meses": 36,
  "modo_retorno": "permuta_financeira", "pct_retorno": "0.00" }
```

É **evidência de campo** para a lacuna 2 do dossiê (capital de giro ausente do modelo, e
`capital_giro` explicitamente rejeitado em `backend/rotas/funding.test.ts:26`): o usuário está
**emulando** o conceito faltante com o tipo genérico `divida`, e a UI não tem como distinguir. Isso
reforça a proposta do A3 e dá um teste de aceite pronto.

**C4 🟡 — `modo_retorno: "permuta_financeira"` num `financiamento_producao` e numa `divida`.**
Nas **4** operações, incluindo as duas de `financiamento_producao` que têm `valor: "0.00"` e
`pct_retorno: "0.00"`. Ou o campo é irrelevante para esses dois tipos e a UI deveria escondê-lo, ou
é um default persistido que aparece na tela como se fosse escolha do usuário. Não consigo decidir
daqui sem ver a tela; é o candidato mais forte a **rótulo que não bate com o que o campo faz** entre
os que não pude fechar. → §7, Q5.

**C5 🟡 — `financiamento_producao` com `valor: "0.00"` nos dois estudos.**
Com `percentual_financiavel: 80.00` e `exposicao_minima: 20.00`. Se a tela exibe uma coluna "Valor"
mostrando `R$ 0,00` para uma operação que o motor deriva de percentuais, o número é enganoso.
Mesma família de dúvida de C4.

**C6 🟡 — a soma de absorção fecha em 35%, e nada avisa.**
Todas as 3 linhas de receita do estudo 5 têm
`blocos: [pre_lancamento 0%, lancamento 15%, obra 20%, pos_obra 0%]` — **soma 35%**.
`erroFormularioAbsorcao` (`fluxo-shared.ts:337-345`) só barra soma **acima** de 100%; abaixo é
silêncio, e o restante escorre para `pctPosObraDerivado`. O comentário `:330-335` explica que o
clamp silencioso já mordeu uma vez na direção oposta. **Cada linha vende 35% do seu estoque nas
janelas nomeadas e 65% no pós-obra derivado** — pode ser intencional (o pós-obra absorve o resto),
mas a tela não mostra o total nem o derivado. → §7, Q6.

**C7 🟡 — `fluxo_pagamento.ret` sobrevive por linha depois da RET virar global.**
As 3 linhas do estudo 5 trazem `"ret": { "pct": 4, "ativo": false }` enquanto o estudo tem
`considerar_ret: true, ret_pct: 4`. A #346 tornou o RET global
(`fluxo-caixa-motor.ts:173`), o modal já diz "RET: controle global do estudo, em Custos → Financeiro"
(`tela-fluxo-receitas.ts:736`), mas `formularioPagamento:36` continua **lendo e regravando** o
sub-objeto morto. É passagem inofensiva hoje; é armadilha para quem abrir o JSON e acreditar nele.

---

### 5.4 🔴 O mesmo rótulo, quatro números — mapa das superfícies que exibem VGV, Resultado, Margem e ROI

> **Origem:** o A5 mediu, contra Pinguim, **4 margens líquidas e 3 resultados distintos para o mesmo
> estudo**, causados por `frontend/proforma-avancado.ts:92-93` somar todo o `funding.linhasSaida` ao
> custo do grupo `financeiro` sem nunca creditar as `linhasEntrada`. **O cálculo é dele.** O que
> segue é a auditoria de **apresentação**: quantas superfícies exibem esses indicadores, de qual
> função cada uma bebe, e por que a divergência é maior do que uma função errada.

**A conclusão, antes da tabela: o bug de sinal do funding não é a única causa da divergência — nem a
principal. Há TRÊS definições concorrentes de "Margem líquida" e DUAS de "VGV" convivendo, e elas
divergiriam entre si mesmo se `proforma-avancado.ts` estivesse perfeito.**

#### Mapa completo — 12 superfícies

| # | Superfície | `arquivo:linha` | Função-fonte | VGV (denominador) | Resultado (numerador) |
|---|---|---|---|---|---|
| 1 | **Resultados → Proforma** (Avançado) | `tela-fluxo-ver.ts:232` | **`proformaAvancado`** | `c.receitaBruta` — **grandeza 6** | `receitaLiquida − custoDireto − custoIndireto`, funding **só pela saída** 🔴 |
| 2 | **Painel de estudos** — colunas VGV/Margem/ROI (Avançado) | `tela-dashboard.ts:273,286-291,404-406` | **`proformaAvancado`** | idem #1 | idem #1 🔴 |
| 3 | **Painel de estudos** — mesmas colunas (Preliminar) | `tela-dashboard.ts:74-86` | **`calcularProforma`** | `proforma.ts:309` — VGV de campos fixos | `proforma.ts:346` |
| 4 | **Resumo** (Avançado) — KPIs VGV / Resultado / Margem líquida / ROI | `tela-resumo.ts:114,159-166,181-184` | **`calcularFluxo` direto, conta inline** | `c.vgvTotal` — **grandeza 1** 🔴 | `c.fluxoAcumulado[last]` — **caixa acumulado** 🔴 |
| 5 | **Resumo** — medidores vs. benchmark | `tela-resumo.ts:249-255` | idem #4 | idem #4 | idem #4 |
| 6 | **Proforma** (Preliminar) — KPIs | `tela-proforma.ts:176,213` | **`calcularProforma`** | idem #3 | idem #3 |
| 7 | **Proforma** (Preliminar) — Bear/Base/Bull | `tela-proforma.ts:432,450` | **`calcularProforma`** ×3 | idem #3 | idem #3 |
| 8 | **Premissas** (Preliminar) — KPIs | `tela-premissas.ts:438,975,988,999` | **`calcularProforma`** | idem #3 | idem #3 |
| 9 | **Gráficos** (Preliminar) — medidores | `tela-graficos.ts:51,196` | **`calcularProforma`** | idem #3 | idem #3 |
| 10 | **Exportação PDF/CSV do Preliminar** | `exportar.ts:68,85,80,94-95,113` ← `tela-proforma.ts:7` | **`calcularProforma`** (recebe o `Proforma` pronto) | idem #3 | idem #3 |
| 11 | **Exportação PDF/CSV do Avançado** | `exportar.ts:312,421,433` ← `tela-fluxo-ver.ts:16` | **`calcularFluxo`** (recebe o `FluxoCalc`) | **não exibe VGV/Margem/Resultado/ROI** — ver abaixo | — |
| 12 | **Cenários** (Avançado) | `tela-cenarios.ts:213` | `calcularFluxo(aplicarCenario(…))` | não exibe margem/ROI; exibe VPL/TIR/fluxo | — |

#### Quais divergem entre si, e por quê

**Divergência 1 — 🔴 "VGV" significa duas grandezas diferentes dentro do mesmo estudo Avançado.**

| Superfície | Campo | Grandeza |
|---|---|---|
| **Resumo**, KPI rotulado "VGV" | `c.vgvTotal` | **grandeza 1 — VGV potencial**, inclui a permuta física |
| **Painel de estudos**, coluna rotulada "VGV" | `p.vgv = c.receitaBruta` | **grandeza 6 — Receita Bruta**, o que entra em caixa |
| **Resultados → Proforma**, linha "Receita bruta (VGV)" | `c.receitaBruta` | grandeza 6 |

O próprio motor declara essas duas como **grandezas distintas e numeradas** na taxonomia de
`frontend/fluxo-caixa-motor.ts:229-246` (*"1. VGV potencial = `vgvTotal`"* … *"6. Receita Bruta =
`receitaBruta`"*), e o comentário de `:239-241` registra que confundir as duas foi justamente o
defeito que a #227/#229 corrigiu. **Duas telas voltaram a chamar as duas de "VGV".**

Ironia útil: **a exportação do Avançado é a única superfície que acerta o rótulo** —
`exportar.ts:433` escreve **"Receita Bruta — VGV"**, desambiguando. A tela que gerou o arquivo, não.

**Divergência 2 — 🔴 "Margem líquida" tem três definições.**

| Superfície | Fórmula | O que muda |
|---|---|---|
| **Resumo** (`tela-resumo.ts:165`) | `fluxoAcumulado[último] / vgvTotal` | numerador é **caixa acumulado no fim do horizonte** — regime de **caixa**, e o funding entra pelas **duas** pontas porque já está no fluxo; denominador é VGV potencial |
| **Resultados / Painel** (`proforma-avancado.ts:123`) | `resultado / receitaBruta` | numerador em **competência**, funding **só pela saída** 🔴 (o bug do A5); denominador é Receita Bruta |
| **Preliminar** (`proforma.ts:309`) | `resultado / vgv` | terceiro par numerador/denominador, sobre campos estáticos de `estudos` |

**Três numeradores e três denominadores diferentes, um rótulo só.** Mesmo consertando o sinal do
funding, #1 e #2 continuariam divergindo — são **regimes contábeis diferentes** (caixa ×
competência) sobre **bases diferentes** (grandeza 1 × grandeza 6).

**Divergência 3 — 🔴 "ROI" tem dois denominadores.**

| Superfície | Fórmula | Denominador |
|---|---|---|
| **Resumo** (`tela-resumo.ts:166`) | `resultado / custoTotal` | soma de **todas** as `linhasCusto` — mas **sem** o funding, porque `c.linhasCusto` não o contém |
| **Painel de estudos** (`proforma-avancado.ts:124`) | `resultado / investimentoTotal` | `custoDireto + custoIndireto`, **com** `funding.linhasSaida` somadas ao grupo `financeiro` |

O comentário de `proforma-avancado.ts:47-58` justifica o `investimentoTotal` dizendo que é
*"literalmente a fórmula do Preliminar"* e que *"ROI sem denominador comum entre os dois níveis
compara coisas diferentes na mesma coluna"*. **O raciocínio está certo, e é exatamente o argumento
contra a versão do Resumo** — que usa outro denominador, outro numerador, e ninguém percebeu.

#### Onde o bug do funding aparece, e onde não aparece

`frontend/proforma-avancado.ts:92-93`:

```ts
const totalDoGrupo = (g: string) => linhasDoGrupo(g).reduce((s, x) => s + x.total, 0)
  + (g === 'financeiro' ? (funding?.linhasSaida ?? []).reduce((s, l) => s + l.total, 0) : 0);
```

`linhasEntrada` — os desembolsos que **entram** no caixa — não aparecem em lugar nenhum da função.
**Confirmo a leitura do A5.** Contamina exatamente as superfícies **#1 e #2**, as duas únicas que
chamam `proformaAvancado`, e só quando `operacoesFunding.length > 0` — que é o caso dos **dois**
estudos Avançados da instância (`GET /estudos/{5,6}/avancado/funding` devolve 2 operações cada).

**Não contamina #4/#5** (Resumo), porque ali o numerador é `fluxoAcumulado`, onde o funding entra
pelas duas pontas — o que **explica por que Resumo e Resultados mostram sinais opostos** para o
mesmo estudo. **Não contamina** #3 e #6–#10 (Preliminar). E **#11 escapa** por não exibir o
indicador.

> **A consequência que só a auditoria de apresentação enxerga:** o usuário do estudo 5 vê, na mesma
> sessão e no mesmo estudo, **"Margem líquida −47,87%"** na aba Resultados e uma margem **positiva**
> no Resumo — mesmo rótulo, mesma unidade, nada na tela dizendo que são medidas diferentes. E a
> exportação não traz margem nenhuma, então nem serve de desempate.

#### O que isto muda no desenho da correção

Consertar `proforma-avancado.ts:92-93` resolve o **sinal**, não a **incoerência**. A issue precisa de
**duas partes**:

1. **Cálculo** (escopo do A5) — creditar `linhasEntrada` no grupo `financeiro`.
2. **Apresentação** (escopo desta auditoria) — **uma definição por rótulo, em todo o app.** Ou o
   Resumo passa a chamar `proformaAvancado` (e some a conta inline de `tela-resumo.ts:159-166`), ou
   os rótulos passam a dizer qual grandeza são: "VGV potencial" × "Receita Bruta", "Margem sobre
   Receita Bruta" × "Margem de caixa". **A primeira é a única que não exige que o usuário conheça a
   taxonomia interna do motor.**

**Um mesmo rótulo significando coisas diferentes em telas diferentes é pior que uma prop errada: a
prop errada não faz nada e o usuário percebe. O rótulo ambíguo produz um número plausível — e ele
acredita.**

### 5.5 🔴 Dois modais destroem dado ao serem reabertos — e os dois anunciam "sucesso"

O §4.1 já documentou o modal de **Pagamento**. O A5 mediu o custo dos dois e apontou um segundo,
o de **Absorção**. Confirmei o mecanismo dos dois no código e — a pergunta que me foi feita —
**confirmo que não existe aviso nenhum em tela, em nenhum dos dois.**

| | Modal de **Pagamento** | Modal de **Absorção** |
|---|---|---|
| Abre com | `formularioPagamento` (`fluxo-pagamento-editor.ts:28-42`) — lê `comissao/ret/entrada/parcelas/repasse`, **nunca `fp.componentes`** | `_abrirAbsorcao` (`tela-fluxo-receitas.ts:520-527`) — lê `correcao_estoque` + **3 percentuais** |
| Grava | `fluxoPagamentoParaSalvar` (`:88-90`) → `componentesDoLegado`, que fixa **`taxaMensal: 0`** e **`sinalPct: 0`** (`fluxo-caixa-motor.ts:589,601,608,617`) | `_absorcaoJson` (`tela-fluxo-receitas.ts:530-542`) → **`modo: 'distribuido'` hard-coded** e `blocos` reconstruídos do zero, com 4 eventos fixos |
| Destrói | taxa de juros de tabela, sinal, rótulo escrito pelo usuário; e **fabrica** entrada de 15% quando `entrada` está vazia (`fluxo-pagamento-editor.ts:37`) | **`modo: 'personalizado'` e qualquer curva própria** — nada disso tem representação no formulário |
| Custo medido pelo A5 | estudo 5 perderia **R$ 1.259.273,59**; TIR cai de 18,59% para 17,53% | **VPL −R$ 360.591,41** |
| Validação antes de aplicar | `erroFormularioPagamento` — só soma de percentuais | `erroFormularioAbsorcao` (`fluxo-shared.ts:337-345`) — só barra **acima** de 100% |
| **Aviso na tela** | 🔴 **nenhum** | 🔴 **nenhum** |
| **Confirmação / undo** | 🔴 **nenhum** | 🔴 **nenhum** |
| O que a tela diz ao terminar | `urbiVerso.notificar('Fluxo de pagamento aplicado.', 'sucesso')` (`tela-fluxo-receitas.ts:848`) | `urbiVerso.notificar('Absorção de vendas aplicada.', 'sucesso')` (`:661`) |

**Os dois relatam sucesso enquanto apagam dado.** Não há `urbi-banner variante="alerta"` no corpo de
nenhum dos dois modais avisando que aplicar reescreve o registro inteiro; a única `urbi-banner` que
aparece ali é `variante="erro"`, e só quando a validação falha (`:817-818`).

Nos dois casos o mecanismo é o mesmo e tem nome: **o modal reconstrói o JSON persistido a partir de
um formulário mais pobre que o dado, em vez de fazer merge.** O que o formulário não sabe
representar, ele apaga — sem passar por lugar nenhum que pudesse avisar.

> **O app já tem o padrão certo em casa e não o aplicou aqui:** `tela-premissas.ts` usa
> `confirmRemoverProduto` para confirmar uma exclusão explícita. Reabrir um modal e clicar em
> "Aplicar" destrói mais dado que aquela exclusão, e não confirma nada.

> ✅ **Correção ao dossiê §4.5, item 4 — trazida pelo A5 e incorporada aqui.** O dossiê afirma que
> `modo: 'personalizado'` *"existe no motor mas a UI nunca o grava"*. **A primeira metade é exata; a
> segunda esconde o que importa:** o modo **existe na instância** — estudo 6, curva de 43 meses,
> `aplicado: true`. Ou seja, há dado personalizado real que **nenhuma tela sabe exibir** e que o
> modal de Absorção **converte para `distribuido` no primeiro "Aplicar"**. Não é lacuna de
> funcionalidade; é dado vivo em rota de colisão. Nenhuma issue deve dizer "modo personalizado nunca
> é usado".

---

## 6. Veredito dos itens cosméticos 6, 17 e 24

Trabalhei estes três **de forma independente** e depois comparei com `01-verificacao-47-itens.md`.
Onde convergimos, digo. Onde acrescento, marco.

### Item 6 — "Reordenar lista de custos" → ✅ **ENTREGUE. Nada a reabrir.**

**Pergunta que me foi feita: é reordenação ou agrupamento?** Resposta: **é agrupamento por linha, e
era isso que o autor pediu** — "Reordenar" é o rótulo do sintoma, não a especificação.

O pedido literal tem quatro cláusulas: (1) melhor distribuição na vertical, (2) **no máximo 3 campos
por linha**, (3) **não aumentar a largura dos campos**, (4) adequar espaçamento e alinhamento por
linha. O entregue (`frontend/tela-premissas.ts:286-288`, aplicado em `:549`):

```css
@media (min-width: 700px) {
  .grid.grid-3col { display: grid; grid-template-columns: repeat(3, auto); justify-items: start; }
}
```

(2) ✓ `repeat(3, auto)` é literalmente o teto de 3. (3) ✓ `.grid > .p1/.p2/.p3` (`:275-277`)
intocadas, e `justify-items: start` impede o grid de esticar o item até a track — sem ele, `auto`
+ `stretch` (o default) aumentaria a largura, que é exatamente o que o autor proibiu. (4) ✓ colunas
`auto` alinham verticalmente entre linhas, coisa que `flex-wrap` não faz; `gap: 12px` de `.grid:274`
continua valendo. (1) ✓ é consequência de (2). **Convergente com o A1.**

**Acrescento duas conferências que o A1 não fez:**

- **Escopo correto.** `grid-3col` aparece em **um só lugar** (`:549`, a faixa de Custos). As outras
  6 `<div class="grid">` (`:518, 523, 529, 567, 575, 600, 609`) ficaram no `flex-wrap`. O autor
  reclamou de Custos; só Custos mudou. Não houve regressão colateral em Terreno & Áreas, Produtos,
  Permutas, Impostos ou Deduções.
- **Um efeito de `repeat(3, auto)` que vale saber.** Uma track `auto` dimensiona pelo item mais
  largo **daquela coluna**. Como a faixa mistura `.p1` (165px), `.p2` (210px, default) e `.p3`
  (330px), um `.p3` na coluna 1 alarga a coluna 1 para 330px em **todas** as linhas, e os `.p1` que
  caírem ali ficam alinhados à esquerda dentro de uma track larga. O resultado é **coluna alinhada
  com folga irregular** — que é exatamente o "alinhamento por linhas" pedido, e o oposto do
  empacotamento denso anterior. **Não é defeito**, é o trade-off inerente ao pedido.

**Ressalva não bloqueante** (idêntica à do A1, cheguei por conta própria): abaixo de 700px o
`@media` não vale e volta o `flex-wrap`, onde 4 campos `.p1` + 3 gaps = 696px cabem numa viewport de
699px. Janela de ~4px. Registro para não ser "descoberto" de novo.

### Item 17 — "urbi-kpi está sobrepondo ainda" → 🔴 **NÃO RESOLVIDO. A hipótese do wrapper está errada.**

**A hipótese que me foi dada para avaliar** — "o wrapper `.kpi-cel` em `frontend/tela-resumo.ts:59-67`
é a correção" — **não se sustenta.** Confirmo o diagnóstico do A1 e o reforço com duas evidências
próprias.

O que a #326 entregou (`frontend/tela-resumo.ts:66-67`):

```css
.kpis .kpi-cel { display: flex; flex-direction: column; min-width: 0; }
.kpis .kpi-cel urbi-kpi { width: 100%; }
```

O `width: 100%` **foi mantido** — só desceu um nível de aninhamento. E o `:host` do primitivo
(`urbiverso/ui/src/urbi-kpi.ts:41-46`) é:

```css
:host { background: …; border: 1px solid …; border-radius: …; padding: 14px 16px; min-width: 140px; }
```

**Conferi, e não há `box-sizing: border-box` em lugar nenhum da cadeia:**

| Onde procurei | Resultado |
|---|---|
| `:host` de `urbi-kpi.ts` | ausente |
| `UrbiPrimitivoDeConteudo.estiloConteudo` (`urbi-primitivo-conteudo.ts:39-48`) | só `display/flex-direction/min-height` |
| `urbi-primitivo-conteudo.ts` inteiro | **uma** ocorrência de `box-sizing`, em `:81`, dentro da classe interna `.estado-erro` — não alcança o `:host` |
| `compartilhado/tokens.css` | nenhum reset global; o `:root` só herda `color` e `font-family` |
| `frontend/*.ts` | `grep -n "box-sizing"` → só `.grid > *` (premissas/financeiro/funding) e `.c1..c6` (fluxo-tabela). **Nada alcança `urbi-kpi`.** |

`box-sizing` **não é herdado**. Logo `width: 100%` é largura de **conteúdo**, e a caixa pintada mede
`100% + 32px de padding + 2px de borda`. Transborda `.kpi-cel`, que não tem `overflow`, e pinta sobre
o vizinho. **É o sintoma exato que o autor reportou "várias vezes".**

**Acréscimo meu #1 — o gabarito do autor confere.** Ele escreveu: "*nos estudos Preliminares isso já
está certo*". O Preliminar (`frontend/tela-proforma.ts:52-53`) é:

```css
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 220px)); gap: 12px; }
.kpis urbi-kpi { min-width: 0; }
```

**Sem `width: 100%`.** O item de grid é dimensionado pela track e acabou. A diferença entre o que
funciona e o que não funciona é uma linha, e ela está no lado do app.

**Acréscimo meu #2 — o comentário da #326 invoca um precedente que não é precedente.**
`tela-resumo.ts:63-65` justifica o wrapper como "*o padrão já comprovado de fluxo-tabela.ts:73-74*".
Mas `fluxo-tabela.ts:65-82` **não usa `urbi-kpi`** — é uma `<div class="kpi-card">`, HTML do próprio
app, estilizada pela própria folha do app, com `min-width: 0` e **sem `width: 100%`**. É um `div`
em content-box com `width: auto`, que por definição cabe na track. **Analogia falsa**: um `div` da
sua folha é caixa que você controla; um custom element com `:host` estilizado no shadow DOM não é.

Pior: o comentário `fluxo-tabela.ts:56-64` registra que a app **já concluiu uma vez**, na #352, que
"*a saída determinística (D7) é abandonar `urbi-kpi` nesses 6 cards*". A #326 então reintroduziu
`urbi-kpi` com `width: 100%` **citando essa mesma conclusão como prova de que dava certo**.

**Duas correções possíveis, ambas de uma linha e ambas do lado do app** — registro porque a regra da
casa exige que "a mudança pertence à plataforma" seja a última hipótese, não a primeira:

1. **Apagar `width: 100%`** de `tela-resumo.ts:67`, igualando ao Preliminar. É o mínimo, e é o que o
   autor apontou como já correto.
2. **Ou** `.kpis urbi-kpi { box-sizing: border-box; }`. Funciona porque regra vinda de **fora** da
   shadow tree vence a regra `:host` de dentro — o elemento hospedeiro pertence à árvore do app.
   Não exige nada do monorepo.

**Achado colateral, mesma família** (encontrei independentemente; o A1 também): `frontend/tela-cenarios.ts:363`
usa `<div class="kpi-cel">` e **não existe regra `.kpi-cel`** nem no `static styles` daquele
componente (`:92-135`) nem em `estiloFluxoTabela` (`fluxo-tabela.ts` define `.kpi-card`, nunca
`.kpi-cel`). **Classe órfã** — resíduo da `tela-capital-stack.ts` apagada pela #355. Hoje é card
único e não sobrepõe nada; entra na mesma issue.

### Item 24 — larguras em `ch` → 🟡 **PARCIAL. E o `ch` está sendo medido contra a fonte errada.**

**A pergunta que me foi feita: "dependem da fonte real do shell; confira qual fonte o shell define".**
Fui atrás, e encontrei **dois** problemas — um deles ninguém levantou.

**A fonte.** `urbiverso/compartilhado/tokens.css:188` define `--fonte: 'Montserrat', sans-serif`,
aplicada no `:root` em `:29` (`font-family: var(--fonte)`) e no `html, body` do shell
(`shell/frontend/index.html:46`). **Montserrat é geométrica e larga** — dígitos com avanço na casa
de ~0,60em, contra ~0,50em das fontes estreitas que a conta ingênua supõe. E o tema **cyberpunk**
(`tokens.css:514`) troca `--fonte` para `'Chakra Petch'`, de métrica diferente.

**🔴 O problema estrutural que muda a conta — as larguras estão em `<col>`, não em `th`/`td`.**

`frontend/tela-empreendimento-tipologias.ts:79-85`:

```css
col.c-area    { width: 16ch; }   /* 6 dígitos + milhar + decimais + sufixo "m²" */
col.c-dorm    { width: 7ch; }    /* 2 dígitos */
col.c-vagas   { width: 7ch; }    /* 2 dígitos */
col.c-un      { width: 8ch; }    /* 4 dígitos (5 com separador de milhar em ≥1000) */
col.c-areatot { width: 17ch; }
```

`1ch` é o avanço do glífo "0" **na fonte computada do elemento onde a largura é declarada**. Aqui o
elemento é `<col>`, e a folha **não dá `font-size` a `col`** — ele herda de `table` → host → `:root`
= **1rem = 16px**. Mas o conteúdo renderiza em `td { font-size: var(--texto-corpo, 0.8125rem) }`
(`:69`) = **13px**, e o cabeçalho em `th { font-size: var(--texto-rotulo, 0.75rem) }` (`:61`) =
**12px** (tokens confirmados em `urbiverso/compartilhado/tokens.css:193-194`).

**As colunas são dimensionadas para dígitos de 16px e preenchidas com dígitos de 13px** — ~23% mais
largas do que a intenção declarada. O comentário `:75-78` diz *"cabe exatamente o número de dígitos
citado, **sem sobra**"*. **Não é o que acontece: há sobra sistemática.** Esta parte do veredito é
**independente de fonte** — vale para Montserrat, Chakra Petch ou qualquer outra —, e é o pedaço em
que tenho certeza.

**🟡 O cabeçalho cortado.** `table-layout: fixed` (`:56`) + `th { overflow: hidden }` (`:63`), sem
`white-space`, `overflow-wrap` ou `hyphens`. Os rótulos (`:192-195`) são "Área privativa",
"Dormitórios", "Vagas", "Unidades", "Área total". **"Dormitórios" é palavra única de 11 caracteres,
que não quebra.**

Refazendo a conta com os dois ajustes (base 16px para o `ch`, Montserrat para o glifo):

| Coluna | `ch` | ≈ px (1ch ≈ 9,6px @16px Montserrat) | menos `padding: 8+8` | Cabeçalho @12px | Cabe? |
|---|---|---|---|---|---|
| `c-dorm` | 7ch | ≈ 67px | ≈ 51px | "Dormitórios" ≈ 75–80px | 🔴 **cortado** |
| `c-vagas` | 7ch | ≈ 67px | ≈ 51px | "Vagas" ≈ 35px | ✅ |
| `c-un` | 8ch | ≈ 77px | ≈ 61px | "Unidades" ≈ 55px | 🟡 **no limite** |
| `c-area` | 16ch | ≈ 154px | ≈ 138px | "Área privativa" (quebra no espaço) | ✅ |

**Divirjo do A1 num ponto:** ele classificou `c-un` ("Unidades") como cortado. Com o `ch` resolvido
contra 1rem — que é o que de fato acontece —, `c-un` provavelmente **cabe**, ficando no limite. O
corte confirmado é **só "Dormitórios"**.

**Ressalva de honestidade, na mesma medida que o A1:** isto é veredito por construção CSS e métrica
tipográfica, **não por medição em navegador** — este ambiente não tem browser, por decisão do autor.
O que afirmo com **certeza** é o mecanismo (`ch` em `<col>` resolve contra 1rem, não contra a fonte
da célula) e a falta de estratégia de quebra em `th`; o **quanto** cada rótulo transborda precisa de
régua. É o item em que tenho menos certeza dos três.

**Acréscimo meu — `ch` é dependente de tema, e isso não estava no radar.** Como o tema cyberpunk
troca `--fonte` para `'Chakra Petch'`, **toda largura em `ch` muda de tamanho ao trocar de tema**.
Uma coluna calibrada para "caber 6 dígitos" em Montserrat pode não caber os mesmos 6 dígitos em
Chakra Petch, e o `overflow: hidden` corta em silêncio. Se o critério de aceite é "cabe N dígitos"
em qualquer tema, `ch` é a unidade errada — a unidade certa é uma largura absoluta calculada para a
métrica mais larga, ou `min-width` em `px` com o dígito em `font-variant-numeric: tabular-nums`
(que a tabela já declara em `:55`).

---

## 7. Perguntas ao autor

**Q1 — `viab-num` deve continuar sendo um fork, ou vira pedido ao monorepo?**
`frontend/viab-num.ts` existe por um motivo documentado e real (`:5-13`): `urbi-input-numero` usa
`<input type="number">` e por isso **não consegue** exibir separador de milhar pt-BR. Consequência:
o app tem **zero** usos de `urbi-input-numero` e mantém 210 linhas de fork. **Texto pronto para
levar ao monorepo:** *"`urbi-input-numero` precisa de um modo de exibição agrupado pt-BR — mostrar o
número com separador de milhar em repouso e o valor cru ao focar. Sem isso, toda app que edita
dinheiro reimplementa o primitivo."* Quer que eu abra issue **neste** repo com esse texto (é o
caminho permitido), ou prefere levar direto?

**Q2 — fecho as duas brechas do guard de aspas curvas?**
`scripts/validar-frontend.sh:66` casa só `=` **colado** na aspa curva. Não pega `= ”x”` (com espaço)
nem `="x”` (aspa mista, a mais perigosa: engole os atributos seguintes). O repo está **limpo hoje**
nos três padrões — conferi. É mudança de 1 linha no guard; autorizo-me?

**Q3 — corrijo o `CLAUDE.md:471-477`?**
Ele ainda afirma que `frontend/exportar.ts:10` define `const R$ = v.toFixed(2)`. **Não define mais**
— hoje é `import { fmtR$, fmtNum, fmtPct } from './viab-format.js'`. É a **segunda vez** que essa
nota fica vencida. Proponho reescrevê-la apontando para o duplicado **real** de hoje
(`fluxo-tabela.ts:34-38` × `exportar.ts:167-174`, §3.3/B4). Mudança de documentação — precisa da sua
palavra porque o `CLAUDE.md` é contrato.

**Q4 — `avancado_capital_instrumentos` sai do `schema.json` ou espera o A3?**
A tabela é órfã no runtime (só migrações a tocam), mas **guarda `tipo: 'capital_giro'` e o dado
migrado pela `019`**, e o A3 propõe reintroduzir capital de giro como `linha_credito`. Apagar agora
pode jogar fora dado histórico que a proposta nova reaproveitaria. **Minha recomendação: não apagar
nesta rodada; abrir issue bloqueada pela decisão do A3.** Confirma?

**Q5 — `modo_retorno` e `valor` fazem sentido nos 3 tipos de operação de funding?**
Dado real: as 4 operações da instância têm `modo_retorno: "permuta_financeira"` — inclusive as duas
de `financiamento_producao`, que têm `valor: "0.00"` e `pct_retorno: "0.00"`. Se o campo só faz
sentido em `equity`, a tela deveria escondê-lo por tipo; se um `financiamento_producao` deriva o
montante de `percentual_financiavel`, exibir "Valor: R$ 0,00" numa coluna é enganoso. **Não consigo
fechar isto sem ver a tela** — é a única pergunta desta auditoria que um print resolveria em 5
segundos.

**Q6 — absorção somando 35% é intencional?**
As 3 linhas de receita do estudo 5 têm `pre_lancamento 0% + lancamento 15% + obra 20% = 35%`; os
outros 65% escorrem para o pós-obra derivado. `erroFormularioAbsorcao` (`fluxo-shared.ts:337-345`)
só barra **acima** de 100%. Se 35% é intencional, a tela deveria **exibir o total e o derivado**;
se não é, falta validação de piso. Qual dos dois?

**Q7 — a "Definições" órfã de Receitas (item 31) some agora ou vira issue?**
Já confirmada pelo dossiê: os controles saíram, mas o bloco `<h4>Definições</h4>` continua em
`frontend/tela-fluxo-receitas.ts:728-737` com dois `<p class="sec">` estáticos apontando para
Custos. É título de seção sem seção. Está no mesmo caminho do achado 4.1 (o modal logo abaixo) —
consertar junto ou separado?

**Q8 — como unificar "Margem líquida", "VGV" e "ROI"? (§5.4 — precisa da sua decisão antes da issue)**
Há **três** definições de margem e **duas** de VGV convivendo, em 12 superfícies. Consertar o sinal
do funding em `proforma-avancado.ts:92-93` (escopo do A5) **não** as reconcilia. Duas saídas, e a
escolha é sua:
**(a)** o Resumo passa a chamar `proformaAvancado`, some a conta inline de `tela-resumo.ts:159-166`,
e o app fica com **uma** definição por indicador — muda o número que o usuário vê hoje no Resumo;
**(b)** mantêm-se as duas definições e os **rótulos passam a distingui-las** ("VGV potencial" ×
"Receita Bruta", "Margem de caixa" × "Margem sobre Receita Bruta") — não muda número nenhum, mas
exige do usuário a taxonomia interna do motor. **Recomendo (a)**, com (b) como rótulo de apoio no
tooltip. Qual?

**Q9 — os dois modais destrutivos ganham confirmação, merge, ou os dois? (§5.5)**
O conserto de fundo é **fazer merge em vez de reconstruir o JSON** — o formulário só sobrescreve o
que sabe representar. O conserto barato é uma `urbi-banner variante="alerta"` no corpo do modal
quando o dado persistido tem algo que o formulário não mostra (`componentes` com `taxaMensal > 0`,
`absorcao.modo !== 'distribuido'`), mais confirmação antes de aplicar. **Os dois são de UI e cabem
nesta rodada seguinte**; o merge é maior. Faço os dois na mesma issue ou separo?

---

## 8. Inventário de achados, para virar issue

| # | Sev | Achado | `arquivo:linha` | §
|---|---|---|---|---|
| A1 | 🔴 | Modal de pagamento regenera `componentes` e zera `taxaMensal`/`sinalPct`; numa linha, fabrica entrada de 15% | `tela-fluxo-receitas.ts:843` · `fluxo-pagamento-editor.ts:28-42,88-90` · `fluxo-caixa-motor.ts:589,601,608,617` | 4.1 |
| A2 | 🔴 | 9 de 10 controles da aba Financeiro inertes; duas caixas "RET", uma morta | `tela-financeiro.ts:154-197` vs `tela-fluxo-custos.ts:496-497` | 5.1 |
| A3 | 🔴 | Tela × exportação divergem no mesmo número (0 vs 2 casas; limiar 0,5 vs 0,005) | `fluxo-tabela.ts:33-39` × `exportar.ts:167-174` | 3.3/B4 |
| A4 | 🔴 | `fmtNum(v,2)` promete 2 casas e não entrega; comentário declara o contrato quebrado | `viab-format.ts:24-25` · `tela-proforma.ts:453` | 3.3/B3 |
| A5 | 🔴 | `urbi-kpi` transborda: `width:100%` sem `box-sizing` no `:host`; wrapper não corrige | `tela-resumo.ts:66-67` | 6/17 |
| A6 | 🟡 | `--cor-superficie-2` não existe no shell; fallback branco quebra temas claros | `tela-dashboard.ts:131,135` | 3.2/B1 |
| A7 | 🟡 | 12 cores literais fora de `exportar.ts`; existem `--cor-categoria-1..8` | `tela-graficos.ts:13-16,112` | 3.2/B2 |
| A8 | 🟡 | "Capital Stack" e refs internas (`#345`, `#238`, `.md`) em texto/tooltip visível | `tela-fluxo-ver.ts:294,295` · `tela-fluxo-receitas.ts:810` · `tela-fluxo-custos.ts:766,774` | 4.2 |
| A9 | 🟡 | `avancado_capital_instrumentos` órfã no `schema.json` — **espera decisão do A3** | `schema.json:380-394` | 4.2/C1 |
| A10 | 🟡 | Larguras `ch` em `<col>` resolvem contra 1rem, não contra a fonte da célula; "Dormitórios" cortado; `ch` muda com o tema | `tela-empreendimento-tipologias.ts:79-85,192-195` | 6/24 |
| A11 | 🟡 | `.kpi-cel` órfã, sem regra CSS em lugar nenhum | `tela-cenarios.ts:363` | 6/17 |
| A12 | 🔴 | `pos_obra.duracao_meses`: obedecido p/ custo, **descartado p/ vendas**; esticar a fase faz vender menos — estudo 6 perde R$ 2.007.856,95 (1,41%) | `fluxo-shared.ts:229-232,237,281` · `tela-fluxo-cronograma.ts:269,276` | 5.3/C2 |
| A13 | 🟡 | Absorção soma 35% sem aviso; validação só barra >100% | `fluxo-shared.ts:337-345` | 5.3/C6 |
| A14 | 🟡 | Dois rótulos para `imposto_percentual`; `fluxo_pagamento.ret` morto por linha | `tela-financeiro.ts:188` × `tela-premissas.ts:154` · `fluxo-pagamento-editor.ts:36` | 4.3, 5.3/C7 |
| A15 | 🟡 | `pct1` × `fmtPct` divergem em ≥1000; 3 `toLocaleString` inline | `exportar.ts:14` · `tela-fluxo-receitas.ts:367,585,814` | 3.3/B5 |
| A16 | ⚪ | `CLAUDE.md:471-477` descreve estado que não existe mais | `CLAUDE.md:471-477` | 3.3 |
| A17 | ⚪ | `expandir` redundante em `urbi-abas` (o layout já o põe sozinho) | `tela-dashboard.ts:321` | 2.2 |
| A18 | 🔴 | **"Margem líquida", "VGV" e "ROI" com definições diferentes por tela** — 3 fontes, 12 superfícies; o bug de sinal do funding é só metade da causa | `tela-resumo.ts:159-166` · `proforma-avancado.ts:92-93,123-124` · `tela-dashboard.ts:74,273` · `tela-fluxo-ver.ts:232` | 5.4 |
| A19 | 🔴 | Modal de **Absorção** força `modo: 'distribuido'` e apaga curva personalizada (estudo 6, 43 meses); sem aviso, termina em "sucesso" | `tela-fluxo-receitas.ts:520-527,530-542,650-661` | 5.5 |
| A20 | 🟡 | Painel de estudos rotula "VGV" uma coluna que guarda `receitaBruta` no Avançado e `proforma.vgv` no Preliminar — **duas grandezas na mesma coluna** | `tela-dashboard.ts:74,289,404` | 5.4 |
