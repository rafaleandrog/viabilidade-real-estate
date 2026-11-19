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

1. Issues abertas ou comentadas desde o último painel.
2. Linhas do `ideias.md` que ainda não viraram issue. Cada uma vira issue do dono, citando a
   linha. Não edite o `ideias.md`: é pela issue que você sabe que a linha já foi tratada.
3. Com credencial: casos do Sentinela desta app sem Ordem de Serviço, pelas rotas de leitura que
   `ajuda.md` do pacote documenta. Bug relatado ali continua pelo caminho do kit.
4. O que as sessões de EXECUCAO deixaram anotado como observação.
5. **Só às segundas-feiras:** SDK do lockfile contra o publicado, kit contra o publicado, avisos de
   obsolescência do empacotador com as datas do `obsolescencias.json` do SDK publicado.

## 3. Classificar cada entrada (Triador)

- **Origem:** dono, IA ou terceiros (SKILL.md § 4).
- **Tipo:** bug, manutenção, rumo ao Estado da Arte (cite o item), ou fora dele.
- **Tamanho:** 1, 2 ou grande (SKILL.md § 6). Grande ganha `plano-grande`.
- **Situação:** `pronta` quando a origem e a autonomia do prompt permitem; senão, vai para
  "Esperando o seu sim".

Respeite os limites da configuração: no máximo `max_ideias_ia_dia` itens novos da IA por dia e
`max_esperando_dono` itens esperando. Passou do limite, guarde a observação para o dia seguinte.

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
