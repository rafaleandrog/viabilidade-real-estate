---
titulo: Benchmarks
descricao: Os valores de referência por tipo de empreendimento — indicadores de meta, faixas do medidor e variações de sensibilidade — e as três coisas que eles fazem nos estudos.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Benchmarks

> Um conjunto de referências por tipo de empreendimento, mantido pelo administrador e usado por todos os estudos: para colorir os indicadores, para dar as faixas dos cenários e para definir o piso do preço sugerido.

## O que é

Benchmarks são registro geral do app, um conjunto para Loteamento e outro para Incorporação. Cada
registro é um indicador identificado por `campo`, e há três famílias:

| Família | Indicadores | O que guardam |
|---|---|---|
| **Meta** | `margem_liquida`, `roi`, `custo_obras_vgv`, `resultado_final`, `margem_bruta` e, só no Loteamento, `eficiencia_aproveitamento` | **Valor** e **Regra** (*atingir ou superar* ou *não exceder*), mais os limites do medidor |
| **Sensibilidade** | `preco`, `permuta_fisica`, `permuta_financeira`, `custo_obras` | **Var + (%)** e **Var − (%)** |

O indicador `margem_bruta` existe no conjunto, mas nenhuma tela o lê hoje: o app não calcula uma
margem bruta, e o medidor correspondente fica declaradamente sem fonte.

## Para usuários

Os benchmarks aparecem em três lugares dos estudos:

1. **Validação de indicadores.** Cada indicador de meta compara o valor calculado com o **Valor**
   pela **Regra**: *atingir ou superar* (Resultado final ≥ 25 %, por exemplo) fica verde quando
   atingido e vermelho quando não; *não exceder* (Custo obras / VGV ≤ 35 %) o inverso. É a cor dos
   cards de KPI e dos medidores da aba Gráficos, cujas faixas vêm de **Mín**, **Faixa 1 até**,
   **Faixa 2 até** e **Máx** — em branco, as faixas saem automaticamente da meta.
2. **Variações dos cenários.** Na análise de sensibilidade de Cenários, **Var +** e **Var −** do
   indicador de sensibilidade da variável escolhida são as variações de Bull e Bear (10 % quando
   não há benchmark). Não há sobrescrita por estudo.
3. **Piso do preço sugerido.** O **Valor** de `resultado_final` é o piso que o preço sugerido por
   m² precisa atingir (ver [Fórmulas da Proforma](formulas)).

## Para administradores

A tela fica na aba **Benchmark** do Painel e em *Admin → Apps → viabilidade → Benchmarks*, com as
fichas **Loteamento** e **Incorporação** e três seções — **Indicador de Benchmark**, **Indicador de
Sensibilidade** e **Faixas do medidor**. Na primeira abertura por quem pode escrever, os indicadores
padrão que faltam são semeados nos dois tipos. Só o `admin` do app escreve. Detalhe em
[Administração](administracao).

## Instruções para não humanos

`GET /benchmarks?tipo_empreendimento=…` (leitura para qualquer usuário do app; `400 TIPO_INVALIDO`
para um tipo desconhecido); `POST /benchmarks`, `PATCH`/`DELETE /benchmarks/:id` e
`POST /benchmarks/semear` (idempotente) só `admin`. Único por `[tipo_empreendimento, campo]`.

## Veja também

- [Administração](administracao) · [Fórmulas da Proforma](formulas) · [Estudo Preliminar](preliminar)
