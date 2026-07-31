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

## Evolução prevista — dependente de #241

> ⚠️ **A exportação atual não possui nenhuma das linhas abaixo.** Ela reproduz a Proforma e as
> séries que o motor calcula hoje. Esta seção registra o alvo, não o estado.

Quando **EVI-021 / #241** for implementada — depois de #237, #239 e #240 —, a exportação passa a
abrir:

- valor bruto contratado;
- descontos comerciais;
- valor contratado líquido;
- principal recebido;
- juros recebidos;
- carteiras por componente (prazo fixo curto, prazo fixo longo, até marco, saldo para repasse);
- **visão diagnóstica por safra** — Grupo, tipologia, mês da contratação, componente, principal,
  sinal, primeiro vencimento, prazo ou marco, parcela, juros e saldo final.

A visão executiva permanece consolidada; a abertura por safra existe para explicar divergências.
Ver [Padrão de Viabilidade — Incorporação](padrao-incorporacao) §22.4.
