# Estado da Arte — Estudo de Viabilidade (`viabilidade`)

> Este documento descreve a versão final e ideal do app. É lido só pelas sessões e agentes de IA
> que trabalham no repositório. Mora em `.claude/estado-da-arte/`, que não entra no pacote do app.
> **Só muda por PR que o dono mergeia.** Nenhuma sessão edita este arquivo direto.
>
> **Versão 1, rascunhada pela IA na etapa PREPARAR (2026-11-19)** a partir do `CLAUDE.md`, do
> `manifesto.json`, dos guias em `docs/`, do `ideias.md`, das issues abertas (em especial o índice
> de diagnóstico #858) e dos documentos de `referencia/`. Nada aqui é regra de negócio nova: onde a
> frase é leitura da IA, e não algo que o dono já disse ou decidiu, ela está marcada com **(?)** e
> repetida em § Perguntas ao dono. Situação de cada item medida contra a `main` em `8a6417a`, pelas seções
> do `PROGRESSO.md` de 2026-11-12 a 2026-11-16. Várias issues citadas seguem abertas no GitHub com
> o código já entregue, à espera de conferência ao vivo na Pinguim; a situação diz qual é o caso.

## Para quem é e o que resolve

Para a equipe de incorporação e loteamento da empresa, e para a diretoria que aprova: substitui as
planilhas de viabilidade (a EVI) por estudos guardados na instância, calculados sempre do mesmo
jeito e compartilhados por membros com funções distintas. Responde, com rastreabilidade, o que será
construído, por quanto e quando se vende, como e quando se recebe, quando se paga cada custo,
quanto capital e dívida o projeto exige, e qual resultado, retorno e exposição ele produz.
**(?)** — redação da IA a partir de `docs/README.md` e da §1 de `referencia/padrao-incorporacao.md`;
falta a versão nas palavras do dono.

## Princípios

- **Determinismo.** Mesmas premissas, mesmas regras e mesma precisão dão o mesmo fluxo e os mesmos
  indicadores; as visões (mensal, anual, por Grupo, consolidada) não mudam o cálculo-base.
- **Entrada separada de resultado.** Campo calculado não se comporta como input livre, e campo
  editável não parece resultado definitivo.
- **Dinheiro em 2 casas** na apresentação, na entrada e no motor; `%` e `R$/m²` em precisão plena,
  arredondados só para exibir. As únicas exceções de exibição são as três que o `CLAUDE.md` lista.
- **O código e o `schema.json` mandam sobre os documentos consultivos.** `referencia/` explica o
  negócio, mas divergência entre eles e o código vira issue, nunca ajuste automático.
- **A tela só oferece o que o servidor aceita**, e o servidor é a fronteira real: permissão,
  validação e ciclo de vida são garantidos lá, não só escondidos na tela.
- **Nível de análise imutável.** Preliminar e Avançado são estruturas de dados diferentes; um estudo
  não muda de nível no lugar.
- **Contratos da plataforma** (ver `CLAUDE.md` § Contratos inegociáveis): backend self-contained,
  migração só transforma dado existente, tokens CSS sem cor literal, só primitivos `urbi-*` e props
  declaradas no SDK fixado.
- **A documentação servida em `docs/` descreve o que a tela de fato faz**, e muda no mesmo PR que o
  comportamento.

## Itens

Um item por coisa que o app deve ser ou fazer na versão final.

### 1. Estudo Preliminar confiável

- **O que é:** das premissas (terreno e áreas, custos, permutas, catálogo de produtos) sai na hora
  uma Proforma coerente, com KPIs contra benchmark, preço sugerido, cascata do resultado, cadeia de
  áreas e Cenários (tornado de alavancas, margem de segurança, cenário composto). Edição não salva
  nunca parece salva, e o estudo não é submetido nem aprovado com catálogo que não forma VGV.
- **Por que importa:** é a decisão rápida de seguir ou não com um terreno. **(?)**
- **Pronto quando:** os itens P1–P9, Q3, Q4 e U2 do índice #858 e as issues #842 e #812 estão
  fechados com diff; `validar-frontend.sh` verde, com caso de render para cada fiação nova.
- **Situação:** parcial — P1 (2026-11-12), Q3, Q4 e U2 (2026-11-16) entregues, com o índice #858
  ainda sem as caixas marcadas; P2–P9, #842 e #812 abertos.

### 2. Estudo Avançado com motor mensal por safras e componentes

- **O que é:** cronograma, tipologias, grupos comerciais e alocações, absorção, fluxo de pagamento
  por componentes (prazo fixo, até marco, concentrado), carteira por safra, repasse, custos
  distribuídos no tempo e fluxo de caixa mensal, para **Incorporação e Loteamento**, com controle de
  estoque e sem resíduo de centavos.
- **Por que importa:** é o estudo que substitui a EVI na decisão de investimento. **(?)**
- **Pronto quando:** os cenários dourados de recebíveis (Anexo G de `referencia/padrao-incorporacao.md`)
  passam; `conferir-estudo` nos estudos vivos da Pinguim não acusa divergência falsa; os itens A1–A6,
  Q1 e Q12 do #858 e as issues #815, #834, #840, #854, #811 e #813 estão fechados (as
  invariantes com falso positivo ficam no item 9).
- **Situação:** parcial — motor por safras ligado ao `calcularFluxo`; A1 e Q1 entregues em
  2026-11-14/16; imposto fora do RET (#834) e invariantes com falso positivo ainda abertos.

### 3. Indicadores de decisão comparáveis aos da EVI

- **O que é:** TIR, VPL, payback, exposição máxima (antes e depois do funding), margem e ROI
  calculados sem descontinuidade — TIR existe também em prejuízo grande, exposição tem piso em zero,
  e "Resultado" significa a mesma coisa em toda superfície.
- **Por que importa:** é o que a diretoria lê para aprovar. **(?)**
- **Pronto quando:** A2 e A3 do #858 fechados; decisão do dono sobre "uma só leitura do resultado"
  (ideia no `ideias.md`) aplicada em todas as superfícies. **(?)** Os KPIs da EVI ainda ausentes
  (exposição após funding a partir do lançamento, VPL com data-base escolhível) estão no
  Braindump do `ideias.md`, não aprovados — por isso não entram no "pronto quando" sem o sim do dono.
- **Situação:** parcial.

### 4. Funding em operações independentes

- **O que é:** dívida, equity, financiamento à produção (com gatilho de exposição mínima, catch-up e
  cash sweep) e antecipação de recebíveis, sem waterfall e sem competição por caixa, seguindo
  `referencia/fluxo-investidor-formulas.md` (e a §4.3 de `referencia/funding-capital-stack.md` para
  o financiamento à produção).
- **Por que importa:** decisão já tomada pelo dono na Rodada 7 (#355, três operações; a antecipação
  de recebíveis veio depois, como quarta) e mantida na Rodada 8.
- **Pronto quando:** Q12 do #858 fechado (o `valor` da antecipação é lido pelo motor ou deixa de
  ser gravado) e o alerta D14 continua coberto por teste.
- **Situação:** parcial (quase feito).

### 5. Do Preliminar ao Avançado sem redigitar

- **O que é:** um botão que gera um estudo Avançado **novo**, pré-preenchido com o que o
  Preliminar já tem, deixando o Preliminar intacto.
- **Por que importa:** pedido do dono (#833); é a única alternativa coerente com o nível imutável.
- **Pronto quando:** a #833 fecha com os achados de `historico/upgrade-preliminar-avancado-2026-10-07.md`
  resolvidos e a equivalência de bases da #841 escrita.
- **Situação:** falta.

### 6. Permissões e ciclo de vida garantidos pelo servidor

- **O que é:** `leitor` vê e exporta, `editor` cria e edita, `aprovador` aprova, reprova e devolve;
  `Rascunho → Em análise → Aprovado | Reprovado`, com arquivamento dos parados. Estudo aprovado,
  reprovado, arquivado ou excluído não é alterado por quem não pode, ninguém se promove sozinho e
  nenhuma rota alcança recurso de outro estudo.
- **Por que importa:** o estudo aprovado é a decisão da diretoria; precisa ser o número que ela viu.
  **(?)**
- **Pronto quando:** #860, #861 e #865 e os itens B1–B7, Q2, Q6 e U4–U7 do #858 fechados, cada um
  com teste HTTP contra Express real; a QA de remoção e acesso (#870) passa na Pinguim.
- **Situação:** parcial — código entregue para B1, B2, B3, B5, Q2 e a #860 (2026-11-12), para B4 e
  a #861, teto da função pelo nível (2026-11-14), e para U4, U5 e U7 (2026-11-16). As issues
  #860 e #861 seguem abertas: falta revalidar ao vivo com a skill `qa` e, na #861, o levantamento da Laputa antes do upgrade. B6, B7, Q6, #865 e #870 abertos.

### 7. Mercado e Apelo Comercial por IA que de fato produzem leitura

- **O que é:** a Análise de Mercado compara os números do estudo com os do mercado das regiões
  monitoradas, com coleta diária vinda de uma fonte externa; o Apelo Comercial grava as 24 notas e
  o score geral a partir dos documentos anexados.
- **Por que importa:** **(?)** — o manifesto declara a IA e a rotina diária, mas hoje a coleta roda
  `sem_fonte_externa`.
- **Pronto quando:** #862 e #868 fechados; a rotina grava coletas na Pinguim com fonte configurada
  (D3 e B9 do #858).
- **Situação:** parcial — a gravação das 24 notas e do score (#862) foi entregue em 2026-11-14 e
  falta rodar a análise na Pinguim; a coleta segue sem fonte externa (D3, B9).

### 8. Exportação segura e fiel à tela

- **O que é:** PDF e Excel/CSV com a mesma ordem e os mesmos números da tela, sem HTML cru nem
  fórmula injetada, com rótulos legíveis (não `em_analise`).
- **Por que importa:** o estudo circula fora do app. **(?)**
- **Pronto quando:** U1, U3 e U9 do #858 fechados. **(?)** Exportar os Cenários do Preliminar e a
  Proforma do Avançado está no Braindump do `ideias.md` — entra aqui só se o dono aprovar.
- **Situação:** parcial — U1 (escape do PDF) entregue em 2026-11-16; U3 e U9 abertos.

### 9. Estudo auditável

- **O que é:** as invariantes do fluxo acusam incoerência real e só ela (sem falso positivo), e o
  `scripts/conferir-estudo.ts` reproduz a conferência de qualquer estudo vivo.
- **Por que importa:** o app deve impedir combinações de premissas que produzam resultado
  incoerente (§1 de `referencia/padrao-incorporacao.md`).
- **Pronto quando:** A4 e D2 do #858 e as issues #808, #815, #824, #827, #832 e #835 fechados;
  `conferir-estudo` nos estudos 14–18 da Pinguim sem divergência além das esperadas.
- **Situação:** parcial.

### 10. Documentação servida coerente com a tela

- **O que é:** os 12 guias de `docs/` descrevem só o comportamento vigente, pela régua do framework.
- **Por que importa:** é o que o usuário e o assistente de docs da instância leem.
- **Pronto quando:** cada PR de comportamento atualiza o guia no mesmo diff; #814 (Loteamento no guia
  do Avançado) e #823 fechados.
- **Situação:** parcial (quase feito).

## Fora do Estado da Arte, de propósito

- **Linha de crédito rotativa no funding** — reintroduziria a competição por caixa (Rodada 8).
- **Capital Stack com waterfall de quatro camadas** — substituído pelas operações independentes do item 4.
- **Promover o nível do estudo no lugar** ou **compartilhar premissas ao vivo** entre Preliminar e
  Avançado — fechados (#441, #486); o caminho é o item 5.
- **Mudar a base de receita líquida do equity** para casar com as planilhas — divergência
  intencional (Rodada 8, decisão 3).

## Perguntas ao dono

1. **Para quem é e o que resolve:** a redação acima é da IA. Como você diria, em duas ou três frases?
2. **"Por que importa"** dos itens 1, 2, 3, 6, 7 e 8 é leitura da IA. Algum motivo está errado?
3. **Loteamento no Avançado** (item 2): ele tem a mesma régua de Incorporação na versão final, ou
   Incorporação vem primeiro?
4. **Mercado e Apelo por IA** (item 7): são parte do destino, ou podem sair do app se a fonte
   externa não vier?
5. **Ideias do Braindump** (`ideias.md`): quais viram item do Estado da Arte? Em especial
   inadimplência/distrato/PDD e coobrigação, os KPIs da EVI ainda ausentes, "uma só leitura do
   resultado", exportar Cenários e a Proforma do Avançado, e copiar documentos ao duplicar.
6. **O que falta neste documento:** algo que o app deve ser e que nenhum sinal do repositório
   mostra hoje?
