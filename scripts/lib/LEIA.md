# `scripts/lib/` — bibliotecas, não executáveis

Tudo em `scripts/` é **executável**: são dez guards e validadores que se rodam com `node
scripts/<nome>.mjs` ou `bash scripts/<nome>.sh`. Uma biblioteca solta no meio deles convida
alguém a rodá-la, descobrir que ela não faz nada, e concluir que está quebrada.

**Aqui dentro nada se roda sozinho.** São módulos importados por quem está um nível acima.
Cada um exporta funções puras, sem efeito colateral, sem ler `process.argv` e sem `process.exit`.

| Módulo | Quem importa | O que resolve |
|---|---|---|
| `fonte-ts.mjs` | `guard-tokens-css.mjs` · `guard-props-urbi.mjs` · `guard-box-model-urbi.mjs` | Onde termina um comentário, uma string, um template e um `${…}` — **nas três linguagens que vivem num `.ts` deste app** |
| `fonte-ts.oraculo.mjs` | **só a bateria** | A mesma classificação, feita pelo scanner do compilador TypeScript — o oráculo do teste diferencial |

Os dois `*.test.mjs` daqui não são exceção à regra: quem os roda é o `node --test`, chamado por
`scripts/testar-fonte-ts.sh` (casos escritos à mão, `node` puro) e pela etapa 6/6 de
`scripts/validar-frontend.sh` (o diferencial, que precisa do `typescript` linkado).

⚠️ **Nenhum guard pode importar `fonte-ts.oraculo.mjs`.** Os guards rodam sem `node_modules` — é o
que os deixa rodar no `pr-guards.yml`, que não faz install nenhum.

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

Duas camadas, complementares — e a segunda existe porque **lexer artesanal errado é exatamente o
defeito que os guards existem para consertar**:

| Camada | Prova | Não prova |
|---|---|---|
| `fonte-ts.test.mjs` (21 casos, `node` puro) | **intenção** — cada caso é um defeito que já aconteceu, ou a sua imagem espelhada | o que ninguém lembrou de listar |
| `fonte-ts.diferencial.test.mjs` (67 casos) | **propriedade** — para os 66 arquivos do `frontend/` real e para as 66 concatenações de pares, a classificação bate com a do compilador TypeScript, offset a offset | o eixo `/` (ver abaixo), e a delimitação do CSS dentro de `` css`…` `` |

Medido: apagar o reconhecimento de comentário de linha ou de string faz o diferencial acusar **66
de 66** arquivos; apagar o de comentário de bloco, 30. Já o tratamento de **crase escapada** nenhum
arquivo real exercita — é o caso escrito à mão que o cobre. As duas camadas pegam coisas diferentes.

**O eixo `/` é coberto por validação, não por detecção independente.** Distinguir regex de divisão
exige posição de expressão, que é informação do parser; um scanner não tem, e o do TypeScript
reinterpreta qualquer `/` como regex se você pedir. Então o oráculo recebe de nós as posições de
início de regex — e **recusa** as que não são regex de verdade, o que reprova o diferencial. A dica
não é passe livre: uma regex **inventada** pelo lexer é acusada, e a **extensão** de toda regex é
comparada. O que continua descoberto é a regex *não detectada*, que vira código — e essa costuma
aparecer como divergência logo adiante.

⚠️ **O `frontend/` real é um corpus de sorte.** Ele cobre o que o app por acaso escreveu:
`` `abc` / 2 `` não existe em nenhum arquivo, então o diferencial sobre arquivos reais **não teria
pego** o defeito da crase antes da divisão — medido, não suposto. Por isso o diferencial roda também
sobre um **corpus sintético** de construções válidas que o repo ainda não tem.
