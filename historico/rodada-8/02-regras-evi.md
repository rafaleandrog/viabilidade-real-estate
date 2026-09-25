# Rodada 8 — A2 · Regras pela lente EVI Urbitá

> Fonte: `C:\Users\raafa\Downloads\20260730_EVI_Urbita_corrigido.xlsx` (9 abas, tabela `cfINC`
> de 114 colunas, ~200 `definedName`s). Extração por `<f>` (fórmula), não por `<v>` (valor) —
> método do §3 do dossiê. **Esta rodada especifica; não implementa.**
>
> Escopo desta lente: **velocidade de vendas** e **condições de pagamento**, mais o que a
> planilha revelar sobre etapas, premissas e resultados. Funding/dívida é a lente do A3 —
> aparece aqui só onde toca o recebível (repasse antecipado).
>
> **Revisão de 2026-08-21**, depois das quatro correções do A4 ao `00-dossie.md` (conferidas por
> mim no código): **R-A2-08 mudou de veredito** (o Pós-chaves de 12 meses é decisão implementada e
> corroborada pela planilha, não lacuna — minha proposta de reabrir a edição foi **retirada**);
> **R-A2-19 foi corrigida** (`indice_correcao` é coluna morta *sem* UI, não UI inerte); e entraram
> duas regras novas, **R-A2-21** (dois caminhos de cálculo para o mesmo plano) e **R-A2-22**
> (marketing na base de receita líquida — convergência com o A3).
>
> ⚠️ **Os números da EVI são exemplo, não hardcode.** Toda regra abaixo é acompanhada da
> taxonomia editável/fixo/fórmula. Nenhuma propõe fixar valor da planilha no código.

---

## 1. Mapa da planilha

### 1.1 As nove abas e o que cada uma faz

| # | Aba | Papel | Relevância p/ esta lente |
|---|---|---|---|
| 1 | `Projetos Inc` | Cadastro físico do projeto (coef. básico/máximo, gabarito, áreas privativas fechada/aberta resid e não-resid, custo de construção orçado × best guess). Alimenta os `info*` | média — define a **área privativa de venda** |
| 2 | `Areas e Precos` | Converte área × preço em **VGV de tabela**, separa permuta física, deriva preço médio ponderado por área fechada/aberta | **alta** |
| 3 | `Etapas Incorp` | Tabela `dadosPeriodosObra` — o **calendário** (Anterior, Projetos, Lançamento, Obra, Chaves, Pós-Chaves, Posterior) em meses relativos | **alta** |
| 4 | `Perfil Vendas` | O **contrato de vendas**: decomposição por momento e por tipo de contrato, em duas visões (total, resid, não-resid, NR normal, NR diferenciada) + verificação contra o realizado | **crítica** |
| 5 | `Premissas e Resultados` | Painel de **inputs** (prazos, cronograma de vendas, condições de pagamento, juros, financiamento, capital de giro) + proforma econômica + análise financeira (VPL, TIR, exposição) | **crítica** |
| 6 | `Incorp Individual` | A tabela `cfINC` — o **fluxo mês a mês**, mês −13 a ~+100. Onde as regras viram números | **crítica** |
| 7 | `Simulação Geral` | `cfGeral` — consolidação urbanizadora + incorporação + locadora, com aportes de sócio, funding de infra e reajuste anual de preço | baixa (lente do A3) |
| 8 | `Resultados GERAL` | Inputs e resultados do consolidado (`PeriodoDuracao`, `PrecoVendaIncrementoAnual`, funding infra/locadora, novo sócio) | baixa |
| 9 | `Aux Graf URB` | Auxiliar de gráfico | nenhuma |

### 1.2 O calendário (`Etapas Incorp`, tabela `dadosPeriodosObra`)

Com `PrazoAprovacaoProj = 12`, `EtapaLancamentoDuracao = 3`, `PrazoObra = 30`,
`EtapaChavesDuracao = 3`, `EtapaPosChavesDuracao = 12`:

| Etapa | Início | Duração | Fim | Fórmula da duração |
|---|---:|---:|---:|---|
| Anterior | −1000 | 988 | −13 | resíduo |
| Projetos | −12 | 12 | −1 | `PrazoAprovacaoProj` (`Premissas!D4`) |
| Lançamento | 0 | 3 | 2 | `EtapaLancamentoDuracao` (`Premissas!H7`) |
| **Obra** | 3 | 27 | **29** | `PrazoObra − EtapaLancamentoDuracao` — a janela **comercial**, que começa depois do Lançamento; a obra **física** roda de 0 a 29 (`cfINC[Obra] = Mês ≥ 0 AND Mês < PrazoObra`) |
| Chaves | 30 | 3 | 32 | `EtapaChavesDuracao` (`Premissas!H9`) |
| Pós-Chaves | 33 | 12 | 44 | `Etapas!E11` |
| Posterior | 45 | … | 1000 | resíduo |

Três fatos que valem ouro:

- **`EtapaObraFim = 29`** (`Etapas!F9`) é o **marco** de tudo: das parcelas de obra, do repasse
  (`= EtapaObraFim + 1 = 30`) e do gatilho de venda à vista pós-chaves.
- A obra **física** se sobrepõe ao Lançamento (obs. em `Etapas!C9`: *"sobrepõe-se ao lança/o"*);
  a janela **comercial** "Obra" não. Isso é exatamente a decisão #225 do app.
- `PrazoObra = 30` significa obra nos meses `0..29`. **Entrega = mês 29** pela convenção do app
  (`fimObra`), **mês 30** pela convenção do fluxo da planilha (`Chaves`). São a mesma data
  vista de dois lados — ver R-A2-04 e a lacuna nº 15 do dossiê.

### 1.3 A cadeia de fórmulas da **velocidade de vendas**

`cfINC[Área Vendida Residencial]` (coluna J) é a raiz de tudo:

```
IF( Mês >= PrazoObra AND Mês < PrazoObra + 12,
      (VendaEtapaChavesPercSobreVgv + VendaAposChavesPercSobreVgv) / 12,
      SWITCH( Etapa,
          Lançamento, VendaLancamentoPercSobreVgv  / EtapaLancamentoDuracao,
          Obra,       VendaDuranteObraPercSobreVgv / EtapaObraDuracao,
          0 ) )
  * infoAreaPrivativaDeVendaResidencial
```

Leitura:

1. A velocidade é **uniforme dentro de cada janela** — não há curva S, sazonalidade nem VSO alvo.
2. As janelas são três: **Lançamento** (`EtapaLancamentoDuracao` meses),
   **Durante a obra** (`EtapaObraDuracao` meses) e **Pós-entrega** (**12 meses fixos** a partir de
   `PrazoObra`).
3. Os percentuais `Chaves` (50%) e `Após chaves` (15%) são **inputs separados no painel**, mas a
   fórmula os **soma e espalha junto**. A separação existe só para a verificação de `Perfil Vendas`.
4. `VendaAposChavesPercSobreVgv` (`Premissas!D10`) é **derivado**:
   `= 1 − Lançamento − Obra − Chaves`. Idêntico ao `pctPosObraDerivado` do app.
5. A absorção é expressa em **m²**, não em % de VGV — e há um **livro de estoque físico**
   (`cfINC[Estoque Residencial]`, coluna M) que decrementa a cada venda e a cada permuta física.
   Não há trava: se os % somarem >100%, o estoque fica negativo em silêncio.
6. Não há reajuste de preço ao longo do tempo no fluxo da Incorporação. O preço é
   `PrecoMedioResidencial`, constante. (`PrecoVendaIncrementoAnual` existe, mas só na
   `Simulação Geral` — `Resultados GERAL!F4`.)

**Confirmação numérica** (mês 0, `Perfil Vendas` + `cfINC` linha 19):
`0,15 / 3 × 16.410,184929 m² = 820,50924646 m²` → `× R$ 9.266,2236553/m² = R$ 7.603.022,19`
de venda contratada. Bate com `cfINC[Vendas Contratadas]` do mês 0.

### 1.4 A cadeia de fórmulas das **condições de pagamento**

`Perfil Vendas` é uma **árvore de participações**, não uma lista de parcelas. Duas decomposições
da mesma coisa (linhas 4–12 "POR MOMENTO", linhas 13–26 "POR TIPO CONTRATO"), com uma verificação
cruzada em B28/G31 que fecha o modelo.

**Nível 1 — momento** (`Perfil Vendas!L6:L12`, coluna Residencial):

| Momento | Célula | % sobre VGV | Origem |
|---|---|---:|---|
| Permuta física | `M6` | 11% | `PermutaFisicaResidencial` (`Premissas!N4`) — **sai do VGV**, não é venda |
| Pré-chaves: Lançamento | `L8` | 15% | `VendaLancamentoPercSobreVgv` (`Premissas!D7`) |
| Pré-chaves: Obra | `L9` | 20% | `VendaDuranteObraPercSobreVgv` (`Premissas!D8`) |
| Pós-chaves: Chaves | `L11` | 50% | `VendaEtapaChavesPercSobreVgv` (`Premissas!D9`) |
| Pós-chaves: Final | `L12` | 15% | derivado (`Premissas!D10`) |

**Nível 2 — tipo de contrato, só para as vendas PRÉ-CHAVES** (`Perfil Vendas!K16:K26`):

| Tipo | Célula | % sobre pré-chaves | Origem |
|---|---|---:|---|
| À vista | `K16` | 10% | `VendaAVistaPercSobrePreChaves` (`Premissas!D12`) |
| Tabela curta | `K18` | 10% | `VendaTCurtaPercSobrePreChaves` (`Premissas!D14`) |
| Tabela longa | `K21` | 80% | derivado: `1 − à vista − curta` (`Premissas!H12`) |

**Vendas PÓS-CHAVES são 100% à vista** — `cfINC[Receita à Vista Residencial]` (coluna O):
`SWITCH(Etapa; Chaves → 1; Pós-Chaves → 1; Lançamento/Obra → VendaAVistaPercSobrePreChaves; 0)`.

**Nível 3 — o cronograma interno de cada tipo:**

| Tipo | Regra | Fórmula |
|---|---|---|
| **À vista** | recebido no mês da contratação | col. O/P/Q |
| **Tabela curta** | `Sinal` = `VendaTCurtaSinalPercSobreTabela` (15%, `Premissas!D15`) no mês da contratação; os 85% restantes em **`TabCurtaDuracao` = 36 PMTs**, 1ª no mês seguinte, a `ClienteJurosAM` | cols. AU, AW, AY, BA |
| **Tabela longa — Obra** | `VendaTLongaObraPercSobreTabela` (30%, `Premissas!H13`) amortizado por **PMT até `EtapaObraFim`**; `N_s = EtapaObraFim − s`, 1ª parcela em `s+1` — safra tardia tem menos parcelas e cada uma é maior | cols. AD, AF |
| **Tabela longa — Repasse antecipado** | `FinancProdPercentualRepasseAntecipado` (0% aqui, `Premissas!H15`) do saldo, antecipado na assinatura | cols. X–AC (zeradas no exemplo) |
| **Tabela longa — Repasse** | o restante (70%) fica em `Saldo Para Repasse`, capitalizando a `ClienteJurosAM`, e é **liquidado num único mês: `EtapaObraFim + 1`** | cols. AH, AJ, AL, AN |

**Juros de tabela** (`Premissas!H14` `ClienteJurosAA = 12,5% a.a.`; `H22` não-resid `13% a.a.`):

```
ClienteJurosAM = (1 + ClienteJurosAA)^(1/12) − 1      ← definedName
```

Incidem em **três** lugares: PMT da tabela curta, PMT da tabela longa/obra, e capitalização
mensal do saldo a repassar (`AJ = saldo_anterior × ClienteJurosAM`).

**Carteira de clientes** (`cfINC[Carteira Clientes]`, coluna BF) = carteira TLonga obra
(resid + não-resid) + saldo a repassar (resid + não-resid) + carteira TCurta (resid + não-resid).
No exemplo chega a **R$ 38,79 MM no mês 28** — 22,2% do VGV — e despenca para R$ 2,1 MM no mês 30,
quando o repasse liquida.

### 1.5 O que a planilha diz sobre o efeito dos juros no resultado

`Areas e Precos!C30` compara `VGV Tab Disponível` (R$ 165.888.970) com `VGV Realizado Inc`
(R$ 174.870.232). A nota em `E30` é explícita:

> **"← só é zero se tabela cliente não tiver juros"**

Ou seja: **R$ 8,98 MM (5,41% do VGV de tabela) da Receita Bruta da EVI é juros de tabela.**
E `Perfil Vendas!B28` diz, na cara: *"Só batem quando zerar juros tabela cliente (12,5% aa)"*.

**No app esse número é exatamente zero em qualquer estudo real** (lacuna nº 1 do dossiê).

### 1.6 Demais regras que a planilha revela (fora do núcleo vendas/pagamento)

| Regra | Fórmula | Onde |
|---|---|---|
| Imposto incide sobre **receita recebida** | `ImpostoPercentVgv × Receita Total` | `cfINC` col. BK |
| Corretagem incide sobre **valor contratado**, no mês da venda | `−CustoCorretagemPerc × Vendas Contratadas` | col. BL |
| Marketing é **antecipado**: 1% do VGV total diluído nos `PrazoAprovacaoProj` meses da fase Projetos | `IF(Etapa = Projetos; MarketingPercentVgv × SUM(Receita Total)/PrazoAprovacaoProj; 0)` | col. BM |
| Permuta financeira é paga **pro rata da receita recebida**, com dois flags independentes de dedução | `−|perm%| × Receita Total × MAX(0; 1 − deduzImpostos×|imp%| − deduzCorretagem×|corr%|)` | col. BN/BO, flags `Premissas!N17`/`N18` |
| Permuta **física** é paga **em área, no mês do lançamento**, e reduz a área de venda | col. G/H, `Areas e Precos!F17 = F14 − F18` | — |
| Preço de tabela pondera **área fechada × área aberta** com deflator | `Preço Aberta = Preço Fechada × (1 − PrecoAreasAbertasDeflator)`, deflator 50% (`Premissas!O10`) | `Areas e Precos!F8` |
| Fin. à produção libera por **exposição mínima incorrida**, com catch-up retroativo e cash sweep | cols. CB–CH | lente do A3 |
| Capital de giro: volume, mês de tomada, juros a.a., **carência só-juros**, PMT no prazo restante | cols. CK–CQ | lente do A3 |

---

## 2. Regras

### R-A2-01 — Taxa de juros de tabela por componente, editável por estudo

**Veredito:** **DIVERGENTE**
**Fonte:** `Premissas e Resultados!H14` (`ClienteJurosAA = 12,5% a.a.`), `!H22`
(`ClienteNaoResidJurosAA = 13% a.a.`); definedName `ClienteJurosAM = (1+ClienteJurosAA)^(1/12)−1`;
uso em `cfINC` cols. AD/AE (PMT obra), AY/AZ (PMT curta), AJ/AK (juros do saldo a repassar);
efeito agregado em `Areas e Precos!C30`+`E30`.
**No código hoje:**
- `frontend/fluxo-caixa-motor.ts:527-550` — o contrato `ComponentePagamento` **já tem**
  `taxaMensal` nos três tipos financiados.
- `frontend/fluxo-caixa-motor.ts:589,601,608,617` — `componentesDoLegado` grava
  `taxaMensal: 0` nos quatro caminhos, sem exceção.
- `frontend/fluxo-pagamento-editor.ts:90` — `fluxoPagamentoParaSalvar` **sempre** persiste
  `componentes: componentesDoLegado(form, cronograma)`; o usuário nunca escreve `componentes`
  à mão.
- `frontend/tela-fluxo-receitas.ts:741-816` — o modal "Fluxo de pagamento" não tem nenhum campo
  de taxa.
- Consequência: `frontend/fluxo-caixa-motor.ts:2050` → `jurosClientes = 0` em 100% dos estudos.
  A matemática existe e está integrada (`:1064-1163`, `:1340-1341`), só nunca recebe taxa ≠ 0.

> ✅ **Isto é uma mudança de `sim` para `sim, e o encanamento já está pronto`.** Como
> `fluxoPagamentoParaSalvar` grava `componentes` em **toda** escrita, **todo Grupo já editado
> desde a #248 roda pelo motor de safras** — não é opt-in que ninguém acionou. Não há trabalho de
> "integrar o motor ao `calcularFluxo`": isso está feito. O que falta é **exclusivamente a
> superfície de entrada** — um campo de taxa no modal e a propagação dele em
> `componentesDoLegado`. É a menor mudança desta lista com o maior efeito econômico.
> Ressalva: Grupos **nunca abertos** no modal continuam no ramo legado e **não conseguem** receber
> juros — ver R-A2-21, que é precondição desta regra valer para o estudo inteiro.

**Regra proposta:**
> O plano de pagamento de cada linha de receita declara uma **taxa de juros de tabela em % a.a.**,
> convertida para mensal por `i_m = (1 + i_aa)^(1/12) − 1` (contrato C18 da
> `inteligencia-evi-incorporacao.md:164`), com precisão plena internamente e arredondamento só na
> exibição. A taxa é **por componente**: cada linha de Entrada, cada linha de Parcelamento e o
> Repasse têm a sua, com default herdado de um campo único "Juros de tabela (% a.a.)" do plano.
> `0%` continua sendo válido e é o **default de todo estudo existente** — nenhum estudo muda de
> resultado sem alguém digitar a taxa.
> Taxonomia: **editável por estudo/linha** (`% a.a.`, inteiro ou 1 casa). **Fórmula** derivada:
> `taxaMensal`. **Fixo:** nada.

**Como verificar:**
1. Teste de safra única replicando o mês 0 da EVI (ver §3): componente `prazo_fixo`
   `participacaoPct 10 / sinalPct 15 / prazoMeses 36 / defasagemMeses 1 / taxaMensal 0,0098635806`
   sobre `R$ 7.603.022,19` deve dar sinal `R$ 114.045,33` no mês 0 e **36 parcelas de
   R$ 21.414,48** nos meses 1..36 — o valor que a EVI mostra em `cfINC!AY20`.
2. `calcularFluxo` do mesmo estudo com taxa 0 e com taxa 12,5% a.a.: a diferença de
   `receitaBrutaMensal` somada tem de ser exatamente `jurosClientes`, e o invariante
   `frontend/fluxo-invariantes.ts:66` (`vendaLiquidaContratada + jurosClientes`) tem de continuar
   fechando.
3. Regressão: rodar a suíte inteira **sem** informar taxa e conferir que nenhum número muda.

**Custo/risco:** **nenhum** para estudo existente (default 0). `fluxo_pagamento` é coluna
`json` (`schema.json:305,320`) → **sem migração, sem bump de `versao`**. O risco real é de
comunicação: quando alguém ligar a taxa, VGV, Resultado e margem sobem — é preciso a UI dizer
que a Receita Bruta passou a incluir juros (contrato C9/C10 do doc consultivo, linhas 155-156).

---

### R-A2-02 — Sinal na contratação, como fração do componente parcelado

**Veredito:** **DIVERGENTE** (o contrato existe; a UI não o alimenta)
**Fonte:** `Premissas e Resultados!D15` (`VendaTCurtaSinalPercSobreTabela = 15%`), `!H20`
(não-resid); `Perfil Vendas!I19/I20` (`Sinal` × `Parcelado` dentro da Tabela Curta);
`cfINC!AU` (`Sinal TCurta Resid = 15% × Vendas TCurta Contratadas`).
**No código hoje:** `ComponentePagamento.sinalPct` existe em `prazo_fixo` e `ate_marco`
(`frontend/fluxo-caixa-motor.ts:534,543`) e é honrado por
`pagamentosPrazoFixo`/`pagamentosAteMarco` (`:688,731`). `componentesDoLegado` grava
`sinalPct: 0` em todos os casos (`:589,601,608`). Não há campo no modal.
**Regra proposta:**
> Cada componente parcelado (`prazo_fixo`, `ate_marco`) aceita um **sinal em % do próprio
> componente**, pago no mês da contratação e **fora do cálculo de juros** (o sinal não amortiza:
> `principal = valor − sinal`, como já implementado). O sinal é distinto da linha de Entrada:
> Entrada é % **do total da venda**; sinal é % **daquele componente**.
> Taxonomia: **editável**, `%` com 2 casas, default `0`.

**Como verificar:** safra do mês 0 da §3 — com `sinalPct = 15` sobre o componente de 10%,
o mês 0 recebe `R$ 760.302,22` (à vista) `+ R$ 114.045,33` (sinal) `= R$ 874.347,55`, que é
exatamente `cfINC!BI19` (`Receita Total` do mês 0).
**Custo/risco:** nenhum com default 0. Cuidado de UX: hoje o mesmo efeito é obtido criando uma
segunda linha de Entrada de 1,5%; as duas formas coexistirão e podem confundir — ver Pergunta Q3.

---

### R-A2-03 — Juros sobre o saldo a repassar entre a contratação e o repasse

**Veredito:** **DIVERGENTE**
**Fonte:** `cfINC!AJ` (`Juros Saldo Repasse Resid = saldo_anterior × ClienteJurosAM`),
`!AL` (`Repasse = Saldo + Juros`, no mês `EtapaObraFim + 1`), `!AN` (rolagem do saldo).
**No código hoje:** `pagamentosConcentrado` (`frontend/fluxo-caixa-motor.ts:774-786`) implementa
exatamente essa capitalização — `valor = principal × (1 + taxaMensal)^(mesPagamento − safra)`,
com a convenção "juros começam depois da contratação" (idêntica à da planilha). Mas
`componentesDoLegado:617` cria o `concentrado` com `taxaMensal: 0`, e o rótulo do próprio código
diz *"repasse legado"*.
**Regra proposta:**
> O saldo a repassar de cada safra **capitaliza mensalmente** à taxa de tabela do componente,
> desde o mês **seguinte** ao da contratação até o mês do repasse. O valor repassado é
> `principal × (1 + i_m)^(mês_repasse − safra)`; a diferença é juros e entra em `jurosClientes`,
> não em principal.
> Taxonomia: **editável** (a mesma taxa de R-A2-01, aplicada ao componente `concentrado`).

**Como verificar:** safra do mês 0 (§3): principal `R$ 4.257.692,43` (56% de 7.603.022,19) — que
é exatamente `cfINC!AH19` — deve ser pago no mês 30 por
`4.257.692,43 × 1,0098635806^30 = R$ 5.715.517,93`, gerando `R$ 1.457.825,50` de juros.
**Custo/risco:** é **o maior item de juros do modelo** — 78% dos juros da safra do exemplo. Ligar
isso muda VGV e Resultado de forma visível. Default 0 preserva estudos existentes.

---

### R-A2-04 — Repasse no 1º mês após o fim da obra

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `cfINC!AL` — `IF(Mês = EtapaObraFim + 1; Saldo + Juros; 0)`. Com `EtapaObraFim = 29`,
o repasse cai no mês **30**, e `cfINC!AL49` mostra `R$ 36.849.215,30` nesse mês.
**No código hoje:** `frontend/fluxo-caixa-motor.ts:325` `REPASSE_MESES_APOS_ENTREGA = 1` e
`:616` `mesRepasse = fimObra + 1`, com `fimObra = obra.inicio + obra.duracao − 1 = 29`.
**Coincidência exata.** A #345 travou isso e estava certa.
**Regra proposta:** manter. Registrar no documento de fórmulas que a coincidência com a EVI foi
verificada em 2026-08-21 e que `apos_entrega_meses` **não deve** voltar a ser editável sem
evidência nova.
**Como verificar:** `mesRepasse == mesEntrega + 1` e `mesEntrega == fimObra`.
**Custo/risco:** nenhum. **Resolve parcialmente a lacuna nº 15 do dossiê**: as "duas definições de
entrega" são a mesma data — o app chama de `fimObra` o último mês de obra (29) e a planilha chama
de `Chaves` o primeiro mês depois (30). Nenhum cálculo diverge por isso.

---

### R-A2-05 — Parcelas "ao longo da obra": PMT com prazo decrescente por safra

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `cfINC!AD` — `PMT(ClienteJurosAM; MAX(0; EtapaObraFim − (Mês−1)); −30% × contratado(Mês−1))`,
acumulado sobre `N(AD_anterior)`. Cohort de `s` → `N_s = EtapaObraFim − s` parcelas, 1ª em `s+1`,
última em `EtapaObraFim`.
**No código hoje:** `pagamentosAteMarco` (`frontend/fluxo-caixa-motor.ts:713-751`):
`nParcelas = marcoMes − safra − (defasagemMeses − 1)`, 1ª em `safra + defasagemMeses`. Com
`marcoMes = fimObra` e `defasagemMeses = 1` (o que `componentesDoLegado:604` grava), dá
`N_s = fimObra − safra`, meses `s+1 .. fimObra`. **Idêntico.**
**Regra proposta:** manter; só falta a taxa (R-A2-01).
**Como verificar:** safra 0, `marcoMes = 29`, 24% de `R$ 7.603.022,19 = R$ 1.824.725,33`
(= `cfINC!AF19`), taxa `0,0098635806` → **29 parcelas de R$ 72.656,88**, que é `cfINC!AD20`.
**Custo/risco:** nenhum.

---

### R-A2-06 — Venda contratada depois da entrega é recebida 100% à vista

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `cfINC!O` — `SWITCH(Etapa; Chaves → 1; Pós-Chaves → 1; …)`. E `cfINC!S49 = 0`
(nenhuma venda a prazo no mês 30 em diante).
**No código hoje:** `ehVendaAposChaves(safra, mesEntrega) = safra > mesEntrega`
(`frontend/fluxo-caixa-motor.ts:945-947`) e `componentesEfetivosSafra` substitui tudo por um
`imediato` de 100% (`:949-956`). Com `mesEntrega = fimObra = 29`, a regra dispara a partir do mês
30 — o **primeiro mês da etapa Chaves da planilha**. **Coincidência exata.**
**Regra proposta:** manter. Documentar a coincidência.
**Como verificar:** absorção no mês 29 usa os componentes; no mês 30, `bruto == recebido`.
**Custo/risco:** nenhum.

---

### R-A2-07 — Resíduo de `ate_marco` com prazo zero: vira repasse, não caixa imediato

**Veredito:** **DIVERGENTE** (pequeno em valor, real em conceito)
**Fonte:** `cfINC!AH48` (mês 29, `m até chaves = 0`): o `IF(m até chaves > 0; 30% × contratado; 0)`
falha, então **os 30% da tabela longa daquela safra não viram parcela de obra — rolam inteiros
para o saldo a repassar** e são pagos no mês 30 com juros. `AH48 = AN47 + V48 = R$ 36.141.701,63`
absorve os 100% da TL do mês 29, não 70%.
**No código hoje:** `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030-1042`)
converte o componente `ate_marco` com `N_s ≤ 0` em **`imediato`** — recebido no próprio mês 29,
sem juros. A escolha está documentada e é defensável, mas **não é a da EVI**.
**Regra proposta:**
> Quando um componente `ate_marco` não tem prazo (`N_s ≤ 0` — venda no mês do marco), sua
> participação é **transferida para o componente `concentrado` da mesma linha**, se houver, e só
> vira `imediato` se não houver nenhum. O comportamento é declarado no plano
> (`residuoAteMarco: 'concentrado' | 'imediato'`), com default **`imediato`** para não mudar
> estudo existente.
> Taxonomia: **editável** (enum), default preserva o vigente.

**Como verificar:** estudo com absorção 100% no último mês de obra e plano
`24% ate_marco + 56% concentrado`: com `'imediato'`, 24% entra no mês `fimObra`; com
`'concentrado'`, 80% entra no mês `fimObra+1` corrigido.
**Custo/risco:** afeta **uma única safra** (a do mês do marco), mas antecipa/atrasa caixa num mês
crítico para a exposição máxima. Nenhum estudo muda sem o autor trocar o enum.

---

### R-A2-08 — Prazo da tabela curta é premissa; a janela Pós-chaves de 12 meses **não é lacuna**

**Veredito:** **JÁ IMPLEMENTADA** (janela Pós-chaves) · **JÁ IMPLEMENTADA** (prazo da tabela curta)
**Fonte:** a EVI trata os dois de formas opostas:
- `TabCurtaDuracao = 36` é **`definedName` literal do workbook** — não é célula, não é input;
  `Premissas!F11` apenas *avisa*: `"(obs. Tab curta com 36 meses)"`.
- A janela pós-entrega da absorção é **`12` literal dentro da fórmula** `cfINC!J`
  (`IF(Mês >= PrazoObra AND Mês < PrazoObra + 12; (Chaves% + Após%)/12; …)`) — a planilha
  **não** usa `EtapaChavesDuracao` nem `EtapaPosChavesDuracao` para distribuir vendas, embora
  as duas sejam inputs (`Premissas!H9`, `Etapas!E11`).

**No código hoje:**
- Prazo da tabela curta: **editável** — campo "Nº parcelas" do bloco Parcelamento
  (`frontend/tela-fluxo-receitas.ts:790-794`), vira `prazo_fixo.prazoMeses`. **O app é mais
  expressivo que a planilha aqui.**
- Janela Pós-chaves: `APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237`), usada em
  `faixasAbsorcao:285` e exibida como derivada em `tela-fluxo-receitas.ts:583-586`.
  `pos_obra.duracao_meses` é ignorado **de propósito** (#226).

> 🔴 **Correção da minha primeira redação, e disputa aberta — registrada, não resolvida.**
> Minha versão anterior propunha devolver a edição do Pós-chaves. **Retirada.** Isso desfaria a
> #226 sem mandato, e as três fontes discordam entre si:
>
> | Fonte | O que diz |
> |---|---|
> | `docs/viabilidade/padrao-incorporacao.md:628-631` (§8.5, *Modelo funcional de referência*) | `duração do Após-chaves = 12 meses` |
> | `padrao-incorporacao.md:634-637` (*Comportamento vigente*) | "a **duração é livre e editável**… Há estudos gravados com duração diferente de 12" — **texto vencido**: descreve o app de antes da #226 |
> | `padrao-incorporacao.md:639-643` (*Evolução dependente de issue*) | EVI-007 pede **fixar em 12**, avisando que é "a issue com maior impacto em dados legados desta rodada" |
> | `00-dossie.md` §4.5 item 5 | listava como lacuna |
>
> **A EVI Urbitá vota com a #226:** `cfINC!J` distribui em **12 meses literais**, ignorando os
> próprios inputs de duração. A implementação vigente é a que reproduz a planilha.

**Regra proposta:**
> Manter `APOS_CHAVES_MESES = 12` como está. Corrigir o **texto vencido** de
> `padrao-incorporacao.md:634-637` para dizer que a #226 já fixou a duração, e registrar ali que
> a EVI-007 **foi entregue**. Documentar que a EVI Urbitá corrobora a constante.
> Taxonomia: **fixo** — por decisão da #226, corroborada pela planilha. Reabrir a edição é
> pergunta ao autor (Q4), **não** proposta desta rodada.
> A duração das parcelas de tabela curta continua **editável por componente**, como já é.

**Como verificar:** `faixasAbsorcao(crono).pos_obra` tem sempre 12 meses, começando em
`fimObra + 1`, independentemente de `pos_obra.duracao_meses`. `cfINC!J49 = 888,885 m²`
(`= 0,65/12 × 16.410,18`) confirma o divisor 12 na planilha.
**Custo/risco:** **zero** — nada muda. ⚠️ O risco que esta regra elimina é o de uma rodada futura
"corrigir" a constante lendo só o *Comportamento vigente* do `padrao-incorporacao.md`, que está
desatualizado, e reintroduzir a divergência com a planilha e com estudos legados.

---

### R-A2-09 — Absorção uniforme por janela, com pós-chaves derivado

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `cfINC!J` (§1.3) — `pct_janela / duração_janela`, uniforme; e
`Premissas!D10 = 1 − Lançamento − Obra − Chaves` (derivado).
**No código hoje:** `absorcaoMensal` modo `distribuido` (`frontend/fluxo-shared.ts:390-401`)
espalha `pct/dur` uniformemente em cada faixa; `pctPosObraDerivado` (`:325-327`) deriva o 4º
bloco. As faixas de `faixasAbsorcao` (`:259-286`) coincidem com as etapas da planilha, inclusive
a decisão #225 de a janela "Durante a obra" começar depois do Lançamento
(`Etapas!D9 = F8 + 1`).
**Regra proposta:** manter. Registrar a coincidência para não ser "corrigida" por engano.
**Como verificar:** cronograma Lançamento 0..2, Obra 0..29, Pós-chaves 30..41 com
15/20/65 → 5,00%/mês nos meses 0–2, `20/27 = 0,7407%`/mês nos meses 3–29, `65/12 = 5,4167%`/mês
nos meses 30–41. `cfINC!J49 = 888,885 m² = 0,0541667 × 16.410,18`. ✔
**Custo/risco:** nenhum. Contraponto à lacuna nº 4 do dossiê: **para reproduzir a EVI, curva
uniforme basta** — curva S / sazonalidade / VSO alvo são evolução, não paridade.

---

### R-A2-10 — Velocidade de vendas legível em m², unidades e VSO, com estoque físico

**Veredito:** **AUSENTE**
**Fonte:** `cfINC!J/K/L` (área vendida por mês, em m²), `!M/N` (`Estoque Residencial` /
`Estoque Não Residencial`, decrementados por venda **e** por permuta física),
`Areas e Precos!C17/F17/I17` (área privativa **de venda** = privativa − permuta física).
**No código hoje:** a absorção é % de VGV (`vendaBrutaContratadaMensal`,
`frontend/fluxo-caixa-motor.ts:417-431`: `vgv × pct / 100`). Não há série de área nem de
unidades, nem estoque. Os dados existem — `avancado_tipologias` tem `area_privativa_m2`,
`quantidade` e `unidades_permutadas` (`schema.json:331,334,335`).
**Regra proposta:**
> O motor expõe, além do % e do R$: **área vendida por mês (m²)**, **unidades vendidas por mês**
> e **estoque remanescente** (m² e unidades), tudo **derivado** da absorção e das tipologias da
> linha — sem novo input. A partir deles a tela mostra a **VSO mensal**
> (`vendas do mês ÷ estoque disponível no início do mês`). Unidades usam arredondamento de
> exibição; o estoque canônico é em m², como na planilha.
> Taxonomia: **fórmula** (100% derivado). **Nada editável** nesta regra.
> A permuta física baixa o estoque no mês do Lançamento, como em `cfINC!G/H`.

**Como verificar:** linha com 1 tipologia de 16.410,185 m² e absorção 15/20/65 →
`m²(mês 0) = 820,509`; `estoque(mês 0) = 15.589,676` (= `cfINC!M19`, após a permuta física de
2.028,225 m² no mesmo mês).
**Custo/risco:** nenhum no cálculo financeiro — é série nova, ninguém a consome hoje. Fecha
parcialmente a lacuna nº 11 do dossiê. **Não** propõe travar a venda no estoque: a EVI também não
trava (o estoque dela fica negativo se os % somarem >100%), e o app já barra soma >100% em
`erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:335-343`).

---

### R-A2-11 — Regime de vendas diferenciado por segmento

**Veredito:** **DIVERGENTE (parcial — a estrutura existe, o efeito prático não)**
**Fonte:** `Premissas!H16` `VendasNaoResidDiferenciarCondicoes` — um **flag** que, ligado,
substitui **todo** o bloco de premissas comerciais pelo espelho não-residencial (`D17:D20`,
`H17:H22`); 12 `definedName`s do tipo
`IF(VendasNaoResidDiferenciarCondicoes; …Input; …Residencial)`. A EVI vai além: distingue ainda
"NR normal" × "NR diferenciada", esta última vendida à vista num único mês
(`vendaDiferenciadaNaoResidInicioObra`, `Premissas!M11`: `"início"` da obra ou `"final"`).
**No código hoje:** cada linha de receita tem `absorcao` e `fluxo_pagamento` próprios
(`schema.json:304-305`), então **duas linhas já dão dois regimes**. O que falta: a UI não sugere
esse uso, não há herança de premissas globais para as linhas, e não há como declarar "esta
tipologia inteira é vendida à vista no mês X".
**Regra proposta:**
> Confirmar por escrito que **linha de receita é a unidade de regime comercial**: cada uma tem
> sua absorção, seu plano de pagamento e sua taxa. O painel de premissas do estudo guarda um
> **default herdado** por linhas novas, nunca um valor que sobrescreva o que a linha já gravou.
> Taxonomia: **editável por linha**; o default global é **editável por estudo**.

**Como verificar:** dois grupos (Residencial 12,5% a.a. / Não residencial 13% a.a.) produzem
`jurosClientes` = soma dos dois, e `receitaPorComponenteMensal` agrega os dois sem misturar
carteiras (cada safra é isolada — `frontend/fluxo-caixa-motor.ts:1094`).
**Custo/risco:** baixo. É sobretudo UX e documentação.

---

### R-A2-12 — Juros de clientes e carteira máxima como indicadores de tela

**Veredito:** **DIVERGENTE**
**Fonte:** `Premissas!V8/V9` (`Exposição máx. pós lançamento`, `Exposição máxima`, com o **mês**
em que ocorre: `"5,84% VGV no mês 28"`), `cfINC!BF` (`Carteira Clientes`, pico de
R$ 38,79 MM no mês 28 = 22,2% do VGV), `cfINC!DA` (`Destaques Carteira` — a planilha marca
graficamente o mínimo e o máximo da carteira).
**No código hoje:** `jurosClientes`, `carteiraClientesMaxima` e `mesCarteiraClientesMaxima` são
calculados (`frontend/fluxo-caixa-motor.ts:2050-2053`) e **só aparecem na exportação**
(`frontend/exportar.ts:351-352,442-443`). Nenhum KPI de tela. Os mapas de rótulos
`ROTULOS_COMPONENTES_RECEITA`/`_CARTEIRA` (`fluxo-caixa-motor.ts:1013-1027`) estão sem
consumidor, com comentário admitindo isso.
**Regra proposta:**
> A tela de resultado do Avançado mostra, como KPIs de primeira classe: **Juros de clientes**
> (R$ e % da Receita Bruta), **Carteira máxima de clientes** (R$, % do VGV **e o mês**) e
> **Exposição máxima de caixa** (R$, % do VGV e o mês). Os três já existem no `FluxoCalc`; a
> regra é de superfície, não de cálculo.
> Taxonomia: **fórmula** (derivado). Nada editável.

**Como verificar:** `carteiraClientesMaxima` e `mesCarteiraClientesMaxima` renderizados batem com
o `max`/`indexOf` de `carteiraClientesMensal`.
**Custo/risco:** nenhum no motor. **Mas hoje os três leriam zero ou quase** — só ficam
informativos depois de R-A2-01/03. Implementar junto, ou o KPI nasce mentindo.

---

### R-A2-13 — Repasse antecipado na assinatura

**Veredito:** **AUSENTE**
**Fonte:** `Premissas!H15` `FinancProdPercentualRepasseAntecipado`, com o rótulo `E15`
*"Repasse antecip a VP na assin."*; `Perfil Vendas!I23`
`(1 − VendaTLongaObraPercSobreTabela) × FinancProdPercentualRepasseAntecipado`;
`cfINC` cols. X–AC (`Repasse a antecipar`, `Liberação repasse antecipado`,
`Rep. a antecipar acum.`) — **presentes, nomeadas, e fixas em `0` neste arquivo**.
**No código hoje:** não existe. O `concentrado` é único e integral.
**Regra proposta:**
> O componente de repasse admite uma **fração antecipada**: `p%` do saldo é liquidado no **mês da
> assinatura** (a própria safra), a valor presente, e o restante `(1−p)%` segue para o repasse no
> marco. Modela o produto bancário em que o banco antecipa parte do crédito ao incorporador.
> Taxonomia: **editável por componente**, `%` com 2 casas, default **0** — que reproduz o
> comportamento atual **e** o arquivo da EVI.

**Como verificar:** com `p = 0`, nenhum número muda. Com `p = 30%`, a safra `s` recebe
`0,30 × principal` no mês `s` e `0,70 × principal × (1+i)^(R−s)` no mês `R`.
**Custo/risco:** nenhum com default 0. ⚠️ **A EVI zera este campo** — não há caso de teste real
na planilha. Ver Pergunta Q5 antes de implementar.

---

### R-A2-14 — Corretagem sobre contratado, imposto sobre recebido

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `cfINC!BL` (`−CustoCorretagemPerc × Vendas Contratadas`) contra `cfINC!BK`
(`ImpostoPercentVgv × Receita Total`). São bases e momentos **diferentes** de propósito.
**No código hoje:** corretagem — `corretagemMensal` (`frontend/fluxo-caixa-motor.ts:1503`), paga
integralmente no mês da venda com base no **bruto contratado** (decisão do autor 2026-08-01,
`:1496-1501`). Imposto/RET — `impostoMensal` (`:1434-1444`), `% × recebimentoBrutoMensal`.
**Coincidência exata nas duas.**
**Regra proposta:** manter, e registrar que a coincidência foi verificada — este é o par mais
fácil de "consertar" por engano para uma base só.
**Como verificar:** corretagem total `= corretagem% × Σ venda bruta contratada`;
imposto total `= ret% × Σ recebimento bruto` (que **inclui juros**, logo cresce quando R-A2-01
entrar).
**Custo/risco:** nenhum. ⚠️ Alerta para a rodada de implementação: ligar os juros **aumenta a
base do RET** sem aumentar a base da corretagem. É correto, e é contraintuitivo.

---

### R-A2-15 — Permuta financeira: dedução de imposto e de corretagem são dois flags independentes

**Veredito:** **DIVERGENTE (menor)**
**Fonte:** `Premissas!N17` (`permutaFinanceiraCorretagemDeduzir`) e `!N18`
(`permutaFinanceiraImpostosDeduzir`), **dois booleanos separados**;
`cfINC!BN = −|perm%| × Receita Total Resid × MAX(0; 1 − deduzImp×|imp%| − deduzCorr×|corr%|)`.
Note que a planilha aplica as **alíquotas** à receita do mês, não as séries realizadas.
**No código hoje:** `permuta_financeira_base` é um enum `bruta | liquida`
(`frontend/fluxo-caixa-motor.ts:1550-1555`) — **um** flag para os dois; e a base líquida usa as
**séries realizadas** de imposto e corretagem (`permutaFinanceiraLiquidaMensal:1565-1572`).
**Regra proposta:**
> A base da permuta financeira declara **duas** deduções independentes: `deduzir_imposto` e
> `deduzir_corretagem`. `bruta` (hoje o default) equivale a ambas falsas; `liquida`, a ambas
> verdadeiras — nenhum estudo existente muda. Manter as **séries realizadas** como base (não as
> alíquotas): é mais correto que a planilha, porque a corretagem da EVI incide sobre contratado
> e a aproximação por alíquota erra no tempo.
> Taxonomia: **editável por estudo**, dois booleanos, defaults `false/false`.

**Como verificar:** `(false,false)` reproduz `permutaFinanceiraBrutaMensal`; `(true,true)`
reproduz `permutaFinanceiraLiquidaMensal`; as combinações mistas ficam entre as duas.
**Custo/risco:** nenhum com defaults. ⚠️ Divergência declarada e **intencional** com a planilha
(séries × alíquotas) — precisa estar escrita no PR, não descoberta depois.

---

### R-A2-16 — Preço de tabela pondera área fechada e área aberta com deflator

**Veredito:** **AUSENTE**
**Fonte:** `Premissas!O10` `PrecoAreasAbertasDeflator = 50%`;
`Areas e Precos!F8 = F7 × (1 − deflator)`;
`F6 = F20/F14` (preço médio **ponderado**);
`Projetos Inc!K10/K11` (privativa residencial fechada × aberta).
**No código hoje:** `avancado_tipologias` tem um único `area_privativa_m2` e um único `preco_m2`
(`schema.json:331,336`). Não há noção de área aberta.
**Regra proposta:**
> Cada tipologia declara, opcionalmente, **área privativa aberta** (varanda/terraço/quintal) e um
> **deflator de preço da área aberta** (% do preço da área fechada). O preço efetivo da tipologia
> passa a ser a média ponderada
> `(fechada × preço + aberta × preço × (1 − deflator)) / (fechada + aberta)`, e o VGV usa esse
> preço. **Default: área aberta = 0**, que reproduz exatamente o cálculo atual.
> Taxonomia: **editável por tipologia** (m², 2 casas) e **por estudo** (deflator, %), defaults 0.

**Como verificar:** fechada 17.530,944 m², aberta 907,466 m², preço 9.500, deflator 50% →
preço médio `9.266,2236553` e VGV `170.854.431,21` (= `Areas e Precos!F6` e `!F20`).
**Custo/risco:** **requer migração** (2 colunas em `avancado_tipologias` + 1 em
`avancado_parametros`) e bump de `versao`. Sem input, nada muda. Prioridade menor que
R-A2-01/02/03 — impacta o VGV potencial, não o motor de recebíveis.

---

### R-A2-17 — Marketing é antecipado, na fase de Projetos

**Veredito:** **DIVERGENTE (verificar antes de mexer)**
**Fonte:** `cfINC!BM` —
`IF(Etapa = Projetos; MarketingPercentVgv × SUM(Receita Total) / PrazoAprovacaoProj; 0)`.
1% do VGV **inteiro** gasto **antes do mês 0**, diluído nos 12 meses de projeto. Separado do
`MarketingGlobalPercVgv` (`Premissas!R31`, mais 1%), este sim diluído na obra (`cfINC!BV`).
**No código hoje:** marketing é linha de custo comum, com `curva_id` e ancoragem livres
(`schema.json:365-369`) — o app **consegue** representar os dois, mas nada garante que o estudo
padrão o faça, e o grupo `planejamento` existe no enum de `cronograma_evento`.
**Regra proposta:**
> O catálogo de custos padrão do estudo de Incorporação traz **duas** linhas de marketing
> distintas: "Marketing de lançamento" ancorada em `planejamento` (a fase de Projetos) e
> "Marketing global / stand" ancorada em `obra`, ambas em `pct_vgv` e ambas editáveis.
> Taxonomia: **editável** (%, ancoragem, curva). É **semente de catálogo**, não regra de motor —
> não altera cálculo de estudo existente.

**Como verificar:** um estudo novo nasce com as duas linhas; um estudo existente não ganha
nenhuma.
**Custo/risco:** baixo, mas **é seed**, e seed fora de migração é contrato do `INSTRUCOES-CODE.md`.

---

### R-A2-18 — Receita Bruta = contratado líquido + juros (invariante)

**Veredito:** **JÁ IMPLEMENTADA**
**Fonte:** `Areas e Precos!C29 − C25 = R$ 8.981.262` com a nota `E30`
*"só é zero se tabela cliente não tiver juros"*; contrato C22 do doc consultivo
(`docs/viabilidade/inteligencia-evi-incorporacao.md:168`).
**No código hoje:** `frontend/fluxo-invariantes.ts:66` —
`esperado = vendaLiquidaContratada + jurosClientes`.
**Regra proposta:** manter, e **usar o invariante como teste de aceitação de R-A2-01/02/03**: se
ele continuar fechando com taxa ≠ 0, os juros estão sendo separados corretamente do principal.
**Como verificar:** o próprio invariante, com taxa 12,5% a.a.
**Custo/risco:** nenhum. É o melhor guarda-corpo que já existe para esta rodada.

---

### R-A2-19 — Correção monetária: uma coluna morta e um controle inerte, problemas diferentes

**Veredito:** **AUSENTE** — e a EVI Incorporação **também não a pratica**
**Fonte:** a busca por INCC/IGPM/IPCA/CDI/TR nos ~200 `definedName`s e nas 114 colunas de
`cfINC` **não retorna nada**. O único reajuste de preço da pasta é
`PrecoVendaIncrementoAnual` (`Resultados GERAL!F4`), e ele só entra em `cfGeral`
(`Simulação Geral`), **não** em `cfINC`. A EVI embute a correção **dentro** da taxa nominal de
tabela (12,5% a.a.), sem índice separado.

**No código hoje — são DOIS problemas distintos, com donos distintos:**

| | `indice_correcao` / `indice_correcao_taxa_aa` | `absorcao.correcao_estoque` |
|---|---|---|
| Persistido | `schema.json:151-152`, `backend/rotas/estudos.ts:34` | `backend/rotas/avancado.ts:283` |
| UI | **nenhuma** — a #279 removeu os 9 controles; `frontend/tela-financeiro.ts:9-30` é um **bloco de comentário** que os lista, não um render | **viva** — badge Não/Sim no rodapé do modal de Absorção, `frontend/tela-fluxo-receitas.ts:599-602` |
| Lido pelo motor | não | não |
| Natureza | **coluna morta sem UI** | **controle inerte com UI** |

> ✅ **Correção da minha primeira redação (achado do A4, conferido).** Eu havia escrito que
> `indice_correcao` era "renderizado em `tela-financeiro.ts:19-20`". **Falso** — as linhas 9-30
> daquele arquivo são comentário `//` documentando a remoção feita pela #279, que também deixou
> escrito: *"As COLUNAS permanecem no schema e o dado histórico está intacto — a remoção física é
> issue própria"*. Isso muda a pergunta: não é "por que o campo não faz nada", é **"a coluna ganha
> motor ou sai do schema"**.

**Regra proposta:**
> São duas decisões, e só a segunda é urgente:
> 1. **`indice_correcao` / `indice_correcao_taxa_aa`** — nenhum usuário as enxerga desde a #279.
>    Não há dano ativo; há dívida. A decisão é do autor: dar motor (modelo de índice, que vai
>    **além** da EVI) ou remover do schema com migração. **Esta rodada não decide** — registra.
> 2. **`absorcao.correcao_estoque`** — este **tem** UI viva e grava um dado que nenhuma linha de
>    código lê. É um botão que o usuário liga acreditando ter ativado correção de estoque.
>    **Ou ganha motor nesta rodada, ou o controle sai da tela.** Deixar como está é o pior dos
>    três estados.
> Se a decisão for implementar correção, o modelo da EVI é **taxa nominal única por componente**
> (R-A2-01), não índice separado — implementar índice seria ir **além** da planilha, sem oráculo.
> Taxonomia: nada editável nesta regra; ela **remove** superfície, não adiciona.

**Como verificar:** `grep -rn "correcao_estoque" frontend/ backend/ --include=*.ts | grep -v test`
retorna hoje só `tela-fluxo-receitas.ts` (leitura do form, escrita do JSON) — **nenhum
consumidor no motor**. Depois da regra, ou retorna também `fluxo-caixa-motor.ts`, ou não retorna
a tela.
**Custo/risco:** remover UI é barato e reversível (o dado persistido fica). Fecha a lacuna nº 6 do
dossiê **sem inventar modelo**, e reformula a nº 3 na pergunta certa.

---

### R-A2-20 — Capital de giro (fronteira com o A3)

**Veredito:** **AUSENTE**
**Fonte:** `Premissas!H25` (volume R$ MM), `!H26` (mês de tomada), `!H27` (juros a.a.),
`!H28` (carência de amortização), `!H29` (prazo total incluindo carência); `cfINC` cols. CK–CQ.
Regra: durante a carência paga-se **só juros** (`PMT = −Juros`); depois, PMT constante sobre
`CapitalGiroPrazo − CapitalGiroCarencia`; a última parcela liquida o resíduo.
**No código hoje:** `backend/rotas/funding.ts:43` aceita só
`['financiamento_producao','divida','equity']`; `capital_giro` é **explicitamente rejeitado**
(`backend/rotas/funding.test.ts:26`).
**Regra proposta:** deixo a redação normativa ao **A3**. Registro aqui só o que a EVI exige e o
que toca o recebível: **nada** — o capital de giro da EVI não consome carteira nem antecipa
recebível; é dívida corporativa pura, com despesa financeira agregada em `Premissas!P28` junto
com os juros do financiamento à produção.
**Como verificar:** ver `03-regras-funding.md`.
**Custo/risco:** ver A3. Lacuna nº 2 do dossiê.

### R-A2-21 — Dois Grupos com o mesmo plano não podem calcular diferente

**Veredito:** **DIVERGENTE** — e a divergência é **entre o app e ele mesmo**, não contra a EVI
**Fonte:** não é uma regra da planilha; é um pré-requisito para que **qualquer** regra desta
lista seja verificável. A EVI tem **um** motor de recebíveis; o app tem dois, e escolhe entre eles
por um critério invisível ao usuário.
**No código hoje:**
- `frontend/fluxo-pagamento-editor.ts:82-93` — `fluxoPagamentoParaSalvar` grava
  `componentes: componentesDoLegado(form, cronograma)` em **toda** escrita, sempre. Logo **todo
  Grupo já editado desde a #248** roda pelo motor de safras.
- `frontend/fluxo-caixa-motor.ts:1165-1168` — `recebiveisComponentesLinha` devolve `null`
  quando `fluxo_pagamento.componentes` **não** é array; `:1339-1341` então cai no ramo legado.
- Um Grupo **nunca aberto no modal** desde a #248 não tem `componentes` e roda pelo ramo legado.
  **Nada em tela distingue os dois casos.**

**O que efetivamente muda entre os dois ramos, com o MESMO `fluxo_pagamento`:**

| Aspecto | Ramo legado (`recebimentoBrutoMensal:1339-1416`) | Ramo canônico (`calcularRecebiveisComponentes:1064-1163`) |
|---|---|---|
| Parcelamento de prazo fixo | `total / nParc` — divisão simples | `pagamentosPrazoFixo:680` — PMT, resíduo na última parcela |
| "Ao longo da obra" | `vencimentosAoLongoObra:382-399` — vencimentos ancorados em `obra.inicio_mes + k×intervalo`, **incluindo o próprio mês da venda** | `ate_marco` — `N_s = fimObra − safra`, **1ª parcela em `safra+1`**, última no marco |
| Venda contratada após a entrega | **segue os componentes** (gera parcela e repasse) | `componentesEfetivosSafra:949` → **100% à vista** (#235) |
| Juros / carteira / principal | **não existem** (`detalhe = null` → principal = bruto, juros = 0) | séries completas |
| Repasse antes da safra | `deposita(max(mesRepasse, mesVenda), …)` — silencioso | `pagamentosConcentrado:781` — **lança erro** |

Ou seja: um Grupo legado **nunca** poderá receber juros de tabela (R-A2-01/02/03), e a regra
"venda pós-entrega é à vista" (R-A2-06) **não vale** para ele.

**Regra proposta:**
> O motor tem **um** caminho de cálculo de recebíveis. Ou:
> (a) `componentesPagamento` passa a derivar `componentes` do legado **em leitura** quando eles
>     não estiverem persistidos — isto é, `recebiveisComponentesLinha` deixa de devolver `null`
>     e o ramo legado de `recebimentoBrutoMensal` é removido; ou
> (b) o ramo legado sobrevive apenas como compatibilidade, e a tela **marca visivelmente** todo
>     Grupo que ainda cai nele ("plano não migrado — abra e aplique para usar o modelo de safras").
> **(a) muda número de estudo existente** — é uma decisão do autor, com inventário prévio de
> quantos Grupos estão em cada ramo. **(b) não muda nada** e é o passo mínimo desta rodada.
> Taxonomia: nada editável — é decisão de arquitetura.

**Como verificar:** dois Grupos com `entrada 15% / parcelas 15% ao longo da obra / repasse 70%`,
um com `componentes` persistido e outro sem, sobre a mesma absorção e as mesmas tipologias, têm
de produzir `receitaBrutaMensal` **idêntica** mês a mês. Hoje não produzem — a diferença aparece
já na primeira parcela.
**Custo/risco:** o caminho (b) é cosmético e seguro. O (a) é o conserto de verdade e **muda
resultado** de todo estudo com Grupo não migrado — exige inventário na instância antes de decidir.
⚠️ **Esta regra é precondição de auditoria:** enquanto os dois ramos convivem sem sinal em tela,
qualquer conferência de número contra a EVI (inclusive o §3 abaixo) pode falhar por um motivo que
não é o cálculo.

---

### R-A2-22 — Receita líquida deduz marketing; a base da permuta financeira, não

**Veredito:** **DIVERGENTE (de nomenclatura e de base)** — convergência com o achado do A3
**Fonte:** `Premissas e Resultados!P19` — `Receita líquida = SUBTOTAL(9; P8:P18)`, ou seja:

```text
Receita bruta (VGV)              P8   = 174.870.231,97
(-) Imposto            (4,00%)   P12  =  -6.994.809,28
(-) Corretagem         (4,74%)   P13  =  -8.294.448,51
(-) Marketing          (1,00%)   P14  =  -1.748.702,32     ← MARKETING ENTRA
(-) Permuta Financeira Resid     P15  =           0,00
(-) Permuta Financeira Não Res.  P16  =           0,00
= Receita líquida                P19  = 157.832.271,87  (90,26% do VGV — Premissas!R19)
```

Mas a base da **permuta financeira** (`cfINC!BN/BO`) é **outra**, e **não** deduz marketing:
`−|perm%| × Receita Total × MAX(0; 1 − deduzImpostos×|imp%| − deduzCorretagem×|corr%|)`.
São **duas noções de "líquida"** no mesmo modelo, de propósito.

**No código hoje:** o app tem a segunda (`permutaFinanceiraLiquidaMensal`,
`frontend/fluxo-caixa-motor.ts:1565-1572`, deduz imposto e corretagem) e **não tem a primeira** —
não há uma grandeza "Receita líquida" na taxonomia do `FluxoCalc` que desconte marketing.
Marketing é linha de custo (`cfINC!BM` no lado da planilha; grupo `indireto` no lado do app),
somada no consolidado, não deduzida de uma base de receita nomeada.

> **Resposta ao A3:** **sim, a EVI Urbitá corrobora** — a proforma dela deduz marketing (1% do
> VGV) para chegar em "Receita líquida", exatamente como `fluxo_investidor_FORMULAS!equity!C18 =
> C4*(1−C15−C16−C17)` faz com os 3%. As duas planilhas concordam entre si.
> **Mas o escopo é diferente e isso importa:** na EVI, marketing entra na **proforma econômica**
> (`Premissas!P19`), **não** na base de rateio da permuta financeira nem em nenhum recebível.
> Se o `funding-motor.ts:58-67` usa a base de receita líquida para **dimensionar equity**, a
> planilha do investidor manda incluir marketing e o código não inclui — divergência real, e a
> EVI não a contradiz. O que a EVI **não** autoriza é estender essa dedução à permuta financeira.

**Regra proposta:**
> A taxonomia de grandezas do Avançado ganha **Receita líquida** explícita e nomeada:
> `Receita Bruta − imposto − corretagem − marketing − permuta financeira`, exposta na proforma
> e usada como base declarada por quem precisar dela (funding/equity). Ela é **distinta** da base
> de rateio da permuta financeira (R-A2-15), que deduz apenas imposto e corretagem, por flag.
> Qualquer consumidor de "receita líquida" **declara qual das duas usa**.
> Taxonomia: **fórmula** (derivada). Nada editável — o que é editável são os %.

**Como verificar:** com os % da EVI (imposto 4%, corretagem 5% sobre contratado, marketing 1%,
permuta 0), `Receita líquida / Receita Bruta = 90,26%` (`Premissas!R19`). E
`permutaFinanceiraLiquidaMensal` continua **sem** marketing — as duas séries divergem de propósito,
e o teste tem de afirmar isso, não corrigi-lo.
**Custo/risco:** nenhum no motor (grandeza nova, derivada). O risco é de **nomenclatura**: hoje
"líquida" já significa duas coisas no repo e ninguém qualifica qual. Ver Pergunta Q9.

---

---

## 3. Cenário dourado — a safra do mês 0 da EVI Urbitá

Caso pequeno, real e integralmente rastreável até células da planilha. Serve de teste de
aceitação para **R-A2-01, R-A2-02, R-A2-03, R-A2-05, R-A2-09 e R-A2-18**.

### 3.1 Inputs

| Premissa | Valor | Célula |
|---|---:|---|
| Prazo de obra | 30 meses (meses 0..29) | `Premissas!H4` |
| Duração do Lançamento | 3 meses (0..2) | `Premissas!H7` |
| Janela comercial "Durante a obra" | meses 3..29 (27 meses) | `Etapas!D9:F9` |
| Marco de entrega (`fimObra` / `EtapaObraFim`) | mês **29** | `Etapas!F9` |
| Área privativa **de venda** residencial | 16.410,184929245337 m² | `Areas e Precos!F17` |
| Preço médio residencial | R$ 9.266,2236552645/m² | `Areas e Precos!F6` |
| Absorção — Lançamento | 15% | `Premissas!D7` |
| Absorção — Durante a obra | 20% | `Premissas!D8` |
| Absorção — Pós-chaves (derivada) | 65%, uniforme em 12 meses de 30 a 41 | `Premissas!D9 + D10` |
| Pagamento — à vista (pré-chaves) | 10% | `Premissas!D12` |
| Pagamento — tabela curta | 10%, com sinal de 15% e 36 parcelas | `Premissas!D14`, `!D15`, `TabCurtaDuracao` |
| Pagamento — tabela longa | 80%, dos quais 30% em parcelas até a entrega e 70% no repasse | `Premissas!H12`, `!H13` |
| Juros de tabela | **12,5% a.a.** → `i_m = 1,125^(1/12) − 1 = 0,0098635806` | `Premissas!H14` |

**Tradução para `ComponentePagamento[]` do app** (o contrato atual já comporta; a UI ainda não):

| # | tipo | participaçãoPct | demais campos |
|---|---|---:|---|
| 1 | `imediato` | 10,0 | `descontoPct: 0` |
| 2 | `prazo_fixo` | 10,0 | `sinalPct: 15`, `prazoMeses: 36`, `defasagemMeses: 1`, `taxaMensal: 0,0098635806` |
| 3 | `ate_marco` | 24,0 | `sinalPct: 0`, `marcoMes: 29`, `defasagemMeses: 1`, `taxaMensal: 0,0098635806` |
| 4 | `concentrado` | 56,0 | `mesPagamento: 30`, `taxaMensal: 0,0098635806` |

> `24 = 80 × 30%` e `56 = 80 × 70%`. Soma = 100,0 ✔

### 3.2 Resultados esperados

**Venda bruta contratada no mês 0**

```
(0,15 / 3) × 16.410,184929245337 m² = 820,50924646226679 m²      ← cfINC!J19
820,50924646226679 × 9.266,2236552645354 = R$ 7.603.022,19       ← cfINC!U19
```

**Componente 1 — à vista (10%)**

| Mês | Valor |
|---:|---:|
| 0 | **R$ 760.302,22** ← `cfINC!O19` |

**Componente 2 — tabela curta (10%, sinal 15%, 36×)**

| Item | Valor | Célula |
|---|---:|---|
| Contratado | R$ 760.302,22 | `cfINC!AS19` |
| Sinal (mês 0) | **R$ 114.045,33** | `cfINC!AU19` |
| Principal (carteira no mês 0) | **R$ 646.256,89** | `cfINC!BA19` |
| Parcela, meses 1..36 | **R$ 21.414,48** | `cfINC!AY20` |
| Total pago | R$ 770.921,36 | — |
| **Juros** | **R$ 124.664,47** | — |

**Componente 3 — tabela longa / obra (24%)**

| Item | Valor | Célula |
|---|---:|---|
| Principal (carteira no mês 0) | **R$ 1.824.725,33** | `cfINC!AF19` |
| Nº de parcelas (`N_0 = 29 − 0`) | **29** | `cfINC!AD20` (fórmula) |
| Parcela, meses 1..29 | **R$ 72.656,88** | `cfINC!AD20` |
| Total pago | R$ 2.107.049,59 | — |
| **Juros** | **R$ 282.324,26** | — |

**Componente 4 — repasse (56%)**

| Item | Valor | Célula |
|---|---:|---|
| Principal (saldo a repassar no mês 0) | **R$ 4.257.692,43** | `cfINC!AH19` |
| Mês do pagamento | **30** (`EtapaObraFim + 1`) | `cfINC!AL` |
| Valor pago = `4.257.692,43 × 1,0098635806^30` | **R$ 5.715.517,93** | — |
| **Juros** | **R$ 1.457.825,50** | — |

**Consolidado da safra**

| Grandeza | Valor |
|---|---:|
| Venda contratada (= venda líquida, sem desconto comercial) | R$ 7.603.022,19 |
| Recebimento bruto total | **R$ 9.467.836,28** |
| **Juros de clientes** | **R$ 1.864.814,09** — **24,53%** do contratado |
| Invariante `fluxo-invariantes.ts:66` | `7.603.022,19 + 1.864.814,09 = 9.467.836,28` ✔ |

**Cruzamento de tela (mês 0 completo, incluindo o não-residencial):**
`cfINC!BI19 = R$ 874.347,55` de `Receita Total` no mês 0 — que é
`760.302,22 (à vista) + 114.045,33 (sinal) = 874.347,55` na parte residencial.

**Cruzamento do projeto inteiro** (não é teste unitário, é sanity check):

| Grandeza | Valor | Célula |
|---|---:|---|
| VGV de tabela disponível (contratado) | R$ 165.888.970,16 | `Areas e Precos!C25` |
| VGV realizado (Receita Bruta) | R$ 174.870.231,97 | `Areas e Precos!C29` |
| **Juros de tabela do projeto** | **R$ 8.981.261,81 = 5,41%** | `Areas e Precos!C30` |
| Carteira de clientes no pico | R$ 38.790.316,38 no **mês 28** (22,2% do VGV) | `cfINC!BF47` |
| Exposição máxima de caixa | R$ 10.220.799,21 = 5,84% do VGV, no **mês 28** | `Premissas!X9`/`Y9` |

> ⚠️ **Se o app rodar este estudo hoje**, `jurosClientes = 0`, o VGV para em
> R$ 165,9 MM e a carteira máxima fica R$ 8,98 MM abaixo da real. O erro **não** é de sinal
> contrário nem se compensa — subestima receita, resultado e margem, e ao mesmo tempo subestima a
> necessidade de funding contra carteira.

---

## 4. Perguntas ao autor

**Q1 — Taxa de tabela: uma por plano ou uma por componente?**
A EVI tem **uma** taxa por segmento (`ClienteJurosAA` para tudo o que é residencial), aplicada
igualmente à tabela curta, à tabela longa e ao saldo a repassar. O contrato
`ComponentePagamento` do app já tem `taxaMensal` **por componente**, o que é mais expressivo.
Vale expor **um campo por componente** (com default herdado de um campo único do plano), ou
começar com **um campo só por plano**, mais simples e idêntico à planilha? *Minha recomendação:
um campo por plano no formulário, escrito em todos os componentes na persistência — a expressividade
fica disponível no dado sem sobrecarregar a tela.*

**Q2 — Ligar juros muda o VGV. Como comunicar?**
Com taxa ≠ 0, a Receita Bruta passa a incluir juros e cresce ~5% no caso da EVI (24,5% na safra
de lançamento). Os contratos C9/C10 do doc consultivo
(`inteligencia-evi-incorporacao.md:155-156`) já mandam chamar isso de "Receita Bruta (VGV)" e
reservar "VGV potencial / vendas contratadas" para o valor sem juros. **A tela hoje diz "VGV" sem
qualificador em vários lugares.** Renomear os rótulos entra no mesmo PR dos juros, ou vira issue
separada?

**Q3 — Sinal × Entrada: duas formas de dizer a mesma coisa.**
Na EVI, o sinal é **15% da tabela curta** (= 1,5% do total). No app, isso pode ser escrito como
`prazo_fixo.sinalPct = 15` **ou** como uma segunda linha de Entrada de 1,5%. As duas produzem
fluxo idêntico. Manter as duas (documentando a equivalência), ou eleger uma e desencorajar a
outra na UI? *Risco de manter as duas: dois estudos "iguais" que não conferem na leitura.*

**Q4 — A janela Pós-chaves: 12 meses fixos continua sendo a decisão? (disputa aberta)**
Três documentos discordam e um deles discorda de si mesmo:

| Fonte | Diz |
|---|---|
| `padrao-incorporacao.md:628-631` — *Modelo funcional de referência* | 12 meses |
| `padrao-incorporacao.md:634-637` — *Comportamento vigente* | "livre e editável… há estudos gravados com duração diferente de 12" — **texto vencido pela #226** |
| `padrao-incorporacao.md:639-643` — *Evolução dependente de issue* | EVI-007 pede **fixar em 12**, avisando do impacto em dados legados |
| `00-dossie.md` §4.5 item 5 (versão original) | listava como **lacuna** |
| **EVI Urbitá, `cfINC!J`** | **12 literal**, ignorando os próprios inputs `EtapaChavesDuracao`/`EtapaPosChavesDuracao` |

**Não estou propondo mudar nada** — a #226 implementou o modelo aprovado e a planilha o corrobora.
Confirma que (a) 12 fixos é a decisão final, (b) o *Comportamento vigente* do
`padrao-incorporacao.md` deve ser corrigido para dizer que a EVI-007 foi entregue, e (c) os
"estudos gravados com duração diferente de 12" citados ali já foram absorvidos pela #226 sem
tratamento especial?

Sub-pergunta separada: a própria planilha se contradiz internamente — `Etapas!E10/E11` dizem
Chaves 3m (30..32) + Pós-Chaves 12m (33..44) e o rótulo `Premissas!C10` anuncia *"Após chaves
(meses 4 a 15)"*, mas a **fórmula** espalha em 12 meses a partir do mês 30 (30..41). O app segue a
fórmula. **Confirma que a fórmula é a regra e os rótulos são decorativos?**

**Q5 — Repasse antecipado (R-A2-13): implementar sem caso de teste?**
As colunas existem na EVI, nomeadas e cabeadas, mas **zeradas** — não há nenhum número real para
reconciliar. Implementar às cegas contra a fórmula, ou esperar um EVI que use o campo? *Minha
recomendação: adiar; é a única regra desta lista sem oráculo numérico.*

**Q6 — Resíduo `ate_marco` no mês do marco (R-A2-07): imediato ou repasse?**
A EVI rola a fração para o repasse (com juros, no mês seguinte); o app paga à vista no mês do
marco (sem juros). A diferença atinge **uma safra só**, mas justamente a do mês de maior
exposição. Alinhar com a EVI, manter o comportamento atual, ou tornar configurável (minha
proposta)?

**Q7 — Correção monetária (R-A2-19): são duas perguntas, não uma.**
A EVI **não usa índice de correção** em coluna nenhuma — embute tudo na taxa nominal de tabela.
No app são dois problemas com donos diferentes:
1. `indice_correcao`/`indice_correcao_taxa_aa` — **coluna morta sem UI** desde a #279
   (`tela-financeiro.ts:9-30` é comentário, não render). A pergunta é **"ganha motor ou sai do
   schema"**, e a própria #279 já registrou que "a remoção física é issue própria".
2. `absorcao.correcao_estoque` — **controle vivo e inerte**: badge Não/Sim em
   `tela-fluxo-receitas.ts:599-602` que grava um dado que nenhuma linha lê. Este é o urgente:
   ou ganha motor, ou sai da tela. Qual dos dois?

**Q8 — Área aberta com deflator (R-A2-16) vale a migração?**
É a única regra desta lista que altera **o VGV potencial** e exige coluna nova em
`avancado_tipologias`. A EVI usa deflator de 50% e ~5,6% da área privativa é aberta — no exemplo,
o preço médio cai de R$ 9.500 para R$ 9.266,22 (−2,5%). Entra nesta rodada de implementação ou
vira backlog?

**Q9 — "Receita líquida" significa duas coisas. Qual delas o funding usa?**
A EVI tem as duas, de propósito: a da **proforma** (`Premissas!P19`) deduz imposto + corretagem
+ **marketing** + permuta financeira (90,26% do VGV); a base de rateio da **permuta financeira**
(`cfINC!BN`) deduz só imposto + corretagem, por flag. O A3 achou que
`fluxo_investidor_FORMULAS!equity!C18` inclui marketing e `funding-motor.ts:58-67` não —
**a EVI Urbitá corrobora o A3** para a base de proforma/equity, e **não** corrobora estender a
dedução à permuta financeira. Confirma que são duas grandezas distintas e que o dimensionamento de
equity usa a **primeira**?

---

## 5. Notas de método e limites desta análise

- **Nada foi executado.** Não rodei `validar-frontend.sh` nem `validar-backend.sh` — esta entrega
  não toca código. Todas as afirmações de "no código hoje" têm `arquivo:linha` e foram lidas nesta
  sessão sobre `claude/rodada-8-auditoria`.
- **A planilha foi lida por `<f>`.** Os `<v>` só apareceram para conferir aritmética (§3), e a
  conferência bateu em todos os pontos testados: `cfINC!U19`, `!O19`, `!AS19`, `!AU19`, `!BA19`,
  `!AY20`, `!AF19`, `!AD20`, `!AH19`, `!AH48`, `!J49`, `!BI19`.
- **Não parti da premissa errada do §4.4 do dossiê.** Confirmei em
  `frontend/fluxo-caixa-motor.ts:1340-1341`, `:1165-1183` e `:2025-2053` que a cadeia de safras
  **está** ligada a `calcularFluxo` desde a #283. As regras acima assumem motor integrado e
  atacam a **superfície de entrada**, que é onde o modelo realmente para.
- **Cruzamentos que interessam ao A3:** as colunas `CB–CH` (financiamento à produção, com gatilho
  de exposição mínima, catch-up retroativo e cash sweep) e `CK–CQ` (capital de giro com carência
  só-juros) estão transcritas em §1.6 e R-A2-20 — os nomes e as fórmulas exatas estão em
  `xl/tables/table4.xml` da pasta.
- **Correções recebidas do A4 e aplicadas nesta versão** (todas reconferidas por mim no código
  antes de aceitar): (1) o Pós-chaves de 12 meses é **disputa/decisão**, não lacuna — R-A2-08
  reescrita e minha proposta anterior retirada; (2) o caminho canônico está ligado em **toda**
  escrita (`fluxo-pagamento-editor.ts:82-93`) — reforço em R-A2-01; (3) o efeito colateral de
  dois ramos de cálculo virou **R-A2-21**, com a tabela do que efetivamente diverge entre eles;
  (4) `indice_correcao` é **coluna morta sem UI** (`tela-financeiro.ts:9-30` é comentário) —
  R-A2-19 reescrita separando-a de `correcao_estoque`, que esse sim tem UI viva e inerte.
- **Cruzamento com o A3:** a EVI Urbitá **corrobora** a inclusão de marketing na base de receita
  líquida da proforma (`Premissas!P19 = 90,26% do VGV`, com marketing de 1%) — R-A2-22. Mas
  **não** corrobora estender a dedução à base de rateio da permuta financeira (`cfINC!BN`), que
  deduz só imposto e corretagem. São duas grandezas distintas na mesma planilha.
- **Cruzamento que interessa ao A4:** três regras que eu declarei **JÁ IMPLEMENTADAS** por
  coincidência exata com a planilha (R-A2-04 repasse em `fimObra+1`, R-A2-06 pós-chaves à vista,
  R-A2-14 corretagem/imposto em bases distintas) são exatamente o tipo de coisa que uma
  refatoração "limpa" quebraria sem que nenhum teste ficasse vermelho. Valem teste de regressão
  nomeado.

---

## 6. Convergência — issues emergentes (Rodada 2)

> Escrito em 2026-08-22, depois do `10-digest-cruzado.md`. **Nada aqui repete as §§2–5.**
> Só o que aparece quando dois achados se encontram. Cada issue diz **quais achados de quais
> agentes** combina. As decisões vinculantes do autor (§ Decisões do digest) são premissa, não
> objeto de discussão.

---

### E-A2-01 — A EVI já está configurada em Pinguim, por um caminho que a UI não oferece — e ninguém sabe em quantos estudos

**Combina:** A5 (estudo 5 tem `taxaMensal: 0.0098636` → R$ 1.259.273,59 de juros) · A4 (`componentes`
gravado em **toda** escrita) · minha R-A2-01 · minha §3 (cenário dourado).
**Veredito:** **DIVERGENTE — e a premissa da minha R-A2-01 estava errada por baixo**

`0.0098636` não é um número qualquer. É `(1 + 0,125)^(1/12) − 1` arredondado — **exatamente**
`Premissas e Resultados!H14` da EVI Urbitá, os 12,5% a.a. que ancoram toda a minha §1.4. E a §3
deste documento calculou, sem saber do estudo 5, a mesma taxa até a 10ª casa: `0,0098635806`.

Isso vira a regra do avesso. Eu escrevi *"o app não tem juros de tabela"*. **Tem.** A cadeia
inteira funciona em produção: dado persistido → `recebiveisComponentesLinha:1165` →
`calcularRecebiveisComponentes:1064` → `calcularFluxo:2032` → R$ 1,26 MM de juros num estudo real.
O que o app tem é uma **UI que tritura essa configuração**, e o estudo 6 é a prova do depois
(`rotulo: "ao longo da obra (legado)"`, o carimbo de `componentesDoLegado:604`).

O que ninguém perguntou ainda: **quem escreveu aquela taxa?** A UI nunca a escreveu — não há campo.
Sobram `PATCH` via API, seed, ou edição direta. Seja qual for, **existe um processo ou uma pessoa
que já opera o app no modelo EVI por fora da tela**, e a Rodada 8 não o mapeou.

**Regra proposta:**
> Antes de qualquer conserto ou feature, **inventariar**: varrer o `fluxo_pagamento` das linhas de
> receita de **todos** os estudos de **todas** as instâncias, contando quantas linhas têm
> `componentes[].taxaMensal ≠ 0`, `sinalPct ≠ 0` ou `jurosNoMesDaContratacao = true`. O resultado
> vira anexo da issue.
> Enquanto o inventário não existir, **toda estimativa de impacto desta rodada é chute** — o
> estudo 5 pode ser um caso isolado ou a ponta de uma carteira inteira.
> A varredura é `GET`-only e cabe no `scripts/conferir-estudo.ts` que o A5 já deixou na árvore.

**Como verificar:** `GET /estudos/:id/avancado/receitas` de cada estudo, filtrando
`fluxo_pagamento.componentes[*].taxaMensal != 0`. Nenhuma escrita.
**Custo/risco:** zero (leitura). O risco é o oposto: **decidir sem o inventário**.

---

### E-A2-02 — O conserto do B2 fecha o buraco do "Aplicar sem mexer" e deixa aberto o do "Adicionar linha"

**Combina:** A5 (juros destruídos ao reabrir o modal) · A6 (`formularioPagamento` fabricava 15%) ·
Decisão #1 do autor (os 3 bugs graves são consertados agora; o **campo** de taxa fica de fora) ·
minha R-A2-01.
**Veredito:** **DIVERGENTE — residual do conserto em voo, achado por leitura do diff do B2**

Li o conserto na árvore (`frontend/fluxo-pagamento-editor.ts:87-146`, ainda não commitado). Ele é
bom: `CAMPOS_SO_CANONICOS = ['taxaMensal','sinalPct','jurosNoMesDaContratacao','rotulo']` são
transplantados do persistido para o regenerado, e há teste de no-op e de idempotência
(`fluxo-pagamento-editor.test.ts:103-123`). **Mas o transplante é por índice + tipo:**

```js
return regenerados.map((r, i) => {
  const orig = originais[i];
  if (!orig || orig.tipo !== r.tipo) return r;   // ← sem transplante, taxa = 0
  …
});
```

Um plano `[ate_marco 30, concentrado 70]` com taxa — que é **exatamente o do estudo 5** — sofre isto:

| Ação do usuário no modal | `regenerados` | Pareamento por índice | Resultado |
|---|---|---|---|
| Aplicar sem mexer | `[ate_marco, concentrado]` | `mesmaEstrutura` ✔ → verbatim | ✅ preservado (testado) |
| Mudar 30% → 40% | `[ate_marco, concentrado]` | tipos casam | ✅ preservado (testado) |
| **Clicar "Adicionar entrada"** | `[imediato, ate_marco, concentrado]` | `[0] imediato×ate_marco` ✗ · `[1] ate_marco×concentrado` ✗ | 🔴 **taxa zerada nos dois** |
| **Remover a linha de parcelamento** | `[concentrado 100]` | `[0] concentrado×ate_marco` ✗ | 🔴 **taxa zerada no repasse** |

O botão "Adicionar entrada" está no próprio modal (`tela-fluxo-receitas.ts:759-761`). O dano é
**idêntico ao que o conserto existe para impedir** — silencioso, sem undo, sem campo para
redigitar — e a suíte nova **não o cobre**: nenhum teste de `fluxo-pagamento-editor.test.ts`
adiciona ou remove linha.

**Regra proposta:**
> O pareamento entre componentes persistidos e regenerados **não pode ser posicional**. Parear por
> **`tipo` + ordem de ocorrência daquele tipo** (o 1º `ate_marco` do regenerado herda do 1º
> `ate_marco` do persistido), e, quando não houver par, **herdar do plano** (a taxa da linha) em
> vez de cair em `0`.
> Critério de aceite, e é ele que fecha a issue: **para toda sequência de edições no modal, nenhum
> campo de `CAMPOS_SO_CANONICOS` de um componente sobrevivente muda de valor sem que o usuário o
> tenha editado.** Teste com matriz: adicionar entrada · remover entrada · adicionar parcelamento ·
> remover parcelamento · reordenar · trocar `ao_longo_obra`.
> Se o pareamento robusto não couber no escopo do B2: **bloquear** a edição que perderia dado, com
> banner explícito ("este plano tem juros de tabela configurados; adicionar linha os removerá") —
> um aviso é infinitamente melhor que uma perda calada.

**Como verificar:** partindo do `FP_TABELA_LONGA` do teste (`0/30/70` com `TAXA_12_5_AA`), clicar
"Adicionar entrada" e aplicar deve manter `taxaMensal = TAXA_12_5_AA` no `ate_marco` e no
`concentrado`. Hoje ambos vão a `0`.
**Custo/risco:** baixo e localizado no mesmo arquivo que o B2 já está editando. ⚠️ **O risco de
não fazer é o pior desta rodada:** a issue fecha, o teste fica verde, e o defeito continua vivo a
um clique de distância — o padrão que o `CLAUDE.md` chama de *"a issue fechou não é evidência de
entrega"*.

---

### E-A2-03 — A minha R-A2-21 mirava a camada errada; o inventário do A5 a despriorizou e a desriscou ao mesmo tempo

**Combina:** minha R-A2-21 · A5 (as 6 linhas estão **todas** no canônico; nenhuma no legado) ·
A4 (dois Grupos com o mesmo plano calculam diferente, sem indicação em tela).
**Veredito:** **reclassificada — de "precondição de auditoria" para "limpeza latente de baixo risco"**

Escrevi que o perigo era *"dois Grupos com o mesmo plano caem em ramos diferentes"* e propus (a)
matar o ramo legado de `recebimentoBrutoMensal:1345-1416`. O dado vivo desmonta metade e conserta
a outra:

1. **Despriorizada.** Nenhuma das 6 linhas de Pinguim está no ramo legado. A escolha de ramo
   **não explica nenhum dano observado**. O que o A5 mediu é outra coisa: a linha **permanece no
   canônico** e é **empobrecida por dentro** — `componentesDoLegado` regenera `componentes` com
   `taxaMensal: 0`. Matar o ramo legado não teria salvo um centavo dos R$ 1.259.273,59.
   **O problema é o editor (E-A2-02), não o motor.**
2. **Desriscada.** Eu havia escrito que (a) *"muda resultado de todo estudo com Grupo não migrado —
   exige inventário na instância antes de decidir"*. O inventário chegou: **zero linhas afetadas**
   na instância visível. A mudança que eu classifiquei como arriscada é, ali, um **no-op provável**.

**Regra proposta:**
> Rebaixar R-A2-21 a **limpeza**, fora do caminho crítico desta rodada, e trocar a proposta: em vez
> de remover o ramo legado às cegas, adicionar **um teste que afirma a divergência conhecida**
> entre os dois ramos (a tabela da R-A2-21) e um `console.warn` no ramo legado nomeando a linha.
> Assim, se algum dia uma linha cair nele, aparece — em vez de calcular diferente em silêncio.
> A remoção do ramo só depois de o inventário do E-A2-01 cobrir **todas** as instâncias, não uma.

**Como verificar:** o teste novo falha se alguém "unificar" os ramos sem decisão — que é a
proteção que falta hoje.
**Custo/risco:** trivial. ⚠️ Registro o erro de mira para que não se repita: **eu inferi a gravidade
da forma do código, sem dado de uso.** O A5 tinha o dado; eu não pedi.

---

### E-A2-04 — Falta um invariante de conservação da absorção — e é ele, não a série em m², que teria feito o descarte de R$ 2 MM ser barulhento

**Combina:** A5 (`pos_obra.duracao_meses = 13` ignorado descarta 1,41% das vendas do estudo 6 =
**R$ 2.007.856,95**, em silêncio) · minha R-A2-10 (velocidade em m²/unidades com estoque) ·
EVI (`Perfil Vendas!C54:G55`, bloco `VGV SOMADO` com `erro máximo: 1`).
**Veredito:** **AUSENTE — e reordena a prioridade da minha R-A2-10**

O mecanismo do descarte é uma linha:

```ts
// frontend/fluxo-shared.ts:374-377 — modo 'personalizado'
for (const m of absorcao.meses) {
  const idx = n(m?.mes) - periodo.inicio;
  if (idx >= 0 && idx < tamanho) pcts[idx] += n(m?.pct);   // ← fora da janela: SUMIDO
}
```

`periodo.fim` vem de `faixasAbsorcao().pos_obra.fim`, que usa `APOS_CHAVES_MESES = 12`. Uma curva
gravada quando `duracao_meses` valia 13 tem meses fora dessa janela, e eles **caem no chão sem
`else`, sem `warn`, sem nada**. `Σ pcts` deixa de ser 100 e **ninguém confere**:
`erroFormularioAbsorcao:335-343` valida os **três campos do formulário distribuído** e não toca no
`personalizado`; `pctPosObraDerivado:325` faz `Math.max(0, …)`, que também clampa em silêncio.

**A pergunta que o coordenador fez tem resposta clara: não, com estoque isso não seria possível
esconder.** Num livro de estoque, dropar 1,41% das vendas deixa 1,41% de unidades **não vendidas
no fim do horizonte** — um resíduo visível e diferente de zero. A EVI carrega exatamente esse livro
(`cfINC!M/N`) e mantém um bloco de fechamento (`Perfil Vendas!C54/D54/E54`, com tolerância
declarada em `F55`) cujo único propósito é pegar esta classe de erro. **O app não tem fechamento
nenhum para a absorção.**

**Regra proposta:**
> Duas camadas, e a barata vem primeiro:
> 1. **Hoje, sem unidades e sem migração:** `absorcaoMensal` passa a devolver também
>    `pctDescartado` (o que caiu fora da janela) e `pctTotal`. `calcularFluxo` **avisa** quando
>    `|Σ pcts − 100| > 0,01`, e `fluxo-invariantes.ts` ganha a asserção. Três linhas. Teriam
>    tornado os R$ 2.007.856,95 do A5 **visíveis no primeiro cálculo**.
> 2. **Depois, R-A2-10:** o livro de estoque em m²/unidades, com o fechamento
>    `estoque_final = estoque_inicial − Σ vendidas − permutadas`, que é o invariante da EVI.
> Taxonomia: **fórmula** nas duas camadas. Nada editável.

**Como verificar:** carregar a curva de 43 meses do estudo 6 num cronograma cuja janela derivada
tem menos meses; `pctDescartado > 0` e o invariante acusa. Hoje o cálculo passa em silêncio.
**Custo/risco:** camada 1 é quase gratuita e **não muda nenhum número** — só denuncia. ⚠️
**Isto reordena a minha R-A2-10**: ela deixa de ser "série derivada boa de ter" e passa a ser
**o invariante de conservação que falta**, que é categoria de correção, não de conveniência.

---

### E-A2-05 — O conserto da Absorção vai *parecer* resolver o descarte silencioso, e não resolve

**Combina:** Decisão #1 (o modal de Absorção que destrói a curva personalizada está em conserto) ·
A5 (**dois** achados distintos sobre a mesma linha de dado: a curva destruída — VPL
−R$ 360.591,41 — e os R$ 2.007.856,95 descartados) · E-A2-04.
**Veredito:** **risco de conserto — não é defeito novo, é armadilha de encerramento**

São duas perdas independentes sobre a **mesma** absorção do estudo 6:

| Perda | Causa | Quem conserta |
|---|---|---|
| Curva personalizada de 43 meses → distribuído | `_absorcaoJson()` (`tela-fluxo-receitas.ts:531-542`) grava **sempre** `modo: 'distribuido'` | **B2, agora** |
| 1,41% das vendas (R$ 2.007.856,95) caem fora da janela | `absorcaoMensal:374-377` descarta sem avisar | **ninguém** |

Depois do conserto do B2, a curva sobrevive ao modal — **e continua truncada em 12 meses de
pós-chaves**. O número do estudo 6 vai mudar (a curva volta), o achado do A5 vai parecer resolvido,
e os R$ 2 MM continuarão sumindo. Na árvore, o B2 ainda não tocou `frontend/fluxo-shared.ts` nem
`frontend/tela-fluxo-receitas.ts` — confirmando que a segunda perda está fora do escopo dele,
corretamente.

**Regra proposta:**
> A issue do descarte silencioso (E-A2-04) nasce com `Sem-fechamento: #NNN pré-requisito`
> apontando para a do modal de Absorção, e o **critério de aceite dela é numérico e próprio**:
> a soma da absorção do estudo 6 fecha em 100% (ou o invariante acusa). Verificar "a curva voltou"
> **não** fecha o descarte.

**Como verificar:** depois do conserto do B2, recalcular o estudo 6 e conferir `Σ pcts`. Se der
98,59%, a segunda perda está viva.
**Custo/risco:** nenhum — é disciplina de escopo. O risco de ignorar é fechar por tabela.

---

### E-A2-06 — Os dois únicos dados de qualidade-EVI em Pinguim entraram por fora da UI. Quem os escreveu?

**Combina:** A5 (estudo 5 tem taxa que a UI não sabe escrever · estudo 6 tem
`modo:'personalizado'` com `aplicado: true`, que a UI também não sabe escrever) · A6 (o modal só
sabe gravar `distribuido`; não há campo de taxa) · minhas R-A2-01 e R-A2-11.
**Veredito:** **pergunta ao autor — não tenho como responder daqui**

Dois fatos, um padrão:

- `taxaMensal: 0.0098636` (estudo 5) — `fluxoPagamentoParaSalvar` **nunca** gravou isso; não há
  campo no modal (`tela-fluxo-receitas.ts:741-816`).
- `modo: 'personalizado'` com 43 meses e `aplicado: true` (estudo 6) — `_absorcaoJson()`
  (`tela-fluxo-receitas.ts:531-542`) grava **sempre** `modo: 'distribuido'`. O motor **lê**
  `personalizado` (`fluxo-shared.ts:373-379`), mas a tela não o produz.

Os dois casos mais sofisticados da instância — justamente os que **mais se aproximam do modelo da
EVI** — foram escritos por algo que não é a interface. O dossiê afirmava que `personalizado` era
"dado legado" que "a UI nunca grava"; o A5 mostrou que ele está lá, marcado como **aplicado**.

**Regra proposta:**
> Perguntar ao autor, antes de qualquer decisão de escopo: **existe um caminho de escrita
> paralelo** (script, seed, `PATCH` manual, importador, outra app do shell) alimentando
> `fluxo_pagamento` e `absorcao`? Se existir:
> 1. ele é um **cliente de fato do contrato canônico** e precisa entrar na matriz de regressão —
>    hoje nenhum teste o representa;
> 2. as issues de "feature ausente" (campo de taxa, curva personalizada editável) mudam de
>    natureza: não são features novas, são **a UI alcançando um modelo que já está em uso**;
> 3. e a prioridade de E-A2-02 sobe, porque o dano recai sobre o trabalho de alguém.

**Como verificar:** não é verificável por código. É pergunta.
**Custo/risco:** nenhum. ⚠️ Enquanto ficar sem resposta, toda estimativa de "quantos estudos
quebram" desta rodada carrega um erro de fonte desconhecida.

---

### E-A2-07 — A decisão do autor sobre o equity fechou o cálculo e **abriu** a dívida de nomenclatura. Sim, vale issue.

**Combina:** Decisão #4 (*"equity é um retorno líquido ao investidor, não importa esse fator"*;
`funding-motor.ts:58-67` fica como está, e a divergência com as duas planilhas vira nota) ·
A3 (a planilha inclui marketing 3%, o código não) · A4 (**17 mentiras documentais**, zero delas em
`inteligencia-evi-incorporacao.md`) · minha R-A2-22 / Q9.
**Veredito:** **SIM — issue de nomenclatura, estreita e barata. Argumento abaixo.**

A pergunta era se a decisão do autor dispensa a issue. **Não dispensa — ela a torna necessária**,
e o motivo é o mecanismo que o A4 acabou de catalogar 17 vezes.

Antes da decisão havia duas bases chamadas "líquida":

| Base | Deduz | Onde |
|---|---|---|
| Proforma / receita líquida da EVI | imposto + corretagem + **marketing** + permuta financeira | `Premissas!P19` = 90,26% do VGV |
| Rateio da permuta financeira | **só** imposto + corretagem, por dois flags | `cfINC!BN`, `permutaFinanceiraLiquidaMensal:1565` |

Depois da decisão há **três**, e a terceira é a mais perigosa: `funding-motor.ts:58-67` passa a ser
**deliberadamente diferente das duas planilhas**, por escolha registrada numa conversa — e **não
no código**. Essa é exatamente a receita das 17 mentiras: uma decisão correta que vive fora do
arquivo que ela governa. O próximo agente que abrir `funding-motor.ts:58-67` com
`fluxo_investidor_FORMULAS!equity!C18` ao lado vai ver uma divergência de 3% e "consertar" — e
**mudar silenciosamente toda simulação de equity já feita**. O A4 documentou que
`formulas.md:61-86` e `padrao-incorporacao.md` **já** mentem sobre funding; o terreno está adubado.

**Regra proposta:**
> Não renomear nem alterar cálculo nenhum. Apenas:
> 1. **comentário em `funding-motor.ts:58-67`** com a decisão do autor **verbatim e datada**
>    (2026-08-21), dizendo que a divergência com `equity!C18` e com `Premissas!P19` é
>    **intencional** e que marketing **não** entra por decisão de produto — no formato dos
>    `ADAPTADO` do repo, que já existe para este fim;
> 2. **qualificar os dois nomes que sobram**: `permutaFinanceiraLiquidaMensal` → documentar
>    "líquida **de imposto e corretagem**"; e a grandeza da proforma, quando existir (R-A2-22),
>    nasce como "Receita líquida **de proforma**";
> 3. um **teste que afirma a divergência** (`base do equity ≠ base da proforma`), para que
>    "corrigi-la" fique vermelho em vez de silencioso.
> Taxonomia: nada editável. Custo: um comentário e um teste.

**Como verificar:** o teste falha se alguém alinhar a base do equity à planilha.
**Custo/risco:** desprezível. O que ele previne é uma regressão silenciosa em dinheiro de investidor.

---

### E-A2-08 — O estoque quebrado que o B2 está consertando é precondição da minha R-A2-10; sem ele o invariante nasce vermelho

**Combina:** A5 (`PATCH .../tipologias/:tid` grava sem validar saldo: **234 alocadas + 42
permutadas sobre estoque de 234**, nos **dois** estudos, com a tipologia atualizada 10–11 s depois
da permuta) · Decisão #1 (em conserto pelo B2) · minha R-A2-10 (estoque em m²/unidades) ·
E-A2-04 (invariante de conservação).
**Veredito:** **dependência de ordem — não é defeito novo, é sequenciamento**

R-A2-10 propõe o livro de estoque da EVI, cujo fechamento é
`estoque_final = estoque_inicial − Σ vendidas − permutadas`. Nos dois estudos de Pinguim esse
fechamento **já é negativo antes de qualquer absorção**: `234 − 234 − 42 = −42` unidades. Ou seja,
se R-A2-10 fosse implementada hoje, o invariante acusaria **erro estrutural de dado** em 100% dos
estudos conferíveis, e não haveria como distinguir "o motor de absorção está errado" de "a
tipologia foi gravada sem saldo".

Há também um efeito de mão dupla que vale registrar: enquanto `unidades_permutadas` não é consumida
pelo `calcularFluxo` (gap já conhecido), **o dado inconsistente não produz número errado** — ele só
fica lá. No dia em que R-A2-10 ligar o estoque, ele passa a produzir. **O conserto do B2 é o que
impede a regra nova de nascer quebrada.**

**Regra proposta:**
> A issue de R-A2-10 declara `Sem-fechamento: #NNN pré-requisito` para a issue do `PATCH` de
> tipologias, e o seu plano inclui um passo explícito de **saneamento do dado existente**: antes de
> ligar o invariante, varrer as tipologias e listar as que já violam
> `quantidade ≥ alocadas + permutadas`. Sem esse passo, a regra correta acusa o dado velho e
> parece um bug do motor.

**Como verificar:** depois do conserto, `GET /estudos/:id/avancado/tipologias` de todos os estudos
com `quantidade < alocadas + permutadas` tem de vir vazio — ou a lista vira anexo da issue.
**Custo/risco:** nenhum agora; evita uma implementação que nasce dando erro em todo estudo.

---

### E-A2-09 — A EVI precisa virar fixture no repositório; depender do estado da instância não é verificação

**Combina:** A5 (**não deu para conferir**: cenários vazios nos 2 estudos, nenhuma operação de
equity, paridade bundle × `main` não confirmada) · A6 (versão que Pinguim roda não confirmada) ·
minha §3 (cenário dourado) · precedente dos 16 golden cases do Capital Stack.
**Veredito:** **AUSENTE — e é o que torna todas as minhas regras auditáveis**

O meu cenário dourado (§3) é reconciliável célula a célula com a planilha, mas **não é executável
por ninguém**: ele descreve um estudo que não existe. E a Rodada 8 mostrou que depender da
instância não funciona — o A5 não conseguiu conferir cenários nem equity porque **não havia dado
cadastrado**, e o A6 não conseguiu confirmar a versão publicada.

O que precisaria estar em Pinguim para a §3 ser verificável de verdade:

| Precisa | Estado hoje |
|---|---|
| Linha de receita com os **4 componentes da EVI** (`imediato 10` · `prazo_fixo 10` sinal 15 prazo 36 · `ate_marco 24` marco=`fimObra` · `concentrado 56`), todos a `taxaMensal 0,0098635806` | estudo 5 tem **a taxa**, mas o plano é `0/30/70` — **não** é a divisão da EVI; não valida R-A2-02 (sinal) nem R-A2-05 (tabela curta) |
| Cronograma com Lançamento 0..2 e Obra 0..29 (`fimObra = 29`, repasse no mês 30) | não confirmado |
| Tipologias com área e quantidade **consistentes** | 🔴 quebrado (E-A2-08) |
| ≥ 1 cenário cadastrado | 🔴 vazio nos dois |
| ≥ 1 operação de funding | 🔴 nenhuma |

**Regra proposta:**
> A EVI Urbitá vira **fixture no repo**, não expectativa sobre uma instância:
> `frontend/fixtures/evi-urbita-golden.ts` (premissas + as séries esperadas de `cfINC` para a safra
> do mês 0 e para os totais do projeto) e `frontend/fixtures/evi-urbita-golden.test.ts`. É o mesmo
> padrão do `calliandra-golden`, e o glob que impedia fixtures de rodar **já foi corrigido** nos
> dois lugares (`package.json:10` e `scripts/validar-frontend.sh:139-141`) — o caminho está aberto.
> A instância continua servindo para o que só ela sabe: **dado real, com as formas que a UI
> produz**. O que ela **não** pode ser é a única fonte de verdade de um teste.
> ⚠️ Lição do Capital Stack, no `CLAUDE.md`: os 16 golden cases existiram, commitados, e **nunca
> rodaram**. Um fixture novo só vale com a prova de que ele **executa** — o número de testes do
> `validar-frontend.sh` tem de subir.

**Como verificar:** `bash scripts/validar-frontend.sh` conta os testes novos; o fixture falha se a
§3 divergir.
**Custo/risco:** trabalho de escrita, zero risco de comportamento. É a única forma de as 22 regras
não virarem prosa.

---

### E-A2-10 — Congelar o campo de taxa como "feature" deixa a grandeza mais econômica do modelo viva, invisível e não editável

**Combina:** Decisão #1 (*o campo de taxa de juros no modal é feature e **não** entra no conserto
do B2*) · A5 (R$ 1.259.273,59 existem hoje no estudo 5) · A6 (**9 de 10 controles da aba
Financeiro não fazem nada ali**; e tela × exportação formatam diferente) · minhas R-A2-01 e R-A2-12.
**Veredito:** **pergunta ao autor — a decisão é dele e é defensável; o efeito colateral precisa
estar escrito**

A decisão está certa em escopo: conserto ≠ feature. Mas ela produz um estado que vale nomear antes
que alguém o descubra em produção. Depois do conserto do B2, no estudo 5:

- os juros **existem** e entram em VGV, Resultado, margem e TIR (18,59% × 17,53%);
- **não há campo** para vê-los, editá-los ou zerá-los;
- **não há KPI de tela** que os mostre — `jurosClientes` aparece só em
  `exportar.ts:351-352,442-443` (minha R-A2-12);
- e, pelo achado do A6, o único lugar onde eles aparecem formata em **2 casas** enquanto a tela
  formata em **0** e some com valores `< 0,50`.

O contraste é difícil de defender em voz alta: **9 controles da aba Financeiro não fazem nada, e a
grandeza que responde por 5,41% do VGV da EVI não tem controle nenhum.** O usuário do estudo 5 vê
uma TIR de 18,59% cuja origem não está em lugar algum da interface.

**Regra proposta:**
> Enquanto o campo não existir, o modal de Pagamento exibe um **bloco somente-leitura**: *"Juros de
> tabela configurados: 12,5% a.a. (não editáveis nesta versão)"*, lido de
> `componentes[].taxaMensal` e convertido para % a.a. por `(1+i)^12 − 1`. Zero input, zero
> migração, zero mudança de cálculo — **só deixa de esconder**. É o que torna E-A2-02 detectável
> pelo próprio usuário: se a linha some depois de um clique, ele vê.
> E a issue do campo editável (feature) nasce com esse bloco como pré-requisito, não como
> alternativa.

**Como verificar:** abrir o modal do estudo 5 e ver `12,5% a.a.`; abrir o do 6 e não ver nada.
**Custo/risco:** ~10 linhas de template, sem lógica. ⚠️ O risco de não fazer é que **E-A2-02 volte
a acontecer sem ninguém perceber** — de novo.

---

### Síntese: o que muda no meu documento por causa da Rodada 2

| § | Antes | Depois do cruzamento |
|---|---|---|
| **R-A2-01** | "juros são sempre 0; falta implementar" | **premissa refutada** — os juros existem em produção com a taxa exata da EVI; o problema é destruição, não ausência (E-A2-01) |
| **R-A2-10** | série derivada, boa de ter | **invariante de conservação ausente** — categoria de correção (E-A2-04), com pré-requisito de saneamento (E-A2-08) |
| **R-A2-21** | precondição de auditoria, mudança arriscada | **limpeza latente de baixo risco** — mirava o motor, o defeito é o editor (E-A2-03) |
| **R-A2-22 / Q9** | dúvida de nomenclatura | **issue confirmada** — a decisão do autor criou uma divergência intencional não registrada no código (E-A2-07) |
| **§3 cenário dourado** | reconciliado com a planilha | **não executável** enquanto não virar fixture (E-A2-09) |

**Erro meu que a Rodada 2 expôs, registrado de propósito:** inferi a gravidade da R-A2-21 pela
**forma do código**, sem nenhum dado de uso — e errei a camada. O A5 tinha o inventário desde o
começo; eu não pedi. Numa próxima rodada, toda regra que eu classificar por gravidade deve dizer
**em que dado de uso ela se apoia**, ou declarar que não se apoia em nenhum.
