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

# ── espelho sintético ───────────────────────────────────────────────────────
mkdir -p "$TMP/scripts/lib" "$TMP/docs/ui-urbiverso"
cp scripts/guard-tokens-css.mjs scripts/guard-props-urbi.mjs scripts/guard-box-model-urbi.mjs "$TMP/scripts/"
cp scripts/lib/fonte-ts.mjs "$TMP/scripts/lib/"

cat > "$TMP/docs/ui-urbiverso/tokens.json" <<'JSON'
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
cat > "$TMP/docs/ui-urbiverso/primitivos.json" <<'JSON'
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
# `caso <guard> <saída-esperada> <descrição> [padrão-ERE]`
#
# ⚠️ O quarto argumento não é enfeite. Conferir só o CÓDIGO DE SAÍDA deixa passar
# o pior tipo de teste verde: o que acerta pelo motivo errado. Aconteceu duas
# vezes na revisão do PR 505 — com `${`${'{'}`}` e com `// abre {` dentro de uma
# interpolação, o guard acusava, mas com o SELETOR CORROMPIDO (`color: .x
# urbi-arriscado`), e só continuava acusando porque o sujeito é o último composto.
# Uma edição adiante virava falso negativo. Todo caso que ACUSA declara o padrão
# que a mensagem tem que casar.
caso() {
  local guard="$1" esperado="$2" desc="$3" padrao="${4:-}" rc saida
  local sem_base="$SEM_BASE"; SEM_BASE=0
  TOTAL=$((TOTAL+1))
  rm -rf "$TMP/frontend"; mkdir -p "$TMP/frontend"
  cat > "$TMP/frontend/caso.ts"
  [ "$sem_base" = "1" ] || printf '%s\n' "$BASE_DISPENSA" > "$TMP/frontend/tela-resumo.ts"
  saida="$(cd "$TMP" && node "scripts/$guard.mjs" 2>&1)"; rc=$?
  if [ "$rc" != "$esperado" ]; then
    printf '  FALHA %s — saída esperada=%s obtida=%s\n' "$desc" "$esperado" "$rc"
    printf '%s\n' "$saida" | sed 's/^/          | /'
    FALHAS=$((FALHAS+1))
    return
  fi
  if [ -n "$padrao" ] && ! printf '%s' "$saida" | grep -qE "$padrao"; then
    printf '  FALHA %s — saída certa (%s) pelo MOTIVO ERRADO: nada casa /%s/\n' "$desc" "$rc" "$padrao"
    printf '%s\n' "$saida" | sed 's/^/          | /'
    FALHAS=$((FALHAS+1))
    return
  fi
  printf '  ok    %s\n' "$desc"
}

# ════════════════════════════════════════════════════════════════════════════
echo "guard-tokens-css — ACUSA (falso negativo é o que se procura aqui):"

caso guard-tokens-css 1 "token inexistente com fallback (o caso da #475)" 'caso\.ts:1 +--cor-nao-existe' <<'TS'
const e = css`.x { background: var(--cor-nao-existe, rgba(255,255,255,0.06)); }`;
TS

caso guard-tokens-css 1 "token inexistente ANINHADO dentro de um var() válido" <<'TS'
const e = css`.x { color: var(--cor-texto, var(--cor-inventada, #fff)); }`;
TS

echo "guard-tokens-css — NÃO acusa (falso positivo desliga a guarda):"

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
echo "guard-props-urbi — ACUSA:"

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

echo "guard-props-urbi — NÃO acusa:"

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
echo "guard-box-model-urbi — ACUSA:"

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

echo "guard-box-model-urbi — NÃO acusa:"

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

echo "Fronteira de \${…} — ACUSA (era falso negativo, com saída ZERO):"

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

caso guard-box-model-urbi 1 "<style> de template SEM tag é CSS de verdade (o caso do exportar.ts)" \
  'caso\.ts:2 +\.x urbi-arriscado \{ width: 100% \}' <<'TS'
const doc = `<!doctype html><style>
  .x urbi-arriscado { width: 100%; }
</style>`;
TS

echo "Comentário e string — NÃO acusa (era falso positivo, que faz desligar a guarda):"

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

echo "Setup ausente — os três morrem com 2, e não passam calados:"
for g in guard-tokens-css guard-props-urbi guard-box-model-urbi; do
  TOTAL=$((TOTAL+1))
  rm -rf "$TMP/docs-guardado"; mv "$TMP/docs" "$TMP/docs-guardado"
  rc=0; (cd "$TMP" && node "scripts/$g.mjs" >/dev/null 2>&1) || rc=$?
  mv "$TMP/docs-guardado" "$TMP/docs"
  if [ "$rc" = "2" ]; then
    printf '  ok    %s sem espelho → 2\n' "$g"
  else
    printf '  FALHA %s sem espelho — esperado=2 obtido=%s\n' "$g" "$rc"
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
