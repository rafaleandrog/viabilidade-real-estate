# Armadilhas medidas na Rodada 10 — 2026-08-29

> Detalhe completo das dez armadilhas resumidas em `CLAUDE.md` § *As dez armadilhas que a Rodada 10
> pagou*. Cada uma tem: o **sintoma** (como ela se apresenta), a **causa**, a **defesa** (passo, não
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
0.53.8, que é o `shell_min`), mas **não no SDK que a app fixa** (`0.50.3`). O comentário do próprio
código entregava a origem: citava `docs/shell/banco-de-dados.md` *"no monorepo"*.
**Defesa:** a autoridade é o **bundle do SDK instalado**. Se a resposta não está ali, ela NÃO EXISTE
para a app — a pergunta vira "quando isso é publicado?", não "deixa eu ver no shell".
**Agravante que torna isto invisível:** neste ambiente o SDK dá **401**, então `req.dados` erra em
TODO acesso e o erro do método ausente fica camuflado no ruído. O corpo do PR afirmava *"nenhum erro
novo além dos já esperados por falta do SDK"* — afirmação que **parece medida e não é**. Só o CI, com
o token, enxerga.
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
**Defesa:** `total_count: 0` significa **conflitado**, não "rodando". Sincronize.
**Custo:** confundido três vezes hoje (637, 643, 648).

## 8 · Achado de revisão tem PRAZO DE VALIDADE

**Sintoma:** um P1 do Codex verificado, com conserto escrito e provado — que deixou de compilar.
**Causa:** a `main` mergeou a retirada do deflator no intervalo; `deflatorAreaAbertaPct` não existe
mais no `FluxoConfig`.
**Defesa:** antes de empurrar o conserto de um achado, **reconfirme que ele ainda existe na base
atual**. O prazo de validade é o **próximo merge da base**.
**Crédito:** achado e desfeito pelo executor da #594, que corrigiu a própria thread em vez de
empurrar. Ver PR 650, "Rodada 2 da revisão".

## 9 · O guard de endereços não distingue "o tipo" do "o comportamento"

**Sintoma:** dois endereços `arquivo:linha` **errados** passando em verde.
**Causa:** `guard-enderecos-doc` confere o símbolo a **±3 linhas**. `pctDescartado` aparece tanto na
declaração da interface (`:507`) quanto no incremento que implementa o comportamento (`:579`) — a
frase falava do comportamento e apontava para o tipo.
**Defesa:** o guard pega endereço que saiu do arquivo; **não pega endereço que aponta para o membro
errado**. Isso é trabalho de revisão, não de guard — foi o Codex que achou, em PR 641.

## 10 · O laço estrutural do `PROGRESSO.md`

**Sintoma:** cada merge conflita **todos** os outros PRs abertos; com 5 abertos, cada merge suja 4.
**Causa:** todo PR prepende uma seção no topo do mesmo arquivo.
**Defesa imediata:** fila **estritamente serial** — sincronizar só o próximo, nunca todos.
**Defesa estrutural (PR em andamento):** `PROGRESSO.md merge=union` no `.gitattributes`. Risco a
provar antes de mergear: união errada é **calada**, conflito é ruidoso.
**Conferência do merge, sempre pelas TRÊS medidas:** seções = as da base **+1**, **zero** títulos
duplicados, **zero** marcadores residuais. Contagem sozinha não distingue "as duas entraram" de "uma
entrou duas vezes".
