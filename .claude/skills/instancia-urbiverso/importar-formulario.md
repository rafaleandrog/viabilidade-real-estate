# Criar estudo do app `viabilidade` a partir de formulário preenchido

**Este arquivo é instrução para o agente, não prosa para a pessoa.** A skill `instancia-urbiverso` o
lê quando o pedido é criar um estudo do app `viabilidade` a partir de um formulário simplificado
preenchido — "crie o estudo a partir desta planilha", "suba este formulário", "monte os estudos
dos formulários". O que ele entrega é um estudo gravado na instância, conferido contra a planilha e
contra o motor do repositório.

**Ele não substitui o resto da skill.** A porta de entrada e o cabeçalho (§ 2), a superfície que a
instância documenta (§ 3), a autorização antes de toda escrita (§ 4), as fronteiras (§ 6) e o relatório
(§ 7) valem aqui como em qualquer pedido. O que este arquivo dá é a ordem, a leitura da saída e o que
registrar.

## Antes de começar: o alvo e a ferramenta

- **O app é o `viabilidade`, e ele tem de estar instalado.** Procure-o na listagem de apps que o doc
  da instância documenta e leia o índice dos docs dele (`GET /api/shell/docs/apps/viabilidade`,
  § 3); não assuma a rota da listagem de memória. Sem o app na instância, pare com uma linha e diga
  isso: o importador conhece as rotas e o schema dele e de nenhum outro.
- **O app instalado tem de ser compatível com o importador.** O importador monta chamadas a
  `/api/viabilidade` com rotas e payloads fixos do repositório, e instâncias rodam versões diferentes
  (§ 3). Antes de escrever, faça duas conferências:
  1. **a versão:** a versão do `viabilidade` que a instância informa tem de ser a `versao` do
     `manifesto.json` deste checkout (e o mesmo build, quando ela o informar);
  2. **as rotas:** o índice dos docs do app tem de listar as rotas de estudos, fases, cronograma,
     custos e funding que o importador usa.

  **Divergência em qualquer uma: pare**, diga qual e não escreva. **Não conseguir conferir** (a
  instância não informa a versão, ou o índice não traz as rotas) também **não é um sim**: diga o que
  faltou e pergunte à pessoa se quer seguir assim; se quiser, a autorização do passo 2 ganha a frase
  "compatibilidade não confirmada". App mais antigo ou mais novo que o checkout é o caso em que a
  escrita é recusada no meio, e o importador então tenta apagar o estudo que acabou de criar.
- **O formulário é um dos modelos de `referencia/formularios/`, preenchido.** Planilha sem a aba
  `Formulário` ou sem a coluna de chaves técnicas, o importador recusa: não a adapte por conta própria.
- **A ferramenta é `scripts/formularios/importar_formulario.py`.** Uso, saídas e limites estão em
  `scripts/formularios/LEIA-ME.md`, que você lê antes da primeira chamada. Precisa de `python3` com
  `openpyxl` e de `pnpm install` feito no repositório, porque os passos de pagamento e de conferência
  rodam o motor do app. Faltou algo, diga o que e pare; não instale por conta própria o que muda o
  ambiente da pessoa.
- **A credencial é a sua, da § 1, e o importador a lê com outros nomes.** Ele pede
  `URBIVERSO_QA_URL` e `URBIVERSO_QA_TOKEN_PCPAL`. Entregue-lhe os valores **só no ambiente do
  processo filho**, nunca em argumento nem em arquivo:

  ```bash
  URBIVERSO_QA_URL="$URBIVERSO_URL" URBIVERSO_QA_TOKEN_PCPAL="$URBIVERSO_TOKEN" \
    python3 -I scripts/formularios/importar_formulario.py <arquivo> …
  ```

  Com `--executar` o importador só aceita URL `https://`, não segue redirect e redige o token do log
  de falhas HTTP; a saída dos passos de pagamento e de conferência não passa por essa redação.
  Mostre à pessoa o comando **sem** o prefixo das variáveis, só
  `python3 -I scripts/formularios/importar_formulario.py <arquivo> …`, e **nunca imprima o valor
  expandido** (§ 1). Rode-o **você mesmo, no orquestrador**, e não
  o delegue: a credencial não viaja no briefing de outro agente.
- **O token precisa poder escrever no app.** Se o cabeçalho (§ 2.2) disse `somente_leitura: true`, ou
  a identidade não tem acesso de escrita ao `viabilidade`, diga isso e pare: não conceda alçada a si
  mesmo (§ 8) nem peça que o importador "tente assim mesmo".

## Os passos, nesta ordem

1. **Valide sem escrever.** O mesmo comando, sem `--executar`, lista **todos** os problemas de
   preenchimento, os avisos e as chaves ignoradas, e mostra o plano. Não toca a instância e não lê
   URL nem token, então **não precisa de autorização nem de credencial**; só o `--relatorio` grava um
   arquivo local, mesmo nesta fase. **Erro de preenchimento: pare.** Devolva a lista à pessoa, com a chave técnica de cada
   célula; corrigir a planilha é dela.
2. **Peça a autorização, com a lista inteira (§ 4).** O nome do estudo vem do formulário: **nunca o
   invente**, e se faltar pergunte. Diga em uma frase, e então espere o sim:
   - **o que muda e onde:** um estudo `<nome>` (nível e tipo) no app `viabilidade` de `<host>`, com
     seus parâmetros, cronograma, produtos, custos, grupos de venda, pagamento e funding, na tela
     Estudos do app;
   - **o que o importador faz sozinho:** converte o pagamento para o formato canônico, relê o que
     gravou e roda o motor; **se a API recusar alguma escrita, ou a conversão do pagamento falhar,
     depois de o estudo existir, ele tenta apagar o estudo que acabou de criar** (um `DELETE` do
     estudo dele e de mais nada). Com `--manter-em-falha` ele **não** apaga: o estudo parcial fica de
     propósito (só use esse modo se a pessoa pedir, e diga qual dos dois comportamentos vale). A
     limpeza é uma tentativa: se o `DELETE` também falhar, **um estudo parcial pode ficar**, e o importador avisa com o id (`ATENÇÃO: não consegui remover o estudo <id>`);
   - **como desfazer:** apagar o estudo pela tela do app; o estudo fica visível a quem tem acesso ao
     app enquanto existir.
3. **Escreva.** Com o sim, o mesmo comando com `--executar --relatorio <arquivo.json>`. O id do estudo
   sai **assim que ele é criado** (`estudo criado: id <N>`), antes de qualquer outra escrita, e vai
   também para o arquivo de `--relatorio`: anote-o já. Vários formulários na mesma pessoa e no mesmo
   pedido saem com **um sim só**, desde que a lista de formulários esteja escrita, item por item,
   antes. Só há uma janela em que o id pode não existir (a rede cair durante o `POST` que cria o
   estudo, ou o `POST` voltar sem id), e para ela vale uma rede de segurança barata: **antes de cada
   execução**, leia a lista de estudos do app (a rota é a que o índice dos docs do app documenta,
   § 3) e guarde os ids; refaça-a a cada formulário, para o estudo de um formulário já concluído não
   entrar na diferença do seguinte.
4. **Leia a saída pelo código, não pela última linha.**

   | Saída | Significa | O que fazer |
   |---|---|---|
   | `0` | sem divergência, sem falha HTTP, sem problema novo no motor | relate o estudo e os números |
   | `1`, ou **qualquer traceback ou erro de rede** | erro de preenchimento (nada foi escrito), ou a API recusou uma escrita, ou a execução caiu no meio | relate o motivo. Se a saída trouxer `estudo criado: id <N>`, o id é esse: só trate como limpo se ela disser também `estudo <N> removido`; com `ATENÇÃO: não consegui remover o estudo <N>`, o estudo **ficou** e você entrega o id à pessoa para apagar. Se **não** trouxe `estudo criado` e o `POST` pode ter chegado ao servidor (queda de rede, `POST` sem resposta ou sem id), **considere que um estudo parcial pode ter ficado sem id**: releia a lista de estudos e compare com a que você guardou antes de rodar; o estudo novo é o que **não estava nela**. Diferença que não seja de **exatamente um** estudo é ambígua: não escolha um id, diga isso e entregue os candidatos. Mesmo com um só, **confira-o** contra o esperado (nome, nível, tipo, autor, hora de criação, o que a rota devolver) e, sem confirmar, diga "não confirmado" |
   | `2` | o estudo existe, mas há pendência (releitura, pagamento, motor) | relate cada pendência; o estudo **ficou**, com o id |

   `--manter-em-falha` mantém o estudo parcial para diagnóstico: uma exceção de escrita sai com `1` e
   o estudo fica, com o id na mensagem de saída (`estudo <N> mantido`) e no arquivo de `--relatorio`;
   uma falha HTTP ou de pagamento segue e sai com `2`. Só use se a pessoa pedir, e então o estudo entra
   no relatório de vocês com o id.
5. **Separe defeito de achado conhecido.** A saída marca `conhecido:` quando o motor acusa algo já
   registrado em issue do repositório, com o número: isso vai como "conhecido (#N)", **não** como
   achado novo. `PROBLEMA :` (com espaço antes dos dois-pontos) é o que merece investigação, e a investigação não é desta skill: diga o que
   viu e **recomende** a issue, sem abri-la.

## O que entra no relatório (§ 7)

Além da identidade e da URL de sempre, uma linha por formulário: id do estudo, nome, nível e tipo, o
que o motor deu, as divergências da releitura (zero é dito), as pendências, e os avisos de chave **não
enviada**. Região de mercado, apelo comercial, imagem principal e vínculo com o Núcleo não vão pelo
importador: **o que ficou para a pessoa** é enviá-los pela tela. Cada linha leva a tela onde ela
confere o estudo.

## Oferta do passo seguinte (§ 5)

Estudo criado: ofereça, em uma linha, conferir os números dele na tela do app ou rodar o próximo
formulário. Não rode sem o sim.

## O que não fazer

- **Não edite a planilha da pessoa** para o importador passar, nem mude a legenda ou as chaves dela.
- **Não chame `aplicar-pagamento-canonico.ts` nem `conferir-estudo.ts` à mão**, e nunca com
  `--forcar` ou em estudo que o pedido não criou: o importador já os chama no momento certo, no estudo
  certo.
- **Não apague estudo por conta própria** além do que o importador remove sozinho: apagar é decisão da
  pessoa, e o relatório entrega o id (o do terminal ou do arquivo de `--relatorio`; só na janela sem id, o da diferença entre as listas, do passo 3).
- **Não trate verde como prova de que o formulário descreve o projeto.** O importador prova que o
  estudo gravado bate com a planilha e que o motor o calcula; planilha errada para o projeto dá estudo
  errado com a mesma limpeza.
- **Não afirme cobertura que não houve.** Cada caminho do formulário foi exercitado só nos projetos
  de exemplo de `referencia/formularios/exemplos/`; formulário com campo fora deles pode
  achar um caso que o importador ainda não conhece. Quando acontecer, diga.
