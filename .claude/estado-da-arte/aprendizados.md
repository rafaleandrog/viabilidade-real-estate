# Como o dono decide

Regras curtas tiradas de correções, recusas e edições do dono. Todo papel lê antes de planejar.
Entram por PR, cinco por vez, e o dono pode cortar ou reescrever qualquer uma.

> As linhas abaixo foram **semeadas pela IA na etapa PREPARAR** a partir de decisões já registradas
> no `CLAUDE.md`, não de uma correção feita à rotina. A coluna "o que a rotina entendeu" é uma
> reconstrução do engano que cada decisão corrigiu. Corte ou reescreva à vontade.

| Quando | O dono disse ou fez | O que a rotina entendeu | O que ele queria |
|---|---|---|---|
| Rodada 8 (2026-08) | Autorizou consertar 3 bugs graves durante a auditoria e depois reverteu | Achado de auditoria pode ser consertado na hora | Auditoria só registra: todo achado vira issue, o conserto vem depois, em PR próprio |
| Rodada 8 (2026-08) | Recusou a linha de crédito rotativa no funding | Capital de giro pedia um produto novo | Só o rótulo: o tipo `divida` já é o capital de giro por calendário |
| Triagem de 2026-08-03 e Rodada 9 (#451) | Mandou conferir os critérios de aceite das issues fechadas contra o código, e reabriu a #451, fechada por `Closes` com critério não cumprido | Mergeado = entregue | Só o diff prova entrega; `Closes` só com todos os critérios cumpridos, senão `Sem-fechamento` |
| Pedido a pedido, desde 2026-07-29 | Autoriza merge por pedido; a autorização de portões da Rodada 4 expirou com ela, e a da Rodada 15 valeu para aquela fila | Uma autorização de merge vale para as próximas | Merge é do dono, e a autorização vale só para o pedido em que foi dada |
| Rodada 15 (2026-10) | Decidiu cada item da conferência EVI na própria issue antes da execução | A IA escolhe o desenho quando a issue é ambígua | Decisão de desenho que muda número existente volta para ele (ex.: #726) |
