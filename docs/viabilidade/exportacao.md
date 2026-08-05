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

**Dependente de #269 (`BUGLIST-015-D`).** A exportação passa a abrir a permuta física por
tipologia: quantidade e área permutada, VGV potencial × VGV vendável, e a reconciliação
`alocado + permutado ≤ quantidade do catálogo`.

**Dependente de #260 (`BUGLIST-018`).** As exportações deixam de reler campos de exibição e passam a
consumir o **valor canônico resolvido**, como o resto dos consumidores — hoje não há contrato que
garanta isso, e uma premissa digitada em `% VGV` pode chegar diferente à exportação e à tela.
