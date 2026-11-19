# Etapa TRIAGEM — diária e leve

Não mexe em código do app. Gasta pouco: leia só o que mudou desde o painel anterior.

## 1. Ler as respostas do dono

Antes de reescrever o painel, leia nele:

- **Caixas marcadas** em "Esperando o seu sim": o item está aprovado e passa a `pronta`. A caixa
  marcada basta; não aplique o rótulo `aprovada`, que é só do dono.
- **Comentários e recusas:** item recusado ganha `recusada` e sai da fila. O motivo vira
  aprendizado (§ 5).
- **PRs do Estado da Arte** mergeados ou fechados: atualize a situação das propostas.

## 2. Recolher as entradas novas

1. **Antes de tudo, a seção "Adiado para a próxima triagem" do painel anterior**: as entradas que
   passaram do limite ontem entram antes das novas.
2. Issues abertas ou comentadas desde o último painel.
3. O `ideias.md`, **por seção** (é a estrutura do `documentacao.md` do SDK):
   - `## Aprovadas`: cada linha vira issue do dono, já aprovada, citando a linha. Antes de criar,
     procure issue que já cite a linha, para não duplicar.
   - `## Braindump`: ideia crua, **não aprovada**. Não vira item sozinha: entra em "Esperando o seu
     sim" com a pergunta "aprova?", dentro de `max_esperando_dono`. Caixa marcada vira issue do dono.
     Linha já listada em "Esperando o seu sim" ou em "Adiado" não se repete.
   - `## Descartadas`: **nunca** vira item. É a lista do que não propor de novo (SKILL.md § 4).
   Linha que virou issue **sai** do `ideias.md` ("a linha sai quando vira issue"): junte as saídas
   do dia num PR de manutenção que só remove essas linhas e cita as issues. Nunca apague linha de
   `Descartadas`.
4. Com credencial: casos do Sentinela desta app sem Ordem de Serviço, pelas rotas de leitura que o
   `ajuda.md` do SDK documenta. Bug relatado ali segue o caminho que o processo do repositório
   define para bug.
5. Os comentários `Observação:` deixados na issue-painel desde o último painel, por qualquer sessão
   (rule do repositório, item 3, e EXECUCAO § 4). É daqui que nascem os itens da IA.
6. **Só às segundas-feiras:** SDK do lockfile contra o publicado (e o kit, onde houver), avisos de
   obsolescência do empacotador com as datas do `obsolescencias.json` do SDK publicado.

## 3. Classificar cada entrada (Triador)

- **Origem:** dono, IA ou terceiros (SKILL.md § 4).
- **Tipo:** bug, manutenção, rumo ao Estado da Arte (cite o item), ou fora dele.
- **Tamanho:** 1, 2 ou grande (SKILL.md § 6). Grande ganha `plano-grande`.
- **Situação:** `pronta` quando a origem e a autonomia do prompt permitem; senão, vai para
  "Esperando o seu sim".

Respeite os limites da configuração: no máximo `max_ideias_ia_dia` itens novos da IA por dia e
`max_esperando_dono` itens esperando. Passou do limite, a entrada vai para a seção "Adiado para a
próxima triagem" do painel, com o link dela — é a fila que a triagem seguinte lê primeiro (§ 2).
Nada sai do painel sem ter virado item ou sido recusado.

## 4. Propor mudanças no Estado da Arte (Guardião)

Quando uma entrada do dono muda o destino, ou quando uma ideia da IA não cabe em nenhum item:

- redija a mudança num PR pequeno, **um item por PR**, em `.claude/estado-da-arte/estado-da-arte.md`;
- no corpo, cite a entrada que a originou e o que muda na prática;
- no máximo 2 PRs de proposta abertos. Só o dono faz o merge.

Uma vez por semana, compare o app com o documento e atualize, **no painel**, a situação de cada
item (falta, parcial, feito). A situação escrita no documento só muda por PR.

## 5. Aprender com o dono (Relator)

Cada correção, recusa, edição de proposta ou PR que ele precisou consertar vira uma regra curta:
o que ele pediu, o que foi entendido, o que ele queria. Registre como comentário na issue-painel.
Com 5 regras novas, abra um PR acrescentando-as a `.claude/estado-da-arte/aprendizados.md`.

Correção em código que pode virar checagem automática entra na fila como manutenção.
Motivo de recusa repetido duas vezes vira proposta de ajuste nesta skill, por PR, para o dono.

## 6. Escrever o painel (Relator)

Substitua o corpo da issue-painel pelo formato de `modelos/painel.md`, com a fila na ordem da
EXECUCAO. Verifique o limiar de release (`etapas/execucao.md` § 6) e preencha o bloco de release.
