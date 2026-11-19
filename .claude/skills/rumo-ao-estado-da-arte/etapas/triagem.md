# Etapa TRIAGEM — diária e leve

Não mexe em código do app. Gasta pouco: leia só o que mudou desde o painel anterior.

## 1. Ler as respostas do dono

Antes de reescrever o painel, leia nele:

- **Caixas marcadas** em "Esperando o seu sim": o item está aprovado e passa a `pronta` — vale
  também para item de terceiros. A caixa marcada basta; não aplique o rótulo `aprovada`, que é só
  do dono. **Exceção: item que já tem PR pronto e parado.** A caixa não o devolve à fila (não há o
  que implementar de novo) nem autoriza a rotina a mergear: ele passa para "Aprovados, aguardando o
  seu merge", com o link do PR, e o merge é do dono.
- **Comentários e recusas:** item recusado ganha `recusada` e sai da fila; se já tinha PR aberto
  da rotina, feche o PR citando a recusa. O motivo vira aprendizado (§ 5).
- **PRs do Estado da Arte** mergeados ou fechados: atualize a situação das propostas.

## 2. Recolher as entradas novas

1. **Antes de tudo, o painel anterior inteiro.** Tudo o que ele listava e não se resolveu continua
   no painel novo: a "Fila pronta" que a EXECUCAO não alcançou, os itens de "Esperando o seu sim"
   com a caixa ainda desmarcada, os "Aprovados, aguardando o seu merge" cujo PR segue aberto (PR
   fechado sem merge: o PR e a branch dele saem de cena, e o item volta a "Esperando o seu sim"
   como item **sem PR**, perguntando o que fazer; caixa marcada o põe `pronta`, e a EXECUCAO abre
   PR novo, partindo dos comentários do fechado), os "Planos grandes" e as propostas abertas. As entradas de
   "Adiado para a próxima triagem" entram antes das novas. Reescrever o painel (§ 6) nunca tira
   item da fila: só sai o que virou PR mergeado, foi recusado ou fechado. "Feito sem perguntar"
   é a exceção ao contrário: o que entrou ali fica, com o jeito de desfazer, até a release
   seguinte; quando o bloco de release (§ 6) registra uma tag nova, a seção é esvaziada.
2. Issues abertas ou comentadas desde o último painel, **exceto a própria issue-painel**. Os
   comentários dela só entram pelos passos que os leem: as respostas do dono (§ 1), as
   `Observação:` (item 5) e os aprendizados (§ 5). O registro de trabalho concluído é só leitura.
3. O `ideias.md`, **por seção** (é a estrutura do `documentacao.md` do SDK, § Ideias da app):
   - **Antes de cada linha de `Aprovadas` ou `Braindump`:** procure issue que já cite a linha.
     Achou, a linha já é trabalho: não vira item de novo, não volta a "Esperando" e entra no PR de
     saída abaixo. Linha já listada em "Esperando o seu sim" (sem issue) não se repete: continua no
     arquivo, esperando a caixa do dono. Linha em "Adiado" volta pelo item 1, antes das novas, e
     também não é listada duas vezes.
   - `## Aprovadas`: cada linha vira issue do dono, já aprovada, com o rótulo `spec` e citando a
     linha.
   - `## Braindump`: ideia crua, **não aprovada**. Não vira item sozinha: entra em "Esperando o seu
     sim" com a pergunta "aprova?", dentro de `max_esperando_dono`. Caixa marcada vira issue do dono
     com `spec`; recusa do dono move a linha para `Descartadas`, com o motivo no fim.
   - `## Descartadas`: **nunca** vira item. É a lista do que não propor de novo (SKILL.md § 4), e
     linha dela nunca é apagada.
   **A linha sai do `ideias.md` no mesmo passo em que vira issue** (`documentacao.md`: "Ideia
   aprovada vira issue com o label `spec`, e a linha sai do `ideias.md` no mesmo passo"). Como todo
   arquivo do repositório muda por PR, o passo é: criada a issue, abra **na mesma sessão** o PR que
   remove a linha (e move as recusadas para `Descartadas`), citando as issues. Já existe PR aberto
   desta rotina mexendo no `ideias.md`? Acrescente a ele, na mesma branch, em vez de abrir outro; e
   linha que esse PR já remove não entra de novo. Esse PR é
   manutenção e segue a autonomia do prompt; enquanto ele não entra, é a issue que cita a linha que
   impede o item de nascer de novo.
4. Com credencial: casos do Sentinela desta app sem Ordem de Serviço, **só** por rota de leitura
   que o `ajuda.md` do SDK fixado documente. Se ele não documentar rota que liste casos (é o caso do
   SDK 57.0.0, que documenta só o `sentinela/status`), escreva em "Não lido" que não há rota
   documentada e siga — nunca adivinhe endereço. Bug relatado ali segue o caminho que o processo do
   repositório define para bug.
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
próxima triagem" do painel, com o link dela (para linha do `ideias.md`, a seção e o título da linha) — é a fila que a triagem seguinte lê primeiro (§ 2).
Nada sai do painel sem ter virado item ou sido recusado.

**Item é sempre uma issue.** Entrada que ainda não é issue — um comentário `Observação:`, um caso
do Sentinela — e foi aceita dentro do limite vira issue nesta etapa (a exceção é a linha do
`Braindump`, que só vira issue depois da caixa do dono, § 2), antes de entrar na fila ou em
"Esperando o seu sim": a da IA com o rótulo `origem-ia` e o footer de atribuição, citando o
comentário que a originou; a de terceiros citando a fonte, como dado. É nela que a EXECUCAO
escreve o contrato e que o PR fecha com `Closes #<n>`.

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
