<!-- Portado de urbiverso/urbiverso `.claude/motor-revisao.md` @ b0361f6 (PR #2540), em
     2026-08-21. CÓPIA, NÃO LINK VIVO: mudou lá, alguém porta para cá à mão. As adaptações
     deste repo estão marcadas com `ADAPTADO:` — não as "corrija" de volta para o upstream. -->

# Motor da fan-out de revisão

Lido pela skill `revisar-pr-apps` no passo 2.2. Arquivo único de propósito: eram três, com
detecção de ambiente entre eles, e a detecção era pura cerimônia — a receita abaixo roda igual na
máquina do autor e em sessão na nuvem.

> **ADAPTADO — este repositório é o da app, não o monorepo.** `revisar-pr-shell` não existe aqui, e
> a superfície de docs é sempre `node_modules/@urbiverso/sdk/docs/`. Onde o upstream oferece dois
> caminhos (shell ou app), aqui só existe o de app.

As lentes dos passos 3 e 4 rodam **fora da conta Anthropic**, no Codex. O revisor lê muito e
escreve pouco — uma lente engole um doc inteiro, o diff e o código em volta para devolver 400
palavras —, então o custo mora no input, e é ali que o motor externo paga.

**Codex primeiro, nativo se falhar.** Não existe pergunta ao usuário no meio: o preflight
abaixo tenta, e o que ele não conseguir vira fan-out em subagente Anthropic, **declarada** no
relatório e na linha de anúncio. O que nunca acontece é lente sumir porque o motor caiu.

> ✅ **ADAPTADO — 2026-08-23: existe um TERCEIRO caminho, e neste repositório ele é o que funciona.**
>
> Este documento descrevia só dois motores: o **CLI local** (`codex exec`, o preflight abaixo) e o
> **fallback nativo**. Falta o **GitHub App do Codex** (`chatgpt-codex-connector`), que **está
> instalado neste repositório** e revisa quando se comenta `@codex review` no PR — ou quando o PR é
> aberto. Medido no PR 494: três rodadas seguidas, ~2 min cada, cinco achados P2 reais.
>
> **Por que isto precisa estar escrito.** Sem esta nota, a sessão faz o que a de 2026-08-23 fez:
> mede que o CLI não sobe (sem `OPENAI_API_KEY`, e com `api.openai.com` devolvendo **403 no CONNECT**
> pela política de rede do *cloud environment*), conclui *"não há Codex"* e cai para o nativo — com
> o motor bom disponível a um comentário de distância. A conclusão errada é barata de tirar e cara
> de manter.
>
> **Ordem de preferência neste repositório:**
>
> | # | Motor | Quando |
> |---|---|---|
> | 1 | **GitHub App** — comentar `@codex review` no PR | Sempre que houver PR aberto. É o caminho normal |
> | 2 | CLI local (`codex exec`, preflight abaixo) | Se a chave e a liberação de rede existirem |
> | 3 | Fan-out nativo Anthropic | Só quando 1 e 2 falharem, **declarado** como menos adversarial |
>
> **Os dois primeiros não competem — somam.** No PR 494 a divisão foi limpa e vale registrar: o
> Codex achou os defeitos de **lógica** (uma guarda que não testava o que dizia testar; um caminho
> absoluto que não existe noutro layout), e as lentes nativas acharam as **imprecisões factuais** do
> texto. Rodar as duas é mais barato que descobrir depois qual faltou.
>
> ⚠️ **O portão do CI não enxerga o Codex.** `revisao-registrada.yml:108` filtra os comentários
> **pelo autor do PR**, então uma review do bot **nunca** satisfaz o status `revisao/bloqueantes` —
> e, pior, publicar a linha de máquina com `bloqueantes=0` deixa o status **verde** com thread do
> Codex em aberto. Por isso: **`bloqueantes=` conta os achados do Codex ainda não resolvidos**, e o
> quadro de execução da §7 traz uma linha por rodada do Codex, com o commit revisado.

### Sequência obrigatória do App — acionar, ESPERAR, colher, só então atestar

**ADAPTADO — 2026-08-23, achado P1 do próprio Codex no PR 494.** A resposta do App é
**assíncrona**, e dizer que `bloqueantes=` conta os achados dele **não basta**: sem um passo de
espera, o relatório sai antes de o achado chegar e o status fica verde sobre uma revisão que ainda
não aconteceu. Era exatamente o furo que esta seção existia para fechar, aberto de novo pela falta
de um passo.

Então, **antes** de publicar o relatório da §7, execute nesta ordem:

1. **Acione.** Comente `@codex review` no PR, com o head da rodada declarado no texto. (Abrir o PR
   também aciona; um `@codex review` explícito por rodada é o que torna a rodada rastreável.)
2. **Espere, com teto.** Releia as reviews do PR até aparecer uma cujo `commit_id` seja **o head da
   rodada** — não o anterior. Teto de **15 minutos**. Medido no PR 494: ~2 min por rodada.
3. **Colhe.** Leia os *review threads*, não só o corpo da review — os achados vêm como comentários
   inline, com `path` e `line`. Cada um tem severidade (P1/P2).
4. **Verifique cada achado você mesmo**, como qualquer bloqueante (§11 da skill). Achado do Codex
   não é verdade revelada: ele erra, e contestação com evidência é legítima.
5. **Só então** monte `bloqueantes=` = seus bloqueantes **+** os achados do Codex ainda não
   resolvidos, e publique.
6. **Resolva os threads que você endereçou**, para a próxima rodada distinguir o que é novo.

**Se o teto estourar** — nenhuma review no head da rodada em 15 min —, o ciclo fica **aberto**, e a
atestação tem de refletir isso **na máquina, não na prosa**:

> 🔴 **NÃO publique a linha de máquina.** Publique o relatório **sem** o comentário HTML
> `<!-- revisao-viabilidade … -->`, dizendo em uma linha que o App foi acionado no head `<sha>` e não
> respondeu dentro do teto.
>
> **Por quê, e é o achado P1 da rodada 6 do próprio Codex:** `revisao-registrada.yml:124-130` lê
> **só o número** de `bloqueantes=`. Publicar `bloqueantes=0` com prosa explicando que o ciclo está
> aberto deixa o status **verde** assim mesmo — a prosa não é lida por ninguém que decida. Sem a
> linha de máquina, o job não acha atestação e o status fica *"nenhuma revisão registrada"*, que é
> **exatamente o estado verdadeiro**.
>
> Alternativa aceitável, se você quiser o relatório rastreável na contagem de rodadas: publique a
> linha com `bloqueantes=1` e o achado *"revisão do App não chegou no head desta rodada"* como o
> bloqueante — ele some quando ela chegar. **O que não é aceitável é `bloqueantes=0`.**

Silêncio do motor nunca é aprovação do motor — e "eu expliquei no texto" não é o mesmo que "o portão
sabe".

## Entradas que a skill chamadora fornece

O motor é o mesmo para shell e para app; o que difere vem de quem chama, e **tem que estar
resolvido antes de despachar**:

| Entrada | Quem define |
|---|---|
| `WT` — a árvore que as lentes leem | a seção *A árvore que o motor lê*, abaixo |
| `BASE` — o merge-base, nunca o nome da branch | passo 2 da skill |
| Lentes, com id, tier e esforço | passos 2.1, 3 e 4 da skill |
| **Superfície de docs** do briefing de contratos | fixa: `node_modules/@urbiverso/sdk/docs/`. **ADAPTADO:** ver a nota do preflight — neste repo ela costuma não existir, e aí a camada de contratos não é despachada |
| Faixas que sobem para `sol` | migração, `schema.json`, `manifesto.json`, permissões, contas, auditoria |

## Preflight — uma vez por sessão, antes de qualquer lente

Três passos, nesta ordem. Cada um é idempotente e barato; o terceiro é o que decide o motor.

```bash
command -v codex >/dev/null 2>&1 || npm i -g @openai/codex >/dev/null 2>&1
codex login status >/dev/null 2>&1 || printenv OPENAI_API_KEY | codex login --with-api-key
codex login status        # tem que dizer "Logged in using an API key"
```

- **O CLI pode não estar instalado**, e instalar é rápido (medido: 7s num container limpo).
  Onde já existe — inclusive login de ChatGPT já feito —, os dois primeiros comandos não fazem
  nada: o `login --with-api-key` não atropela sessão existente.
- **`OPENAI_API_KEY` vem do ambiente.** Container com a chave no ambiente e nenhuma sessão do
  `codex` é o estado normal: aí o CLI não manda o header de autorização e **toda** chamada volta
  `401 Missing bearer` — as lentes somem em bloco e o sintoma não parece de credencial.
- **Ruído esperado, que não é falha:** o `codex` tenta `wss://api.openai.com/v1/responses`
  primeiro, toma erro atrás do proxy de saída e cai para HTTPS sozinho. As linhas `failed to
  connect to websocket` e `Falling back from WebSockets to HTTPS transport` no stderr são
  normais; o que importa é o resultado.

**Preflight falhou** — sem rede para o npm, sem `OPENAI_API_KEY`, `login status` negativo —
→ **motor nativo** (seção final). Não pergunte, não pare, não repita o preflight lente a lente:
decidiu uma vez, vale para a revisão inteira, e o motivo entra no anúncio do passo 2.1 e no
quadro de execução da §7.

> **ADAPTADO — o estado medido deste repositório, em 2026-08-21.** `codex` estava **ausente** do
> PATH e `OPENAI_API_KEY` estava **vazia**, então o preflight morre no passo 2 e a revisão inteira
> roda no **motor nativo**. Isso é o **estado normal** até o autor colocar a chave nas variáveis do
> *cloud environment* deste repo — não é incidente, não tente consertar caçando token. O passo 1
> funciona: `npm view @openai/codex version` responde daqui, então o `npm i -g` instala o CLI
> sozinho assim que houver chave para usá-lo.
>
> Enquanto for nativo, o relatório da §7 diz isso **em uma linha explícita**, não só marcando
> `motor=nativo`: revisão nativa de um patch escrito pela mesma família de modelo é **menos
> adversarial**, e quem lê o laudo precisa saber que perdeu os olhos do outro provedor.
>
> ⚠️ Não confunda este 401 com o do `@urbiverso/sdk`. São dois: o do SDK é do GitHub Packages e
> derruba a **camada de contratos**; este é a ausência de chave da OpenAI e derruba o **motor**. Um
> não conserta o outro.

## Tier por papel

Uma lente, um comando, um tier. É o tier que faz o trabalho que num subagente nativo o modelo
faria:

| Papel | Codex | Nativo (fallback) |
|---|---|---|
| L1 varredura, L5 armadilhas de linguagem, S1 documentação, e a camada de contratos de PR **só de doc** | `gpt-5.6-luna` | `sonnet` |
| L2 comportamento removido, L3 rastreador, L4 concorrência, T1–T3, S2, S3, e a camada de contratos em geral | `gpt-5.6-terra` | `sonnet` |
| Contratos de framework sensível no **Profundo** (as faixas que a skill chamadora listou) | `gpt-5.6-sol` | `opus` |

A camada de contratos fica em `terra` por padrão de propósito: a §4 manda cortar da camada
adversarial antes de cortar dela, então ela não é o lugar de economizar. `luna` só quando o PR
é doc puro; `sol` só nas faixas em que contrato perdido custa caro.

## A árvore que o motor lê — passo obrigatório, e o mais fácil de esquecer

**O motor revisa a árvore que está checada, não o PR que você digitou.** Sem corrigir isso, as
lentes revisam um diff **vazio** e voltam **limpas**, indistinguíveis de revisão de verdade. É o
pior modo de falha desta cadeia, e ele não dispara nenhuma das defesas da seção "Falha é falha".

> **ADAPTADO.** No upstream a premissa era "a sessão quase nunca está na branch do PR", porque PR de
> app morava em repositório que a sessão do monorepo não tinha. Aqui é o contrário: **esta sessão
> roda dentro do repositório da app**, e o caso normal é ela já estar na branch do PR. Isso troca o
> padrão — árvore própria primeiro, worktree só por exceção — mas **não** dispensa a conferência.
> Premissa boa conferida continua barata; premissa boa presumida é como se chega ao diff vazio.

Três condições, todas obrigatórias, para usar a própria árvore:

```bash
git rev-parse --show-toplevel           # tem que ser a raiz DESTE repositório
git rev-parse HEAD                      # o que a sessão tem checado
git rev-parse origin/<branch-do-pr>     # o que o PR é
git status --porcelain                  # tem que sair VAZIO
```

`HEAD == origin/<branch-do-pr>` **e** árvore limpa → `WT="$(git rev-parse --show-toplevel)"`.

Qualquer uma das duas falhando — head divergente, ou alteração não commitada — monte worktree do
head do PR e aponte **todas** as lentes para lá:

```bash
git worktree add --detach "$WT" origin/<branch-do-pr>
git -C "$WT" rev-parse HEAD             # tem que bater com o head do PR
```

A árvore suja importa tanto quanto o head errado, e é o caso novo que esta adaptação cria: revisar a
própria árvore de trabalho significa que **um arquivo salvo e não commitado entra na revisão como se
fosse do PR** — e some do PR depois. O relatório fica falando de código que ninguém mais vê.

Confira o commit **antes** de despachar qualquer coisa — worktree no commit errado é a mesma revisão
vazia com outra roupa. Ao terminar, `git worktree remove "$WT" --force`.

> **ADAPTADO — proibição de saída.** `WT` **nunca** aponta para fora deste repositório. Em
> particular, `/home/user/urbiverso` (o monorepo) pode estar clonado nesta máquina e é **só
> referência de leitura do autor**: não é superfície de revisão, não é worktree, não é destino de
> clone. Ver `CLAUDE.md` § "O monorepo `urbiverso/urbiverso` é só leitura".

## O briefing viaja sozinho

**Nada do `CLAUDE.md`, da skill ou dos docs entra no prompt do motor** — só o preâmbulo de
escopo e o focus text da lente. O Codex procura `AGENTS.md`, que estes repositórios não têm,
então tudo que a lente precisa saber tem que estar escrito no briefing dela.

Todo briefing carrega, além da lente ou do framework:

- Para a camada de contratos: **o caminho do doc na superfície que a skill definiu, a ordem de
  ler o doc por inteiro, e a de listar as asserções verificáveis antes de abrir qualquer
  código** — é isso que impede o motor de apenas concordar com o que o PR afirma.
- **A citação literal do contrato dentro do corpo do achado.** A §7 exige citação literal em
  todo achado; sem essa frase, o relatório volta parafraseado.
- **Não tocar rota de API de instância nenhuma** — nem produção, nem homologação, nem local,
  nem "só um GET". Cravada, porque o `CLAUDE.md` não viaja no prompt do motor.
- **Não editar arquivo, não commitar, não propor patch aplicado.** O sandbox já proíbe, mas a
  frase evita relatório escrito como se fosse aplicar.
- **Limite rígido de 350 a 450 palavras.** Só achados materiais, com arquivo e linha; nada de
  estilo, preferência, nem código que o diff não toca. O que passou vira **uma** linha no fim.
- **ADAPTADO — não ler nem escrever em `/home/user/urbiverso`.** O monorepo pode estar clonado
  nesta máquina e ser gravável; o upstream confiava em ele simplesmente não estar. Aqui a frase é
  obrigatória, porque a lente não tem como saber: *"não leia, não abra, não faça `grep` e não
  escreva nada em `/home/user/urbiverso`. Se o contrato que você precisa não está na superfície de
  docs indicada, a lente é NÃO EXECUTADA — nunca compense lendo o monorepo."*

Lente de contrato que não achou o doc é **não executada**, nunca aprovada.

## O comando

`-s read-only` e `-C` são opções do `codex exec` e vão **antes** do subcomando `review`;
`--json`, `-m` e o briefing vão **depois**. Trocar a ordem dá `unexpected argument`.

```bash
codex exec -s read-only -C "$WT" --ephemeral -c model_reasoning_effort=<esforço> \
  review --json -m <tier> "<briefing>" </dev/null > "$OUT/<id>.jsonl" 2> "$OUT/<id>.err"
```

- **`--base` e o briefing são mutuamente exclusivos.** O `review` recusa os dois juntos
  (`--base cannot be used with [PROMPT]`), e briefing é o que faz a lente ser uma lente. Então
  **o escopo vai cravado no texto do briefing**, com o merge-base literal — o Codex monta o
  diff de três pontos sozinho a partir dali (verificado: as lentes rodam
  `git diff <merge-base>...HEAD` por conta própria).
- **O esforço é controlável e honrado:** `-c model_reasoning_effort=<low|medium|high>`.
- **`-s read-only` sempre.** O `review` já não aceita escrita, mas a **§10 (Proibições)** da skill não
  depende de o motor obedecer.
- **`--ephemeral`** para não acumular arquivo de sessão.
- **`</dev/null` não é enfeite:** sem ele o `codex` fica lendo stdin e a lente trava.

## A fan-out — Bash em background, sem subagente

**Não use subagente de invólucro.** O `&`/`wait` do próprio Bash dá paralelismo de verdade:
medido, 10 lentes concorrentes fecharam em 43 s contra 362 s somados, todas com exit 0, num
container de 4 CPUs e 16 GB. Um invólucro por lente só somaria latência, tokens e uma camada a
mais capaz de inventar resultado.

O que um invólucro existiria para resolver — manter o payload fora do seu contexto —
resolve-se melhor **escrevendo em arquivo e extraindo com `jq`**: numa revisão real de 9 lentes
o JSONL cru somou 1,8 MB e o que entrou no contexto do orquestrador foram 3,5 KB. Você nunca lê
o cru.

Dispare o lote inteiro numa chamada Bash só:

```bash
OUT="${CLAUDE_SCRATCHPAD:-/tmp}/revisao"; mkdir -p "$OUT"; rm -f "$OUT"/*   # scratchpad da sessão; apague ao terminar
BASE=<merge-base>

COMUM='<as regras fixas do briefing — ver "O briefing viaja sozinho".
        Inclui, obrigatoriamente: citação literal do contrato no corpo do achado;
        não tocar rota de API de instância nenhuma; não editar/commitar/propor patch;
        350 a 450 palavras; e a proibição de ler ou escrever em /home/user/urbiverso.>'

lente() {  # lente <id> <tier> <esforço> <briefing>
  local id=$1 tier=$2 esf=$3 brief=$4
  local ini=$(date +%s) rc=0
  timeout 900 codex exec -s read-only -C "$WT" --ephemeral -c model_reasoning_effort="$esf" \
    review --json -m "$tier" "ESCOPO OBRIGATÓRIO: revise exclusivamente o diff de \`git diff ${BASE}...HEAD\`. Não comente código que esse diff não toque.
Não edite arquivo, não commite, não proponha patch aplicado. Não acesse rota de API de instância nenhuma — nem produção, nem homologação, nem local, nem \"só um GET\".
Responda em português.

${brief}

${COMUM}" </dev/null > "$OUT/$id.jsonl" 2> "$OUT/$id.err" || rc=$?
  echo "$id exit=$rc tier=$tier esforco=$esf dur=$(( $(date +%s) - ini ))s" >> "$OUT/execucao.txt"
}

lente L2 gpt-5.6-terra medium "<briefing da L2>" &
lente T1 gpt-5.6-sol   high   "<briefing da T1>" &
# … uma linha por lente do orçamento do passo 2.1
wait
cat "$OUT/execucao.txt"
```

O `execucao.txt` é o que alimenta o quadro de execução da §7 — tier, esforço e duração
**medidos**, não estimados.

## A colheita — e a guarda que impede falha virar laudo limpo

**Turno que falha AINDA emite um `agent_message`** dizendo *"Review was interrupted. Please
re-run /review and wait for it to complete."* Lido sem guarda, isso vira um relatório de zero
achados — a falha vira `approve`. A colheita testa `turn.failed`/`error` **antes** de olhar a
mensagem:

```bash
for f in "$OUT"/*.jsonl; do
  id=$(basename "$f" .jsonl)
  falha=$(jq -rc 'select(.type=="turn.failed" or .type=="error") | .type' "$f" 2>/dev/null | head -1)
  texto=$(jq -r 'select(.type=="item.completed" and .item.type=="agent_message") | .item.text' "$f" 2>/dev/null | tail -c 8000)
  if [ -n "$falha" ] || [ -z "$texto" ] || printf '%s' "$texto" | grep -qi 'Review was interrupted'; then
    echo "### $id — NÃO EXECUTADA (${falha:-saída vazia/interrompida})"
    # com `--json` o erro sai no próprio JSONL, não no stderr — o motivo vem daqui
    jq -r 'select(.type=="turn.failed" or .type=="error") | (.error.message // .message)' "$f" 2>/dev/null | head -c 400
    grep -viE 'websocket|Reconnecting|bubblewrap|Falling back' "$OUT/$id.err" | tail -2
  else
    echo "### $id"; printf '%s\n' "$texto"
  fi
  echo
done
```

O relatório vem em markdown, sempre no mesmo formato: uma linha de resumo, depois `Full review
comments:`, depois um item por achado — `- [P1] <título> — <caminho absoluto>:<linha
inicial>-<linha final>`, com o corpo indentado abaixo. Sem achado nenhum, o bloco `Full review
comments:` simplesmente não aparece: aí o veredito é `approve`.

Os caminhos vêm **absolutos**, apontando para dentro do worktree — **relativize para a raiz do
repo antes de citar no PR**, porque a árvore da revisão não existe para quem lê.

## Falha é falha, nunca "passou"

Contam como **lente não executada**: `turn.failed`, evento `error`, "Review was interrupted",
saída vazia, exit diferente de zero, `timeout` estourado, payload inválido.

Re-despache **uma** vez. Persistindo numa lente só, ela entra no comentário do PR como não
executada, **com o motivo**. Persistindo em bloco — todas falhando igual —, isso é o motor
caindo no meio: refaça o preflight uma vez e, se não voltar, **termine a revisão no motor
nativo** e diga no relatório quais lentes trocaram de motor.

Uma lente não executada **nunca** vira linha do "o que foi confrontado e passou" da §7. Esse é
o único jeito de a ausência de resultado virar ausência visível, em vez de laudo limpo falso.

## Motor nativo — o fallback

Vale quando o preflight falhou, ou quando o Codex caiu em bloco no meio da revisão. Mesmas
lentes, mesmos briefings, mesmo orçamento: muda o veículo.

- **Subagente por lente**, todos numa mensagem só, `subagent_type: "general-purpose"`.
- **`model` explícito, sempre** — pela coluna *Nativo* da tabela de tier. Sem o parâmetro o
  subagente herda o modelo do orquestrador, que é o caro, e a fan-out multiplica isso por
  lente e por rodada. `haiku` **nunca** numa lente: lente caça defeito sem diagnóstico nenhum.
  **Nunca `fable` num subagente** — tarefa delimitada não é assento dele.
- **Texto livre em formato fixo, nunca saída estruturada** (`StructuredOutput`/`schema` falha
  100% das vezes nesta instalação — ver `CLAUDE.md`):

  ```text
  LENTE: <id>            MOTOR: nativo/<modelo>    DURACAO: <s>
  VEREDITO: sem-achado | precisa-atencao | NAO_EXECUTADA
  RESUMO: <uma linha>
  --- por achado:
  ACHADO: <severidade> | <arquivo>:<linha> | <título>
  CITACAO: "<a citação literal>"
  CORPO: <2 a 3 frases>
  ```

- **A instrução mais importante continua sendo a de não inventar:** sem material para concluir,
  `NAO_EXECUTADA` e o motivo cru. Subagente que "resume o que provavelmente teria sido achado"
  transforma falha em laudo.
- O quadro de execução da §7 mostra `nativo` na coluna Motor, e o anúncio do passo 2.1 diz que
  o Codex não estava disponível — **com o motivo**. Fallback silencioso é o mesmo laudo limpo
  falso com outro nome.

## O que nunca sai daqui

> ⚠️ **Referência de seção cita NÚMERO e NOME.** Este arquivo já apontou para `§8` e `§9` depois de
> a skill ser renumerada no mesmo PR — número solo deriva calado, e duas lentes independentes da
> revisão do #424 acharam a mesma coisa. Com o nome junto, o leitor percebe quando não bate.

Ficam com você, no modelo da sessão, sempre: a triagem (§1), a calibração (§2.1), a
**verificação de todo achado bloqueante e a reconferência da citação no arquivo**
(**§11, Operação**), a deduplicação, a síntese e a postagem. O motor produz evidência; **veredito é seu**.
