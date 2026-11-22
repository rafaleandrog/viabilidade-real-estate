# Como pôr para rodar no Claude Code

Tudo é feito em https://claude.ai/code/routines (as "tarefas agendadas", antes chamadas de
rotinas). O recurso está em prévia: se um rótulo de tela diferir, vale a documentação em
https://code.claude.com/docs/en/routines.md.

## 1. Subir os arquivos

O pacote traz uma pasta `.claude` com duas coisas, que vão para a raiz do repositório:

- `.claude/skills/rumo-ao-estado-da-arte/`: a skill;
- `.claude/rules/rumo-ao-estado-da-arte.md`: o arquivo que faz **toda sessão** do repositório seguir o
  modelo. Arquivos em `.claude/rules/` são carregados no início de cada sessão, junto do `CLAUDE.md`.

Leve os dois à branch principal num PR só de processo, sem código do app. O jeito mais simples é
abrir uma sessão no repositório, anexar o pacote e escrever:

```
Adicione estes arquivos em .claude/, sem alterar nenhum arquivo existente, num PR só de processo,
seguindo o processo deste repositório.
```

## 2. Preparar o ambiente de nuvem

No formulário de qualquer tarefa, em **Cloud environment**, **crie um ambiente novo só para esta
rotina**. Não edite um ambiente que as suas sessões de hoje usam: mudança de variável, script ou
rede num ambiente vale para tudo que roda nele. No ambiente novo, ponha:

- **Variáveis:** o token do registro de pacotes (`URBIVERSO_PACKAGES_TOKEN`). Opcional:
  `URBIVERSO_INSTANCIAS`, com credencial somente leitura, para a triagem ler o Sentinela — no
  formato que a `roteador-urbiverso` lê. Onde ela não existe (é o caso do app de viabilidade), use
  as variáveis que a skill de instância do repositório consome: na `instancia-urbiverso`,
  `URBIVERSO_URL` e `URBIVERSO_TOKEN`, com um token somente leitura.
- **Setup script:** o comando de instalação do repositório **com a autenticação do SDK** — o
  `pnpm install` pelado não lê o `URBIVERSO_PACKAGES_TOKEN` e falha no registro privado. Onde o
  repositório tem um helper para isso, use-o; no app de viabilidade é
  `source scripts/lib/sdk-auth.sh && urbi_pnpm_install`, o mesmo que o `validar-frontend.sh` usa.
- **Network access:** o padrão libera registros de pacotes comuns. Se a instalação do SDK falhar
  com `host_not_allowed`, acrescente o domínio do registro em **Allowed domains**. Se pôs a
  credencial da instância para ler o Sentinela, acrescente também o domínio do `URBIVERSO_URL`:
  sem ele o proxy recusa a conexão (`CONNECT … 403`).

## 3. Rodar o PREPARAR, uma vez, com você presente

Abra uma sessão normal do Claude Code no repositório e escreva:

```
Use a skill rumo-ao-estado-da-arte na etapa PREPARAR neste repositório.
```

Ela abre um PR com o Estado da Arte v1, em `.claude/estado-da-arte/`, e os outros arquivos da rotina. **Leia o Estado da Arte, corrija
o que estiver errado e faça o merge.** A rotina só começa depois disso.

A partir daqui, toda sessão que você abrir no repositório já trabalha no modelo. Os passos 4 a 6
ligam a parte automática e podem ficar para depois.

## 4. Criar a tarefa da triagem

**New task** → nome `Estado da Arte · triagem` → repositório → o ambiente do passo 2 → um modelo leve,
esforço baixo → gatilho **Schedule**, diário, alguns minutos depois da hora cheia (por exemplo
06:07) → em **Connectors**, remova os que não forem usados. Prompt:

```
Use a skill rumo-ao-estado-da-arte na etapa TRIAGEM neste repositório.
Ninguém acompanha esta sessão: não pergunte nada.
Autonomia: 1
```

## 5. Criar a tarefa da execução

Igual, com nome `Estado da Arte · execução`, um modelo mais forte e horário uma hora depois da triagem.
Prompt:

```
Use a skill rumo-ao-estado-da-arte na etapa EXECUCAO neste repositório.
Ninguém acompanha esta sessão: não pergunte nada.
Autonomia: 1
```

## 5b. Variante: uma tarefa só, numa sessão persistente (a do app de viabilidade)

Em vez das tarefas dos passos 4 e 5, uma tarefa só, presa a uma sessão dedicada (mesmo ambiente),
disparada em horários fixos — por exemplo 6h, 14h e 22h —, cada disparo fazendo a TRIAGEM e depois
a EXECUCAO na mesma conversa. Prompt:

```
Use a skill rumo-ao-estado-da-arte neste repositório: etapa TRIAGEM e, em seguida, etapa EXECUCAO.
Ninguém acompanha esta sessão: não pergunte nada; o que precisar do dono vai para o painel.
Autonomia: 2
Máximo de PRs implementados neste disparo: 3
```

A sessão começa cada disparo pelo painel e pelos comentários `Continuação:`, não pela memória da
conversa, que é resumida com o tempo.

### Trocar a sessão da rotina (para apagar a antiga ou zerar o contexto)

Nesta variante a tarefa fica **presa a uma sessão** (ela posta sempre na mesma conversa; as tarefas
dos passos 4 e 5, criadas pela tela com sessão nova a cada disparo, não têm esse problema): apagada
a sessão, os disparos não têm onde cair. E a
conversa cresce a cada disparo, deixando cada um mais caro. Para trocar, sem perder nada (a memória
da rotina é o repositório, o painel e os `Continuação:`):

1. Abra uma sessão nova **com o repositório** no mesmo ambiente. Uma sessão pode fazer isso por
   `create_session` com `source_url` do repositório e a tag `rumo-ao-estado-da-arte`. Mande nela um
   teste só de leitura: repositório clonado, skills do repositório na lista, a linha `[processo]`
   do hook, as ferramentas do GitHub e as de agendamento. O CLI do Kimi pode faltar; o motor de
   revisão o instala sozinho na primeira revisão.
2. Crie a tarefa nova presa a essa sessão (`create_trigger` com `persistent_session_id` da
   sessão nova), com os mesmos horários e o mesmo prompt, e só então desligue a antiga. Pelas
   ferramentas de agendamento, o prompt de uma tarefa só muda a partir da conversa em que ela
   posta; por isso trocar de sessão é criar outra tarefa, não editar a antiga.
3. Atualize o que lia a sessão antiga pelo id, se houver — por exemplo uma tarefa sua de
   acompanhamento que lê o histórico da rotina. O texto dela também só muda a partir da conversa
   dela.
4. Depois do primeiro disparo na sessão nova, a antiga pode ser apagada.

**O que não funciona:** a tarefa no modo "sessão nova a cada disparo", criada por uma sessão pelas
ferramentas de agendamento, nasce **sem o repositório e sem conectores**. Não há clone, nem skills
do repositório, nem as ferramentas do GitHub. Esse modo só serve se você criar a tarefa na tela de
rotinas do claude.ai, escolhendo o repositório e o conector do GitHub.

## 5c. Variante: Construtor e Merge, com sessão de despacho (a atual do app de viabilidade)

Uma sessão de **despacho** (modelo leve, título "[viab] despacho da rotina") recebe os disparos de
duas tarefas presas a ela: **Construtor** (5h41 e 17h41) e **Merge** (23h41). Cada disparo traz o
tipo, o título da sessão nova e o texto da tarefa; o despacho só cria a sessão nova com o
repositório, o título e esse texto, e encerra. Por que não "criar sessão nova a cada disparo" na
própria tarefa: nesse modo a sessão nasce sem o repositório e sem conectores. Os prompts completos
estão nas duas tarefas; a regra de cada etapa, em `etapas/execucao.md` e `etapas/merge.md`.

## 6. Sessão na hora (opcional)

Na variante 5b, **não** ponha este gatilho na tarefa única (ela roda a TRIAGEM inteira antes de
conferir o rótulo): crie para ele uma tarefa separada, só de EXECUCAO, com o prompt do passo 5.
Edite a tarefa da execução → **+** em **Trigger** → **GitHub event** → evento **Issue**, ação
`labeled`. É preciso ter o Claude GitHub App instalado no repositório; a tela pede se faltar.
A partir daí, pôr o rótulo `agora` numa issue abre uma sessão, que trabalha se houver saldo.

Atenção: o gatilho dispara a cada rótulo posto em qualquer issue, não só no `agora`. A sessão
confere o rótulo e encerra se não for o caso, mas cada disparo conta como uma execução. Se o
repositório rotula issues com frequência, deixe este passo para depois.

## 7. O botão de autonomia

Você muda a autonomia editando o **prompt** das duas tarefas (na variante 5b, da tarefa única), e
nada mais:

| Linha | O que passa a acontecer |
|---|---|
| `Autonomia: 1` | Todo PR fica pronto e parado para você |
| `Autonomia: 2` | Onde o processo do repositório aceita (ver abaixo), entram sozinhos manutenção, bugs com teste, os seus itens e os passos rumo ao Estado da Arte |
| `Autonomia: 3` e `Classes extras: ...` | O mesmo, mais as classes que você listar |

`Autonomia: 2` ou `3` só tem efeito onde o processo do repositório aceita autorização de merge
dada por uma linha no prompt da tarefa. Se ele exige autorização pedido a pedido e sem persistir,
a rotina trata 2 e 3 como 1 até você mudar o próprio processo do repositório, por PR, para
reconhecer a linha. (No app de viabilidade, o `CLAUDE.md` § Merge a reconhece só para itens pequenos e médios
não sensíveis; o resto para pronto para o seu merge.)

## 8. O seu dia a dia

- **Trazer uma ideia, um bug ou um link:** uma linha no `ideias.md`, uma issue, ou dizer "anota
  isso" em qualquer sessão.
- **Ver e aprovar:** abra a issue `Estado da Arte: painel`. Marque a caixa do que aprova, comente o que
  recusa, e faça o merge das propostas para o Estado da Arte que fizerem sentido.
- **Algo urgente:** o rótulo `agora` na issue.
- **Parar tudo:** crie o arquivo `.claude/estado-da-arte/PAUSA`. Ou desligue as tarefas na tela delas.
- **Testar uma release:** homologue na instância, como já faz hoje.
- **Avançar um assunto por conta própria:** abra uma sessão sua, ou escreva numa sessão já aberta,
  como sempre. A rule do repositório faz essa sessão deixar um `Continuação:` na issue do item, e a
  rotina segue dali no dia seguinte, sem refazer. Para mandar informação à rotina sem abrir sessão,
  comente na issue do item ou no painel: a triagem lê.

## 9. Para não atrapalhar o que já funciona

- **Uso do plano.** As tarefas agendadas gastam a mesma cota das suas sessões normais. Comece com
  um app e acompanhe em claude.ai/settings/usage. Se faltar cota para o seu trabalho, baixe o
  `orcamento_diario` ou desligue a execução.
- **Trabalho em paralelo.** A rotina não pega issue que já tem branch, PR ou arco em andamento.
  Mesmo assim, PRs dela podem conflitar com os seus em arquivos que todo PR edita. Com
  `Autonomia: 1` nada entra sem você, então o pior caso é um PR a mais para fechar.
- **CI e verificações do repositório.** Os PRs da rotina passam pelas mesmas verificações de
  qualquer PR. Se alguma barrar os arquivos novos, é um ajuste a fazer no PR de instalação.
- **Para desinstalar:** desligue as tarefas, apague `.claude/skills/rumo-ao-estado-da-arte/`,
  `.claude/rules/rumo-ao-estado-da-arte.md` e `.claude/estado-da-arte/`, e feche a issue-painel.
  Sem apagar a rule, toda sessão continuaria a seguir a rotina. Ficam o `ideias.md` (se foi a
  PREPARAR que o criou, decida se ele fica como caixa de ideias do app) e as issues e PRs que a
  rotina abriu, que você fecha ou mantém como quiser.

## 10. Outro app

Repita os passos 1 a 5 no outro repositório. Cada app tem o seu Estado da Arte, o seu painel e a
sua autonomia.
