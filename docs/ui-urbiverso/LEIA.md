# Espelho da referência de UI do urbiverso

> **Gerado por `scripts/sincronizar-referencia-ui.mjs`. Não edite à mão** — rode o script.
>
<!-- CARIMBO:INICIO — bloco gerado por scripts/sincronizar-referencia-ui.mjs. Não edite. -->
> | | |
> |---|---|
> | Fonte | `main` do monorepo `urbiverso/urbiverso` |
> | SHA | `22ba477a` |
> | Versão do monorepo | `0.53.11` |
> | Data do commit | 2026-08-22 |
> | Conteúdo | 29 primitivos · 197 props (incluindo herdadas) · 85 tokens |
<!-- CARIMBO:FIM -->

## Por que este diretório existe

A fonte canônica de props de primitivo `urbi-*` e de tokens CSS é o **bundle do SDK**
(`node_modules/@urbiverso/sdk/`). **Neste ambiente ele não existe:** o pacote é GitHub Packages
privado, e tanto o `pnpm install` quanto o `npm view` devolvem 401.

O efeito prático era pior do que "faltar informação". A referência virava leitura ad-hoc — um agente
abria `ui/src/` no monorepo, conferia uma prop, e o conhecimento morria com a sessão. E a skill de
revisão **proíbe** ler o monorepo para compensar a falta do bundle (§ *Superfície de leitura*), com
razão: o monorepo está à frente do publicado, e validar contra ele produz o pior modo de falha, que
é a revisão *passar* citando um contrato que a instância não tem.

Resultado: a lente de UI marcava **NÃO EXECUTADA** em toda revisão, e ninguém cobrava, porque a
marca parecia normal.

Este diretório quebra o impasse. A leitura do monorepo vira **um passo explícito e auditável** — a
execução do script, revisável no PR —, e o resultado é **conteúdo deste repositório**. Quem revisa lê
daqui, o que respeita a letra da proibição sem ficar cego.

## ⚠️ O que ele NÃO resolve

O espelho sai da **`main`**, que está **à frente do SDK publicado**. Ele fecha o eixo do **recorte**
— ter a informação — e **não** o eixo do **tempo** — ela valer para a versão que a instância roda.

Consequências, as duas obrigatórias em qualquer achado que se apoie nele:

- **Cite o carimbo.** Data e SHA acima. Um achado sem carimbo não distingue "a prop não existe" de
  "a prop ainda não foi publicada".
- **A pergunta "isso está publicado?" continua sem resposta automática.** É pergunta ao autor, que é
  quem tem credencial para o registry.

## Os arquivos

### `primitivos.json`

Um registro por primitivo que o **frontend deste app realmente usa** — não os 89 do monorepo.
Espelhar tudo seria ruído, e espelho que ninguém lê não protege ninguém.

| Campo | O que é |
|---|---|
| `classe`, `arquivo`, `base` | de onde veio, e de quem herda |
| `linhagem[]` | a cadeia de heranças, da base mais distante até a classe concreta |
| `props[]` | `propriedade` (nome em TS), `atributo` (o que se escreve no HTML), `tipo`, `reflete`, e `de` — a classe que a declarou |
| `host[]` | as declarações de `:host` de **toda a linhagem**, cada uma com `de` |
| `risco_box_model` | `true` quando o `:host` tem `padding`/`border` **sem** `box-sizing: border-box` |

⚠️ **A herança é percorrida inteira, e isso não é detalhe.** `urbi-grafico-pizza` declara **duas**
props no próprio arquivo e usa **doze** — as outras dez vêm de `UrbiGraficoBase`, e o app usa várias
delas (`formato`, `categorias`, `series`). Um espelho que só olhasse a classe concreta faria um guard
reprovar prop legítima.

⚠️ **`atributo` não é o nome da propriedade.** Vários primitivos declaram `attribute:` e renomeiam —
`caixaAlta` vira `caixa-alta`. Escrever `caixaAlta=` no HTML **não dá erro**: o atributo
simplesmente não faz nada. É a falha silenciosa que o contrato do `CLAUDE.md` descreve.

### `risco_box_model` — para que serve, com o caso que o originou

`box-sizing` **não é herdado**. Se o `:host` de um primitivo declara `padding` ou `border` e não
declara `box-sizing: border-box`, então um `width` aplicado **de fora** — pela folha do app — é
largura de **conteúdo**, e a caixa renderizada mede `width + padding + border`. Ela transborda o
container, e pinta sobre o vizinho.

O campo julga pelo **valor efetivo**, não pela presença da propriedade — as duas simplificações
óbvias produzem **falso negativo**, que é o pior erro possível aqui:

| Caso | Veredito |
|---|---|
| `padding: 0 16px` | **soma** — há 16px horizontais, mesmo começando em `0` |
| `padding: 0` · `padding: 0 0 0 0` | não soma |
| `border: none` · `border: 0 solid X` | não soma |
| `border: 1px solid X` | **soma** |
| `border-radius` | não soma — não é espessura |
| `box-sizing: content-box` · `inherit` | **não protege** — só `border-box` protege |

Hoje, com este carimbo, o único primitivo nessa condição é **`urbi-kpi`**.

Não é hipótese: é o mecanismo de um defeito reportado quatro vezes (#176, #262, #326, #352), fechado
quatro vezes, e vivo. O espelho o acusa **mecanicamente**, no lugar de depender de alguém reler o
shadow DOM à mão.

### `tokens.json`

Todo custom property de `compartilhado/tokens.css`, com **todos os valores** que ele assume — um por
tema. Um token com quatro valores é um token redefinido nos quatro temas; um com um valor só vale em
todos.

Serve a uma pergunta que o app não conseguia responder: **este token existe?** Usar
`var(--nao-existe, #fallback)` **não dá erro** — o fallback vira a cor efetiva, para sempre, e some
quando o tema muda. Foi assim que `--cor-superficie-2` sobreviveu no `tela-dashboard.ts`.

## Quando ressincronizar

Quando o monorepo avançar e o app precisar de algo novo. O script é **determinístico para um mesmo
SHA** — a data vem do commit, não do relógio —, então rodá-lo duas vezes sem o monorepo mudar produz
**diff vazio**. Ressincronizar sem motivo não suja PR.

```
node scripts/sincronizar-referencia-ui.mjs
node scripts/sincronizar-referencia-ui.mjs --monorepo /outro/caminho
```

O script **só lê** o monorepo. Escrever nele é proibido — ver `CLAUDE.md` § *O monorepo
`urbiverso/urbiverso` é só leitura*.
