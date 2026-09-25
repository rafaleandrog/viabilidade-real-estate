# Rodada 8 — Digest cruzado (Rodada 2)

> O que **cada agente** achou, resumido para os **outros** agentes. Escrito pela sessão
> principal depois que a Rodada 1 fechou. Objetivo: achar as issues que **só aparecem quando
> dois achados se encontram** — e que nenhum de vocês veria sozinho.

---

## Decisões do autor — vinculantes, não rediscutir

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Os 3 bugs graves são consertados agora**, nesta branch (agente B2) | Proforma somando principal do funding · modal de pagamento que reescreve o plano · `PATCH` de tipologias sem validar saldo. **Não escrevam issue para os três.** O que fica **fora** do conserto vira issue — em especial o campo de taxa de juros no modal, que é feature e **não** entra |
| 2 | **Os 36 itens restantes da lista de bugs estão sendo auditados** (agente B1) | Não dupliquem; ele entrega `08-auditoria-39-itens.md` |
| 3 | **Capital de giro: só o rótulo.** O tipo `divida` **já é** o produto de CG por calendário | O desenho `linha_credito` rotativo do A3 foi **RECUSADO pelo autor**. Sem migração `030`, sem bump para 0.1.29. Sobra issue de vocabulário |
| 4 | **A base de receita líquida do equity NÃO muda.** Palavras do autor: *"equity é um retorno líquido ao investidor, não importa esse fator para o cálculo"* | `funding-motor.ts:58-67` fica como está. A divergência com as duas planilhas é **intencional** → vira nota, não issue. **Continua valendo** como issue o `simularEquity` sem `max(0,…)` |

---

## A1 — verificação dos 47 itens

- Placar após reauditar 8 dos 44 "implementados": **41 confirmados, 5 reabertos (11, 17, 22, 24, 31), 1 sem diff mas correto (20)**. **3 de 8 falharam — 37,5%.**
- **Item 11** — alinhar à direita ✓ e tirar "R$" ✓, mas a 3ª cláusula ("duas casas") ✗: `fmtNum(v, 2)` entrega *até* 2 casas, então `1500000` sai `"1.500.000"` e a vírgula não bate entre linhas numa coluna alinhada à direita.
- **Item 17** — a #326 embrulhou o KPI em `.kpi-cel` mas **manteve o `width: 100%`**. `urbi-kpi` tem `padding: 14px 16px` + `border: 1px` e **nenhum `box-sizing: border-box`** em toda a cadeia. Caixa mede `100% + 34px`. `.kpi-cel` em `tela-cenarios.ts:363` é **classe órfã**, sem CSS.
- **Item 24** — a redução de largura levou `c-dorm`/`c-un` para baixo da largura do **cabeçalho**, e `th` tem `overflow: hidden` sem estratégia de quebra.
- **Método que mudou tudo:** ler o **corpo** da coluna `Issue`, não o título. O item 6 pedia "no máximo 3 campos por linha", não "reordenar" — o título dizia o oposto do pedido.
- Perguntas: a obra deve começar junto com o Pré-lançamento (`avancado.ts:77-91`)? A corretagem "destacada × embutida" ainda deve interferir (não interfere desde a #228, e o campo é dado morto)? Dois RETs convivem e um não faz nada.

## A2 — lente EVI Urbitá (22 regras)

- **O número que ancora a rodada:** `Areas e Precos!C30` — **R$ 8,98 MM, 5,41% do VGV** da EVI é juros de tabela. O app reporta zero. Na safra de lançamento isolada, **24,53%**.
- `Premissas!H14` = **12,5% a.a.** `pagamentosConcentrado:774-786` já capitaliza com a **mesma convenção da planilha** e sozinho responde por **78%** dos juros da safra. Falta **só a superfície de entrada** — um campo no modal. `fluxo_pagamento` é coluna `json` → **sem migração**.
- **A EVI vota com a #226**: `cfINC!J` divide por **12 literal**, ignorando os próprios inputs `EtapaChavesDuracao`/`EtapaPosChavesDuracao`. O Pós-chaves travado em 12 **reproduz a planilha** — quem está errado é `padrao-incorporacao.md:634-637`, rotulado "Comportamento vigente" e descrevendo o app de antes da #226.
- **R-A2-21 — os dois ramos NÃO são equivalentes**, com o mesmo `fluxo_pagamento`:

  | Aspecto | Legado (`:1339-1416`) | Canônico (`:1064-1163`) |
  |---|---|---|
  | Prazo fixo | `total/nParc` | PMT, resíduo na última |
  | "Ao longo da obra" | `obra.inicio_mes + k×intervalo`, **inclui o mês da venda** | `N_s = fimObra − safra`, 1ª em `safra+1` |
  | Venda pós-entrega | segue os componentes | **100% à vista** (#235) |
  | Juros / carteira | **não existem** | séries completas |
  | Repasse antes da safra | silencioso | **lança erro** |

- **Duas noções de "líquida" no mesmo modelo, de propósito**: `Premissas!P19` deduz imposto+corretagem+**marketing**; a base de rateio da permuta financeira (`cfINC!BN`) deduz **só** imposto+corretagem, por dois flags independentes (`Premissas!N17`/`N18`).
- Convergem **exatamente** com a planilha, célula a célula: repasse em `fimObra+1` (#345), venda pós-entrega 100% à vista (#235), `ate_marco` com `N_s` decrescente (#233).
- Regra ausente de maior porte: **velocidade de vendas em m²/unidades com estoque e VSO** — a EVI absorve em **área** (`cfINC!J`) com livro de estoque (`!M/N`); o app só tem % de VGV. Dados já existem em `avancado_tipologias`; série 100% derivada, sem input novo.

## A3 — lente funding / investidor

- **`simularDivida` reproduz a planilha mês a mês** (F=3.333.333,33 / 6.717.698,23 / 10.153.875,97); totais divergem R$ 0,06–0,09 só pelo arredondamento a 2 casas que o contrato obriga; TIR bate em 2·10⁻¹⁰.
- **A aba `divida` É a folha de Capital de Giro do autor** — rótulos `A8 "Valor CG (R$)"`, `B18 "Libera CG"`, `C18 "Carencia CG"`.
- **`simularEquity` (`funding-motor.ts:441`) não tem `max(0,…)`** — com base mensal negativa o retorno fica negativo e **o projeto recebe do investidor**. A planilha não consegue produzir isso; `funding-capital-stack.md:576` manda `máximo(0; …)`. **Continua sendo issue.**
- **Cash sweep cego às outras operações** — `funding-motor.ts:726-737` simula tudo contra o mesmo `fluxoLivreMensal` **desalavancado**: um aporte de equity ou saque de CG **não existe** para o `financiamento_producao`. **Não é o waterfall apagado pela #355** — é ordem de leitura do caixa.
- **`Σ pct_retorno` sem teto de 100%** (`backend/rotas/funding.ts:65` não valida o campo) — um investidor pode receber mais que a receita líquida inteira.
- `saldoFinal` lê o último mês do horizonte; `!divida!C74` usa `ÍNDICE/CORRESP` para ler o mês da **quitação**.
- O golden test não pega a divergência de base porque **reconstrói a curva dentro do próprio teste** (`funding-motor.test.ts:126-144`).

## A4 — adversarial: código × documentos

- **17 mentiras documentais confirmadas**, cada uma com texto substituto pronto: `padrao-incorporacao.md` 9 · `formulas.md` 3 · `CLAUDE.md` 3 · comentários de `fluxo-caixa-motor.ts` 2. **Zero** em `inteligencia-evi-incorporacao.md`.
- Os 4 lugares que negam a integração das safras: **todos falsos**. E a prova é mais forte que "opt-in" — `fluxo-pagamento-editor.ts:90` grava `componentes` em **toda** escrita.
- **`formulas.md:61-86`** diz que funding é "modelo de referência, não instalado" e aponta para a epic #239/Capital Stack, **que deixou de existir**. `funding-motor.ts` tem 862 linhas e golden de 80 períodos.
- **`CLAUDE.md:63-72`** apresenta #413/#414/#415/#416 como backlog aberto — **as quatro fecharam** no commit `ba06add` (PR #417).
- **7 comportamentos acidentais**, incluindo: `pos_obra.duracao_meses` mudou de significado sem mudar de rótulo; corretagem incide sobre permuta física (duas bases de VGV, `fluxo-caixa-motor.ts:258-263`); dois Grupos com o mesmo plano calculam diferente sem indicação em tela.

## A5 — conferência numérica contra Pinguim (20 achados, 17 reais)

- **`proforma-avancado.ts:92-93` soma o principal do funding ao custo** e nunca credita as entradas. Estudo 5: exibe −R$ 62.364.749,03 onde o real é R$ 24.668.189,10 (margem −47,87% vs **18,94%**). **4 margens líquidas e 3 resultados distintos para o mesmo estudo, na mesma sessão.** → *em conserto pelo B2*
- **Reabrir modal destrói dado, sem aviso e sem undo:** Pagamento apaga R$ 1.259.273,59 de juros (TIR 18,59% → **17,53%**); Absorção destrói curva personalizada de 43 meses (VPL −R$ 360.591,41). → *em conserto pelo B2*
- **`PATCH .../tipologias/:tid` (`avancado.ts:809-832`) grava sem validar saldo.** 234 alocadas + 42 permutadas sobre estoque de 234. Forense: a tipologia foi atualizada **10–11 s depois** da linha de permuta ser criada, nos dois estudos. → *em conserto pelo B2*
- 🔴 **`jurosClientes = 0` está REFUTADO, e a realidade é pior.** O estudo 5 **tem** `taxaMensal: 0.0098636` e o motor produz **R$ 1.259.273,59**. O estudo 6 tem 0 — e o `rotulo` denuncia: `"ao longo da obra (legado)"` é carimbo de `componentesDoLegado`. **O 6 passou pelo modal, o 5 não.** Não é "sempre 0", é **"vira 0 na primeira vez que alguém clicar em Aplicar"**.
- **Não é escolha de ramo:** as 6 linhas estão **todas no canônico**. A causa é exclusivamente a UI gravar `taxaMensal: 0`.
- **`pos_obra.duracao_meses = 13` é ignorado** e **descarta 1,41% das vendas do estudo 6 em silêncio — R$ 2.007.856,95.** Esticar a janela de vendas faz **vender menos**.
- **`modo:'personalizado'` EXISTE na instância** (estudo 6, curva de 43 meses, `aplicado: true`) — o dossiê estava errado.
- `correcao_estoque` é inerte, mas as 6 linhas estão em `false` → **estrutural, sem número atrás**.
- **Não deu para conferir:** cenários (vazios nos 2), equity (nenhuma operação — as divergências do A3 ficam sem evidência viva), paridade bundle-Pinguim × `main`, e backend/schema (SDK stub).

## A6 — auditoria de UI

- **Zero problemas de prop.** 391 tags `urbi-*`, 29 primitivos, ~1.100 atributos, `@property` resolvidos pela cadeia de herança + forma de binding conferida. Os 7 sinais brutos são falsos positivos.
- **Janela de versão quantificada:** monorepo `main` em 0.53.11, app declara `shell_min 0.53.8` e **não declara `sdk_min`**. Entre os dois: 12 props adicionadas, 2 removidas, **nenhuma usada pelo app**.
- **O modal fabrica dado:** `formularioPagamento` **nunca lê `fp.componentes`** e inventa uma entrada de **15%** que não existe (`fluxo-pagamento-editor.ts:37`); passa na validação porque o repasse derivado fecha 100%, e grava **15/30/55** onde estava **0/30/70**.
- **9 de 10 controles da aba Financeiro não fazem nada ali** — só `taxa_desconto_aa` tem efeito. Inclui uma segunda caixa "Sujeito a RET" (`sujeito_ret`) que só a proforma do **Preliminar** lê, numa tela que só renderiza no **Avançado**.
- **Tela e exportação formatam diferente:** `fluxo-tabela.ts:33-39` arredonda para **0 casas** e some com `< 0,50`; `exportar.ts:167-174` usa `fmtR$` com **2 casas** e corta em `< 0,005`. R$ 1.234,56 → `1.235` na tela, `1.234,56` no PDF. R$ 0,20 → **branco** na tela, `0,20` no PDF. **A #281 mudou de endereço, não foi resolvida.**
- **Item 6 → ENTREGUE** (converge com A1: é agrupamento, e era isso que o corpo pedia; `justify-items:start` é o que impede o campo de esticar).
- **Item 17 → NÃO RESOLVIDO.** Duas correções de uma linha, do lado do app. O comentário da #326 invoca `fluxo-tabela.ts` como "padrão comprovado", mas lá é uma **`<div>`**, não o primitivo — **analogia falsa**.
- **Item 24 → PARCIAL, com causa nova:** as larguras estão em **`<col>`**, que não recebe `font-size` e herda **1rem = 16px**, enquanto o conteúdo renderiza a 13px (`td`) / 12px (`th`) → colunas **~23% mais largas** que a intenção. E `--fonte` muda por tema (Montserrat → Chakra Petch), então **toda largura em `ch` muda ao trocar de tema**. **Diverge do A1:** com `ch` contra 1rem, "Unidades" provavelmente cabe; o corte confirmado é só "Dormitórios".
- Pede que **`avancado_capital_instrumentos` NÃO seja apagada do `schema.json`** nesta rodada — guarda o dado migrado pela `019`.

---

## O que se pede agora: **issues emergentes**

Não repita o que já está no seu documento. Procure o que **só existe no cruzamento**:

- Um achado seu que **muda de gravidade** à luz do achado de outro.
- Uma **causa comum** por trás de dois sintomas que foram catalogados separadamente.
- Uma **contradição entre dois agentes** que precisa virar pergunta ao autor em vez de veredito.
- Um risco que aparece só quando dois consertos são feitos **juntos** — inclusive os três que o B2 está aplicando agora.
- Algo que a **ausência de evidência** esconde: o A5 não conseguiu conferir cenários nem equity; o A6 não conseguiu confirmar a versão que Pinguim roda.

Cada issue emergente no formato do §6 do dossiê, dizendo **quais achados de quais agentes** ela combina.
