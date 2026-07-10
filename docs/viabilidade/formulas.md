---
titulo: Fórmulas da Proforma
descricao: Referência das linhas e cálculos da Proforma (Loteamento e Incorporação).
tipo: app
ordem: 3
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Fórmulas da Proforma

As fórmulas rodam no **frontend em tempo real** (engine `frontend/proforma.ts`, coberta por testes). O backend persiste apenas os inputs.

## Áreas e VGV

- **Loteamento:** `área vendável = área da gleba × (1 − Σ percentuais de dedução)` (APP, faixas, viário, ELUP, EPC, EPU, priv. não vendáveis, todos % da gleba). Após permuta física → **área vendável líquida**. `VGV = área vendável líquida × preço/m²`.
- **Incorporação:** `VGV = (Área PVT R Fechada × preço residencial) + (Área PVT NR Fechada × preço não residencial)` — usa as **áreas fechadas**.

## Deduções da receita

Imposto (`4%` se sujeito a RET, senão `imposto_percentual`), corretagem, marketing e permutas financeiras (% do VGV residencial/não residencial). `Receita líquida = VGV − deduções`.

## Custos diretos

Terreno (`custo/m² × área do terreno`, zerável pelo checkbox “considerar”), projetos, manutenção, contingências (% VGV) e, por tipo: **Loteamento** → infraestrutura (toggle R$/m² ou % VGV); **Incorporação** → construção, decoração, gestão da construção, outorga, incorporação e registro.

## Custos indiretos

Marketing global/estrutura (+ stand de vendas no Loteamento) e gestão/indiretos (% VGV).

## Resultado

`Resultado = Receita líquida − Custo direto total − Custo indireto total`. Também: `+ permutas financeiras` e `+ permutas físicas`. `Margem líquida (%) = Resultado / VGV × 100`.

## Preço Sugerido/m²

Menor preço de venda por m² para a margem atingir o **piso do benchmark `resultado_final`**. Resolvido por bisseção sobre o preço (valor único, mesmo na Incorporação). Ver [Benchmarks](benchmarks).

## Interpretações

Onde a spec era ambígua/contraditória, seguimos o app-protótipo e o bom senso: custo do terreno incide sobre a **área do terreno**; “obras” = infraestrutura (Loteamento) / construção+decoração+gestão (Incorporação); projetos e licenciamento no modo % incidem sobre o **VGV**. Detalhes no cabeçalho de `frontend/proforma.ts`.
