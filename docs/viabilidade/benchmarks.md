---
titulo: Benchmarks e Sensibilidade
descricao: Indicadores de referência, validação por benchmark e faixas de sensibilidade.
tipo: app
ordem: 4
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Benchmarks e Sensibilidade

Benchmarks são registro geral do app (não do Núcleo), definidos pelo **administrador** e usados como base por todos os estudos. Cada tipo de empreendimento (Loteamento, Incorporação) tem o seu conjunto.

## Configuração

Tela **Config → Benchmarks** (`viabilidade-config-benchmarks`). Botão **“Criar indicadores padrão”** semeia o conjunto do MVP: `resultado_final`, `margem_bruta`, `margem_liquida`, `roi`, `custo_obras_vgv` e — só no Loteamento — `eficiencia_aproveitamento`. Edição restrita a administradores (aprovadores).

## Três funções

1. **Validação de indicadores** — cada benchmark tem `valor` e `regra_comparacao`:
   - `atingir_ou_superar` (ex.: Resultado final ≥ 25%) — KPI verde se atingido, vermelho se não.
   - `nao_exceder` (ex.: Custo Obras / VGV ≤ 35%).
2. **Faixas de sensibilidade** — `variacao_positiva_pct` / `variacao_negativa_pct` são o default para o Bear/Base/Bull. Podem ser sobrescritas por estudo (`sensibilidade_variacao_*_pct`).
3. **Piso do Preço Sugerido/m²** — o benchmark `resultado_final` define o piso de retorno usado no cálculo do preço sugerido (ver [Fórmulas](formulas)).

## Análise de sensibilidade

Na aba Proforma, escolhe-se uma variável a estressar (preço/m², permuta física/financeira, custo de infraestrutura no Loteamento ou de obras na Incorporação). O app calcula **Bear** (base × (1 − var⁻)), **Base** e **Bull** (base × (1 + var⁺)) e exibe as linhas afetadas lado a lado. MVP é unidimensional.

## API

`GET /benchmarks?tipo_empreendimento=…` (leitura livre); `POST`/`PATCH`/`DELETE /benchmarks` e `POST /benchmarks/semear` (admin).
