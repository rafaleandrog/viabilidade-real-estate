# Rodada 16 — Funding em cartões, janela de operação e Estrutura de capital

> Registro datado do arco da guarda-chuva #1005, conduzido pela skill `orquestrar` em 2026-11-26 e
> 2026-11-27. Fotografia do que foi feito, escrita no PR de fechamento (fase 8, issue #1013). As
> fontes são a guarda-chuva (corpo, errata, comentário fixo "Decisões da coordenadora e como
> retomar o arco" e checklist vivo), as oito sub-issues com os adendos, o corpo e os relatórios de
> revisão de cada PR e o `git log` da `main`. O que vem só do roteiro da coordenadora e não está
> em nenhum desses lugares está marcado "segundo a coordenadora". Este arquivo envelhece de
> propósito: o estado corrente está no `PROGRESSO.md` e na linha da Rodada 16 do `CLAUDE.md`.

## Pedido do dono

Redesenhar a página **Funding** do estudo Avançado no formato das telas de referência que o dono
trouxe (OSPA Capital): um cartão de identificação por operação, criação e edição numa janela com
etapas, resumo ao vivo e prévia, e uma aba nova com a estrutura de capital do projeto. Tudo com os
tipos, campos e cálculos que o app já tinha.

**Estado da Arte:** avança o item **0.4** (estrutura de capital / estratégia de crédito, referência
OSPA) e o item **4** (Funding em operações independentes). O documento foi só referência: nenhuma
fase o editou, por decisão do dono.

## Decisões do dono (D1 a D14)

| # | Decisão |
|---|---|
| D1 | Abas do Funding: Operações, Financiamento à produção, Estrutura de capital. Saem Dívida, Equity, Antecipação e Comparar estruturas |
| D2 | Operações mostra um cartão por operação de dívida, equity e antecipação, com `urbi-badge` de cor diferente por tipo, os dados essenciais e os KPIs |
| D3 | Clicar no cartão abre a página da operação dentro do Funding, com botão de voltar para Operações |
| D4 | Criar e editar numa janela com etapas, resumo ao vivo e prévia do fluxo. O tipo é escolhido ao criar e trava depois, também no servidor |
| D5 | Só os tipos e campos que já existem. Nenhuma coluna, migração ou mudança de `versao` |
| D6 | Financiamento à produção em aba própria, sem cartão; é o único com liga/desliga, que passa a ser `urbi-toggle` |
| D7 | KPIs do cartão. Dívida: LTV, custo efetivo, TIR alavancada, exposição máxima. Equity: ROI e TIR do investidor, TIR alavancada, exposição máxima. Antecipação: deságio, custo efetivo, TIR alavancada, exposição máxima |
| D8 | TIR alavancada e exposição máxima como "antes → depois", em sequência por senioridade: Financiamento à produção → dívidas → antecipações → equity → incorporador; dentro do tipo, a `ordem` |
| D9 | Senioridade = ordem de pagamento e ordem de entrada na comparação; é rótulo e ordem de leitura, o motor não muda |
| D10 | Antecipação de recebíveis é uma terceira categoria, com cor própria, entre as dívidas e o equity |
| D11 | "Leitura da operação" montada por regras dos números, sem IA nem campo digitado |
| D12 | Cartões e Estrutura de capital em "R$ 20,1 mi"; a página da operação em reais cheios |
| D13 | Estrutura de capital como torre de barras com texto dentro, mais sênior embaixo, incorporador no topo, altura proporcional; tamanho = maior valor da parte no projeto; vendas fora do desenho |
| D14 | Comparar estruturas é apagado |

A errata da guarda-chuva, depois do refino, corrigiu quatro imprecisões do corpo: o registro do
`urbi-toggle` era inferência e não afirmação do SDK; a prop do `urbi-badge` é `cor`, com valores
`variante_1` a `variante_8`; a lista de quem edita nunca vem vazia (a tela cria o Financiamento à
produção desligado), então o estado vazio de Operações é "nenhuma dívida, equity ou antecipação";
e o servidor não reancora operações de funding quando o Cronograma muda.

## Fases e PRs

Serial, um PR por fase, merge em squash. Horários de merge em UTC, do `merged_at` de cada PR.

| Fase | Issue | PR | Squash | Merge | Entrega |
|---|---|---|---|---|---|
| 1 | #1006 | #1014 | `5e9e4c4` | 26/11 19:59 | núcleo de cálculo puro `frontend/funding-estrutura.ts` (senioridade, sequência, camadas, totais, KPIs, leitura por regras), `fmtR$Mi` e a 4ª exceção de exibição; bloco "ESTRUTURA DE CAPITAL (senioridade)" no `scripts/conferir-estudo.ts`. Nenhuma tela muda |
| 2 | #1007 | #1015 | `2392747` | 26/11 21:11 | `mesDaAncora` e `operacaoComRascunho` em `frontend/fluxo-shared.ts`, com teste de paridade contra o servidor; com rascunho, a prévia refaz o fluxo-base com as operações efetivas. Servidor sem mudança |
| 3 | #1008 | #1018 | `1520829` | 26/11 22:04 | aba Operações em cartões (`viab-funding-cartao`, `dadosDoCartao`, cores por tipo) e página da operação com `urbi-botao-voltar`; saem as abas por tipo |
| 4 | #1009 | #1019 | `f56f397` | 27/11 01:40 | janela com etapas `viab-funding-janela` (resumo ao vivo, prévia, PATCH só do que mudou); página da operação em leitura; tipo travado no servidor (`422 TIPO_IMUTAVEL`); espelho das regras do servidor em `frontend/funding-validacao.ts`; as quatro sobras da fase 3 |
| 5 | #1010 | #1020 | `5b3f192` | 27/11 02:51 | aba Estrutura de capital: quatro totais, torre `viab-grafico-stack-capital` e tabela da sequência, tudo da mesma simulação |
| 6 | #1011 | #1021 | `00fa44d` | 27/11 06:09 | remoção da aba Comparar estruturas e do código sem consumidor; a frase do guia sobre o empate de antecipações (sobra da fase 5) |
| 7 | #1012 | #1024 | `af0ed83` | 27/11 07:18 | liga/desliga do Financiamento à produção com `urbi-toggle` e queda para a caixa de seleção (`controleLigaDesliga`); as quatro sobras da fase 4 (foco depois da recusa, `focarAlvo`, `400 CAMPO_INVALIDO` para `tipo` malformado no PATCH, teste HTTP de "deixar de ser Financiamento à produção") |
| 8 | #1013 | este PR | — | — | registro da rodada, guias conferidos contra a tela, lista de verificação visual e pedidos à plataforma na guarda-chuva |

Nenhuma fase mexeu em `schema.json`, `manifesto.json` nem em `migracoes/` (conferido por
`git diff --stat 8560c8e af0ed83` nesses caminhos: vazio). A `versao` segue a da `main` de antes do
arco.

## Método

Primeira rodada conduzida pela skill `orquestrar`: uma sessão coordenadora que não escreve código;
uma sessão Sonnet que refinou as oito sub-issues contra o código; e, para cada fase, uma sessão Opus
de implementação e outra Opus de revisão (a `revisar-pr-apps` deste repositório, com no máximo três
rodadas por sessão), em série. Merge autorizado pelo dono para o arco inteiro: "o merge é seu e de
cada sessão que vai criar a finalizar cada PR."

**Merge.** A chamada de merge das sessões de revisão foi negada pelo classificador de permissão em
todas as fases; nas sete, quem mergeou foi a coordenadora, depois de conferir o portão: head igual
ao reportado, `revisao/bloqueantes` verde nesse head, check runs verdes e posteriores ao último
commit da `main`, `mergeable_state` limpo, `Closes` no corpo e diff dentro do escopo.

**Tempos de relógio** (UTC, segundo a coordenadora), implementação / revisão por fase: refino das
issues 14 min; 1 = 14 / 30 min; 2 = 15 / 56; 3 = 20 / 31; 4 = 165 (inclui a pausa da sessão no
limite de uso da conta; ela contou 27 min de trabalho depois de retomar) / 48; 5 = 16 / 51;
6 = 9 / 33; 7 = 23 / 40. O arco começou às 18:59 de 26/11 e ficou em pausa das 02:53 às 05:22 de
27/11, por ordem do dono, à espera da renovação do limite de uso; voltou por uma tarefa agendada que
ele mandou criar.

## Motores de revisão

- **App do Codex** (`@codex review`): respondeu em todas as fases. Achados reais, todos
  consertados antes do merge: fase 2, dois P2 (a prévia só derivava o mês quando o rascunho tocava a
  âncora; a prévia simulava sobre o horizonte das operações gravadas e truncava parcelas); fase 3,
  um P1 (reordenar não recalculava a sequência "antes → depois"); fase 4, um P2 (a janela não
  travava enquanto gravava); fase 5, um P2 (torre e totais saindo de simulações diferentes). Na
  fase 1 não respondeu no teto da primeira rodada e respondeu no head do conserto. Nas fases 1, 3 e
  6 o bot também montou consertos equivalentes no ambiente dele (e disse ter aberto PR de
  acompanhamento); nenhum PR novo apareceu no repositório.
- **Fan-out:** pelo Kimi (`kimi` 0.38.0, `kimi-k3`) em todas as fases, instalado pelo preflight do
  motor quando não estava no PATH; o CLI do Codex não existe no ambiente (sem `OPENAI_API_KEY`).
  Lentes que voltaram vazias ou estouraram o tempo foram re-despachadas (fases 4, 6 e 7).

## O que as revisões acharam e consertaram antes do merge

| Fase | Bloqueantes (rodada) e conserto |
|---|---|
| 1 | r1: comentário de `fmtR$Kpi` ainda dizia "três" exceções; limiar `LIMIAR_MES_COM_VALOR` sem teste de fronteira; `rotuloPreferenciaEquity` divergia do predicado do motor para modo vazio; comentário "a ordem não muda o resultado" falso no empate de `inicio_mes`; App sem resposta no teto. Todos consertados na r2 |
| 2 | r1 e r2: os dois P2 do App acima |
| 3 | r1: o P1 do App (reordenar sem recalcular) |
| 4 | r1: o guia dizia que o `422 TIPO_IMUTAVEL` nunca é precedido por um 400 (a coerção roda antes); o caso de render do foco ao remover só espiava `focus()` em vez de medir `document.activeElement`. r2: o P2 do App (janela travada enquanto grava, com `inert` e `aria-busy`) |
| 5 | r1: o texto de apoio dizia que não há cascata de pagamento, o que o motor desmente (o Financiamento à produção faz varredura de caixa); `border-radius` literal; o P2 do App (duas simulações); casos de borda sem teste. r2: o guia afirmava sem ressalva que a última linha da sequência é o "incorporador no pico", igualdade que o conserto quebrou no empate |
| 6 | r1: três símbolos de validação sem consumidor de produção (`errosDoEstadoFinal`, `ROTULO_TIPO_ERRO`, `CAMPOS_OPERACAO_ESPELHO`) saíram com os testes; a regra "Financiamento à produção desligado continua validado" ficou sem teste (uma mutação deixava a suíte verde) e voltou a ser travada |
| 7 | r1: a checagem `tipoInvalidoNoPatch` era redundante com `validarCamposOperacao` e nenhum teste a travava; saiu, e voltar o predicado antigo deixa três testes vermelhos |

## Sobras que viraram adendo

- **Fase 3 → fase 4:** foco ao remover a operação aberta; "antes" ausente no cartão sem riscado nem
  seta; token de raio no lugar do `8px` literal; caso de render do cartão sem lastro.
- **Fase 4 → fase 7:** foco depois de uma recusa do servidor com a janela travada; mensagem do 422
  para `tipo` malformado; o caso "deixar de ser Financiamento à produção" no teste HTTP; o
  `focarAlvo` guardado.
- **Fase 5 → fase 6:** a frase do guia "o resultado do estudo é o mesmo em qualquer ordem", falsa no
  empate de duas antecipações.

## Decisões que a coordenadora tomou sozinha (vetáveis pelo dono)

Do comentário fixo da guarda-chuva: duas sessões por PR, implementação e revisão; sem sessão de QA
na instância (a validação com dado real é a conferência do estudo 82, só leitura); no máximo três
rodadas por sessão de revisão; merge pela coordenadora, porque o das sessões de revisão é negado;
fan-out Kimi cobrindo as duas camadas se o App ficar mudo; ROI de equity sem retorno sai −100%
quando há aporte e a TIR do investidor sai "—"; antecipação sem lastro mantém os quatro KPIs com
"—" e o aviso; a "Leitura da operação" usa o rótulo de mês da tela; a prévia deriva o mês da âncora
em todo rascunho; faixa lateral de 4 px com a cor do tipo no cartão; a janela recusa nome vazio
também na edição (o PATCH do servidor aceita); o gráfico da página da operação é o mesmo componente
da prévia; o rótulo de nível de cada camada é da fase 5; queda para a caixa de seleção se o
`urbi-toggle` não estiver registrado; as sobras de uma fase viram adendo da seguinte; a fase 7 não
troca o texto da mensagem do servidor que cita a caixa "Ativo".

## Conferência com dado real

Segundo a coordenadora (só leitura): `scripts/conferir-estudo.ts` no estudo 82 da instância de
homologação (Avançado; Financiamento à produção desligado, uma dívida, uma antecipação), na `main`
de antes do arco (`8560c8e`) e na de depois da fase 7 (`af0ed83`). As 39 linhas que já existiam
saíram **idênticas**; a única diferença é o bloco novo "ESTRUTURA DE CAPITAL (senioridade)", que a
fase 1 acrescentou. O motor não mudou de número.

## Lacunas da plataforma

Conferidas contra o SDK instalado (pin `93.0.0`) no fechamento; o texto pronto de cada pedido está
no comentário da fase 8 na guarda-chuva.

- `urbi-toggle` fora do registro do barrel para apps: `docs/ui.md` o lista como exceção de import
  por subpath, e apps nunca importam por subpath. A tag existe na página porque o `urbi-tabela` a
  usa; o SDK não declara atributo, `reflect`, `:host`, delegação de foco nem a implementação do
  evento.
- Nenhum componente de etapas; a janela usa `urbi-nav` como trilho.
- `urbi-grafico-colunas` não escreve texto dentro da barra; a torre é componente próprio, e a linha
  dele (e dos três componentes de domínio anteriores) no registro de exceções mora no SDK.
- Não há token de texto sobre cor de categoria (`--cor-categoria-1` a `-8`); a torre mistura a cor
  com a superfície por `color-mix` e usa o texto normal.
- A prop `texto` do `urbi-botao-voltar` não tem marca de versão; num shell antigo o botão degrada
  para só ícone.
- O SDK não declara delegação de foco em `urbi-select`, `urbi-input` e `urbi-botao`, e o Tab preso
  do `urbi-modal` não é mensurável no harness.

## Lições

- **O App do Codex e a fan-out acharam classes diferentes.** Os cinco achados do App foram de
  fiação e de estado (prévia, reordenação, gravação em voo, simulações diferentes); os das lentes
  foram de prosa, de teste que não trava a regra e de código sem consumidor.
- **Remoção também precisa de teste de mutação.** Na fase 6, apagar a comparação levou junto a
  única cobertura de "desligado continua validado"; só a mutação mostrou.
- **Frase de guia sobre ordem e igualdade quebra no caso de borda do motor.** O empate de duas
  antecipações no mesmo mês derrubou três frases ao longo do arco (comentário da fase 1, guia das
  fases 5 e 6).
- **Merge pela coordenadora funcionou como portão.** O classificador negou o merge às sessões de
  revisão; a conferência do portão pela coordenadora, PR a PR, substituiu o merge delas sem pular
  condição.

## O que fica para o dono

- Publicar a release, instalar na instância de teste, percorrer a lista de verificação visual
  (comentário da fase 8 na guarda-chuva) e homologar.
- Conferir o `urbi-toggle` de verdade e a queda para a caixa de seleção, que só a instância mostra.
- Levar à plataforma os pedidos da seção anterior.
- Atualizar o item 0.4 do Estado da Arte, que ainda lista a comparação de estruturas (divergente
  desde a D14), e o princípio das exceções de exibição, que fala em três (são quatro).
- O texto do `422 FINANCIAMENTO_FIXO`, que ainda manda desligar pela caixa "Ativo".
- A chave `viab:funding-alternativas:<id>` que sobra no `localStorage` de quem usou a comparação e
  que ninguém mais lê.
- Sincronização do `schema.json` e migrações no Postgres não se aplicam: não houve mudança de
  schema.
