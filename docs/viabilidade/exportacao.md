---
titulo: Exportação
descricao: Formatos e conteúdo dos relatórios exportáveis (PDF e Excel).
tipo: app
ordem: 7
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Exportação

Disponível na aba **Proforma** a partir do status **Em análise**.

## Formatos

- **PDF** — abre uma página formatada com os **mesmos estilos/tokens do app** (cabeçalho do estudo, KPIs e a Proforma linha a linha) e aciona a impressão do navegador (“Salvar como PDF”). Mantém a identidade visual do UrbiVerso sem depender de biblioteca externa no backend.
- **Excel** — gera um **CSV** (UTF-8 com BOM, separador `;`, decimais em vírgula) que o Excel abre diretamente, com todas as linhas da Proforma e o percentual sobre o VGV.

## Notação de sinal — a mesma da tela

A coluna **R$** do CSV e do PDF da Proforma usa **`celulaProforma`**, a mesma função que a tabela
da tela usa: **receita e resultado com o sinal REAL** (negativo entre parênteses, positivo sem
marca) e **custo/dedução SEMPRE entre parênteses**, independente do sinal — a app grava custo como
valor positivo. A coluna **% VGV** segue a mesma regra da tela: no **Resultado** a fração leva o
sinal (é a margem); nas demais é a magnitude.

Nenhuma célula da tabela traz o símbolo "R$" — o **cabeçalho da coluna** já o informa, nos três
destinos. Os KPIs do topo do PDF continuam com o símbolo, porque ali não há cabeçalho que o diga.

> **Por que isto está escrito aqui.** Até 2026-08-28 o CSV e o PDF formatavam com `fmtR$` cru: uma
> Receita operacional negativa saía `-R$ …` no arquivo e `(…)` na tela, sobre o mesmo número, e a
> % VGV do Resultado saía positiva no arquivo e negativa na tela (achado 10 da auditoria #574). A
> função de notação mora em `frontend/exportar.ts` — e não na tela — porque a tela já importa a
> exportação (pelos botões), e o contrário fecharia um ciclo de módulos; a tela a **reexporta**.
> Quem impede as duas de divergirem de novo é o teste de paridade célula a célula em
> `frontend/proforma-ordem-linhas.test.ts`, que não compara contra um formato escrito à mão: compara
> os dois lados entre si.
>
> Desde o conserto da rodada 1 de revisão dessa unificação, a paridade vale nas DUAS colunas de
> verdade: a % VGV da tela (`_pctVgv`) DELEGA para `pctVgvProforma` — antes era uma cópia da regra,
> e o teste só protegia o lado da exportação.
>
> ⚠️ Efeito colateral **semântico** no CSV, deliberado e registrado: a notação contábil grava
> custo como `(1.234,56)`, e o Excel pt-BR importa parêntese como número **negativo** — antes
> (`fmtR$` cru) as linhas de custo entravam positivas na planilha. Não há risco de parsing (o CSV
> usa `;` e nenhum valor novo contém `;`, aspas ou quebra de linha); o que muda é o sinal que uma
> fórmula do usuário enxerga. Se o autor preferir o comportamento antigo no CSV, é uma troca de
> `comParenteses` num único call site.

## Decisão de implementação

A Proforma é calculada no **frontend** (ver [Fórmulas](formulas)); por isso a exportação também é gerada no frontend, a partir dos valores já computados na tela. Isso garante fidelidade ao que o usuário vê e reaproveita a formatação existente.

## Escopo

MVP exporta o **estudo completo** (Premissas + Proforma). Comparação de cenários e análise de sensibilidade são visualizadas na tela; a exportação dedicada desses blocos e o layout gráfico avançado ficam para v2.

## Fluxo de Caixa Avançado — #241

CSV e PDF reproduzem a mesma hierarquia achatada da tabela do Fluxo de Caixa,
na visão mensal ou anual selecionada. A exportação abre:

- valor bruto contratado;
- descontos comerciais;
- valor contratado líquido;
- principal recebido;
- juros recebidos;
- contratação por Grupo e tipologia;
- recebimentos por componente (À vista, Tabela curta, Tabela longa — Obra,
  Repasse e Após-chaves);
- carteiras por componente (Curta, Longa — Obra e Saldo a repassar);
- Receita Líquida, custos, Funding e relatório de reconciliação.

A visão diagnóstica por safra permanece técnica e aparece quando uma
divergência fornece safra/linha/mês. Ver
[Padrão de Viabilidade — Incorporação](padrao-incorporacao) §22.4.

## Evolução prevista — funding, permuta física e valor canônico

O Capital Stack implementado abre o bloco de funding com a mesma árvore da
tabela de fluxo:

- liberações de financiamento à produção e de capital de giro;
- aportes de equity preferencial e de Sponsor Equity;
- juros e taxas de dívida, amortização de principal;
- devolução de Preferred Equity, retorno preferencial, participações sobre receita/residual e
  distribuições ao sponsor;
- saldos por instrumento, capital não devolvido, retorno preferencial acumulado e **lacuna de
  funding**.

Regra de ouro: **CSV, PDF e Cenários consomem exatamente os mesmos arrays do motor** — nada é
recalculado na camada de apresentação. Ver
[Funding, Capital Stack e Retorno do Capital](funding-capital-stack) §10.

## Permuta física por tipologia — #269

Quando o estudo tem ao menos uma linha de custo `Preço/Permuta física` (#266/#267), tela, CSV e PDF
abrem, por tipologia: quantidade permutada, quantidade total do catálogo e área permutada (m²) —
mesma fonte nos três lugares (`permutaFisicaPorTipologia`, `frontend/fluxo-invariantes.ts`); nenhum
recalcula por conta própria. Sem permuta física declarada, a seção não aparece.

VGV potencial (catálogo inteiro) × VGV vendável (sem a fatia permutada) aparecem como KPIs na aba
Resumo (`vgvTotal`/`vgvVendavel` do `FluxoCalc`, já existentes desde a #268) — só quando há permuta.

A reconciliação `alocado + permutado ≤ quantidade do catálogo` já existia em duas camadas
(`validarProduto`, geral; `validarPermutaFisica`, específica por tipologia — inclusive referências a
tipologia inexistente no catálogo, caso que `validarProduto` não cobre). A #269 conectou a segunda ao
relatório que a tela e as exportações já mostravam — nenhuma lógica nova de validação.

**Dependente de #260 (`BUGLIST-018`).** As exportações deixam de reler campos de exibição e passam a
consumir o **valor canônico resolvido**, como o resto dos consumidores — hoje não há contrato que
garanta isso, e uma premissa digitada em `% VGV` pode chegar diferente à exportação e à tela.
