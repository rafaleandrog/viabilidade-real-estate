# O que testar, em ordem

Só passe ao seguinte quando o anterior passar. Os limiares são ponto de partida.

| # | Teste | O que prova | Passa quando |
|---|---|---|---|
| T0 | PREPARAR numa sessão sua | A skill lê o app e redige um Estado da Arte utilizável | Você mergeia o PR depois de corrigir pouco |
| T1 | TRIAGEM com **Run now** | O ambiente de nuvem instala o SDK privado e lê o repositório | O painel aparece, e "Não lido" traz só o esperado |
| T2 | TRIAGEM por 3 dias | A fila é a que você montaria | Você concorda com a ordem e com o que ficou esperando o seu sim |
| T3 | EXECUCAO com `Autonomia: 1`, 5 itens | Um PR pronto sai de um item sem você | 4 de 5 PRs você aceitaria sem tocar |
| T4 | EXECUCAO com `Autonomia: 2`, 2 semanas (só depois de o processo do repositório reconhecer a linha: SKILL.md § 3) | O merge automático funciona e é confiável | A sessão mergeia sem ficar esperando confirmação, e nada é revertido |
| T5 | Caixa "Soltar a release proposta" marcada | A release sai só com o seu sim | A tag aparece só depois da caixa, e a instância de homologação a recebe |
| T6 | Rótulo `agora` numa issue | A sessão sob demanda abre e respeita o saldo | Com saldo, trabalha; sem saldo, deixa na fila |

## O que cada teste pode revelar

- **T1:** se o token do SDK chega à sessão e se os motores da `revisar-pr-apps` existem na nuvem.
- **T3:** quanto do trabalho cabe numa sessão. Se quase tudo vier como plano grande, o valor está
  na triagem e nos planos, não na execução automática.
- **T4 e T5:** se o ambiente deixa a sessão mergear e disparar o workflow. Se ela parar para pedir
  confirmação, essa ação volta para a sua mão até ajustarmos.

## Quando ajustar

- "Não lido" repetido no mesmo sinal: conserte o acesso antes de seguir.
- Recusa pelo mesmo motivo duas vezes: a triagem propõe um ajuste na skill, por PR.
- Orçamento que nunca é usado ou que sempre estoura: mude `orcamento_diario` na configuração.
- Consumo alto na sua página de uso: baixe o modelo da triagem ou o orçamento.
