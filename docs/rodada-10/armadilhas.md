# Armadilhas medidas na Rodada 10 — 2026-08-29/30

> Detalhe completo das doze armadilhas resumidas em `CLAUDE.md` § *As doze armadilhas que a Rodada
> 10 pagou*. Cada uma tem: o **sintoma** (como ela se apresenta), a **causa**, a **defesa** (passo, não
> intenção) e o **custo medido**. Nenhuma é conselho geral — todas foram pagas hoje, na Rodada 10
> (`docs/rodada-10/planejamento.md`).

---

## 1 · Teste de inventário que varre o DISCO enxerga artefato de build

**Sintoma:** 1 falha em 953 testes no CI, e **verde localmente** — três execuções com o glob exato.
**Causa:** o passo `Build` do `validation.yml` gera `backend/rotas.js` (ignorado pelo git,
`.gitignore:5`) **antes** dos testes. A varredura de disco o enxerga no runner e não na árvore local.
**Defesa:** enumerar **fonte versionada** (`git ls-files`), nunca varrer o disco. Artefato de build
futuro fica de fora sozinho.
**Por que NÃO acrescentar o nome a uma lista de dispensados:** chave por arquivo deixa violação nova
entrar de carona, e o próximo artefato quebra de novo. O eixo é "é fonte versionada", não "é este
nome". (É o critério (c) do `CLAUDE.md` do monorepo sobre lista de exceção mantida à mão.)
**Custo:** ~40 min de diagnóstico. PR 641.

## 2 · Escrever contra o `main` do monorepo em vez do SDK publicado

**Sintoma:** seis `TS2339: Property 'varrerTudo' does not exist on type 'HelperDados'` no CI.
**Causa:** o método existe no `main` do monorepo (`sdk/src/contrato.ts:354`) e no runtime (shell
0.53.8, que era o `shell_min` à época — hoje `0.53.20`), mas **não no SDK que a app fixa**
(`0.50.3`). O comentário do próprio
código entregava a origem: citava `docs/shell/banco-de-dados.md` *"no monorepo"*.
**Defesa:** a autoridade é o **bundle do SDK instalado**. Se a resposta não está ali, ela NÃO EXISTE
para a app — a pergunta vira "quando isso é publicado?", não "deixa eu ver no shell".
**Agravante que tornava isto invisível — e que MORREU em 2026-09-03:** o SDK dava **401** neste
ambiente, então `req.dados` errava em TODO acesso e o erro do método ausente ficava camuflado no
ruído. O corpo do PR afirmava *"nenhum erro novo além dos já esperados por falta do SDK"* —
afirmação que **parece medida e não é**. Hoje o `scripts/lib/sdk-auth.sh` põe o bundle no disco e
`validar-backend.sh` roda o typecheck aqui: o ruído acabou, e a sessão enxerga o mesmo que o CI.
**A armadilha em si continua valendo** — ela é sobre medir contra o `main` do monorepo em vez do
bundle fixado, e isso não mudou.
**Custo:** um ciclo inteiro de CI + reescrita. PR 648.

## 3 · Atestar `bloqueantes=0` lendo só UM canal do Codex

**Sintoma:** três achados reais (dois P2, um P3) parados 5 horas, com duas atestações declarando zero
bloqueantes por cima deles.
**Causa:** o Codex publica em **dois canais**. Naquele acionamento não deixou comentário de PR — os
três foram só para `get_review_comments`. Quem leu `get_comments` viu silêncio e concluiu "limpo".
**Defesa:** **sempre os dois**, na mesma passada: `get_comments` **e** `get_review_comments`.
**Silêncio num canal não é ausência de achado.**
**Custo:** dois merges quase saíram com achado real pendente. PR 641.

## 4 · `head=` da atestação escrito de memória

**Sintoma:** `revisao/bloqueantes` = *"a revisão registrada é de outro head"* sobre uma revisão que
**é** daquele head.
**Causa:** o job compara **8 caracteres exatos** (`CURTO="${HEAD_SHA:0:8}"`); escrevi o prefixo de
cabeça e errei o 8º caractere em **três** atestações seguidas.
**Defesa:** `git rev-parse HEAD | cut -c1-8`. Nunca digitar de memória.
**Custo:** três ciclos de comentário + re-run.

## 5 · Medir tempo pelos próprios turnos, e não pelo relógio

**Sintoma:** concluí que a API do GitHub servia dado obsoleto havia 10 minutos e que um job estava
travado. **As duas conclusões eram falsas** — o job tinha 1 minuto de vida.
**Causa:** turnos passam rápido; `sleep` em background **não bloqueia**. "Quatro esperas" somam um
minuto de relógio. Um subagente caiu na MESMA armadilha na mesma sessão.
**Defesa:** ler `date -u` antes de chamar qualquer coisa de lenta ou travada. Para esperar de
verdade, laço `until` com deadline em segundos, não contagem de idas e vindas.
**Custo:** um falso diagnóstico de travamento publicado ao autor, depois retratado.

## 6 · `#N` de carona na mensagem do commit de sincronização

**Sintoma:** `PR que cita issue declara se fecha` vermelho — **6 falhas hoje, a classe dominante**.
**Causa:** o guard lê **corpo do PR + mensagens de commit** e trata **todo** `#N` como citação —
inclusive referência causal em prosa (`#351`, `#443`) e até notação que não é issue (`#0`, `#2`,
vindos de `D1#0 D3#2 D4#2`).
**Correção de um diagnóstico que estava errado:** o `preflight-pr.mjs` **já lê os commits**
(`:318`). A lacuna **não é de leitura, é de SEQUÊNCIA** — o preflight roda uma vez, antes de abrir o
PR, e o `git merge origin/main` acontece depois, no meio das rodadas. O commit que introduz a
citação nunca passa pelo preflight.
**Defesa (quatro passos):**
1. depois de **todo** merge com a `main`, antes do push:
   `git log <base>..HEAD --format=%B | grep -oE '#[0-9]+'`;
2. mensagem de commit de sincronização **não cita número** — use "sincroniza com origin/main";
3. rode o guard localmente com `PR_BODY` **e** `PR_COMMITS` reunidos;
4. nunca use `#N` para notação que não é issue — escreva `ordem 0`, `item 2`.

## 7 · `total_count: 0` de check runs ≠ "CI rodando"

**Sintoma:** PR sem nenhum check run, interpretado como CI lenta.
**Causa:** o GitHub roda os workflows de `pull_request` contra o **merge ref**; num PR conflitado
(`mergeable_state: dirty`) esse ref não pode ser construído, então **nenhum check run é criado**.
**Defesa:** `total_count: 0` é **sinal de alerta, não prova** de conflito — zero check runs também
acontece com Actions desligadas ou nenhum workflow casando o evento que dispararia o PR. Confirme
`mergeable_state == dirty` diretamente antes de concluir "conflitado" e sincronizar; não infira só
do `total_count`.
**Custo:** confundido três vezes hoje (637, 643, 648).
**Achado da revisão (Codex, PR 654):** a formulação original ("`total_count: 0` significa
conflitado") superclaimava a implicação inversa — corrigida acima.

## 8 · Achado de revisão tem PRAZO DE VALIDADE

**Sintoma:** um P1 do Codex verificado, com conserto escrito e provado — que deixou de compilar.
**Causa:** a `main` mergeou a retirada do deflator no intervalo; `deflatorAreaAbertaPct` não existe
mais no `FluxoConfig`.
**Defesa:** antes de empurrar o conserto de um achado, **reconfirme que ele ainda existe na base
atual**. O prazo de validade é o **próximo merge da base**.
**Crédito:** achado e desfeito pelo executor da #594, que corrigiu a própria thread em vez de
empurrar. Ver PR 650, "Rodada 2 da revisão".

## 9 · O guard de endereços não distingue "o tipo" do "o comportamento"

**Sintoma:** um endereço `arquivo:linha` **errado** passando em verde.
**Causa:** `guard-enderecos-doc` confere o símbolo a **±3 linhas do endereço citado na prosa** — não
qual das ocorrências do símbolo, no arquivo inteiro, é a semanticamente certa. `pctDescartado`
aparece tanto na declaração da interface (`frontend/fluxo-shared.ts:507`) quanto no incremento que
implementa o comportamento (`:579`) — **72 linhas de distância**. A prosa descrevia o comportamento
mas citava `:507`; como `pctDescartado` está *ali*, a ±3 linhas de 507 (é a própria declaração), o
guard aprova — sem saber que a ocorrência relevante para a frase é a outra, distante.
**Defesa:** o guard pega endereço que saiu do arquivo; **não pega endereço que aponta para o membro
errado quando o símbolo tem mais de uma ocorrência**. Isso é trabalho de revisão, não de guard — foi
o Codex que achou, em PR 641.

## 10 · O laço estrutural do `PROGRESSO.md`

**Sintoma:** cada merge conflita **todos** os outros PRs abertos; com 5 abertos, cada merge suja 4.
**Causa:** todo PR prepende uma seção no topo do mesmo arquivo.
**Defesa imediata:** fila **estritamente serial** — sincronizar só o próximo, nunca todos.
**Defesa estrutural (na `main` desde 2026-08-30, PR 653):** `PROGRESSO.md merge=union` no
`.gitattributes`. A premissa foi medida em 40 commits não-merge que tocam o arquivo — **33 são
prepend puro** (1 hunk, zero deleções). O risco foi provado antes de mergear, num repositório de
brinquedo: no pior caso (duas branches editando a mesma região) o `union` produz **duas linhas
contraditórias sem aviso**. É troca deliberada de falha **ruidosa** por falha **calada**, aceitável
porque o arquivo é narrativa append-only. **Não é retroativa:** PR já conflitado precisa sincronizar
com a `main` para herdar o atributo.
**Conferência do merge, sempre pelas TRÊS medidas:** seções = as da base **+1**, **zero** títulos
duplicados, **zero** marcadores residuais. Contagem sozinha não distingue "as duas entraram" de "uma
entrou duas vezes".
**Conferência do merge, sempre pelas TRÊS medidas:** seções = as da base **+1**, **zero** títulos
duplicados, **zero** marcadores residuais. Contagem sozinha não distingue "as duas entraram" de "uma
entrou duas vezes".

## 11 · Justificativa que afirma uma equivalência FALSA

**Sintoma:** um `?? 0` mantido de propósito, com comentário dizendo ser *"a MESMA convenção que
`margemPct` já usa"* — e **duas atestações minhas passaram por cima dele**, porque a frase é
plausível e o código tem a mesma forma.
**Causa:** as duas grandezas têm **denominadores diferentes**. As duas guardas de
`resumoListagem` (`frontend/tela-dashboard.ts`) testam **`vgv`**. `margemLiquidaPct` é `null` sse
`vgv <= 0` — **mesmo predicado da guarda**, então ali o `?? 0` de fato nunca dispara e o comentário
está certo. Mas `roiPct` é `null` sse `investimentoTotal <= 0`, e `investimentoTotal =
custoDiretoTotal + custoIndiretoTotal` (`frontend/proforma.ts`) — grandeza **ortogonal** ao VGV, que
vem do catálogo de produtos.

> ℹ️ **Citações por SÍMBOLO, não por linha, e isto é a armadilha nº 2 aplicada a este próprio
> documento.** Ao escrever esta entrada eu carreguei números de linha da worktree do PR 649 — onde
> `roiPct` já nasce `null` — e **quatro dos oito endereços não resolviam** no arquivo da `main`,
> onde ele ainda devolve `0` porque aquele PR não mergeou. Registro de lição não deve fixar linha de
> código que ainda está em movimento.
**Medido, executando o motor** (Preliminar com catálogo precificado e nenhum custo lançado — o
estado *default* de um estudo recém-criado, porque a receita entra antes do orçamento):

```
vgv = 10.000.000   investimentoTotal = 0   roiPct = null
guarda do Painel (vgv > 0) = true  →  a linha APARECE  →  `p.roiPct ?? 0` publica 0
```

A coluna ROI mostra **`0,0%`** — o número inventado que a issue existia para apagar, e justamente
nos estudos novos, que aparecem no topo do Painel.
**Defesa:** quando um comentário disser *"mesma convenção que X"*, **confira que o PREDICADO é o
mesmo**, não que a forma do código é a mesma. Dois `?? 0` idênticos podem ter garantias opostas.
**Por que é pior que ausência de justificativa:** a frase falsa **esconde** o defeito de quem ler
depois. Sem comentário, alguém investiga; com ele, todo mundo confia.
**Custo:** duas rodadas de atestação com `bloqueantes=0` sobre um defeito vivo. **PR 649**,
que na data deste registro segue aberto — o conserto é exibir `—` no Painel, por decisão do autor.

## 12 · "Declarei que não medi" não é o mesmo que medir

**Sintoma:** atestei `bloqueantes=0` **duas vezes** no mesmo PR, registrando com honestidade que a
premissa do `?? 0` era *"herdada, não medida"*. A honestidade da declaração criou **aparência de
rigor** — e o defeito passou assim mesmo.
**Causa:** declarar uma lacuna a torna **visível**, mas não a **fecha**. Um portão com uma nota
anexada continua sendo um portão aberto.
**Defesa:** premissa não medida **sobre o caminho que o PR está mudando** é **bloqueante** até ser
medida, não observação. Se dá para escrever a frase *"isto eu não exercitei"*, dá para escrever o
teste — neste caso foram **12 linhas** num arquivo temporário.
**O que de fato fechou:** invocar a skill `revisar-pr-apps` **de verdade**, em vez de reproduzir à
mão o que ela prescreve. A lente L3 (rastreador entre arquivos) achou o mesmo defeito de forma
independente, com `arquivo:linha`, no primeiro passe. **Executar o procedimento não é o mesmo que
segui-lo de memória** — e a diferença aqui foi um defeito que teria ido para a `main`.

## 13 · Contagem escrita de aritmética, não de medição

**Sintoma:** escrevi *"978 testes"* na mensagem de um commit quando eram **976**, e duas rodadas
depois escrevi *"979"* quando eram **977**. Nas duas vezes o número saiu de uma conta mental
("acrescentei N testes, então é o anterior + N"), não de rodar a suíte.

**Causa, e ela é específica:** a aritmética usa premissas que envelhecem sem avisar. Na primeira vez
eu tinha acrescentado *asserções* a um teste existente, não um teste novo — o total não muda. Na
segunda, os dois testes que escrevi eram de **backend**, que não entra no glob
`frontend/*.test.ts frontend/fixtures/*.test.ts`. Nos dois casos a conta estava certa e a premissa
errada.

**Por que importa mais do que parece:** o número vai para a mensagem do commit e para o corpo do PR,
onde vira o fato que a próxima sessão cita sem reconferir — e uma contagem errada faz uma prova de
mutação futura parecer que mediu outra coisa. É a mesma família da armadilha 11: uma afirmação
plausível e falsa custa mais que a ausência dela.

**Defesa, mecânica:** **nenhum número entra em commit, PR ou doc sem ter saído de um comando rodado
na mesma sequência de trabalho.** Concretamente, antes de escrever a mensagem:

```
node --test --test-timeout=60000 --import tsx frontend/*.test.ts frontend/fixtures/*.test.ts | grep '^# tests'
```

E o corolário: **contagem que muda a cada rodada não deveria estar num artefato versionado.** O
`CLAUDE.md` já proíbe *"contador do estado corrente da revisão"* pelo mesmo motivo; contagem de
suíte é o mesmo objeto, um degrau mais lento. Onde ela não for necessária, o certo é não escrevê-la.

## 14 · Enumerar entrada suja não converge — inverta para fail-closed

**Sintoma:** a mesma classe de defeito reapareceu **seis vezes** no PR 656, sempre igual: um valor
que não é percentual atravessa `Number()`, vira número plausível, e a migração o grava
permanentemente (o filtro de idempotência só reprocessa coluna nula). As portas, na ordem em que
foram achadas: taxa negativa achatada em `0` por um clamp · `Number('')` valendo `0` ·
`taxaMensal <= -2`, onde o expoente **par** de `(1 + m)^12` devolve `0` ou um positivo enorme ·
`'0x10'` valendo `16` · `'1e3'` valendo `1000` · e o ramo **derivado** ainda usando `Number()` cru
depois de os outros cinco terem sido consertados no ramo da chave.

**Causa:** cada conserto era uma guarda a mais contra a entrada específica que tinha sido achada.
Guarda por enumeração fecha a porta que você viu e deixa as outras; e como havia **dois ramos**, os
consertos divergiam entre si — o ramo derivado ficou cinco rodadas atrás do explícito.

**Defesa:** quando a **segunda** entrada suja da mesma classe aparecer, pare de acrescentar guarda e
**inverta**: um parser único, fail-closed, que aceita a forma válida e devolve `null` para todo o
resto, usado por todos os ramos. Aqui virou `numeroLimpo` — `number` finito, ou string que **seja**
um decimal. A inversão fechou as cinco portas conhecidas **e expôs a sexta**, que ninguém tinha
achado.

**Corolário, e foi o achado mais caro:** contar quantos **validadores** existem para o mesmo campo.
`estudos.juros_tabela_aa_padrao` tinha **três** — tela, PATCH e migração — com regras diferentes, e
o PATCH (a única fronteira real) aceitava exatamente o que a migração rejeitava. Três regras para um
campo é como esta classe começa. Quando não puderem compartilhar código (runtimes diferentes), o que
os mantém alinhados é **uma tabela de entradas exercitada em cada um** — e o que ela NÃO cobrir
precisa estar escrito, não arredondado.
