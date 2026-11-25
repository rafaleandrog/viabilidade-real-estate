# Criar e preencher estudos automaticamente a partir do Slack e da Cozinha — investigação (2026-11-24)

> **Estado: pausado pelo autor em 2026-11-25. Nenhuma mudança de código foi feita.** Esta nota guarda o que
> foi investigado, medido e decidido, e os caminhos possíveis, para a retomada. Não é plano aprovado, não é
> issue e não autoriza alterar comportamento do app. Segredos (tokens, endereços de webhook) ficaram de fora
> de propósito.

## 1. O que o autor quer

Reduzir a fricção de hoje: alguém preenche a planilha de `referencia/formularios/`, baixa, o autor a sobe numa
sessão e o importador cria o estudo. O desejo é fazer isso **automaticamente, ou o mais perto disso**, a partir
de conversas do Slack, e também editar estudos, por três gatilhos: agendado, evento e comando humano (no Slack,
na Cozinha ou no próprio app).

### Decisões e preferências do autor

- Mudar **só o repositório do viabilidade**. Nunca o monorepo `urbiverso/urbiverso`. Se algo pertence à
  plataforma, descreve-se o pedido para o autor levar.
- A conexão tem de ser **direto pelos apps**, e não pela conta do Claude nem por sessão minha.
- O formato da ficha é uma **tabela de campo → valor**, com nomes exatos, para ter 100% de certeza do destino
  de cada dado. Preferência: um conjunto de mensagens, cada uma agrupando linhas (campo e valor), **uma
  mensagem por aba ou seção do estudo**. Alternativa aceita: a ficha chegar como arquivo xlsx, csv ou pdf.
- **Tipo e nível do estudo** (Preliminar ou Avançado, Loteamento ou Incorporação) são informados antes; nunca
  adivinhados.
- **Estudos existentes ficam de fora** por ora; o escopo é criar.
- Canal (ou subcanal) = projeto; um projeto pode ter vários estudos; cada estudo referencia um canal.
- Links do Drive (projetos arquitetônicos e urbanísticos) e arquivos KML/KMZ guardados e vinculados ao app são
  **ideias futuras**, já em `ideias.md`, sem issue.

## 2. O que foi verificado

Verificado = lido na documentação servida pela instância ou no SDK, ou **testado** na homologação (pinguim).
O que não foi verificado está na seção 6.

### 2.1 Slack na plataforma (SDK 93.0.0 instalado)

| Capacidade | Como | Limite |
|---|---|---|
| Postar em canal ou thread | `req.slack.notificar({canal, texto, thread_ts})` | só dentro de código de app; `canal` é o ID cru |
| Ler uma thread | `req.slack.lerThread(canal, ts)` | precisa do `ts` da mensagem-mãe; canal privado só com `permitirPrivado`; DM nunca; teto de 1000 mensagens |
| Receber o Events API | webhook recorrente `wh` + `req.slack.receberEvento()` | valida assinatura e handshake; o app trata o evento; só chega o que acontece **depois** da conexão |
| Slack ID → usuário | `req.slack.resolverUsuario(slackId)` | só para quem já entrou pelo Slack |
| Nome do canal | `req.slack.resolverNomeCanal(id)` | só apresentação |

**Não existem** verbos para ler o histórico de um canal, listar canais, baixar arquivo do Slack nem ler Canvas.
O contrato proíbe chamar a API do Slack direto e guardar uma cópia do bot token. Botões e comandos de barra
(interatividade) estão anunciados na doc como "depois".

A aba **Slack** das configurações do app (toggle, token próprio, signing secret) é nativa do shell. Sem token
próprio, vale o global da instância.

### 2.2 Cozinha (app `urbiverso/app-cozinha`, v0.24.0 no pinguim)

O código dela não está acessível; a documentação é servida pela instância (`/api/shell/docs/apps/cozinha`).

- **Canais com um nível de filho**, no formato `pai.filho`. O endereço só aceita letras sem acento, números e
  hífen. Canal filho não tem filho.
- **API autenticada** (`/api/cozinha/...`): listar canais, ler mensagens do canal (com `texto`, `anexos`,
  `thread_id`, autor, origem e paginação) e postar mensagem. O texto volta guardado cru, com as quebras de
  linha.
- **Integração (webhook de entrada):** um endereço por integração, por canal, e **o endereço é uma senha**.
  Aceita `{texto, autor, usuario_id, thread_id, origem_chave}`; só `texto` é obrigatório. Idempotência por
  `origem_chave` (sem vírgula). Revogar corta na hora.
- **Disparador `postar_mensagem`** (outra app posta na Cozinha em nome de um usuário): campos `canal`,
  `mensagem`, `usuario`; só texto; precisa de autorização do admin da Cozinha.
- **Evento `app.cozinha.atividade`:** leva **só identificadores** (`canal_id`, `mensagem_id`, `thread_id`,
  `acao`), nunca o texto.
- **Anexos:** qualquer tipo de arquivo; download por endereço temporário (uma hora) para quem tem leitura.
- **Não tem integração com Slack.**

### 2.3 Testes feitos na homologação

| Teste | Resultado |
|---|---|
| Ler canais e mensagens da Cozinha por token | funciona |
| Postar mensagem por token | funciona; texto volta idêntico |
| Webhook de integração: postar, repetir a mesma `origem_chave`, postar em thread, `origem_chave` com vírgula, revogar | 201; `duplicada: true`; 201 em thread; 400 `ORIGEM_CHAVE_INVALIDA`; endereço revogado responde 404 |
| Mandar o formato nativo do Slack à integração (`url_verification` e `event_callback`) | **400, falta `texto`**: a Integração não serve de Request URL do Slack |
| Criar estudo Preliminar e Avançado no viabilidade por token | funciona; o autor vira editor |
| `preco_venda_m2` com `"10.000"` | **gravou 10,00** (a API lê ponto como decimal), com resposta 200 |
| `"0,10"` e `"10000,50"` em campo numérico | 400, recusado |
| Campo inexistente (`duracao_obras`) no PATCH do estudo | **200, ignorado em silêncio** |
| `duracao_obras` no Avançado | vai em `cronograma → obra → duracao_meses` (o cronograma recalcula os eventos seguintes) |
| Percentual | gravado como vier (`10` e `0.1` viram `10.00` e `0.10`); a API não distingue 10% de 0,1% |

Os estudos de teste foram removidos. Conclusão para qualquer caminho: **a API do app não protege contra pt-BR
ambíguo nem contra chave errada**. Quem chama precisa converter para número antes e conferir cada chave.

### 2.4 A planilha e o importador (já no repositório)

- `referencia/formularios/` tem 4 modelos e 4 exemplos. Cada linha tem **chave técnica** (`estudos.<coluna>`,
  `cronograma.<evento>.<campo>`, `<lista>[n].<campo>`, `<coluna>_modo = <modo> → <coluna>_valor`). São cerca de
  200 chaves no Preliminar e de 830 a 860 no Avançado.
- `scripts/formularios/importar_formulario.py` valida tudo antes de escrever, cria o estudo na ordem que o app
  exige, converte o pagamento para o formato canônico, relê o que gravou e roda o motor. A validação (sem
  `--executar`) não precisa de credencial e foi rodada com saída 0.
- **Já é fail-closed** onde importa: texto onde se espera número vira erro listado e nada é escrito; chave sem
  tratamento é listada como ignorada, nunca em silêncio; percentual é convertido pelo formato da célula.
- O ponto de troca de fonte é pequeno **dentro do script**: `ler()` devolve uma lista de entradas e `montar()`
  faz o resto. Mas o script roda fora do app, e levar isso para dentro do app é trabalho grande (seção 4).
- **O importador só cria estudos.** Não atualiza.
- **As chaves moram em dois lugares:** `gerar_formularios.py` (que gera as planilhas) e o próprio importador.
  Uma terceira cópia em TypeScript repetiria o problema dos "vários validadores" do CLAUDE.md.

### 2.5 O app `dd` (Deliberações Diretoria), exemplo de Slack direto no app

Instalado **só na laputa** (v1.3.12). O código (`urbiverso/apps-gestao`) não está acessível; li a documentação.

Fluxo: `@dd` numa thread → o Slack manda `app_mention` para o webhook do app → a plataforma valida a assinatura
→ o handler responde em menos de 3 segundos → em segundo plano resolve o autor, confere o nível de acesso, lê a
thread, a IA redige título, descrição e minuta, o app abre a solicitação como **rascunho** e responde na thread
com o link. Ao decidir, posta o desfecho na thread de origem (guardou `slack_canal` e `slack_thread_ts`).

Boas práticas a copiar: deduplicar por `event_id` numa coluna única; a IA só propõe e a pessoa revisa;
o autor precisa de conta ativa e `escrita` no app; token próprio e signing secret na aba Slack; parâmetros
`permite_thread_canal_privado` (padrão desligado), `slack_thread_max_mensagens` e `ia_minuta_ativa`; bot
convidado em cada canal.

**O `dd` não usa a Cozinha.** O debate e os arquivos ficam na thread do Slack. Ele lê **uma thread por vez,
quando chamado**, e a IA extrai 3 campos, não centenas.

## 3. Caminhos possíveis

| Caminho | Resumo | Exige | Limite |
|---|---|---|---|
| **A. Padrão do `dd`** | `@viabilidade` numa thread; o app lê a thread, a IA preenche só as chaves do catálogo, grava **rascunho** com a procedência e responde na thread com o link | webhook `wh` + `receberEvento`, tabela de ingestão, catálogo, parser, validador, serviço de estudo com autor explícito, Slack App próprio | uma thread por vez; sem histórico, arquivos nem Canvas |
| **B. A + espelho na Cozinha** | o mesmo, e a ficha extraída é postada na Cozinha como saída (Remessa → `postar_mensagem`) para revisão e histórico | A + destino Acionador autorizado pelo admin da Cozinha | só texto |
| **C. Cozinha como hub** | um agente externo lê o Slack inteiro e posta a ficha numa Integração da Cozinha; o viabilidade lê a Cozinha | token de usuário de serviço como parâmetro `secret`; leitor da Cozinha; gatilho por Disparador (SDK 95 e shell 0.56.26), rotina ou botão | depende de um agente fora da plataforma; evento da Cozinha só traz ids |
| **D. Ficha em arquivo** | o xlsx preenchido anexado na Cozinha ou no Slack e lido pelo app | biblioteca de xlsx no backend (decisão de dependência); csv é trivial | PDF só pela IA, que é probabilística |
| **E. Ponte Slack → Cozinha sem agente** | Workflow do Slack ou Zapier/Make/n8n posta no endereço da Integração | Slack Workflow Builder com "enviar solicitação web", ou ferramenta de terceiros | **não verificado**; terceiro no meio |

**Recomendação provisória:** começar por **A**, que é o padrão já provado em produção na laputa e não depende
da Cozinha. A Cozinha só é indispensável para o que a plataforma não lê do Slack (histórico, arquivos, Canvas),
e isso exige um agente externo. Fica como etapa posterior (B ou C). Decisão final é do autor.

## 4. Requisitos comuns a qualquer caminho

1. **Catálogo único das chaves técnicas** (um JSON usado por gerador, importador e app), com **teste de
   paridade**: toda chave dos 4 modelos precisa ser tratada, e a lista de ignoradas fica vazia nos exemplos.
2. **Parser estrito de pt-BR**, fail-closed: `10.000` é dez mil; `0,10` sem `%` num campo percentual é erro;
   percentual **exige** `%`; unidade declarada por chave; chave desconhecida é erro listado, nunca sucesso.
3. **Validador** com as regras do importador (somas de percentual, referências entre listas e outras), usando os
   4 exemplos como casos de teste (o importador Python serve de oráculo).
4. **Serviço de estudo com autor explícito.** As rotas atuais usam `req.contexto.usuario`; um gatilho sem usuário
   exige extrair a lógica de criar e preencher.
5. **Gravar como rascunho, com procedência** (canal, thread ou mensagem de origem, versão), e deduplicar.
6. **Tabelas novas** (migração, `schema.json` e bump da `versao`): vínculo projeto ↔ canal e registro de ingestão.
7. **Pisos de versão:** o Disparador exige `sdk_min` 95 e `shell_min` 0.56.26; o pin do repositório é o SDK 93.
   Subir o pin é decisão do autor (como foi na #906).
8. **Guia em `docs/`** no mesmo PR e testes de fiação, como o processo do repositório exige.
9. **Mapeamento Slack ↔ Cozinha por ID, numa tabela**, nunca por nome: o Slack aceita acento e três níveis
   (`lot-calliandra-lote-misto-negociação`); a Cozinha não aceita acento e só tem um nível de filho.

## 5. Ambiente e acessos (sem segredos)

- O ambiente tem duas instâncias: **pinguim** (homologação) e **laputa** (produção). As variáveis `URBI_BASE` e
  `URBI_TOKEN` apontam para o pinguim, com o token **pessoal** do autor (não uma identidade "Claude - sob …"; a
  skill `instancia-urbiverso` manda parar nesse caso e só foi contornada por autorização expressa). Para
  automação definitiva, criar usuários de serviço.
- O monorepo `urbiverso/urbiverso` só foi lido (clonado fora do caminho protegido). O repositório
  `urbiverso/apps-gestao` está sem acesso para a sessão.
- O conector **Slack** do claude.ai está com a conexão incompleta; o autor **não quer** esse caminho.
- Não foi possível testar nada do lado do Slack.

## 6. O que não foi verificado

- Se o `fetch` do backend do app alcança a API da própria instância e a Cozinha com token em parâmetro `secret`.
- Se o evento `app.cozinha.atividade` pode ser origem de um destino Acionador (a doc diz que qualquer evento
  registrado serve; não foi criado nenhum destino).
- Se existe parâmetro para ler mensagens da Cozinha de forma incremental (a resposta traz `tem_mais_novas`).
- Baixar anexo da Cozinha por API; ler xlsx no backend (biblioteca).
- O Workflow Builder do Slack (gatilho de mensagem e passo "enviar solicitação web") e o plano do Slack.
- O que um agente externo específico consegue ler do Slack (histórico, arquivos, Canvas).
- A rota para remover mensagem da Cozinha (não documentada; não foi adivinhada).

## 7. Resíduos na homologação (conferir)

- Canal `#zzz` da Cozinha: mensagens de teste 683 a 686 (algumas via integração, já revogada).
- Canal `#viabilidade` da Cozinha: a integração "Leitor do Slack" foi criada pelo autor. O endereço dela
  apareceu em imagem e em texto durante a conversa; **recomenda-se gerar um endereço novo** antes de qualquer
  uso real.
- Estudos de teste criados por token foram removidos.

## 8. Como retomar

1. Decidir o caminho (a sugestão é A) e se a Cozinha entra agora ou depois.
2. Dar acesso à sessão ao `urbiverso/apps-gestao`, se quiser que o código do `dd` seja lido, e não só a doc.
3. Spike sem código de produto: criar um Slack App de teste, configurar token e signing secret na aba Slack do
   viabilidade no pinguim, gerar a Request URL e ver o handshake funcionar com um handler mínimo.
4. Em paralelo e sem depender do Slack: o catálogo único de chaves, o parser pt-BR e o teste de paridade com os
   4 exemplos. É a base de qualquer caminho.
5. Só então a camada de ingestão (rascunho com procedência) e os gatilhos.
