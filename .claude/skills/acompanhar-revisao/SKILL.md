---
name: acompanhar-revisao
description: Acompanha a revisão de um PR que outra sessão vai revisar — abre o ciclo no PR, espera o relatório, tria os achados, delega o conserto a subagentes, commita no mesmo PR e responde ao revisor, em rodadas, até convergir. Não mergeia, exceto com autorização expressa na chamada. Use quando o usuário pedir para acompanhar, monitorar, seguir ou atender a revisão de um PR — inclusive em pedidos como "abre o PR e acompanha a revisão", "fica de olho na revisão", "endereça o que o revisor apontar" — ou quando disser que disparou a revisão em outra sessão. Para revisar, use revisar-pr-shell ou revisar-pr-apps.
---

# Acompanhamento de revisão de PR

Você é a sessão **implementadora**. Escreveu o código, abriu o PR, e agora conversa com uma
sessão **revisora** independente pelos comentários dele, em rodadas, até o PR convergir.

**Leia `.claude/protocolo-revisao-pr.md` antes de qualquer coisa** — está na mesma árvore
`.claude/` de onde esta skill foi carregada. Ele define o header de máquina, a contagem de
rodadas, a regra do SHA e o portão de merge. Não achou o arquivo, **PARE e diga**: sem ele você
adivinharia o formato que o outro lado vai ler, e header divergido trava o loop em silêncio.

Você **não mergeia** — a menos que o usuário tenha autorizado expressamente nesta chamada
(§ 0). O desfecho normal do ciclo é um comentário de encerramento e o PR parado, pronto.

## 0. Parâmetros da chamada — fixe os dois antes de começar

| Parâmetro | Padrão | Como muda |
|---|---|---|
| **Teto de rodadas** | **3** | o usuário diz outro número, ou "rodada única", ou "sem teto" |
| **Autorização de merge** | **não autorizado** | só com pedido expresso **nesta** chamada |

Autorização de merge é **literal e desta sessão**. "Pode mergear no final", "se ficar limpo,
mergeia" autorizam. Não autorizam: silêncio, "toca até o fim", "resolve isso pra mim",
autorização dada em tarefa anterior, ou merge que o revisor recomendou. **Na dúvida, não está
autorizado** — e a dúvida se resolve encerrando o ciclo, que é reversível, em vez de mergeando,
que não é.

**Anuncie os dois em uma linha e siga**, sem parar para confirmar:

```
Atendendo revisão do PR #<n>. Teto <N> rodadas, merge <não autorizado|autorizado pelo usuário>.
Aguardando o relatório. Agora são <timestamp>.
```

## 1. Pré-condições

- Você é o autor do PR e está na **branch dele**, na **sua** árvore de trabalho.
- Working tree limpa (`git status`), e a branch não é a principal.
- `git rev-parse --abbrev-ref @{u}` **não** pode responder `origin/main`. Se responder, rode
  `git branch --unset-upstream` — é a armadilha do `CLAUDE.md`: branch de nome certo com
  upstream errado faz um `git push` pelado empurrar o repositório inteiro para a principal.
- O PR está aberto, e o relatório de revisão pode já ter chegado ou não. Os dois casos entram
  aqui: se já existe relatório sem resposta, **pule a abertura e a espera** e vá para a § 3.

## 1.1 Abra o ciclo no PR — antes de esperar

Poste um comentário curto, e só então comece a esperar:

```
<!-- urbiverso-revisao papel=implementador rodada=0/3 head=<sha> veredito=aguardando-revisao -->
Sessão implementadora acompanhando este PR. Teto <N> rodadas, merge <não autorizado|autorizado>.
```

Ele parece cerimônia e não é. É **a única coisa que existe no PR antes da rodada 1**, e faz três
trabalhos que nada mais faz:

1. **A sessão revisora auto-detecta o modo diálogo.** Sem este comentário ela precisa que o
   usuário diga, e o esquecimento é silencioso do pior jeito: ela publica o relatório, encerra, e
   você fica esperando uma rodada 2 que ninguém vai escrever.
2. **O teto chega à revisora na largada**, pelo `rodada=0/N`. Sem ele, ela só descobre o teto
   depois da sua primeira resposta — e calibra a última rodada tarde demais.
3. **O PR fica auto-explicativo.** Quem abrir daqui a meses vê, desde o primeiro comentário, em
   que regime o ciclo rodou.

Se o relatório da rodada 1 já estiver no PR quando você chega, **não poste a abertura** — ela
perdeu a função, e o header do seu próprio relatório de resposta já leva o teto.

## 2. A espera — cascata, e nunca `sleep`

Escolha o primeiro mecanismo que existir nesta sessão:

1. **`subscribe_pr_activity`** — inscrição em eventos do PR. É o caminho bom: sem custo
   enquanto nada acontece, e a sessão acorda com o comentário.
2. **`Monitor` persistente** com poll dos comentários (`comments?since=…`), uma linha de evento
   por comentário novo, intervalo de 30 s ou mais. É o caminho de sessão que não tem inscrição.
3. **Nenhum dos dois** → diga isso ao usuário e pergunte se ele prefere avisar você quando o
   relatório sair.

**Nunca espere com `sleep` em Bash**, e nunca fique consultando o PR num laço de mensagens: o
primeiro trava a sessão, o segundo queima contexto — que é o recurso que a § 11 chama de
escasso — sem produzir nada.

Enquanto espera, **não empurre nada**. A janela vale de "respondi" até "chegou o relatório
seguinte", e a regra é do protocolo: commit empurrado no meio faz o revisor publicar laudo
sobre código que já não existe. Já aconteceu. Se descobrir um defeito próprio nesse intervalo,
**deixe commitado localmente e empurre junto com os consertos da rodada** — ou, se for grave o
bastante para não esperar, empurre e **avise no PR** que o HEAD moveu, para o revisor recomeçar
a rodada.

## 3. Leitura do relatório

Do header (`papel=revisor`), tire `rodada`, `head` e `veredito`. Descarte evento que ecoa
comentário seu.

**Confira o `head=` contra o HEAD real da branch.** Divergiu → a revisão olhou código antigo:
diga isso na resposta, item por item, separando o que continua valendo do que já estava
corrigido. Não conserte de novo o que já está consertado, e não deixe o revisor descobrir
sozinho na rodada seguinte.

Relatório **sem header** (revisão humana, ou anterior ao protocolo) se lê pelo conteúdo. Você
responde normalmente, com header seu, e **não** conta como rodada do ciclo.

**Relatório com `dialogo=nao`** significa que o usuário desligou o diálogo do lado de lá: não
haverá rodada seguinte. Endereça os achados, responda **e encerre na mesma rodada** (§ 9), com
`motivo=pronto-para-merge` se nada ficou em aberto. Não espere — não há mais ninguém escutando.

Leia o relatório **inteiro**, inclusive o "o que foi confrontado e passou" e o quadro de
execução. As duas coisas mudam o seu trabalho: a primeira diz o que o revisor considera
resolvido — e é onde uma regressão sua vai doer mais —, e a segunda diz que lentes **não
executaram**, ou seja, onde não houve cobertura nenhuma apesar do relatório parecer completo.

## 4. Triagem — quatro desfechos, e contestar é um deles

Classifique **cada** achado antes de consertar qualquer um:

| Desfecho | Quando | O que produz |
|---|---|---|
| **Corrijo** | o achado procede | commit, e a linha do achado na resposta aponta o SHA |
| **Contesto** | o achado não procede | evidência na resposta: `arquivo:linha`, citação, raciocínio |
| **Fora de escopo** | procede, mas é problema preexistente ou de outro repo | issue nova com label de prioridade, **ou** comentário na issue que já cobre o tema — referenciado na resposta |
| **Decisão de desenho** | o relatório veio com `veredito=decisao-de-desenho`, ou você reconhece um achado como tal | **encerra o ciclo** (§ 9), depois de consertar o resto |

**Contestar é desfecho de primeira classe.** As próprias skills de revisão dizem que achado
bloqueante morre na verificação e que isso "é o desfecho certo, não vergonha". Uma sessão
implementadora que aceita tudo transforma o diálogo em teatro: ela conserta o que não estava
quebrado, o revisor confirma o próprio achado, e o PR piora com as duas partes satisfeitas.
Contestação exige **evidência**, não opinião — o mesmo padrão que a revisão exige de si.

**Decisão de desenho não espera o fim do teto.** Relatório com `veredito=decisao-de-desenho` —
ou achado que você reconheça como tal, mesmo sem o carimbo — tira a decisão de você na hora. Conserte tudo que for
independente dele, e encerre com `motivo=decisao-humana` listando o que ficou pendente e por
quê. Entregar metade e dizer claramente qual metade é melhor do que decidir sozinho o que foi
decidido a dois.

## 5. Conserto — delegado, com você verificando

Um subagente por achado, ou por grupo de achados que tocam o mesmo arquivo. Todos em paralelo,
numa mensagem só, com escopo delimitado: o achado, o arquivo, o que a revisão citou, e a
proibição de sair dali.

### O modelo do subagente — escale pelo que o portão consegue pegar

**Passe `model` explicitamente em toda chamada.** Sem o parâmetro o subagente **herda o modelo
do orquestrador**, e é aí que o dinheiro vaza: esta skill roda tipicamente num modelo caro,
porque triagem, verificação e julgamento pedem isso — e sem instrução ela delegaria o trabalho
mecânico para o mesmo modelo caro, multiplicado por achado e por rodada.

**O critério é a natureza da correção, não que parte do código ela toca** — uma linha em
`autenticacao.ts` é uma linha; reorganizar cinco arquivos que precisam ficar coerentes entre si
é difícil mesmo sendo tudo doc. E o que decide a faixa é o **portão de saída**: você lê o diff
de cada subagente e roda a suíte antes de commitar (§ 6), e esse portão pega **erro visível** —
código errado aparece no diff, conserto quebrado fica vermelho. Modelo menor é seguro
exatamente até onde o erro que ele pode cometer é desse tipo.

| Natureza da tarefa | Modelo |
|---|---|
| **O briefing dita a edição** — texto exato, linha nomeada, literal a remover, rename enunciado — ou o trabalho é **rodar e relatar**: suíte, sequência de gate, prova do vermelho. O subagente não acrescenta informação | `haiku` |
| **Conserto com diagnóstico dado — a regra.** O achado diz o quê, onde e o desfecho; um ou dois arquivos; escrever o código e o teste é com ele, decidir não é | `sonnet` |
| **O erro possível é invisível no portão**: consistência entre vários arquivos, decisão a tomar (nome no vocabulário, onde pôr a guarda, o que não uniformizar), desfecho que ainda não existe, ou **teste cuja armadilha é passar vacuamente** | `opus` |

A linha do meio é a regra por uma inversão que vale estar escrita: **o conserto delimitado já
chega com o diagnóstico pronto.** A revisão entregou `arquivo:linha`, a citação do contrato e
frequentemente o desfecho — o raciocínio caro foi gasto do outro lado, pela sessão revisora, e
gastá-lo de novo aqui é pagar duas vezes pela mesma análise. Sobra aplicar com cuidado e provar.

A linha de baixo é onde o portão não alcança, e os dois jeitos já aconteceram neste
repositório: coerência global não se recupera lendo diff no fim, e **teste vacuamente verde
passa em qualquer leitura de diff** — exemplos derivados da própria lista concordariam com
qualquer poda (#2438), e um assert sem o fixture certo mede ausência de origem em vez de
remoção (#2434). Conserto `sonnet` que envolva desenhar teste com armadilha dessas: ou o
briefing crava a armadilha por extenso, ou a tarefa sobe para `opus`.

Sobre `haiku` e doc: **"é edição de doc" não é o critério.** Doc aqui tem semântica de bundle
(`<!-- SDK -->` herda por heading), e foi um conserto "trivial" de doc que vazou nome de app no
bundle público. O risco mora no gate, e o gate é seu (§ 6a) — Haiku edita o que foi ditado;
quem protege é quem sempre protegeu.

**Nunca `fable` num subagente.** Tarefa delimitada não é assento dele. E se uma correção parece
grande a ponto de pedir isso, o diagnóstico é outro: ou ela é sua, ou está mal recortada — quebre
em achados menores antes de subir de modelo.

**Saída estruturada não funciona nesta instalação** (`StructuredOutput`/`schema` — ver
`CLAUDE.md`). Peça **texto livre em formato fixo** e faça o parsing você mesmo:

```
ACHADO: <id>          ARQUIVOS: <lista>
DESFECHO: corrigido | nao-reproduz | fora-de-escopo
O QUE MUDOU: <2 a 3 frases>
PROVA: <o comando que falha antes e passa depois, ou a linha que passou a existir>
```

Três instruções que vão cravadas em **todo** briefing, porque o subagente não lê o `CLAUDE.md`:

- **Não afrouxe teste para ficar verde.** Apagar asserção, marcar `skip` ou estreitar o caso
  não é conserto — é o achado voltando disfarçado. Teste que atrapalha ou está certo (e o
  código muda) ou está errado (e isso é um achado a reportar, não a apagar).
- **Não passe do escopo do achado.** Passar do escopo é permitido, mas nunca em silêncio: o que
  foi além entra declarado na resposta. Conserto que cresce sozinho é o que faz a rodada
  seguinte encontrar código que ninguém pediu e ninguém revisou.
- **Não toque rota de API de instância nenhuma** — nem produção, nem homologação, nem local.
  Agente com shell e rede acha natural "testar o endpoint".

**O conserto é seu, não do subagente.** Leia o diff de cada um antes de commitar, e confira a
prova que ele alega. Subagente já devolveu conserto que não compila e prova que media outra
coisa.

**Doc no mesmo commit.** Mudou comportamento do shell → `docs/shell/*.md`; mudou app → docs da
app. É regra do `CLAUDE.md`, e é achado garantido na rodada seguinte se faltar.

## 6. Verificação — três jeitos de medir o artefato errado

Todos os três já aconteceram neste repositório, e os três devolvem **verde**:

**(a) O comando isolado.** No PR #2438 o implementador rodou `check-docs-sdk.js` sozinho, o
script leu um **bundle velho**, e o texto novo nunca entrou na verificação. A frase dele resume:
*"verificação que mede o artefato errado é pior do que nenhuma: ela devolve verde e encerra a
dúvida"*. **Reproduza a sequência do job**, não o comando final — gate que depende de artefato
gerado roda o gerador antes, e é por isso que o job encadeia os dois.

**(b) O CI que não testa.** Este repo **não roda a suíte de backend em pull request**, por
decisão consciente e documentada (`validar-apps.yml`, #2272 — "regressão de backend é detectada
DEPOIS do merge, não antes"). Os checks verdes de um PR são validação de apps e conteúdo público
dos docs. Então: **leia o CI pela API no SHA empurrado** — ele é necessário —, e saiba que ele
**não** é evidência de que o seu conserto não quebrou nada. Essa evidência é a suíte, e ela é
sua.

**(c) O teste pulado.** Os `.pg` saem `skipped` sem binário de Postgres, e uma suíte com 5
pulados relata `0 fail` igualzinho a uma que rodou tudo. No PR #2439 o teste que provava a parte
mais importante do PR — a migração — saiu pulado na máquina de quem conferia. **Reporte sempre
os três números: passou, falhou, pulou.** Se o que pulou é justamente o que prova o seu
conserto, diga isso com todas as letras em vez de mostrar o total.

E a regra que atravessa os três: **teste novo que nunca foi visto vermelho não é evidência de
nada.** Rode-o contra o código sem o conserto e mostre que ele falha. É o que os dois lados
fizeram nos ciclos que deram certo, e é o que separa uma prova de uma afirmação.

CI vermelho por causa do seu conserto é seu — conserte antes de responder. Vermelho que reproduz
na branch principal e antecede o PR, você **registra** na resposta e segue.

## 7. A resposta ao revisor

Um comentário, sempre, fechando a rodada. Header do protocolo, com `head=` no **último commit
empurrado** e `rodada=N/CAP` — **com o denominador**. O teto é parâmetro seu; o revisor só fica
sabendo dele por este campo, e é com ele que a última rodada é calibrada do outro lado.

Estrutura:

- **Tabela achado → desfecho**, logo no começo: id, desfecho, SHA ou motivo. É o que permite ao
  revisor casar a rodada sem reler o relatório dele.
- Um bloco por achado, na ordem do relatório: o que mudou, e **por quê essa mudança e não
  outra**. Contestação carrega a evidência; conserto que passou do pedido diz que passou.
- **As decisões que você tomou e quer ver derrubadas.** Quando o conserto exigiu escolher —
  um valor novo num enum, onde pôr a guarda, o que não uniformizar —, liste as escolhas e diga
  explicitamente que o revisor pode derrubá-las. É o que transforma um conserto em desenho
  revisado, e foi o que produziu as melhores rodadas até aqui.
- **O que a revisão confrontou-e-passou e você tocou mesmo assim** — se houver. É a regressão
  mais provável do ciclo, e esconder isso é o pior uso possível de uma resposta.
- **Verificação**: os números da suíte com **passou / falhou / pulou**, os gates, e o estado do
  CI no SHA final. Número sem os pulados não é número (§ 6c).
- **O que ficou em aberto de propósito**, com o motivo.

Rodapé obrigatório:

```
---
_Generated by [Claude Code](https://claude.ai/code)_
```

**Empurre antes de postar.** A resposta é o marco que libera o revisor a olhar o código; postar
antes de empurrar manda ele revisar o estado anterior. Depois de postada, **não empurre** até o
relatório seguinte chegar.

## 8. Fim de rodada

Postada a resposta, volte a esperar (§ 2), com a rodada incrementada.

Antes disso, confira se o ciclo já deve terminar:

| Situação | Ação |
|---|---|
| Revisor mandou `merge-recomendado` | encerre (§ 9) |
| Achado `decisao-de-desenho` | encerre com `motivo=decisao-humana` |
| **Rodada = teto** | a resposta **é** o encerramento — ver abaixo |
| Zero bloqueantes, rodada < teto | responda `respondido` e **espere** o revisor confirmar. Não encerre sozinho: quem diz que a revisão cumpriu o papel é ele |

**Na rodada do teto você nunca responde `respondido`.** Encerre ali mesmo:
`motivo=pronto-para-merge` se nada ficou em aberto, `motivo=teto-de-rodadas` se ficou. Sem isso
os dois lados se esperam — o revisor não tem rodada para abrir e você espera um relatório que
não vem. É o único travamento de verdade deste desenho, e ele é silencioso: as duas sessões
ficam vivas, saudáveis e paradas.

Bloqueante **inédito** no teto, que não é regressão de conserto: encerre igual, e diga que o
problema de fundo é a cobertura da rodada 1 — achado novo tão tarde não se resolve com mais uma
rodada, se esconde.

## 9. Encerramento — e merge só se autorizado

**Sempre há comentário de encerramento**, inclusive quando não houve nada a consertar e
inclusive quando a rodada 1 já veio limpa. Ele faz duas coisas: diz ao usuário em que pé o PR
ficou, e **desliga a sessão revisora** — que, sem ele, fica inscrita acordando com cada evento
do GitHub até o container morrer.

Header com `veredito=encerrado` e o `motivo`. O corpo traz, nesta ordem: o placar das rodadas
(quantas rodaram, quantos achados, quantos contestados), o estado do CI no SHA final, o que
ficou pendente com o motivo, e — quando `motivo` não é `pronto-para-merge` — **a pergunta
concreta que o usuário precisa responder**. "Aguardando decisão" sem a pergunta escrita obriga
o usuário a reconstruir o contexto inteiro.

Encerrou por decisão humana ou por teto: **avise o usuário fora do PR também** (notificação),
porque ninguém fica olhando aba de PR esperando um agente parar.

### O que a suíte não alcança vira roteiro de QA

Terminando o ciclo, você é quem melhor sabe **o que nenhum teste cobriu por construção** — não
por esquecimento: dublê que achata `.where` e neutraliza todo filtro SQL, `.pg` que pulou,
comportamento só observável em instância viva. Isso não é motivo para segurar o PR; é entrada
para a skill `qa`, que aceita roteiro escrito em comentário de PR como modo de operação.

Quando houver uma faixa assim, o encerramento a nomeia — e, se ela for relevante, vale um
comentário com o roteiro: o que exercitar, com que perfil de credencial, em que instância, e o
que **não** dá para exercitar. Comece pelo que o PR tocou **fora** da feature nova: código
aditivo é a parte segura, e o risco mora no que já rodava em produção e passou a rodar
diferente.

Não invente cobertura no roteiro: item que só o sysadmin provisiona entra como pré-requisito
declarado, e rota proibida pelo `CLAUDE.md` não chega a virar item.

### Merge

Só com autorização da § 0. Sem ela, o ciclo termina com `motivo=pronto-para-merge` e o merge é
do usuário — não peça a autorização agora, não sugira que ele autorize, não deixe a sessão
esperando por ela.

Com autorização, confira o **portão de merge do protocolo, item por item**: zero bloqueantes,
nenhum `decisao-de-desenho`, **CI verde no SHA final lido pela API**, **suíte executada com os
pulados declarados** (§ 6b e 6c — CI verde aqui não quer dizer testado), rodadas dentro do teto,
`Closes #<n>` em inglês no corpo, doc no mesmo PR. Qualquer item falhando, não mergeie —
encerre e diga qual item barrou.

Depois de mergear: header `veredito=merged`, e **confira que a issue realmente fechou**.
`Fecha #123` não fecha nada, `Closes #1, #2` fecha só a #1, e keyword no título não vale — as
três falham em silêncio. Não fechou, feche na mão e registre o motivo.

Ao terminar, de qualquer modo: derrube o que você armou (`unsubscribe_pr_activity`, `TaskStop`
do monitor) e devolva à sessão o resumo com o timestamp de fechamento.

## 10. Proibições

- **Sem merge sem autorização expressa desta chamada.** Recomendação do revisor não é
  autorização.
- **Sem `--force`, sem rebase, sem squash** durante o diálogo. Precisou da branch principal,
  mergeie-a **para dentro** da sua.
- **Sem empurrar com rodada em voo** (§ 2).
- **Sem editar, esconder ou resolver o comentário do revisor.** O histórico é o registro.
- **Sem tocar rota de API de instância** para "verificar" o conserto. Instância quente é da
  skill `qa`; aqui a verificação é suíte, gate e CI.
- **Sem `AskUserQuestion`** — bugada nesta instalação; pergunta vai em texto corrido.
- **Sem as rotas proibidas do `CLAUDE.md`** (`homologacao`, `upgrade`, `release`, `atestado`),
  por motivo nenhum.
- **A branch principal é só para puxar.**

## 11. Operação

Roda no modelo atual da sessão. **Delegue o conserto, e delegue para baixo** (§ 5 — `sonnet` por
padrão, `haiku` no ditado e no rodar-e-relatar, `opus` onde o erro seria invisível no portão;
`model` explícito na chamada, sempre): o contexto do orquestrador é o recurso escasso, e um
ciclo de três rodadas consome mais do que uma implementação inteira.

Ficam com você, sempre: a triagem (§ 4), a leitura do diff de cada subagente, a verificação
(§ 6), a decisão de encerrar e o texto dos comentários. **Subagente conserta; julgamento é
seu.**

**Limite de 350 a 450 palavras por subagente.** Só o que mudou e a prova.

O ciclo inteiro é público: cada rodada fica escrita no PR, com SHA. Escreva as respostas
sabendo que a próxima sessão — e o usuário, meses depois — vão ler exatamente isso para
entender por que o código está como está.
