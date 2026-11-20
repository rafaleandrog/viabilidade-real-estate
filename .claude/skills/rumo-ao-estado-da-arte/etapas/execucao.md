# Etapa EXECUCAO — itens da fila até o merge, dentro do orçamento

## 1. Orçamento

Leia no painel quanto do `orcamento_diario` já foi gasto hoje. Sem saldo: anote "sem saldo" e
encerre. Não comece item que custa mais que o saldo.

**Sob demanda** (sessão disparada por rótulo numa issue): confira primeiro **o rótulo que o evento
acabou de aplicar**. Se não for o `rotulo_urgente` da configuração, encerre sem escrever nada — o
gatilho dispara a cada rótulo posto em qualquer issue. Sendo ele, trabalhe só na issue do evento, e
só se ela ainda não tiver branch ou PR desta rotina; já tendo, ou sem saldo, deixe na fila e
encerre.

## 2. A ordem

1. PRs desta rotina já abertos: achado de revisão, CI vermelho, conflito.
2. Itens urgentes do dono.
3. Bugs.
4. Outros itens do dono.
5. Passos rumo ao Estado da Arte.
6. Manutenção.

## O fluxo de cada item

É o fluxo que o dono pediu, e cada passo tem dono e modelo. **O modelo forte pensa (spec, plano,
critérios); o de execução faz (código, validação).** A sessão da EXECUCAO roda no modelo forte e
delega cada fatia e cada validador a um subagente no modelo de execução (por exemplo `sonnet`),
sempre com o modelo explícito.

| Passo | Papel | Modelo | Entrega |
|---|---|---|---|
| 1 | Product manager | forte | a **spec** na issue: o quê e por quê, e os critérios de aceite numerados |
| 2 | Arquiteto | forte | o **plano**: contratos tocados e as fatias, cada uma testável sozinha |
| 3 | Dev | execução | **uma fatia por vez**, com o teste dela |
| 4 | QA · System · UI/UX · Segurança | execução | a validação; **achou problema, volta para o Dev** |
| 5 | Product owner | forte | a conferência **critério por critério**, último portão antes do merge |
| 6 | Liberador | — | merge dentro da autonomia; **release só quando o dono manda** |

### Antes de pegar o item: de onde ele parou

Leia o último comentário `Continuação:` da issue, o PR e a branch dela, e o painel. Outra sessão (a
do dono, inclusive) pode ter avançado: **continue de onde parou, nunca recomece.** Item com sessão
do dono ativa nele, ou com branch ou PR aberto que não é desta rotina, não é pego (SKILL.md § 6). Sem
a ferramenta de sessões do Claude Code nesta sessão, vale só o sinal de branch, PR e
`Continuação:`; registre no painel, em "Não lido", que as sessões não puderam ser consultadas.

## 3. Spec e plano (Product manager e Arquiteto)

Escreva na issue, se ainda não houver, a **spec**: objetivo, restrições, o que pede aprovação e os
**critérios de aceite numerados**, cada um verificável ("pronto quando"). Depois o **plano**: os
contratos que o item toca (rotas, schema, SDK, telas) e as **fatias**, na ordem, cada uma pequena e
testável sozinha. Leia `.claude/estado-da-arte/aprendizados.md` e o item do Estado da Arte antes: é
como o dono decide e para onde o app vai.
Lido o código, o item não cabe numa sessão ou é sensível: comente, marque `plano-grande` ou leve a
"Esperando o seu sim", e passe ao próximo. Item sensível cuja caixa o dono **já** marcou não volta
para lá: implemente, e o PR para no portão de merge (§ 5), que ele sempre segura.

## 4. Implementar, uma fatia por vez (Dev)

Cada fatia é um subagente no modelo de execução, com a spec, o plano e só aquela fatia no briefing;
ele devolve o diff e o teste, e a sessão confere antes de passar à seguinte. Siga **o processo do repositório** por inteiro: o do `CLAUDE.md` e, quando o repositório os
tiver, o do `KIT.md` e a skill `implementar` — incluindo o empacotador limpo antes do commit e os
registros que o repositório exige. É esta etapa, e só ela, que altera código do app (SKILL.md § 6).

- Defeito: primeiro um teste que **falha** no código atual, depois o conserto.
- **Nunca altere, pule nem remova teste existente.** Parece necessário? Pare e leve ao dono.
- Peça uma solução geral: os testes verificam, não definem a solução.
- Não toque em Estado da Arte, configuração nem nos arquivos desta skill.
- Mesmo erro duas vezes sem nada novo: pare e escreva na issue o que tentou.
- O que você notar e não for deste item, anote para a TRIAGEM como comentário `Observação:` na
  issue-painel. Não conserte de passagem e não abra issue por conta própria.

## 5. Validar, conferir e mergear (QA, System, UI/UX, Segurança, Product owner, Liberador)

PR com `Closes #<n>` e o relato do que rodou. Depois, a validação, com estas quatro frentes:

- **QA:** os testes e o navegador — os validadores do repositório (`validar-frontend.sh`, com o
  render em Chromium; `validar-backend.sh` se tocou backend, schema ou migração).
- **System:** consistência — a revisão pela skill `revisar-pr-apps` do repositório, com as rodadas
  que o processo dele define (camada de contratos, lentes e o App do Codex).
- **UI/UX:** **só se o item tem tela** — a lente de UI da `revisar-pr-apps` e o caso de render.
- **Segurança:** permissão, autenticação e dado pessoal (PII, LGPD) — a lente de segurança da
  `revisar-pr-apps` sempre que o item toca rota, permissão ou dado de pessoa.

**Achou problema, volta para o Dev (§ 4)**, na fatia que o causou, e a validação roda de novo. Nunca
passe autorização de merge à revisão.

Com a validação limpa, o **Product owner** confere a spec **critério por critério**: para cada
critério de aceite, a evidência (teste, medição, captura) e ✅ ou ❌, numa tabela comentada na issue.
Um ❌ volta para o Dev. É o último portão antes do merge.

Mergeia quando valem **todas**:

1. o Product owner marcou ✅ em todos os critérios;
2. a revisão fechou sem bloqueante pendente (no repositório que tem o status
   `revisao/bloqueantes`, ele verde no head atual);
3. o CI do **head atual** está verde (pendente não é verde);
4. o item está dentro da autonomia do prompt (SKILL.md § 3) e não toca nada da lista do que
   sempre espera o dono.

Faltou alguma: o PR fica **pronto e parado**, e vai para "Esperando o seu sim" com o motivo.
Depois de cada item, some os pontos no painel e deixe na issue o comentário `Continuação:` (o que
foi feito, onde está, o próximo passo). Com saldo, pegue o próximo.

Se uma ação for bloqueada pelo ambiente e a sessão ficar esperando confirmação, não insista:
registre no painel qual ação parou e encerre.

## 6. Release (Liberador) — só quando o dono manda

O padrão é **propor**: a release sai quando o dono manda, marcando a caixa da proposta no painel
ou pondo `Release: automática` no prompt da tarefa. Conte os pontos mergeados desde a última release. O limiar é `release_pontos`, ou `release_dias`
com ao menos uma mudança.

- **Abaixo do limiar:** nada.
- **Há algo sensível entre as mudanças** — qualquer item da lista "sempre esperam o dono" do
  SKILL.md § 3 (migração, `schema.json`, manifesto, permissões, dependências, workflows e hooks,
  teste existente alterado ou removido, Estado da Arte, configuração, arquivos desta skill), mesmo
  que o dono já o tenha mergeado: proponha no painel, em "Esperando o seu sim", com o que muda e o
  que não tem volta. Nunca dispare.
- **Sem nada sensível e com `Release: automática` no prompt:** dispare o workflow de release do
  repositório, do jeito que o `KIT.md` (onde houver) ou o `CLAUDE.md` definem, e anote a tag no
  painel.
- **Sem a linha no prompt:** proponha no painel com a lista do que entra.

Em todos os casos, escreva no painel o roteiro do que o dono deve conferir na homologação.
**Homologar é sempre dele.**
