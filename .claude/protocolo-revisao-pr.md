# Protocolo de revisão em diálogo

Contrato entre duas sessões que conversam por um PR: a **implementadora**, que escreveu o
código e vai consertar, e a **revisora**, que roda `revisar-pr-shell` ou `revisar-pr-apps`. Elas
nunca se falam direto — todo o estado do diálogo mora nos **comentários do PR**.

Quem carrega este arquivo: `acompanhar-revisao` sempre, e as duas skills de revisão quando entram
em modo diálogo. Ele está na mesma árvore `.claude/` de onde a skill foi carregada (skill em
`~/.claude/skills/` → protocolo em `~/.claude/`). **Não achou, PARE e diga** — rodar o loop com
formato de header adivinhado é exatamente a divergência que este arquivo existe para impedir.

**Cópia única, de propósito.** As skills de revisão espelham seções entre si com recado de
manutenção; este arquivo fica **fora** desse esquema. Protocolo espelhado diverge, e protocolo
divergido quebra em silêncio: um lado passa a escrever um campo que o outro não lê, os dois
seguem publicando comentários bonitos, e o loop trava sem ninguém ver.

## As duas sessões

| | Implementadora | Revisora |
|---|---|---|
| Skill | `acompanhar-revisao` | `revisar-pr-<shell\|apps>` § Modo diálogo |
| Escreve no PR | commits e comentário de resposta | comentário de relatório |
| Autoridade | conserta, contesta, **encerra** o ciclo | avalia, **recomenda** |
| Nunca faz | tratar autorrevisão como revisão | commitar, empurrar, mergear |

Nenhuma das duas mergeia por padrão. Ver § Merge.

## O header de máquina

Todo comentário do loop **abre** com uma linha de comentário HTML — invisível no render do
GitHub, greppável pela API:

```
<!-- urbiverso-revisao papel=revisor rodada=2 head=064f4168 veredito=bloqueado -->
```

| Campo | Quem escreve | Valores |
|---|---|---|
| `papel` | ambos | `revisor` · `implementador` |
| `rodada` | ambos, como `N/CAP` — o revisor omite o `/CAP` se ainda não o conhece | ver § Teto de rodadas |
| `head` | ambos | SHA curto: o que o revisor **de fato** revisou; o que o implementador **empurrou** |
| `veredito` | revisor | `bloqueado` · `observacoes` · `decisao-de-desenho` · `merge-recomendado` |
| `veredito` | implementador | `aguardando-revisao` · `respondido` · `encerrado` · `merged` |
| `motivo` | implementador, **só** com `encerrado` | `pronto-para-merge` · `decisao-humana` · `teto-de-rodadas` |
| `dialogo` | revisor, **só** quando vale `nao` | `nao` — relatório de tiro único, não haverá rodada seguinte |

Por que header, e não só prosa: a § 1 das duas skills de revisão avisa que **todo comentário
sai com o mesmo login**, e manda distinguir pelo conteúdo e pela data. Isso serve a um humano
lendo a página; não serve a uma sessão decidindo se o evento que a acordou é o que ela
esperava. O header torna essa decisão mecânica.

Ele **não substitui o texto**. É deliberadamente redundante com o que o comentário diz em
português, e é essa redundância que deixa o loop legível para o usuário e decidível para as
sessões ao mesmo tempo. Header sem relatório embaixo não é comentário válido.

**Comentário sem header não é do loop.** Comentário do usuário, de CI, de outra ferramenta, ou
relatório de revisão anterior ao protocolo: leia pelo conteúdo, responda se fizer sentido, e
**não** conte como rodada.

**O header vai no comentário, nunca na descrição do PR.** Medido no #2442, e a assimetria não é
óbvia: a leitura de **comentários** devolve o comentário HTML intacto, e é por isso que o
mecanismo funciona; a leitura da **descrição** do PR volta com ele removido. Header posto no
corpo do PR desaparece na ida e volta — some sem erro, sem aviso, e o outro lado lê um PR que
nunca entrou no protocolo.

## As três severidades — a máquina lê o header, não o título

| Severidade | Significa | O implementador |
|---|---|---|
| bloqueante | tem que mudar antes do merge | conserta ou contesta com evidência |
| observação | vale registrar, não barra | julga; pode deixar para depois, declarando |
| **decisão de desenho** | consertar mexe em algo que o usuário decidiu | **encerra o ciclo** e devolve a decisão |

A terceira existe por causa deste protocolo. Ela não é uma severidade "entre" as outras duas: é
um desvio de destinatário — nenhuma das duas sessões tem alçada sobre ela.

**O sinal que a máquina lê é o `veredito` do header**, e o corpo do relatório continua em
português natural. A § 7 já manda separar bloqueante de observação em blocos distintos; como
esses blocos se chamam ("Bloqueante" no singular quando é um, "Bloqueantes" quando são vários,
"Observações") é escolha de quem escreve. Fixar título literal foi tentado e estava errado: os
relatórios reais alternam singular e plural naturalmente, e uma detecção por título teria
quebrado no primeiro deles.

Quando o relatório tem mais de uma severidade, o `veredito` segue esta precedência, da mais
forte para a mais fraca: `decisao-de-desenho` › `bloqueado` › `observacoes` › `merge-recomendado`.
Um relatório com dois bloqueantes e uma decisão de desenho é `decisao-de-desenho`: os
bloqueantes continuam listados e continuam sendo consertados, mas o ciclo termina naquela
rodada de qualquer jeito.

## O SHA é o chão do diálogo

Já aconteceu, no PR #2438: a revisão 2 revisou `064f4168`, o implementador tinha empurrado
`0e10fc6` "alguns minutos antes da revisão sair", e o único achado do relatório **já estava
corrigido quando foi publicado**. Ninguém errou — as duas sessões estavam certas sobre estados
diferentes do mesmo PR. É o modo de falha nativo deste loop, e ele desperdiça uma rodada
inteira do teto.

Três regras saem daí:

- **O revisor relê o HEAD do PR imediatamente antes de postar.** Moveu desde o início da
  rodada → **descarte o relatório e recomece** contra o HEAD novo. Publicar laudo sobre código
  que já não existe é pior do que demorar mais.
- **O implementador não empurra enquanto uma rodada está em voo.** A janela vai de "respondi"
  até "chegou o relatório seguinte". O `head=` da resposta é o **último commit empurrado**, e
  depois dela nada mais sobe até a próxima rodada chegar.
- **Ninguém reescreve histórico durante o diálogo** — sem `--force`, sem rebase, sem squash
  intermediário. O delta entre rodadas é calculado por SHA; reescrever apaga o chão do revisor.
  Precisou incorporar a branch principal, **mergeie-a para dentro** da branch do PR.

## Máquina de estados

| Estado | Quem age | O que faz | Vai para |
|---|---|---|---|
| PR aberto, ninguém revisando ainda | implementador | posta a **abertura** (`rodada=0/CAP`, `veredito=aguardando-revisao`) e espera | aguardando rodada 1 |
| PR aberto, sem relatório | revisor | roda a skill, posta `rodada=1/CAP` | aguardando resposta |
| relatório com `dialogo=nao` | implementador | endereça, responde **e encerra** na mesma rodada | fim |
| relatório `bloqueado` ou `observacoes` | implementador | tria, conserta, verifica, empurra, responde `respondido` | aguardando revisão N+1 |
| resposta `respondido`, rodada < CAP | revisor | escolhe a profundidade, revisa o delta, posta `rodada=N+1` | aguardando resposta |
| implementador vai responder **na rodada = CAP** | implementador | a resposta **é** o encerramento: nunca `respondido`, sempre `encerrado` | fim |
| relatório `merge-recomendado` | implementador | encerra — ou mergeia, **se autorizado** | fim |
| bloqueante no teto, ou achado `decisao-de-desenho` | implementador | conserta o que é independente, encerra e avisa o usuário | fim |
| `encerrado` ou `merged` | revisor | desliga escuta e gatilhos | fim |

## Teto de rodadas

Padrão **3**. O usuário pode fixar outro na chamada da sessão implementadora ("5 rodadas",
"rodada única", "sem teto") — e aí vale o que ele disse.

O teto viaja no header do implementador, e é assim que a sessão revisora fica sabendo dele: ela
**não** recebe o parâmetro. O comentário de abertura (`rodada=0/CAP`) existe justamente para
entregá-lo antes da rodada 1, e a partir dali o revisor repete o denominador que leu.

**Sem comentário de abertura, o revisor escreve `rodada=1` sem denominador** — e **não inventa o
teto**. Escrever `1/3` num ciclo que o usuário fixou em 5 faz a última rodada ser calibrada duas
rodadas cedo demais, o que é pior do que não saber.

**Rodada é contada por relatório de revisão**, não por comentário. Um relatório mais a resposta
que o fecha são a mesma rodada, e por isso carregam o mesmo `rodada=N`.

**No teto, a resposta do implementador é o encerramento.** Nunca `respondido` na rodada = CAP —
`encerrado`, com `motivo=pronto-para-merge` se nada ficou em aberto, ou `motivo=teto-de-rodadas`
se ficou. Sem essa regra os dois lados se esperam: o revisor não tem rodada para abrir e o
implementador espera um relatório que não vem. Foi o único travamento de verdade neste desenho.

## Merge — nunca por padrão

**A sessão implementadora não mergeia.** A exceção é uma só: o usuário autorizou o merge
**expressamente, na chamada daquela sessão** ("no final, mergeia", "pode mergear se ficar
limpo"). Não vale autorização de tarefa anterior, não vale silêncio, não vale inferir de
"toca o PR até o fim". Na dúvida, **não é autorização** — e a dúvida se resolve encerrando o
ciclo, que é barato, em vez de mergeando, que não é.

Sem autorização, convergiu → **comentário de encerramento** com `motivo=pronto-para-merge`. O
PR fica pronto e parado, esperando o usuário. Com autorização, o mesmo portão, e aí sim o
merge.

**Portão de merge** — todos obrigatórios, e nenhum deles é dispensável por pressa:

- zero bloqueantes em aberto;
- nenhum achado marcado `decisao-de-desenho`;
- CI verde **no SHA final**, lido pela API, nunca por comando local;
- **a suíte efetivamente executada**, com o número e os **pulados** declarados — ver abaixo;
- rodadas dentro do teto;
- `Closes #<n>` em inglês no corpo do PR, quando há issue;
- doc no mesmo PR, quando o comportamento mudou.

**CI verde é necessário e não é suficiente, e aqui isso é literal:** este repo **não roda a
suíte de backend em pull request**, por decisão consciente e documentada (`validar-apps.yml`,
#2272 — "regressão de backend é detectada DEPOIS do merge, não antes"). Os checks verdes de um
PR são validação de apps e conteúdo público dos docs; **nenhum deles executa teste de backend.**
Tratar "CI verde" como "testado" é o mesmo erro de medir o artefato errado, um nível acima.

**Pulado não é passado.** Os testes `.pg` saem `skipped` em máquina sem binário de Postgres, e
uma suíte com 5 pulados relata `0 fail` exatamente como uma suíte que rodou tudo. Quem reporta
número reporta **os três**: passou, falhou, pulou. Já aconteceu de o teste que provava a parte
mais importante de um PR sair pulado na máquina de quem conferia.

Quando um lado não conseguiu executar, ele **diz isso e atribui o número ao outro** — "a
execução verde é relato do autor, não medição minha" é uma frase válida de relatório, e é
infinitamente melhor que herdar o número em silêncio.

Depois de mergear, **confira que a issue realmente fechou**. É falha silenciosa: o PR mergeia,
a issue fica aberta e ninguém percebe.

## Revisão de tiro único com implementadora esperando

O usuário pode desligar o diálogo do lado da revisora (`sem diálogo`) mesmo havendo abertura no
PR — para gastar uma revisão só, ou porque vai conduzir o resto na mão. É legítimo, e tem um
modo de falha próprio: a implementadora responde e fica esperando uma rodada 2 que ninguém vai
escrever. Duas sessões vivas, saudáveis e paradas, de novo.

Por isso o revisor que opta por sair **com abertura no PR** carimba `dialogo=nao` no header e
diz no texto que não haverá rodada seguinte. A implementadora, ao ler esse campo, endereça os
achados, responde **e encerra na mesma rodada** — sem esperar.

Sem abertura no PR, não há ninguém para avisar, e o campo não é necessário.

## Encerramento

`veredito=encerrado` (qualquer motivo) e `veredito=merged` são **terminais**. Ao ler qualquer um
dos dois, a sessão revisora desliga a inscrição, derruba monitores e gatilhos, e para.

Encerrar é **obrigação do implementador**, não cortesia. Uma sessão revisora inscrita num PR
que ninguém vai mais tocar fica acordando com cada evento do GitHub até o container morrer. Se
o ciclo termina por decisão humana, o comentário de encerramento é também o que diz ao usuário
o que ficou pendente e por quê.

O comentário de encerramento sai **mesmo quando não houve nada a consertar** — inclusive quando
a rodada 1 já veio `merge-recomendado`.

## Anti-travamento

- **Eco do próprio comentário.** O evento que anuncia o que você mesmo acabou de postar não é
  resposta. Descarte pelo `papel=` do header.
- **Webhook é best-effort.** Passou o tempo que você esperava sem o evento, **consulte os
  comentários do PR direto** em vez de continuar esperando. Evento perdido é falha comum; loop
  parado por evento perdido é falha evitável.
- **O outro lado sumiu.** Sem sinal por muito mais tempo do que a rodada anterior levou:
  registre no PR o que você tem e devolva a decisão ao usuário. Nenhum dos dois lados espera
  para sempre.
- **Bloqueante novo na última rodada.** Se o revisor abre bloqueante inédito no teto — e que
  **não** é regressão de conserto —, o ciclo encerra com `motivo=teto-de-rodadas` e vai para o
  usuário. Achado inédito tão tarde significa que a rodada 1 não cumpriu o papel; mais uma
  rodada esconde isso em vez de resolver.

## O que nunca acontece

- Editar, esconder ou resolver o comentário do outro lado. O histórico do diálogo é o registro.
- Contar autorrevisão como rodada. A § 1 das skills de revisão já diz: relatório da sessão que
  escreveu o PR não é revisão independente.
- Usar "approve" ou "request changes" do GitHub. Comentário normal, sempre.
- Empurrar para a branch principal, ou trabalhar em árvore de outra sessão.
