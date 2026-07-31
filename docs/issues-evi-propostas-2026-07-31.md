# Issues EVI propostas — 2026-07-31

> ⚠️ **NENHUMA destas issues foi aberta no GitHub.** Os identificadores `EVI-0NN` são **locais e
> provisórios**; o GitHub atribuirá os números reais quando (e se) o autor aprovar a abertura.
> Enquanto isso, elas não existem como issue: não têm número, não aparecem em busca e não podem ser
> referenciadas por PR.
>
> **Decisão pendente do autor:** aprovar, ajustar ou rejeitar esta lista e a ordem de execução.

**Base de evidência:** `docs/rodada-5-evi-2026-07-31.md` (matriz de aderência).
**Labels:** só as existentes no repo — `bug` (comportamento errado hoje) e `enhancement`
(capacidade nova). Nenhuma taxonomia nova.
**Verificação de duplicidade:** 0 issues abertas; 141 fechadas varridas. As adjacentes (#165, #166,
#168, #170, #188, #195, #196) entram citadas como histórico, não como duplicata.

---

## Índice e ordem de abertura

| ID | Título sugerido | Label | Prioridade | Classe | Onda | Dependências |
|---|---|---|---:|---|:--:|---|
| EVI-001 | `test(fluxo): cenário dourado de Incorporação reconciliado mês a mês` | enhancement | P0 | M2/testes | 0 | — |
| EVI-002 | `chore(avancado): inventariar dados legados e estratégia de compatibilidade` | enhancement | P0 | P3 | 0 | — |
| EVI-003 | `fix(receitas): renomear Fase comercial para Grupo na linguagem do usuário` | enhancement | P1 | U1 | 1 | — |
| EVI-004 | `fix(cronograma): adotar Após-chaves na nomenclatura exibida` | enhancement | P1 | U1 | 1 | — |
| EVI-005 | `fix(cronograma): ancorar o início da Obra ao fim do Planejamento` | bug | P1 | M2 | 1 | 001, 002 |
| EVI-006 | `fix(absorcao): derivar "Durante a obra" após o Lançamento, sem sobrepor períodos` | bug | P1 | M2 | 1 | 005 |
| EVI-007 | `fix(absorcao): fixar a janela Após-chaves em 12 meses` | bug | P1 | M2/P3 | 1 | 001, 002, 005 |
| EVI-008 | `feat(receitas): série canônica de vendas contratadas, separada do recebimento` | bug | P1 | M2 | 2 | 001 |
| EVI-009 | `refactor(receitas): explicitar VGV potencial, vendável, contratado e Receita Bruta` | enhancement | P1 | M2/U1 | 2 | 008 |
| EVI-010 | `refactor(receitas): contrato canônico de pagamento por Grupo, sem quebrar o JSON legado` | enhancement | P1 | P3/M2 | 2 | 001, 002 |
| EVI-011 | `fix(fluxo): derivar o horizonte de todos os eventos financeiros e remover o fallback` | bug | P1 | M2 | 2 | 001, 010 |
| EVI-012 | `feat(receitas): tabela curta com sinal, 36 parcelas e juros por safra` | enhancement | P2 | M2 | 3 | 008, 010, 011 |
| EVI-013 | `feat(receitas): componente Obra da tabela longa por safra` | enhancement | P2 | M2 | 3 | 008, 010, 011 |
| EVI-014 | `feat(receitas): saldo a repassar capitalizado e liquidação integral` | enhancement | P2 | M2 | 3 | 013 |
| EVI-015 | `fix(receitas): novas vendas Após-chaves recebidas à vista no mês da contratação` | bug | P2 | M2 | 3 | 007, 008, 010 |
| EVI-016 | `feat(fluxo): carteira econômica real de clientes por componente` | enhancement | P2 | M2 | 3 | 012, 013, 014 |
| EVI-017 | `feat(receitas): Receita Bruta — VGV formada pelos recebimentos, com juros` | enhancement | P2 | M2/U1 | 3 | 008, 012–016 |
| EVI-018 | `feat(terreno): permuta financeira bruta e líquida no regime de caixa` | enhancement | P2 | M2 | 4 | 008, 017 |
| EVI-019 | `feat(funding): integrar (ou remover) o financiamento à produção` | bug | P3 | M2/P3 | 4 | 001, 011, 017 |
| EVI-020 | `feat(fluxo): invariantes e relatório de reconciliação` | enhancement | P2 | M2/testes | 5 | 012–019 |
| EVI-021 | `feat(fluxo): exibir contratação, juros, carteiras, repasse e funding` | enhancement | P3 | U1/M2 | 5 | 017, 019, 020 |

**Ajustes da auditoria sobre a lista original da instrução:**

- **EVI-005 encolheu** — o Pré-lançamento já foi ancorado pela #165; sobra só a Obra;
- **EVI-001 confirmada necessária** — nenhum dos 11 arquivos de teste do repo é cenário dourado;
- **EVI-008** ganhou o achado da corretagem incidindo sobre VGV bruto;
- **EVI-009/EVI-017** ganharam o caso concreto de `receitaBrutaVgv` já significar VGV vendável;
- **EVI-018** registra que #195 e #196 já entregaram parte do escopo;
- **EVI-019** deixou de ser "implementar funding" e virou **decisão**: integrar ou remover.

---

## EVI-001 — Cenário dourado de Incorporação reconciliado mês a mês

**Título:** `test(fluxo): cenário dourado de Incorporação reconciliado mês a mês`
**Label:** `enhancement` · **Prioridade:** P0 · **Classe:** M2/testes · **Risco:** baixo no runtime, alto valor como portão

**Contexto.** Mudanças em cronograma, absorção, juros, carteiras, repasse e funding alteram muitas
séries mensais ao mesmo tempo. Sem referência controlada, dá para "corrigir" uma parte e degradar
outra sem perceber.

**Comportamento atual confirmado.** O repo tem 11 arquivos de teste
(`frontend/fluxo-caixa-motor.test.ts`, `frontend/fluxo-shared.test.ts`, `frontend/proforma.test.ts`
e outros). Todos cobrem **funções isoladas**; nenhum reconcilia um estudo completo mês a mês contra
uma referência externa.

**Comportamento esperado.** Um cenário versionado que valide cronograma, absorção por período,
contratação por Grupo e tipologia, receitas à vista, custos, fluxo e indicadores — extensível para
receber tabela curta, longa, juros, carteiras, repasse e funding conforme as issues avancem, com os
campos ainda inexistentes explicitamente marcados.

**Escopo.** Input estável e anonimizado; valores esperados mensais em formato legível; comparador
com tolerância de arredondamento definida; conferência de totais e invariantes, não só snapshot;
origem e versão da referência documentadas.

**Fora de escopo.** Alterar o motor para "fazer o teste passar". Copiar fórmulas de planilha sem
entender a regra. Importação automática de planilha.

**Arquivos prováveis.** Novo arquivo de fixture + teste ao lado de `frontend/fluxo-caixa-motor.test.ts`.

**Impacto em estudos existentes.** Nenhum. **Migração:** não.

**Critérios de aceite.**
- [ ] O teste falha quando uma série mensal relevante muda indevidamente.
- [ ] A tolerância monetária é explícita.
- [ ] Totais acumulados são conferidos.
- [ ] O teste identifica o **primeiro mês** e a **linha** divergente.
- [ ] A fixture aceita novas séries sem reescrever o comparador.
- [ ] O cenário diferencia contratação de recebimento.
- [ ] Roda sem depender de arquivo externo não versionado.

**Testes mínimos.** Cenário-base completo; sem juros; um Grupo e uma tipologia; proteção contra
truncamento do último recebimento; arredondamento acumulado.

**Dependências.** Nenhuma. **Antecede todas as issues M2.**

**Documentação afetada.** `docs/viabilidade/padrao-incorporacao.md` §21.

---

## EVI-002 — Inventariar dados legados e estratégia de compatibilidade

**Título:** `chore(avancado): inventariar dados legados e estratégia de compatibilidade`
**Label:** `enhancement` · **Prioridade:** P0 · **Classe:** P3 · **Risco:** baixo como diagnóstico, crítico como portão

**Contexto.** O app evoluiu de linhas de receita para catálogo + Grupo + alocação. Absorção e fluxo
de pagamento são persistidos em JSON livre. Mudanças futuras não podem invalidar estudos existentes.

**Comportamento atual confirmado.** `avancado_linhas_receita` **continua declarada** no
`schema.json` e convive com `avancado_fases` + `avancado_alocacoes`, que a superaram —
é estrutura vestigial. Os JSON `absorcao` (3 períodos) e `fluxo_pagamento` (listas `entrada` e
`parcelas` + `repasse.apos_entrega_meses`) não têm versionamento nem normalizador único.

**Comportamento esperado.** Inventário técnico de: tabelas atuais e vestigiais; formatos JSON em
circulação; defaults; migrações já executadas; formas legadas ainda toleradas pelo motor; estudos
com Após-chaves ≠ 12 meses; estudos com fluxo de pagamento genérico; campos financeiros existentes e
não utilizados (ver EVI-019); regras de duplicação; exportações dependentes do shape atual.

**Escopo.** Ler schema e migrações; identificar adaptadores existentes; registrar shapes atual e
legado; listar o que exigiria migração; propor leitura compatível antes de qualquer escrita nova;
identificar se dados calculados são persistidos ou só inputs.

**Fora de escopo.** Executar migração. Remover a tabela vestigial. Converter dados em produção.
Normalizar JSON em tabelas por preferência.

**Arquivos prováveis.** `schema.json`, `migracoes/`, `backend/rotas/avancado.ts`,
`frontend/fluxo-caixa-motor.ts`, `frontend/exportar.ts`.

**Impacto em estudos existentes.** Nenhum (diagnóstico). **Migração:** não.

**Critérios de aceite.**
- [ ] Existe matriz campo / formato / versão / consumidor.
- [ ] Cada formato legado tem estratégia: preservar, adaptar, migrar ou bloquear.
- [ ] O impacto em duplicação, importação e exportação está registrado.
- [ ] A necessidade de bump da `versao` está corretamente vinculada a haver migração.
- [ ] Nenhuma proposta destrutiva sem rollback.
- [ ] O inventário quantifica os estudos afetados pelas regras de 12 meses e do novo pagamento.

**Testes mínimos.** Diagnósticos. Se houver helper de normalização, teste para cada shape legado
encontrado.

**Dependências.** Nenhuma. **Antecede toda issue P3** e as mudanças de pagamento.

**Documentação afetada.** `docs/viabilidade/modelo-de-dados.md`, `padrao-incorporacao.md` Anexo C.

---

## EVI-003 — Fase → Grupo na linguagem do usuário

**Título:** `fix(receitas): renomear Fase comercial para Grupo na linguagem do usuário`
**Label:** `enhancement` · **Prioridade:** P1 · **Classe:** U1 · **Risco:** baixo, se os identificadores internos forem preservados

**Contexto.** "Fase" colide com os períodos do cronograma. O agrupador comercial não tem início,
duração ou fim — ele reúne estoque, preço, absorção e fluxo de pagamento.

**Comportamento atual confirmado.** A tela de Receitas
(`frontend/tela-fluxo-receitas.ts`), os cabeçalhos do Fluxo de Caixa e as exportações dizem "Fase".
A #168 já separou `avancado_fases` por `tipo` (`receita` = Grupo comercial, `cronograma` = marcador
do gantt), então a distinção conceitual já existe no dado — falta na linguagem.

**Comportamento esperado.** `1ª Fase → 1º Grupo`, `Adicionar Fase → Adicionar Grupo`,
`VGV da fase → VGV do Grupo`, alcançando tela de Receitas, botões e modais, mensagens e validações,
cabeçalhos do Fluxo de Caixa, filtros, CSV, PDF, textos de estado vazio, documentação e snapshots
textuais de teste.

**Salvaguarda.** **Não** renomear `avancado_fases`, `fase_id`, rotas, chaves JSON, funções internas
nem contratos consumidos. "Fase" ou "evento" pode ficar onde representar tempo de fato.

**Fora de escopo.** Migração de renomeação interna (fora do backlog por decisão do autor).

**Arquivos prováveis.** `frontend/tela-fluxo-receitas.ts`, `frontend/tela-fluxo-caixa.ts`,
`frontend/exportar.ts`, docs.

**Impacto em estudos existentes.** Nenhum. **Migração:** não.

**Critérios de aceite.**
- [ ] O usuário não encontra "Fase" em contexto de agrupamento comercial.
- [ ] Estudos existentes abrem sem migração.
- [ ] APIs e schema permanecem compatíveis.
- [ ] Exportações usam "Grupo".
- [ ] A documentação distingue Grupo de período temporal.

**Testes mínimos.** Busca automatizada de strings em UI e exportação, revisada contra
falso-positivo; render do card do Grupo; exportação com cabeçalhos novos; suíte atual verde;
`scripts/validar-frontend.sh`.

**Dependências.** Nenhuma. **Documentação afetada.** `padrao-incorporacao.md` §3.1.

---

## EVI-004 — Pós-obra → Após-chaves na linguagem do usuário

**Título:** `fix(cronograma): adotar Após-chaves na nomenclatura exibida`
**Label:** `enhancement` · **Prioridade:** P1 · **Classe:** U1 · **Risco:** baixo, se não alterar cálculo

**Contexto.** O negócio usa **Após-chaves** para o período comercial posterior à entrega.
"Pós-obra" é amplo e confunde com manutenção e assistência técnica.

**Comportamento atual confirmado.** `EVENTO_LABEL` em `frontend/fluxo-shared.ts` define
`pos_obra: 'Pós-obra'`; o rótulo se propaga para cronograma, modal de absorção, gráficos e
exportações.

**Comportamento esperado.** "Após-chaves" como rótulo comercial exibido em cronograma, modal de
absorção, gráficos, relatórios, filtros, mensagens e documentação.

**Salvaguarda.** O identificador interno `pos_obra` **permanece**. Esta issue **não** fixa duração
nem altera início — isso é EVI-007.

**Fora de escopo.** Qualquer mudança de série mensal.

**Arquivos prováveis.** `frontend/fluxo-shared.ts` (`EVENTO_LABEL`), telas de cronograma e absorção,
`frontend/exportar.ts`.

**Impacto em estudos existentes.** Nenhum. **Migração:** não.

**Critérios de aceite.**
- [ ] "Após-chaves" é o rótulo comercial exibido.
- [ ] Manutenção pós-obra continua sendo conceito distinto.
- [ ] **Nenhuma série mensal muda** por causa desta issue.
- [ ] Estudos e JSON existentes continuam válidos.

**Testes mínimos.** Render do cronograma; modal de absorção; exportação; busca de strings em
contexto comercial.

**Dependências.** Nenhuma. Deve ficar **separada** da mudança comportamental de 12 meses.

**Documentação afetada.** `padrao-incorporacao.md` §3, §8.

---

## EVI-005 — Ancorar o início da Obra ao fim do Planejamento

**Título:** `fix(cronograma): ancorar o início da Obra ao fim do Planejamento`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2 · **Risco:** médio a alto — muda calendário e resultados

**Contexto.** A regra aprovada é que o Planejamento determina o início **simultâneo** de
Pré-lançamento e Obra física.

**Comportamento atual confirmado.** `recalcularTravados`, em `backend/rotas/avancado.ts`, trava
**três** inícios — `pre_lancamento` = fim do `planejamento` (entregue pela #165), `lancamento` = fim
do `pre_lancamento`, `pos_obra` = fim da `obra`. **Não há ramo para `obra`**: seu `inicio_mes` é
livre, então Obra e Pré-lançamento podem começar em meses diferentes.

> Esta issue **encolheu** em relação ao plano original: a parte do Pré-lançamento já está entregue.

**Comportamento esperado.**

```text
inicio_obra = inicio_planejamento + duracao_planejamento
```

derivado e protegido contra combinação incoerente, com o campo travado na tela como os demais.

**Escopo.** Regra de recálculo do cronograma; campo travado na UI; validação de backend;
reancoragem de custos apenas conforme as regras já existentes; comportamento definido para estudos
legados.

**Fora de escopo.** Alterar a duração da Obra. A janela comercial "Durante a obra" (EVI-006). Fixar
Após-chaves (EVI-007). Datas próprias de Grupo.

**Arquivos prováveis.** `backend/rotas/avancado.ts` (`recalcularTravados` e testes),
tela de Cronograma.

**Impacto em estudos existentes.** **Alto** — estudos com Obra fora da âncora terão o calendário
deslocado, mudando o fluxo. **Migração:** a decidir na issue.

**Compatibilidade obrigatória.** Antes de implementar, decidir explicitamente: novos estudos
recebem a regra automaticamente; estudos existentes são migrados, recalculados na leitura ou
preservados até edição; como comunicar a mudança de resultado. **Nenhuma alteração silenciosa de
estudo aprovado.**

**Critérios de aceite.**
- [ ] Alterar a duração do Planejamento desloca Pré-lançamento e Obra juntos.
- [ ] Alterar o Pré-lançamento desloca o Lançamento sem separar o início da Obra.
- [ ] Não é possível criar lacuna entre Planejamento e o início dos dois eventos.
- [ ] Custos ancorados continuam coerentes.
- [ ] A regra de compatibilidade é testada.

**Testes mínimos.** Cronograma padrão; alteração da duração do Planejamento; do Pré-lançamento;
estudo legado; duplicação de estudo; ancoragem de custo; fixture dourada (EVI-001).

**Dependências.** EVI-001 e EVI-002. **Documentação afetada.** `padrao-incorporacao.md` §8.2.

---

## EVI-006 — "Durante a obra" derivado após o Lançamento

**Título:** `fix(absorcao): derivar "Durante a obra" após o Lançamento, sem sobrepor períodos`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2 · **Risco:** alto — redistribui contratação e caixa

**Contexto.** A Obra física começa junto com o Pré-lançamento. Se a faixa de absorção "Obra" usar o
evento físico inteiro, ela se sobrepõe ao Pré-lançamento e ao Lançamento, e percentuais comerciais
diferentes incidem sobre os mesmos meses.

**Comportamento atual confirmado.** `faixasAbsorcao`, em `frontend/fluxo-shared.ts`, deriva a faixa
`obra` como `inicio_mes` até `inicio_mes + duracao_meses − 1` do **evento Obra inteiro** — a
sobreposição descrita acima acontece hoje. Além disso, o JSON `absorcao` tem só **3** períodos:
`lancamento` cobre Pré-lançamento **e** Lançamento juntos.

**Comportamento esperado.**

```text
inicio_durante_obra = fim_lancamento + 1
fim_durante_obra    = fim_obra_fisica
```

com os quatro períodos comerciais — Pré-lançamento, Lançamento, Durante a obra, Após-chaves —
contíguos ou explicitamente vazios, **sem sobreposição**. Atenção à convenção 0-based para não criar
off-by-one.

**Escopo.** Helper de faixas de absorção; gráfico e rótulos; cálculo distribuído; caso em que o
Lançamento termina no mesmo mês da entrega; impedir duração negativa.

**Fora de escopo.** Mudar o início físico da Obra (EVI-005). Fixar Após-chaves (EVI-007). Calendário
por Grupo.

**Arquivos prováveis.** `frontend/fluxo-shared.ts` (`faixasAbsorcao`, `absorcaoMensal`) e testes;
modal de absorção.

**Impacto em estudos existentes.** **Alto** — redistribui vendas no tempo. **Migração:** possível,
para o 4º período; decidir com EVI-002 e EVI-010.

**Critérios de aceite.**
- [ ] Nenhum mês recebe percentuais de dois períodos comerciais.
- [ ] A soma da contratação continua 100%.
- [ ] "Durante a obra" começa depois do Lançamento e termina no fim da Obra.
- [ ] Quando não há janela disponível, a validação explica o problema.
- [ ] Gráfico e tabela usam a mesma derivação do motor.

**Testes mínimos.** Pré-lançamento e Obra iniciando juntos; Lançamento de 1 e de vários meses; obra
curta; janela vazia; 0% em um ou mais períodos; reconciliação da fixture dourada.

**Dependências.** EVI-005. **Documentação afetada.** `padrao-incorporacao.md` §8.3, §10.2.

---

## EVI-007 — Fixar Após-chaves em 12 meses

**Título:** `fix(absorcao): fixar a janela Após-chaves em 12 meses`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2/P3 · **Risco:** alto para estudos existentes

**Contexto.** A regra aprovada define janela comercial fixa de 12 meses após a entrega.

**Comportamento atual confirmado.** O **início** já é o mês seguinte ao fim da Obra (`pos_obra`
travado em `recalcularTravados`). A **duração é livre e editável**: `faixasAbsorcao`, em
`frontend/fluxo-shared.ts`, calcula
`durPos = Math.max(1, Math.round(posObraMeses ?? pos.duracao_meses))`. Há estudos gravados com
duração diferente de 12.

**Comportamento esperado.** `duracao_apos_chaves = 12`, com o percentual continuando a ser o resíduo
da absorção do Grupo.

**Escopo.** Fixar a duração no motor e na UI; remover ou travar a edição; atualizar defaults e
validações; definir a estratégia para dados existentes; atualizar gráfico e rótulo.

**Fora de escopo.** Condição à vista para novas vendas (EVI-015). Repasse (EVI-014). Renomear rótulo
(EVI-004).

**Arquivos prováveis.** `frontend/fluxo-shared.ts`, tela de Cronograma, modal de absorção,
`backend/rotas/avancado.ts`, possível migração.

**Impacto em estudos existentes.** **O maior desta rodada.** **Migração:** provável.

**Compatibilidade obrigatória — a issue não pode ser implementada antes de responder:**
quantos estudos têm duração diferente; se estudos aprovados serão preservados; se a regra vale só
para estudos novos; se haverá migração ou aviso de recálculo; como ficam os cenários salvos.

**Critérios de aceite.**
- [ ] Novos estudos usam 12 meses.
- [ ] O primeiro mês é imediatamente posterior à Obra.
- [ ] O usuário não cria duração diferente no modelo novo.
- [ ] A absorção residual fecha em 100%.
- [ ] O tratamento legado é explícito e testado.
- [ ] **Nenhum recebimento é truncado pelo horizonte** (ver EVI-011).

**Testes mínimos.** Estudo novo; estudo legado com 24 meses; 100% vendido antes da entrega; 100%
vendido Após-chaves; combinação de percentuais; exportação e gráfico.

**Dependências.** EVI-001, EVI-002 e EVI-005. **Documentação afetada.** `padrao-incorporacao.md`
§8.5, §10.4.

---

## EVI-008 — Série canônica de vendas contratadas

**Título:** `feat(receitas): série canônica de vendas contratadas, separada do recebimento`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2 · **Risco:** médio

**Contexto.** A contratação baixa estoque, forma safras, define corretagem e antecede o recebimento.
Precisa ser uma série canônica, auditável e independente do caixa.

**Comportamento atual confirmado — duas bases divergentes.**
`vgvVendidoMensal`, em `frontend/fluxo-shared.ts`, reparte o **VGV bruto** da linha (`vgvLinha`, que
conta a tipologia inteira). `receitaMensalLinha`, em `frontend/fluxo-caixa-motor.ts`, reparte o
**VGV vendável** (`vgvVendavelLinha`, que exclui as unidades permutadas fisicamente — #195).

**Consequência confirmada:** `ctxCusto.receitaTotal` é montado com `vglLinha(vgvLinha(...))`, de
modo que **comissão e RET incidem também sobre a unidade permutada fisicamente**, que nunca gera
caixa. Custos com base `pct_receita` herdam essa base.

**Comportamento esperado.** Por mês, Grupo e tipologia:

```text
área contratada     = área alocada × % de absorção do mês
vendas contratadas  = área contratada × preço por m²
```

sem juros futuros, a partir de **uma única** função canônica usada por baixa de estoque, corretagem
e safras.

**Escopo.** Função canônica única; exposição por total, Grupo e tipologia; reconciliação com área e
preço; visão mensal como base da anual; eliminar cálculo duplicado entre tela, motor e exportação;
declarar a base de corretagem.

**Fora de escopo.** Recebimentos das tabelas curta e longa. Definição final da Receita Bruta
(EVI-017). Arquitetura de Grupos e alocações.

**Arquivos prováveis.** `frontend/fluxo-shared.ts`, `frontend/fluxo-caixa-motor.ts` e testes.

**Impacto em estudos existentes.** **Muda resultado** de estudos com permuta física — corretagem e
RET deixam de incidir sobre unidade permutada. Tem que ser comunicado. **Migração:** não.

**Critérios de aceite.**
- [ ] Existe série mensal explícita de contratação.
- [ ] A soma mensal fecha com o valor contratado acumulado.
- [ ] A abertura por Grupo e tipologia fecha com o total.
- [ ] A corretagem usa a mesma série, com base declarada.
- [ ] Juros não entram na contratação.
- [ ] Permuta física não gera contratação de caixa.
- [ ] A visão anual soma os meses sem recalcular a lógica.

**Testes mínimos.** Uma tipologia em um Grupo; mesma tipologia em dois Grupos com preços
diferentes; vários Grupos com absorções diferentes; arredondamento de área e valor; corretagem com
e sem permuta física; estoque final.

**Dependências.** EVI-001. **Documentação afetada.** `padrao-incorporacao.md` §12, §16.3.

---

## EVI-009 — Taxonomia de VGV, contratação, recebimento e juros

**Título:** `refactor(receitas): explicitar VGV potencial, vendável, contratado e Receita Bruta`
**Label:** `enhancement` · **Prioridade:** P1 · **Classe:** M2/U1 · **Risco:** médio a alto — os nomes atuais são consumidos por telas e exportações

**Contexto.** "VGV" designa hoje grandezas diferentes conforme o contexto.

**Comportamento atual confirmado.** A #188 criou `vgvTotal`, `vgvPermutaFisica` e `receitaBrutaVgv`
em `frontend/fluxo-caixa-motor.ts`, com `receitaBrutaVgv = vgvTotal − vgvPermutaFisica`. Isso é o
**VGV vendável** — grandeza de contratação, sem juros — e não a soma dos recebimentos que o nome
promete. O próprio código o marca como "informativo; não altera o fluxo".

**Comportamento esperado.** Nomes e campos derivados explícitos, sem quebrar consumidores:

| Grandeza | Significado |
|---|---|
| VGV potencial | produto antes da permuta física |
| VGV vendável | potencial menos permuta física |
| Vendas contratadas | valor fechado, sem juros futuros |
| Juros recebidos | remuneração financeira dos clientes |
| Receita Bruta — VGV | soma dos recebimentos dos clientes |

**Escopo.** Inventariar usos de `vgvTotal`, `receitaBrutaVgv`, `receitaTotal` e equivalentes; propor
campos novos e aliases de compatibilidade; atualizar nomenclatura funcional; definir depreciação
gradual; **documentar a base de cada custo percentual**.

**Fora de escopo.** Implementar juros e carteiras. Remover campo público sem transição. Renomear no
banco por estética.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, telas de KPI e Fluxo, `frontend/exportar.ts`.

**Impacto em estudos existentes.** Nomenclatura e KPIs mudam de rótulo; os números só mudam onde a
base estava errada (EVI-008). **Migração:** não.

**Critérios de aceite.**
- [ ] Cada KPI informa sua base.
- [ ] Contratação e recebimento não compartilham nome ambíguo.
- [ ] Consumidores atuais continuam funcionando ou recebem adapter explícito.
- [ ] Exportações identificam cada grandeza.
- [ ] **Custos percentuais não mudam de base silenciosamente.**
- [ ] Documentação e interface usam a mesma taxonomia.

**Testes mínimos.** Compatibilidade dos objetos de cálculo; KPIs; CSV/PDF; cenários; análise de
mercado que consome preço/VGV; comparação antes/depois em estudo sem juros.

**Dependências.** EVI-008. **Documentação afetada.** `padrao-incorporacao.md` §14, §19.1.

---

## EVI-010 — Contrato canônico de pagamento por Grupo

**Título:** `refactor(receitas): contrato canônico de pagamento por Grupo, sem quebrar o JSON legado`
**Label:** `enhancement` · **Prioridade:** P1 · **Classe:** P3/M2 · **Risco:** alto

**Contexto.** O padrão precisa representar explicitamente pagamento à vista, tabela curta e tabela
longa, com os parâmetros de cada modalidade.

**Comportamento atual confirmado.** `avancado_fases.fluxo_pagamento` é JSON livre com `comissao`,
`ret`, **`entrada` e `parcelas` como listas** de linhas percentuais e `repasse.apos_entrega_meses`.
`receitaMensalLinha` normaliza ad-hoc (`normalizarLinhasPagamento`) e **rateia valor nominal**: não
há modalidade, sinal, prazo fixo, taxa de juros ao cliente nem saldo.

**Comportamento esperado.** Contrato canônico de domínio consumido pelo motor, com leitura
compatível dos dados atuais. Por Grupo: % à vista sobre vendas pré-entrega; % de tabela curta; % de
tabela longa derivado ou validado; sinal da curta; prazo fixo de 36 meses; % da longa pago durante a
Obra; % destinado ao repasse; taxa de juros ao cliente; regras posteriores à entrega.

**Estratégia conservadora.** Definir o shape canônico em função pura → criar normalizador dos dados
atuais → preservar leitura das formas legadas → só alterar persistência se o ganho justificar a
migração → **não remover suporte legado no mesmo PR** em que o shape novo entra.

**Fora de escopo.** Implementar as fórmulas financeiras (EVI-012 a EVI-016). UI definitiva sem
contrato aprovado. Normalizar em tabelas por preferência.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, `frontend/fluxo-shared.ts`, modal de fluxo
de pagamento, possivelmente `schema.json` + migração.

**Impacto em estudos existentes.** Alto se houver escrita nova. **Migração:** possível — decidir com
EVI-002. Se houver migração, **bumpar a `versao`**; se não houver, **não bumpar**.

**Critérios de aceite.**
- [ ] Existe tipo/contrato de domínio único para o motor.
- [ ] Dados atuais são normalizados sem perda.
- [ ] Percentuais inválidos geram erro explicativo.
- [ ] À vista + curta + longa fecham 100% na base aplicável.
- [ ] A regra Após-chaves pode ignorar o financiamento direto para novas vendas.
- [ ] O contrato distingue taxa, prazo, sinal, componente Obra e repasse.
- [ ] Duplicação de estudo preserva a configuração.

**Testes mínimos.** Shape atual com listas; shape legado com objeto único; shape canônico novo;
percentuais residuais; ausência de configuração; configuração inválida; round-trip se houver
persistência nova.

**Dependências.** EVI-001 e EVI-002. **Documentação afetada.** `padrao-incorporacao.md` §11,
`modelo-de-dados.md`.

---

## EVI-011 — Horizonte derivado de todos os eventos financeiros

**Título:** `fix(fluxo): derivar o horizonte de todos os eventos financeiros e remover o fallback`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2 · **Risco:** médio

**Contexto.** O horizonte não pode truncar recebíveis nem concentrar no último mês valores que
ultrapassariam o array. Isso muda economicamente o fluxo e mascara erro de dimensionamento.

**Comportamento atual confirmado — os dois defeitos existem.**

1. A derivação é `prazoDerivado = Math.max(ultimoCrono + maxRepasse, ultimoCustos, 11) + 1`, em
   `frontend/fluxo-caixa-motor.ts`: considera cronograma, custos e folga de repasse, mas **não** as
   parcelas.
2. O depósito tem fallback explícito:
   `else if (saida.length > 0) saida[saida.length - 1] += valor; // proteção de horizonte`.
   Todo recebimento que não cabe é **empilhado no último mês**.

**Comportamento esperado.** O último mês é o máximo entre fim do Após-chaves, última parcela da
última safra curta, último recebimento do componente Obra, mês do repasse, fim da manutenção, último
custo, quitação do financiamento à produção e quitação de capital de giro/investidor quando
aplicável.

**Escopo.** Função pura de derivação do horizonte; **remover o fallback silencioso**; prazo
explícito válido só se validado como suficiente ou usado para visualização, nunca para truncar
cálculo; erro visível quando um evento ficar fora do horizonte.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` (`deposita` e derivação de `prazo`) e testes.

**Impacto em estudos existentes.** **Muda resultado** de qualquer estudo que hoje empilha valor no
último mês. **Migração:** não.

**Critérios de aceite.**
- [ ] Nenhum recebimento é deslocado para o último mês por falta de espaço.
- [ ] A última parcela da tabela curta aparece no mês correto.
- [ ] A carteira termina em zero.
- [ ] Dívidas terminam em zero.
- [ ] A visão anual cobre todos os meses.
- [ ] O horizonte reage a mudanças de cronograma e de pagamento.

**Testes mínimos.** Tabela curta originada no último mês pré-entrega; manutenção maior que
Após-chaves; financiamento com prazo longo; repasse após a Obra; cenário sem recebíveis longos;
prazo explícito insuficiente.

**Dependências.** EVI-001 e EVI-010. **É portão para EVI-012 e EVI-013.**

**Documentação afetada.** `padrao-incorporacao.md` §18.2, §18.4.

---

## EVI-012 — Tabela curta com sinal, 36 parcelas e juros por safra

**Título:** `feat(receitas): tabela curta com sinal, 36 parcelas e juros por safra`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** alto

**Contexto.** A tabela curta é financiamento direto com sinal no mês da venda, principal
remanescente, 36 parcelas a partir do mês seguinte e juros. Cada mês de contratação gera uma safra.

**Comportamento atual confirmado.** Inexistente. `receitaMensalLinha` rateia valor nominal por
percentuais de entrada e parcelas.

**Comportamento esperado.**

```text
valor_curta = valor_contratado_prazo × participação_curta
sinal       = valor_curta × percentual_sinal
principal   = valor_curta − sinal
parcela     = PMT(taxa_mensal; 36; principal)     — 1ª parcela em mês_venda + 1

juros_t     = carteira_anterior × taxa_mensal
carteira_t  = carteira_anterior + juros_t − parcelas_t + novo_principal_t
```

A ordem importa: o novo principal não recebe juros antes de completar seu primeiro período.

**Escopo.** Gerar safras mensais; calcular sinal e parcelas; consolidar recebimentos; expor
principal, juros e saldo; abertura por Grupo e tipologia sem duplicar lógica; precisão e
arredondamento definidos.

**Fora de escopo.** Tabela longa. Repasse. Carteira consolidada (EVI-016).

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` e testes.

**Impacto em estudos existentes.** Alto — muda o perfil de recebimento. **Migração:** ver EVI-010.

**Critérios de aceite.**
- [ ] Cada safra paga exatamente 36 parcelas, a 1ª no mês seguinte.
- [ ] O sinal ocorre no mês da contratação.
- [ ] Principal + juros reconciliam com os recebimentos.
- [ ] A carteira nunca fica negativa e zera após a última parcela.
- [ ] Vendas Após-chaves não criam nova tabela curta.

**Testes mínimos.** Uma safra; safras consecutivas; taxa zero; sinal zero e elevado; contratação no
último mês pré-entrega; arredondamento da 36ª parcela; horizonte dinâmico; fixture dourada.

**Dependências.** EVI-008, EVI-010 e EVI-011. **Documentação afetada.** `padrao-incorporacao.md` §13.3.

---

## EVI-013 — Componente Obra da tabela longa por safra

**Título:** `feat(receitas): componente Obra da tabela longa por safra`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** alto

**Contexto.** A tabela longa não tem sinal: parte é paga durante a Obra e parte fica para o repasse.
No componente Obra a 1ª parcela ocorre no mês da contratação e o prazo depende dos meses restantes
até a entrega — safras antigas têm prazo maior, safras próximas da entrega têm parcelas maiores.

**Comportamento atual confirmado.** Inexistente. As parcelas "ao longo da obra" são ancoradas no
cronograma da Obra e são **independentes do mês da venda** — o oposto do modelo por safra.

**Comportamento esperado.**

```text
componente_obra    = valor_longa × percentual_pago_durante_obra
prazo_safra        = meses entre contratação e entrega, conforme a convenção adotada
parcela_safra      = PMT(taxa_mensal; prazo_safra; componente_obra)

saldo_antes_parcela = carteira_anterior + novo_principal
juros_t             = saldo_antes_parcela × taxa_mensal
carteira_t          = saldo_antes_parcela + juros_t − parcela_t
```

**Escopo.** Prazo por safra; PMT; consolidação das parcelas; exposição de principal, juros e saldo;
encerramento do componente na entrega.

**Fora de escopo.** Saldo a repassar (EVI-014). Carteira consolidada (EVI-016). Financiamento à
produção.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` e testes.

**Impacto em estudos existentes.** Alto. **Migração:** ver EVI-010.

**Critérios de aceite.**
- [ ] O prazo varia conforme o mês da venda; a 1ª parcela ocorre no mês da venda.
- [ ] Nenhuma parcela ocorre depois da entrega.
- [ ] Cada safra fecha corretamente e a carteira do componente Obra termina em zero.
- [ ] Taxa zero e prazos curtos funcionam.
- [ ] Venda no último mês pré-entrega não gera prazo inválido.

**Testes mínimos.** Venda no Pré-lançamento, no Lançamento, durante a Obra e no último mês
pré-entrega; múltiplas safras; taxa zero; reconciliação principal/juros; fixture dourada.

**Dependências.** EVI-008, EVI-010 e EVI-011. **Documentação afetada.** `padrao-incorporacao.md` §13.4.

---

## EVI-014 — Saldo a repassar capitalizado e liquidação integral

**Título:** `feat(receitas): saldo a repassar capitalizado e liquidação integral`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** alto

**Contexto.** O repasse não é um vencimento residual: ele liquida uma carteira acumulada de
contratos da tabela longa.

**Comportamento atual confirmado.** É exatamente um vencimento residual. `receitaMensalLinha` calcula
`mesRepasse = fimObra + apos_entrega_meses` e deposita ali o percentual derivado
(`pctRepasseDerivado`), **sobre valor nominal**, sem saldo nem juros acumulados.

**Comportamento esperado.**

```text
novo_repassar     = valor_longa × percentual_destinado_ao_repasse
saldo_antes_juros = saldo_anterior + novo_repassar
juros_t           = saldo_antes_juros × taxa_mensal
saldo_atualizado  = saldo_antes_juros + juros_t
```

No primeiro mês Após-chaves: `repasse = saldo_atualizado` e `saldo_final = 0`.

**Escopo.** Saldo mensal por safra ou consolidação equivalente; capitalização de juros; liquidação
em evento único; exposição de principal, juros, repasse e saldo; garantir ausência de antecipação;
garantir que novas vendas Após-chaves não criem saldo.

**Fora de escopo.** Financiamento à produção. Repasse parcial. Antecipação de recebíveis (fora do
backlog por decisão do autor).

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` e testes.

**Impacto em estudos existentes.** Alto. **Migração:** ver EVI-010.

**Critérios de aceite.**
- [ ] O repasse ocorre em um único mês — o primeiro Após-chaves — e corresponde ao saldo atualizado.
- [ ] O saldo zera imediatamente e permanece zero.
- [ ] Não há novas contratações de repasse depois da entrega.
- [ ] O repasse aparece como **recebimento de cliente**, não funding.

**Testes mínimos.** Uma safra; múltiplas safras; taxa zero; venda no último mês pré-entrega;
primeiro mês Após-chaves; ausência de antecipação; distinção do financiamento à produção; fixture
dourada.

**Dependências.** EVI-013. **Documentação afetada.** `padrao-incorporacao.md` §13.5.

---

## EVI-015 — Novas vendas Após-chaves recebidas à vista

**Título:** `fix(receitas): novas vendas Após-chaves recebidas à vista no mês da contratação`
**Label:** `bug` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** alto para estudos atuais

**Contexto.** Depois da entrega a incorporadora não concede novo financiamento direto no padrão
adotado. A operação pode combinar entrada do comprador e financiamento bancário, mas ambos chegam no
mesmo mês para a incorporadora. Isso **não** elimina recebimentos de contratos antigos.

**Comportamento atual confirmado.** Não há distinção entre venda pré e pós-entrega: o mesmo fluxo de
pagamento do Grupo é aplicado a toda venda, inclusive às que ocorrem depois da entrega.

**Comportamento esperado.**

```text
receita_do_mes      = valor_contratado_da_venda
nova_carteira_curta = 0
nova_carteira_longa = 0
novo_saldo_repassar = 0
```

No mesmo mês ainda podem existir parcelas de tabela curta contratadas antes da entrega, a liquidação
do repasse e outros recebimentos antigos.

**Escopo.** Identificar o mês de contratação em relação à entrega; ignorar o financiamento direto do
Grupo para vendas posteriores; preservar recebíveis de contratos anteriores; abrir corretamente por
Grupo e tipologia.

**Fora de escopo.** Alterar a absorção de 12 meses (EVI-007). Alterar contratos anteriores. Modelar
o financiamento bancário do comprador em duas entradas.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` e testes.

**Impacto em estudos existentes.** Alto para estudos com venda pós-entrega. **Migração:** não.

**Critérios de aceite.**
- [ ] Nova venda Após-chaves entra integralmente no mesmo mês.
- [ ] Não gera sinal futuro, parcela nem repasse.
- [ ] Parcelas antigas continuam normalmente.
- [ ] O mês do repasse pode conter repasse antigo **e** nova venda à vista.
- [ ] A contratação continua registrada separadamente e a corretagem fica no mês da venda.

**Testes mínimos.** Venda no último mês antes da entrega; no primeiro mês Após-chaves; no último dos
12 meses; coexistência com parcela curta antiga; coexistência com repasse; Grupo com fluxo
financiado pré-entrega.

**Dependências.** EVI-007, EVI-008 e EVI-010. **Documentação afetada.** `padrao-incorporacao.md`
§8.4, §13.6.

---

## EVI-016 — Carteira econômica real de clientes

**Título:** `feat(fluxo): carteira econômica real de clientes por componente`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** alto

**Contexto.** O estudo precisa mostrar quanto os compradores ainda devem à incorporadora, de forma
econômica, reconciliada e nunca negativa.

**Comportamento atual confirmado.** Inexistente — não há nenhum conceito de saldo devedor de cliente
no motor.

**Comportamento esperado.**

```text
carteira_total = carteira_curta + carteira_longa_obra + saldo_repassar
```

com os componentes visíveis para diagnóstico e um indicador consolidado único.

**Escopo.** Consolidar os saldos das tabelas curta e longa; expor séries mensais; calcular carteira
máxima e o mês de ocorrência; validar não negatividade; zerar cada componente no momento correto;
abrir por Grupo quando matematicamente seguro.

**Fora de escopo.** Inadimplência, distratos e securitização (fora do backlog por decisão do autor).
"Carteira legado" negativa.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, KPIs do Fluxo, e testes.

**Impacto em estudos existentes.** Adiciona séries; não muda o caixa por si só. **Migração:** não.

**Critérios de aceite.**
- [ ] Carteira total é a soma exata dos componentes.
- [ ] Nenhum componente fica negativo além da tolerância de arredondamento.
- [ ] Curta zera após a última parcela; componente Obra zera na entrega; saldo a repassar zera no repasse.
- [ ] Carteira total zera ao fim do fluxo.
- [ ] Carteira máxima é calculada a partir da série mensal real.

**Testes mínimos.** Cada componente isolado; combinação dos três; taxa zero; arredondamento final;
venda Após-chaves; horizonte completo; fixture dourada.

**Dependências.** EVI-012, EVI-013 e EVI-014. **Documentação afetada.** `padrao-incorporacao.md`
§13.7, §19.1.

---

## EVI-017 — Receita Bruta — VGV formada pelos recebimentos

**Título:** `feat(receitas): Receita Bruta — VGV formada pelos recebimentos, com juros`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2/U1 · **Risco:** alto — altera números e nomenclatura

**Contexto.** No padrão aprovado, `Receita Bruta — VGV = soma de todos os recebimentos dos clientes`,
juros incluídos — e pode superar as vendas contratadas.

**Comportamento atual confirmado.** `receitaBrutaVgv = vgvTotal − vgvPermutaFisica` (#188), que é o
**VGV vendável**: uma grandeza de contratação, sem juros, marcada no código como "informativo; não
altera o fluxo". O nome exibido promete o conceito do padrão e entrega outro.

**Comportamento esperado.** Composição: recebimentos à vista, sinais, parcelas de tabela curta,
parcelas do componente Obra da tabela longa, repasse, novas vendas Após-chaves à vista e os juros
embutidos nessas séries. **Exclui** liberação de financiamento à produção, capital de giro, aporte
de investidor, permuta física e qualquer funding.

**Invariante.**

```text
Receita Bruta — VGV = vendas contratadas acumuladas + juros recebidos acumulados
```

pressupondo que toda contratação vendável seja recebida até o fim do horizonte.

**Escopo.** Série e total canônicos; separar principal recebido de juros recebidos; reconciliar com
vendas contratadas; atualizar KPI e linhas de resultado; **preservar aliases atuais durante a
transição**; definir a base dos percentuais de custo sem mudança silenciosa.

**Fora de escopo.** Remover campos públicos sem transição.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, KPIs, `frontend/exportar.ts`.

**Impacto em estudos existentes.** **Alto** — o KPI muda de valor. Comunicar. **Migração:** não.

**Critérios de aceite.**
- [ ] O total é a soma das séries mensais de clientes; funding não entra.
- [ ] Juros aparecem separadamente.
- [ ] Estudo com taxa zero fecha `Receita Bruta = vendas contratadas`.
- [ ] Estudo com juros apresenta Receita Bruta superior.
- [ ] Grupo e tipologia fecham com o total.
- [ ] KPI, tabela, cenários e exportação usam a mesma fonte.

**Testes mínimos.** Só à vista; só curta; só longa; combinação; taxa zero; Após-chaves; repasse;
reconciliação total; fixture dourada.

**Dependências.** EVI-008 e EVI-012 a EVI-016. **Documentação afetada.** `padrao-incorporacao.md`
§14.

---

## EVI-018 — Permuta financeira bruta e líquida no regime de caixa

**Título:** `feat(terreno): permuta financeira bruta e líquida no regime de caixa`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** médio a alto

**Contexto.** A permuta financeira sai do caixa no mesmo mês em que a incorporadora recebe a receita
correspondente, e o estudo precisa das duas visões: sem e com descontos de imposto e corretagem.

**Comportamento atual confirmado — parte já entregue.** A #195 fez a permuta física reduzir unidades
vendidas, VGV e Resultado no Avançado; a #196 fez a permuta financeira do Terreno ser deduzida da
receita. O que existe é **uma visão só** — a dedução aplicada ao fluxo. As duas séries paralelas não
são calculadas nem expostas.

**Comportamento esperado.**

```text
permuta_bruta_t   = receita_caixa_t × percentual_permuta

base_liquida_t    = receita_caixa_t − imposto_dedutivel_t − corretagem_dedutivel_t
permuta_liquida_t = base_liquida_t × percentual_permuta
```

Imposto e corretagem devem ser calculados explicitamente em valor — evitar desconto multiplicativo
quando o contrato determina subtração direta.

**Escopo.** Calcular as duas séries; identificar as regras contratuais existentes; **declarar qual
série alimenta o fluxo**; expor ambas para auditoria; preservar a diferenciação
residencial/não residencial que o modelo já tem.

**Fora de escopo.** Redesenhar a permuta física (fora do backlog por decisão do autor). Alterar o
regime tributário geral. Valor presente da permuta.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, tela de Custos → Terreno.

**Impacto em estudos existentes.** Médio — depende de qual série passar a alimentar o fluxo.
**Migração:** não.

**Critérios de aceite.**
- [ ] As duas visões são calculadas em todos os meses com receita.
- [ ] O pagamento acompanha o **caixa**, não a contratação.
- [ ] Imposto e corretagem dedutíveis são identificáveis.
- [ ] O valor usado no fluxo é explícito.
- [ ] O total mensal fecha com o total do empreendimento.
- [ ] Taxa zero de permuta gera série zero.

**Testes mínimos.** Sem deduções; só imposto; só corretagem; ambas; receita com juros; repasse;
venda Após-chaves; segmentos residencial e não residencial.

**Dependências.** EVI-008 e EVI-017. **Documentação afetada.** `padrao-incorporacao.md` §15.2.

---

## EVI-019 — Integrar (ou remover) o financiamento à produção

**Título:** `feat(funding): integrar (ou remover) o financiamento à produção`
**Label:** `bug` · **Prioridade:** P3 · **Classe:** M2/P3 · **Risco:** muito alto

**Contexto.** Financiamento à produção é dívida da incorporadora para financiar custos elegíveis, e
deve permanecer totalmente separado do repasse.

**Comportamento atual confirmado — feature invisível.** Os cinco parâmetros **existem em duas
pontas** e não têm efeito nenhum:

- `schema.json` declara `financiamento_obra_pct`, `financiamento_juros_aa`,
  `financiamento_sistema_amortizacao`, `financiamento_prazo_meses`, `financiamento_carencia_meses`;
- `frontend/tela-financeiro.ts` renderiza os controles correspondentes;
- **`frontend/fluxo-caixa-motor.ts` não contém nenhuma referência a `financiamento_*`.**

O usuário preenche campos que não alteram o fluxo, sem aviso. Isso viola a convenção do monorepo de
que **UI e API andam sempre juntas**.

> **Esta issue é, antes de tudo, uma decisão.** Há duas saídas legítimas — integrar ao fluxo mensal,
> ou remover as duas pontas. Manter como está não é opção. O escopo abaixo cobre o caminho
> "integrar"; se o autor escolher remover, a issue vira U1/P3 e encolhe drasticamente.

**Comportamento esperado (caminho integrar).**

```text
custo_financiavel_acumulado  = soma dos custos elegíveis incorridos
percentual_incorrido         = custo_financiavel_acumulado / custo_financiavel_total
liberacao_desejada_acumulada = percentual_financiado × custo_financiavel_acumulado

liberacao_t = liberacao_desejada_acumulada − liberacoes_anteriores
juros_t     = saldo_anterior × taxa_mensal
saldo_t     = saldo_anterior + liberacao_t + juros_t − amortizacao_t
```

com liberação condicionada a exposição mínima, período elegível, percentual financiado e limite da
linha.

**Escopo.** Auditar os parâmetros existentes; definir custos elegíveis; implementar gatilho e
liberações; calcular juros; política de amortização; expor saldo e endividamento máximo; separar
fluxo livre de fluxo após funding; garantir quitação final.

**Fora de escopo.** Confundir repasse com liberação bancária. Inventar contrato bancário não
informado. Antecipação de repasse. Tratar funding como Receita Bruta.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts`, `frontend/tela-financeiro.ts`, `schema.json`
e migração se os campos não bastarem.

**Impacto em estudos existentes.** **Muito alto** — estudos com os campos preenchidos passam a ter
fluxo diferente. **Migração:** possível; se houver, **bumpar a `versao`**.

**Critérios de aceite.**
- [ ] A liberação depende de custo elegível incorrido.
- [ ] Funding aparece em linhas separadas e **a Receita Bruta não muda ao tomar dívida**.
- [ ] Juros financeiros são identificáveis.
- [ ] O repasse pode gerar caixa para amortização sem ser classificado como funding.
- [ ] O saldo final da dívida é zero e o endividamento máximo é calculado.
- [ ] Fluxo livre e fluxo final reconciliam.

**Testes mínimos.** Sem financiamento; exposição mínima não atingida; primeira liberação; várias
liberações; amortização antecipada se suportada; quitação no repasse; taxa zero; limite de
financiamento; horizonte final.

**Dependências.** EVI-001, EVI-011 e EVI-017. **Documentação afetada.** `padrao-incorporacao.md`
§17, Anexo B.

---

## EVI-020 — Invariantes e relatório de reconciliação

**Título:** `feat(fluxo): invariantes e relatório de reconciliação`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2/testes · **Risco:** baixo no cálculo, alto valor operacional

**Contexto.** Um motor financeiro robusto tem de provar que fechou; TIR e VPL não bastam.

**Comportamento atual confirmado.** Existem invariantes pontuais — conservação da Proforma,
fechamento de estoque, conservação de receita, repasse derivado, zeramento de saldos de centavo.
**Não existe** função de validação da saída do motor nem relatório de reconciliação.

**Comportamento esperado.** Invariantes mínimos: **produto** (alocações ≤ estoque vendável, estoque
mensal ≥ 0, estoque final = 0 quando absorção = 100%); **contratação** (`vendas contratadas =
Σ área × preço`); **receita** (`Receita Bruta = Σ recebimentos mensais = contratação + juros`);
**carteira** (componentes nunca negativos, cada um fecha no momento correto, total final zero);
**repasse** (ocorre uma vez, zera o saldo, não é funding); **dívida** (saldo final zero, fluxo final
reconciliado).

**Escopo.** Função pura de validação da saída do motor, retornando código, severidade, esperado,
encontrado, diferença e mensagem; integração aos testes; alertas úteis na UI em etapa compatível.

**Arquivos prováveis.** Novo módulo puro ao lado de `frontend/fluxo-caixa-motor.ts`, e testes.

**Impacto em estudos existentes.** Nenhum (diagnóstico). **Migração:** não.

**Critérios de aceite.**
- [ ] Cada invariante tem teste de sucesso e de falha.
- [ ] As mensagens identificam linha e mês.
- [ ] Erro de implementação é distinguido de premissa agressiva.
- [ ] As tolerâncias numéricas são explícitas.
- [ ] O relatório pode ser exportado ou inspecionado em modo diagnóstico.

**Testes mínimos.** Estoque negativo; receita não conservada; carteira residual; repasse incompleto;
dívida aberta; diferença de centavos dentro e fora da tolerância; cenário totalmente válido.

**Dependências.** EVI-012 a EVI-019, podendo começar incrementalmente antes de todas fecharem.

**Documentação afetada.** `padrao-incorporacao.md` §21.

---

## EVI-021 — Fluxo de Caixa, KPIs e exportações

**Título:** `feat(fluxo): exibir contratação, juros, carteiras, repasse e funding`
**Label:** `enhancement` · **Prioridade:** P3 · **Classe:** U1/M2 · **Risco:** médio

**Contexto.** Depois que o motor produzir as novas séries, a aplicação precisa apresentá-las sem
misturar conceitos.

**Comportamento atual confirmado.** A tabela e as exportações seguem o vocabulário e as linhas
atuais (`frontend/exportar.ts`), com as linhas de VGV da #188 e as views Mensal/Anual da #127.

**Hierarquia funcional esperada.**

```text
Vendas contratadas
 └── Grupo → Tipologia

Receita Bruta — VGV
 ├── À vista · Tabela curta · Tabela longa — Obra · Repasse · Juros

Carteira de clientes
 ├── Curta · Longa — Obra · Saldo a repassar

Funding
 ├── Liberação · Juros · Amortização · Saldo devedor
```

A organização visual pode ser adaptada ao design system, desde que as identidades econômicas fiquem
claras.

**Escopo.** Atualizar KPIs, tabela mensal e anual, hierarquia por Grupo e tipologia, gráficos, CSV e
PDF; exibir bases e tooltips; preservar o mesmo cálculo-base entre tela e exportação.

**Fora de escopo.** Recalcular indicadores na visão anual. Criar componente UrbiVerso inexistente.
Usar cor literal fora da exceção já documentada para impressão. Mudar motor dentro da camada de
apresentação.

**Arquivos prováveis.** `frontend/tela-fluxo-caixa.ts`, `frontend/exportar.ts`, KPIs.

**Impacto em estudos existentes.** Apresentação. **Migração:** não.

**Critérios de aceite.**
- [ ] Vendas contratadas e receita aparecem separadas; juros identificáveis.
- [ ] Carteira, repasse e financiamento à produção aparecem separados no fluxo.
- [ ] Mensal e anual fecham nos mesmos totais e os KPIs não mudam ao trocar de visão.
- [ ] CSV/PDF reproduzem os números da tela.
- [ ] A terminologia usa **Grupo** e **Após-chaves**.
- [ ] Primitivos e tokens respeitam o UrbiVerso.

**Testes mínimos.** Render com todas as séries; grupos colapsáveis; agregação anual; exportação CSV
e PDF; valores zero e negativos; números longos sem quebrar layout; guard de aspas curvas e
`scripts/validar-frontend.sh`.

**Dependências.** EVI-017, EVI-019 e EVI-020. **Documentação afetada.** `padrao-incorporacao.md`
§19, §22, `exportacao.md`.
