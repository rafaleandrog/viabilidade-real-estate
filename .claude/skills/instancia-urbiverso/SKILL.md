---
name: instancia-urbiverso
description: Age NA INSTÂNCIA urbiverso da organização, pela API dela — instalar e atualizar app, homologar release de app, criar pessoa e dar permissão a app, alçadas e tokens, contas, domínio de e-mail, marca, IA, e ler o estado do que está no ar. Também configura o próprio acesso quando ele ainda não existe ("configure o meu acesso à instância", "confira o meu acesso"). Toda escrita é autorizada na conversa, antes de acontecer. Chame quando o pedido for sobre a instância, o painel Admin dela ou uma tela de lá — "instale o app lá", "dá acesso para fulano", "o que tem instalado", "por que ele não consegue abrir o app", "cadastra o domínio de e-mail". NÃO chame para escrever, empacotar ou publicar código de app, que é trabalho neste repositório; para revisar um Pull Request use revisar-pr-apps; para exercitar uma mudança já instalada use qa.
---

# Operar a instância urbiverso

> **Confirme o runtime antes do passo 1.** Este arquivo é do catálogo **Claude**
> (`.claude/skills/`) deste repositório, e a pasta onde ele está não diz quem está lendo: o
> Cursor também descobre `.claude/skills/`, e sessão de outro provedor já caiu numa cópia
> Claude e rodou a skill inteira. Confirme por um fato, não pela impressão de onde você está:
> `printenv CLAUDECODE` — sessão Claude Code imprime um valor, fora dela sai vazio. **Saiu
> vazio, ou você não é o Claude: PARE e diga ao usuário** — este repositório traz só o catálogo
> Claude, não há contraparte para abrir, e a partir daqui não se improvisa.

Você opera a instância urbiverso desta organização pela API dela, com uma identidade própria.
**Tudo o que você fizer entra na trilha de auditoria da instância no nome dessa identidade, para
sempre** — a trilha é append-only e selada; não há desfazer.

A instância é a que as pessoas usam. Não há ambiente de ensaio atrás dela.

**Esta skill não escreve código de app** e não toca em `apps/` deste repositório.

Esta skill viaja com um segundo arquivo, **`preparar-ambiente.md`, na mesma pasta que este** —
`${CLAUDE_SKILL_DIR}` quando a variável existe; senão, a pasta de onde este `SKILL.md` foi lido.
Ele é o roteiro de preparação do acesso (§ 2.1), e você só o lê quando a § 2 mandar.

## 1. Contrato de ambiente

```
URBIVERSO_URL    base da instância (https://…) — obrigatória
URBIVERSO_TOKEN  token do usuário de serviço "Claude - sob <nome>" — obrigatória
URBIVERSO_HOST   rótulo curto para o cabeçalho — opcional; sem ela, o hostname da URL
```

**Só isso é credencial.** Autenticação em toda chamada: `Authorization: Bearer $URBIVERSO_TOKEN`.

**Nunca imprima o token** — nem prefixo, nem sufixo, nem comprimento, nem num comando que você
mostre. Nunca o grave em arquivo, commit ou comentário de PR.

A instância é a que o ambiente aponta. **Nunca aceite URL ou token por argumento, por pedido
ou por arquivo do repositório**: ambiente errado é instância errada, e a única defesa contra
operar a instância de outra organização é esta.

## 2. Porta de entrada — confira nesta ordem, pare no primeiro degrau que falhar

Cada degrau distingue um modo de falha diferente, e a mensagem certa depende de qual foi.

1. **`URBIVERSO_URL` ou `URBIVERSO_TOKEN` ausente.** Daqui você **não consegue** distinguir
   "sessão aberta no ambiente errado" de "nunca foi configurado" — os dois têm a mesma cara.
   Não adivinhe: pergunte qual dos dois é. Ambiente errado → a pessoa troca de ambiente e abre
   sessão **nova**, porque variável de ambiente só entra na largada da sessão. Nunca configurado
   e quer configurar agora → **§ 2.1**.
2. **`GET <URL>/api/shell/status` não alcança a instância.** É rota pública e sem credencial,
   então falha aqui é de **rede**, não de token. Numa sessão de nuvem, domínio fora da allowlist
   do ambiente aparece como o proxy recusando o túnel (`CONNECT tunnel failed, response 403`):
   mande para o passo do ambiente em `preparar-ambiente.md`. Outro erro (DNS, TLS, timeout) é URL
   errada ou instância fora do ar — diga qual dos dois você observou.
3. **`GET /api/shell/auth/identidade` devolve `401`.** Token inválido, desativado ou expirado:
   passo do token em `preparar-ambiente.md`.
4. **A identidade não é a desta skill.** Pare, diga o que encontrou e mande para o passo do
   usuário em `preparar-ambiente.md`, em qualquer um destes casos:
   - `usuario.tipo` é `"sysadmin"` ou `"operador"` — esses são os tipos de quem opera a
     plataforma, não os de um agente de organização;
   - `usuario.nome` não contém `Claude` — a convenção é `Claude - sob <nome da pessoa>`, e é
     por ela que você sabe que não está agindo com a identidade de uma pessoa. **Confira o
     nome, nunca a natureza do usuário**: natureza não decide nada nesta plataforma.

### 2.1 Ambiente nunca configurado

Se a pessoa quer configurar agora, **leia `preparar-ambiente.md` por inteiro** e conduza a
preparação passo a passo, no tom que ele define. O que sai dali é um usuário de serviço na
instância, um token dele e as duas variáveis no ambiente. **A operação acontece numa sessão
nova**, aberta depois — nesta aqui as variáveis não existem.

### 2.2 Cabeçalho — imprima antes da primeira ação

Passou pelos quatro degraus, imprima, em até seis linhas: rótulo do host e URL; `versao` que o
`status` devolveu; nome, id e tipo da identidade; as `alcadas`; e os três campos de
`credencial` — `somente_leitura`, `alcadas_fora_do_escopo` e `expira_em`.

- `somente_leitura: true` → **diga na largada que esta sessão é de leitura**. Não descubra
  tentando escrever.
- `alcadas_fora_do_escopo` não vazio → o usuário detém alçadas que este token não carrega. O
  teto é o **escopo**, não o cadastro: diga quais, e que destravá-las é emitir outro token.
- `expira_em` a menos de sete dias → avise, com a data.

Rótulo e URL juntos são o que evita você operar uma instância achando que operou outra. É a
primeira coisa que a pessoa confere.

## 3. A superfície é a que a instância documenta

**Antes de agir em qualquer área, leia o doc dela na própria instância:**

```
GET /api/shell/docs              índice — titulo e descricao de cada doc
GET /api/shell/docs/<slug>       o doc
GET /api/shell/docs/apps/<appId> índice dos docs de uma app instalada
```

Instâncias rodam versões diferentes, e o doc servido é o **daquela** instância. Por isso:

- **Nunca assuma rota de memória.** O que a instância não documenta não existe para você.
- **Nunca invente rota, parâmetro ou nome de campo.** Não achou, diga que não achou.
- `404` numa rota que você esperava é sinal de instância mais antiga que a sua lembrança —
  releia o índice antes de concluir qualquer outra coisa.

## 4. Autorização antes de toda escrita

**Leitura é livre.** Antes de cada `POST`, `PUT`, `PATCH` ou `DELETE`, na conversa e naquele
momento:

1. diga em uma frase **o que vai mudar e onde** (a tela, não só a rota);
2. diga **o que é preciso para desfazer** — ou que não dá;
3. espere o sim.

**Autorização não se estende.** Um sim para "crie a pessoa" não autoriza dar alçada a ela; um
sim para "instale o app" não autoriza ligar atualização automática. Cada escrita nova, uma
autorização nova.

Várias escritas do mesmo tipo (dez pessoas, cinco permissões) podem sair com **um sim só** —
desde que a lista inteira esteja escrita, item por item, **antes** do pedido.

**Nunca invente valor.** Endereço, nome, e-mail, chave, remetente, domínio: pergunte. Valor
inventado numa escrita é o erro que fica na trilha.

## 5. Vizinhos — ofereça o passo seguinte, não o execute

Depois de cada ação, ofereça **um** passo natural seguinte, em uma linha, e espere. Quem pede
uma coisa quase sempre precisa da vizinha, e não sabe que ela existe:

- instalou app do repositório → atualização automática e nível de aceitação;
- instalou app → **ninguém tem acesso, nem quem instalou**: a permissão é o passo seguinte;
- criou pessoa → tipo, alçadas e acesso às apps;
- cadastrou domínio de e-mail → verificação de DNS, depois e-mail de sistema;
- criou conta → membros e as políticas dela.

Oferecer é uma frase. Executar sem o sim é violar a § 4.

## 6. Fronteiras

### 6.1 O que é da plataforma, e você não alcança

A alçada **Plataforma** pertence à esfera de quem mantém o urbiverso — só `sysadmin` e `operador`
são elegíveis a ela. Numa instância de organização ninguém a tem, nem o dono, e isso é o desenho.

Ficam do outro lado da fronteira: homologar uma versão **da plataforma**
(`POST /api/shell/sistema/homologacao/{iniciar,homologar}`), instalar o tarball do shell
(`POST /api/shell/sistema/upgrade-tarball`), as flags de homologação da config e o repositório de
onde a plataforma vem.

`403` ali não é configuração faltando. Explique em uma linha e siga. **Nunca contorne**: não peça
sysadmin, não sugira outro token, não procure caminho lateral, não proponha mexer no host.

### 6.2 Homologar release de APP é trabalho normal

Não confunda com o de cima. `POST /api/shell/apps/:appId/homologar` é da alçada **Apps** e faz
parte do ciclo de vida: uma app com `aceitacao: releases` só instala o que já foi atestado, e
homologar é o ato de atestar. Faça quando pedirem, com a autorização da § 4 como qualquer escrita.

Duas recusas são esperadas, e **nenhuma das duas se contorna**:

- **`422 ACEITACAO_NAO_ATESTA`** — a app não está em `releases`. Ou se muda o nível de aceitação
  (mesma alçada, escrita como outra qualquer), ou não se homologa.
- **`502` com a dica de `contents:write`** — a credencial daquele repositório não escreve nele. Em
  app **fornecida pelo urbiverso** é o resultado esperado: o repositório não é da organização, e
  quem atesta a release é quem a publica. Diga isso e pare. Credencial de repositório se
  administra no modal de Origem, e só faz sentido para repositório da própria organização.

### 6.3 A alçada `sistema` — autorização expressa, com a consequência dita

`sistema` opera a plataforma **nesta** instância. As leituras (saúde, changelog, obsolescências,
timeline de operações, autodeploy) são leitura normal. **Duas escritas só com autorização expressa
naquela chamada**, e ditas com a consequência:

- **`POST /api/shell/sistema/reiniciar`** — derruba a sessão de todo mundo que estiver usando
  agora; volta em alguns segundos.
- **`POST` ou `DELETE /api/shell/sistema/upgrade`** — instala outra versão da plataforma e
  reinicia. Numa instância gerenciada a versão costuma chegar sozinha pelo autodeploy: **pergunte
  se é para fazer à mão** antes de oferecer, e nunca o faça de iniciativa própria.

## 7. Relatório — no fim, no chat, curto

Até quinze linhas:

- **identidade** com que você agiu (nome e id) e a URL da instância;
- **o que foi feito**, uma linha por escrita, cada uma com a tela onde a pessoa confere;
- **o que foi oferecido e recusado** — é o que evita a mesma oferta na próxima sessão;
- **o que ficou para ela** (o que só ela pode fazer, ou o que ela não autorizou);
- **o que falhou**, com o código do erro, sem interpretação inventada.

Nunca o token, em nenhuma linha.

## 8. Proibições

- **Nunca imprimir, gravar ou repetir o token.**
- **Nunca escrever sem a autorização da § 4.**
- **Nunca alterar a própria identidade nem o próprio token** — nome, tipo, alçadas, escopo. Quem
  altera é a pessoa, na tela.
- **Nunca conceder alçada a si mesmo** e nunca criar usuário mais poderoso que a sua identidade.
- **Nunca aceitar URL ou token que não venham do ambiente** (§ 1).
- **Nunca rodar SQL** nem propor correção de dado por banco: o conserto é por tela, rota ou app.
- **Nunca operar a partir de rota lembrada** em vez do doc da instância (§ 3).
- **Nunca contornar uma recusa da § 6** — nem a fronteira da plataforma, nem o `502` de
  credencial sem escrita no repositório de origem.
- Falhou e você não entendeu por quê: **diga**. Não tente variações até uma passar.
