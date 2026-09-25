# Rodada 8 — A5 · Conferência de contas na instância viva

    HOST   https://homolog.urbiverso.com.br          (Pinguim)
    URL    $HOST/api/viabilidade/...                 (só GET, 100% dos ~40 requests)
    Data   2026-08-22
    Motor  reexecutado local a partir de `main` @ 475dd24 (+ branch claude/rodada-8-auditoria)
    Script `scripts/conferir-estudo.ts` (novo, reexecutável)

> **Método.** O backend não calcula nada (dossiê §4.2): não há `GET` de fluxo, proforma, TIR ou
> VPL. Portanto puxei os **inputs** pela API e **reexecutei os motores do repo** — `calcularFluxo`,
> `calcularProforma`, `fundingDoEstudo`, `proformaAvancado` e as 7 funções de
> `fluxo-invariantes.ts` — montando o `FluxoConfig` como `frontend/tela-fluxo-ver.ts:103-147` e o
> `ProformaInput` como `frontend/tela-proforma.ts:168`.
>
> **Credencial.** Emiti exclusivamente `GET`. O token não foi escrito, ecoado nem logado em lugar
> nenhum — nem em `scripts/conferir-estudo.ts`, que o lê de `process.env.URBI_TOKEN`.

**20 achados (D1–D20), dos quais 17 são discrepância real** — 2 bloqueantes, 6 altas, 5
médias/altas, 2 baixas e mais 2 de dado que só a instância revela. Os 3 restantes (D4, D16, D20) são
comportamento **correto** e estão aqui de propósito, para ninguém reabri-los como bug. Nenhuma
discrepância é "não bateu por pouco": todas fecham no centavo com uma causa em `arquivo:linha`.

---

## Tarefa 0 — precondição do A2: em que ramo cada linha está

O A2 avisou que existem **dois ramos de recebíveis** e que o ramo depende de
`fluxo_pagamento.componentes` ser array. Levantei isso na instância **antes** de classificar
qualquer número. Resultado, medido com `calcularFluxo` rodado linha a linha:

| Estudo | Linha de receita | `componentes` é array? | Ramo | `taxaMensal` dos componentes | Contribuição aos juros¹ |
|---|---|---|---|---|---|
| 5 | À vista (10%) | sim | **CANÔNICO** | — (só `imediato`) | R$ 0,00 |
| 5 | Tabela curta (10%) | sim | **CANÔNICO** | `[0.0098636]` | **R$ 90.838,70** |
| 5 | Tabela longa (80%) | sim | **CANÔNICO** | `[0.0098636, 0]` | **R$ 1.168.434,89** |
| 6 | À vista (10,81%) | sim | **CANÔNICO** | `[0, 0]` | R$ 0,00 |
| 6 | Tabela curta (9,04%) | sim | **CANÔNICO** | `[0]` | R$ 0,00 |
| 6 | Tabela longa (80,15%) | sim | **CANÔNICO** | `[0, 0]` | R$ 0,00 |

¹ Contribuição **marginal**, medida zerando a `taxaMensal` daquela linha no estudo completo e
observando a queda de `jurosClientes` — não a soma de execuções isoladas por linha, que infla o
número porque sem as linhas de custo o motor não deduz a permuta física do VGV vendável. As
contribuições fecham a soma: R$ 90.838,70 + R$ 1.168.434,89 = **R$ 1.259.273,59**.

> **Nenhuma linha da instância está no ramo legado.** As 6 linhas dos 2 estudos Avançados têm
> `componentes` como array e passam por `recebiveisComponentesLinha`
> (`frontend/fluxo-caixa-motor.ts:1165-1183`, gate em `:1340-1341`). Logo **nenhuma** discrepância
> deste relatório pode ser atribuída à escolha de ramo — a hipótese está descartada por medição, não
> por argumento.

Consequência para o A2, que só a instância podia dar: se o ramo legado ainda existe em produção, não
é nestes estudos. E o gate não é "passou pelo modal" e sim "**tem** `componentes`" — o estudo 5 prova
que dá para ter `componentes` **sem** os rótulos `(legado)` que o modal carimba (ver D10).

**Sobre os outros avisos do A2:** os dois estudos têm funding, mas **nenhuma operação `equity`** (só
`financiamento_producao` + `divida`). Portanto a divergência de base do equity
(`fluxo_investidor_FORMULAS!equity!C18` deduz marketing 3%, `funding-motor.ts:58-67` não) e a falta
de `max(0, …)` em `simularEquity` (`funding-motor.ts:441`) **não são exercitadas por nenhum dado
real desta instância** — não confirmo nem refuto; ficam sem evidência viva.

---

## Tarefa 1 — o script reexecutável

`scripts/conferir-estudo.ts`, rodável com:

    URBI_BASE=https://homolog.urbiverso.com.br URBI_TOKEN=<token> \
      node --import tsx/esm scripts/conferir-estudo.ts 5 6

Ele puxa `/estudos/:id`, `/config`, `/estudos/:id/preliminar/produtos` e, se
`nivel_analise === 'avancado'`, mais 7 rotas de `/avancado/*`; monta o `FluxoConfig` e o
`ProformaInput` exatamente como as telas; roda os motores; imprime indicadores, um bloco de **contas
próprias** (o que tem que somar) e as **divergências das invariantes do app** com esperado/obtido/Δ.
Exporta `conferir(id)` para outros scripts — o CLI só dispara quando o arquivo é o ponto de entrada.

Duas armadilhas confirmadas e contornadas: (a) o campo de nível é **`nivel_analise`**, não `nivel`
(com `nivel` o script trata Avançado como Preliminar e não acusa nada); (b) o `/tmp` do Git Bash é
invisível ao `node` do Windows — nada é escrito em disco, tudo trafega em memória.

---

## Tarefa 2(a) — invariantes do app com dado real

**Sim, invariantes que o próprio app declara falham com dado real — 13 divergências, e 5 delas são
falso positivo do validador, não do motor.**

| Estudo | erro | alerta |
|---|---:|---:|
| 5 | 4 | 2 |
| 6 | 5 | 2 |

### D1 · `VENDA_BRUTA_NAO_RECONCILIA` — falso positivo determinístico: o validador ignora a permuta física 🟠

`validarContratacao` (`frontend/fluxo-invariantes.ts:150-159`) soma o VGV de **todas** as unidades
alocadas × absorção. O motor tira a permuta física do VGV vendável
(`vgvVendavelLinha`, via `calc.vgvPermutaFisica`). Os dois nunca podem bater num estudo com permuta.

| Estudo | Esperado (validador) | Obtido (motor) | Δ | O Δ é exatamente |
|---|---:|---:|---:|---|
| 5 | R$ 154.945.000,00 | R$ 129.009.999,99 | **−R$ 25.935.000,01** | 42 un × 65 m² × R$ 9.500 = R$ 25.935.000 |
| 6 | R$ 169.030.977,56 | R$ 140.393.343,03 | **−R$ 28.637.634,53** | 42 × 65 × R$ 10.640 × 98,59% = R$ 28.637.634,53 |

Efeito: o painel de Reconciliação mostra **erro vermelho** nos dois estudos, permanentemente, num
estudo cujo fluxo está correto. É o pior tipo de alarme — o que treina o usuário a ignorar alarme.

### D2 · `COMPONENTE_INVALIDO` — falso positivo: o validador aplica regra diferente da do motor 🟠

O motor converte um `ate_marco` degenerado (`N_s ≤ 0`, venda contratada no próprio mês do marco) em
`imediato`, em `componentesIntegradosSafra` (`frontend/fluxo-caixa-motor.ts:1030-1043`, comentário
explícito: *"não se cria prazo negativo nem se invalida toda a safra"*). O validador
(`frontend/fluxo-invariantes.ts:184`) chama só `componentesEfetivosSafra`, que **não** faz essa
conversão — e aí `pagamentosAteMarco` (`:733-738`) lança.

Causa raiz mecânica: **`componentesIntegradosSafra` não é exportada** (`fluxo-caixa-motor.ts:1030`,
sem `export`), então a invariante não tem como usar a mesma regra.

- Estudo 5: 2 erros, safra 38 / marco 38 (linhas *Tabela curta* e *Tabela longa*).
- Estudo 6: 3 erros, safra 40 / marco 40 (as três linhas).
- O `calcularFluxo` das mesmas linhas roda sem exceção e produz número — ou seja, a mensagem
  *"converta o componente para imediato ou concentrado"* pede ao usuário algo que o motor já fez.

### D3 · `PRODUTO_EXCEDE_ESTOQUE` + `ESTOQUE_MENSAL_NEGATIVO` — o estado é impossível pelas rotas de escrita, e mesmo assim está lá 🔴

Os dois estudos têm 234 unidades Residenciais **totalmente alocadas** em Receitas **e** 42 unidades
permutadas na linha `terreno/Preço/Permuta física` — 276 comprometidas sobre um estoque de 234.

| Estudo | Alocado | Permutado | Estoque | Comprometido | Estoque mensal negativo |
|---|---:|---:|---:|---:|---|
| 5 | 234 | 42 | 234 | **276** (Δ +42) | mês 48: **−3,975 un.** |
| 6 | 234 | 42 | 234 | **276** (Δ +42) | mês 44: **−9,006 un.** |

**Isto não é só dado de teste ruim — é um buraco de guarda no backend.** Três das quatro portas
validam saldo; a quarta não valida nada:

| Rota | Guarda | Onde |
|---|---|---|
| `POST/PATCH .../alocacoes` | ✅ `SALDO_EXCEDIDO` = `quantidade − vendido − permutadas` | `backend/rotas/avancado.ts:1051,1082,1085,1128` |
| `POST/PATCH .../custos` (permuta física) | ✅ `PERMUTA_SALDO_EXCEDIDO` | `backend/rotas/avancado.ts:1325-1358` |
| `DELETE .../tipologias/:tid` | ✅ `TIPOLOGIA_EM_USO` | `backend/rotas/avancado.ts:842-846` |
| **`PATCH .../tipologias/:tid`** | ❌ **nenhuma** — grava `quantidade` direto | **`backend/rotas/avancado.ts:809-832`** |

E os carimbos de tempo da instância mostram exatamente essa sequência, **duas vezes**:

| Estudo | Linha de permuta criada | Tipologia Residencial atualizada | Tipologia NR (sem permuta) |
|---|---|---|---|
| 5 | `19:41:14.510Z` | `19:41:24.917Z` (**+10 s**) | nunca tocada (`17:16:35`) |
| 6 | `19:21:14.730Z` | `19:21:25.971Z` (**+11 s**) | nunca tocada (`17:23:14`) |

A leitura: a permuta de 42 foi aceita quando havia saldo; segundos depois a `quantidade` da tipologia
foi reduzida pelo `PATCH` sem guarda, e o estoque virou negativo sem 422 nenhum. É o único caminho
que chega a este estado sem ser barrado. (Não reproduzi — exigiria escrita, que este trabalho não
faz.)

### D4 · `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` — verdadeiro positivo, a D14 da #355 funcionando ✅

Único invariante que dispara **com razão**, e vale registrar que funciona:

| Estudo | 1º mês negativo | Caixa nesse mês | Mínimo do fluxo alavancado |
|---|---|---:|---:|
| 5 | mês 16 | −R$ 1.454.622,10 | **−R$ 18.453.378,15** |
| 6 | mês 17 | −R$ 2.236.470,59 | **−R$ 16.082.210,12** |

### D5 · `CATEGORIA_CUSTO_DUPLICADA` — alerta que a `subcategoria` deveria ter evitado 🟡

`validarCustosDuplicados` (`frontend/fluxo-invariantes.ts:222-226`) chaveia por `grupo::categoria` e
**descarta `subcategoria`** — que é justamente o campo que distingue as linhas. No grupo `terreno`,
categoria `Preço`, o estudo 6 tem 4 linhas legítimas (`—`, `Valor à vista`, `Permuta financeira`,
`Permuta física`) e leva alerta de duplicata; o 5 tem 2 e leva também. Severidade `alerta`, então não
bloqueia — mas é ruído garantido em **todo** estudo de incorporação com permuta.

---

## Tarefa 2(b) — coerência aritmética

### O que bateu, e com que tolerância

Tolerância de todas as contas abaixo: **R$ 0,01** (a `TOLERANCIA_PADRAO` do próprio app).

| Conta | Estudo 5 | Estudo 6 |
|---|---|---|
| VGV Σ catálogo (qtd × área × preço) = `calc.vgvTotal` | ✅ R$ 154.945.000,00, Δ 0,00 | ✅ R$ 171.448.400,00, Δ 0,00 |
| VGV Σ alocações nas linhas = `calc.vgvTotal` | ✅ Δ 0,00 | ✅ Δ 0,00 |
| Unidades NR: alocado + permutado = estoque | ✅ 22 = 22 | ✅ 22 = 22 |
| Σ `participacaoPct` dos componentes = 100 (3 linhas) | ✅ 100,00 nas 3 | ✅ 100,00 nas 3 |
| Σ `linhasCusto[].mensal` = Σ `custoMensal` | ✅ R$ 100.390.313,70, Δ −0,00 | ✅ R$ 106.250.735,15, Δ 0,00 |
| `receitaMensal − custoMensal − fluxoMensal`, máx. mês a mês | ✅ 0,00 | ✅ 0,00 |
| `vgvVendavel = vgvTotal − vgvPermutaFisica` | ✅ 129.010.000 = 154.945.000 − 25.935.000 | ✅ 142.401.200 = 171.448.400 − 29.047.200 |
| Dedução RET sobre receita bruta | ✅ 4,00% → R$ 5.210.770,78 (esperado 5.210.770,94; Δ R$ 0,16, arredondamento mensal) | ✅ 4,12% → R$ 5.784.205,67 (esperado 5.784.205,73; Δ R$ 0,06) |
| `receitaBruta − vendaBrutaContratada = jurosClientes` | ✅ 130.269.273,58 − 129.009.999,99 = **1.259.273,59** | ✅ Δ 0,00 (juros 0) |

### D6 · Absorção não fecha 100% no estudo 6 — 1,41% das vendas somem em silêncio 🔴

`absorcao.meses` do estudo 6 tem **43 pontos, meses 11 a 53, somando 100,0000000001%**. A janela do
motor é **11..52**: `faixasAbsorcao` ancora o Pós-chaves em `pos_obra.inicio_mes` com duração **fixa**
`APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237,281`) e **ignora o
`pos_obra.duracao_meses = 13`** que o cronograma do estudo declara. `absorcaoMensal:372-378` descarta
o ponto do mês 53 (`idx = 42 >= tamanho = 42`) sem erro, sem aviso, sem log.

| Grandeza | Esperado (curva gravada) | Obtido (motor) | Δ |
|---|---:|---:|---:|
| Absorção efetiva, nas 3 linhas | 100,0000% | **98,5900%** | **−1,4100 pp** |
| Venda bruta contratada | R$ 142.401.199,98 | R$ 140.393.343,03 | **−R$ 2.007.856,95** |
| Resultado final | R$ 30.172.333,96 | R$ 28.358.402,21 | **−R$ 1.813.931,75** |

É a lacuna §4.5-5 do dossiê (*"`pos_obra.duracao_meses` é ignorado"*) — agora com preço. O estudo 5,
que tem `pos_obra.duracao_meses = 12`, fecha 100,0000% e não perde nada: a perda só aparece quando o
usuário estica o Pós-obras, que é exatamente quando ele acha que está ganhando janela de venda.

### D7 · O `pos_obra.pct` gravado é sempre 0 e o motor usa 65% — o dado persistido mente 🟠

As 6 linhas gravam `blocos: [..., { evento: 'pos_obra', pct: 0 }]`
(`frontend/tela-fluxo-receitas.ts:536`, comentado *"derivado no motor"*), enquanto
`pctPosObraDerivado` (`frontend/fluxo-shared.ts:324-326`) usa **65,00%** (estudo 5) e **65,53%**
(estudo 6). Δ **65 pontos percentuais** entre o que a API devolve e o que o motor aplica, nas 6
linhas. Não muda número **hoje** (o motor nunca lê o campo), mas qualquer consumidor de API —
export, BI, o próprio A6 — que leia `pos_obra.pct` lê zero e conclui que não há venda pós-chaves,
quando são dois terços das vendas.

### D8 · Σ legado (`entrada` + `parcelas`) ≠ 100% em 3 das 6 linhas 🟠

O espelho legado, que ainda é o que o modal edita, não fecha:

| Estudo | Linha | Σ entrada + parcelas | Σ componentes |
|---|---|---:|---:|
| 5 | Tabela longa (80%) | **30,00%** | 100,00% |
| 6 | À vista (10,81%) | **30,00%** | 100,00% |
| 6 | Tabela longa (80,15%) | **45,00%** | 100,00% |

O resto (70% / 70% / 55%) é o Repasse **derivado** — `pctRepasseDerivado`, `100 − entradas −
parcelas`. Correto por construção, mas significa que o campo persistido nunca soma 100 e que
qualquer conferência ingênua sobre `fluxo_pagamento.entrada/parcelas` acusa buraco.

### D9 · Preliminar e Avançado do MESMO estudo discordam do produto 🔴

Os estudos 5 e 6 têm as duas camadas preenchidas, e elas divergem:

| | Premissas (Preliminar) | Catálogo (Avançado) | Δ |
|---|---:|---:|---:|
| Área vendável R | 15.212,26 m² | 234 × 65 = 15.210,00 m² | 2,26 m² |
| Área vendável NR | 1.107,39 m² | 22 × 50 = 1.100,00 m² | 7,39 m² |
| **Total** | **16.319,65 m²** | **16.310,00 m²** | **9,65 m²** |

| Estudo | VGV Preliminar | VGV Avançado | Δ | O Δ é exatamente |
|---|---:|---:|---:|---|
| 5 | R$ 155.036.675,00 | R$ 154.945.000,00 | **R$ 91.675,00** | 9,65 × R$ 9.500 |
| 6 | R$ 171.537.035,00 | R$ 171.448.400,00 | **R$ 88.635,00** | 2,26×10.640 + 7,39×8.740 |

Pior que a área: a **permuta física de 42 unidades existe só no Avançado**. Nas Premissas dos dois
estudos, `permuta_fisica_area_m2 = null`, `permuta_fisica_area_canonica = null`,
`permuta_fisica_quantidade = 0`. Resultado:

| Estudo | Resultado Preliminar | Resultado Avançado | Δ |
|---|---:|---:|---:|
| 5 | R$ 41.918.698,77 | R$ 24.668.189,10 | **R$ 17.250.509,67** |
| 6 | R$ 51.389.892,70 | R$ 28.358.402,21 | **R$ 23.031.490,49** |

O app não reconcilia as duas camadas nem avisa que divergem. Um estudo Avançado continua exibindo a
aba Proforma do Preliminar com números de um projeto diferente.

---

## Tarefa 2(c) — base × variação: os estudos 5 e 6 **não** são um par comparável

**Não diferem só no que deveria diferir.** O diff campo a campo dos inputs encontrou divergência em
praticamente toda dimensão do modelo:

| Bloco | Campos que mudam | Exemplos |
|---|---:|---|
| Premissas (`/estudos/:id`) | **16** | `preco_venda_m2_residencial` 9.500→10.640 · `preco_venda_m2_nao_residencial` 9.500→**8.740** (↓) · `corretagem_percentual` 5,00→4,60 · `marketing_percentual` 1,00→1,10 · `imposto_percentual` e `ret_pct` 4,00→4,12 · `taxa_desconto_aa` 10,0→10,8 · `custo_construcao_m2` 4.733,57→5.017,58 · `taxa_gestao_pct` 6,00→5,64 |
| Cronograma | **os 5 eventos** | planejamento 12→11 · pré-lançamento 1→**4** meses · lançamento 3→**6** · obra 27→**30** · pós-obra 12→**13** |
| Tipologias | preço dos 2 produtos | quantidades idênticas (234/22) |
| Custos | **20+ campos em 14 linhas**, mais 2 linhas só no 6 | `terreno/Preço/—` e `terreno/Preço/Permuta financeira`, ambas com valor `null` |
| Funding | **4 campos** | financiamento 12,50%→11,50% a.a. · giro R$ 10.000.000→R$ 11.200.000 a 14,00%→14,70% |
| Receitas | modo de absorção, blocos, **estrutura de pagamento** e alocação por linha | ver abaixo |

O que mais compromete a comparação, nas linhas de receita:

- **O modo de absorção muda**: `distribuido` (5) → `personalizado` com curva de 43 meses (6). São
  dois algoritmos diferentes de `absorcaoMensal`, não duas parametrizações do mesmo.
- **A estrutura de pagamento muda de forma**, não de grau. A linha *"À vista"* do estudo 5 é
  `imediato 100%`; a linha homônima *"À vista (10,81%)"* do estudo 6 é `imediato 10% + ate_marco 20%
  + concentrado 70%` — **não é à vista**, apesar do nome. E a *Tabela longa* vai de `30 + 70` para
  `15 + 30 + 55`.
- **A alocação de unidades por linha muda** com o total constante: Residencial `23 / 23 / 188` no
  estudo 5 e `25 / 21 / 188` no 6.
- **As taxas de juros dos componentes somem**: `0,0098636` a.m. nas duas tabelas do estudo 5 → `0`
  em todos os componentes do estudo 6.

**A diferença de resultado, portanto, não é atribuível.** Os números:

| Indicador | Estudo 5 (base) | Estudo 6 (variação) | Δ |
|---|---:|---:|---:|
| VGV potencial | R$ 154.945.000,00 | R$ 171.448.400,00 | +R$ 16.503.400,00 |
| Venda bruta contratada | R$ 129.009.999,99 | R$ 140.393.343,03 | +R$ 11.383.343,04 |
| Receita bruta (caixa) | R$ 130.269.273,58 | R$ 140.393.343,03 | +R$ 10.124.069,45 |
| Custo total | R$ 100.390.313,70 | R$ 106.250.735,15 | +R$ 5.860.421,45 |
| Resultado (desalavancado) | R$ 24.668.189,10 | R$ 28.358.402,21 | +R$ 3.690.213,11 |
| VPL | R$ 8.314.824,98 | R$ 10.416.945,03 | +R$ 2.102.120,05 |
| TIR | 18,59% a.a. | 22,23% a.a. | +3,64 pp |
| Payback | nov/2030 (mês 47) | ago/2030 (mês 44) | −3 meses |
| Exposição máxima | −R$ 77.406.834,02 | −R$ 76.926.495,36 | +R$ 480.338,66 |
| Juros de clientes | **R$ 1.259.273,59** | **R$ 0,00** | −R$ 1.259.273,59 |
| Carteira máxima | R$ 31.520.306,97 (mês 37) | R$ 27.740.996,23 (mês 38) | −R$ 3.779.310,74 |
| Prazo | 57 meses | 54 meses | −3 |

Duas parcelas do Δ **são** explicáveis e valem isoladas, porque não vieram de premissa nenhuma:

1. **−R$ 1.259.273,59 de juros de clientes**, porque a variação perdeu as taxas dos componentes
   (D10). Não é decisão de negócio registrada em lugar nenhum: nenhum campo de premissa mudou de
   "com juros" para "sem juros".
2. **−R$ 2.007.856,95 de venda contratada**, porque a variação estende o Pós-obras para 13 meses e o
   motor trunca em 12 (D6). O usuário aumentou a janela de vendas e recebeu menos vendas.

> Isso é o oposto do que um par base×variação deveria dar: as duas maiores anomalias do Δ vêm de
> comportamento do app, não de premissa alterada.

---

## Tarefa 2(d) — a régua dos benchmarks

`GET /benchmarks?tipo_empreendimento=incorporacao` devolve **9 benchmarks**, 5 deles com faixas de
medidor configuradas e `atualizado_em = 2026-08-21` (ou seja, calibradas pelo autor ontem).

### D11 · A régua tem 9 campos; o app lê 2 🔴

O `MAPA` de indicador→benchmark é literalmente `{ custo_obras_vgv, margem_liquida }`, nos dois únicos
lugares que desenham medidor: `frontend/tela-resumo.ts:247-250` (Avançado) e
`frontend/tela-graficos.ts:194-196` (Preliminar). Todo benchmark fora do mapa é descartado em
`.filter((m) => m !== null)`, silenciosamente.

| Campo | Meta | Regra | Medidor (min/f1/f2/max) | Lido pelo app? |
|---|---:|---|---|---|
| `custo_obras_vgv` | 35,00 | não exceder | 20 / 25 / 30 / 40 | ✅ |
| `margem_liquida` | 20,00 | atingir ou superar | 15 / 25 / 35 / 45 | ✅ |
| `resultado_final` | 25,00 | atingir ou superar | 12 / 18 / 25 / 35 | ❌ |
| `roi` | 15,00 | atingir ou superar | 11 / 18 / 22 / 29 | ❌ |
| `margem_bruta` | 30,00 | atingir ou superar | 30 / 40 / 50 / 70 | ❌ |
| `custo_obras` | 0,00 | atingir ou superar | — | ❌ |
| `preco` | 0,00 | atingir ou superar | — | ❌ |
| `permuta_fisica` | 0,00 | atingir ou superar | — | ❌ |
| `permuta_financeira` | 0,00 | atingir ou superar | — | ❌ |

Os 3 primeiros ❌ foram **configurados com faixa completa ontem** e não aparecem em tela nenhuma. O
painel de estudos até mostra uma coluna **ROI** (`frontend/tela-dashboard.ts:406`) — sem nenhuma
comparação com o benchmark `roi` que existe e está calibrado.

### D12 · Os 2 medidores que existem estão **fora de escala nos 6 estudos** 🔴

`montarMedidor` (`frontend/medidor-faixas.ts:16-40`) devolve `min`/`max` fixos e **não clampa nem
sinaliza** valor fora do intervalo: o ponteiro encosta no limite e nada avisa que ele estourou.

`custo_obras_vgv` — medidor 20–40%, meta 35% (não exceder):

| Estudo | Valor | Fonte | Dentro de 20–40? |
|---|---:|---|---|
| 1 · PU 2 Esquadra | 70,32% | Preliminar | ❌ +30,32 pp acima do máx. |
| 2 · PU 1 Ideia 1 | 69,83% | Preliminar | ❌ |
| 3 · PU 3 Zoom | 70,32% | Preliminar | ❌ |
| 4 · PU 4 Reis | 70,70% | Preliminar | ❌ |
| 5 (Avançado) | 55,40% | `tela-resumo.ts:167` | ❌ |
| 6 (Avançado) | 53,03% | `tela-resumo.ts:167` | ❌ |

`margem_liquida` — medidor 15–45%, meta 20%:

| Estudo | Valor | Dentro de 15–45? |
|---|---:|---|
| 1 | 14,67% | ❌ abaixo do mínimo |
| 3 | 14,73% | ❌ |
| 4 | 14,46% | ❌ |
| 2 | 15,05% | ✅ (por 0,05 pp) |
| 5 (Avançado, aba Resumo) | 15,92% | ✅ |
| 6 (Avançado, aba Resumo) | 16,54% | ✅ |
| 5 / 6 (Avançado, **aba Resultados**) | **−47,87% / −44,84%** | ❌ ver D14 |

**Nos 6 estudos da instância, pelo menos um dos dois medidores está fora da escala** — e em 3 deles
os dois. A régua oficial não cobre nenhum dos projetos que ela deveria julgar.

### D13 · `margem_bruta` não é margem — a definição do código não é a do benchmark 🟠

`frontend/proforma.ts:315`: `margemBrutaPct = receitaLiquida / vgv * 100`. Isso é
"1 − deduções", não margem. Medido: **90,00%** nos estudos 1–5 e **90,30%** no 6 (deduções de
4% RET + 5% corretagem + 1% marketing). O benchmark pede meta 30% com medidor 30–70 — inatingível
por construção, o valor nasce 20 pp acima do teto da escala. Hoje não é exibido (D11), mas é a
definição que qualquer tela futura herdaria.

---

## Tarefa 2(e) — as lacunas, confirmadas ou refutadas com dado real

### D14 · `proformaAvancado` conta o **principal** do funding como custo ⛔⛔ — o achado mais grave

`frontend/proforma-avancado.ts:92-93` soma **todo o `funding.linhasSaida`** ao grupo `financeiro` do
custo direto:

    + (g === 'financeiro' ? (funding?.linhasSaida ?? []).reduce((s, l) => s + l.total, 0) : 0)

`linhasSaida` é **amortização + juros**, não custo financeiro. E as **entradas** (liberações e
aportes) nunca entram do lado da receita. O resultado (`:112`) é
`receitaLiquida − custoDireto − custoIndireto`, então o projeto "paga" o principal inteiro e nunca o
"recebe".

| Estudo | Resultado desalavancado | Resultado exibido | Δ | Σ funding saídas | Σ funding entradas (ignoradas) |
|---|---:|---:|---:|---:|---:|
| 5 | R$ 24.668.189,10 | **−R$ 62.364.749,03** | **−R$ 87.032.938,13** | R$ 87.032.938,13 | R$ 72.873.413,68 |
| 6 | R$ 28.358.402,21 | **−R$ 62.950.054,14** | **−R$ 91.308.456,35** | R$ 91.308.456,35 | R$ 77.723.686,54 |

**O Δ é, ao centavo, a soma das saídas de funding.** Confirmado dos dois lados: rodando
`proformaAvancado(calc, area, null)` o resultado volta a bater exatamente com o fluxo
(R$ 24.668.189,10 e R$ 28.358.402,21).

Onde isso aparece para o usuário — **dois lugares, os dois de decisão**:

1. **Aba Resultados do estudo Avançado**, `frontend/tela-fluxo-ver.ts:232` —
   `proformaAvancado(c, area, this.funding)`.
2. **Painel de estudos**, `frontend/tela-dashboard.ts:273` — alimenta as colunas VGV, Resultado,
   Margem e ROI da tabela de todos os estudos.

Impacto por indicador:

| Indicador | Estudo 5 exibido | Estudo 5 correto | Estudo 6 exibido | Estudo 6 correto |
|---|---:|---:|---:|---:|
| Resultado | −R$ 62.364.749,03 | R$ 24.668.189,10 | −R$ 62.950.054,14 | R$ 28.358.402,21 |
| Margem | **−47,87%** | 18,94% | **−44,84%** | 20,20% |
| ROI | **−33,27%** | 24,57% | **−31,86%** | 26,69% |
| Investimento total | R$ 187.423.251,83 | R$ 100.390.313,70 | R$ 197.559.191,50 | R$ 106.250.735,15 |

Todo estudo Avançado **com funding** aparece no painel como prejuízo catastrófico. Os dois únicos
estudos Avançados da instância estão nessa condição.

### D15 · Quatro "margens líquidas" e três "resultados" para o mesmo estudo, na mesma sessão ⛔

Consequência direta de D14 + definições divergentes entre módulos:

| Onde | Fórmula | Estudo 5 | Estudo 6 |
|---|---|---:|---:|
| Aba **Resumo** (Avançado) | `resultado / vgvTotal` — `tela-resumo.ts:165` | **15,92%** | **16,54%** |
| `proformaAvancado` sem funding | `resultado / receitaBruta` — `proforma-avancado.ts:115` | 18,94% | 20,20% |
| Aba **Resultados** + painel | idem, com funding no custo | **−47,87%** | **−44,84%** |
| Aba **Proforma** (Preliminar) | `resultado / vgv` — `proforma.ts:309` | **27,04%** | **29,96%** |

Contra a meta de 20% do benchmark `margem_liquida`, o **mesmo estudo** reprova na aba Resumo, passa
raspando sem funding, desaba na aba Resultados e passa folgado na aba Proforma. O ROI tem o mesmo
problema em menor grau: `resultado / custoTotal` (24,57%) na aba Resumo × `resultado /
investimentoTotal` (−33,27%) no painel.

### D10 · `jurosClientes` — **veredito: a afirmação do dossiê está REFUTADA, mas o mecanismo que ela descreve é real e destrói dado** 🔴

O dossiê §4.5-1 afirma: *"**`jurosClientes` é sempre 0 em estudo real**"*.

**Refutado.** O estudo 5 de Pinguim tem `taxaMensal ≠ 0` persistida e o motor produz juros:

| Linha do estudo 5 | Componente | `taxaMensal` | Equivalente | Contribuição marginal aos juros |
|---|---|---:|---|---:|
| Tabela curta (10%) | `ate_marco` 85%, marco 38 | **0,0098636** | 12,5% a.a. | R$ 90.838,70 |
| Tabela longa (80%) | `ate_marco` 30%, marco 38 | **0,0098636** | 12,5% a.a. | R$ 1.168.434,89 |
| | | | **Total do estudo** | **R$ 1.259.273,59** |

Prova cruzada: `receitaBruta (R$ 130.269.273,58) − vendaBrutaContratada (R$ 129.009.999,99) =
R$ 1.259.273,59`, exatamente o `jurosClientes` do `FluxoCalc`. E a carteira máxima do estudo 5
(R$ 31.520.306,97) é R$ 3,78 M maior que a do 6, coerente com juros capitalizando.

O estudo 6 tem `taxaMensal: 0` em **todos** os componentes → `jurosClientes = R$ 0,00`.

**O que distingue os dois é a origem do `componentes`**, e ela está estampada no `rotulo`:

| Estudo | Rótulos dos componentes | Origem |
|---|---|---|
| 5 | `"Tabela curta - parcelas ate a entrega, juros 12,5% a.a."`, `"Repasse na entrega (sem antecipacao a VP)"` | escritos à mão / seed — **nunca passaram pelo modal** |
| 6 | `"ao longo da obra (legado)"`, `"repasse (legado)"` | carimbo de `componentesDoLegado` (`fluxo-caixa-motor.ts:601,617`) — **passaram pelo modal** |

**A lacuna é real, e é pior do que "sempre 0": é destruição de dado sem confirmação.**
`fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts:90`) grava
`componentes: componentesDoLegado(form, cronograma)` em **toda** escrita, e `componentesDoLegado`
fixa `taxaMensal: 0` (`fluxo-caixa-motor.ts:589,601,608,617`). O modal não tem campo de taxa nem de
sinal (`frontend/tela-fluxo-receitas.ts:741-816`). Simulei a operação sobre o estudo 5 real:

> **Cenário: o usuário abre o modal de Fluxo de Pagamento do estudo 5 e clica em Aplicar sem mudar
> nada.**

| Indicador | Antes | Depois | Δ |
|---|---:|---:|---:|
| Juros de clientes | R$ 1.259.273,59 | **R$ 0,00** | −R$ 1.259.273,59 |
| Receita bruta | R$ 130.269.273,58 | R$ 129.009.999,99 | −R$ 1.259.273,59 |
| Resultado | R$ 24.668.189,10 | R$ 23.459.286,47 | **−R$ 1.208.902,63** |
| VPL | R$ 8.314.824,98 | R$ 7.355.324,79 | −R$ 959.500,19 |
| TIR | 18,59% a.a. | **17,53% a.a.** | −1,06 pp |

Sem aviso, sem diff, sem undo. E é **irreversível pela UI**, porque não existe superfície para
redigitar a taxa.

Veredito preciso, com as duas causas do A2 separadas: **`jurosClientes = 0` não vem do ramo de
cálculo** — as 6 linhas estão no canônico e leem `componentes` — **vem exclusivamente da UI gravar
`taxaMensal: 0`**. O estudo 6 tem juros zero porque passou pelo modal; o 5 tem juros porque não
passou.

### D16 · `correcao_estoque` — persistido, editável, **lido por ninguém** ✅ confirmado (sem impacto numérico neste dado)

Escrito pela UI em `frontend/tela-fluxo-receitas.ts:521,534` (badges Sim/Não em `:599-602`),
normalizado pelo backend em `backend/rotas/avancado.ts:283`, presente nas 6 linhas da instância.
Zero leituras em `fluxo-caixa-motor.ts`, `fluxo-shared.ts`, `proforma.ts` e `funding-motor.ts` — a
única ocorrência fora da tela é o bundle `frontend/index.js`, que é artefato de build ignorado pelo
git.

**Honestidade sobre a evidência:** as 6 linhas têm `correcao_estoque: false`. Portanto **este dado
não prova impacto numérico**, só confirma que o campo existe, é editável e é inerte. Um estudo com
`true` produziria exatamente o mesmo número — que é o defeito.

### D17 · `pos_obra.duracao_meses` ignorado ✅ confirmado **e precificado**

Ver D6: o estudo 6 declara 13 meses, o motor usa 12 (`APOS_CHAVES_MESES`, `fluxo-shared.ts:237`), e
o custo disso é **R$ 2.007.856,95 de venda contratada** e **R$ 1.813.931,75 de resultado**. Esta é a
única das três lacunas do item (e) com número real atrás.

### D18 · `modo: 'personalizado'` **existe na instância** — o dossiê §4.5-4 está desatualizado 🔴

O dossiê afirma que *"`modo:'personalizado'` existe no motor mas a UI nunca o grava
(`frontend/tela-fluxo-receitas.ts:533` fixa `modo:'distribuido'`)"*. As três linhas do estudo 6 têm
`modo: 'personalizado'`, `aplicado: true` e uma curva de 43 pontos mensais.

A parte do dossiê sobre o **código atual** está certa: `_absorcaoJson`
(`frontend/tela-fluxo-receitas.ts:527-538`) fixa `modo: 'distribuido'` e `_abrirAbsorcao`
(`:516-523`) lê **só `blocos`**. Ou seja, a UI de hoje não sabe criar nem exibir essa curva — mas o
dado está lá, e o backend aceita o blob sem validar `modo`.

> **Cenário: o usuário abre o modal de Absorção do estudo 6 e clica em Aplicar sem mudar nada.**

| Indicador | Antes (curva de 43 meses) | Depois (`distribuido`) | Δ |
|---|---:|---:|---:|
| Venda bruta contratada | R$ 140.393.343,03 | R$ 142.401.199,98 | +R$ 2.007.856,95 |
| Resultado | R$ 28.358.402,21 | R$ 30.172.333,96 | +R$ 1.813.931,75 |
| VPL | R$ 10.416.945,03 | R$ 10.056.353,62 | **−R$ 360.591,41** |

A curva personalizada é apagada e substituída pelos 3 blocos — e o **VPL cai R$ 360.591,41** mesmo
com o resultado subindo, porque a distribuição no tempo muda. Segunda destruição silenciosa de dado
por reabrir um modal, com o mesmo padrão da D10.

### D19 · `orcamento_valor` deixa de significar algo quando existe `orcamento_valor_canonico` 🟡

Estudo 6, linha `terreno/Registro/Incorporação e registro`: `orcamento_unidade = 'rs'`,
`orcamento_valor = '0.24'`, `orcamento_valor_canonico = '411476.16'`. O número **exibido e usado está
certo** — `resolverOrcamento` (`frontend/fluxo-shared.ts:428-429`) prefere o canônico e o motor
aplica R$ 411.476,16 (= 0,24% × R$ 171.448.400, de quando a unidade era `pct_vgv`). Mas a coluna
`orcamento_valor` ficou congelada em `0.24` com unidade `rs`: **quem ler a API sem conhecer a regra
do canônico lê R$ 0,24.** `_trocarUnidade` (`frontend/tela-fluxo-custos.ts:1058-1068`) só inicializa
o canônico quando ele é nulo e nunca reconverte `orcamento_valor`. Severidade baixa hoje, alta no dia
em que qualquer consumidor novo (export, BI, IA) ler a coluna direta.

### D20 · `valor = 0,00` no financiamento à produção não é "sem financiamento" ✅

Os dois estudos têm `financiamento_producao` com `valor: "0.00"`, e mesmo assim o motor libera
**R$ 62.873.413,68** (estudo 5) e **R$ 66.523.686,54** (estudo 6). É comportamento **documentado** —
`simularFinanciamentoProducao` (`frontend/funding-motor.ts:337`) trata
`limiteContratado = 0` como *"sem teto contratual"* e usa `percentual_financiavel × custo elegível`.
Registro aqui porque um zero na tela lendo "Valor" e R$ 62,9 M liberados é exatamente o tipo de coisa
que um revisor humano marca como bug — e não é.

---

## O que NÃO deu para conferir

Declarado explicitamente, para ninguém tratar ausência de achado como ausência de problema:

| Item | Por quê |
|---|---|
| **Números da instância como o navegador os renderiza** | Reexecutei os motores localmente contra os inputs da API. Se o bundle publicado em Pinguim estiver atrás da `main`, os números da tela podem diferir dos meus. A instância declara `viabilidade@0.1.28` = `manifesto.json`, mas isso é a **versão de schema**, não o `build_sha` — não é prova de paridade de código. |
| **Cenários** | `/estudos/5|6/avancado/cenarios` devolve `dados: []` nos dois. `aplicarCenario` não foi exercitado com dado real. |
| **Equity** | Nenhuma operação `equity` na instância. A divergência de base apontada pelo A2 (marketing 3%) e a falta de `max(0,…)` em `simularEquity` ficam **sem evidência viva**. |
| **`capital_giro` como tipo próprio** | Confirmado ausente do modelo; os dois estudos contornam com `tipo: 'divida'` e `nome: "Capital de giro"` (R$ 10,0 M @ 14,00% e R$ 11,2 M @ 14,70%, ambos 12 m de carência + 36 de amortização). É contorno de usuário, não recurso do app. |
| **`correcao_estoque` com impacto** | As 6 linhas estão em `false`; o campo é inerte, mas nenhum número o prova. |
| **Ramo legado de recebíveis** | Nenhuma linha da instância está nele. Não pude conferir número no legado. |
| **Reprodução das escritas de D3, D10 e D18** | Exigiria `POST`/`PATCH`. Não emiti nenhum. As três são derivadas de leitura + simulação local dos motores, e as duas últimas são simulação explícita, não medição. |
| **Backend / `schema.json` / migrações** | `validar-backend.sh` aborta na etapa 1/5 (SDK é stub nesta máquina). "Não deu para rodar" não é "passou". |
| **Correção de rumo** | `frontend/exportar.ts:10` **já importa `fmtR$`** — a duplicação de formatação que o dossiê §4.1 aponta acabou; não a reporte de novo. |

---

## Índice das discrepâncias, por severidade

| # | Achado | Sev. |
|---|---|---|
| **D14** | `proformaAvancado` soma o principal do funding ao custo — Δ R$ 87,0 M / R$ 91,3 M, exibido no painel e na aba Resultados | ⛔ |
| **D15** | 4 definições de margem líquida e 3 de resultado para o mesmo estudo (−47,87% × 15,92% × 18,94% × 27,04%) | ⛔ |
| **D10** | Reabrir o modal de Pagamento zera `taxaMensal` e apaga R$ 1.259.273,59 de juros (TIR −1,06 pp), sem aviso e sem undo | 🔴 |
| **D3** | `PATCH /avancado/tipologias/:tid` sem guarda de saldo — estoque comprometido em 276/234 nos 2 estudos | 🔴 |
| **D6/D17** | `pos_obra.duracao_meses` ignorado: 1,41% das vendas descartadas, −R$ 2.007.856,95 | 🔴 |
| **D18** | Reabrir o modal de Absorção apaga a curva personalizada de 43 meses (VPL −R$ 360.591,41) | 🔴 |
| **D9** | Preliminar × Avançado do mesmo estudo: Δ 9,65 m², Δ R$ 91.675 de VGV, Δ R$ 17,25 M de resultado | 🔴 |
| **D11/D12** | 9 benchmarks configurados, 2 lidos; os 2 fora de escala nos 6 estudos | 🔴 |
| **D1** | `VENDA_BRUTA_NAO_RECONCILIA` falso positivo (permuta física) — erro vermelho permanente | 🟠 |
| **D2** | `COMPONENTE_INVALIDO` falso positivo (`componentesIntegradosSafra` não exportada) — 5 erros | 🟠 |
| **D7** | `pos_obra.pct` persistido = 0, motor usa 65% — Δ 65 pp entre API e cálculo | 🟠 |
| **D8** | Σ legado `entrada + parcelas` = 30% / 30% / 45% em 3 linhas (o resto é repasse derivado) | 🟠 |
| **D13** | `margemBrutaPct` = receita líquida / VGV = 90% — não é margem, e o benchmark pede 30% | 🟠 |
| **D5** | `CATEGORIA_CUSTO_DUPLICADA` ignora `subcategoria` — ruído garantido com permuta | 🟡 |
| **D19** | `orcamento_valor` = 0,24 com unidade `rs` (canônico = 411.476,16) | 🟡 |
| **D4** | `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` — verdadeiro positivo, funcionando | ✅ |
| **D16** | `correcao_estoque` inerte — confirmado, sem impacto neste dado | ✅ |
| **D20** | `valor = 0` no financiamento à produção = sem teto contratual — documentado, não é bug | ✅ |

---

## Anexo — o que é dado de teste e o que é defeito do app

Os 6 estudos são `[teste]` / `rascunho`, então distingo:

**Preenchimento parcial / dado de teste, não bug:**
- `terreno/Preço/—` e `terreno/Preço/Permuta financeira` do estudo 6, ambas com `orcamento_valor:
  null` (linhas órfãs).
- `terreno/Preço/Valor à vista` = R$ 0,00 nos dois estudos (o terreno é pago 100% em permuta).
- `Contingência` = 0% e `Stand de vendas` = R$ 0,00 nos dois.
- `num_unidades` = `null` nos 6 estudos (só `num_unidades_residencial`/`_nao_residencial` preenchidos).
- A linha do estudo 6 chamada *"À vista (10,81%)"* que na verdade é 10/20/70 — nome herdado do
  estudo 5, não renomeado.
- `avancado_tipologias.unidades_permutadas = 0` no catálogo: **não é bug**. O campo é legado, foi
  retirado da entrada pela #253 (`backend/rotas/avancado.ts:744`) e o motor o injeta a partir das
  linhas de custo em `frontend/fluxo-caixa-motor.ts:1785`. Não o persiga.

**Defeito do app, independente da qualidade do dado:** D1, D2, D3 (a guarda ausente), D5, D6, D7,
D8, D9, D10, D11, D12, D13, D14, D15, D16, D17, D18, D19.
