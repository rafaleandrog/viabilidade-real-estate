# Auth do @urbiverso/sdk (GitHub Packages privado) — arquivo SOURCED, nunca executado.
#
# POR QUE ELE EXISTE
#
# Até 2026-09-03 este repositório operava sob a premissa de que o SDK era
# inalcançável aqui: o CLAUDE.md mandava, em caixa alta, NÃO perder tempo com
# `.npmrc` porque "a auth disponível não tem acesso". A premissa era falsa —
# `URBIVERSO_PACKAGES_TOKEN` está nas variáveis do cloud environment, e faltava
# só entregá-lo ao pnpm. O custo era estrutural: `validar-backend.sh` abortava na
# etapa 1/5, backend/schema/migração saíam de toda sessão como "pendentes do
# autor", e a camada de contratos da revisão nunca rodava.
#
# ── A FORMA, E POR QUE ELA É ESTA ────────────────────────────────────────────
#
# Uma variável de config do npm, passada por `env` ao comando que precisa dela.
# Nada é escrito em disco, nada é exportado para o resto do script, e nenhum
# arquivo de configuração de ninguém é lido, copiado ou substituído.
#
# ⚠️ **As três formas que NÃO servem, para nenhuma delas ser redescoberta:**
#
#   1. `export npm_config_//npm.pkg.github.com/:_authToken=…` — o bash RECUSA o
#      nome ("not a valid identifier"): barra e dois-pontos não são identificador.
#      Só `env NOME=valor comando` passa essa variável. É o que se faz aqui.
#   2. Escrever `~/.npmrc` — DESTRUTIVO. Este script roda também na máquina do
#      autor, e sobrescrever o npmrc dele apagaria configuração alheia.
#   3. Um npmrc temporário apontado por `NPM_CONFIG_USERCONFIG` — foi a primeira
#      implementação deste arquivo, e ela custou quatro rodadas de revisão em
#      defeitos SEUS, não do problema: `$HOME` indefinido matando o validador sob
#      `set -u`; guarda de "já tem auth" aceitando valor vazio e o placeholder
#      `${NODE_AUTH_TOKEN}` que o `setup-node` escreve; `//` inicial tolerado,
#      forma em que o npm não manda auth nenhuma; `head -1` onde o npm resolve
#      chave repetida pela ÚLTIMA; o temp com o segredo vazando na segunda
#      invocação; e `cat origem > rc` sem newline final colando `registry=` na
#      linha do token. **A lição é a armadilha 14 do CLAUDE.md**: na segunda
#      entrada suja da mesma classe, o conserto não é mais uma guarda — é inverter
#      o desenho. Aqui a inversão foi apagar a máquina de casos-limite inteira.
#
# **Exposição do segredo, com a ressalva medida.** Ele vai no AMBIENTE do processo
# filho, e `/proc/<pid>/environ` é legível só pelo dono — enquanto `ps` mostra o
# argv para qualquer usuário da máquina. Por isso `env VAR=… pnpm` e não
# `pnpm --//…_authToken=…`, que funciona igual e ficaria visível o tempo todo.
#
# ⚠️ **A ressalva, levantada pelo Codex neste PR (P2) e ACEITA como trade-off, não
# refutada:** `env NAME=VALUE cmd` recebe o `NAME=VALUE` como **operando**, então o
# segredo passa pelo argv do próprio `/usr/bin/env` até ele fazer `exec` do pnpm.
# A janela é de microssegundos e exige um amostrador de `ps` rodando como outro
# usuário na mesma máquina. A alternativa que fecharia essa janela é um arquivo
# temporário com o token e `NPM_CONFIG_GLOBALCONFIG` — ou seja, **segredo em
# repouso no disco** em vez de um instante no argv, mais `mktemp`, `trap` e os
# caminhos de falha de cada um. Foi exatamente essa máquina que custou cinco
# rodadas de revisão neste PR, e a troca não vale num container efêmero de um
# usuário só.
#
# **Se o ambiente mudar** — máquina compartilhada, host de CI multiusuário —, a
# decisão se inverte, e o caminho é `NPM_CONFIG_GLOBALCONFIG` (e **não**
# `NPM_CONFIG_USERCONFIG`, que sombreia o `~/.npmrc` do usuário; o globalconfig
# tem precedência menor e convive com ele).
#
# **No-op sem token** (máquina do autor, CI — que autentica pelo `setup-node`):
# roda o `pnpm install` pelado, e quem falha, se falhar, é o pnpm com a mensagem
# dele. Nenhuma guarda a mais: não há o que decidir.
#
# ⚠️ Ele não se invoca sozinho — `scripts/lib/LEIA.md` é explícito: *"aqui dentro
# nada se roda sozinho"*. Quem chama é o validador.
#
# Uso:  . "$raiz"/scripts/lib/sdk-auth.sh
#       urbi_pnpm_install >/dev/null 2>&1 || true
#
# ⚠️ O caminho do `source` sai de `$raiz`, NUNCA de `$(dirname "$0")`: o validador
# faz `cd "$(dirname "$0")/.."` logo no começo, então na hora do source o `$0` já
# é relativo a um diretório que não é mais a cwd. Com `$(dirname "$0")` o source
# falha, e como o script não usa `set -e`, ele falha CALADO.

urbi_pnpm_install() {
  if [ -n "${URBIVERSO_PACKAGES_TOKEN:-}" ]; then
    env "npm_config_//npm.pkg.github.com/:_authToken=$URBIVERSO_PACKAGES_TOKEN" pnpm install "$@"
  else
    pnpm install "$@"
  fi
}
