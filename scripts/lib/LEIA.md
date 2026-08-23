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

⚠️ **As varreduras de CSS e HTML rodam sobre a superfície já mascarada, não sobre cada pedaço de
texto do template.** É o que faz o estado atravessar a interpolação: `<!-- ${x} -->` e
`.b { padding: ${x}; }` são uma construção só, com brancos no meio.

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
