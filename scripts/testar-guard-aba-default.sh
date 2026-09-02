#!/bin/bash
# Bateria do `scripts/guard-aba-default-literal.mjs` — a aba default do Avançado
# é um LITERAL, e as origens dela concordam (#638).
#
# POR QUE EXISTE, e por que testa os DOIS sentidos. O guard nasceu para barrar
# uma defesa que não existia: a aba default `'resumo'` É `PAGINAS[0]`, e por isso
# nenhuma asserção de comportamento distingue o literal da derivação. Medido em
# 2026-09-02, com a mutação `PAGINAS[0].id` nas DUAS origens: `validar-frontend.sh`
# fechou 8/8, **1048 testes de frontend e 74 casos de render VERDES**.
#
# O sentido oposto importa tanto quanto: guard que acusa código correto — um
# `'resumo' as AbaTopo`, um literal entre parênteses — é guard que alguém
# desliga, e aí ele não guarda mais nada. Os casos 5 a 7 são só isso.
#
# DETERMINÍSTICA POR CONSTRUÇÃO: cada caso monta uma árvore nova em `mktemp -d`
# e roda o guard contra ELA (`node … <raiz>`). Nenhum caso lê a árvore de
# trabalho, então o veredito não muda conforme o que estiver commitado ou sujo.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

GUARD="$PWD/scripts/guard-aba-default-literal.mjs"
FALHAS=0
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

verificar() { # <nome> <raiz> <esperado: ok|reprova>
  local nome="$1" raiz="$2" esperado="$3"
  if node "$GUARD" "$raiz" >/dev/null 2>&1; then
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

if [ "$FALHAS" -gt 0 ]; then
  echo "❌ bateria do guard de default de aba: $FALHAS falha(s)." >&2
  exit 1
fi
echo "✅ bateria do guard de default de aba: 12 casos, nos dois sentidos."
