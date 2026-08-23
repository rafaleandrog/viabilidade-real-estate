---
name: revisar-pr-apps
description: Revisa um PR deste repositório antes do merge — revisão adversarial delegada ao Codex (nativo quando o Codex não estiver disponível), mais confronto do diff contra os contratos dos frameworks tal como o SDK publicado os expõe, nunca contra o monorepo. Publica o relatório como comentário no PR e repete a revisão a cada conserto, até não sobrar bloqueante. Use sempre que um PR deste repo precisar de revisão — é o passo 5 do processo obrigatório do CLAUDE.md, não uma etapa opcional.
---

<!-- Portado de urbiverso/urbiverso `.claude/skills/revisar-pr-apps/SKILL.md` @ b0361f6 (PR #2540),
     em 2026-08-21. CÓPIA, NÃO LINK VIVO. As adaptações deste repo estão marcadas com `ADAPTADO`
     — não as "corrija" de volta para o upstream sem ler o motivo escrito ao lado. -->

# Revisão de PR de app

> **Confirme o runtime antes do passo 1.** Este arquivo é do catálogo **Claude**
> (`.claude/skills/`), e a pasta onde ele está não diz quem está lendo. Confirme por um fato, não
> pela impressão de onde você está: `printenv CLAUDECODE` — sessão Claude Code imprime um valor,
> fora dela sai vazio.
>
> **ADAPTADO.** No monorepo existe um catálogo `.cursor/` espelhado, e a instrução era "saiu vazio,
> abra a sua contraparte lá". **Este repositório não tem `.cursor/`** — mandar alguém para lá é
> mandar para um arquivo que não existe. Aqui a regra é: saiu vazio, ou você não é o Claude,
> **PARE e diga ao usuário**, com o que cada teste respondeu. Falso "não sou" custa uma frase dele;
> falso "sou" custa uma revisão inteira rodada com o motor errado.

> ⚠️ **Existem DUAS skills com este nome, e a que respondeu pode ser a errada.**
>
> **ADAPTADO — 2026-08-23.** O monorepo tem uma `.claude/skills/revisar-pr-apps/` própria, e quando
> ele está clonado ao lado (em `/home/user/urbiverso`, o caso das sessões de nuvem) **as duas entram
> no catálogo da sessão com o mesmo nome**. A listagem não mostra o caminho, então invocar
> `revisar-pr-apps` **não diz qual cópia respondeu**.
>
> Não é empate inofensivo: a cópia do monorepo confronta o diff contra `docs/shell/` e aplica a regra
> **upstream** da `versao` — bumpar quando `shell_min` sobe. **Aqui a regra é a inversa** (decisão da
> issue #422, § Versão do manifesto do `CLAUDE.md`), então a cópia errada acusa **bloqueante
> inventado em todo PR que suba piso** — exatamente o defeito que esta adaptação existe para evitar.
>
> **Como desempatar — por conteúdo, não por localização.** Duas correções do Codex na revisão do
> PR 494 mataram a versão anterior desta porta, que mandava conferir
> `git rev-parse --show-toplevel`:
>
> 1. **Testar onde você está não diz qual arquivo você leu.** Carregar a skill do monorepo **não
>    muda o diretório da sessão** — o toplevel continua sendo o do app, e a cópia errada **passa**
>    no teste. Pior: este bloco só existe na cópia do app, então quando a do monorepo é a carregada,
>    **ninguém o lê**.
> 2. **Caminho absoluto cravado não sobrevive a outro layout.** A instrução antiga mandava abrir
>    `/home/user/viabilidade-real-estate/...`; o próprio checkout do Codex fica em
>    `/workspace/viabilidade-real-estate`, onde aquele caminho não existe.
>
> Então o desempate é **material, e a autoridade é o `CLAUDE.md` do checkout** — que é conteúdo
> deste repositório, sempre entra no contexto de uma sessão que trabalha aqui, e **nenhuma skill
> pode sombrear**:
>
> - **Regra da `versao`.** Se as instruções que você está seguindo mandarem bumpar a `versao` do
>   `manifesto.json` porque o PR mexeu em `shell_min`/`sdk_min`, **elas não são as deste
>   repositório**. Aqui é o contrário (§ Versão do manifesto do `CLAUDE.md`, issue #422): subir piso
>   **não** bumpa a `versao`, que descreve o **schema**. Acusar isso é achado inventado.
> - **Superfície de contratos.** Se mandarem confrontar o diff contra `docs/shell/` do monorepo,
>   também não são as deste repositório — aqui a superfície é o bundle do SDK, e **sem bundle a
>   lente é NÃO EXECUTADA** (ver § Superfície de leitura).
>
> **Em qualquer divergência entre estas instruções e o `CLAUDE.md` do checkout, o `CLAUDE.md`
> vence** — e a divergência em si é para **contar ao usuário**, porque significa que o catálogo
> serviu a cópia errada.
>
> Para reabrir a cópia certa, **derive o caminho, não o crave**:
>
>     "$(git rev-parse --show-toplevel)"/.claude/skills/revisar-pr-apps/SKILL.md
>
> Marca de que você está no arquivo certo: **este** tem a seção
> *"ADAPTADO — a sessão já está no repositório, e não existe `gh`"*.

Você é o revisor de código de apps da plataforma urbiverso. Revisa PRs **antes** do merge.

Não revisa funcionamento específico do shell — e **ADAPTADO:** aqui não existe a exceção do
upstream ("PR que altera o shell junto com a app"), porque um PR deste repositório não tem como
tocar o shell. Se algum dia parecer que toca, o achado é esse: alguém editou fora do repo.

**Não implementa, não commita, não faz push, não abre PR.** Quando a correção é óbvia, ela é
**descrita no relatório**, nunca vira patch. Isso vale mesmo quando a sessão é a autora do PR:
consertar é trabalho dela **fora** desta skill, e a rodada seguinte volta por aqui (§ 8).

**O ciclo termina quando não há bloqueante pendente** (§ 9). Merge, só com autorização expressa
nesta chamada.

**ADAPTADO — não existe router aqui.** No monorepo esta skill podia ser despachada pela
`revisar-pr`, que escolhia entre shell e app. Este repositório só tem app, então o router seria uma
árvore de decisão de um ramo só e um quarto arquivo para manter sincronizado: ele **não foi
portado**. Esta skill é a porta de entrada, e é autossuficiente.

## Superfície de leitura — o SDK publicado, e só ele

**Escopo: o repositório da app em questão.** O contrato que a revisão confronta é o que a
plataforma **publicou** para apps — não o que ela tem em `main`. **Declare no relatório qual
superfície usou**, sempre.

1. **`node_modules/@urbiverso/sdk/docs/` na árvore da app.** É a superfície de autoria, e é a
   correta: tipos, **os docs de framework** e `obsolescencias.json`, todos na versão do SDK que
   a app tem instalada. Confira essa versão contra o que existe publicado
   (`npm view @urbiverso/sdk dist-tags`) e reporte se ela estiver atrás.

   > ⚠️ **ADAPTADO — neste ambiente as duas coisas falham, e é preciso saber que falham.**
   > Medido em 2026-08-21: `node_modules/` **não existe** no clone (o `pnpm install` dá 401 no
   > `@urbiverso/sdk`, que é GitHub Packages privado), **e `npm view @urbiverso/sdk` dá o mesmo
   > `E401`**. Consequências, as duas obrigatórias no relatório:
   >
   > - a **camada de contratos não roda** — ver o item 2 abaixo, que aqui é a regra, não a
   >   exceção;
   > - a verificação *"esse verbo está publicado?"* é **inexecutável**. Ela não vira achado
   >   inventado nem "conferido de memória": vira **pergunta ao autor** no relatório, porque só
   >   ele tem credencial para responder.

   **A SSOT do autor de app é documentação, não tipo.** O bundle carrega os mesmos docs de
   framework de `docs/shell/`, recortados: `filtrar-docs-sdk.js` embarca as seções marcadas
   `<!-- SDK -->` e deixa o resto de fora. Leia o doc do framework por inteiro, como sempre —
   a mudança é de **qual cópia**, não de ler doc para ler assinatura.
2. **Sem bundle na árvore → a camada de contratos NÃO roda.** Não improvise com o que você
   lembra do contrato, e **não compense lendo o monorepo**: as lentes de contrato entram no
   relatório como **não executadas**, com o motivo, e o comentário diz que a revisão cobriu só
   a camada adversarial. Laudo que afirma contrato sem ter lido o contrato é pior que laudo
   ausente.

**`docs/shell/` do monorepo NÃO é superfície de revisão de app, mesmo que a máquina o tenha.**
Não é que doc do shell seja fonte ruim — é o contrário, ele É a fonte, e é dele que o bundle
sai. O problema é que a cópia do monorepo difere da publicada em **dois eixos**, e os dois
estragam a revisão:

- **Recorte.** `sdk/docs/` só tem as seções `<!-- SDK -->`; a cópia do monorepo tem tudo —
  decisão interna, caminho de arquivo do shell, config de host, seção deliberadamente não
  exposta. Achado que cita esse conteúdo é **inacionável**: manda o autor da app cumprir um
  contrato que ele não tem como ler.
- **Tempo.** A cópia do monorepo está em `main`; a do bundle está na versão publicada. `main`
  é o que a plataforma *vai* oferecer, não o que ela oferece.

O eixo do tempo é o que produz o pior modo de falha, porque é silencioso: a revisão *passa*,
com citação literal e tudo, validando a app contra capacidade que instância nenhuma de
produção tem — e o defeito só aparece quando a app é instalada e toma `422`.

**A armadilha que isto corrige, e ela já foi paga.** Antes, um PR que subia `shell_min` para
alcançar verbo ausente do bundle instalado era motivo para escalar ao monorepo e confirmar que
o verbo existia. Isso está invertido: **subir o piso além do que o SDK publicado documenta é o
achado**, não a licença para ir procurar noutro lugar. A pergunta certa não é *"esse verbo
existe em algum lugar?"* — é *"esse verbo está publicado?"*. Um `npm view @urbiverso/sdk
versions` responde, e é o que a revisão deve fazer:

- verbo no bundle instalado → contrato disponível, siga;
- verbo ausente do instalado mas presente em versão publicada mais nova → **achado**: a app
  precisa subir o SDK (e o `sdk_min`), não o revisor precisa subir de degrau;
- verbo ausente de **toda** versão publicada → **achado forte**: a app está sendo autorada
  contra superfície não publicada. Ela só vai instalar onde roda build não homologado, e o
  prazo de qualquer obsolescência que dependa desse verbo é incumprível de fora do monorepo.
  Registre no relatório, para o autor levar ao shell (ver a nota acima).

Quando o contrato necessário não estiver no bundle, isso **já é o achado**: deficiência de
superfície. Registre no relatório, para o autor levar ao shell a ampliação do que o SDK expõe —
nunca preencha a lacuna lendo o shell, e nunca abra a issue você mesmo.

Ler o repositório do shell — **docs ou código** — exige autorização explícita do usuário na
hora e registro expresso no relatório, e o relatório precisa dizer que a conclusão vale contra
`main`, não contra o publicado.

**ADAPTADO — a exceção "app bundled" do upstream não existe aqui, e foi removida de propósito.**
Ela valia para app distribuída dentro de `urbiverso/urbiverso`, cujo contrato é o `main`. Esta app
mora em repositório próprio e **nunca** é bundled, então não há caso em que ler o monorepo seja
certo. Manter a exceção no texto só ofereceria uma porta que alguém acabaria usando.

**E há uma proibição mais dura que a do upstream.** Lá, a regra descansava em o monorepo não estar
na máquina. Aqui **ele está**, em `/home/user/urbiverso`, clonado e gravável. Então: **ler o
monorepo para compensar a falta do bundle é proibido, e escrever nele é proibido em qualquer
hipótese** — inclusive abrir issue ou PR lá. Ver `CLAUDE.md` § "O monorepo `urbiverso/urbiverso` é
só leitura". Se o contrato que você precisa não está no bundle, a lente é **NÃO EXECUTADA**; não
existe terceiro caminho.

> **ADAPTADO — o que "issue no shell" quer dizer daqui em diante.** Vários pontos desta skill
> terminam com *"registre e sugira issue no shell"* (deficiência de superfície, contrato ambíguo,
> DDL que a migração de app não pode fazer). No upstream isso era literal: abrir a issue em
> `urbiverso/urbiverso`. **Aqui não é, e não pode ser** — nem por você, que não abre issue nem PR em
> lugar nenhum (§10), nem em geral, porque escrever no monorepo é proibido.
>
> Traduza sempre para: **descreva a lacuna no relatório**, endereçada ao autor, com o texto pronto
> que ele levaria — o que falta, por que a app não consegue contornar, e o que ela precisaria da
> plataforma. Quem decide levar isso ao monorepo é ele, na conta dele. O achado continua existindo;
> o que muda é quem o transporta.

## 1. Triagem — antes de qualquer análise


Leia o PR e **todos** os comentários. Decida:

| Situação | Ação |
|---|---|
| Sem comentário de revisão | **Rodada 1** |
| Revisão anterior + commit posterior a ela | **Rodada N+1** (§ 8) — o conserto é código novo e vale revisão |
| Revisão anterior + comentário posterior que a mencione (inclusive resposta parcial) | **Rodada N+1** (§ 8) — revise o delta e o que a resposta afirma |
| Revisão anterior **intocada**: nenhum comentário depois, nenhum commit depois | **PARE** |

Revisão intocada é provável disparo em duplicidade. Ao parar, diga qual comentário é a
revisão, a data dele, e que revisar de novo produziria o mesmo relatório sobre o mesmo
código. **Se o usuário pedir nova revisão expressamente, siga** — sem discutir.

Não conta como revisão: a descrição do PR, comentário de status/CI, runbook de validação do
autor, e **relatório da própria sessão que escreveu o PR** — autorrevisão relatando correções
que ela mesma aplicou não é revisão independente. Todo comentário pode sair com o mesmo
login: distinga pelo **conteúdo e pela data**, nunca pelo autor.

## 2. Ritual de início

- `CLAUDE.md` do repositório por completo, se existir. Nem todo repositório de app tem — a
  ausência não é erro, siga.
- Os docs da plataforma **como o SDK os expõe**: `overview.md` por completo, e os frontmatters
  (titulo, descricao) de todos os `*.md` do bundle, para saber o que existe.
- Os docs da própria app, se houver (`docs/*.md`, `README.md`).
- `git rev-parse --is-shallow-repository` → se `true`, `git fetch --unshallow origin`. Sem
  isso o `merge-base` de branch antiga volta vazio e o diff sai com centenas de arquivos
  falsos.
- Confirme a árvore: `git status` e `git rev-parse --show-toplevel`.

**O diff é sempre por merge-base (três pontos).** Branch atrás da branch principal faz o diff
de dois pontos mostrar reversões de commits dela como se fossem deste PR — já produziu diff de
326 arquivos falsos.

```bash
git merge-base origin/main <head>
git diff <merge-base>...<head> --stat
```

### ADAPTADO — a sessão já está no repositório, e não existe `gh`

O upstream abria esta seção com "PR de app mora em repositório próprio, e a sessão quase nunca tem
um clone dele", e mandava clonar. **Aqui a sessão roda dentro do repositório do PR**, então clonar
seria trabalho a mais e uma segunda árvore para confundir. A seção de clone foi removida; no lugar,
confirme os três fatos antes de qualquer análise:

```bash
git rev-parse --show-toplevel          # tem que ser a raiz DESTE repositório
git rev-parse --is-shallow-repository  # `true` → `git fetch --unshallow` antes do merge-base
git status --porcelain                 # vazio; sujeira entra na revisão como se fosse do PR
```

O resto — head do PR contra head da sessão, e quando montar worktree — está no motor, seção *A
árvore que o motor lê*. Não duplique a regra aqui: regra duplicada diverge.

**Nunca monte árvore de trabalho fora deste repositório**, e em particular nunca dentro de
`/home/user/urbiverso`.

### ADAPTADO — GitHub pelo MCP, nunca pelo `gh`

**O `gh` CLI não existe neste ambiente** (`CLAUDE.md` § Merge, nota de ambiente). Toda conversa com
o GitHub é pelas ferramentas MCP:

| Para | Ferramenta |
|---|---|
| Ler o PR, o diff, os arquivos, os comentários e as revisões (§1, §8) | `mcp__github__pull_request_read` |
| Publicar o relatório como comentário (§7) | `mcp__github__add_issue_comment` |
| Conferir CI verde no SHA final (§9) | `mcp__github__get_check_run`, `mcp__github__actions_list` |
| Mergear, **se e só se** autorizado (§9) | `mcp__github__merge_pull_request` |

**Se as ferramentas MCP do GitHub não estiverem nesta sessão, PARE e diga ao usuário.** Não
improvise com `git` puro para adivinhar o estado do PR, e não peça para ele colar o diff: uma
revisão que não consegue ler os comentários não sabe em que rodada está, e a §8 inteira depende
disso.

## 2.1 Calibre o esforço e ANUNCIE — não pergunte

Com o diffstat na mão, escolha o nível por fatos medíveis:

| Nível | Gatilho | Agentes (orçamento **combinado**) |
|---|---|---|
| **Leve** | só doc, ou ≤3 arquivos e <100 linhas | **3** — uma lente, documentação, um framework |
| **Padrão** | até ~10 arquivos / ~500 linhas | **5 a 6** |
| **Profundo** | acima disso, **ou** qualquer gatilho abaixo | **8 a 12**, mais refutação separada dos bloqueantes |

**Gatilhos que forçam Profundo, independente do tamanho** — é onde contrato perdido custa
caro: migração, `schema.json`, `manifesto.json`, permissões, contas, auditoria.

**Ortogonal ao nível:** tela tocada liga o S3 sempre, inclusive no Leve.

O orçamento é **combinado** entre a camada adversarial (passo 3) e a de contratos (passo 4) —
não é uma faixa para cada. Ler as duas faixas como independentes já produziu 9 agentes num PR
de 4 arquivos, com três deles achando exatamente o mesmo defeito.

**Anuncie a decisão em uma linha e siga** — não pare para perguntar. O usuário lê o anúncio em
segundos e os agentes levam minutos: se discordar, ele interrompe, e isso é grátis.

```
Revisando o PR #<n> (rodada <N>). <N> arquivos, +<x>/−<y>, <áreas>.
Esforço <nível>: <N> lentes, motor <Codex|nativo — motivo>. Início <timestamp>.
```

**Override explícito manda mais que o diagnóstico:** se o usuário pedir `completo` ou
`simples` junto do número do PR, use o que ele pediu e diga no anúncio que foi ele quem
escolheu.

## 2.2 Motor da fan-out — mora fora desta skill

Leia **`.claude/motor-revisao.md`** deste repositório, por inteiro. Ele traz o preflight do Codex, o
fallback nativo, os tiers por papel, a regra da árvore que o motor lê, o que todo briefing carrega e
as invariantes de falha. **Não achou, PARE e diga** — improvisar o motor de memória é como se perde
a guarda contra falha virar laudo limpo.

> **ADAPTADO.** O upstream avisava que "numa sessão de app o `.claude/` pode não estar na árvore que
> você tem aberta". Aqui está: skill e motor moram no mesmo repositório que está sendo revisado.

### O que esta skill informa ao motor

- **Superfície de docs do briefing de contratos:** `node_modules/@urbiverso/sdk/docs/`, lido
  **por inteiro**. Ver *Superfície de leitura*, no topo — e a nota de que neste ambiente ela
  costuma **não existir**.
- **Faixas que sobem para `gpt-5.6-sol` no Profundo:** migração, `schema.json`,
  `manifesto.json`, permissões, contas, auditoria.
- **`BASE`** é o merge-base calculado no passo 2 (nunca o nome da branch) e **`WT`** é a árvore
  que as lentes leem.
- **ADAPTADO — a proibição do briefing é mais larga aqui.** No upstream era *"não ler o repositório
  do shell"*. Aqui é: *"não ler, não abrir, não fazer `grep` e **não escrever** em
  `/home/user/urbiverso`"* — porque o monorepo está nesta máquina e é gravável, o que o upstream não
  precisava supor.

### A árvore do motor e os docs do SDK

**O motor lê UMA árvore só, e os docs da plataforma podem não estar nela.** Resolva antes de
despachar:

- **Com o bundle na árvore** — o briefing aponta para `node_modules/@urbiverso/sdk/docs/`. Worktree
  novo **não** tem `node_modules` (ele não é compartilhado): ou instale na árvore, ou use a árvore
  da sessão com a branch do PR checada. Instalar é preferível — a versão do SDK que o lockfile do PR
  resolve é parte do que se está revisando.
- **Sem o bundle — que é o caso normal deste repositório** — não despache lente de contrato nenhuma.
  Elas entram no relatório como **não executadas, com o motivo**, e o resumo curto da §7 diz isso em
  uma linha. **Não substitua por cópia de `docs/shell/` nem por memória.**

> **ADAPTADO — o bloco `.docs-shell` do upstream foi removido.** Ele mandava copiar
> `docs/shell/*.md` do monorepo para dentro da árvore quando a app fosse *bundled*. Esta app nunca é
> bundled, e copiar doc do monorepo para dentro desta árvore é exatamente o que a proibição do
> `CLAUDE.md` veda. Não recrie o bloco.

> ⚠️ **E o risco que essa ausência cria: a linha "contratos não executados" vira papel de parede.**
> Aqui ela vai aparecer em **100%** das revisões, e o que aparece sempre para de ser lido — aí
> "revisão limpa" passa a ser lido como "contratos conferidos", que é falso. Duas defesas, use as
> duas: `contratos=nao-executados` no comentário de máquina da §7 (greppável, contável), e o
> relatório dizendo **o que exatamente ficou descoberto** — props de primitivo `urbi-*`, verbos do
> SDK, e a aderência de `shell_min`/`sdk_min` ao que está publicado.

Lente de contrato que não achou o doc é **não executada**, nunca aprovada.

## 3. Corpo da revisão — adversarial, delegada

Delegue com escopo delimitado. **Escolha as lentes e os temas pelo escopo do PR, pelo corpo
dele e pelos arquivos tocados** — não rode o catálogo inteiro. O número de agentes sai do
orçamento **combinado** que você fixou no passo 2.1, dividido entre esta camada e a do passo 4.
Todos em paralelo, numa mensagem só.

### Lentes — como olhar. Escolha 2 a 4

- **L1 · Varredura linha a linha.** Cada hunk, e a função inteira em volta: bug em linha não
  tocada de função tocada está no escopo, porque o PR reexpõe ou deixa de consertar. Condição
  invertida, off-by-one, `await` faltando, zero falsy, erro engolido no catch, variável errada
  por copiar-colar. **"Função tocada" é função com pelo menos uma linha dentro de um hunk deste
  diff** — não é "qualquer função do arquivo tocado". Sem esse corte a lente varre o arquivo
  inteiro e devolve achado sobre código que o PR não encostou, que a §11 proíbe; já aconteceu.
- **L2 · Auditor de comportamento removido.** Para cada linha que o diff **apaga** ou
  substitui, nomeie a invariante que ela sustentava e procure onde ela foi restabelecida. Não
  achou, é candidato: guarda removida, caminho de erro descartado, validação estreitada, teste
  apagado que cobria caso real.
- **L3 · Rastreador entre arquivos.** Para cada função alterada, ache os chamadores e veja se
  a mudança quebra algum: pré-condição nova, formato de retorno diferente, exceção nova,
  dependência de ordem. Confira também os chamados.
- **L4 · Concorrência e ordem de escrita.** Corrida entre a leitura que decide e a escrita que
  grava, transação faltando, idempotência, dois requests simultâneos, ordem de commit.
- **L5 · Armadilha de linguagem e plataforma.** `==`, closure capturando variável de laço,
  fuso e horário de verão, igualdade de float, SQL montado por concatenação.

### Temas de domínio — o que saber. Escolha 1 a 3

- **T1 · Segurança e permissões.** Superfície de rota, auth e autorização, vazamento entre
  contas, dado atravessando fronteira de segregação.
- **T2 · Dados e persistência.** `schema.json`, migração, integridade referencial,
  soft-delete, paginação.
- **T3 · Compatibilidade e regressão.** O que acontece na instância que **já tem a app
  instalada** e vai atualizar: contrato de API mudando, piso de versão declarado, dado legado.
- **T4 · Testes.** O que o PR entrega e nenhum teste cobre; teste que testa outra coisa (grep
  de fonte em vez de comportamento).
- **T5 · Limpeza.** Reúso do que já existe, complexidade desnecessária, altitude do conserto —
  remendo especial empilhado sobre infra compartilhada em vez de generalizar o mecanismo. Um
  agente só, cobrindo tudo.

### Sempre ligados

- **S1 · Documentação.** Doc no mesmo PR; doc que ficou errado por causa deste PR.
- **S2 · Afirmação não sustentada.** Frase do corpo do PR ou de comentário no código que o
  código não sustenta. É o achado mais recorrente: *"os ÚNICOS escritores"* (eram quatro),
  *"a fresta fecha sozinha"* (só estreitava), *"o engine não é transacional"* (era).
- **S3 · UI — sempre que o PR altera tela.** Instruções próprias abaixo.

### S3 · O agente de UI

Mande-o ler, no doc de UI do bundle do SDK, as seções `## O que nunca fazer`, `### Sinais de
que você está violando este capítulo`, `## Princípios` e `## Contratos do framework`. Para
saber o que existe **hoje**, mande-o abrir o catálogo de componentes do bundle — o catálogo
evolui, e esta skill não lista componente nenhum de propósito.

Dois eixos:

1. **Primitivos e padrões.** A tela usa os componentes do catálogo, ou remonta na mão o que já
   existe pronto?
2. **Tela longa com seções encadeadas.** O caso concreto: a seção 1 tem uma tabela enorme e a
   seção 2 aparece **abaixo** dela — o usuário tem que rolar a tabela inteira para *descobrir*
   que existia algo depois. É defeito de UX, não preferência estética. O desfecho é um
   primitivo de layout que ponha as seções lado a lado no eixo de navegação em vez de
   empilhá-las (o catálogo diz quais existem agora).

## 4. Camada de contratos por framework

Rode **junto** com os agentes do passo 3, no mesmo lote paralelo.

Elenque os frameworks da plataforma **tocados pelo PR ou relacionados a ele**, dentro do
orçamento combinado do passo 2.1. Não é "que arquivos mudaram" — é "que contratos esta
mudança passa a depender". Uma rota nova de app pode tocar permissões, contas, auditoria e
barramento ao mesmo tempo sem que nenhum desses assuntos apareça no diff.

**Quando o orçamento apertar, corte da camada adversarial antes de cortar desta.** Os agentes
adversariais ficam presos aos arquivos do diff; os de framework leem o doc inteiro e seguem o
fluxo irmão para fora dele. O achado que ninguém mais pega costuma vir daqui.

Uma lente por framework, no tier que a tabela do motor manda, cada uma com estas instruções:

- Leia o doc do framework **por inteiro**, na versão exposta pelo SDK. Não pule seção, não
  faça busca por palavra-chave. O doc é a fonte de verdade; a implementação é a suspeita.
- Extraia de `## Contratos do framework` e `## Funcionamento do framework` cada regra como uma
  **asserção verificável**, e **liste-as antes** de olhar qualquer código. Isso é o que impede
  o agente de apenas concordar com o que o PR afirma.
- Só então leia o diff e o código em volta, e confronte asserção por asserção.
- Classifique cada conflito:
  - **(a)** o diff **viola** um contrato → defeito, o código da app tem que mudar;
  - **(b)** o doc da **app** ficou errado por causa desta mudança → o doc muda **neste** PR;
  - **(c)** o contrato é **ambíguo, silencioso, ou não está exposto no SDK** → dívida de
    superfície; formule a pergunta que o doc não responde e deixe-a pronta no relatório, para o
    autor levar ao shell.

Numa app, a classe **(a)** é a que manda: o contrato da plataforma não é negociável daqui. O
que este PR não pode fazer é mudar o contrato — se parece que precisa, o desfecho é **(c)**.

## 5. Convenções que a revisão sempre confere

Estas falham em silêncio e por isso quase nunca aparecem sozinhas. **ADAPTADO:** a lista do upstream
foi trocada pela deste repositório — as convenções da plataforma que sobrevivem estão aqui, mais as
que só existem neste repo, e **menos** a regra da `versao`, que diverge (ver o box no fim).

**Da plataforma**

- **`Closes #123` em inglês.** `Fecha #123` não fecha nada — o PR mergeia, a issue fica aberta e
  ninguém percebe. A keyword **repete por issue** (`Closes #1, closes #2` — `Closes #1, #2` fecha só
  a primeira), vale só no corpo do PR ou na mensagem de commit, **nunca no título**, e **nunca em
  intervalo** (`Closes #273-276` fecha zero). Para citar sem fechar, o corpo declara
  `Sem-fechamento: #NNN <motivo>` — é o que o guard `issue-fechamento` cobra.
- **UI e API andam juntas.** Capacidade na API sem controle correspondente na tela é feature
  invisível. Se não merece UI, não deve existir na API.
- **Doc no mesmo PR.** Mudou o comportamento → mudou `docs/viabilidade/*.md`.
- **Telas usam os primitivos `urbi-*`** — e **só as props que eles declaram**. Atributo inexistente
  não dá erro: ele simplesmente não faz nada. Ver S3.
- **Permissão usa `nivelApp`/`rolesApp`**, nunca `usuario.tipo`.
- **Natureza (`humano`/`openclaw`) nunca segrega.** Regra que ramifica por natureza está no eixo
  errado — o certo é `tipo`, permissão ou credencial.
- **Nada de SQL manual como solução.** Correção de dados entra por migração, endpoint/UI de admin ou
  código versionado.

**Deste repositório** (todas em `CLAUDE.md`, e todas já pagas ao menos uma vez)

- **Aspas curvas em posição de atributo.** `variante=”alerta”` deixa o atributo **inerte** e
  atravessa typecheck, testes e esbuild em verde. Aspas curvas em conteúdo de texto são tipografia
  legítima e não são achado.
- **`schema.json` e `manifesto.json` são JSON estrito.** Comentário `//` reprova o pacote na
  instalação, antes de olhar qualquer tabela.
- **Migração de app transforma dado, nunca schema**, e **seed fica fora de migração**.
- **Retorno declarativo de migração (`remover_colunas`/`remover_tabelas`) é achado** — vira gate da
  plataforma em 2026-08-23; o fluxo canônico usa `dados.limparColuna` e `dados.varrerTudo`.
- **Precisão.** R$ e m² → `decimal(12,2)`; % digitado → inteiro; % calculado → `decimal(5,1)`. **Todo
  valor monetário resultado de fórmula tem 2 casas decimais.** Representações derivadas não
  monetárias (% e R$/m²) carregam precisão plena internamente e arredondam **só para exibir**.
- **Tokens CSS do design system, nunca cor literal** — com **uma exceção real**: o CSS dos
  documentos de impressão em `frontend/exportar.ts` roda em janela própria, onde `var(--cor-*)` não
  resolve. Acusar isso é falso positivo.
- **Todo job de CI declara `timeout-minutes`; todo `node --test` declara `--test-timeout`.** Sem o
  primeiro, o default do GitHub é 6 horas e o job pendura em vez de ficar vermelho.
- **O glob de teste precisa dos dois padrões** (`frontend/*.test.ts frontend/fixtures/*.test.ts`) —
  o primeiro sozinho não alcança subdiretório, e teste que não roda é pior que teste que não existe.

> ⚠️ **ADAPTADO — a regra da `versao`, e ela é o oposto da do upstream.**
>
> O upstream manda a `versao` do `manifesto.json` avançar "em todo release que altera `schema.json`,
> traz migração **ou mexe em `shell_min`/`sdk_min`**". **Neste repositório isso está errado**, e a
> regra vigente é a do `CLAUDE.md`:
>
> - **`z` só bumpa quando há migração nova.** A `versao` descreve o **schema**, não o código.
> - **Subir `shell_min`/`sdk_min` NÃO bumpa a `versao`** — decisão da issue #422: "o piso existe
>   para ser honesto, e nada de schema mudou".
> - Mudança só de frontend/backend **mantém** a versão. Release de código se distribui pela tag com
>   sha (`viabilidade-v<x.y.z>_<sha8>`), não por degrau de versão vazio.
>
> O guard de `versao` do `validar-backend.sh` barra os **dois** erros simétricos: migração nova sem
> bump, e bump sem migração nova. **Portanto: acusar "faltou bumpar a versão" num PR que só sobe o
> piso é achado inventado** — e seria um achado recorrente, em todo PR de piso, se esta nota não
> existisse. Não "corrija" este box de volta para o texto do upstream.

## 6. Regras especiais

### Migrações de app: só dado, nunca schema

O schema de uma app é **declarado no `schema.json`** e construído na forma final pelo
sincronizador. As migrações de app são incrementais e sequenciais, **mas nunca rodam em
instalação nova** — numa instância virgem o sincronizador cria o schema a partir do
`schema.json` e o motor faz baseline, pulando todas elas.

Daí a regra: **migração de app migra dado, jamais schema.** DDL numa migração de app produz
uma instância nova estruturalmente **diferente** de uma instância atualizada — divergência
silenciosa que só aparece muito depois.

Consequência para a revisão: **DDL em migração de app é achado bloqueante.** O desfecho não é
"reescreva a migração" — é **ampliar o vocabulário do `schema.json` e a capacidade do
sincronizador**, do lado da plataforma, e o PR espera essa mudança. **ADAPTADO:** essa mudança vira
texto pronto no relatório, para o autor levar ao shell; você não abre a issue (ver a nota da
*Superfície de leitura*). Diga isso no relatório com todas
as letras, inclusive que o vocabulário vem sendo enriquecido e que esses casos tendem a ficar
mais raros.

O mesmo raciocínio pega uma variante calada: **`indices` e `unicos` declarados numa tabela que
já existe nunca nascem** — só saem no `CREATE TABLE`. Numa instalação nova aparecem; numa
atualizada, não. É a mesma divergência, pela porta declarativa.

### Conflito em script de migração

Quase sempre significa **duas sessões trabalhando em paralelo sobre o mesmo baseline**. A
solução **não** é resolver conflito entre dois arquivos de mesmo nome: é **re-encadear**. Quem
chegou depois renomeia o próprio script para partir da ponta da corrente já mergeada por quem
chegou antes.

Enquadre como conflito de merge a re-encadear, com severidade de conflito normal. **Não**
classifique como violação de imutabilidade — migrações são imutáveis, e é justamente por isso
que a saída é renomear a nova, nunca editar a que já rodou. Dois comandos decidem, antes de
qualquer leitura de conteúdo:

```bash
git show <merge-base>:<caminho-da-migracao> >/dev/null 2>&1 && echo EXISTIA || echo NOVO
git diff <merge-base> <head> -- <caminho-da-migracao>
```

**NOVO** com arquivo de mesmo nome na branch principal = colisão de numeração: re-encadear,
análise encerrada. **EXISTIA e só comentário mudou** = nada a reportar. **EXISTIA e o corpo
mudou** = só aqui vale análise, e aí sim é sério.

### Provar achado executando código

Módulos que só usam `import type` (o tipo some no runtime) rodam direto no Node com
`node --experimental-strip-types`, a partir de um driver descartável no scratchpad. Serve para
**provar** um achado em vez de argumentar.

**Armadilha já paga:** se você chama a função de baixo direto, pula a porta de validação que
na vida real roda antes dela — e a "prova" não prova nada. Reproduza sempre pelo ponto de
entrada real.

### O que você não conseguiu executar, você declara

Suíte com casos pulados em silêncio relata `0 fail` igual a uma que rodou tudo, e CI verde não
quer dizer testado. Quando não der para rodar, escreva a frase honesta e **atribua o número a
quem mediu**: *"esse arquivo sai `skipped` nesta máquina; a execução verde é relato do autor,
não medição minha"*. Herdar número alheio em silêncio é o mesmo laudo limpo falso que o motor
combate na lente não executada.

## 7. Entrega

**O relatório completo é um comentário no PR, sempre** — inclusive quando não houver nenhum
achado, porque o comentário é o registro de que a revisão rodou e do que foi confrontado.
**A sessão recebe só o resumo curto**, mais abaixo.

Estrutura do comentário:

- **ADAPTADO — primeiro, uma linha legível por máquina**, invisível para quem lê, no topo do corpo:

  ```
  <!-- revisao-viabilidade rodada=N head=<sha8> motor=codex|nativo bloqueantes=<n> contratos=ok|nao-executados -->
  ```

  É o que o job `revisao-registrada` do CI procura para saber que **houve revisão neste head**, e
  o que torna `contratos=nao-executados` contável em vez de uma frase que ninguém lê. Ela vai no
  **comentário**, nunca na descrição do PR — a API remove HTML da descrição, e a linha some sem
  erro. Só isto sobreviveu do protocolo de duas sessões que este repo tinha antes; o resto
  (máquina de estados, teto de rodadas, papéis) morreu com ele.
- Uma linha de cabeçalho humana: `Revisão de app — rodada <N> · head <sha curto> · motor <Codex|nativo>`.
  É por ela que a rodada seguinte se localiza, e o `<sha>` é o que você **de fato** revisou.
- **Qual superfície de leitura foi usada**, logo no começo: bundle do SDK instalado (**com a
  versão**, e se ela é a mais nova publicada) ou **nenhuma** — e então **quais** lentes de contrato
  não rodaram e **o que ficou descoberto**. Quem lê precisa saber contra qual contrato o "passou"
  foi conferido: um achado ausente pode significar "não existe" ou "não havia contrato para ler".
  **ADAPTADO:** neste repositório o caso normal é "nenhuma"; e quando o motor for nativo, diga
  também, em uma linha, que revisão nativa de patch escrito pela mesma família de modelo é **menos
  adversarial**.
- Achados ordenados do mais grave para o mais leve, em **três blocos distintos** — **ADAPTADO:**
  o upstream tem dois, e o terceiro foi salvo da geração anterior deste repo, porque a §9 depende
  do conceito e não o previa como bloco:
  1. **Bloqueante** — segura o ciclo. Consertar, ou derrubar com evidência.
  2. **Observação** — não segura o ciclo.
  3. **Decisão de desenho** — não é defeito nem opinião: é escolha que **não cabe a você nem a
     quem escreveu o código**. Encerra o ciclo e devolve ao autor com a **pergunta formulada**,
     não com um veredito.
- Cada um com `arquivo:linha`, a citação **literal** do contrato ou da regra, e — opcional —
  o desfecho proposto. Contrato parafraseado não serve: quem lê precisa comparar as duas
  coisas sem reabrir o doc.
- A partir da rodada 2, **o placar dos achados anteriores**: consertado, ainda aberto, ou
  **retirado** (com o motivo). É o que sustenta o critério de conclusão da § 9.
- No fim, o que foi confrontado e passou — **no máximo 10 itens, uma linha cada**. É registro
  do que a revisão cobriu, não um segundo relatório.
- **Um quadro de execução, obrigatório**, fechando o comentário: uma linha por lente, com
  motor, tier, esforço, duração e veredito.

  | Lente | Motor | Tier | Esforço | Duração | Veredito |
  |---|---|---|---|---|---|
  | L2 · comportamento removido | Codex | `gpt-5.6-terra` | medium | 2m10s | 0 achados |
  | contratos · permissoes | Codex | `gpt-5.6-sol` | low | 3m02s | 1 achado |
  | S3 · UI | Codex | `gpt-5.6-terra` | medium | — | **não executada** (timeout) |

  **Lente não executada aparece nesse quadro com o motivo** — motor indisponível, tempo
  estourado, saída inválida. Sumir do relatório é pior que aparecer como falha: quem lê presume
  cobertura que não houve.

Nunca use "approve" nem "request changes" do GitHub — comentário normal.

Rodapé obrigatório:

```
---
_Generated by [Claude Code](https://claude.ai/code)_
```

### A saída na sessão é curta — e é só isso

O relatório é o comentário. Na sessão vai **uma lista de achados por severidade, uma frase
curta cada**, e nada mais:

```
PR #<n> · rodada <N> · <link do comentário>

Bloqueantes (2)
1. migracoes/003.sql:12 — DDL em migração de app; instância nova nasce diferente.
2. manifesto.json:4 — `sdk_min` acima da maior versão publicada do SDK.

Observações (3)
1. ...

10/11 lentes (S3 não executada: timeout). Detalhe qualquer achado se quiser.
```

**Não repita o relatório na sessão.** Nada de citação literal, quadro de execução, raciocínio
ou lista do que passou — tudo isso está no PR, e quem quiser detalhe pede. Rodada limpa é uma
linha: `PR #<n> · rodada <N> · sem bloqueantes · <link>`.

Quando a triagem para:

```
Parado. O PR já tem revisão de <data> sem resposta e sem commits depois (<link>).
Revisar de novo só com pedido expresso.
```

## 8. Rodada seguinte — depois do conserto

A revisão não acaba no primeiro relatório: **cada conserto reabre a revisão**, e o ciclo só
fecha pela § 9. Quem consertou pode ser o usuário, outra sessão, ou esta mesma sessão fora
desta skill — para a rodada, tanto faz: o que existe é commit novo sobre um PR que já tem
relatório.

> 🛑 **TETO DE DUAS RODADAS — regra R2 do `CLAUDE.md` § Processo obrigatório.**
>
> A partir da rodada 3, a revisão **só reabre se houver bloqueante de código**. Observação sobre
> **documentação, texto ou processo** vira **issue**, com o achado transcrito, e o ciclo fecha.
>
> **Isto é uma condição executável, não um conselho** — e esta seção precisa carregá-la porque **a
> skill é o procedimento**: o `CLAUDE.md` institui o teto, mas quem executa lê aqui. Achado do Codex
> no PR 496, e ele estava certo: sem esta linha, a §8 mandava reabrir a cada conserto e continuava
> exatamente o ciclo documental que o teto existe para encerrar.
>
> **A conta do teto é de rodadas, não de achados.** Rodada 3 com bloqueante de código é legítima, e
> a 4 também — o que o teto barra é a rodada que existe só para conferir um ajuste de texto.
>
> **Por que o teto, com o caso medido:** o PR 494 acumulou rodada após rodada, **nenhum achado
> falso**, e mesmo assim o ciclo não fechava — porque cada conserto de documentação envelhecia a
> descrição vizinha e gerava o achado seguinte. O teto é o que impede o decaimento de esforço de
> virar assíntota.

Os passos 1 a 7 valem inteiros em toda rodada. O que muda é a calibragem — **o padrão é
decair**, e rodada 2 rodando a skill inteira por reflexo é o modo caro de errar:

| Delta desde a rodada anterior | Ação |
|---|---|
| Escopado aos achados, fora dos caminhos de runtime que a rodada anterior confrontou | fan-out **reduzida ao delta** — uma lente sobre o que mudou. A revisão do App **nunca decai** |
| Toca caminho que a rodada anterior confrontou-e-passou | fan-out reduzido: as lentes daquele caminho, mais S2 |
| Mudança estrutural, ou mexeu em SDK, lockfile ou `sdk_min` | skill inteira, esforço recalibrado e **superfície reconferida** |

Anuncie a escolha e o motivo em uma linha, como no passo 2.1, e repita o motivo no relatório —
inclusive quando não houve fan-out: o **quadro de execução da § 7 continua obrigatório**, ainda
que com uma linha só. Rodada sem quadro lê-se como rodada sem registro.

### O histórico entre rodadas não se reescreve

> **ADAPTADO — regra salva da geração anterior**, que a reescrita do upstream deixou cair. Ela
> valia para o modelo de duas sessões, mas **não era dele**: vale para qualquer revisão em rodadas.

**Ninguém reescreve histórico enquanto o ciclo está aberto — sem `--force`, sem rebase, sem squash
intermediário, sem amend de commit já empurrado.** Toda a §8 acima raciocina por **delta desde a
rodada anterior**, e o delta é calculado por SHA: reescrever apaga o chão em que o revisor pisou. O
placar dos achados anteriores passa a apontar para commits que não existem mais, e o decaimento de
esforço — que é o que impede o ciclo de ficar caro — vira decaimento sobre nada.

Precisa incorporar a `main`? **Mergeie para dentro** (`git merge origin/main`), que preserva os SHAs
já revisados. Numa branch que só você tem e **antes** de abrir o ciclo, a convenção do repositório
vale normalmente — o que a regra protege é a janela entre a primeira rodada e o encerramento.

O mesmo motivo sustenta a outra metade: **não empurre com uma rodada em voo.** O revisor releu o
HEAD para postar; se ele se move no meio, o relatório nasce falando de código que já não está lá.

### Releia o HEAD imediatamente antes de postar

Já aconteceu: relatório publicado sobre um HEAD que tinha acabado de mover, com o único achado
já corrigido. Moveu desde o início da rodada → **descarte o relatório e recomece** contra o HEAD
novo.

### PR que toca vários documentos: releia TODOS contra o estado final

**ADAPTADO — 2026-08-23, lição do PR 494.** Quando o PR toca mais de um documento e eles descrevem
uns aos outros, **cada conserto envelhece a descrição vizinha** — e o envelhecimento acontece
*dentro do próprio PR*, depois que você já revisou aquele arquivo.

Não é hipótese: no PR 494, rodada após rodada, o Codex achou **a mesma classe** de defeito, sempre
criada pelo conserto da rodada anterior. A guarda foi consertada no `SKILL.md` → o `CLAUDE.md` ficou
sem a instrução → consertado o `CLAUDE.md` → o `PROGRESSO.md` passou a descrever a guarda
**rejeitada** como vigente → consertado o `PROGRESSO.md`, o `LEIA-PRIMEIRO.md` seguia mandando caçar
uma chave desnecessária. Cada uma passaria por "documentação, risco baixo".

E o fecho da cadeia é a própria lição: o que a sustentava era um **contador** — quantas rodadas,
quantos achados — escrito dentro dos documentos que a revisão estava revisando. Ele envelhecia a
cada rodada por construção. A classe só fechou quando o contador saiu, não quando foi sincronizado
pela enésima vez. **Descrição que depende do estado corrente da revisão não entra no artefato
revisado** — é a mesma armadilha da frase que cita o resultado de um `grep` que o próprio commit
muda.

Então, antes de postar o relatório de **qualquer** rodada num PR que toca 2+ documentos:

1. Liste os documentos que o diff toca.
2. Para cada um, releia-o **inteiro contra o estado final do diff** — não contra o que ele dizia
   quando a rodada começou.
3. Pergunte de cada afirmação: *isto ainda é verdade depois dos consertos desta rodada?* Em especial
   toda frase que descreve **como algo funciona** ou **qual foi a decisão** — são as que envelhecem.
4. Confira também os documentos que o diff **não** toca mas que descrevem o que ele mudou. Doc de
   ponto de entrada (`LEIA-PRIMEIRO`, `PROGRESSO.md`, `CLAUDE.md`) é o caso perigoso: quem chega
   depois lê **ele**, não o diff.

Um documento que descreve a tentativa descartada é pior que um documento omisso: ele **manda a
próxima sessão refazer o caminho errado**, e com a autoridade de estar escrito.

### A independência se perde — recompre-a

Sua sessão tem memória, e memória ancora: a tendência é conferir "os meus achados saíram?" e
parar. **O defeito da rodada N costuma ser filho do conserto da rodada N−1.** Pior ainda quando
a mesma sessão consertou: aí ela revisa o próprio patch.

Duas consequências, e as duas são obrigatórias:

1. A rodada começa pelo lado **adversarial do conserto**, não pela conferência dele: os commits
   novos entram como código fresco, olhados por lentes **novas**, que não viram a rodada
   anterior.
2. **Releia o que você mesmo declarou "confrontado e passou"** na rodada anterior, se o conserto
   encostou naquilo. É a lista de coisas que ninguém mais vai checar.

### Contestação é conferida, não descontada

Quando alguém contesta um achado com evidência — comentário no PR, ou a própria sessão ao
consertar —, **abra o arquivo e confira**. Achado seu que morre na contestação é desfecho
certo: registre "**achado retirado**", com o motivo, no relatório da rodada, e ele sai da
conta de bloqueantes pendentes. Insistir num achado já derrubado queima rodada.

## 9. Conclusão do ciclo — e merge só se autorizado

**O critério é um só: nenhum bloqueante pendente.** Pendente é o bloqueante que não foi
consertado nem retirado. Observação não segura ciclo; ela vira registro no PR e o usuário
decide. Zerou, diga na sessão em uma linha que o PR está pronto e **pare**.

O ciclo também termina, antes disso, em dois casos — e nos dois você **diz qual é a pergunta**
que o usuário precisa responder, em vez de deixar "aguardando decisão" solto:

- **Decisão de desenho:** o conserto mexeria em algo que o usuário decidiu. Use com parcimônia
  — usado à toa, vira jeito de terceirizar julgamento que era seu.
- **Achado que não converge:** a mesma faixa volta rodada após rodada. Pare, diga o que está
  girando e devolva ao usuário. Numa app isso inclui o caso em que o desfecho depende de issue
  no shell: o PR não fecha sozinho, e insistir só gasta rodada.

### Merge

**Só com autorização expressa nesta chamada.** "Pode mergear no final", "se ficar limpo,
mergeia" autorizam. **Não** autorizam: silêncio, "toca até o fim", "resolve isso pra mim",
autorização dada em tarefa anterior, ou o fato de a própria revisão ter ficado limpa. **Na
dúvida, não está autorizado** — e não peça a autorização agora nem sugira que o usuário
autorize: encerre com o PR pronto e parado, que é o desfecho normal.

Com autorização, confira o portão item por item antes de mergear:

- zero bloqueantes pendentes e nenhuma decisão de desenho aberta;
- **o histórico não foi reescrito durante o ciclo** (§8) — se foi, o placar das rodadas anteriores
  não vale, e a revisão recomeça do zero em vez de mergear;
- **CI verde no SHA final, lido pela API** — não no SHA que você revisou, se ele mudou;
- suíte executada com os pulados declarados (§ 6);
- `Closes #<n>` **em inglês** no corpo do PR, repetido por issue e na forma completa quando a
  issue é de outro repositório;
- doc da app no mesmo PR, quando o comportamento mudou;
- **ADAPTADO — `versao` do `manifesto.json` coerente com a regra DESTE repo** (§ 5): bumpou **se e
  só se** há migração nova. PR que só sobe `shell_min`/`sdk_min`, ou que só mexe em
  frontend/backend, **mantém** a versão — cobrar bump ali é barrar por achado inventado;
- **ADAPTADO — os itens de validação do `CLAUDE.md` § Merge**, que o upstream não tem:
  `scripts/validar-frontend.sh` verde; `scripts/validar-backend.sh` verde **se** o PR tocou
  backend, `schema.json` ou migração; diff **não vazio**; migração numerada contra a `main` do
  momento; pré-requisitos já na `main`.
  > ⚠️ E o que fazer quando um desses não puder rodar aqui — `validar-backend.sh` aborta no portão
  > do SDK neste ambiente: **declare "não executado" com o motivo e não mergeie por conta própria**.
  > "Não deu para rodar" nunca é "passou"; é item do portão falhando, e o desfecho é devolver ao
  > autor, que tem o ambiente autenticado.

Qualquer item falhando, **não mergeie** — encerre e diga qual item barrou. Depois de mergear,
**confira que a issue realmente fechou**: `Fecha #123` não fecha nada, `Closes #1, #2` fecha só
a #1, e keyword no título não vale. Não fechou, feche na mão e registre o motivo.

## 10. Proibições

- **Sem commit, sem push, sem abrir PR, sem empurrar correção** por dentro desta skill.
- **Sem merge sem autorização expressa** (§ 9). Revisão limpa não é autorização.
- **Proibido tocar qualquer rota de API de qualquer instância** — produção, homologação,
  desenvolvimento local, qualquer uma. Nem para diagnóstico, nem para caso negativo de teste,
  nem "só um GET". **O revisor trabalha sobre superfície fria: código e documentação.**
  Instância quente é assunto da skill `qa`. Essa proibição vai cravada no briefing de **cada**
  agente — agente com shell e rede acha natural "testar o endpoint", e nenhum arquivo de
  convenção do repositório viaja no prompt dele.
- **ADAPTADO — `urbiverso/urbiverso` é só leitura, e nem isso durante a revisão.** O monorepo
  está clonado nesta máquina, em `/home/user/urbiverso`, e é **gravável** — o upstream podia
  supor que não estava; aqui não dá. Então, nesta ordem de dureza:
  - **proibido escrever nele em qualquer hipótese** — editar arquivo, commitar, fazer push,
    abrir issue ou PR. Não existe autorização de sessão que destrave isso;
  - **proibido lê-lo como superfície de revisão**, ou para compensar a falta do bundle do SDK.
    Contrato ausente do bundle **já é o achado**.

  Consulta de referência pelo autor, fora de uma revisão, continua legítima — é para isso que ele
  está aqui. Ver `CLAUDE.md` § "O monorepo `urbiverso/urbiverso` é só leitura".
- **Sem `AskUserQuestion`** — bugada nesta instalação; pergunta vai em texto corrido.
- **Sem editar, esconder ou resolver comentário de outra sessão.** O histórico é o registro.
- A branch principal é só para puxar. Se precisar de árvore própria, use worktree — nunca duas
  sessões na mesma árvore de trabalho.

## 11. Operação


Roda no modelo atual da sessão. **Delegue tudo que der** — o contexto do orquestrador é o
recurso escasso.

**A fan-out inteira vai para o motor do passo 2.2**, no tier que a tabela de lá manda. Subagente
nativo fora do fallback só entra por exceção sua: uma refutação de bloqueante com outra cabeça.

**Limite rígido de 350 a 450 palavras por agente.** Só achados; o que passou vira **uma**
linha no fim. Sem esse limite o contexto do orquestrador estoura antes do relatório.

Todo agente devolve **evidência, não veredito**: `arquivo:linha`, citação literal, e o
raciocínio que liga uma coisa à outra. Nada de estilo, preferência, ou código que o diff não
toca. **Agentes não postam.** Você recebe os relatórios, deduplica e escreve o comentário.

**Todo achado bloqueante é verificado por você antes de reportar.** Se for útil, peça
refutação a um agente novo — mas isso é opção sua, caso a caso. Agentes já se contradisseram
entre si, e achado próprio já morreu na verificação — que é o desfecho certo, não vergonha.

**Toda citação que sustenta um bloqueante é reconferida por você, no arquivo, abrindo a linha.**
Verificar o achado e verificar a citação são coisas diferentes, e a segunda não sai de graça
com a primeira: um agente já apontou `arquivo:339` para uma frase que estava em OUTRO arquivo,
na mesma linha. Confira o caminho, o número e o texto — se a citação não bate, o achado volta
para investigação antes de virar bloqueante, mesmo que o raciocínio pareça de pé.
