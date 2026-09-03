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
# desliga, e aí ele não guarda mais nada. Os casos rotulados "falso positivo" e
# os que dizem "passa" existem só para isso. Não os cite por NÚMERO: numeração
# desloca quando alguém insere um caso no meio, e a frase envelhece calada (esta
# linha já esteve errada em um, dizendo "os casos 5 a 7" quando eram 6 a 8).
#
# ⚠️ MUITAS FIXTURES AQUI SÃO ARQUEOLOGIA, e é de propósito. As rodadas 1 a 4 de
# revisão furaram quatro desenhos sucessivos do guard, e cada furo virou caso.
# Boa parte deles hoje reprova por uma regra DIFERENTE da que os pegou quando
# foram escritos — o `?? 'resumo'` sobre derivação, por exemplo, já foi barrado
# por "forma não aceita" e hoje é barrado por "leitura por ordem". O comentário
# de cada um conta a história do furo, não a regra vigente; quem quiser a regra
# lê o cabeçalho do guard. Eles ficam porque um caso que só reprova por acidente
# do desenho atual é exatamente o que regride calado no desenho seguinte.
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
# O resultado esperado é estrutural, e por isso não envelhece: o guard
# sempre-passa mata TODOS os casos que esperam `reprova`, o sempre-reprova mata
# todos os que esperam `ok`, e os dois números somam o total MENOS UM.
#
# ⚠️ O "menos um" é o caso de INVENTÁRIO, e a frase já esteve errada sem ele:
# aquele caso não roda o guard como processo (faz `import` e lê `ORIGENS`), então
# é imune às duas mutações e sobrevive às duas. Quem seguisse a receita achava a
# soma um a menos que o total e ia caçar um caso quebrado que não existe. Não se anota aqui
# quantos são — contador em artefato versionado diverge a cada caso novo sem nada
# ficar vermelho (armadilha 13 do `CLAUDE.md`), e este texto já nasceu errado uma
# vez, dizendo 13/7 para uma bateria que já tinha ido a 27 casos.
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
# arvore <nome> <corpo-da-classe> [<codigo-extra-de-modulo>]
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
    printf "declare const MAPA: Record<string, number>;\n"
    printf "declare function defaultDaLista(): AbaTopo;\n"
    printf "const PAGINAS_TOPO = PAGINAS;\n"
    printf "declare function property(o: unknown): any;\n"
    printf '%s\n' "${2:-}"
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
# `undefined` e a regra não tem o que guardar; sem NENHUMA forma de fallback no
# setter, não há default que o guard possa apontar. Os dois são tão graves quanto
# a derivação — o guard aprova o que consegue LER, e o que ele não consegue ler
# ele reprova, em vez de aprovar no escuro. É o mesmo motivo do caso 33.
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

# ── Rodada 2: as TRÊS regressões que o conserto da rodada 1 introduziu ──────
# Todas medidas contra `HEAD~1`: o guard INGÊNUO reprovava e o guard "consertado"
# aprovava com `PAGINAS[0].id`. É a mesma classe voltando pela segunda vez, e foi
# ela que motivou a inversão da rodada 3 — que a rodada 4 depois substituiu pela
# regra de ORDEM, hoje quem as reprova.

# P1-a · sombra de nome em BLOCO: um `const val` num escopo interno anterior, e
# `acharDecl` pegava a primeira declaração em ordem de árvore.
SOMBRA_EM_BLOCO="  set aba(v: string) {
    const id = idDaSlug(v);
    if (id === 'x') { const val = 'resumo'; void val; }
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# P1-a (variante) · a mesma sombra dentro de uma ARROW — a forma mais provável
# num refactor real.
SOMBRA_EM_ARROW="  set aba(v: string) {
    const id = idDaSlug(v);
    const registrar = () => { const val: AbaTopo = 'resumo'; return val; };
    void registrar;
    const val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# P1-b · o ternário derivado engolido por um \`?? 'resumo'\`: o guard devolvia
# \`.right\` sem olhar o que sobrara a ESQUERDA.
TERNARIO_SOB_NULLISH="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = (IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id) ?? 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# P1-c · o fallback real no THEN. Le-se natural ("slug vazio -> aba default"), e
# \`ramosDeUmIfSo\` so olhava o \`else\`.
FALLBACK_NO_THEN="  set aba(v: string) {
    const id = idDaSlug(v);
    if (v !== '') { this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id; }
    else { this._aba = 'resumo'; }
  }
  private _aba: AbaTopo = 'resumo';"

# P1-b (degenerado) · nem ternario ha: a derivacao pura sob um \`??\` literal.
DERIVADO_SOB_NULLISH="  set aba(v: string) {
    this._aba = PAGINAS[0].id ?? 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# O setter que IGNORA a entrada: uma atribuicao so, literal direto, sem forma de
# fallback nenhuma. Reprova pelo mesmo motivo que o \`SEM_TERNARIO\` — nos dois o
# fallback deixou de existir, e aprovar um e reprovar o outro tornava falsa a
# justificativa escrita ali em cima.
SETTER_SO_LITERAL="  set aba(v: string) {
    this._aba = 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# Rodada 3, achado do revisor externo: os invólucros de TIPO tinham de ser
# desembrulhados nos DOIS lugares. `(ternário) satisfies AbaTopo` é código
# legítimo e reprovava com "não expõe um fallback" — falso positivo, e do tipo
# que faz alguém desligar o guard.
TERNARIO_SOB_SATISFIES="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = (IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo') satisfies AbaTopo;
  }
  private _aba: AbaTopo = 'resumo';"

TERNARIO_SOB_SATISFIES_DERIVADO="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = (IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id) satisfies AbaTopo;
  }
  private _aba: AbaTopo = 'resumo';"

# Alias MUTÁVEL, achado do revisor externo na rodada 2: `let val = <ternário
# bom>; val = <ternário derivado>; this._aba = val`. Não precisou de conserto
# próprio — a inversão da rodada 3 o reprova por AMBIGUIDADE (duas formas de
# fallback no setter), que é o sinal de que a inversão foi a mudança certa: ela
# fecha portas que ninguém enumerou. O caso fica para isso não regredir calado.
ALIAS_MUTAVEL="  set aba(v: string) {
    const id = idDaSlug(v);
    let val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    val = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# ── Rodada 3: a testemunha que derrubou `??` como forma aceita ─────────────
# Sem chamada NENHUMA — a derivacao esta textualmente dentro do no que o guard
# le. `MAPA[v]` de slug desconhecido e `undefined`, `undefined | 0` e `0`, e o
# default efetivo e `PAGINAS[0].id`. O `?? 'resumo'` e codigo morto.
#
# Importa porque a limitacao que o guard declarava na vespera dizia que o buraco
# era "um default escondido atras de uma CHAMADA" — e este nao tem chamada.
# Declarar uma fronteira nao a fecha, e aquela nem cobria o caso.
NULLISH_MORTO_SEM_CHAMADA="  set aba(v: string) {
    const idx = MAPA[v];
    this._aba = PAGINAS[idx | 0].id ?? 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# ── Falsos positivos que a contagem grossa produzia ────────────────────────
# `||` de PREDICADO nao e `||` de fallback, e a contagem nao distinguia.
OR_BOOLEANO_NO_PREDICADO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = (IDS_TOPO.includes(id as AbaTopo) || id === 'custos') ? (id as AbaTopo) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# Um `??` sem relacao nenhuma com o default, numa linha a um passo do setter de
# producao (`this.requestUpdate('aba', antigo)`).
NULLISH_ALHEIO="  set aba(v: string) {
    const id = idDaSlug(v);
    const antigo = this._aba;
    this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
    void (antigo ?? undefined);
  }
  private _aba: AbaTopo = 'resumo';"

# Ternario dentro de uma ARROW aninhada: nao pode ser o fallback (o rastreio so
# aceita ternario/if-else direto), entao conta-lo so produzia falso positivo.
TERNARIO_EM_ARROW_ANINHADA="  set aba(v: string) {
    const id = idDaSlug(v);
    const rotulo = () => id === 'obra' ? 'Custos' : 'Outra';
    void rotulo;
    this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# A regra B varre o MEMBRO INTEIRO, inclusive funcao aninhada. Um `.find` numa
# arrow que nem alimenta o default reprova -- conservador de proposito. A
# alternativa seria restringir a proibicao ao que e "alcancavel a partir da
# atribuicao", e ALCANCABILIDADE e exatamente a pergunta que furou quatro
# versoes deste guard. Melhor reprovar um uso legitimo raro, com mensagem clara,
# do que reabrir aquela cauda.
FIND_ALHEIO_EM_ARROW="  set aba(v: string) {
    const id = idDaSlug(v);
    const rotulo = () => PAGINAS.find((p) => p.id === id) ? 'sim' : 'nao';
    void rotulo;
    this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# ── Rodada 4: o ternario com ramo MORTO ────────────────────────────────────
# A regra A nao pega estas -- o `whenFalse` E um literal em todas. Quem as fecha
# e a regra B.
#
# ⚠️ O texto daqui ja disse "as seis brechas, todas passavam no guard anterior",
# e a ENUMERACAO estava errada: o caso 47 (ordem no inicializador) ja reprovava
# antes, e a sexta que de fato passava e o caso 48, definido fora deste bloco.
# Quem quiser a lista exata do que a regra B comprou roda a bateria com
# `URBI_GUARD_ABA` apontando para a versao anterior, em vez de crer nesta prosa.
#
# A forma B e a que mais importa: e idiomatica, sai de uma refatoracao de boa-fe
# ("acha a pagina; se nao achar cai na primeira; o `? :` fica por seguranca"), e
# executando o setter ela muda a aba de fallback quando PAGINAS e reordenado.
ORDEM_CLAMP="  set aba(v: string) {
    const id = idDaSlug(v);
    const idx = IDS_TOPO.indexOf(id as AbaTopo);
    const alvo = PAGINAS[Math.max(0, idx)];
    this._aba = alvo ? alvo.id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

ORDEM_FIND_NULLISH="  set aba(v: string) {
    const id = idDaSlug(v);
    const alvo = PAGINAS.find((p) => p.id === id) ?? PAGINAS[0];
    this._aba = alvo ? alvo.id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

ORDEM_CONDICAO_CONSTANTE="  set aba(v: string) {
    const id = idDaSlug(v);
    const idx = IDS_TOPO.indexOf(id as AbaTopo);
    this._aba = PAGINAS.length ? PAGINAS[idx].id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# A colisao de NOME: `exigirDependenciaDaEntrada` casava identificadores por
# texto, e o `.id` de `PAGINAS[0].id` e um Identifier. Como o setter real ja
# declara `const id = idDaSlug(v)`, o nome da propriedade colidia com o local e
# a checagem concluia "usa a entrada". A regra B nao depende de nomes.
ORDEM_COLISAO_DE_NOME="  set aba(v: string) {
    const id = idDaSlug(v);
    void id;
    this._aba = PAGINAS.length > 1 ? PAGINAS[0].id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# O caso 37 (`??` morto) reescrito com ternario: 12 caracteres de diferenca, e
# o guard da rodada 4 passava de exit 1 para exit 0.
ORDEM_37_COM_TERNARIO="  set aba(v: string) {
    const idx = MAPA[v];
    this._aba = PAGINAS[idx | 0] ? PAGINAS[idx | 0].id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# O INICIALIZADOR tambem esta sob a regra B, e por um caminho que a regra A nao
# veria: aqui o literal esta la, e a leitura por ordem esta no setter.
ORDEM_NO_INICIALIZADOR="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
  }
  private _aba: AbaTopo = PAGINAS[0] ? 'resumo' : 'resumo';"

# `let` sem inicializador (switch, try/catch): o veredito e reprova, e o que este
# caso trava e a CAUSA apontada. A mensagem ja disse "nao e declarado dentro do
# setter" para uma variavel que E declarada, mandando investigar o lugar errado.
LET_SEM_INICIALIZADOR="  set aba(v: string) {
    let val: AbaTopo;
    switch (v) { case 'obra': val = 'obra'; break; default: val = PAGINAS[0].id; }
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

# A assinatura que o guard imprime quando reprova de PROPÓSITO. Conferi-la é o
# que distingue "reprovou" de "estourou".
ASSINATURA_REPROVA='o default de aba não está protegido'

# ⚠️ QUATRO desfechos, não três, e o quarto custou um achado do revisor externo.
# `exit 1` sozinho NÃO prova reprovação: uma exceção não capturada também sai 1.
# Medido: um guard com `throw` na própria trilha de erro — que portanto ESTOURA
# em toda violação — passava esta bateria inteira, 48/48 verde, porque todo caso
# `reprova` via o 1 e dava por satisfeito. Um guard que crasha ao achar defeito é
# um guard que não guarda nada, e a bateria dizia que estava tudo bem.
#
# Por isso, para esperar `reprova` não basta o código de saída: a saída de erro
# tem de trazer a assinatura do diagnóstico. Crash não a imprime.
# ── Rodada 5, revisor externo ──────────────────────────────────────────────
# TERNARIO DE FACHADA: a derivacao sai do setter para um ajudante do MODULO,
# onde a regra de ordem nao olha, e um ternario qualquer satisfaz a regra do
# literal. Exit 0 antes. Quem fecha e a conferencia de que o unico ternario e o
# que de fato CHEGA em `this._aba`.
TERNARIO_DE_FACHADA="  set aba(v: string) {
    const id = idDaSlug(v);
    const rotulo = IDS_TOPO.includes(id as AbaTopo) ? id : 'resumo';
    void rotulo;
    this._aba = defaultDaLista();
  }
  private _aba: AbaTopo = 'resumo';"

# RENOME COM MENCAO SOBREVIVENTE: a existencia das listas era medida por regex no
# texto cru, entao um comentario que ainda citasse `PAGINAS` bastava. Renomear a
# declaracao para `PAGINAS_TOPO` e derivar dela ficava verde. Media-se a MENCAO
# quando a pergunta era pela DECLARACAO.
RENOME_COM_MENCAO="  set aba(v: string) {
    const id = idDaSlug(v);
    void id;
    this._aba = PAGINAS_TOPO.length ? PAGINAS_TOPO[0].id : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# ── Rodada 5, lente nativa: a regra B tinha escopo de MEMBRO ───────────────
# Bastava mover a derivacao um passo para fora. As tres variantes foram medidas
# no arquivo de PRODUCAO, nao em fixture -- e passavam com o guard verde, a
# bateria verde, o tsc verde e 1048/1048 testes verdes, com a linha de sucesso
# afirmando "2 lista(s) sem leitura por ordem".
AJUDANTE_DE_MODULO_EXTRA="function normalizarAba(id: string): AbaTopo {
  return IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
}"
AJUDANTE_DE_MODULO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = v.length > 0 ? normalizarAba(id) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

AJUDANTE_METODO_DA_CLASSE="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = v.length > 0 ? this._normalizar(id) : 'resumo';
    this._aba = val;
  }
  private _normalizar(id: string): AbaTopo {
    return IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : PAGINAS[0].id;
  }
  private _aba: AbaTopo = 'resumo';"

# Outro MEMBRO escreve o campo: o default sai das duas origens declaradas e o
# guard nem olhava. Passava em todas as versoes anteriores.
OUTRO_MEMBRO_ESCREVE="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = IDS_TOPO.includes(id as AbaTopo) ? (id as AbaTopo) : 'resumo';
  }
  connectedCallback() { this._aba = PAGINAS[0].id; }
  private _aba: AbaTopo = 'resumo';"

# `includes(x, fromIndex)` E sensivel a ordem: muda o conjunto de slugs aceitos
# quando a lista e reordenada, e portanto o destino do fallback. Uma allowlist
# que ignora argumentos nao e allowlist.
INCLUDES_COM_FROMINDEX="  set aba(v: string) {
    const id = idDaSlug(v);
    this._aba = IDS_TOPO.includes(id as AbaTopo, 1) ? (id as AbaTopo) : 'resumo';
  }
  private _aba: AbaTopo = 'resumo';"

# O guard le UM arquivo. Um ajudante IMPORTADO seria cego por construcao --
# entao a expressao do default nao pode chamar o que nao da para ler.
AJUDANTE_IMPORTADO="  set aba(v: string) {
    const id = idDaSlug(v);
    const val = v.length > 0 ? normalizarDeOutroModulo(id) : 'resumo';
    this._aba = val;
  }
  private _aba: AbaTopo = 'resumo';"

verificar() { # <nome> <raiz> <esperado: ok|reprova>
  local nome="$1" raiz="$2" esperado="$3" rc=0 saida=''
  TOTAL=$((TOTAL+1))
  saida="$(node "$GUARD" "$raiz" 2>&1)" || rc=$?
  if [ "$rc" -ge 2 ]; then
    falha "$nome" "o guard saiu $rc (recusa) — a bateria NÃO mediu a regra"
  elif [ "$rc" -eq 0 ]; then
    [ "$esperado" = "ok" ] && ok "$nome" || falha "$nome" "o guard passou, e devia reprovar"
  elif [ "$esperado" != "reprova" ]; then
    falha "$nome" "o guard reprovou código correto (falso positivo)"
  elif ! printf '%s' "$saida" | grep -qF "$ASSINATURA_REPROVA"; then
    falha "$nome" "saiu 1 SEM o diagnóstico do guard — é crash, não reprovação deliberada"
  else
    ok "$nome"
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
# ⚠️ Este caso ESPERAVA `ok` e passou a esperar `reprova`, de propósito, com a
# inversão da rodada 2. Um segundo ternário no setter — ainda que o fallback de
# verdade seja literal — torna o setter ambíguo para leitura automática, e o
# guard reprova em vez de escolher. Foi exatamente por "escolher" que ele foi
# enganado duas vezes. O custo é aceito e a mensagem diz o que fazer.
verificar "14 segundo ternário no setter: ambíguo, reprova"     "$(arvore c14 "$TERNARIO_INOCENTE_COM_LITERAL")" reprova
verificar "15 cadeia de aliases de 2 níveis passa"     "$(arvore c15 "$ALIAS_EM_CADEIA")"           ok
# ⚠️ Este caso ESPERAVA `ok` e virou `reprova` na rodada 3, pelo mesmo argumento
# do 14: `??`/`||` deixaram de ser forma aceita — e desde a rodada 4 o que o
# reprova é a regra A (o setter precisa de exatamente um ternário). O fallback
# de um `??` só está VIVO se
# o lado esquerdo puder ser nullish, e isso é ALCANÇABILIDADE, não forma. Ver o
# caso 37, que é a testemunha que derrubou a regra antiga.
verificar "16 fallback por '??', mesmo com literal, reprova"    "$(arvore c16 "$FALLBACK_COM_NULLISH")"      reprova
verificar "17 fallback por '??' derivado reprova"               "$(arvore c17 "$FALLBACK_COM_NULLISH_DERIVADO")" reprova
verificar "18 duas atribuições a _aba reprovam (hoje: 0 ternários)"        "$(arvore c18 "$DUAS_ATRIBUICOES")"          reprova
verificar "19 valor de fora do setter reprova (hoje: 0 ternários)"            "$(arvore c19 "$VALOR_DE_FORA")"             reprova
verificar "20 sem fallback visível reprova (hoje: 0 ternários)"                     "$(arvore c20 "$SEM_FALLBACK_VISIVEL")"      reprova
# ⚠️ ESPERAVA `ok` e virou `reprova` na rodada 4, e e uma TROCA DECLARADA, nao
# um defeito. A regra A pede um ternario; `if/else` reprova ainda que correto.
# O setter de producao usa ternario, e a regra B cobre o acoplamento por ordem
# independentemente da forma -- entao o custo e "quem migrar para if/else mexe
# no guard na mesma alteracao", contra a alternativa de aceitar mais uma forma e
# reabrir a cauda de alcancabilidade que custou quatro rodadas.
verificar "21 if/else, ainda que correto, reprova (troca declarada)" "$(arvore c21 "$IF_ELSE_LITERAL")"      reprova
verificar "22 if/else com derivação no else reprova"            "$(arvore c22 "$IF_ELSE_DERIVADO")"          reprova
verificar "23 falso positivo: 'satisfies' com literal passa"    "$(arvore c23 "$SATISFIES_LITERAL")"         ok
verificar "24 'satisfies' sobre derivação reprova"              "$(arvore c24 "$SATISFIES_DERIVADO")"        reprova
verificar "25 ternário inocente em ARGUMENTO não cega o guard"  "$(arvore c25 "$TERNARIO_EM_ARGUMENTO")"     reprova
verificar "26 ternário inocente em DECORATOR não cega o guard"  "$(arvore c26 "$TERNARIO_EM_DECORATOR")"     reprova
verificar "28 sombra de nome em BLOCO reprova"                  "$(arvore c28 "$SOMBRA_EM_BLOCO")"           reprova
verificar "29 sombra de nome em ARROW reprova"                  "$(arvore c29 "$SOMBRA_EM_ARROW")"           reprova
verificar "30 ternário derivado sob '??' literal reprova"       "$(arvore c30 "$TERNARIO_SOB_NULLISH")"      reprova
verificar "31 fallback real no THEN do if/else reprova"         "$(arvore c31 "$FALLBACK_NO_THEN")"          reprova
verificar "32 derivação pura sob '??' literal reprova"          "$(arvore c32 "$DERIVADO_SOB_NULLISH")"      reprova
verificar "33 setter que ignora a entrada reprova (hoje: 0 ternários)"              "$(arvore c33 "$SETTER_SO_LITERAL")"         reprova
verificar "34 falso positivo: ternário sob 'satisfies' passa"   "$(arvore c34 "$TERNARIO_SOB_SATISFIES")"    ok
verificar "35 ternário derivado sob 'satisfies' reprova"        "$(arvore c35 "$TERNARIO_SOB_SATISFIES_DERIVADO")" reprova
verificar "36 alias MUTÁVEL reescrito com derivação reprova"    "$(arvore c36 "$ALIAS_MUTAVEL")"             reprova
verificar "37 '??' morto sobre derivação, SEM chamada, reprova" "$(arvore c37 "$NULLISH_MORTO_SEM_CHAMADA")" reprova
verificar "38 falso positivo: '||' de predicado não conta"      "$(arvore c38 "$OR_BOOLEANO_NO_PREDICADO")"  ok
verificar "39 falso positivo: '??' alheio ao default não conta" "$(arvore c39 "$NULLISH_ALHEIO")"            ok
verificar "40 falso positivo: ternário em arrow não conta"      "$(arvore c40 "$TERNARIO_EM_ARROW_ANINHADA")" ok
verificar "41 'let' sem inicializador reprova"                  "$(arvore c41 "$LET_SEM_INICIALIZADOR")"     reprova
verificar "42 ordem: clamp de índice em PAGINAS reprova"        "$(arvore c42 "$ORDEM_CLAMP")"               reprova
verificar "43 ordem: '.find ?? PAGINAS[0]' (idiomático) reprova" "$(arvore c43 "$ORDEM_FIND_NULLISH")"       reprova
verificar "44 ordem: condição constante sobre PAGINAS reprova"  "$(arvore c44 "$ORDEM_CONDICAO_CONSTANTE")"  reprova
verificar "45 ordem: colisão de nome não salva a derivação"     "$(arvore c45 "$ORDEM_COLISAO_DE_NOME")"     reprova
verificar "46 ordem: o caso 37 reescrito com ternário reprova"  "$(arvore c46 "$ORDEM_37_COM_TERNARIO")"     reprova
verificar "47 ordem: leitura por ordem no INICIALIZADOR reprova" "$(arvore c47 "$ORDEM_NO_INICIALIZADOR")"   reprova
verificar "48 '.find' alheio em arrow reprova (conservador)"    "$(arvore c48 "$FIND_ALHEIO_EM_ARROW")"      reprova
verificar "49 ternário de FACHADA com ajudante do módulo reprova" "$(arvore c49 "$TERNARIO_DE_FACHADA")"     reprova
verificar "50 apelido da lista no módulo não escapa da regra B" "$(arvore c50 "$RENOME_COM_MENCAO")"        reprova

# Caso 51 monta ARVORE PROPRIA: ele precisa de um arquivo em que `PAGINAS` NAO
# seja declarada e apareca so num comentario -- o preambulo padrao de `arvore()`
# sempre a declara. E a testemunha exata do revisor externo: a existencia das
# listas era medida por regex no texto cru, entao o comentario satisfazia a
# busca enquanto a declaracao real tinha outro nome.
raiz51="$TMPRAIZ/c51/frontend"
mkdir -p "$raiz51"
cat > "$raiz51/tela-avancado.ts" <<'TS51'
type AbaTopo = 'resumo' | 'obra';
// Historico: esta lista ja se chamou PAGINAS, e IDS_TOPO derivava dela.
const LISTA_DE_PAGINAS: { id: AbaTopo; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'obra', label: 'Custos' },
];
declare function idDaSlug(v: string): string;
export class ViabTelaAvancado {
  set aba(v: string) {
    const id = idDaSlug(v);
    void id;
    this._aba = LISTA_DE_PAGINAS.length ? LISTA_DE_PAGINAS[0].id : 'resumo';
  }
  get aba(): AbaTopo { return this._aba; }
  private _aba: AbaTopo = 'resumo';
}
TS51
verificar "51 renome com menção em COMENTÁRIO reprova"          "$TMPRAIZ/c51"                               reprova
verificar "52 derivação em AJUDANTE DE MÓDULO reprova"          "$(arvore c52 "$AJUDANTE_DE_MODULO" "$AJUDANTE_DE_MODULO_EXTRA")" reprova
verificar "53 derivação em MÉTODO da classe reprova"            "$(arvore c53 "$AJUDANTE_METODO_DA_CLASSE")" reprova
verificar "54 outro MEMBRO escrevendo _aba reprova"             "$(arvore c54 "$OUTRO_MEMBRO_ESCREVE")"      reprova
verificar "55 '.includes' com fromIndex reprova"                "$(arvore c55 "$INCLUDES_COM_FROMINDEX")"    reprova
verificar "56 ajudante IMPORTADO (ilegível) reprova"            "$(arvore c56 "$AJUDANTE_IMPORTADO")"        reprova

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
esperado_inventario='fallback-setter:aba|inicializador:_aba :: IDS_TOPO,PAGINAS :: includes'
real_inventario="$(node -e "
  import('$GUARD').then((m) => {
    const chaves = m.ORIGENS.map((o) => o.tipo + ':' + o.membro).sort();
    process.stdout.write(
      chaves.join('|')
      + ' :: ' + [...m.LISTAS_ORDENADAS].sort().join(',')
      + ' :: ' + [...m.METODOS_SEM_ORDEM].sort().join(','),
    );
  });
" 2>/dev/null)"
TOTAL=$((TOTAL+1))
if [ "$real_inventario" = "$esperado_inventario" ]; then
  ok "27 inventário de ORIGENS: exatamente as 2 origens esperadas"
elif [ -z "$real_inventario" ]; then
  # Distinguir "não mediu" de "mediu e divergiu": vazio quer dizer que o import
  # nem rodou (guard com erro de sintaxe, caminho errado), e atribuir isso a
  # "origem renomeada" mandaria caçar o defeito errado.
  falha "27 inventário de ORIGENS" "o import de \`$GUARD\` não devolveu nada — a bateria NÃO mediu o inventário (guard quebrado ou caminho errado), não é divergência de origem"
else
  falha "27 inventário de ORIGENS" "esperado \`$esperado_inventario\`, veio \`$real_inventario\` — origem acrescentada, removida ou renomeada sem atualizar esta bateria"
fi

if [ "$FALHAS" -gt 0 ]; then
  echo "❌ bateria do guard de default de aba: $FALHAS falha(s)." >&2
  exit 1
fi
echo "✅ bateria do guard de default de aba: $TOTAL casos, nos dois sentidos."
