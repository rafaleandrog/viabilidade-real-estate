# Preparar o acesso do Claude à instância

**Este arquivo é instrução para o agente, não prosa para a pessoa.** A skill `urbiverso` o lê
quando a § 2 do `SKILL.md` encontra o ambiente sem configuração e a pessoa diz que quer
configurar agora. Você conduz; ela executa nas telas. Falas sugeridas vão em bloco de citação; o
resto é instrução sua. Links e nomes de tela são explícitos — nunca "vá nas configurações".

Tom: claro e direto ao ponto. Explique cada termo em uma linha na primeira vez que aparecer e
**ofereça** aprofundamento em vez de despejá-lo. Antes de começar, diga o que vai existir no fim:

> Vamos criar três coisas: um **usuário de serviço** na sua instância, que é a identidade com
> que eu vou agir; um **token** dele; e as duas variáveis no ambiente desta sessão. Leva uns dez
> minutos, e é uma vez por pessoa. Depois disso eu consigo ler e, com a sua autorização a cada
> passo, mexer na instância daqui.

Pergunte duas coisas logo no começo e guarde:

- **a URL da instância** (`https://…`) — ela entra em dois lugares;
- **o nome da pessoa** como aparece na instância — ele entra no nome do usuário.

Pergunte também se ela é a dona da instância. Se não for, ela só consegue conceder as alçadas
que ela mesma tem: quem não tem uma alçada não a concede a ninguém.

## 1. O usuário de serviço "Claude - sob <nome>"

Por que um usuário próprio, e por que não o dela — diga antes de pedir o clique, porque é a
decisão que muda tudo o que vem depois:

> Eu não uso o **seu** usuário. Tudo o que um agente faz na instância entra na trilha de
> auditoria no nome de quem é o token, e ela é permanente: com o seu token, o que eu fizesse
> ficaria registrado como se fosse você, para sempre, sem como separar depois. Uma identidade
> própria resolve isso e ainda é mais estreita: um usuário de **serviço** não tem e-mail nem
> senha, então a única porta dele é o token que você vai criar. Desativou o token, eu parei.
>
> O nome dele carrega o seu **porque é um agente seu**: se amanhã outra pessoa da equipe usar o
> Claude aqui, ela cria o dela, e as duas trilhas não se misturam.

Passos, na tela:

> Abra **`<URL>/admin/acesso/usuarios`** e clique em **Novo usuário**. Escolha **Serviço**.
>
> - **Nome:** exatamente **`Claude - sob <seu nome>`** — eu confiro a palavra "Claude" no nome
>   antes de agir, e é assim que eu sei que não estou usando a identidade de uma pessoa.
> - **Tipo de usuário:** **Colaborador**. É o degrau que me impede de criar ou alterar alguém
>   mais poderoso que eu, mesmo com a alçada de Usuários.
>
> Salve.

**Um usuário por pessoa, nunca compartilhado.** Se duas pessoas usassem o mesmo, a trilha
deixaria de dizer quem estava dirigindo. Se a pessoa sair da equipe, o certo é **inativar** esse
usuário — não renomeá-lo para outra pessoa.

## 2. As alçadas

Alçada é a permissão de administração da instância, uma por área. Ela decide o que eu **consigo**
fazer; o que eu **vou** fazer você autoriza uma a uma, na conversa, antes de cada mudança.

> Ainda no usuário que você criou, abra a aba **Alçadas** e marque o que quiser que eu alcance.
> Regra prática: **as mesmas que você tem**. Eu não consigo nada que você não conseguiria, e as
> que faltarem viram um "não alcanço isso" na hora em que fizerem falta — você concede aqui e
> gera outro token.

As onze, uma linha cada — diga só as que a pessoa perguntar, ou todas de uma vez se ela pedir:

- **Usuários** — criar pessoas e agentes, tipo, alçadas e tokens, dentro do que eu mesmo tenho.
- **Contas** — contas de clientes da instância, membros e as políticas delas.
- **Apps** — instalar, atualizar, ligar, desligar e desinstalar app. É a que o seu app precisa.
- **Integrações** — Wiki, IA e quais apps podem usá-los; domínios de e-mail e templates.
- **Marcas** — nome, cores, logos e o visual da instância.
- **Núcleo** — quais apps alcançam pessoas, empresas e tarefas compartilhadas.
- **Operação** — zeladoria do que já está instalado: faxina, arquivos, fuso, limites de taxa.
- **Suporte** — o Sentinela: casos, ordens de serviço e saúde das apps.
- **Auditoria** — ler a trilha. É a única que só lê.
- **Sistema** — operar a plataforma nesta instância: saúde, changelog, autodeploy, e as duas
  escritas que param tudo: **reiniciar** e **instalar outra versão da plataforma**.
- **Segurança** — as credenciais da instância: URL pública, modo seguro, login e e-mail de
  sistema, senha de terceiro.

Duas merecem um segundo de pensamento antes de marcar, e diga isso:

> **Sistema** inclui reiniciar a instância e instalar outra versão da plataforma — as duas
> derrubam a sessão de quem estiver usando. Eu só faço as duas pedindo na hora e dizendo a
> consequência, e a versão nova costuma chegar sozinha; se você não quer nem a possibilidade,
> deixe desmarcada. **Segurança** mexe nas credenciais da instância (endereço público, login,
> e-mail de sistema): se você não pretende me pedir isso, deixe de fora e marque quando precisar.
>
> Uma coisa não está nesta tela: **homologar uma versão da plataforma** é da alçada Plataforma,
> que é de quem mantém o urbiverso e não existe na sua instância. Homologar **release de um app
> seu** é outra coisa, e essa é da alçada Apps — trabalho normal, que eu faço com a sua
> autorização.

Se um toggle aparecer travado com a razão escrita, é alçada que a pessoa não detém: não há o que
fazer nesta tela, quem concede é quem tem.

**Revogar depois** é a mesma aba: desmarque e salve. Vale na hora — o token não sobrevive à
revogação da alçada, porque o que ele carrega é sempre a interseção com o que o usuário tem hoje.

## 3. O token

> Abra **`<URL>/admin/acesso/tokens`** e clique em **Gerar novo token**.
>
> - **Usuário:** `Claude - sob <seu nome>` (aparece com o sufixo "(serviço)").
> - **Nome:** algo que diga de onde é usado — `claude-code`, por exemplo.
> - **Alçadas:** marque **todas** as que o usuário tem. O escopo é fixado na emissão e não
>   acompanha concessão futura: se você conceder uma alçada nova depois, precisa gerar outro
>   token.
> - **Expiração:** **90 dias**. Token sem expiração é chave que nunca gira; eu aviso no cabeçalho
>   quando faltar menos de uma semana, e renovar é um clique nesta mesma tela, sem trocar o
>   segredo.
> - **Somente leitura:** desmarcado, se você quer que eu consiga mudar coisas. Marcado é uma
>   opção honesta para começar — eu leio tudo e não escrevo nada — e trocar depois é gerar outro
>   token, porque esse modo não se altera.
>
> Gere e **copie o token agora**: ele começa com `urbi_` e aparece uma única vez. Guarde até o
> passo 4; depois pode apagar, ele vai morar só no ambiente.

## 4. As duas variáveis no ambiente

É o **mesmo ambiente** que você já usa neste repositório — o que tem o token do GitHub para
baixar o SDK. Aqui não é como o QA, que pede ambiente separado: quem desenvolve precisa das duas
credenciais na mesma sessão, uma para construir o app e outra para instalá-lo.

> No **https://claude.ai/code**, abra o seletor de ambiente acima da caixa de mensagem, passe o
> mouse sobre o ambiente que você usa neste repositório e clique no ícone de configurações.
>
> Em **Network access**, escolha **Custom**, adicione o domínio da sua instância (só o host, sem
> `https://`) em **Allowed domains** e marque **Also include default list of common package
> managers**. Sem isso eu não alcanço a instância: o proxy do ambiente recusa a conexão antes de
> ela sair, e o erro não se parece nem um pouco com a causa.
>
> Em **Environment variables**, adicione:
>
> ```
> URBIVERSO_URL=https://<domínio da instância>
> URBIVERSO_TOKEN=urbi_…
> ```
>
> Se quiser um nome curto no meu cabeçalho em vez do domínio, adicione também
> `URBIVERSO_HOST=<nome>`. É opcional.
>
> Salve.

**O token fica legível para quem usa o ambiente.** Diga isso: ambiente de nuvem não tem cofre de
segredos. É mais uma razão para a identidade ser um usuário de serviço estreito, e não a dela.

## 5. Conferir

Variável de ambiente só entra na largada da sessão, então a conferência é numa sessão nova:

> Abra uma sessão **nova** neste repositório e mande: `confira o meu acesso à instância`. Eu vou
> alcançar a instância, dizer quem eu sou lá, quais alçadas eu tenho e quando o token expira —
> sem mudar nada. Se algum passo tiver ficado pela metade, eu digo qual destes cinco refazer.

O que se confere nessa sessão é a § 2 do `SKILL.md`: URL alcançável pela rede do ambiente, token
que autentica, identidade que não é sysadmin nem operador e tem "Claude" no nome, e o cabeçalho
com alçadas, escopo e expiração.

## 6. Depois — o que a pessoa precisa saber para operar

Diga isto no fim, em poucas linhas:

- **Pausar** é desativar o token em `<URL>/admin/acesso/tokens`. Reativar é um clique.
- **Conceder alçada nova** exige **gerar outro token** e trocá-lo no ambiente — o escopo é
  fixado na emissão. **Revogar** vale na hora, sem trocar nada.
- **Renovar** antes dos 90 dias é o lápis de "Expira em", na mesma tela, sem trocar o segredo.
- **Eu peço autorização antes de cada mudança** e digo como desfazer. Leitura eu faço direto.
- **A trilha de auditoria guarda tudo** em `<URL>/admin/auditoria`, no nome dessa identidade, com
  o nome congelado no instante de cada ato — renomear o usuário depois não reescreve o passado.
- **Cada pessoa da equipe cria a sua.** O usuário não se compartilha.
- **Se você sair, ou parar de usar:** inative o usuário. Não o renomeie para outra pessoa.
