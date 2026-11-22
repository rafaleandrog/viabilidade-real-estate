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
| Triagem de 2026-08-03 e Rodada 9 (#451) | Na conferência dos critérios de aceite contra o código, 29 de 52 issues fechadas reprovaram; depois, a #451 precisou ser reaberta por um `Closes` com critério não cumprido | Mergeado = entregue | Só o diff prova entrega; `Closes` só com todos os critérios cumpridos, senão `Sem-fechamento` |
| Pedido a pedido, desde 2026-07-29 | Autoriza merge por pedido; a autorização de portões da Rodada 4 expirou com ela, e a da Rodada 15 valeu para aquela fila | Uma autorização de merge vale para as próximas | Merge é do dono, e a autorização vale só para o pedido em que foi dada |
| Rodada 15 (2026-10) | Decidiu cada item da conferência EVI na própria issue antes da execução | A IA escolhe o desenho quando a issue é ambígua | Decisão de desenho que muda número existente volta para ele (ex.: #726) |
| Instalação da rotina (2026-11-19) | Pediu que as perguntas fossem feitas na própria sessão | Bastava listá-las no fim do Estado da Arte e citar o arquivo | Toda pergunta vai escrita na conversa, completa e respondível ali; ele não abre arquivo para ler pergunta |
| Instalação da rotina (2026-11-20) | Mandou o fluxo dele: product manager escreve a spec, arquiteto faz plano e tarefas, dev implementa uma fatia por vez, QA/System/UI-UX/Segurança validam e devolvem ao dev, product owner confere critério por critério, deploy só quando ele manda; modelo forte pensa, modelo de execução faz | A rotina tinha um Planejador e um Construtor genéricos | Esse fluxo em todo item da EXECUCAO, com os papéis e modelos dele |
| Instalação da rotina (2026-11-20) | Disse que vai abrir sessões próprias ou escrever nas abertas para avançar sozinho | A rotina só olhava a própria fila | A rotina enxerga o que as outras sessões fizeram e continua de onde pararam, sem repetir |
| Respostas do Estado da Arte (2026-11-20) | Mandou anotar todas as ideias pendentes como ideia | Precisava decidir agora quais viram item | Ideia fica no `ideias.md`; a decisão vem com o tempo, nas sessões |
| Respostas do Estado da Arte (2026-11-20) | Avisou que o app já está bem evoluído e que as referências não podem substituir o que existe | Uma referência nova podia redesenhar o que já existe | Referência e item somam ao que existe; contradição com o que existe vira pergunta, nunca troca |
| Respostas do Estado da Arte (2026-11-20) | Pediu que release e mudança de número de versão só aconteçam quando ele pedir | A rotina podia soltar pré-release sozinha com `Release: automática` | Nenhuma release, tag ou `versao` sem pedido dele; a opção automática saiu |
| Respostas do Estado da Arte (2026-11-20) | Quer que as coisas mais simples a rotina já mergeie sozinha | Com o `CLAUDE.md` § Merge, nada mergeava sem ele | Itens pequenos e não sensíveis mergeiam sozinhos com `Autonomia: 2`; o resto espera ele |
| Rotina em duas tarefas (2026-11-21) | O Merge mergeia também os médios ("1. b") | Antes, só pequenos mergeavam sozinhos | Pequenos e médios não sensíveis mergeiam sozinhos com `Autonomia: 2`, como diz o `CLAUDE.md` § Merge; o resto espera ele. Substitui a linha anterior |
