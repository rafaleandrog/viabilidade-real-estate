#!/usr/bin/env bash
# Validação de mudanças de FRONTEND no ambiente Claude Code (web/remoto).
#
# Por que este script existe:
#   O frontend deste app NÃO importa o `@urbiverso/sdk` (usa o global
#   `window.urbiVerso`), então ele valida com os pacotes públicos — lit,
#   typescript, tsx, esbuild, @types/*.
#
#   ⚠️ Este cabeçalho dizia, até 2026-09-03, que o `pnpm install` "sempre termina
#   em 401 e aborta o LINK dos pacotes", e que isso era esperado. NÃO É MAIS: o
#   `scripts/lib/sdk-auth.sh` entrega o `URBIVERSO_PACKAGES_TOKEN` do ambiente ao
#   pnpm, e o install termina limpo, com o SDK no disco. O que mudou não foi a
#   plataforma — foi a descoberta de que o token estava lá o tempo todo. Onde o
#   token não existir, o helper é no-op e o comportamento antigo volta.
#
# O que faz (o "caminho simples" — não perca tempo redescobrindo auth/token):
#   1. guards estáticos: aspas curvas em posição de atributo (#162 — bug que nenhuma
#      das etapas abaixo enxerga, porque mora num template literal do lit), JSON
#      estrito em schema.json/manifesto.json (comentário `//` neles reprova o pacote
#      na instalação — foi o que derrubou a v0.1.19) e ciclo de FK no schema.json
#      (quebra a instalação numa instância virgem, e só lá);
#   2. autentica o SDK (scripts/lib/sdk-auth.sh) e roda `pnpm install`;
#   3. cria os symlinks de topo dos pacotes públicos a partir de `.pnpm/`;
#   4. guards de UI contra o espelho `docs/ui-urbiverso/`: token que não existe,
#      atributo que o primitivo não declara, `width`/`height` de fora num
#      primitivo sem `box-sizing` — as três são falhas 100% SILENCIOSAS, que
#      atravessam typecheck, teste e build em verde. Depois do link porque o
#      lexer deles é o parser do `typescript`;
#   5. guard de ENDEREÇOS de doc: todo `arquivo:linha` citado em
#      `docs/viabilidade/` e em comentário de `frontend/`/`backend/` ainda
#      resolve — o arquivo existe, a linha existe, e o símbolo que a frase cita
#      está a ±3 linhas do alvo. É a única afirmação do repo que nenhuma outra
#      etapa consegue derrubar: um merge da `main` desloca as linhas do arquivo
#      citado e a prosa passa a apontar para outra coisa, em verde. Nesta mesma
#      etapa correm outros dois guards: o de FIAÇÃO (#446/#657) e o do DEFAULT DE
#      ABA (#638). ⚠️ Os TRÊS precisam do pacote `typescript`, que só é linkado na
#      etapa 3/8 — mas por motivos diferentes, e a distinção importa: os dois
#      últimos perguntam à ÁRVORE (`compilador`, o AST), enquanto o de endereços
#      usa o parser só para MASCARAR comentário e string (`analisar`). Os três
#      guards de UI da etapa 4/8 também dependem do parser, então "os que
#      dependem do parser" não são estes três;
#   6. typecheck do frontend (tsconfig só-frontend);
#   7. testes de frontend e build do bundle via esbuild;
#   8. verificação de RENDER em Chromium: monta quatro telas de verdade e mede
#      overflow, transbordo, sobreposição de caixas e cor efetiva por variante
#      de tema. É a única etapa que toca DOM — as etapas anteriores são todas de
#      lógica pura, e nenhuma delas enxerga "o card pintou sobre o vizinho".
#      Depende do Playwright, que NÃO é dependência do produto: sem ele a etapa
#      PULA com aviso alto. No CI ela é obrigatória (job `render`).
#
# Backend, typecheck do backend e `urbi-empacotar` precisam do SDK — e desde
# 2026-09-03 ele É baixado aqui (a etapa 2 autentica). Rode `scripts/validar-backend.sh`
# depois deste; para mudanças só de frontend, este basta. O que continua sendo do
# autor é a sincronização do schema.json pelo SDK e a execução real das migrações.
#
# Uso:  bash scripts/validar-frontend.sh
set -uo pipefail
cd "$(dirname "$0")/.."
raiz="$(pwd)"

# Teste que NÃO TERMINA é o pior modo de falha do CI: em 2026-08-06 o job da PR #304
# ficou `in_progress` no passo `Testes` por horas, sem log nenhum para ler (a API do
# GitHub só serve log de job concluído). São duas defesas, porque cobrem casos
# diferentes e nenhuma cobre as duas:
#   - `--test-timeout` (usado nas etapas 7/8 e 8/8) mata teste ASSÍNCRONO pendurado e diz o
#     NOME do teste. Não pega laço síncrono: `while(true){}` bloqueia o event loop e o
#     próprio timer do runner nunca dispara.
#   - `com_limite` mata o PROCESSO inteiro — é esta que pega o laço síncrono.
# O `command -v` existe porque o Git Bash do Windows nem sempre traz o `timeout`;
# sem ele o comando roda igual, só sem a rede de segurança.
com_limite() {
  local seg="$1"; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seg" "$@"
    local rc=$?
    [ $rc -eq 124 ] && echo "  ABORTADO: passou de ${seg}s sem terminar — provável laço infinito." >&2
    return $rc
  fi
  "$@"
}

# Aspas curvas em posição de ATRIBUTO deixam o atributo INERTE: o parser lê o valor
# com as aspas dentro dele (”alerta” em vez de alerta), o valor não casa com nada e o
# primitivo cai no default — sem erro em lugar nenhum. Como isso mora dentro de um
# template literal do lit, `tsc --noEmit`, os testes e o esbuild passam todos em verde
# (foi assim que o #160 sobreviveu a uma sessão inteira que "validou ✓").
#
# O padrão casa só com `=` seguido de aspa curva, então NÃO acusa as aspas curvas em
# conteúdo de texto (clique em “Salvar premissas”), que são tipografia legítima.
#
# Por que alternância `\(”\|“\)` e não a classe `[”“]`: sem locale UTF-8 (o caso deste
# ambiente, LANG vazio) o grep casa a classe BYTE a byte, e como ”/“/—/→ compartilham
# o primeiro byte 0xE2, `=[”“]` daria falso positivo em `=—` e `=→`. A alternância
# compara as sequências de 3 bytes inteiras e acerta em qualquer locale.
echo "== 1/8 guards estáticos (aspas curvas + JSON estrito + ciclos de schema) =="
if grep -rn '=\(”\|“\|‘\|’\)' frontend/; then
  echo "  FALHOU: aspas curvas em atributo — o atributo fica inerte. Use aspas retas." >&2
  exit 1
fi

# `schema.json`/`manifesto.json` têm que ser JSON estrito — comentário `//` neles
# reprova o pacote na instalação ("Pacote reprovado na validacao") e não aparece em
# nenhuma outra etapa daqui. Mora neste script, e não só no validar-backend.sh, porque
# aquele aborta antes do parse quando o SDK não está em node_modules (o caso deste
# ambiente). Ver o cabeçalho de scripts/guard-json.mjs.
node scripts/guard-json.mjs || exit 1

# Ciclo de FK entre tabelas do `schema.json` quebra a instalação numa instância
# VIRGEM (a FK nasce inline no CREATE TABLE; num ciclo não há ordem que sirva), e
# NÃO aparece em instância que já tem a app — lá as colunas chegaram por ALTER
# TABLE. Foi o que reprovou a instalação na homolog com
# `[dry_run_schema] relation "viabilidade.estudos" does not exist`.
# Ver o cabeçalho de scripts/guard-schema-ciclos.mjs.
node scripts/guard-schema-ciclos.mjs || exit 1

echo "  ok: nenhuma aspa curva em atributo"

# Os três guards de UI leem `docs/ui-urbiverso/` — o espelho versionado da
# referência do urbiverso — e por isso rodam com `node` puro, sem SDK, sem
# credencial e sem rede. Ficam ANTES do `pnpm install` de propósito: são a etapa
# mais barata do script e falham em menos de um segundo.
#
# As três classes que eles pegam são 100% silenciosas, cada uma por um motivo:
#   · `var(--nao-existe, #hex)` não dá erro — o fallback vira a cor efetiva, para
#     sempre, e some quando o tema muda (foi o `--cor-superficie-2`, #475);
#   · atributo que o primitivo não declara não dá erro — ele não faz nada, e a
#     prop fica no default;
#   · `width` de fora num `urbi-*` sem `box-sizing: border-box` renderiza uma
#     caixa maior que o pedido, e pinta sobre o vizinho (o urbi-kpi, quatro vezes
#     reportado: #176, #262, #326, #352).
# Nenhuma delas aparece no typecheck, nos testes ou no esbuild.
echo "== 2/8 pnpm install =="
# A auth do SDK vem daqui: sem ela o install termina em 401 e o `node_modules/
# @urbiverso/sdk` não existe — que é o que fazia `validar-backend.sh` abortar na
# etapa 1/5 e toda revisão sair com `contratos=nao-executados`.
# `$raiz`, não `$(dirname "$0")`: a linha 56 já fez `cd`, e o $0 aponta para um
# diretório que não é mais a cwd — o source falharia CALADO (não há `set -e`).
. "$raiz/scripts/lib/sdk-auth.sh"
# O `|| true` FICA: sem token o 401 volta a acontecer, e o frontend continua
# validável só com os pacotes públicos, que é o caso que este script atende
# desde sempre. Quem depende do SDK é o validar-backend.sh, e ele tem gate próprio.
urbi_pnpm_install >/dev/null 2>&1 || true
if [ ! -d node_modules/.pnpm ]; then
  echo "ERRO: node_modules/.pnpm não existe — o pnpm não conseguiu baixar nem os pacotes públicos (sem rede?)." >&2
  exit 1
fi

echo "== 3/8 linkando pacotes públicos do store virtual (.pnpm) =="
# link_pkg <glob-do-dir-em-.pnpm> <subcaminho-interno> <alvo-em-node_modules>
link_pkg() {
  local glob="$1" interno="$2" alvo="$3"
  local dir
  dir="$(ls -d node_modules/.pnpm/$glob/node_modules/$interno 2>/dev/null | head -1)"
  if [ -z "$dir" ]; then echo "  aviso: não achei $glob ($interno) no store" >&2; return 0; fi
  mkdir -p "$(dirname "node_modules/$alvo")"
  ln -sfn "$raiz/$dir" "node_modules/$alvo"
  echo "  ok: $alvo"
}
link_pkg 'lit@*'                     'lit'                    'lit'
link_pkg 'lit-html@*'                'lit-html'               'lit-html'
link_pkg 'lit-element@*'             'lit-element'            'lit-element'
link_pkg '@lit+reactive-element@*'   '@lit/reactive-element'  '@lit/reactive-element'
link_pkg '@types+node@20*'           '@types/node'            '@types/node'
link_pkg '@types+trusted-types@*'    '@types/trusted-types'   '@types/trusted-types'
link_pkg 'typescript@*'              'typescript'             'typescript'
link_pkg 'tsx@*'                     'tsx'                    'tsx'
link_pkg 'esbuild@0.24*'             'esbuild'                'esbuild'

tsc="node_modules/typescript/bin/tsc"
esbuild_bin="node_modules/esbuild/bin/esbuild"

# ⚠️ ESTA ETAPA VEM DEPOIS DO LINK, e não junto dos outros guards estáticos, por
# um motivo: desde a 3ª rodada de revisão do PR 505 o lexer de JS/TS dos guards é
# o PARSER do `typescript`. Sem o pacote linkado eles RECUSAM analisar — que é o
# comportamento certo, mas num clone novo faria a validação morrer antes de
# instalar o que ela mesma precisa.
echo "== 4/8 guards de UI (tokens + props de primitivo + box model) =="
node scripts/guard-tokens-css.mjs || exit 1
node scripts/guard-props-urbi.mjs || exit 1
node scripts/guard-box-model-urbi.mjs || exit 1
# As duas baterias. Guard falha calado nos DOIS sentidos: falso negativo deixa o
# defeito passar; falso positivo reprova código correto, alguém desliga o guard,
# e aí ele não guarda mais nada.
#
# `testar-fonte-ts.sh` é a do lexer compartilhado, que é onde os três decidem
# fronteira de comentário, string e template — um erro lá erra nos três de uma
# vez.
com_limite 120 bash scripts/testar-fonte-ts.sh >/dev/null || {
  echo "  bateria do lexer FALHOU — rode: bash scripts/testar-fonte-ts.sh" >&2
  exit 1
}
com_limite 120 bash scripts/testar-guards-ui.sh >/dev/null || {
  echo "  bateria dos guards de UI FALHOU — rode: bash scripts/testar-guards-ui.sh" >&2
  exit 1
}
echo "  ok: baterias do lexer e dos guards de UI verdes"

echo "== 5/8 guards de parser (endereços de doc + fiação + default de aba) =="
# Endereço `arquivo:linha` em prosa é a ÚNICA afirmação deste repositório que
# nenhuma outra etapa consegue derrubar: `tsc`, `node --test`, o `esbuild` e o
# render-check não leem prosa. Um merge da `main` desloca as linhas do arquivo
# citado e a citação passa a apontar para outra coisa, em verde.
#
# Fica DEPOIS do link (etapa 3/8) porque, em `.ts`, quem decide o que é
# comentário é o parser do `typescript` — a mesma autoridade dos guards de UI.
node scripts/guard-enderecos-doc.mjs || exit 1
# A bateria, pelos DOIS sentidos. Falso positivo aqui é o modo de falha mais
# caro: guard que atrapalha trabalho legítimo é desligado, e aí não guarda mais
# nada. Por isso ela tem mais casos de "não acusa" do que de "acusa".
com_limite 120 bash scripts/testar-guard-enderecos-doc.sh >/dev/null || {
  echo "  bateria do guard de endereços FALHOU — rode: bash scripts/testar-guard-enderecos-doc.sh" >&2
  exit 1
}
echo "  ok: bateria do guard de endereços verde"

# #657/#658: a bateria do guard de FIAÇÃO. Ela mora aqui, e não só no CI, porque
# o guard já falhou calado duas vezes no PR que o criou — primeiro conferindo
# presença no arquivo em vez de escopo, depois contando chaves dentro de string
# e comentário. Os dois modos de falha estão nos casos 3 e 4, e a bateria foi
# conferida contra a versão ANTIGA do recorte: ela reprova.
# #446 — a FIAÇÃO do horizonte de funding, mais a regra do nascimento canônico
# (#657). Medido: apagar `operacoesFunding` de `tela-funding.ts` deixou a suíte
# INTEIRA verde; nenhuma outra etapa deste script enxerga essa omissão.
#
# ⚠️ Ele rodava na etapa 1/8, junto dos guards baratos, quando era só
# `readFileSync` + regex. SAIU DE LÁ e veio para cá — achado do revisor externo
# no PR 658: a regra do nascimento canônico passou a decidir pelo PARSER do
# typescript, e o parser só existe depois do link (etapa 3/8). Num clone limpo,
# a chamada na etapa 1 saía 2 (fail-closed, como deve) e o validador abortava
# ANTES de poder instalar a própria dependência. A minha árvore já tinha
# `node_modules`, então eu nunca veria isso rodando aqui.
#
# É o mesmo motivo pelo qual `guard-enderecos-doc` mora nesta etapa, e está
# escrito no cabeçalho dele.
node scripts/guard-fiacao-funding.mjs || exit 1
com_limite 120 bash scripts/testar-guard-fiacao.sh >/dev/null || {
  echo "  bateria do guard de fiação FALHOU — rode: bash scripts/testar-guard-fiacao.sh" >&2
  exit 1
}
echo "  ok: guard de fiação e bateria verdes"

# #638: a aba default do Avançado é um LITERAL e não pode depender da ORDEM de
# `PAGINAS`. São duas regras, e a segunda existe porque a primeira, sozinha, foi
# furada em quatro rodadas de revisão: perguntar "onde está o fallback e ele é
# literal?" depende de ALCANÇABILIDADE, que a árvore não responde. Mora nesta
# etapa pelo mesmo motivo dos dois acima — decide pelo parser do typescript, que
# só existe depois do link (etapa 3/8).
#
# Medido em 2026-09-02, e é a razão de o guard existir: trocar as DUAS origens do
# default por `PAGINAS[0].id` deixa o typecheck, a suíte de frontend e os casos de
# render INTEIRAMENTE VERDES. A coincidência de `'resumo'` ser a 1ª página torna a
# derivação indistinguível do literal em toda asserção de comportamento; só uma
# pergunta de ÁRVORE separa as duas, e hoje quem reprova é este guard — só ele.
#
# ⚠️ A frase acima já teve `este script 8/8 verde` como sujeito, e era
# AUTO-FALSIFICANTE: o script é o que este commit muda, então repetir a medição
# hoje dá 5/8 vermelho. É a armadilha de redação nomeada no `CLAUDE.md`
# § Processo. O sujeito certo é a suíte, que continua sem enxergar a troca.
node scripts/guard-aba-default-literal.mjs || exit 1
com_limite 120 bash scripts/testar-guard-aba-default.sh >/dev/null || {
  echo "  bateria do guard de default de aba FALHOU — rode: bash scripts/testar-guard-aba-default.sh" >&2
  exit 1
}
echo "  ok: guard de default de aba e bateria verdes"

echo "== 6/8 typecheck do frontend =="
# ⚠️ `scripts/**/*.ts` entra aqui, e NÃO é enfeite. O `tsconfig.json` da raiz
# inclui só `frontend/` e `backend/`, então nada typechecava os scripts — e eles
# IMPORTAM o frontend. Em 2026-08-23 o PR da #430 renomeou `pctPosObraDerivado`
# e deixou `scripts/conferir-estudo.ts` importando um símbolo inexistente: o
# script morria no link do módulo, e `validar-frontend.sh` ficava verde.
# Não era um script qualquer — é o único que reexecuta os motores contra a
# instância viva, ou seja, exatamente o instrumento que mediria a promessa
# "nenhum número muda" daquele PR.
cat > tsconfig.frontend.json <<'JSON'
{ "extends": "./tsconfig.json", "include": ["frontend/**/*", "scripts/**/*.ts"] }
JSON
node "$tsc" --noEmit -p tsconfig.frontend.json
tc=$?
rm -f tsconfig.frontend.json
[ $tc -eq 0 ] && echo "  typecheck OK" || { echo "  typecheck FALHOU"; exit 1; }

echo "== 7/8 testes de frontend + build do bundle =="
# `frontend/*.test.ts` NÃO alcança subdiretório: até 2026-08-11 os 16 golden
# cases do Capital Stack (frontend/fixtures/capital-stack-golden.test.ts, hoje
# apagado — a #355 substituiu o modelo) nunca rodaram, nem aqui nem no
# `pnpm test`. O segundo glob conserta isso — mas só quando ele CASA com pelo
# menos um arquivo: com `frontend/fixtures/` sem nenhum `.test.ts` (caso desde
# a #355, calliandra-golden.test.ts mora em `frontend/`, não em `fixtures/`),
# o glob fica literal (nullglob é off por padrão) e o `node --test` de algumas
# versões do Node trata isso como "arquivo não encontrado" e ABORTA A SUÍTE
# INTEIRA — silenciosamente correto localmente (Node 22), vermelho no runner
# do CI. Só inclui o segundo glob quando `compgen` confirma que ele casa com
# algo.
test_globs=(frontend/*.test.ts)
if compgen -G "frontend/fixtures/*.test.ts" > /dev/null; then
  test_globs+=(frontend/fixtures/*.test.ts)
fi
com_limite 300 node --import tsx/esm --test --test-timeout=60000 "${test_globs[@]}"
tst=$?
[ $tst -eq 0 ] || { echo "  testes FALHARAM"; exit 1; }

"$esbuild_bin" frontend/index.ts --bundle --external:@urbiverso/ui \
  --format=esm --outfile=/dev/null --target=es2022 --minify --tsconfig=tsconfig.json
bd=$?
[ $bd -eq 0 ] || { echo "  build FALHOU"; exit 1; }

echo "== 8/8 verificação de render em Chromium =="
# ⚠️ Este marcador é o que impede a ÚLTIMA LINHA de mentir. A versão anterior
# anunciava "render OK" mesmo quando esta etapa era pulada por falta de
# Playwright — um cenário que o próprio script suporta de propósito. Quem lê só
# a linha de resumo registrava validação que não aconteceu, e a linha de resumo
# é onde mais gente olha. É a mesma classe do defeito central deste PR
# (reportar limpo sem ter medido), e é literalmente o que o CLAUDE.md chama de
# "não deu para rodar nunca é passou". Achado do Codex, rodada 4.
render_rodou=0
# Por que esta etapa existe: até aqui NENHUM teste toca DOM. Overflow,
# transbordo, sobreposição de caixa e cor efetiva por tema não existem antes do
# layout — e é dessa classe o defeito do `urbi-kpi`, reportado quatro vezes
# (#176, #262, #326, #352) e fechado quatro sem nunca ficar vermelho em lugar
# nenhum. Ver o cabeçalho de scripts/render-check.mjs.
#
# ⚠️ A ASSIMETRIA ENTRE AQUI E O CI É DELIBERADA, e é a parte que se lê errado:
#   · aqui, sem Playwright, a etapa PULA — a máquina do autor não tem o pacote
#     (ele não é dependência do produto) e não deveria ficar impedida de validar
#     frontend por causa disso;
#   · no CI (job `render` de pr-guards.yml) `RENDER_CHECK_OBRIGATORIO=1` faz a
#     ausência REPROVAR.
# Sem a segunda metade, "não deu para rodar" viraria "passou" — o modo de falha
# que o CLAUDE.md nomeia. Por isso o aviso abaixo é ALTO: pulo silencioso faria
# desta camada inteira enfeite.
if node -e "import('$raiz/scripts/render-check.mjs').then((m) => m.harnessDisponivel()).then((d) => process.exit(d.ok ? 0 : 1)).catch(() => process.exit(1));" 2>/dev/null; then
  # `frontend/render/*.render.test.ts` NÃO é alcançado por `frontend/*.test.ts`
  # — o mesmo buraco que deixou os 16 golden cases do Capital Stack escritos e
  # nunca executados por uma rodada inteira. O `compgen` confirma que o glob
  # casa antes de passá-lo ao node (glob que não casa fica literal, e algumas
  # versões do Node abortam a suíte inteira nessa condição).
  if compgen -G "frontend/render/*.render.test.ts" > /dev/null; then
    RENDER_CHECK_OBRIGATORIO=1 com_limite 600 node --import tsx/esm --test \
      --test-timeout=180000 frontend/render/*.render.test.ts
    rd=$?
    [ $rd -eq 0 ] || { echo "  render FALHOU"; exit 1; }
    render_rodou=1
  else
    echo "  aviso: nenhum caso em frontend/render/*.render.test.ts" >&2
  fi
else
  echo
  echo "  ####################################################################"
  echo "  #  ETAPA 8/8 (RENDER) NAO EXECUTADA - Playwright/Chromium ausente. #"
  echo "  #  Nada foi medido em DOM. Isto NAO e 'passou'.                    #"
  echo "  #  O job render do CI roda com RENDER_CHECK_OBRIGATORIO=1 e        #"
  echo "  #  reprova exatamente nesta condicao.                              #"
  echo "  ####################################################################"
  echo
fi

echo
if [ "$render_rodou" = "1" ]; then
  echo "✅ Frontend validado: typecheck + testes + build + render OK."
else
  echo "⚠️  Frontend validado PARCIALMENTE: typecheck + testes + build OK."
  echo "    RENDER NÃO EXECUTADO (etapa 8/8 pulada) — nada foi medido em DOM."
  echo "    Isto NÃO é 'render OK'. O job \`render\` do CI reprova nesta condição."
fi
