# Ideias — Estudo de Viabilidade

Uma linha por ideia: `- **título**: descrição.`
Ideia que não cabe numa linha deixou de ser ideia — abra a issue.

## Braindump

- **Parâmetros padrão de imposto, corretagem, marketing e gestão ligados aos estudos novos**: os quatro parâmetros existem no manifesto e saem em `GET /config`, mas nenhuma tela os lê — os campos do estudo nascem com o `padrao` do modelo de dados. Ou o app passa a usá-los ao criar o estudo, ou eles saem do manifesto.
- **Fonte externa de busca para a coleta diária de mercado**: declarar no manifesto os parâmetros de URL e chave da fonte, para a rotina sair do modo `sem_fonte_externa` e gravar coletas.
- **Indicador de margem bruta**: o benchmark `margem_bruta` existe sem indicador correspondente; definir a fórmula e ligar o medidor.
- **Entrada de taxa e sinal no fluxo de pagamento**: o modal de Fluxo de Pagamento não oferece campo de taxa mensal nem de sinal por componente; o motor já os calcula quando estão persistidos.
- **Exportação dos Cenários do Preliminar**: tornado, margem de segurança e sensibilidade só existem na tela.
- **Exportação própria da Proforma do Avançado**: hoje só o Fluxo de Caixa sai em CSV e PDF.
- **Unificar qual leitura do resultado cada superfície mostra**: o Painel e os KPIs usam `= Resultado`; a Proforma do Avançado mostra também as leituras com permutas.
- **Rótulo "Capital de giro" na tela de Funding**: a dívida já é o capital de giro por calendário; falta o rótulo que diga isso.
- **Copiar documentos ao duplicar um estudo**: a cópia leva o apelo comercial sem as fontes que o geraram, porque o binário pertence ao shell.

## Aprovadas

## Descartadas

- **Linha de crédito rotativa no funding**: reintroduziria a competição por caixa que o modelo de três operações independentes eliminou.
- **Instrumento de capital com waterfall de quatro camadas**: substituído pelas três operações independentes; o registro está em `referencia/funding-capital-stack.md` e `referencia/modelo-de-dados-evolucoes.md`.
