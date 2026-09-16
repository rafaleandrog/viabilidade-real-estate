<!-- CORPUS-REVISAO: marcador carimbado por scripts/carimbar-corpus-revisao.mjs. NÃO edite à mão. -->
<!-- corpus=v14-2f5f3172 -->

# Aprendizados — o que toda lente deste repositório precisa saber antes de olhar o diff

Este arquivo **viaja para dentro de cada lente**: o briefing manda lê-lo por completo antes de
abrir o diff. Ele não é história do repositório — é o que a lente deve **procurar** e o que ela
deve **evitar afirmar**. Lição de processo para humano fica no `CLAUDE.md`, que é onde serve.

Quem edita este arquivo re-carimba o marcador: `node scripts/carimbar-corpus-revisao.mjs`.

---

## 1. Onde você é cega — e o que fazer com isso

Suas ferramentas são `Read`, `Grep` e `Glob`, com o diretório de trabalho na **árvore do
repositório** mais o diretório do diff que o briefing indicar. **Fora disso você não enxerga
nada**: `/opt`, `/usr`, `$HOME`, o resto do disco, a rede, o histórico do git, o PR no GitHub.

**Ilegibilidade não é ausência.** O que você não consegue ler se declara **NÃO VERIFICÁVEL**, nunca
"não existe". Já custou dois achados falsos neste repositório (ver `retirados.md`), e a forma do
erro é sempre a mesma: a frase sai com cara de fato medido, e quem lê não tem como distinguir.

Vale igual para o que está **fora do diff**: você não sabe o que o PR fez em rodadas anteriores,
nem o que o autor respondeu num comentário. Se a conclusão depende disso, diga que depende.

## 2. Não afirme número que você não contou

Este repositório já publicou "978 testes" quando eram 976, e "979" quando eram 977 — as duas vezes
a conta mental estava certa e a **premissa** errada. Se você citar uma contagem, ela tem de sair de
algo que você **leu**, e diga de onde. Não havendo como contar, o número não entra no achado.

## 3. A classe de defeito nº 1 deste repositório: o defeito mora na FIAÇÃO

A função pura existe, está testada, e o componente **nunca a chama** — ou chama com o argumento
errado. Sete PRs de uma mesma rodada tiveram o bloqueante aí, **nenhum no cálculo**. Teste de
função pura não prova ligação, e a suíte inteira não fica vermelha por causa dela.

**O que procurar:** função/módulo novo ou alterado cujo único consumidor no diff é um teste. Prop
passada ao componente e nunca lida. Parâmetro com valor default que torna a omissão invisível
(`= true`), quando o chamador real deveria ser obrigado a passá-lo.

## 4. Falhas que este repositório sofre em SILÊNCIO

Nenhuma delas fica vermelha em typecheck, teste ou build. São as que valem um achado mesmo quando o
diff "parece" certo:

- **Aspa curva em posição de atributo.** `variante=”alerta”` (U+201D) deixa o atributo **inerte**:
  o parser inclui as aspas no valor, não casa com nada, e o primitivo cai no default. Aspa curva em
  **conteúdo de texto** é tipografia legítima e **não** é achado — o padrão é `=` seguido de aspa curva.
- **Atributo que o primitivo `urbi-*` não declara.** Não dá erro: simplesmente não faz nada. A
  autoridade é o bundle do SDK instalado (`node_modules/@urbiverso/sdk/dist/index.d.ts`), na versão
  que o `package.json` fixa — nunca o monorepo, nunca a memória.
- **`var(--token)` que não existe.** O fallback vira cor literal disfarçada de token.
- **Comentário `//` em `schema.json` ou `manifesto.json`.** JSON não tem comentário; o pacote é
  reprovado na instalação, antes de olhar qualquer tabela.
- **Glob de teste que não alcança subdiretório.** `frontend/*.test.ts` sozinho não pega
  `frontend/fixtures/*.test.ts`. Teste que não roda é pior que teste que não existe.
- **Endereço `arquivo:linha` em prosa que deixou de resolver.** O próprio diff desloca as linhas.
- **`||` que engole o zero.** `Number(x) || 10` trata `0` como ausente; `??` não. Antes de acusar,
  confira **qual** operador está lá e se o `0` é valor legítimo naquele campo.

## 5. "Mesma convenção que X" é afirmação a conferir, não a aceitar

Um comentário dizendo *"mesma convenção que `margemPct`"* já foi falso neste repositório, e duas
atestações passaram por cima porque a frase é plausível: a guarda testava `vgv`, mas o denominador
do outro indicador era `investimentoTotal`, ortogonal.

**Confira que o PREDICADO é o mesmo, não que a forma do código é.** Dois `?? 0` idênticos podem ter
garantias opostas. Frase falsa é **pior** que ausência de comentário, porque sem comentário alguém
investiga.

Vale para toda afirmação do diff e do corpo do PR: *"os únicos escritores"*, *"a fresta fecha
sozinha"*, *"o engine não é transacional"* — as três já eram falsas aqui.

## 6. Enumerar entrada suja não converge — a saída é inverter

Quando o diff acrescenta a **segunda** guarda contra a mesma classe de entrada inválida, o achado
não é "falta a terceira": é que o desenho devia **inverter para fail-closed**, com um parser único
usado por todos os ramos. Um caso deste repositório precisou de seis guardas antes de inverter, e a
inversão fechou as cinco portas conhecidas **e expôs a sexta**.

**Corolário, e é o achado mais caro:** conte quantos validadores existem para o **mesmo campo**. Um
caso tinha três — tela, PATCH e migração — com regras diferentes, e a única fronteira real aceitava
o que as outras rejeitavam.

## 7. Guarda que falha ABERTA

Guarda existe para barrar; a pergunta é o que ela faz quando a condição é parcial. Já aconteceu
aqui: `if ls -d "$a" "$b"` com **só um** dos dois existindo imprime o que achou e sai com `rc=2`,
então o `if` **não entra no corpo** — a trava falha aberta exatamente no caso para o qual existe.

**O que procurar:** condição composta cujo estado intermediário ninguém testou; `[ -e ]` vs `-d`;
comando cujo código de saída não significa o que a condição presume.

## 8. Migração de app migra DADO, nunca schema

DDL em migração de app é **bloqueante**: numa instância nova o sincronizador cria o schema a partir
do `schema.json` e **pula** todas as migrações, então a instância nova nasce estruturalmente
diferente da atualizada. Mesma coisa, pela porta declarativa: `indices` e `unicos` declarados numa
tabela que **já existe** nunca nascem — só saem no `CREATE TABLE`.

## 9. A `versao` do manifesto: a regra daqui é o INVERSO do upstream

`z` bumpa **se e só se** há migração nova. Subir `shell_min`/`sdk_min` **não** bumpa; mudança só de
frontend/backend **não** bumpa. **Acusar "faltou bumpar a versão" num PR que só sobe o piso é
achado inventado**, e era recorrente.

## 10. O que NÃO é achado aqui

- Cor literal no CSS de impressão/PDF de `frontend/exportar.ts`: roda em janela própria, onde
  `var(--cor-*)` não resolve. É exceção declarada.
- Aviso de "N literais de cor fora de token" do empacotador: a heurística conta o **fallback** de
  `var(--token, #hex)`, que é o uso correto.
- Estilo, preferência, nomenclatura, e qualquer código que o diff **não toca**.
- O que já está em `retirados.md`. Leia-o antes de escrever o achado.
