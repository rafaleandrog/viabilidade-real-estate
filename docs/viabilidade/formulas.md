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

## Fluxo avançado por safras — onde as fórmulas vivem

> ⚠️ **Nada desta seção descreve runtime.** As fórmulas acima são a **Proforma** (Preliminar), que
> roda hoje em `frontend/proforma.ts`.

As fórmulas do **fluxo de caixa avançado por safras** — contratação bruta/desconto/líquido,
componentes de pagamento (imediato, prazo fixo, até marco, concentrado), PMT, primeiro vencimento
em `s + 1`, carteira por safra e repasse — estão nos dois documentos EVI:

- [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao) — significado econômico;
- [Padrão de Viabilidade — Incorporação](padrao-incorporacao) §11 a §14 — dinâmica funcional, com
  os cenários dourados no Anexo G.

Elas são **modelo funcional de referência**, não comportamento instalado: o motor atual
(`frontend/fluxo-caixa-motor.ts`) rateia valor nominal e não tem safra, juros do cliente nem
carteira. A implementação depende das issues #230–#237 da Rodada 5, cujos corpos ainda precisam de
emenda — ver `docs/revisao-recebiveis-calliandra-2026-07-31.md`.

> 🚫 **Não copiar fórmula de carteira do arquivo Urbitá.** As fórmulas de carteira daquele arquivo
> admitem saldo negativo e saldo que volta a crescer depois da última parcela. A recorrência correta
> é por safra: `saldo_s,s = principal_s`, depois
> `saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t`.

## Funding e Capital Stack — onde as fórmulas vivem

> ⚠️ **Nada desta seção descreve runtime.** A aba `Viabilidade → Financeiro` é hoje **inteiramente
> inerte**: ~25 colunas persistidas e renderizadas, **zero** referências no motor (grep confirmado
> em `frontend/fluxo-caixa-motor.ts`, `frontend/proforma.ts` e `frontend/fluxo-shared.ts`).

As fórmulas de **necessidade de funding, liberação por custos elegíveis, juros sobre saldo de
abertura, cash sweep, waterfall de distribuições e retorno por instrumento** (MOIC, ROI, TIR do
investidor) estão em documento próprio:

- [Funding, Capital Stack e Retorno do Capital](funding-capital-stack) — §3 conceitos canônicos,
  §4 instrumentos, §6 waterfall, §8 KPIs, §12 invariantes.

São **modelo funcional de referência**, não comportamento instalado. A implementação depende da
epic **#239** e das dez sub-issues **#270–#279** (FIN-01…FIN-10), que por sua vez dependem de um
motor de recebíveis estável (#231, #237) e da desagregação fiscal (#228).

Duas identidades que não podem ser violadas quando essas fórmulas entrarem:

```text
fluxo_apos_funding_t = fluxo_livre_projeto_t + entradas_funding_t − saidas_funding_t
```

**Funding nunca integra a Receita Bruta — VGV.** Liberação de dívida, tomada de capital de giro e
aporte de equity aparecem **somente** no bloco de funding; o repasse continua sendo recebimento do
cliente, ainda que o caixa alimente cash sweep.

## Valor canônico dos campos multiunidade

> ⚠️ **Comportamento vigente defeituoso, com issue aberta.** Nos campos com badge de unidade, o
> **valor exibido é o valor persistido**: trocar o badge grava a conversão arredondada, e a troca de
> representação altera a premissa.

`converterUnidade` arredonda a 2 casas (`frontend/premissas-conversao.ts:50-58`). As Premissas
mitigam isso com uma heurística de round-trip (#119, `frontend/tela-premissas.ts:334-358`) que
depende de haver **um campo persistido por unidade**; Custos do Avançado guarda **um único**
`orcamento_valor` + `orcamento_unidade` e arredonda à precisão de exibição a cada clique
(`frontend/tela-fluxo-custos.ts:873-875,882-896`), sem preservação.

**Modelo funcional de referência:** cada premissa multiunidade tem uma quantidade econômica
**canônica**; a unidade exibida é apresentação. Toda fórmula — Proforma, Fluxo, Resumo, benchmarks,
sensibilidade, cenários e exportações — consome o **valor resolvido**, e cada percentual declara seu
denominador. Fundação em **#259**, consumidores em **#260**.

## Interpretações

Onde a spec era ambígua/contraditória, seguimos o app-protótipo e o bom senso: custo do terreno incide sobre a **área do terreno**; “obras” = infraestrutura (Loteamento) / construção+decoração+gestão (Incorporação); projetos e licenciamento no modo % incidem sobre o **VGV**. Detalhes no cabeçalho de `frontend/proforma.ts`.
