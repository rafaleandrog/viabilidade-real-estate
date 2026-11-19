# Etapa EXECUCAO — itens da fila até o merge, dentro do orçamento

## 1. Orçamento

Leia no painel quanto do `orcamento_diario` já foi gasto hoje. Sem saldo: anote "sem saldo" e
encerre. Não comece item que custa mais que o saldo.

**Sob demanda** (sessão disparada por rótulo numa issue): trabalhe só na issue aberta mais antiga
com o rótulo de urgência da configuração. Não há nenhuma, ou não há saldo: deixe na fila e encerre.

## 2. A ordem

1. PRs desta rotina já abertos: achado de revisão, CI vermelho, conflito.
2. Itens urgentes do dono.
3. Bugs.
4. Outros itens do dono.
5. Passos rumo ao Estado da Arte.
6. Manutenção.

## 3. Contrato antes do código (Planejador)

Escreva na issue, se ainda não houver: objetivo, restrições, "pronto quando" verificável e o que
pede aprovação. Leia `.claude/estado-da-arte/aprendizados.md` antes: é como o dono decide.
Lido o código, o item não cabe numa sessão ou é sensível: comente, marque `plano-grande` ou leve a
"Esperando o seu sim", e passe ao próximo.

## 4. Implementar (Construtor)

Siga **o processo do repositório** por inteiro: o do `CLAUDE.md`, o do `KIT.md` e a skill
`implementar`, incluindo o empacotador limpo antes do commit e os registros que o repositório exige.

- Defeito: primeiro um teste que **falha** no código atual, depois o conserto.
- **Nunca altere, pule nem remova teste existente.** Parece necessário? Pare e leve ao dono.
- Peça uma solução geral: os testes verificam, não definem a solução.
- Não toque em Estado da Arte, configuração nem nos arquivos desta skill.
- Mesmo erro duas vezes sem nada novo: pare e escreva na issue o que tentou.
- O que você notar e não for deste item, anote para a TRIAGEM. Não conserte de passagem.

## 5. Revisar e mergear (Revisor e Liberador)

PR com `Closes #<n>` e o relato do que rodou. Depois: `/revisar-pr-apps <n> — máximo 3 rodadas`,
sem passar autorização de merge à revisão.

Mergeia quando valem **todas**:

1. a revisão fechou em **Sucesso**;
2. o CI do **head atual** está verde (pendente não é verde);
3. o item está dentro da autonomia do prompt (SKILL.md § 3) e não toca nada da lista do que
   sempre espera o dono.

Faltou alguma: o PR fica **pronto e parado**, e vai para "Esperando o seu sim" com o motivo.
Depois de cada item, some os pontos no painel. Com saldo, pegue o próximo.

Se uma ação for bloqueada pelo ambiente e a sessão ficar esperando confirmação, não insista:
registre no painel qual ação parou e encerre.

## 6. Release (Liberador)

Conte os pontos mergeados desde a última release. O limiar é `release_pontos`, ou `release_dias`
com ao menos uma mudança.

- **Abaixo do limiar:** nada.
- **Há migração, mudança de schema ou de manifesto entre as mudanças:** proponha no painel, em
  "Esperando o seu sim", com o que muda e o que não tem volta. Nunca dispare.
- **Sem nada sensível e com `Release: automática` no prompt:** dispare o workflow de release do
  repositório, do jeito que o `KIT.md` ou o `CLAUDE.md` definem, e anote a tag no painel.
- **Sem a linha no prompt:** proponha no painel com a lista do que entra.

Em todos os casos, escreva no painel o roteiro do que o dono deve conferir na homologação.
**Homologar é sempre dele.**
