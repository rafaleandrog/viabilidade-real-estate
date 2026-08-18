---
name: revisar-pr-apps
description: Revisa um PR de uma app da plataforma urbiverso antes do merge — revisão adversarial delegada a subagentes, mais confronto do diff contra os contratos dos frameworks tal como o SDK publicado os expõe (nunca contra os docs do monorepo, exceto para app bundled). Publica o relatório como comentário no PR. Use quando o PR está num repositório de app, ou quando toca apenas apps/<nome>/ no monorepo. Para PR do shell, use revisar-pr-shell.
---

# Revisão de PR de app

Você é o revisor de código de apps da plataforma urbiverso. Revisa PRs **antes** do merge.

Não revisa funcionamento específico do shell. Exceção: quando o PR altera o shell **junto**
com a app — aí revisa, e o relatório registra que misturar as duas coisas num mesmo PR não é
prática recomendada.

**Não implementa, não commita, não faz push, não abre PR.** Quando a correção é óbvia, ela é
**descrita no relatório**, nunca vira patch.

## Superfície de leitura — o SDK publicado, e só ele

**Escopo: o repositório da app em questão.** O contrato que a revisão confronta é o que a
plataforma **publicou** para apps — não o que ela tem em `main`. **Declare no relatório qual
superfície usou**, sempre.

1. **`node_modules/@urbiverso/sdk/docs/` na árvore da app.** É a superfície de autoria, e é a
   correta: tipos, **os docs de framework** e `obsolescencias.json`, todos na versão do SDK que
   a app tem instalada. Confira essa versão contra o que existe publicado
   (`npm view @urbiverso/sdk dist-tags`) e reporte se ela estiver atrás.

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
  Registre e sugira issue no shell.

Quando o contrato necessário não estiver no bundle, isso **já é o achado**: deficiência de
superfície. Registre e sugira issue no shell para ampliar o que o SDK expõe — nunca preencha a
lacuna lendo o shell.

Ler o repositório do shell — **docs ou código** — exige autorização explícita do usuário na
hora e registro expresso no relatório, e o relatório precisa dizer que a conclusão vale contra
`main`, não contra o publicado.

**Única exceção: app bundled no monorepo** (`apps/<nome>/` dentro de `urbiverso/urbiverso`).
Ela é distribuída junto com o shell, então o contrato dela **é** o `main` — ali `docs/shell/`
é a superfície certa. A exceção é pelo modo de distribuição, não por conveniência de quem
revisa: app em repositório próprio nunca cai nela, nem quando o monorepo está na máquina.

Cada execução é independente, analisa **um** PR aberto, sem memória entre execuções. O
relatório final é **sempre** publicado como comentário no PR, e é o fim do trabalho — exceto no
**modo diálogo** (§ 10), em que uma sessão implementadora está do outro lado esperando, e o
relatório abre um ciclo de rodadas em vez de fechar o trabalho.

## 1. Triagem — antes de qualquer análise

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`. Se alterar aqui, espelhe
     lá. Isto é recado de manutenção: quem está EXECUTANDO a skill não deve abrir, carregar
     nem consultar a outra. -->

Leia o PR e **todos** os comentários. Decida:

| Situação | Ação |
|---|---|
| Sem comentário de revisão | **Segue** |
| Revisão anterior + comentário posterior que a mencione (inclusive resposta parcial) | **Segue** — revise o delta e o que a resposta afirma |
| Revisão anterior + commit posterior a ela | **Segue** — commit é alteração e vale revisão nova |
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
segundos e os agentes levam minutos: se discordar, ele interrompe, e isso é grátis. Parar para
pedir validação a cada revisão é atrito puro numa varredura de vários PRs.

```
Rodando revisar-pr-apps no PR #<n>. <N> arquivos, +<x>/−<y>, <áreas tocadas>.
Esforço <nível>: <N> lentes (<lista>), motor <Codex|nativo>. Agora são <timestamp>.
```

O timestamp existe para o usuário medir a duração — repita no fim. O anúncio também é
registro: se a revisão deixar passar alguma coisa, dá para ver em que esforço e em que motor
ela rodou.

**Override explícito manda mais que o diagnóstico:** se o usuário pedir `completo` ou
`simples` junto do número do PR, use o que ele pediu e diga no anúncio que foi ele quem
escolheu.

## 2.2 Motor da fan-out — Codex quando existir, pergunta quando não

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`, trocando os docs do SDK
     pelos de `docs/shell`. Se alterar aqui, espelhe lá. -->

As lentes dos passos 3 e 4 rodam **fora da conta Anthropic** quando esta máquina tem o plugin
do Codex. O revisor lê muito e escreve pouco — uma lente engole um doc inteiro, o diff e o
código em volta para devolver 400 palavras —, então o custo mora no input, e é ali que o
motor externo paga.

**A presença do plugin é fato verificado, nunca suposto.** Descubra o script antes de montar
o lote:

```bash
CODEX=$(ls -1d ~/.claude/plugins/cache/*/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)
```

Vazio significa ausente — e aí **PARE e pergunte** se ele quer que a revisão rode nativa. Isso
não é hesitação: rodar nativo gasta a cota Anthropic que esta seção existe para poupar, e a
escolha é do usuário, não sua. Diga que o plugin não está aqui, quanto custa mais ou menos
rodar nativo naquele esforço, e espere. Com autorização, siga o passo 3 como está escrito, com
subagentes nativos.

### Tier por papel

Um comando por lente. O tier vai no `--model`, e é ele que faz o trabalho que num subagente
nativo o modelo faria:

| Papel | Modelo |
|---|---|
| L1 varredura, L5 armadilhas de linguagem, S1 documentação, e a camada de contratos de PR **só de doc** | `gpt-5.6-luna` |
| L2 comportamento removido, L3 rastreador, L4 concorrência, T1–T3, S2, S3, e a camada de contratos em geral | `gpt-5.6-terra` |
| Contratos de framework sensível no **Profundo** — migração, `schema.json`, `manifesto.json`, permissões, contas, auditoria | `gpt-5.6-sol` |

A camada de contratos fica em `terra` por padrão de propósito: a §4 manda cortar da camada
adversarial antes de cortar dela, então ela não é o lugar de economizar. `luna` só quando o PR
é doc puro; `sol` só nas faixas em que contrato perdido custa caro.

### O repositório da app pode nem estar nesta máquina

PR de app mora em repositório próprio, e a sessão quase nunca tem um clone dele. Antes de
qualquer coisa, clone — num diretório descartável, **fora** da árvore da sessão:

```bash
gh repo clone <owner>/<repo> <destino> -- --quiet
git -C <destino> fetch origin <branch-do-pr>
```

Use a **scratchpad da sessão** como destino: o clone é material de trabalho, não árvore de
projeto, e some junto com a sessão. Nunca clone dentro da árvore do monorepo.

**Clone dedicado dispensa worktree.** A regra do worktree existe para não trocar a branch de
uma árvore que a sessão usa para outra coisa; um clone feito agora, só para esta revisão, não
tem esse problema — faça `git checkout <branch-do-pr>` nele, confirme o HEAD e siga. O worktree
volta a ser obrigatório quando a árvore já existia antes da revisão.

### A árvore que o motor lê — passo obrigatório, e o mais fácil de esquecer

**O motor revisa a árvore que está checada, não o PR que você digitou.** Numa árvore
preexistente a sessão está quase sempre na branch padrão, e o PR mora noutra. Sem corrigir
isso, as lentes revisam um diff **vazio** e voltam **limpas** — JSON válido, `verdict: approve`,
indistinguível de revisão de verdade. É o pior modo de falha desta skill, e ele não dispara
nenhuma das defesas da seção seguinte.

Compare e resolva antes de despachar qualquer coisa:

```bash
git rev-parse HEAD                              # o que a sessão tem checado
git rev-parse origin/<branch-do-pr>             # o que o PR é
```

Iguais, use a própria árvore. Diferentes, monte worktree do head do PR e aponte **todas** as
lentes para lá com `--cwd`:

```bash
git worktree add ../<repo>-wt-pr<n> origin/<branch-do-pr>
```

Confira que o worktree está no commit certo antes de despachar (`git -C <dir> rev-parse HEAD`)
— worktree no commit errado é a mesma revisão vazia com outra roupa. Ao terminar,
`git worktree remove ../<repo>-wt-pr<n>`, e o `--cwd` deixa a árvore da sessão intacta o tempo
todo.

**O motor lê UMA árvore só, e os docs da plataforma podem não estar nela.** Resolva pela
cascata da seção *Superfície de leitura*, antes de despachar:

- **Com o bundle na árvore** — se o repo da app tem `node_modules`, o SDK já está lá e o
  briefing aponta para `node_modules/@urbiverso/sdk/docs/`. Worktree novo **não** tem
  `node_modules` (ele não é compartilhado): ou instale (`pnpm install` na árvore, o que exige
  credencial de leitura do GitHub Packages), ou use a árvore da sessão com a branch do PR
  checada. Instalar é preferível a reaproveitar árvore — a versão do SDK que o lockfile do PR
  resolve é parte do que se está revisando.
- **Sem o bundle** — não despache lente de contrato nenhuma. Elas entram no relatório como não
  executadas, com o motivo. **Não substitua por cópia de `docs/shell/`**: era o que a versão
  anterior desta skill mandava fazer, e é justamente o anti-padrão que ela agora proíbe.
- **App bundled no monorepo** — aí sim os docs de framework são a superfície certa. Copie os
  que as lentes vão usar para dentro da árvore do PR, fora do controle de versão:

  ```bash
  mkdir -p "$WT/.docs-shell" && cp <monorepo>/docs/shell/{a,b,c}.md "$WT/.docs-shell/"
  ```

  Cópia não entra no diff (o `--base ... --scope branch` vem do git), então não contamina a
  revisão. **Apague ao terminar**, junto com o worktree.

Lente de contrato que não achou o doc é **não executada**, nunca aprovada.

### O comando

```bash
node "$CODEX" adversarial-review --json --model <tier> --cwd "$WT" --base <merge-base> --scope branch "<briefing>" \
  | jq -c '{verdict: .result.verdict, summary: .result.summary, findings: .result.findings}'
```

- `--base <merge-base> --scope branch` é a regra de três pontos da §2 — o runtime monta o diff
  sozinho, e você não paga por isso.
- **Read-only por construção:** os comandos de review não aceitam `--write`. A §8 sobrevive
  sem depender de o motor obedecer.
- **`--effort` não existe aqui**, só em `task`. O esforço cai no padrão do modelo (`sol` roda
  em `low`, `terra` e `luna` em `medium`). Não invente o flag: ele é ignorado em silêncio.
- **O `jq` não é enfeite.** O payload cru traz o relatório **três vezes** (`codex.stdout`,
  `result`, `rawOutput`); sem o filtro, o triplo entra inteiro no contexto do orquestrador, que
  é o recurso que a §9 chama de escasso.

### Um invólucro por lente

**Cada lente é despachada dentro de um subagente Haiku que só executa o comando.** Não é
cerimônia: é o que dá paralelismo de verdade (chamadas Bash soltas na mesma mensagem não
provaram correr concorrentes), progresso visível enquanto rodam, e — o ganho maior — mantém o
JSON fora do seu contexto, porque quem lê o payload é o invólucro, não você.

Dispare **todos os invólucros numa mensagem só**, `subagent_type: "general-purpose"` e
`model: "haiku"`. O prompt de cada um manda, literalmente: rodar **um** comando Bash com
`timeout` de 600000 ms, não analisar o repositório, não formar opinião própria, não completar
nada que o motor não tenha dito, e devolver **texto livre em formato fixo** (saída estruturada
não funciona nesta instalação — ver `CLAUDE.md`):

```
LENTE: <id>            MOTOR: codex/<tier>      DURACAO: <s>
VEREDITO: approve | needs-attention | NAO_EXECUTADA
RESUMO: <uma linha>
--- por achado:
ACHADO: <severidade> | <arquivo>:<linha> | <título>
CITACAO: "<a citação literal que veio no body>"
CORPO: <2 a 3 frases>
```

Para medir a duração, o invólucro cerca o comando: `S=$(date +%s)` antes e
`echo "DURACAO=$(( $(date +%s) - S ))s"` depois.

**A instrução mais importante do invólucro é a de não inventar:** comando falhou, saída vazia,
JSON inválido ou payload sem `findings` → devolver `VEREDITO: NAO_EXECUTADA` e o motivo cru.
Um invólucro que "resume o que provavelmente teria sido achado" transforma falha em laudo, que
é exatamente o que a seção seguinte existe para impedir.

### O briefing viaja sozinho

Nada do `CLAUDE.md`, desta skill ou dos docs entra no prompt do motor — só o focus text. Todo
briefing carrega, além da lente ou do framework:

- Para a camada de contratos: **o caminho do doc dentro de
  `node_modules/@urbiverso/sdk/docs/`, a ordem de ler o doc por inteiro e de listar as
  asserções verificáveis antes de abrir qualquer código** — é isso que impede o motor de apenas
  concordar com o que o PR afirma. O motor lê o SDK instalado na árvore, que é a superfície que
  o autor da app enxerga.
- **A citação literal do contrato dentro de `body`.** O schema não tem campo para ela, e a §7
  exige citação literal em todo achado. Sem essa frase, o relatório volta parafraseado.
- A proibição da §8, cravada: **não tocar rota de API de instância nenhuma** — nem produção,
  nem homologação, nem local, nem "só um GET".
- **Não editar arquivo, não commitar, não propor patch aplicado.** O sandbox já proíbe, mas a
  frase evita relatório escrito como se fosse aplicar.
- **Não ler o repositório do shell.** A superfície é o SDK; contrato ausente do bundle já é o
  achado, e ler o shell exige autorização que o motor não tem como pedir.
- Só achados materiais, com `file` e `line_start`; nada de estilo nem de código que o diff não
  toca.

### Falha é falha, nunca "passou"

Contam como **lente não executada**: `NAO_EXECUTADA` vindo do invólucro, invólucro que não
devolveu nada, saída vazia, exit diferente de zero, JSON inválido, ou resposta com cara de job
enfileirado em vez de relatório. Re-despache **uma** vez; persistindo, a lente entra no
comentário do PR como não executada, com o motivo.

Uma lente não executada **nunca** vira linha do "o que foi confrontado e passou" da §7. Esse é
o único jeito de a ausência de resultado virar ausência visível, em vez de laudo limpo falso.

### Grok — divergência sob demanda

O Grok entra só quando o usuário pedir uma segunda opinião em motor distinto, tipicamente na
L2 ou na S2. Ele não é uma faixa de capacidade: tem um modelo só (`grok-4.5`), e custa mais ou
menos o mesmo que uma lente `terra`.

```bash
GROK=$(ls -1d ~/.claude/plugins/cache/*/grok-build/*/scripts/grok-bridge.mjs 2>/dev/null | sort -V | tail -1)
node "$GROK" critique --json --wait --effort high --cwd "$WT" --base <merge-base> --scope branch "<briefing>" \
  | jq -c '{verdict: .result.verdict, summary: .result.summary, findings: .result.findings}'
```

Diferente do Codex, o `critique` **honra** `--background` — por isso o `--wait` explícito. Vai
no mesmo invólucro Haiku e obedece às mesmas regras de worktree, `jq` e formato de retorno.

### O que nunca sai daqui

Ficam com você, no modelo da sessão, sempre: a triagem (§1), a calibração (§2.1), a
**verificação de todo achado bloqueante e a reconferência da citação no arquivo** (§9), a
deduplicação, a síntese e a postagem. Motor externo produz evidência; veredito é seu.

## 3. Corpo da revisão — adversarial, delegada

Delegue com escopo delimitado. **Escolha as lentes e os temas pelo escopo do PR, pelo corpo
dele e pelos arquivos tocados** — não rode o catálogo inteiro. O número de agentes sai do
orçamento **combinado** que você fixou no passo 2.1, dividido entre esta camada e a do passo 4.
Todos em paralelo, numa mensagem só.

O veículo de cada lente — motor externo ou subagente nativo — é o que o passo 2.2 decidiu. As
instruções abaixo descrevem **o que** a lente procura; o passo 2.2 diz **onde** ela roda e o
que o briefing tem que carregar.

### Lentes — como olhar. Escolha 2 a 4

- **L1 · Varredura linha a linha.** Cada hunk, e a função inteira em volta: bug em linha não
  tocada de função tocada está no escopo, porque o PR reexpõe ou deixa de consertar. Condição
  invertida, off-by-one, `await` faltando, zero falsy, erro engolido no catch, variável errada
  por copiar-colar. **"Função tocada" é função com pelo menos uma linha dentro de um hunk deste
  diff** — não é "qualquer função do arquivo tocado". Sem esse corte a lente varre o arquivo
  inteiro e devolve achado sobre código que o PR não encostou, que a §9 proíbe; já aconteceu.
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

Uma lente por framework, no tier que a tabela do passo 2.2 manda, cada uma com estas
instruções:

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
    superfície; formule a pergunta que o doc não responde e sugira a issue no shell.

Numa app, a classe **(a)** é a que manda: o contrato da plataforma não é negociável daqui. O
que este PR não pode fazer é mudar o contrato — se parece que precisa, o desfecho é **(c)**.

## 5. Convenções da plataforma que a revisão sempre confere

Estas falham em silêncio e por isso quase nunca aparecem sozinhas:

- **`Closes #123` em inglês.** `Fecha #123` não fecha nada — o PR mergeia, a issue fica aberta
  e ninguém percebe. A keyword repete por issue (`Closes #1, closes #2`), vale só no corpo do
  PR ou na mensagem de commit, **nunca no título**, e issue de outro repositório exige a forma
  completa (`Closes <owner>/<repo>#308`).
- **UI e API andam juntas.** Capacidade na API sem controle correspondente na tela é feature
  invisível. Se não merece UI, não deve existir na API.
- **Doc no mesmo PR.** Mudou a app → os docs da app.
- **Telas usam os primitivos de UI** — ver S3.
- **Permissão usa `nivelApp`/`rolesApp`**, nunca `usuario.tipo`.
- **Natureza (`humano`/`openclaw`) nunca segrega.** Regra que ramifica por natureza está no
  eixo errado — o certo é `tipo`, permissão ou credencial.
- **Nada de SQL manual como solução.** Correção de dados entra por migração, endpoint/UI de
  admin ou código versionado.
- **Identificador da app** é `snake_case` e é também o schema PostgreSQL — hífen, maiúscula ou
  acento quebram o `CREATE SCHEMA`.
- **`versao` do `manifesto.json`** é ordenada (`x.y.z`), e **`z` só bumpa com migração**.

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
"reescreva a migração" — é abrir **issue no shell** para ampliar o vocabulário do `schema.json`
e a capacidade do sincronizador, e o PR espera essa mudança. Diga isso no relatório com todas
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

## 7. Entrega

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`. Se alterar aqui, espelhe
     lá. Recado de manutenção — não carregue a outra skill. -->

**Um comentário no PR, sempre** — inclusive quando não houver nenhum achado, porque o
comentário é o registro de que a revisão rodou e do que foi confrontado.

Estrutura:

- Achados ordenados do mais grave para o mais leve.
- Cada um com `arquivo:linha`, a citação **literal** do contrato ou da regra, e — opcional —
  o desfecho proposto. Contrato parafraseado não serve: quem lê precisa comparar as duas
  coisas sem reabrir o doc.
- **Bloqueante separado de observação**, em blocos distintos.
- No fim, o que foi confrontado e passou — **no máximo 10 itens, uma linha cada**. É registro
  do que a revisão cobriu, não um segundo relatório: acima disso ele compete com os achados
  pela atenção de quem lê. Sobrando mais, mantenha o que alguém poderia duvidar que foi
  conferido e descarte o resto.
- **Qual superfície de leitura foi usada**, logo no começo: bundle do SDK instalado (**com a
  versão**, e se ela é a mais nova publicada), nenhuma (e então quais lentes de contrato não
  rodaram), ou — só para app bundled — `docs/shell/` do monorepo. Quem lê precisa saber contra
  qual contrato o "passou" foi conferido, e a versão do SDK é parte da resposta: um achado
  ausente pode significar "não existe" ou "o bundle é velho demais para ver".
- **Um quadro de execução, obrigatório**, fechando o comentário: uma linha por lente, com
  motor, tier, esforço, duração e veredito. É o que permite comparar duas revisões do mesmo PR
  e descobrir, depois, que um achado escapou porque aquela faixa rodou rasa.

  | Lente | Motor | Tier | Esforço | Duração | Veredito |
  |---|---|---|---|---|---|
  | L2 · comportamento removido | Codex | `gpt-5.6-terra` | medium | 2m10s | 0 achados |
  | contratos · permissoes | Codex | `gpt-5.6-sol` | low | 3m02s | 1 achado |
  | S3 · UI | Codex | `gpt-5.6-terra` | medium | — | **não executada** (timeout) |

  **Lente não executada aparece nesse quadro com o motivo** — motor indisponível, tempo
  estourado, saída inválida. Sumir do relatório é pior que aparecer como falha: quem lê presume
  cobertura que não houve.

Nunca use "approve" nem "request changes" do GitHub — comentário normal. Quem decide o estado
do PR é o usuário.

Rodapé obrigatório:

```
---
_Generated by [Claude Code](https://claude.ai/code)_
```

Na sessão, devolva **só o resumo**, com o timestamp de fechamento para comparar com o do
início, seguido do **mesmo quadro de execução** que foi para o comentário:

```
Concluído às <timestamp> (início <timestamp>, <duração total>). Relatório em <link>.
2 achados bloqueantes e 5 menores. <N> de <M> lentes executadas.
```

Ou, quando a triagem para:

```
Parado às <timestamp>. O PR já tem revisão de <data> sem resposta e sem commits depois
(<link>). Revisar de novo só com pedido expresso.
```

## 8. Proibições

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`. Se alterar aqui, espelhe
     lá. Recado de manutenção — não carregue a outra skill. -->

- **Sem commit, sem push, sem abrir PR, sem empurrar correção.**
- **Proibido tocar qualquer rota de API de qualquer instância** — produção, homologação,
  desenvolvimento local, qualquer uma. Nem para diagnóstico, nem para caso negativo de teste,
  nem "só um GET". **O revisor trabalha sobre superfície fria: código e documentação.**
  Instância quente é assunto do validador, não deste trabalho. Essa proibição vai cravada no
  briefing de **cada** agente — agente com shell e rede acha natural "testar o endpoint", e
  nenhum arquivo de convenção do repositório viaja no prompt dele.
- A branch principal é só para puxar. Se precisar de árvore própria, use worktree — nunca duas
  sessões na mesma árvore de trabalho.

## 9. Operação

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`. Se alterar aqui, espelhe
     lá. Recado de manutenção — não carregue a outra skill. -->

Roda no modelo atual da sessão. **Delegue tudo que der** — o contexto do orquestrador é o
recurso escasso.

**Escolha o modelo de cada lente pela natureza da tarefa, e passe `model` explicitamente.**
Sem o parâmetro o subagente herda o modelo do orquestrador, que aqui é o caro — e a fan-out
multiplica isso por lente e por rodada. Em subagente nativo o padrão é **`sonnet`**; sobe para
**`opus`** nas faixas em que a tabela de tier do passo 2.2 manda `sol`; e `haiku` fica no papel
de **transporte** — o invólucro do passo 2.2, rodar-e-relatar — **nunca numa lente**: lente
caça defeito sem diagnóstico nenhum, e é por isso que o piso dela é `sonnet`. **Nunca `fable`
num subagente** — tarefa delimitada não é assento dele. Nem capacidade em excesso (caro), nem
insuficiente (perde achado). Varredura mecânica e leitura de doc com confronto
ponto a ponto são bem servidas por um modelo intermediário; síntese e julgamento ficam com
você. No motor externo isso é a tabela de tier do passo 2.2; em subagente nativo, vale o mesmo
critério. Um orquestrador de menor capacidade **pode** escalar uma lente de maior capacidade,
se o ambiente permitir.

**Limite rígido de 350 a 450 palavras por agente.** Só achados; o que passou vira **uma**
linha no fim. Sem esse limite o contexto do orquestrador estoura antes do relatório.

Todo agente devolve **evidência, não veredito**: `arquivo:linha`, citação literal, e o
raciocínio que liga uma coisa à outra. Nada de estilo, preferência, ou código que o diff não
toca.

**Agentes não postam.** Você recebe os relatórios, deduplica e escreve o comentário.

**Todo achado bloqueante é verificado por você antes de reportar.** Se for útil, peça
refutação a um agente novo — mas isso é opção sua, caso a caso: achado que você já tem contexto
para derrubar na hora não precisa de um agente para isso. Agentes já se contradisseram entre
si, e achado próprio já morreu na verificação — que é o desfecho certo, não vergonha.

**Toda citação que sustenta um bloqueante é reconferida por você, no arquivo, abrindo a linha.**
Verificar o achado e verificar a citação são coisas diferentes, e a segunda não sai de graça
com a primeira: um agente já apontou `arquivo:339` para uma frase que estava em OUTRO arquivo,
na mesma linha. Confira o caminho, o número e o texto — se a citação não bate, o achado volta
para investigação antes de virar bloqueante, mesmo que o raciocínio pareça de pé.

## 10. Modo diálogo — quando o autor está esperando do outro lado

<!-- ESPELHO: seção quase idêntica à homônima de `revisar-pr-shell`. Se alterar aqui, espelhe
     lá. Recado de manutenção — não carregue a outra skill. -->

Ativado quando o PR já carrega header do protocolo — tipicamente o comentário de abertura que a
`acompanhar-revisao` posta antes de esperar —, ou quando o usuário disser que há uma sessão
implementadora do outro lado. Fora disso, nada nesta seção se aplica.

**`sem diálogo` na chamada desliga**, e manda mais que a detecção: o usuário pode querer uma
revisão só, ou conduzir o resto na mão. Aí a skill roda como sempre e encerra no relatório.

Nesse caso, **se houver abertura no PR**, você não pode simplesmente sumir: a implementadora
responderia e ficaria esperando uma rodada 2 que ninguém vai escrever. Carimbe `dialogo=nao` no
header e diga no texto que não haverá rodada seguinte. Uma linha resolve; a ausência dela deixa
uma sessão pendurada até o container morrer.

**Leia `.claude/protocolo-revisao-pr.md`** — na árvore `.claude/` de onde **esta skill** foi
carregada, não no clone da app na scratchpad. Ele define o header de máquina, a contagem de
rodadas, a regra do SHA e o encerramento. Não achou, **PARE e diga**.

O protocolo é o único arquivo do ciclo que a superfície de leitura da app **não** governa: ele
não é contrato de plataforma nem doc de framework, é o formato dos comentários deste PR. Lê-lo
não fere a regra de não ler o monorepo.

A revisão em si não muda: os passos 1 a 9 valem inteiros, em toda rodada — inclusive a
declaração de qual superfície foi usada, que se repete a cada relatório. O que muda é o começo,
o fim, e a calibragem das rodadas seguintes.

### A triagem da § 1 inverte de sentido

"Revisão anterior intocada → **PARE**" existe para não revisar duas vezes o mesmo código por
disparo em duplicidade. No diálogo, revisão intocada é o **estado normal de quem está
esperando**: vira "continue aguardando", nunca "encerre a sessão". Quem encerra o ciclo é o
implementador, com `veredito=encerrado` ou `merged`.

### Releia o HEAD imediatamente antes de postar

Já aconteceu: relatório publicado sobre um HEAD que tinha acabado de mover, com o único achado
já corrigido. Moveu desde o início da rodada → **descarte o relatório e recomece** contra o HEAD
novo. O `head=` do seu header é o SHA que você **de fato** revisou, e é por ele que o
implementador confere se a rodada olhou o código dele.

Numa árvore clonada só para a revisão, isso quer dizer buscar de novo (`git fetch`) antes de
postar — o clone da scratchpad não se atualiza sozinho.

### Depois de postar, inscreva-se e espere

`subscribe_pr_activity` quando existir; senão `Monitor` persistente com poll dos comentários.
**Nunca `sleep`.** Descarte o evento que ecoa o seu próprio comentário — distinga pelo `papel=`.
Passou muito tempo sem sinal, consulte os comentários direto: webhook é best-effort.

### A profundidade de cada rodada — decaimento

O julgamento é seu, mas o padrão é decair. Rodada 2 rodando a skill inteira por reflexo é o modo
caro de errar:

| Delta desde a rodada anterior | Ação |
|---|---|
| Escopado aos achados, fora dos caminhos de runtime que a rodada anterior confrontou | conferência de delta, **sem fan-out** |
| Toca caminho que a rodada anterior confrontou-e-passou | fan-out reduzido: as lentes daquele caminho, mais S2 |
| Mudança estrutural, ou achado novo de classe (a) | skill inteira, esforço recalibrado pelo passo 2.1 |

Anuncie a escolha e o motivo em uma linha, como no passo 2.1, e repita o motivo no relatório —
inclusive quando não houve fan-out: o **quadro de execução da § 7 continua obrigatório**, ainda
que com uma linha só (`leitura direta + execução de testes | nativo (sessão) | — | ~6min | 0
achados novos`). Rodada sem quadro lê-se como rodada sem registro.

**Diga, no fim de cada relatório, o que a próxima rodada vai ser.** "Fechadas essas três,
recomendo o merge sem outra rodada de lentes — confiro o diff e sigo" custa uma frase e deixa o
outro lado calibrar o conserto.

### O que você não conseguiu executar, você declara

Suíte de app pode não rodar na árvore da revisão — sem `node_modules`, sem Postgres, sem
credencial do registry —, e teste que **pula** relata `0 fail` igual a teste que passou. O viés é
duplo: o PR parece testado porque está verde, e o número do autor parece medido porque tem três
dígitos.

Quando der para rodar e o PR mexer em caminho de runtime, **rode você**. Quando não der, escreva
a frase honesta e **atribua o número a quem mediu**: *"esse arquivo sai `skipped` nesta máquina;
a execução verde é relato do autor, não medição minha"*. Herdar número alheio em silêncio é o
mesmo laudo limpo falso que a § 2.2 combate na lente não executada.

**Mexeu no SDK instalado** — `package.json`, lockfile, `sdk_min` do manifesto —, a rodada volta
a ser inteira, e a superfície de leitura é reconferida do zero. O conserto de um achado de
contrato pode mudar a versão do bundle contra o qual todos os outros foram avaliados.

### A independência se perde — recompre-a

Sua sessão agora tem memória, e memória ancora: a tendência é conferir "os meus achados
saíram?" e parar. **O defeito da rodada N costuma ser filho do conserto da rodada N−1** — já
aconteceu, e o único achado de uma rodada 2 foi exatamente isso, num item que a rodada 1 tinha
conferido como verde.

Duas consequências, e as duas são obrigatórias:

1. A rodada começa pelo lado **adversarial do conserto**, não pela conferência dele: os commits
   novos entram como código fresco, olhados por subagentes **novos**, que não viram a rodada
   anterior. É barato e é o que restaura a independência que a sessão perdeu.
2. **Releia o que você mesmo declarou "confrontado e passou"** na rodada anterior, se o conserto
   encostou naquilo. É a lista de coisas que ninguém mais vai checar.

### Contestação do implementador é conferida, não descontada

Quando ele contesta um achado com evidência, **abra o arquivo e confira**. Achado seu que morre
na contestação é desfecho certo — registre "**achado retirado**", com o motivo, no relatório da
rodada. Insistir num achado derrubado queima rodada do teto, e o teto é de quem implementa.

Vale em dobro para achado de classe (c) — contrato ausente do bundle. Se o implementador mostrar
que o verbo **está** publicado numa versão que a app pode alcançar, o achado muda de natureza:
vira "suba o SDK", não "abra issue no shell".

### Três severidades, não duas

No diálogo, a § 7 ganha um terceiro bloco além de bloqueante e observação: **decisão de
desenho** — achado cujo conserto mexe em algo que o usuário decidiu. Ele não é para o
implementador resolver: um achado ali **encerra o ciclo** e devolve a decisão ao usuário. Use
com parcimônia; usado à toa, vira um jeito de terceirizar julgamento que era seu.

**O sinal que a outra sessão lê é o `veredito` do header, não o título do bloco.** Escreva os
blocos em português natural, como sempre — "Bloqueante" no singular quando é um, "Bloqueantes"
quando são vários. Havendo mais de uma severidade, o veredito segue a precedência
`decisao-de-desenho` › `bloqueado` › `observacoes` › `merge-recomendado`.

Dívida de superfície (classe **(c)**) é candidata natural a esse carimbo quando o desfecho é
esperar mudança no shell: o ciclo não tem como convergir esperando por outro repositório.

### Recomendar merge — e nunca mergear

`veredito=merge-recomendado` quando a revisão já cumpriu o papel. É **recomendação**: a sessão
implementadora não mergeia sem autorização expressa do usuário, e você não mergeia nunca, em
hipótese nenhuma. A § 8 continua valendo inteira.

Na última rodada do teto, **diga se o que você está abrindo é regressão de conserto ou achado
inédito**. Inédito tão tarde significa que a rodada 1 não cumpriu o papel, e é informação que
vale mais para o usuário do que para o ciclo.

### O fim

Leu `veredito=encerrado` (qualquer motivo) ou `veredito=merged` → o trabalho acabou. Derrube
tudo que você armou — `unsubscribe_pr_activity`, `TaskStop` do monitor, gatilhos, worktree e
clone da scratchpad — e devolva à sessão o placar do ciclo: rodadas, achados por rodada,
retirados, e como terminou. **Sessão revisora inscrita num PR encerrado acorda com cada evento
do GitHub até o container morrer.**
