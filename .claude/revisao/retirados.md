<!-- CORPUS-REVISAO: marcador carimbado por scripts/carimbar-corpus-revisao.mjs. NÃO edite à mão. -->
<!-- corpus=v13-ecce9abf -->

# Achados retirados — não levante de novo sem evidência nova

Cada entrada aqui é um achado que **foi levantado por uma lente, verificado, e derrubado**. O
registro existe por um motivo aritmético: sem ele, o mesmo falso positivo volta a cada revisão e
custa um ciclo de verificação do orquestrador **toda vez**.

**Como usar, se você é uma lente:** leia antes de escrever o achado. Se o que você ia levantar está
aqui, você precisa de **evidência nova** — o mundo mudou, ou a entrada está errada. Nos dois casos,
diga qual é a evidência. Silenciar um achado real por causa desta lista é tão ruim quanto repetir um
falso; a lista tira o **automático**, não o julgamento.

**Como escrever uma entrada** — os quatro campos são obrigatórios, e a bateria
`scripts/testar-corpus-revisao.mjs` reprova entrada incompleta:

```
### <título curto do achado>
- **Afirmação:** o que a lente disse
- **Por que é falsa:** a razão
- **Evidência:** o comando, o arquivo:linha ou a medição que derrubou
- **Data:** AAAA-MM-DD · PR <n>
```

Entrada que **deixou de valer** — o código mudou e o achado voltaria a ser verdadeiro — não é
apagada: ganha a linha `- **Revogada:** <motivo> · <data>` e sai de circulação com história.

⚠️ **Entradas se separam por linha em branco, nunca por `---`.** Este arquivo tem **exatamente uma**
divisória `---`, a que fecha esta explicação — e é ela que o carimbador e a bateria usam para excluir
o molde acima da contagem de entradas. Uma segunda divisória, em qualquer posição, reprova
`scripts/testar-corpus-revisao.mjs`. A regra está aqui porque é aqui que se escreve entrada; sem
isso, quem separasse duas entradas com uma divisória tomava vermelho com uma mensagem sobre o molde,
que não descreve o caso dele. Achado de lente.

---

### O binário `kimi` não existe em `/opt/node22/bin`

- **Afirmação:** *"Hoje `/opt/node22/bin` contém **apenas** `node` — não há `kimi` ali, nem em
  `/usr/local/bin`, `~/.local/bin` ou `/opt/node22/lib/node_modules."*
- **Por que é falsa:** a lente não alcança `/opt` com `Read`/`Grep`/`Glob` — o diretório de trabalho
  dela é a árvore do repositório. Ela traduziu "não consigo ler" em "não existe", que é a classe
  descrita em `aprendizados.md` § 1.
- **Evidência:** `command -v kimi` → `/opt/node22/bin/kimi`; `readlink -f` → `../lib/node_modules/@moonshot-ai/kimi-code/dist/main.mjs`;
  `ls -la` mostra o symlink. E a própria revisão que levantou o achado **estava rodando nesse binário**.
- **Data:** 2026-09-16 · PR 737

### `$HOME` expandido sem aspas dentro de `[ -s … ]`

- **Afirmação:** *"a nova expande `$HOME` nu dentro de `[ ]`, e um HOME com espaço ou `*` quebra o
  teste por word splitting/globbing"*.
- **Por que é falsa:** a expansão **está** entre aspas nos dois hooks — a própria citação que a
  lente colou no achado mostra `"$HOME/.codex/auth.json"`. A lente contradisse a evidência que ela
  mesma trouxe.
- **Evidência:** `grep -n 'codex/auth.json' .claude/lembrete-processo.sh .claude/preparar-sessao.sh`
  mostra as aspas; e com `HOME` contendo espaço o hook executa limpo (`rc=0`, medido).
- **Data:** 2026-09-16 · PR 737

### Copiar o `AGENTS.md` do monorepo faz o conhecimento do repo chegar às lentes

- **Afirmação:** o `.claude/motor-revisao.md` do monorepo afirma que *"os dois motores procuram
  `AGENTS.md` … e o injetam como dado de referência"*, do que se conclui que basta pôr o arquivo na
  raiz para a lente conhecer as convenções do repositório.
- **Por que é falsa:** **nesta escala de repositório, nada é injetado.** Num repositório minúsculo o
  CLI injeta um **retrato do projeto** — e por isso acerta até o conteúdo de arquivo que o
  `AGENTS.md` nunca apontou, o que revela que não é o `AGENTS.md` que está sendo seguido. No
  repositório real, nem o `CLAUDE.md` nem um `AGENTS.md` na raiz chegam à lente.
- **Evidência:** quatro execuções do `kimi-k3`, todas com **zero chamadas de ferramenta** — repo
  minúsculo com sentinela no `AGENTS.md`: acertou; repo minúsculo, arquivo **não apontado**: também
  acertou; repo real, sentinela do `CLAUDE.md`: **`NAO SEI`**; repo real, `AGENTS.md` na raiz com
  sentinela: **`NAO SEI`**.
- **Data:** 2026-09-16 · PR 738

> ⚠️ A terceira entrada é de natureza diferente das duas primeiras: não é falso positivo de lente, é
> **premissa de desenho** que foi medida e reprovada. Mora aqui pelo mesmo motivo — sem o registro,
> a próxima sessão lê o doc do monorepo e tenta de novo. É por causa dela que o briefing **manda
> ler** este corpo em vez de confiar em injeção automática.
