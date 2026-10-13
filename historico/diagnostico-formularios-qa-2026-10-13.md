# Diagnóstico — dois projetos, quatro estudos, a partir dos formulários simplificados (2026-10-13)

Nota datada (fotografia, não guia). Instância **Pinguim** (`homolog.urbiverso.com.br`), shell `0.56.37`, app
`viabilidade`, token do principal **QA Principal** (identidade de serviço, alçada de app `admin`). Nenhuma alçada de
plataforma foi usada e nenhum usuário do pool foi reservado: a rodada só escreveu dados do app, com prefixo `qa-`.

## O que foi feito

Dois projetos fictícios, cada um nos dois níveis, preenchendo os formulários de `referencia/formularios/` e criando os estudos
pela API **a partir do arquivo preenchido** (`scripts/formularios/importar_formulario.py`, que lê rótulo, chave técnica e
formato da célula — não lê o gerador):

| Projeto | Preliminar | Avançado | Base |
|---|---|---|---|
| Incorporação — Residencial Aurora Parque, Taguatinga/DF | estudo 25 | estudo 27 | 4.000 m², 179 unidades em 5 tipologias, 4 permutadas |
| Loteamento — Vale do Sol, Goiânia/GO | estudo 26 | estudo 28 | gleba de 50 ha, ALV 300.000 m², 1.000 lotes em 2 etapas, 100 permutados |

Os arquivos preenchidos estão em `referencia/formularios/exemplos/`. O Avançado herda do Preliminar nome, terreno, áreas,
catálogo e custos; acrescenta cronograma, grupos de venda, pagamento, alocações, funding e cenários.

## Resultado das conferências

- **Preliminar × planilha:** os dois Preliminares fecham com a zona calculada do formulário ao centavo (VGV, receita líquida,
  custos, resultado), e com o motor real (`conferir-estudo`). A única diferença é R$ 0,78 em R$ 139,7 mi, por `pct_alv` ter 4 casas.
- **Avançado × Preliminar (mesmos custos de obra):** construção, decoração, gestão da obra, projetos e terreno saem **idênticos**
  nos dois níveis. O resultado difere por construção: o Avançado tem tempo (juros de clientes R$ 19,0 mi no Incorporação e
  R$ 83,8 mi no Loteamento), RET sobre o recebido e bases de % diferentes (ver achado 5).
- **Estudo 27 (Incorporação Avançado), depois de corrigido o pagamento:** VGV de tabela R$ 143,2 mi, TIR 48,8% a.a., VPL R$ 29,8 mi,
  exposição máxima −R$ 46,8 mi, payback mai/2030.

## Achados

### Do app (viram issue ou comentário em issue existente)

1. **A API aceita `fluxo_pagamento` legado e o motor calcula sem juros, sem carteira e sem repasse, em silêncio.** Estudo 27,
   mesmo dado, só trocando o shape: TIR 35,58% → 48,78%, VPL R$ 17,9 mi → R$ 29,8 mi, juros de clientes R$ 0 → R$ 19,0 mi,
   carteira máxima R$ 0 → R$ 81,4 mi. O frontend já corrigiu isto na tela (#657: o grupo nasce canônico); o backend continua
   semeando `fluxoPagamentoPadrao()` legado e aceitando legado no PATCH, e a única sinalização é a badge "Plano não migrado".
   Quem cria por API (agente, QA, importação) obtém um estudo errado sem erro algum. → **issue nova**.
2. **O default de absorção grava `pos_obra: 0` e a conferência exige o derivado.** `absorcaoPadrao` grava 0 com o comentário
   "derivado = 100 − 30 − 40", e `conferir-estudo` acusa "pós-chaves GRAVADO vs DERIVADO" em todo grupo que nasce pela API.
   Um dos dois está errado. → **issue nova**.
3. **`CAMADAS_DIVERGEM_PERMUTA_FISICA` dispara nos dois Avançados** (alerta). Já registrado em **#832**; reproduzido aqui pela API
   (260 m² e 30.000 m² no Catálogo × 0 nas Premissas). → comentário.
4. **`conferir-estudo` dá "FALHA VGV Σ tipologias/alocações" no Incorporação** (esperado R$ 126,9 mi, motor R$ 143,2 mi): a
   conta do script ignora a área aberta, que o motor inclui por decisão. Já registrado em **#835**; Loteamento (área aberta 0) passa. → comentário.
5. **Preliminar e Avançado do mesmo projeto não são equivalentes linha a linha, e isso não está escrito em lugar nenhum.**
   Medido: (a) custos em % do VGV incidem sobre o VGV **líquido** de permuta física no Preliminar e sobre o VGV **total** no
   Avançado (marketing R$ 2,096 mi × R$ 2,149 mi); (b) a permuta física é valorada pelo **preço médio da categoria** no Preliminar
   e pelo preço da tipologia no Avançado (VGV Loteamento R$ 209,25 mi × R$ 210,0 mi); (c) **Projetos em % do VGV** só existe no
   Preliminar (o Avançado aceita rs, rs_m2_priv e pct_constr), então a conversão manual para R$ é obrigatória; (d) a corretagem
   do Avançado depende de `corretagem_sobre_permuta_fisica`. Relaciona-se com **#833** (upgrade Preliminar → Avançado). → **issue nova** (decisão + guia).
6. **`pct_alv` tem 4 casas (`decimal(7,4)`)**, então frações como 864/10.400 não reproduzem a área exata (R$ 0,78 de VGV aqui). Pequeno, mas
   é a única entrada do catálogo que não aceita o valor exato. → **issue nova**, P3.
7. `RECEITA_BRUTA_NAO_CONSERVA` (Δ R$ 0,15, Loteamento, ramo legado, 1.000 lotes): já em **#824**; some com o pagamento canônico. → comentário.
8. `CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING` nos dois Avançados: é o alerta D14, esperado — o funding dos exemplos foi montado sem checar caixa.

Já conhecidos e confirmados, sem ação: `Σ legado entrada+parcelas` (#827) e linhas obrigatórias de custo ausentes em estudo criado por API (#813).

### Dos formulários e do importador (insumo da próxima versão dos formulários)

F1. **A chave técnica do pagamento descreve o shape legado** (`entrada[i]`, `parcelas[i]`), que é o que causa o achado 1. A chave tem de
    descrever o contrato canônico (`componentes`: tipo, participacaoPct, sinalPct, prazoMeses, defasagemMeses) ou o importador tem de
    chamar a conversão do app. Hoje o passo `aplicar-pagamento-canonico.ts` faz isso depois da criação.
F2. **As chaves técnicas de lista não são legíveis por máquina** (`entrada[i] / parcelas[i] #3`, `avancado_fases[1].nome (tipo = receita)`).
    O importador teve de ler o **rótulo** ("Condição 3 — Grupo"). Padronizar `lista[n].campo`.
F3. **Percentual em fração do Excel × pontos da API.** Funcionou porque o importador lê o formato da célula (`%`); um leitor que ignore o
    formato erra por 100×. Declarar a regra na primeira linha de chaves.
F4. **Vocabulário de distribuição de custo:** o formulário diz "Linear | curva | unit_delivery | sales_revenue"; a API só aceita
    `fixo | unit_delivery | sales_revenue` e a curva vai em `curva_id`. Mapeamento feito no importador (Linear → `fixo`, "Curva S" → `curva_id`).
F5. **`ordem` nunca é enviada:** custos e funding ficam todos com `ordem` 0 e a lista sai em ordem de criação por acaso.
F6. **"Base financiável" é texto livre** e a API pede ids de linha de custo; o importador não a envia (declarado em `lacunas_da_chave`).
F7. **`pos_obra` da absorção precisa ser gravado derivado** (achado 2) — o importador gravava 0; corrigido pelo passo de pagamento.
F8. **Inícios travados (Pré-lançamento, Lançamento, Pós-obras)** ficaram só na zona calculada, e o app os recalculou igual (conferido: 6, 9, 40 no Incorporação).
F9. **Preliminar → Avançado exige conversões** (achado 5c): o formulário do Avançado deveria trazer, na zona calculada, o equivalente em R$ das premissas em % que o Avançado não aceita.

## Aprendizados do processo

- **2xx não é gravado certo.** Todas as chamadas de escrita voltaram 200/201 e o estudo estava errado em silêncio (achado 1). A
  verificação foi reler o estado e rodar o motor, não olhar status.
- **Rodar o motor do repo sobre a instância (`conferir-estudo`) achou mais que ler as respostas da API.** E achou também defeito do
  próprio `conferir-estudo` (#835, #827): conferir a conferência é parte do trabalho.
- **Ler o contrato canônico no código antes de escrever o importador** teria poupado uma volta: a nota da #657 já dizia o que acontecia.
- **Reaproveitar a função do app** (`fluxoPagamentoParaSalvar`) em vez de reescrever a conversão evita criar uma terceira cópia da regra.
- O formulário simplificado **funciona como interface**: os campos que deram problema não são os de valor, e sim os de contrato (achados F1–F6).

## Resíduo

Quatro estudos em rascunho na Pinguim, ids 25 a 28, prefixo `qa-`, autor QA Principal. Não foram arquivados nem apagados: são os
estudos pedidos. Nenhum token foi cunhado, nenhuma alçada concedida, nenhum usuário do pool ativado. Estado compartilhado
alterado: nenhum além dos próprios estudos.
