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
# **Exposição do segredo:** ele vai no ambiente do processo filho, não no argv.
# `/proc/<pid>/environ` é legível só pelo dono; `ps` mostra a linha de comando
# para qualquer usuário da máquina. Por isso `env VAR=… pnpm` e não
# `pnpm --//…_authToken=…`, que funciona igual e vazaria no `ps`.
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
