#!/bin/bash
# Bateria do `scripts/guard-fiacao-funding.mjs` — regra "Grupo de receita nasce
# canônico" (#657) e o recorte de corpo de método que ela usa.
#
# POR QUE EXISTE, e por que testa os DOIS sentidos: o guard já falhou calado
# UMA vez neste mesmo PR. A regra nasceu como `exige` (presença no arquivo), e
# apagar a chamada deixava tudo VERDE — o método continuava definido 32 mil
# caracteres abaixo e a regex o achava. Uma defesa acrescentada e não
# exercitada, que é a classe de defeito que a regra existe para barrar.
#
# Depois disso o revisor externo achou o segundo buraco: o recorte contava `{`
# e `}` cegamente. Falso POSITIVO (uma `}` numa string encerra o corpo cedo)
# atrapalha fiação correta, alguém desliga o guard, e ele para de guardar.
# Falso NEGATIVO (uma `{` numa string estende o recorte até engolir a definição
# do método) devolve o guard ao estado de decoração. Os dois estão aqui.
#
# DETERMINÍSTICA POR CONSTRUÇÃO: cada caso monta uma árvore nova em `mktemp -d`
# e roda o guard contra ELA (`node … <raiz>`). Nenhum caso lê a árvore de
# trabalho, então o veredito não muda conforme o que estiver commitado ou sujo.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

GUARD="$PWD/scripts/guard-fiacao-funding.mjs"
FALHAS=0
ok()    { printf '  ok    %s\n' "$1"; }
falha() { printf '  FALHA %s — %s\n' "$1" "$2"; FALHAS=$((FALHAS+1)); }

TMPRAIZ="$(mktemp -d)"
trap 'rm -rf "$TMPRAIZ"' EXIT

# arvore <nome> <corpo-do-metodo-que-cria> — monta uma tela mínima que é
# consumidora da regra (chama `criarFaseAvancado(` e cita `tipo: 'receita'`).
arvore() {
  local raiz="$TMPRAIZ/$1"; shift
  mkdir -p "$raiz"
  {
    printf 'export class Tela {\n'
    printf '%s\n' "$1"
    printf '\n  private async _nascerCanonico(fase: any) {\n'
    printf '    return planoDeNascimento(fase.fluxo_pagamento, this.crono, 0);\n'
    printf '  }\n}\n'
  } > "$raiz/tela-fluxo-receitas.ts"
  echo "$raiz"
}

# Corpos usados pelos casos. O `\n` literal é resolvido pelo printf da `arvore`.
CERTO="  private _adicionarFase = async () => {
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, await this._nascerCanonico(res)];
  };"

MUTADO="  private _adicionarFase = async () => {
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, res];
  };"

CHAVE_FECHA_EM_STRING="  private _adicionarFase = async () => {
    const rotulo = 'fim do bloco }';
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, await this._nascerCanonico(res)];
  };"

CHAVE_ABRE_EM_COMENTARIO="  private _adicionarFase = async () => {
    // abre um bloco { que nunca fecha, mas e comentario
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, res];
  };"

# Achado do revisor externo na rodada 2: a chamada COMENTADA era aceita como
# fiacao ativa pela regex, e o Grupo voltava a nascer no fluxo legado.
CHAMADA_COMENTADA="  private _adicionarFase = async () => {
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    // await this._nascerCanonico(res)
    this.fases = [...this.fases, res];
  };"

# Idem: dentro de \${...} o scanner a mao voltava a contar chaves cegamente.
# Aqui a criacao ficava marcada como TEXTO, `corpos.length === 0` aceitava o
# arquivo, e o guard passava mesmo com a conversao removida.
TEMPLATE_ENGOLE="  private _adicionarFase = async () => {
    const x = \`\${\`}\`}\`;
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, res];
  };"

# O sentido oposto do mesmo achado: \${'{'} fazia fiacao CORRETA reprovar.
TEMPLATE_FALSO_POSITIVO="  private _adicionarFase = async () => {
    const y = \`\${'{'}\`;
    const res = await criarFaseAvancado(this.id, { tipo: 'receita' });
    this.fases = [...this.fases, await this._nascerCanonico(res)];
  };"

# Menção em COMENTARIO nao e consumo: um arquivo que so cita o nome nao e
# consumidor e nao pode ser acusado.
SO_MENCAO="  private _outraCoisa() {
    // aqui um dia houve criarFaseAvancado(this.id, { tipo: 'receita' })
    return 1;
  }"

verificar() { # <nome> <raiz> <esperado: ok|reprova>
  local nome="$1" raiz="$2" esperado="$3"
  if node "$GUARD" "$raiz" >/dev/null 2>&1; then
    [ "$esperado" = "ok" ] && ok "$nome" || falha "$nome" "o guard passou, e devia reprovar"
  else
    [ "$esperado" = "reprova" ] && ok "$nome" || falha "$nome" "o guard reprovou fiacao correta (falso positivo)"
  fi
}

echo "bateria do guard de fiação (#657):"
verificar "1 base legítima: a conversão está no método"        "$(arvore c1 "$CERTO")"                  ok
verificar "2 mutação: chamada apagada reprova"                 "$(arvore c2 "$MUTADO")"                 reprova
verificar "3 falso positivo: '}' dentro de string não trunca"  "$(arvore c3 "$CHAVE_FECHA_EM_STRING")"  ok
verificar "4 falso negativo: '{' em comentário não engole"     "$(arvore c4 "$CHAVE_ABRE_EM_COMENTARIO")" reprova
verificar "5 chamada COMENTADA não conta como fiação"           "$(arvore c5 "$CHAMADA_COMENTADA")"        reprova
verificar "6 template \${\`}\`} não faz o recorte engolir tudo"     "$(arvore c6 "$TEMPLATE_ENGOLE")"          reprova
verificar "7 template \${'{'} não reprova fiação correta"       "$(arvore c7 "$TEMPLATE_FALSO_POSITIVO")"  ok
verificar "8 só menção em comentário não é consumidor"         "$(arvore c8 "$SO_MENCAO")"                ok

if [ "$FALHAS" -gt 0 ]; then
  echo "❌ bateria do guard de fiação: $FALHAS falha(s)." >&2
  exit 1
fi
echo "✅ bateria do guard de fiação: 8 casos, nos dois sentidos."
