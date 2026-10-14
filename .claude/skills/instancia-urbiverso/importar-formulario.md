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

- **O app é o `viabilidade`, e ele tem de estar instalado.** Confira em `GET /api/shell/apps` e leia o
  índice dos docs dele (`GET /api/shell/docs/apps/viabilidade`, § 3). Sem o app na instância, pare com
  uma linha e diga isso: o importador conhece as rotas e o schema dele e de nenhum outro.
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
     gravou e roda o motor; **se a API recusar alguma escrita depois de o estudo existir, ele apaga o
     estudo que acabou de criar** (um `DELETE` do estudo dele e de mais nada);
   - **como desfazer:** apagar o estudo pela tela do app; o estudo fica visível a quem tem acesso ao
     app enquanto existir.
3. **Escreva.** Com o sim, o mesmo comando com `--executar --relatorio <arquivo.json>`. Vários
   formulários na mesma pessoa e no mesmo pedido saem com **um sim só**, desde que a lista de
   formulários esteja escrita, item por item, antes.
4. **Leia a saída pelo código, não pela última linha.**

   | Saída | Significa | O que fazer |
   |---|---|---|
   | `0` | sem divergência, sem falha HTTP, sem problema novo no motor | relate o estudo e os números |
   | `1` | erro de preenchimento, ou a API recusou uma escrita | relate o motivo. Confirme na saída que o estudo foi **removido** (`estudo <id> removido`): se a saída diz `ATENÇÃO: não consegui remover o estudo`, ou o `POST` do estudo falhou sem confirmação, **o estudo pode ter ficado**: o id está só na saída do terminal (o arquivo de `--relatorio` não é gravado nesse caminho), e você o entrega à pessoa para apagar |
   | `2` | o estudo existe, mas há pendência (releitura, pagamento, motor) | relate cada pendência; o estudo **ficou**, com o id |

   `--manter-em-falha` mantém o estudo parcial para diagnóstico: uma exceção de escrita sai com `1` e o
   estudo fica, com o id só na saída do terminal; uma falha HTTP ou de pagamento segue e sai com `2`, e
   aí o id também vai no arquivo de `--relatorio`. Só use se a pessoa pedir, e então o estudo entra no
   relatório de vocês com o id.
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
  pessoa, e o relatório entrega o id (da saída do terminal, quando o caminho foi o de saída `1`).
- **Não trate verde como prova de que o formulário descreve o projeto.** O importador prova que o
  estudo gravado bate com a planilha e que o motor o calcula; planilha errada para o projeto dá estudo
  errado com a mesma limpeza.
- **Não afirme cobertura que não houve.** Cada caminho do formulário foi exercitado só nos projetos
  de exemplo de `referencia/formularios/exemplos/`; formulário com campo fora deles pode
  achar um caso que o importador ainda não conhece. Quando acontecer, diga.
