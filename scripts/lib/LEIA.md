# `scripts/lib/` — bibliotecas, não executáveis

Tudo em `scripts/` é **executável**: são dez guards e validadores que se rodam com `node
scripts/<nome>.mjs` ou `bash scripts/<nome>.sh`. Uma biblioteca solta no meio deles convida
alguém a rodá-la, descobrir que ela não faz nada, e concluir que está quebrada.

**Aqui dentro nada se roda sozinho.** São módulos importados por quem está um nível acima.
Cada um exporta funções puras, sem efeito colateral, sem ler `process.argv` e sem `process.exit`.

| Módulo | Quem importa | O que resolve |
|---|---|---|
| `fonte-ts.mjs` | `guard-tokens-css.mjs` · `guard-props-urbi.mjs` · `guard-box-model-urbi.mjs` | Onde termina um comentário, uma string, um template e um `${…}` — **nas três linguagens que vivem num `.ts` deste app** |

O `fonte-ts.test.mjs` daqui não é exceção à regra: quem o roda é o `node --test`, chamado por
`scripts/testar-fonte-ts.sh`.

⚠️ **`fonte-ts.mjs` importa o pacote `typescript`** — ver abaixo. Faltando o pacote, ele não tem
plano B silencioso: os guards **recusam** analisar.

## Por que `fonte-ts.mjs` existe

Antes dele, os três guards de UI faziam **dez varreduras de código bruto**, e as dez faziam a
mesma pergunta — *este trecho é código, comentário, string, regex, texto de template ou expressão
de template?* — sem saber respondê-la. O resultado eram seis defeitos confirmados e mais quatro
achados na varredura seguinte, todos da mesma classe:

- `${() => { /* { */ }}` — a chave **comentada** contava como aninhamento, e o varredor engolia o
  resto do arquivo. O guard de props reportava `0 atributos conferidos` e saía **verde**;
- `// exemplo: css`.a urbi-kpi { width: 100% }`` — um comentário **documentando** o defeito abria
  uma região CSS falsa e era acusado por isso.

Consertar as instâncias uma a uma significaria escrever este lexer **sete vezes**. Ele existe para
que exista **um** lugar onde essa pergunta é respondida — e **um** lugar para estar errado.

## Por que o lexer de JS/TS foi embora

Três rodadas de revisão, três classes novas, sempre depois de uma previsão de fechamento razoável:

| Rodada | Achados | Classe |
|---:|---:|---|
| 1 | 6 | parsers cegos a comentário e string |
| 2 | 3 | as sub-linguagens CSS e HTML |
| 3 | 6 | continuidade de estado, operador pós-fixo (`i++ / 2`), grafia (`<STYLE>`) |

O eixo nunca foi *quais construções faltam*. Era **lexer de JS/TS escrito à mão**, cuja cauda é a
especificação inteira da linguagem — não se fecha enumerando. Então ele saiu:

**1 · JS/TS é o parser do próprio TypeScript** (`createSourceFile`). Não o *scanner*: scanner não
decide `/` de regex contra `/` de divisão, porque isso é posição de expressão, informação do parser —
e foi exatamente o que fez o oráculo da rodada 2 errar 33 arquivos. Medido na troca: os spans de
template saem **idênticos** aos do lexer artesanal nos 66 arquivos reais, e o parser reporta **zero**
erros de sintaxe neles.

**2 · CSS e HTML seguem à mão, com o modo de falha INVERTIDO.** O lexer não precisa estar certo:
precisa **nunca dizer "limpo" quando está confuso**. Construção que ele não consegue fechar —
`/*` sem `*/`, `<!--` sem `-->`, `url(` sem `)`, `{` sem `}`, `<style>` sem `</style>` — vira
**problema**, e o guard reprova o arquivo com *"não consegui analisar, confira à mão"*.

Isso termina a cauda por construção. Cada achado futuro dessa família vira, no pior caso, um falso
positivo barulhento — que alguém conserta — em vez de um guard mudo, que é o pior desfecho possível.

### O modo invertido só vale se for uniforme — a auditoria dos pontos que podem engolir

Uma promessa dessas falha no único lugar onde ninguém olhou. `limparCss` era esse lugar: diante de
`style="width:100%; /*"` ele **achava** o problema e devolvia o fragmento todo em branco, o guard
via zero declarações e saía verde — enquanto o navegador ainda aplica o `width` anterior ao
comentário. A promessa central contradita por dentro.

Por isso a lista abaixo existe, e por isso cada linha tem caso na bateria:

| Ponto | Podia engolir? | Como propaga hoje |
|---|---|---|
| `limparCss` | **sim, e engolia** | devolve `{ texto, problemas }`; os dois guards recusam o arquivo |
| `buracosCss` | não | retorna cedo com `problemas` — `/*` sem `*/`, string aberta, `url(` sem `)` |
| `buracosHtml` | não | idem — `<!--` sem `-->`, CDATA, `<script>`/`<style>` sem fechar, tag sem `>` |
| `fimDaTag`, `fimDaStringCss` | não | devolvem `-1`, e quem chama transforma em problema |
| `regrasDe` (guard de box model) | não | `{` sem `}` vira problema em vez de encerrar o laço calado |
| `analisar` | não | `parseDiagnostics` do TypeScript vira problema |
| `lerTags` | não mais | tag ou aspas sem fechar são pegas por `buracosHtml` **antes** dele rodar |
| `declaracoesDe` | não se aplica | trecho sem `:` não é declaração — é ausência, não confusão |
| `recortar`, `mascarar`, `embranquecer` | não se aplica | puros, sem noção de problema |

**Regra para quem mexer aqui:** helper que decide alguma coisa devolve o que decidiu **e** o que não
conseguiu decidir. Devolver só o resultado limpo é como o defeito volta.

### Caixa: o que é case-insensitive por especificação, e onde o código respeita isso

A cadeia de caixa já produziu **cinco** ocorrências em duas rodadas (`lerTags`, `seletorAlcanca`,
`a.nome === 'style'`, o nome de tag no fechamento, e `var(`). Em vez de caçar a sexta, a lista
completa dos pontos que comparam nome — com o veredito da especificação em cada um:

| O que se compara | A spec diz | Onde | Respeita? |
|---|---|---|---|
| Nome de elemento (`<URBI-KPI>`) | insensível | `lerTags` (`gi`, normaliza p/ minúsculas) | ✅ |
| Nome de elemento no fechamento (`</STYLE >`) | insensível | nome normalizado + regex de fechamento (`i`) | ✅ |
| Nome de atributo (`STYLE=`) | insensível | `ehStyleHtml`, `atributos` do espelho (`toLowerCase`) | ✅ |
| Seletor de **tipo** em CSS (`.a URBI-KPI`) | insensível em documento HTML | `seletorAlcanca` compara o tipo em minúsculas | ✅ |
| Nome de **função** CSS (`URL(`, `VAR(`) | insensível | `buracosCss` (`i`), `var\(` (`gi`) | ✅ |
| Nome de **propriedade** CSS (`WIDTH:`) | insensível | `declaracoesDe` (`toLowerCase`) | ✅ |
| Valor-palavra-chave CSS (`BORDER-BOX`, `AUTO`) | insensível | `normalizar` (`toLowerCase`) | ✅ |
| `!IMPORTANT` | insensível | `normalizar` (`i`) | ✅ |
| At-rule (`@MEDIA`) | insensível | detectada por estrutura, não por nome | ✅ |
| Unidade (`100PX`) | insensível | `imponeTamanho`, sobre valor já normalizado | ✅ |
| `?attr=` (binding booleano) | **insensível** — escreve um atributo HTML | `guard-props-urbi` (`toLowerCase` quando o prefixo é `?`) | ✅ |
| **Nome de custom property** (`--Cor`) | **SENSÍVEL** | captura exata, sem `toLowerCase` | ✅ correto assim |
| **`.prop=`** | **SENSÍVEL** — é nome de propriedade JS | comparado com a caixa original | ✅ correto assim |
| **Tag de template** (`` css` ``, `` html` ``) | **SENSÍVEL** — é identificador JS | `ehCss`, `ehMarcacao` | ✅ correto assim |
| `@evento=` | sensível (tipo de evento no DOM) | **não é comparado** — o espelho não traz eventos | — |

**Regra para quem mexer aqui:** antes de comparar um nome, pergunte de qual linguagem ele é. HTML e
CSS são ASCII case-insensitive em quase tudo; JavaScript não é em nada. Errar para "insensível" onde
a spec é sensível junta coisas distintas; errar para "sensível" onde ela é insensível deixa passar a
forma maiúscula — que foi o que aconteceu cinco vezes.

⚠️ **A linha do `?attr=` já esteve errada nesta tabela**, agrupada com `.prop=` como sensível. O
binding booleano do Lit **escreve um atributo HTML**, cujo nome é insensível — e o código sempre fez
`toLowerCase` nele. Não era o código que estava errado: era o artefato que documenta o código, o que
é pior, porque daria respaldo escrito a uma regressão. Tabela que descreve implementação tem de ser
conferida contra a implementação, não contra a lembrança de quem a escreveu.

### Posição externa: quem pode dizer que ali começa uma tag

Um `<span>` dentro de `title='…'` é **texto** para o navegador. Qualquer regex global sobre a
marcação o encontra assim mesmo — e foi assim que uma declaração inexistente entrou na lista de
tokens do app e liberou um `var()` real.

Hoje há **uma** autoridade sobre isso, `varrerHtml`, e ela devolve as posições em que uma tag
realmente começa e o conteúdo de cada `<style>`:

| Quem precisa achar tag ou `<style>` | Como faz |
|---|---|
| `varrerHtml` | é a autoridade: atravessa tag, valor citado, comentário e texto cru |
| `lerTags` | recebe `posicoesDeTag` e **exige** o parâmetro — sem default "aceita tudo" |
| superfície de CSS (`<style>`) | vem de `varrerHtml.estilos`, não mais de um regex global |
| guards | nunca varrem marcação por conta própria; só chamam `lerTags` |

**Regra para quem mexer aqui:** nenhum `matchAll(/<.../)` novo sobre marcação. Se precisar achar
algo em posição de tag, peça a `varrerHtml` — ou o `<style>` dentro de um `title=` volta a contar.


⚠️ **As varreduras de CSS e HTML rodam sobre a superfície já mascarada, não sobre cada pedaço de
texto do template.** É o que faz o estado atravessar a interpolação: `<!-- ${x} -->` e
`.b { padding: ${x}; }` são uma construção só, com brancos no meio.

⚠️ **Construção iniciada por `<` só é interpretada fora de tag.** A varredura de HTML atravessa cada
tag inteira, com os valores citados, antes de procurar `<!--` — senão `<div data-nota="<!--">` abre
um comentário que mascara o componente seguinte.

⚠️ **Só `html` e `svg` são marcação.** Template sem tag é string comum tanto quanto documento: tratá-lo
como HTML fazia `const doc = \`<style>:root{--x:red}</style>\`` — prosa — registrar `--x` como token
conhecido do app e liberar um `var(--x)` real. É a ponta oposta do eixo que já restringiu a
*declaração* à superfície CSS de verdade: ali a fonte era larga, aqui a superfície é que nascia larga.

⚠️ **O que não é modelado RECUSA o arquivo.** O modo de falha invertido começou valendo para o
**malformado** (`/*` sem `*/`, tag sem `>`); desde a 6ª rodada vale também para o **não modelado**.
A alternativa era implementar o tokenizer do HTML — uma dúzia de estados de conteúdo mais as regras
de conteúdo estrangeiro —, e cada rodada de revisão revelava o estado seguinte. Recusar fecha o eixo
por construção: deixa de ser preciso acertar a spec e passa a ser preciso **saber o que não se sabe**.

| Modelado | Recusado |
|---|---|
| `<!-- -->` · `<script>` · `<style>` · `<title>` · `<textarea>` · tag comum com valores citados | qualquer `<!…` que não seja comentário (inclui `<!DOCTYPE` e `<![CDATA[`) · `<?…` · `<iframe>` `<xmp>` `<noembed>` `<noframes>` `<noscript>` `<plaintext>` · **`<style/>` e afins** (a barra é ignorada em HTML e fecha em conteúdo estrangeiro) · **`:is()` e `:where()`** no seletor (podem carregar o tipo do sujeito) |

⚠️ **O despacho é por NOME, não por classe de caractere.** A primeira versão reconhecia texto cru com
`/^<(script|…)[\s>]/` — uma classe de delimitadores escrita à mão, que **omitia a barra**. `<style/>`
então não casava como texto cru, não casava como não-modelado, e escorria para o caminho de tag
comum: **nem reconhecido, nem recusado**. Esse é o vão que o desenho precisa não ter, e uma classe de
caractere escrita à mão sempre pode tê-lo. Hoje o nome é lido uma vez e classificado por pertinência
a um conjunto — não há terceiro caminho por onde escapar, e um nome novo entra no conjunto.

**Os caminhos possíveis a partir de um `<`, e são todos:**

| Condição | Destino |
|---|---|
| `<!--` | comentário — **modelado** |
| `<!…` ou `<?…` | **recusa** |
| não há nome de tag depois do `<` | é **texto**, e em HTML é mesmo (`i++`) |
| nome em `NAO_MODELADOS` | **recusa** |
| nome em `CRU`, abrindo | texto cru — **modelado**; `/>` ou sem fechamento → **recusa** |
| qualquer outro nome | tag comum — **modelada**; sem `>` → **recusa** |

Não há `else` silencioso: o único caminho que segue sem modelar nem recusar é o do `<` que não
inicia tag, e esse é o comportamento do próprio HTML. A janela de 64 caracteres em que o nome é
procurado só pode **encurtar** um nome absurdo, e nome encurtado não pertence a nenhum dos conjuntos
— cai em tag comum, que atravessa pelo texto inteiro.

`<![CDATA[` saiu do lado modelado de propósito: ele só vale em conteúdo estrangeiro, e dentro de
`html` o tokenizer o trata como comentário inválido até o primeiro `>`. Modelar só um dos dois casos
era pior que não modelar nenhum. `<svg>` inline **continua** modelado como tag comum — o que muda em
conteúdo estrangeiro é justamente o CDATA, que agora recusa.

**Custo medido no `frontend/` real: zero arquivos recusados.** As únicas ocorrências das construções
acima são 5 `<svg>` inline, que seguem modelados.

⚠️ **HTML é ASCII case-insensitive em nome de tag E de atributo.** `<URBI-KPI STYLE="…">` é o mesmo
elemento com o mesmo atributo. Vale também para seletor de tipo em CSS (`.a URBI-KPI`) e para `?attr=`,
que **escreve um atributo HTML**. Não vale para `.prop=` (nome de propriedade JS) nem para `@evento=`
(tipo de evento no DOM): o Lit lê as strings cruas do template e preserva a caixa desses dois.
A tabela acima é a fonte; este parágrafo é resumo dela.

## As três sub-linguagens, e por que a lista fecha

Um arquivo `.ts` deste app tem **três linguagens aninhadas**, e cada uma esconde delimitador do seu
jeito. Lexar só a de fora deixa as outras duas cegas — foi a segunda rodada de achados:

| Linguagem | Onde vive | O que esconde delimitador |
|---|---|---|
| JS/TS | o arquivo | `//` · `/* */` · string · template · regex |
| **CSS** | `` css`…` `` · `<style>` · `style="…"` | `/* */` · string · `url()` — **não tem `//`** |
| **HTML** | `` html`…` `` · `` svg`…` `` | `<!-- -->` · CDATA · `<script>` — **não tem `/* */`** |

**A lista é fechada, e fecha por construção.** Os guards consomem exatamente **duas** superfícies —
marcação e CSS — e o conjunto de construções que escondem delimitador em cada uma vem da
*especificação* dela, não do que o repositório hoje usa. Só apareceria sub-linguagem nova se
aparecesse **guard** novo consumindo superfície nova; nenhum arquivo consegue introduzir uma.

Por isso a entrada única é `superficies(txt)`: ela limpa cada superfície com as regras da linguagem
**daquela** superfície, numa ordem que não é negociável — comentários de HTML primeiro, para que um
`<!-- <style>…</style> -->` não vire região de CSS.

## Como ele é validado

`scripts/testar-fonte-ts.sh` — casos escritos à mão, cobrindo **CSS, HTML e o modo de falha
invertido**. Não há mais nada cobrindo JS/TS, e é de propósito: quem lexa JS/TS agora é o
compilador, e não se testa o compilador.

**O que existia e foi apagado, para a próxima sessão não reportar como faltando:**
`fonte-ts.oraculo.mjs` e `fonte-ts.diferencial.test.mjs` comparavam o lexer artesanal com o scanner
do TypeScript. Com o parser do TypeScript virando a *implementação*, o diferencial passaria a
comparar TypeScript com TypeScript — teste circular, verde por construção. Sumiram junto com o
lexer que existiam para vigiar.

A bateria dos guards (`scripts/testar-guards-ui.sh`) é que prova que cada guard está de fato
pendurado neste módulo, inclusive **um caso por construção que deve REPROVAR**.
