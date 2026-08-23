#!/bin/bash
# Bateria dos três guards estáticos de UI:
#   scripts/guard-tokens-css.mjs · guard-props-urbi.mjs · guard-box-model-urbi.mjs
#
# POR QUE ELA EXISTE
#
# Guard falha CALADO nos dois sentidos, e os dois custam caro:
#   - falso negativo → o defeito passa, e o guard vira teatro. Pior que não ter
#     guard, porque agora existe a impressão de cobertura;
#   - falso positivo → o guard reprova código correto, alguém o desliga, e aí ele
#     não guarda mais nada. É o modo de falha que a própria construção do espelho
#     já produziu duas vezes (kebab-case em vez de minúsculo, herança não
#     percorrida) — nos dois casos o guard reprovaria uso legítimo.
# Metade dos casos abaixo é de cada sentido, de propósito.
#
# COMO ELA É DETERMINÍSTICA
#
# Nada aqui lê o `frontend/` nem o `docs/ui-urbiverso/` do repositório. Cada caso
# monta um REPOSITÓRIO DE MENTIRA num diretório temporário — `scripts/` com os
# guards copiados, `docs/ui-urbiverso/` com um espelho sintético escrito aqui
# dentro, `frontend/` com o arquivo do caso — e roda o guard contra ele. Logo:
#   · ressincronizar o espelho não muda veredito nenhum;
#   · consertar (ou quebrar) um arquivo do app não muda veredito nenhum;
#   · o resultado depende só do código dos guards, que é o que se quer medir.
# Quem confronta os guards com o app de verdade é `scripts/validar-frontend.sh`.
#
# O espelho sintético é minúsculo e nomeia os primitivos pelo PAPEL que exercem
# no teste (`urbi-arriscado`, `urbi-seguro`, `urbi-so-largura`) — um teste que
# dependesse de `urbi-kpi` continuar sendo o único em risco quebraria no dia em
# que o monorepo consertasse o `:host` dele, que é justamente o dia em que nada
# deveria quebrar.
#
# Roda sem credencial, sem rede e sem SDK: só bash + node.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
RAIZ="$(pwd)"

for g in guard-tokens-css guard-props-urbi guard-box-model-urbi; do
  [ -f "scripts/$g.mjs" ] || { echo "ERRO: scripts/$g.mjs não existe"; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FALHAS=0
TOTAL=0

# O repositório de mentira não tem `node_modules`, e desde a 3ª rodada de revisão
# do PR 505 os guards precisam do parser do `typescript`. Aponta-se o do repo —
# que é o MESMO mecanismo que o job `guards-ui` do CI usa, então esta bateria
# também exercita o caminho da variável.
# ⚠️ HONRA o `URBI_TYPESCRIPT` herdado antes de cair no `node_modules` da raiz.
# A versão anterior SOBRESCREVIA a variável com o caminho da raiz — e no CI o
# `typescript` é instalado isolado, em `.ts-guards/`, justamente para não ler o
# `package.json` do repo e tomar 401 do SDK privado. Resultado: o job definia a
# variável certa, a bateria a jogava fora, procurava na raiz, não achava e
# reprovava. Verde local, vermelho no CI.
if [ -n "${URBI_TYPESCRIPT:-}" ] && [ -f "${URBI_TYPESCRIPT}" ]; then
  TS_REAL="$URBI_TYPESCRIPT"
else
  TS_REAL="$RAIZ/node_modules/typescript/lib/typescript.js"
fi
if [ ! -f "$TS_REAL" ]; then
  echo "ERRO: não achei o parser do typescript." >&2
  echo "      procurei em: $TS_REAL" >&2
  echo "      rode antes: bash scripts/validar-frontend.sh" >&2
  echo "      ou aponte URBI_TYPESCRIPT para .../typescript/lib/typescript.js" >&2
  exit 1
fi
export URBI_TYPESCRIPT="$TS_REAL"

# ── espelho sintético ───────────────────────────────────────────────────────
mkdir -p "$TMP/base/scripts/lib" "$TMP/base/docs/ui-urbiverso"
cp scripts/guard-tokens-css.mjs scripts/guard-props-urbi.mjs scripts/guard-box-model-urbi.mjs "$TMP/base/scripts/"
cp scripts/lib/fonte-ts.mjs "$TMP/base/scripts/lib/"

cat > "$TMP/base/docs/ui-urbiverso/tokens.json" <<'JSON'
{
  "carimbo": { "gerado_de": "fixture", "sha": "0000000000", "versao_monorepo": "0.0.0", "data_do_commit": "2026-01-01" },
  "tokens": {
    "--cor-texto": ["#fff", "#000"],
    "--cor-borda": ["#111"],
    "--cor-superficie-sutil": ["#222"]
  }
}
JSON

# `urbi-arriscado`   — padding+border no :host, sem box-sizing → risco nos 2 eixos
# `urbi-so-largura`  — `padding: 0 16px` → risco SÓ na largura (separação de eixos)
# `urbi-seguro`      — padding com box-sizing: border-box → sem risco
# `urbi-conv`        — honra `expandir`; `urbi-seguro` NÃO honra
# `urbi-kpi`         — existe aqui só porque a lista DISPENSAS do guard, que é
#                      código de verdade e precisa ser exercitada, nomeia o
#                      seletor real. O risco dele é declarado POR ESTA FIXTURE,
#                      não lido do monorepo: no dia em que o `:host` de verdade
#                      ganhar `box-sizing`, nada aqui muda de veredito.
cat > "$TMP/base/docs/ui-urbiverso/primitivos.json" <<'JSON'
{
  "carimbo": { "gerado_de": "fixture", "sha": "0000000000", "versao_monorepo": "0.0.0", "data_do_commit": "2026-01-01" },
  "primitivos": {
    "urbi-arriscado": {
      "classe": "UrbiArriscado", "arquivo": "ui/src/x.ts", "base": null, "linhagem": ["UrbiArriscado"],
      "props": [
        { "propriedade": "rotulo", "atributo": "rotulo", "so_propriedade": false, "tipo": "String", "reflete": false, "de": "UrbiArriscado" },
        { "propriedade": "valor", "atributo": null, "so_propriedade": true, "tipo": "Object", "reflete": false, "de": "UrbiArriscado" }
      ],
      "atributos_convencao": [],
      "host": [
        { "seletor": ":host", "prop": "padding", "valor": "14px 16px", "de": "UrbiArriscado" },
        { "seletor": ":host", "prop": "border", "valor": "1px solid var(--cor-borda)", "de": "UrbiArriscado" }
      ],
      "risco_box_model": true, "risco_box_model_altura": true
    },
    "urbi-so-largura": {
      "classe": "UrbiSoLargura", "arquivo": "ui/src/x.ts", "base": null, "linhagem": ["UrbiSoLargura"],
      "props": [], "atributos_convencao": [],
      "host": [{ "seletor": ":host", "prop": "padding", "valor": "0 16px", "de": "UrbiSoLargura" }],
      "risco_box_model": true, "risco_box_model_altura": false
    },
    "urbi-seguro": {
      "classe": "UrbiSeguro", "arquivo": "ui/src/x.ts", "base": null, "linhagem": ["UrbiSeguro"],
      "props": [
        { "propriedade": "maxWidth", "atributo": "maxwidth", "so_propriedade": false, "tipo": "String", "reflete": false, "de": "UrbiSeguro" },
        { "propriedade": "caixaAlta", "atributo": "caixa-alta", "so_propriedade": false, "tipo": "Boolean", "reflete": true, "de": "UrbiSeguro" },
        { "propriedade": "desabilitado", "atributo": "desabilitado", "so_propriedade": false, "tipo": "Boolean", "reflete": false, "de": "UrbiSeguro" }
      ],
      "atributos_convencao": [],
      "host": [
        { "seletor": ":host", "prop": "padding", "valor": "8px", "de": "UrbiSeguro" },
        { "seletor": ":host", "prop": "box-sizing", "valor": "border-box", "de": "UrbiSeguro" }
      ],
      "risco_box_model": false, "risco_box_model_altura": false
    },
    "urbi-kpi": {
      "classe": "UrbiKpi", "arquivo": "ui/src/x.ts", "base": null, "linhagem": ["UrbiKpi"],
      "props": [], "atributos_convencao": [],
      "host": [
        { "seletor": ":host", "prop": "padding", "valor": "14px 16px", "de": "UrbiKpi" },
        { "seletor": ":host", "prop": "border", "valor": "1px solid #111", "de": "UrbiKpi" }
      ],
      "risco_box_model": true, "risco_box_model_altura": true
    },
    "urbi-conv": {
      "classe": "UrbiConv", "arquivo": "ui/src/x.ts", "base": null, "linhagem": ["UrbiConv"],
      "props": [], "atributos_convencao": ["expandir", "sem-expandir"],
      "host": [
        { "seletor": ":host", "prop": "--urbi-conv-borda", "valor": "1px", "de": "UrbiConv" },
        { "seletor": ":host([expandir])", "prop": "flex", "valor": "1", "de": "UrbiConv" }
      ],
      "risco_box_model": false, "risco_box_model_altura": false
    }
  }
}
JSON

# ── harness ─────────────────────────────────────────────────────────────────
# `caso <guard> <esperado> <descrição>` lê o conteúdo do arquivo de fronteira em
# stdin e o grava como `frontend/caso.ts`. `<esperado>` é o código de saída.
#
# A linha de base existe por causa da lista DISPENSAS do guard de box model: ela
# aponta para `frontend/tela-resumo.ts`, e o guard reprova dispensa que não casa
# com nada. Escrevendo a linha de base em todo caso, a dispensa sempre casa — e o
# caso "dispensa obsoleta" a omite de propósito, o que testa esse mecanismo em
# vez de contorná-lo.
BASE_DISPENSA='const e = css`.kpis .kpi-cel urbi-kpi { width: 100%; }`;'

# `SEM_BASE=1` vale para UM caso e é consumido aqui dentro. Não escreva
# `SEM_BASE=1 caso …`: prefixo de atribuição antes de FUNÇÃO persiste no bash
# (ao contrário do que acontece com um comando externo), e a variável vazaria
# para todos os casos seguintes — foi o que aconteceu na primeira versão desta
# bateria, e ela ficou vermelha em seis casos corretos.
SEM_BASE=0
# `caso <guard> <saída-esperada> <descrição> [padrão-ERE]`, com o corpo em stdin.
#
# ⚠️ O quarto argumento não é enfeite. Conferir só o CÓDIGO DE SAÍDA deixa passar
# o pior tipo de teste verde: o que acerta pelo motivo errado. Aconteceu duas
# vezes na revisão do PR 505 — com `${`${'{'}`}` e com `// abre {` dentro de uma
# interpolação, o guard acusava, mas com o SELETOR CORROMPIDO (`color: .x
# urbi-arriscado`), e só continuava acusando porque o sujeito é o último composto.
# Todo caso que ACUSA declara o padrão que a mensagem tem que casar.
#
# Os casos são ENFILEIRADOS aqui e executados em paralelo no fim. Motivo: desde
# que o lexer passou a ser o parser do `typescript`, cada invocação de guard
# carrega ~9 MB de compilador (≈540 ms), e 86 casos em série levavam 48 s. Cada
# caso roda no seu próprio diretório, então o paralelismo não os mistura.
declare -a ORDEM=()
N=0
SEM_BASE=0

secao() { ORDEM+=("S|$1"); }

caso() {
  local guard="$1" esperado="$2" desc="$3" padrao="${4:-}"
  local sem_base="$SEM_BASE"; SEM_BASE=0
  N=$((N+1)); TOTAL=$((TOTAL+1))
  local dir="$TMP/c$N"
  mkdir -p "$dir/scripts/lib" "$dir/docs/ui-urbiverso" "$dir/frontend"
  cp "$TMP/base/scripts/"*.mjs "$dir/scripts/"
  cp "$TMP/base/scripts/lib/"*.mjs "$dir/scripts/lib/"
  cp "$TMP/base/docs/ui-urbiverso/"*.json "$dir/docs/ui-urbiverso/"
  cat > "$dir/frontend/caso.ts"
  [ "$sem_base" = "1" ] || printf '%s\n' "$BASE_DISPENSA" > "$dir/frontend/tela-resumo.ts"
  printf '%s\n%s\n%s\n%s\n' "$guard" "$esperado" "$desc" "$padrao" > "$dir/spec"
  ORDEM+=("C|$N")
}

# Executor de um caso, chamado pelo pool. Escreve o veredito em `$dir/veredito`.
cat > "$TMP/rodar-caso.sh" <<'RUNNER'
#!/bin/bash
dir="$1"
mapfile -t spec < "$dir/spec"
guard="${spec[0]}"; esperado="${spec[1]}"; desc="${spec[2]}"; padrao="${spec[3]}"
saida="$(cd "$dir" && node "scripts/$guard.mjs" 2>&1)"; rc=$?
if [ "$rc" != "$esperado" ]; then
  { printf 'FALHA %s — saída esperada=%s obtida=%s\n' "$desc" "$esperado" "$rc"
    printf '%s\n' "$saida" | sed 's/^/          | /'; } > "$dir/veredito"
  exit 0
fi
if [ -n "$padrao" ] && ! printf '%s' "$saida" | grep -qE "$padrao"; then
  { printf 'FALHA %s — saída certa (%s) pelo MOTIVO ERRADO: nada casa /%s/\n' "$desc" "$rc" "$padrao"
    printf '%s\n' "$saida" | sed 's/^/          | /'; } > "$dir/veredito"
  exit 0
fi
printf 'ok    %s\n' "$desc" > "$dir/veredito"
RUNNER
chmod +x "$TMP/rodar-caso.sh"

secao "guard-tokens-css — ACUSA (falso negativo é o que se procura aqui):"

caso guard-tokens-css 1 "token inexistente com fallback (o caso da #475)" 'caso\.ts:1 +--cor-nao-existe' <<'TS'
const e = css`.x { background: var(--cor-nao-existe, rgba(255,255,255,0.06)); }`;
TS

caso guard-tokens-css 1 "token inexistente ANINHADO dentro de um var() válido" <<'TS'
const e = css`.x { color: var(--cor-texto, var(--cor-inventada, #fff)); }`;
TS

secao "guard-tokens-css — NÃO acusa (falso positivo desliga a guarda):"

caso guard-tokens-css 0 "tokens do espelho, com e sem fallback" <<'TS'
const e = css`.x { color: var(--cor-texto); border-color: var(--cor-borda, #111); }`;
TS

caso guard-tokens-css 0 "custom property declarada pelo próprio app" <<'TS'
const e = css`.x { --minha-medida: 4px; padding: var(--minha-medida); }`;
TS

caso guard-tokens-css 0 "custom property exposta no :host de um primitivo" <<'TS'
const e = css`urbi-conv { border-width: var(--urbi-conv-borda); }`;
TS

# ════════════════════════════════════════════════════════════════════════════
secao "guard-props-urbi — ACUSA:"

caso guard-props-urbi 1 "kebab-case onde o Lit usa minúsculo (max-width= é o inerte)" 'caso\.ts:1 +<urbi-seguro> max-width' <<'TS'
const e = html`<urbi-seguro max-width="420px"></urbi-seguro>`;
TS

caso guard-props-urbi 1 "prop attribute:false escrita como atributo" <<'TS'
const e = html`<urbi-arriscado valor="10"></urbi-arriscado>`;
TS

caso guard-props-urbi 1 "atributo inexistente" <<'TS'
const e = html`<urbi-arriscado titulo2="x"></urbi-arriscado>`;
TS

caso guard-props-urbi 1 "binding booleano ?attr de atributo inexistente" <<'TS'
const e = html`<urbi-seguro ?naoexiste=${true}></urbi-seguro>`;
TS

caso guard-props-urbi 1 "expandir num primitivo que NÃO honra a convenção" <<'TS'
const e = html`<urbi-seguro expandir></urbi-seguro>`;
TS

caso guard-props-urbi 1 "atributo ruim DEPOIS de um \${} com > e } dentro (prova o tokenizador)" <<'TS'
const e = html`<urbi-seguro
  @click=${(ev) => { if (ev.x > 1) { return { a: '>' }; } }}
  inventado="x"
></urbi-seguro>`;
TS

caso guard-props-urbi 1 "primitivo que não está no espelho" <<'TS'
const e = html`<urbi-nunca-visto rotulo="x"></urbi-nunca-visto>`;
TS

secao "guard-props-urbi — NÃO acusa:"

caso guard-props-urbi 0 "maxWidth= (o Lit minusculiza; 17 usos reais dependem disto)" <<'TS'
const e = html`<urbi-seguro maxWidth="420px"></urbi-seguro>`;
TS

caso guard-props-urbi 0 "attribute: renomeado — caixa-alta= (e não caixaAlta=)" <<'TS'
const e = html`<urbi-seguro caixa-alta></urbi-seguro>`;
TS

caso guard-props-urbi 0 "prop attribute:false passada como .prop=\${}" <<'TS'
const e = html`<urbi-arriscado .valor=${{ a: 1 }}></urbi-arriscado>`;
TS

caso guard-props-urbi 0 "atributos globais: class, id, slot, part, aria-*, data-*" <<'TS'
const e = html`<urbi-arriscado class="a" id="b" slot="c" part="d"
  aria-label="e" data-x="f" title="g" tabindex="0"></urbi-arriscado>`;
TS

caso guard-props-urbi 0 "expandir/sem-expandir onde a convenção existe" <<'TS'
const e = html`<urbi-conv expandir></urbi-conv><urbi-conv sem-expandir></urbi-conv>`;
TS

caso guard-props-urbi 0 "@evento nunca é acusado — o espelho não traz eventos" <<'TS'
const e = html`<urbi-seguro @urbi:qualquer-coisa=${() => 0}></urbi-seguro>`;
TS

caso guard-props-urbi 0 "?attr booleano de atributo declarado" <<'TS'
const e = html`<urbi-seguro ?desabilitado=${true}></urbi-seguro>`;
TS

caso guard-props-urbi 0 "template literal aninhado e aspas dentro do \${}" <<'TS'
const e = html`<urbi-seguro maxWidth=${`${'a>b'}px`} .maxWidth=${"}"}></urbi-seguro>`;
TS

# ════════════════════════════════════════════════════════════════════════════
secao "guard-box-model-urbi — ACUSA:"

caso guard-box-model-urbi 1 "width de fora num primitivo em risco (o caso do urbi-kpi)" 'caso\.ts:1 +\.kpis \.cel urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.kpis .cel urbi-arriscado { width: 100%; }`;
TS

caso guard-box-model-urbi 1 "height num primitivo com risco no eixo vertical" <<'TS'
const e = css`.kpis urbi-arriscado { height: 120px; }`;
TS

caso guard-box-model-urbi 1 "min-width NÃO-zero (impõe tamanho, ao contrário de 0)" <<'TS'
const e = css`.kpis urbi-arriscado { min-width: 200px; }`;
TS

caso guard-box-model-urbi 1 "regra dentro de @media" '\.kpis urbi-arriscado \{ width: 50% \}' <<'TS'
const e = css`@media (min-width: 700px) { .kpis urbi-arriscado { width: 50%; } }`;
TS

caso guard-box-model-urbi 1 "style= inline na própria tag" 'style= inline \{ width: 100% \}' <<'TS'
const e = html`<urbi-arriscado style="width: 100%"></urbi-arriscado>`;
TS

caso guard-box-model-urbi 1 "box-sizing: content-box não protege — só border-box" <<'TS'
const e = css`.kpis urbi-arriscado { width: 100%; box-sizing: content-box; }`;
TS

SEM_BASE=1
caso guard-box-model-urbi 1 "dispensa que não casa mais com nada" <<'TS'
const e = css`.x { color: red; }`;
TS

secao "guard-box-model-urbi — NÃO acusa:"

caso guard-box-model-urbi 0 "min-width: 0 — é a correção recomendada, não o defeito" <<'TS'
const e = css`.kpis urbi-arriscado { min-width: 0; }`;
TS

caso guard-box-model-urbi 0 "box-sizing: border-box na MESMA regra (a saída 2)" <<'TS'
const e = css`.kpis urbi-arriscado { width: 100%; box-sizing: border-box; }`;
TS

caso guard-box-model-urbi 0 "width num primitivo sem risco (:host tem border-box)" <<'TS'
const e = css`.campo urbi-seguro { width: 280px; }`;
TS

caso guard-box-model-urbi 0 "height num primitivo com risco só na LARGURA (separação de eixos)" <<'TS'
const e = css`.x urbi-so-largura { height: 120px; }`;
TS

caso guard-box-model-urbi 0 "o sujeito do seletor não é o host — urbi-x .interno" <<'TS'
const e = css`urbi-arriscado .interno { width: 100%; }`;
TS

caso guard-box-model-urbi 0 "valores que não impõem tamanho: auto, none, fit-content" <<'TS'
const e = css`.a urbi-arriscado { width: auto; max-width: none; height: fit-content; }`;
TS

# ════════════════════════════════════════════════════════════════════════════
# ════════════════════════════════════════════════════════════════════════════
# As dez varreduras de código bruto — regressão do PR 505
#
# Os três guards escreviam, cada um, o próprio varredor: dez lugares perguntando
# "isto é código, comentário, string, regex ou template?" e nenhum sabendo
# responder. Deram quatro P1 e dois P2 (Codex) mais quatro falsos positivos
# (varredura seguinte). Hoje a resposta mora num lugar só,
# `scripts/lib/fonte-ts.mjs`, com bateria própria em `scripts/testar-fonte-ts.sh`.
#
# Os casos abaixo são os dez defeitos, cada um nos DOIS sentidos. Eles não
# substituem a bateria do lexer: provam que cada guard está de fato pendurado
# nele, o que a bateria do lexer não pode provar.

secao "Fronteira de \${…} — ACUSA (era falso negativo, com saída ZERO):"

caso guard-props-urbi 1 "chave em comentário de bloco não engole o arquivo" \
  'caso\.ts:3 +<urbi-seguro> inventado' <<'TS'
const e = html`<urbi-seguro
  @click=${() => { /* { */ return true; }}
  inventado="x"
></urbi-seguro>`;
TS

caso guard-props-urbi 1 "chave em comentário de linha não engole o arquivo" \
  'caso\.ts:5 +<urbi-seguro> inventado' <<'TS'
const e = html`<urbi-seguro
  @click=${() => {
    // abre {
    return 1; }}
  inventado="x"
></urbi-seguro>`;
TS

caso guard-props-urbi 1 "chave dentro de string não engole o arquivo" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const e = html`<urbi-seguro .maxWidth=${sufixo('{')} inventado="x"></urbi-seguro>`;
TS

caso guard-box-model-urbi 1 "chave em comentário não mascara as regras seguintes" \
  'caso\.ts:3 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`
  .b { padding: ${unsafeCSS(/* { { */ '')}; }
  .x urbi-arriscado { width: 100%; }
`;
TS

caso guard-box-model-urbi 1 "template aninhado: o seletor sai LIMPO, sem prefixo" \
  'caso\.ts:3 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`
  .b { color: ${`${'{'}`}; }
  .x urbi-arriscado { width: 100%; }
`;
TS

caso guard-box-model-urbi 1 "style= inline depois de um > de arrow function" \
  'caso\.ts:1 +style= inline \{ width: 100% \}' <<'TS'
const e = html`<urbi-arriscado .v=${a.filter((x) => x > 0)} style="width:100%"></urbi-arriscado>`;
TS

caso guard-tokens-css 1 "declaração em comentário não vira token conhecido" \
  'caso\.ts:2 +--inventado' <<'TS'
// legado --inventado: red
const e = css`.x { color: var(--inventado); }`;
TS

caso guard-tokens-css 1 "declaração em string comum não vira token conhecido" \
  'caso\.ts:2 +--inventado' <<'TS'
const dica = 'no legado era --inventado: red';
const e = css`.x { color: var(--inventado); }`;
TS

caso guard-box-model-urbi 1 "border-boxx não protege — o navegador descarta a declaração" \
  'caso\.ts:1 +\.a urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.a urbi-arriscado { width: 100%; box-sizing: border-boxx; }`;
TS

# ⚠️ VEREDITO INVERTIDO na rodada 4, de propósito. Este caso exigia que um
# `<style>` dentro de template SEM TAG virasse CSS de verdade, pensando no
# documento de impressão de `exportar.ts`. Mas template sem tag também é STRING
# COMUM — prosa, exemplo, documentação —, e tratá-la como HTML deixava
# `const doc = `<style>:root{--x:red}</style>`` registrar `--x` como token
# conhecido do app, liberando um `var(--x)` real algumas linhas abaixo.
# Preço aceito: o CSS de impressão de `exportar.ts` não é analisado. Ele roda em
# janela própria (o `CLAUDE.md` já o trata como exceção), não usa `urbi-*` e não
# declara custom property nenhuma.
caso guard-box-model-urbi 0 "<style> de template SEM tag NÃO é superfície de CSS" <<'TS'
const doc = `<!doctype html><style>
  .x urbi-arriscado { width: 100%; }
</style>`;
TS

secao "Comentário e string — NÃO acusa (era falso positivo, que faz desligar a guarda):"

caso guard-props-urbi 0 "<urbi-*> citado em comentário de linha" <<'TS'
// nao use <urbi-seguro inventado="x"> aqui
const e = html`<urbi-seguro></urbi-seguro>`;
TS

caso guard-props-urbi 0 "<urbi-*> citado dentro de string" <<'TS'
const doc = 'exemplo: <urbi-seguro inventado="x"></urbi-seguro>';
TS

caso guard-box-model-urbi 0 "comentário que DOCUMENTA o defeito não é acusado por isso" <<'TS'
// exemplo antigo: css`.a urbi-arriscado { width: 100%; }`
const e = css`.b { color: red; }`;
TS

caso guard-tokens-css 0 "var(--inexistente) citado em comentário" <<'TS'
// antigamente era var(--fantasma, #fff)
const e = css`.x { color: var(--cor-texto); }`;
TS

caso guard-box-model-urbi 0 "border-box escrito inteiro protege" <<'TS'
const e = css`.a urbi-arriscado { width: 100%; box-sizing: border-box; }`;
TS

caso guard-box-model-urbi 0 "border-box com !important protege" <<'TS'
const e = css`.a urbi-arriscado { width: 100%; box-sizing: border-box !important; }`;
TS

caso guard-tokens-css 0 'declaração em css de verdade amplia o permitido' <<'TS'
const e = css`.x { --minha: red; color: var(--minha); }`;
TS

caso guard-tokens-css 0 'declaração em style= inline amplia o permitido' <<'TS'
const e = html`<div style="--minha: red"><span style="color: var(--minha)"></span></div>`;
TS

caso guard-props-urbi 0 'interpolação de prosa não vira atributo (title com template dentro)' <<'TS'
const e = html`<urbi-seguro title=${`Coletas — ${x.nome}`} maxWidth="720px"></urbi-seguro>`;
TS

caso guard-props-urbi 0 'template comum dentro de @evento não vira atributo' <<'TS'
const e = html`<urbi-seguro @click=${() => ir(`/detalhe/${l.id}`)}></urbi-seguro>`;
TS

# ════════════════════════════════════════════════════════════════════════════
# As três sub-linguagens — regressão da rodada 2 do PR 505
#
# O módulo lexava JS/TS certo e não conhecia as regras de comentário das outras
# duas linguagens que vivem dentro do arquivo: CSS (`/* */`, sem `//`) e HTML
# (`<!-- -->`, sem `/* */`). Os três guards herdavam a cegueira.
#
# Um dos casos não é hipotético: `frontend/fluxo-tabela.ts:56-64` é um comentário
# CSS que EXPLICA por que o app abandonou o `urbi-kpi`, e o guard de box model o
# contava como uma regra alcançando `urbi-kpi` — 5 regras onde há 4.

secao "Sub-linguagens — ACUSA (era falso negativo, com saída ZERO):"

caso guard-props-urbi 1 "crase de fechamento antes de / é divisão, não regex" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const e = html`${`abc` / 2}<urbi-seguro inventado="x"></urbi-seguro>`;
TS

caso guard-props-urbi 1 "string antes de / é divisão, não regex" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const e = html`${'abc' / 2}<urbi-seguro inventado="x"></urbi-seguro>`;
TS

caso guard-tokens-css 1 "declaração num <style> COMENTADO não autoriza o token" \
  'caso\.ts:2 +--inventado' <<'TS'
const e = html`<!-- <style>.a { --inventado: red; }</style> -->`;
const f = css`.x { color: var(--inventado); }`;
TS

caso guard-box-model-urbi 1 "chave dentro de comentário CSS não fecha a regra" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { /* old: } */ width: 100%; }`;
TS

caso guard-box-model-urbi 1 "chave dentro de string CSS não fecha a regra" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { content: "}"; width: 100%; }`;
TS

secao "Sub-linguagens — NÃO acusa (era falso positivo, ou virava regra fantasma):"

caso guard-box-model-urbi 0 "comentário CSS citando urbi-* não vira regra (o fluxo-tabela.ts:56-64)" <<'TS'
const e = css`
  /* #352: a variação precisa ficar na mesma moldura, mas urbi-arriscado
     só declara 4 props, então o card é do próprio app. */
  .kpi-card { display: flex; width: 100%; }
`;
TS

caso guard-props-urbi 0 "<urbi-*> dentro de comentário HTML" <<'TS'
const e = html`<!-- <urbi-seguro inventado="x"></urbi-seguro> --><urbi-seguro></urbi-seguro>`;
TS

caso guard-props-urbi 0 "<urbi-*> dentro de <script> (texto cru)" <<'TS'
const e = html`<script>const s = "<urbi-seguro inventado='x'>";</script>`;
TS

# ⚠️ VEREDITO INVERTIDO na 6ª rodada: CDATA deixou de ser modelado e passou a
# ser RECUSADO — ele só vale em conteúdo estrangeiro, e dentro de `html` o
# tokenizer o trata como comentário inválido até o primeiro `>`.
caso guard-props-urbi 1 "CDATA não é modelado — recusa" \
  'nao consegui analisar' <<'TS'
const e = svg`<![CDATA[ <urbi-seguro inventado="x"> ]]>`;
TS

caso guard-tokens-css 0 "declaração num <style> DE VERDADE continua valendo" <<'TS'
const e = html`<style>.a { --minha: red; }</style>`;
const f = css`.x { color: var(--minha); }`;
TS

caso guard-tokens-css 0 "var() dentro de comentário CSS não é acusado" <<'TS'
const e = css`.x { /* antes era var(--fantasma) */ color: var(--cor-texto); }`;
TS

caso guard-box-model-urbi 0 "width dentro de comentário CSS não é acusado" <<'TS'
const e = css`.a urbi-arriscado { /* width: 100%; */ min-width: 0; }`;
TS

# ════════════════════════════════════════════════════════════════════════════
# Rodada 3 — o lexer de JS/TS saiu e virou o parser do TypeScript
#
# Três rodadas seguidas acharam classe nova num lexer artesanal: comentário e
# string; sub-linguagens; operador pós-fixo, continuidade de estado e grafia. O
# eixo não era "quais construções faltam" — era escrever um lexer de JS/TS à mão,
# cuja cauda é a especificação inteira. Agora quem lexa JS/TS é o parser do
# `typescript`, e CSS/HTML seguem à mão mas com o MODO DE FALHA INVERTIDO.

secao "Operador antes de / — ACUSA (era falso negativo, com saída ZERO):"

caso guard-props-urbi 1 "i++ / 2 é divisão, não regex" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
let i = 1; const e = html`${i++ / 2}<urbi-seguro inventado="x"></urbi-seguro>`;
TS

caso guard-props-urbi 1 "x! / 2 é divisão, não regex" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const x: any = 1; const e = html`${x! / 2}<urbi-seguro inventado="y"></urbi-seguro>`;
TS

secao "Estado atravessando \${…} e grafia — ACUSA:"

caso guard-box-model-urbi 1 "comentário CSS que atravessa a interpolação" \
  'caso\.ts:2 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.a { /* ${x} } */ color: red; }
  .x urbi-arriscado { width: 100%; }`;
TS

caso guard-box-model-urbi 1 'url("a)b.png") — o ) mora dentro da string' \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { background: url("a)b.png"); width: 100%; }`;
TS

caso guard-box-model-urbi 1 "<STYLE> maiúsculo é CSS, e </STYLE > admite espaço" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = html`<STYLE>.x urbi-arriscado { width: 100%; }</STYLE >`;
TS

secao "Estado atravessando \${…} e RCDATA — NÃO acusa:"

caso guard-props-urbi 0 "comentário HTML que atravessa a interpolação" <<'TS'
const e = html`<!-- ${x} <urbi-seguro inventado="y"></urbi-seguro> -->`;
TS

caso guard-props-urbi 0 "conteúdo de <title> é RCDATA, não marcação" <<'TS'
const e = html`<title><urbi-seguro inventado="x"></urbi-seguro></title>`;
TS

caso guard-props-urbi 0 "conteúdo de <textarea> é RCDATA" <<'TS'
const e = html`<textarea><urbi-seguro inventado="x"></urbi-seguro></textarea>`;
TS

caso guard-tokens-css 0 "declaração num <STYLE> maiúsculo é conhecida" <<'TS'
const e = html`<STYLE>.a { --minha: red; }</STYLE >`;
const f = css`.x { color: var(--minha); }`;
TS

secao "Modo de falha invertido — construção que não fecha REPROVA, nunca passa:"

caso guard-props-urbi 1 "comentário HTML sem fechar" \
  'nao consegui analisar' <<'TS'
const e = html`<!-- nunca fecha <urbi-seguro inventado="x">`;
TS

caso guard-box-model-urbi 1 "comentário CSS sem fechar" \
  'nao consegui analisar' <<'TS'
const e = css`.x urbi-arriscado { /* nunca fecha width: 100%; }`;
TS

caso guard-box-model-urbi 1 "url( sem fechar" \
  'nao consegui analisar' <<'TS'
const e = css`.x urbi-arriscado { background: url(a}b ; width: 100%; }`;
TS

caso guard-box-model-urbi 1 "bloco CSS { sem }" \
  'nao consegui analisar' <<'TS'
const e = css`.x urbi-arriscado { width: 100%;`;
TS

caso guard-tokens-css 1 "<style> sem fechar" \
  'nao consegui analisar' <<'TS'
const e = html`<style>.a { --x: red; }`;
const f = css`.y { color: var(--nada); }`;
TS

caso guard-props-urbi 1 "arquivo que o TypeScript não parseia" \
  'nao consegui analisar' <<'TS'
const e = html`<urbi-seguro></urbi-seguro>`;
function ( { ] }
TS

# ════════════════════════════════════════════════════════════════════════════
# Rodada 4 — o modo de falha invertido não era uniforme, e dois consertos
# tinham irmão esquecido
#
# Nenhum dos achados desta rodada é de JS/TS: o parser fechou aquele eixo. Os
# quatro caem na parte CSS/HTML escrita à mão, e metade deles é o mesmo erro de
# método — o conserto foi aplicado num lugar e não no irmão.

secao "Modo de falha invertido, uniforme — ACUSA (era ZERO em silêncio):"

caso guard-box-model-urbi 1 "style= com /* sem fechar recusa, em vez de virar branco" \
  'nao consegui analisar' <<'TS'
const e = html`<urbi-arriscado style="width:100%; /*"></urbi-arriscado>`;
TS

caso guard-tokens-css 1 "style= com /* sem fechar recusa também no guard de tokens" \
  'nao consegui analisar' <<'TS'
const e = html`<div style="--minha: red; /*"></div>`;
const f = css`.x { color: var(--minha); }`;
TS

secao "Superfície de CSS não pode nascer larga demais — ACUSA:"

caso guard-tokens-css 1 "<style> dentro de STRING COMUM não declara token" \
  'caso\.ts:2 +--inventado' <<'TS'
const doc = `<style>:root{--inventado:red}</style>`;
const f = css`.x { color: var(--inventado); }`;
TS

secao "Grafia: HTML é case-insensitive em tag E em atributo — ACUSA:"

caso guard-box-model-urbi 1 "<URBI-ARRISCADO> maiúsculo" \
  'style= inline \{ width: 100% \}' <<'TS'
const e = html`<URBI-ARRISCADO style="width:100%"></URBI-ARRISCADO>`;
TS

caso guard-box-model-urbi 1 "STYLE= maiúsculo (o irmão esquecido de lerTags)" \
  'style= inline \{ width: 100% \}' <<'TS'
const e = html`<urbi-arriscado STYLE="width:100%"></urbi-arriscado>`;
TS

caso guard-box-model-urbi 1 "seletor CSS de tipo em maiúsculas (o outro irmão)" \
  'caso\.ts:1 +\.a URBI-ARRISCADO \{ width: 100% \}' <<'TS'
const e = css`.a URBI-ARRISCADO { width: 100%; }`;
TS

secao "Construção iniciada por < só vale fora de tag e de valor citado:"

caso guard-props-urbi 1 "<!-- dentro de valor de atributo não abre comentário" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const e = html`<div data-nota="<!--"><urbi-seguro inventado="x"></urbi-seguro>-->`;
TS

caso guard-props-urbi 1 "tag aberta e nunca fechada recusa" \
  'nao consegui analisar' <<'TS'
const e = html`<div <urbi-seguro inventado="x"`;
TS

caso guard-props-urbi 1 "aspas de atributo sem fechar recusam" \
  'nao consegui analisar' <<'TS'
const e = html`<urbi-seguro rotulo="nao fecha></urbi-seguro>`;
TS

secao "E o que NÃO pode passar a acusar:"

caso guard-tokens-css 0 "STYLE= maiúsculo declara token igual a style=" <<'TS'
const e = html`<div STYLE="--minha: red"></div>`;
const f = css`.x { color: var(--minha); }`;
TS

caso guard-box-model-urbi 0 ".style=\${} é binding de propriedade, não atributo HTML" <<'TS'
const e = html`<urbi-arriscado .style=${o}></urbi-arriscado>`;
TS

caso guard-box-model-urbi 0 "/* dentro de string CSS não abre comentário" <<'TS'
const e = css`.x urbi-arriscado { content: "/*"; min-width: 0; }`;
TS

# ════════════════════════════════════════════════════════════════════════════
# Rodada 5 — os dois últimos irmãos das famílias já conhecidas
#
# Nenhum eixo novo: um é o irmão do conserto do `<!--` (posição externa a valor
# citado), o outro é o quinto elo da cadeia de caixa. As duas famílias estão
# varridas por inteiro em `scripts/lib/LEIA.md`, com tabela.

secao "Posição externa a valor citado — ACUSA (era ZERO em silêncio):"

caso guard-tokens-css 1 "<span style=…> dentro de title='…' não declara token" \
  'caso\.ts:2 +--inventado' <<'TS'
const e = html`<div title='<span style="--inventado:red">'></div>`;
const f = css`.x { color: var(--inventado); }`;
TS

caso guard-tokens-css 1 "<style> dentro de valor de atributo não vira CSS" \
  'caso\.ts:2 +--inventado' <<'TS'
const e = html`<div title="<style>:root{--inventado:red}</style>"></div>`;
const f = css`.x { color: var(--inventado); }`;
TS

caso guard-props-urbi 0 "<urbi-*> dentro de valor de atributo não é elemento" <<'TS'
const e = html`<div title="<urbi-seguro inventado='x'>"></div>`;
TS

secao "Caixa — quinto elo da cadeia:"

caso guard-tokens-css 1 "VAR() maiúsculo é a mesma função, e é acusado" \
  'caso\.ts:1 +--inventado' <<'TS'
const f = css`.x { color: VAR(--inventado, red); }`;
TS

caso guard-tokens-css 0 "VAR() de token que existe continua passando" <<'TS'
const f = css`.x { color: VAR(--cor-texto); }`;
TS

caso guard-tokens-css 1 "nome de custom property é case-SENSÍVEL — --Cor ≠ --cor" \
  'caso\.ts:1 +--Cor-Texto' <<'TS'
const f = css`.x { --cor-texto: red; color: var(--Cor-Texto); }`;
TS

secao "E o que continua valendo:"

caso guard-tokens-css 0 "<style> de verdade continua declarando" <<'TS'
const e = html`<style>:root{--minha:red}</style>`;
const f = css`.x { color: var(--minha); }`;
TS

# ════════════════════════════════════════════════════════════════════════════
# Rodada 6 — o modo invertido passa a valer para o NÃO MODELADO
#
# Os achados desta rodada pediam estados do tokenizer do HTML: CDATA em conteúdo
# estrangeiro, RAWTEXT de `iframe`/`xmp`/`noembed`/`noframes`, `plaintext`. Isso
# não é mais "o irmão do conserto anterior" — é implementar a spec, e cada rodada
# revelaria o estado seguinte. Em vez disso, o que não é modelado RECUSA.
# Custo medido no `frontend/` real: zero arquivos.

secao "CSS aninhado — as declarações do bloco EXTERNO não podem sumir:"

caso guard-box-model-urbi 1 "declaração antes de um bloco aninhado" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { width: 100%; &:hover { color: red } }`;
TS

caso guard-box-model-urbi 1 "declaração depois de um bloco aninhado" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { &:hover { color: red } width: 100%; }`;
TS

caso guard-box-model-urbi 1 "seletor aninhado com & compõe com o pai" \
  'caso\.ts:1 +\.x urbi-arriscado:hover \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { color: red; &:hover { width: 100%; } }`;
TS

caso guard-box-model-urbi 1 "aninhamento por descendência compõe" \
  'caso\.ts:1 +\.wrap urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.wrap { color: red; urbi-arriscado { width: 100%; } }`;
TS

caso guard-box-model-urbi 0 "min-width: 0 aninhado continua sendo a correção" <<'TS'
const e = css`.wrap { color: red; urbi-arriscado { min-width: 0; } }`;
TS

secao "Construção não modelada — RECUSA, nunca aproxima:"

caso guard-props-urbi 1 "<!doctype> recusa" 'nao consegui analisar' <<'TS'
const e = html`<!doctype html><urbi-seguro inventado="x"></urbi-seguro>`;
TS

caso guard-props-urbi 1 "<iframe> recusa" 'nao consegui analisar' <<'TS'
const e = html`<iframe srcdoc="<urbi-seguro inventado='x'>"></iframe>`;
TS

caso guard-props-urbi 1 "<plaintext> recusa" 'nao consegui analisar' <<'TS'
const e = html`<plaintext><urbi-seguro inventado="x">`;
TS

secao "Texto cru — o fechamento vem depois da tag de abertura:"

caso guard-props-urbi 0 "</script> dentro do valor da abertura não fecha o script" <<'TS'
const e = html`<script title="</script>">var s = "<urbi-seguro inventado='x'>";</script>`;
TS

caso guard-props-urbi 0 "<svg> inline continua modelado como tag comum" <<'TS'
const e = html`<svg viewBox="0 0 1 1"><path d="M0 0"/></svg><urbi-seguro></urbi-seguro>`;
TS

# ════════════════════════════════════════════════════════════════════════════
# Rodada 7 — o vão da recusa, at-rule dentro de regra, e sujeito do seletor

secao "O que não é modelado NEM recusado — o vão do desenho:"

caso guard-box-model-urbi 1 "<style/> recusa em vez de escorrer para tag comum" \
  'nao consegui analisar' <<'TS'
const e = html`<style/>.x urbi-arriscado { width:100% }</style>`;
TS

caso guard-props-urbi 1 "<script/> recusa" 'nao consegui analisar' <<'TS'
const e = html`<script/>var s = "<urbi-seguro inventado='x'>";</script>`;
TS

caso guard-props-urbi 1 "<textarea/> recusa" 'nao consegui analisar' <<'TS'
const e = html`<textarea/>x</textarea>`;
TS

secao "At-rule DENTRO de regra é agrupamento — herda o seletor do pai:"

caso guard-box-model-urbi 1 "@media dentro de regra" \
  'caso\.ts:1 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x urbi-arriscado { @media (min-width: 700px) { width: 100% } }`;
TS

caso guard-box-model-urbi 1 "regra dentro de @media dentro de regra" \
  'caso\.ts:1 +\.a urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.a { @media (min-width: 700px) { urbi-arriscado { width: 100% } } }`;
TS

secao "Sujeito do seletor é TIPO, não substring (falso positivo é o lado perigoso):"

caso guard-box-model-urbi 0 "a classe .urbi-arriscado não é o elemento" <<'TS'
const e = css`.urbi-arriscado { width: 100%; }`;
TS

caso guard-box-model-urbi 0 '[data-kind="urbi-arriscado"] não é o elemento' <<'TS'
const e = css`[data-kind="urbi-arriscado"] { width: 100%; }`;
TS

caso guard-box-model-urbi 0 ".wrapper:has(urbi-arriscado) tem sujeito .wrapper" <<'TS'
const e = css`.wrapper:has(urbi-arriscado) { width: 100%; }`;
TS

caso guard-box-model-urbi 0 ".a:not(urbi-arriscado) seleciona quem NÃO é" <<'TS'
const e = css`.a:not(urbi-arriscado) { width: 100%; }`;
TS

caso guard-box-model-urbi 1 "tipo no sujeito, com classe junto, alcança" \
  'caso\.ts:1 +\.a urbi-arriscado\.destaque \{ width: 100% \}' <<'TS'
const e = css`.a urbi-arriscado.destaque { width: 100%; }`;
TS

caso guard-box-model-urbi 1 "urbi-arriscado:not(.x) alcança — o argumento não é o sujeito" \
  'caso\.ts:1 +urbi-arriscado:not\(\.x\) \{ width: 100% \}' <<'TS'
const e = css`urbi-arriscado:not(.x) { width: 100%; }`;
TS

caso guard-box-model-urbi 1 ":is() não é modelado — recusa" \
  'nao modelo o seletor' <<'TS'
const e = css`:is(urbi-arriscado, .x) { width: 100%; }`;
TS

# ⚠️ Estes dois é que exercitam o esvaziamento dos grupos. Os de cima passam
# mesmo SEM ele, porque o tipo já não está no início do composto — descoberto por
# mutação: apagar `esvaziarGrupos` deixava a bateria inteira verde. Aqui há um
# COMBINADOR dentro do grupo, e sem esvaziar o `split` parte o composto e o
# último pedaço vira `urbi-arriscado)`, que casa como tipo.
caso guard-box-model-urbi 0 ":has(.a urbi-arriscado) — combinador dentro do grupo" <<'TS'
const e = css`.wrapper:has(.a urbi-arriscado) { width: 100%; }`;
TS

caso guard-box-model-urbi 0 'atributo com espaço no valor: [data-x="a urbi-arriscado"]' <<'TS'
const e = css`[data-x="a urbi-arriscado"] { width: 100%; }`;
TS

secao "Vírgula: separa seletores SÓ fora de grupo (e continua separando fora):"

# Sem `dividirVirgulasExternas`, o `split(',')` corta ANTES de esvaziar o grupo,
# a segunda metade vira ` urbi-arriscado)` e o guard bloqueia um seletor que
# EXCLUI o primitivo de propósito.
caso guard-box-model-urbi 0 "vírgula DENTRO de :not() não separa seletores" <<'TS'
const e = css`.wrapper:not(.a, urbi-arriscado) { width: 100%; }`;
TS

caso guard-box-model-urbi 0 "vírgula dentro de [] também não separa" <<'TS'
const e = css`.wrapper[data-x="a,urbi-arriscado"] { width: 100%; }`;
TS

# O outro sentido do mesmo conserto: vírgula de verdade PRECISA continuar
# separando, senão o conserto do falso positivo vira falso negativo.
caso guard-box-model-urbi 1 "vírgula EXTERNA continua separando — o segundo alcança" \
  'caso\.ts:1 +\.x, urbi-arriscado \{ width: 100% \}' <<'TS'
const e = css`.x, urbi-arriscado { width: 100%; }`;
TS

secao "Pseudo-elemento não é o host — a caixa que recebe a declaração é outra:"

caso guard-box-model-urbi 0 "::part() dimensiona a parte exposta, não o host" <<'TS'
const e = css`urbi-arriscado::part(icone) { width: 100%; }`;
TS

caso guard-box-model-urbi 0 "::before é caixa própria, sem o padding do :host" <<'TS'
const e = css`urbi-arriscado::before { width: 100%; }`;
TS

caso guard-box-model-urbi 0 ":before legado — dois-pontos único, mesma caixa" <<'TS'
const e = css`urbi-arriscado:before { width: 100%; }`;
TS

# O contra-caso: pseudo-CLASSE de dois-pontos único continua sendo o host, e
# excluí-la junto seria trocar o falso positivo por um falso negativo.
caso guard-box-model-urbi 1 "pseudo-CLASSE :hover continua alcançando o host" \
  'caso\.ts:1 +urbi-arriscado:hover \{ width: 100% \}' <<'TS'
const e = css`urbi-arriscado:hover { width: 100%; }`;
TS

secao "Nome de tag é lido INTEIRO — prefixo de nome não é nome:"

# `<style.foo>` é elemento COMUM para o navegador. Lendo só o prefixo `style`, o
# despacho o classificava como texto cru e mascarava até `</style>` — o
# `urbi-seguro` de dentro é marcação de verdade e passava sem conferência.
caso guard-props-urbi 1 "<style.foo> não é <style> — o componente dentro é conferido" \
  'caso\.ts:1 +<urbi-seguro> inventado' <<'TS'
const t = html`<style.foo><urbi-seguro inventado="x"></urbi-seguro></style.foo>`;
TS

caso guard-props-urbi 1 "<style> de verdade continua sendo texto cru" \
  'caso\.ts:2 +<urbi-seguro> inventado' <<'TS'
const t = html`<style><urbi-seguro inventado="x"></urbi-seguro></style>
<urbi-seguro inventado="y"></urbi-seguro>`;
TS

caso guard-props-urbi 1 "nome de tag interrompido pelo fim do trecho — recusa" \
  'no meio do nome de tag' <<'TS'
const t = html`<urbi-seguro`;
TS

caso guard-props-urbi 1 "</ sem nome não é modelado — recusa" \
  'nao modelo' <<'TS'
const t = html`<div></ x></div>`;
TS

# ════════════════════════════════════════════════════════════════════════════
# Executa a fila em paralelo e imprime na ordem de declaração.
POOL="${POOL:-8}"
find "$TMP" -maxdepth 1 -name 'c[0-9]*' -type d -print0 \
  | xargs -0 -r -P "$POOL" -n 1 "$TMP/rodar-caso.sh"

for item in "${ORDEM[@]}"; do
  tipo="${item%%|*}"; val="${item#*|}"
  if [ "$tipo" = "S" ]; then printf '%s\n' "$val"; continue; fi
  if [ ! -f "$TMP/c$val/veredito" ]; then
    printf '  FALHA caso %s não produziu veredito\n' "$val"; FALHAS=$((FALHAS+1)); continue
  fi
  sed 's/^/  /' "$TMP/c$val/veredito"
  grep -q '^FALHA' "$TMP/c$val/veredito" && FALHAS=$((FALHAS+1))
done

# ── casos que não passam pelo harness: mexem no ambiente, não no código ─────
echo "Setup ausente — os três morrem com 2, e não passam calados:"
for g in guard-tokens-css guard-props-urbi guard-box-model-urbi; do
  TOTAL=$((TOTAL+1))
  d="$TMP/semespelho"; rm -rf "$d"; mkdir -p "$d/scripts/lib" "$d/frontend"
  cp "$TMP/base/scripts/"*.mjs "$d/scripts/"; cp "$TMP/base/scripts/lib/"*.mjs "$d/scripts/lib/"
  rc=0; (cd "$d" && node "scripts/$g.mjs" >/dev/null 2>&1) || rc=$?
  if [ "$rc" = "2" ]; then
    printf '  ok    %s sem espelho → 2\n' "$g"
  else
    printf '  FALHA %s sem espelho — esperado=2 obtido=%s\n' "$g" "$rc"
    FALHAS=$((FALHAS+1))
  fi
done

# Sem o parser, o guard não tem como analisar nada. O desfecho certo é RECUSAR:
# "não deu para rodar" nunca é "passou".
echo "Sem o pacote typescript — os três recusam, e não aprovam:"
for g in guard-tokens-css guard-props-urbi guard-box-model-urbi; do
  TOTAL=$((TOTAL+1))
  rc=0
  saida="$(cd "$TMP/c1" && URBI_TYPESCRIPT=/nao/existe.js node "scripts/$g.mjs" 2>&1)" || rc=$?
  if [ "$rc" = "2" ] && printf '%s' "$saida" | grep -q 'typescript'; then
    printf '  ok    %s sem typescript → 2, dizendo por quê\n' "$g"
  else
    printf '  FALHA %s sem typescript — esperado=2 obtido=%s\n' "$g" "$rc"
    printf '%s\n' "$saida" | sed 's/^/          | /'
    FALHAS=$((FALHAS+1))
  fi
done

echo
if [ "$FALHAS" = "0" ]; then
  echo "ok: os três guards de UI passaram nos $TOTAL casos."
  exit 0
fi
echo "FALHOU: $FALHAS de $TOTAL caso(s) dos guards de UI."
exit 1
