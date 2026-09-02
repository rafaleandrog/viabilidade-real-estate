#!/bin/bash
# Bateria do `scripts/guard-aba-default-literal.mjs` — a aba default do Avançado
# é um LITERAL, e as origens dela concordam (#638).
#
# POR QUE EXISTE, e por que testa os DOIS sentidos. O guard nasceu para barrar
# uma defesa que não existia: a aba default `'resumo'` É `PAGINAS[0]`, e por isso
# nenhuma asserção de comportamento distingue o literal da derivação. Com a
# mutação `PAGINAS[0].id` nas DUAS origens, o typecheck, a suíte de frontend e os
# casos de render ficam INTEIRAMENTE VERDES — a medição datada, com os números,
# está em `frontend/nav-avancado.test.ts`, onde ela é a evidência de que a defesa
# não existia. Aqui não se repete: contagem duplicada em dois artefatos
# versionados diverge sem nada ficar vermelho (armadilha 13 do `CLAUDE.md`).
#
# O sentido oposto importa tanto quanto: guard que acusa código correto — um
# `'resumo' as AbaTopo`, um literal entre parênteses — é guard que alguém
# desliga, e aí ele não guarda mais nada — os casos rotulados "falso positivo"
# e os que dizem "passa" existem só para isso. Não os cite por NÚMERO: numeração
# de caso desloca quando alguém insere um no meio, e a frase envelhece calada
# (esta linha já esteve errada em um, dizendo "os casos 5 a 7" quando eram 6 a 8).
#
# DETERMINÍSTICA POR CONSTRUÇÃO: cada caso monta uma árvore nova em `mktemp -d`
# e roda o guard contra ELA (`node … <raiz>`). Nenhum caso lê a árvore de
# trabalho, então o veredito não muda conforme o que estiver commitado ou sujo.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

# O guard sob teste. O override existe para o META-CONTROLE: uma bateria que
# passa de primeira não prova nada até se saber que ela REPROVA um guard
# quebrado. Com `URBI_GUARD_ABA` aponta-se para uma cópia mutada, em vez de
# mexer no arquivo de verdade — mutar o original enquanto outra sessão o lê é
# como um conserto vira medição de outra coisa.
#
#   sed 's/if (falhas.length > 0)/if (false)/' scripts/guard-aba-default-literal.mjs \
#     > scripts/.tmp-g.mjs
#   URBI_GUARD_ABA=$PWD/scripts/.tmp-g.mjs bash scripts/testar-guard-aba-default.sh
#
# Medido em 2026-09-02, com a bateria de 20 casos: guard sempre-passa mata 13
# casos (os 13 que esperam `reprova`), guard sempre-reprova mata 7 (os 7 que
# esperam `ok`). Os dois lados têm quem os segure.
#
# ⚠️ A CÓPIA TEM DE FICAR EM `scripts/`, e isto custou uma medição falsa. Posta
# em `/tmp`, ela não resolve o `import './lib/fonte-ts.mjs'` e MORRE no
# carregador de módulos — exit 1 em todo caso. Aí todo caso que espera `reprova`
# passa de graça, e o meta-controle vira decoração. O sintoma que denuncia:
# **as duas mutações opostas devolveram o MESMO número** (7 e 7). Mutação que
# não muda o resultado não foi aplicada — antes de crer no número, confira que a
# cópia CARREGA (`node scripts/.tmp-g.mjs .` tem de imprimir algo do guard, não
# um ERR_MODULE_NOT_FOUND). É a mesma armadilha do `tsc` sem `node_modules`
# registrada no `CLAUDE.md`: falha que se parece com sucesso.
GUARD="${URBI_GUARD_ABA:-$PWD/scripts/guard-aba-default-literal.mjs}"
FALHAS=0
TOTAL=0
ok()    { printf '  ok    %s\n' "$1"; }
falha() { printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

TMPRAIZ="$(mktemp -d)"
trap 'rm -rf "$TMPRAIZ"' EXIT

# arvore <nome> <corpo-da-classe> — monta a tela mínima com as duas origens do
# default. O preâmbulo (PAGINAS/IDS_TOPO) é o real, para que a derivação testada
# seja a que de fato compilaria no arquivo de produção.
arvore() {
  local raiz="$TMPRAIZ/$1/frontend"; shift
  mkdir -p "$raiz"
  {
    printf "type AbaTopo = 'resumo' | 'empreendimento' | 'obra';\n"
    printf "const PAGINAS: { id: AbaTopo; label: string }[] = [\n"
    printf "  { id: 'resumo', label: 'Resumo' },\n"
    printf "  { id: 'empreendimento', label: 'Empreendimento' },\n"
    printf "];\n"
    printf "const IDS_TOPO = PAGINAS.map((a) => a.id) as AbaTopo[];\n"
    printf "declare function idDaSlug(v: string): string;\n"
    printf "declare const PADRAO: AbaTopo;\n"
    printf "declare function property(o: unknown): any;\n"
    printf "export class ViabTelaAvancado {\n"
    printf '%s\n' "$1"
    printf "  get aba(): AbaTopo { return this._aba; }\n"
    printf "}\n"
  } > "$raiz/tela-avancado.ts"
  echo "${raiz%/frontend}"
}

# — o estado de produção: as duas origens são o literal, e concordam.
CERTO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# — a mutação que a issue documenta, nas duas origens.
DERIVADO_AMBOS="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = PAGINAS[0].id;"

# — uma origem de cada vez: a regra é por ORIGEM, não pelo arquivo.
DERIVADO_SO_INICIALIZADOR="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = PAGINAS[0].id;"

DERIVADO_SO_SETTER="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : IDS_TOPO[0];
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# — indireção: a variável guarda o literal, mas a ORIGEM deixou de ser um
# literal, e a próxima edição da variável muda o default sem tocar aqui.
INDIRECAO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PADRAO;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# — falsos positivos que NÃO podem reprovar: \`as\`, parênteses e template sem
# substituição são o mesmo literal, escrito de outro jeito.
AS_E_PARENTESES="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : ('resumo' as AbaTopo);
    this._aba = val;
  }
  private _aba: AbaTopo = ('resumo');"

TEMPLATE_SEM_SUBSTITUICAO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : \`resumo\`;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# — o default mudou de valor, e isso é legítimo: o guard pede literal, não pede
# 'resumo'. Se ele reprovasse aqui, obrigaria a editá-lo a cada mudança de UI.
OUTRO_VALOR="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'obra';
    this._aba = val;
  }
  private _aba: AbaTopo = 'obra';"

# — duas literais que DISCORDAM: a aba que abre deixa de ser a aba para onde um
# slug desconhecido cai. Nenhuma das duas está errada isoladamente.
DISCORDAM="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'obra';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# — origem que SUMIU. Sem o inicializador, o default do campo passa a ser
# `undefined` e a regra não tem o que guardar; sem o ternário do setter, o
# fallback deixou de existir. Os dois são tão graves quanto a derivação, e é
# isto que fecha a lista de origens por CONTAGEM: ela não pode encolher calada.
SEM_INICIALIZADOR="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    this._aba = val;
  }
  private _aba!: AbaTopo;"

SEM_TERNARIO="  set aba(v: string) {
    this._aba = idDaSlug(v) as AbaTopo;
  }
  private _aba: AbaTopo = 'resumo';"


# ── Achado do revisor externo (Codex, P2, PR 665) ──────────────────────────
# Um ternário INOCENTE antes do real. A primeira versão do guard pegava o
# PRIMEIRO `ConditionalExpression` em ordem de árvore, registrava o `'resumo'`
# dele e aprovava o arquivo com o fallback verdadeiro já derivado. Medido:
# `exit 0`. Era o defeito que o guard existe para barrar, dentro do guard.
TERNARIO_INOCENTE_ANTES="  set aba(v: string) {
    const bruto = typeof v === 'string' ? v : 'resumo';
    const id = idDaSlug(bruto);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# O sentido oposto do mesmo achado: o ternário inocente NÃO pode fazer fiação
# correta reprovar.
TERNARIO_INOCENTE_COM_LITERAL="  set aba(v: string) {
    const bruto = typeof v === 'string' ? v : 'resumo';
    const id = idDaSlug(bruto);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# Cadeia de aliases: o rastreio segue `this._aba = b`, `b = a`, `a = <ternário>`.
ALIAS_EM_CADEIA="  set aba(v: string) {
    const id = idDaSlug(v);
    const a = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    const b = a;
    this._aba = b;
  }
  private _aba: AbaTopo = 'resumo';"

# \`??\` é a outra maneira de escrever "isto, senão aquilo" — o fallback continua
# visível, e o guard o encontra.
FALLBACK_COM_NULLISH="  set aba(v: string) {
    this._aba = (idDaSlug(v) as AbaTopo) ?? 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

FALLBACK_COM_NULLISH_DERIVADO="  set aba(v: string) {
    this._aba = (idDaSlug(v) as AbaTopo) ?? PAGINAS[0].id;
  }
  private _aba: AbaTopo = 'resumo';"

# Ambiguidade REPROVA em vez de escolher: com duas atribuições, qual delas é o
# fallback é decisão que o guard não pode tomar sozinho.
DUAS_ATRIBUICOES="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = 'resumo';
    if (IDS_TOPO.includes(id as AbaTopo)) this._aba = id as AbaTopo;
  }
  private _aba: AbaTopo = 'resumo';"

# O valor vem de fora do setter: o guard não o alcança, e diz isso.
VALOR_DE_FORA="  set aba(v: string) {
    this._aba = calculadoLaFora;
  }
  private _aba: AbaTopo = 'resumo';"

# Sem fallback visível: um default escondido dentro de uma função é exatamente o
# que o guard existe para impedir.
SEM_FALLBACK_VISIVEL="  set aba(v: string) {
    this._aba = normalizar(v);
  }
  private _aba: AbaTopo = 'resumo';"


# ── if/else: a MESMA forma, escrita como statement ─────────────────────────
# Reprovar isto seria acusar código correto, que é o caminho mais curto para
# alguém desligar o guard.
IF_ELSE_LITERAL="  set aba(v: string) {
    const id = idDaSlug(v);
    if (IDS_TOPO.includes(id as AbaTopo)) { this._aba = id as AbaTopo; } else { this._aba = 'resumo'; }
  }
  private _aba: AbaTopo = 'resumo';"

IF_ELSE_DERIVADO="  set aba(v: string) {
    const id = idDaSlug(v);
    if (IDS_TOPO.includes(id as AbaTopo)) { this._aba = id as AbaTopo; } else { this._aba = PAGINAS[0].id; }
  }
  private _aba: AbaTopo = 'resumo';"

# \`satisfies\` e o mesmo literal escrito de outro jeito — reprova-lo seria falso
# positivo, e com diagnostico errado ("derivar da lista") ainda por cima.
SATISFIES_LITERAL="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : ('resumo' satisfies AbaTopo);
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

SATISFIES_DERIVADO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : (PAGINAS[0].id satisfies AbaTopo);
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# ── as outras duas formas do mesmo P1, achadas pela lente nativa ────────────
# O ternario inocente nao precisa ser um statement: basta estar num ARGUMENTO,
# ou ate no DECORATOR colado ao setter. A versao ingenua do guard pegava o
# primeiro ternario em ordem de arvore, e os dois vinham antes.
TERNARIO_EM_ARGUMENTO="  set aba(v: string) {
    const id = idDaSlug(v ? v : 'resumo');
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

TERNARIO_EM_DECORATOR="  @property({ type: String, converter: PAGINAS.length ? undefined : 'resumo' })
  set aba(v: string) {
    const id = idDaSlug(v);
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# ⚠️ TRÊS desfechos, não dois. `if node …` colapsaria `exit 2` (RECUSA: sem o
# parser, o guard não mediu nada) e um crash do próprio guard em "reprovou" —
# e aí a bateria diagnostica ao contrário, mandando caçar falsos positivos que
# não existem. Medido: com um `ReferenceError` no guard, 8 de 12 casos passavam
# por acidente. Recusa e crash são falha DA BATERIA, e é assim que ela reporta.
verificar() { # <nome> <raiz> <esperado: ok|reprova>
  local nome="$1" raiz="$2" esperado="$3" rc=0
  TOTAL=$((TOTAL+1))
  node "$GUARD" "$raiz" >/dev/null 2>&1 || rc=$?
  if [ "$rc" -ge 2 ]; then
    falha "$nome" "o guard saiu $rc (recusa ou crash) — a bateria NÃO mediu a regra"
  elif [ "$rc" -eq 0 ]; then
    [ "$esperado" = "ok" ] && ok "$nome" || falha "$nome" "o guard passou, e devia reprovar"
  else
    [ "$esperado" = "reprova" ] && ok "$nome" || falha "$nome" "o guard reprovou código correto (falso positivo)"
  fi
}

echo "bateria do guard de default de aba (#638):"
verificar "1  base legítima: as duas origens são o literal"      "$(arvore c1  "$CERTO")"                     ok
verificar "2  mutação da issue: PAGINAS[0].id nas duas origens"  "$(arvore c2  "$DERIVADO_AMBOS")"            reprova
verificar "3  só o inicializador derivado já reprova"            "$(arvore c3  "$DERIVADO_SO_INICIALIZADOR")" reprova
verificar "4  só o fallback derivado (IDS_TOPO[0]) já reprova"   "$(arvore c4  "$DERIVADO_SO_SETTER")"        reprova
verificar "5  indireção por variável não é literal"              "$(arvore c5  "$INDIRECAO")"                 reprova
verificar "6  falso positivo: 'as' e parênteses passam"          "$(arvore c6  "$AS_E_PARENTESES")"           ok
verificar "7  falso positivo: template sem substituição passa"   "$(arvore c7  "$TEMPLATE_SEM_SUBSTITUICAO")" ok
verificar "8  o default pode MUDAR de valor, se for literal"     "$(arvore c8  "$OUTRO_VALOR")"               ok
verificar "9  literais que discordam entre si reprovam"          "$(arvore c9  "$DISCORDAM")"                 reprova
verificar "10 origem que sumiu: sem inicializador reprova"       "$(arvore c10 "$SEM_INICIALIZADOR")"         reprova
verificar "11 origem que sumiu: setter sem ternário reprova"     "$(arvore c11 "$SEM_TERNARIO")"              reprova
verificar "12 arquivo inteiro ausente reprova"                   "$TMPRAIZ/nao-existe"                        reprova
verificar "13 ternário inocente ANTES não esconde derivação"    "$(arvore c13 "$TERNARIO_INOCENTE_ANTES")"   reprova
verificar "14 ternário inocente ANTES não reprova literal"      "$(arvore c14 "$TERNARIO_INOCENTE_COM_LITERAL")" ok
verificar "15 cadeia de aliases é rastreada até o ternário"     "$(arvore c15 "$ALIAS_EM_CADEIA")"           ok
verificar "16 fallback por '??' com literal passa"              "$(arvore c16 "$FALLBACK_COM_NULLISH")"      ok
verificar "17 fallback por '??' derivado reprova"               "$(arvore c17 "$FALLBACK_COM_NULLISH_DERIVADO")" reprova
verificar "18 duas atribuições a _aba: ambíguo, reprova"        "$(arvore c18 "$DUAS_ATRIBUICOES")"          reprova
verificar "19 valor vindo de fora do setter reprova"            "$(arvore c19 "$VALOR_DE_FORA")"             reprova
verificar "20 sem fallback visível reprova"                     "$(arvore c20 "$SEM_FALLBACK_VISIVEL")"      reprova
verificar "21 if/else com literal no else passa"                "$(arvore c21 "$IF_ELSE_LITERAL")"           ok
verificar "22 if/else com derivação no else reprova"            "$(arvore c22 "$IF_ELSE_DERIVADO")"          reprova
verificar "23 falso positivo: 'satisfies' com literal passa"    "$(arvore c23 "$SATISFIES_LITERAL")"         ok
verificar "24 'satisfies' sobre derivação reprova"              "$(arvore c24 "$SATISFIES_DERIVADO")"        reprova
verificar "25 ternário inocente em ARGUMENTO não cega o guard"  "$(arvore c25 "$TERNARIO_EM_ARGUMENTO")"     reprova
verificar "26 ternário inocente em DECORATOR não cega o guard"  "$(arvore c26 "$TERNARIO_EM_DECORATOR")"     reprova

# ── INVENTÁRIO: a metade do critério (a) que as fixtures não cobrem ────────
#
# As fixtures fecham o sentido "entrada a MENOS": apagar uma origem de `ORIGENS`
# deixa casos vermelhos. Elas NÃO fecham "entrada a MAIS" — medido pelo revisor,
# uma 3ª entrada duplicada passava com a bateria inteira verde, enquanto o
# cabeçalho do guard afirmava fecho por contagem exata. Este caso é o que torna
# aquela afirmação verdadeira.
#
# A comparação é por CHAVES EXATAS, não por comprimento: contar 2 aceitaria
# trocar uma origem por outra. E é por contagem, não por presença — é a diferença
# que o CLAUDE.md § lista de exceção cobra.
esperado_inventario='fallback-setter:aba|inicializador:_aba'
real_inventario="$(node -e "
  import('./scripts/guard-aba-default-literal.mjs').then((m) => {
    const chaves = m.ORIGENS.map((o) => o.tipo + ':' + o.membro).sort();
    process.stdout.write(chaves.join('|'));
  });
" 2>/dev/null)"
TOTAL=$((TOTAL+1))
if [ "$real_inventario" = "$esperado_inventario" ]; then
  ok "27 inventário de ORIGENS: exatamente as 2 origens esperadas"
else
  falha "27 inventário de ORIGENS" "esperado \`$esperado_inventario\`, veio \`$real_inventario\` — origem acrescentada, removida ou renomeada sem atualizar esta bateria"
fi

if [ "$FALHAS" -gt 0 ]; then
  echo "❌ bateria do guard de default de aba: $FALHAS falha(s)." >&2
  exit 1
fi
echo "✅ bateria do guard de default de aba: $TOTAL casos, nos dois sentidos."
