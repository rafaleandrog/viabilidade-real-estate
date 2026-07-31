# Issues EVI propostas — 2026-07-31

> ✅ **As 22 issues foram ABERTAS em 2026-07-31**, com autorização explícita do autor, após a 2ª
> auditoria que conferiu cada corpo contra o código. Correspondência abaixo. Este arquivo continua
> sendo a fonte dos corpos completos — a issue no GitHub traz o mesmo conteúdo.

> ⚠️ **12 corpos exigem emenda antes de serem implementados.** A revisão de recebíveis Calliandra
> (2026-07-31) derrubou premissas de #220, #227, #229, #230, #231, #232, **#233**, #234, #236,
> #237, #240 e #241. Os corpos abaixo continuam **como foram abertos**; as correções estão na seção
> [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação), ao final. **Não pegue nenhuma
> dessas issues pelo corpo antigo** — em especial a **#233**, cujo critério de aceite afirma o
> oposto da regra hoje aprovada. Nenhuma issue foi editada no GitHub: aplicar as emendas é decisão
> do autor.

| ID local | Issue | Título | Onda |
|---|---|---|:--:|
| EVI-001 | #220 | cenário dourado reconciliado mês a mês | 0 |
| EVI-002 | #221 | inventariar dados legados e compatibilidade | 0 |
| EVI-003 | #222 | Fase → Grupo na linguagem do usuário | 1 |
| EVI-004 | #223 | Pós-obra → Após-chaves na linguagem do usuário | 1 |
| EVI-005 | #224 | ancorar o início da Obra ao fim do Planejamento | 1 |
| EVI-006 | #225 | "Durante a obra" derivado após o Lançamento | 1 |
| EVI-007 | #226 | Após-chaves em 12 meses, desacoplada do cronograma | 1 |
| EVI-008 | #227 | série canônica de vendas contratadas | 2 |
| EVI-022 | #228 | desagregar deduções do recebível e derivar impostos | 2 |
| EVI-009 | #229 | taxonomia de VGV, contratação e receita | 2 |
| EVI-010 | #230 | contrato canônico de pagamento por Grupo | 2 |
| EVI-011 | #231 | horizonte derivado; remover o fallback | 2 |
| EVI-012 | #232 | tabela curta por safra | 3 |
| EVI-013 | #233 | componente Obra da tabela longa por safra | 3 |
| EVI-014 | #234 | saldo a repassar e liquidação integral | 3 |
| EVI-015 | #235 | vendas Após-chaves à vista | 3 |
| EVI-016 | #236 | carteira econômica real de clientes | 3 |
| EVI-017 | #237 | Receita Bruta formada pelos recebimentos | 3 |
| EVI-018 | #238 | permuta financeira bruta e líquida | 4 |
| EVI-019 | #239 | destino do Bloco G (aba Financeiro) | 4 |
| EVI-020 | #240 | invariantes e relatório de reconciliação | 5 |
| EVI-021 | #241 | fluxo, KPIs e exportações | 5 |

**Base de evidência:** `docs/rodada-5-evi-2026-07-31.md` (matriz de aderência).
**Labels:** só as existentes no repo — `bug` (comportamento errado hoje) e `enhancement`
(capacidade nova). Nenhuma taxonomia nova.
**Verificação de duplicidade:** 0 issues abertas antes desta rodada; 141 fechadas varridas. As
adjacentes (#165, #166, #168, #170, #188, #195, #196) entram citadas como histórico, não como
duplicata.

## Índice e ordem de abertura

| ID | Título sugerido | Label | Prioridade | Classe | Onda | Dependências |
|---|---|---|---:|---|:--:|---|
| EVI-001 | `test(fluxo): cenário dourado de Incorporação reconciliado mês a mês` | enhancement | P0 | M2/testes | 0 | — |
| EVI-002 | `chore(avancado): inventariar dados legados e estratégia de compatibilidade` | enhancement | P0 | P3 | 0 | — |
| EVI-003 | `fix(receitas): renomear Fase comercial para Grupo na linguagem do usuário` | enhancement | P1 | U1 | 1 | — |
| EVI-004 | `fix(cronograma): adotar Após-chaves na nomenclatura exibida` | enhancement | P1 | U1 | 1 | — |
| EVI-005 | `fix(cronograma): ancorar o início da Obra ao fim do Planejamento` | bug | P1 | M2 | 1 | 001, 002 |
| EVI-006 | `fix(absorcao): derivar "Durante a obra" após o Lançamento, sem sobrepor períodos` | bug | P1 | M2 | 1 | 005 |
| EVI-007 | `fix(absorcao): fixar a janela Após-chaves em 12 meses, desacoplada do evento de cronograma` | bug | P1 | M2/P3 | 1 | 001, 002, 005, 006 |
| EVI-008 | `feat(receitas): série canônica de vendas contratadas, separada do recebimento` | bug | P1 | M2 | 2 | 001 |
| **EVI-022** | `fix(fluxo): desagregar deduções do recebível e derivar impostos mensais` | bug | P1 | M2 | 2 | 001, 008 |
| EVI-009 | `refactor(receitas): explicitar VGV potencial, vendável, contratado e Receita Bruta` | enhancement | P1 | M2/U1 | 2 | 008, 022 |
| EVI-010 | `refactor(receitas): contrato canônico de pagamento por Grupo, sem quebrar o JSON legado` | enhancement | P1 | P3/M2 | 2 | 001, 002 |
| EVI-011 | `fix(fluxo): derivar o horizonte de todos os eventos financeiros e remover o fallback` | bug | P1 | M2 | 2 | 001, 010 |
| EVI-012 | `feat(receitas): tabela curta com sinal, 36 parcelas e juros por safra` | enhancement | P2 | M2 | 3 | 008, 010, 011 |
| EVI-013 | `feat(receitas): componente Obra da tabela longa por safra` | enhancement | P2 | M2 | 3 | 008, 010, 011 |
| EVI-014 | `feat(receitas): saldo a repassar capitalizado e liquidação integral` | enhancement | P2 | M2 | 3 | 013 |
| EVI-015 | `fix(receitas): novas vendas Após-chaves recebidas à vista no mês da contratação` | bug | P2 | M2 | 3 | 007, 008, 010 |
| EVI-016 | `feat(fluxo): carteira econômica real de clientes por componente` | enhancement | P2 | M2 | 3 | 012, 013, 014 |
| EVI-017 | `feat(receitas): Receita Bruta — VGV formada pelos recebimentos, com juros` | enhancement | P2 | M2/U1 | 3 | 008, 022, 012–016 |
| EVI-018 | `feat(terreno): permuta financeira bruta e líquida no regime de caixa` | enhancement | P2 | M2 | 4 | 008, 022, 017 |
| EVI-019 | `fix(financeiro): a aba Financeiro do Avançado não alimenta o motor — decidir o destino do Bloco G` | bug | P3 | M2/P3 | 4 | 001, 011, 017, 022 |
| EVI-020 | `feat(fluxo): invariantes e relatório de reconciliação` | enhancement | P2 | M2/testes | 5 | 012–019 |
| EVI-021 | `feat(fluxo): exibir contratação, juros, carteiras, repasse e funding` | enhancement | P3 | U1/M2 | 5 | 017, 019, 020 |

> **A ordem de execução não é a ordem numérica.** `EVI-022` foi criada depois, na segunda
> auditoria, mas executa na **Onda 2** — os IDs são ordem de criação, a coluna Onda é ordem de
> trabalho.

**Ajustes da 1ª auditoria sobre a lista original da instrução:**

- **EVI-005 encolheu** — o Pré-lançamento já foi ancorado pela #165; sobra só a Obra;
- **EVI-001 confirmada necessária** — nenhum dos 11 arquivos de teste do repo é cenário dourado;
- **EVI-008** ganhou o achado da corretagem incidindo sobre VGV bruto;
- **EVI-009/EVI-017** ganharam o caso concreto de `receitaBrutaVgv` já significar VGV vendável;
- **EVI-018** registra que #195 e #196 já entregaram parte do escopo.

**Ajustes da 2ª auditoria — conferência de cada corpo contra o código:**

Quatro issues tinham **premissa factualmente errada** e foram reescritas; cinco tinham lacuna de
dependência. A raiz de três delas é a mesma e virou issue própria.

- **EVI-022 é nova.** O recebível do Avançado **já é líquido** de comissão destacada e RET, dobrados
  num fator multiplicativo (`fator = vglLinha(vgv, fp) / vgv`). Isso quebrava a premissa de EVI-017,
  EVI-018 e EVI-019 ao mesmo tempo.
- **EVI-007 reescrita** — travar `pos_obra.duracao_meses` também travaria a duração de toda linha de
  custo ancorada nesse evento, porque `ancorarLinhaCusto` copia **início e duração**. A solução
  passa a ser desacoplar a janela comercial do evento de cronograma.
- **EVI-017 reescrita** — o critério "taxa zero fecha Receita Bruta = vendas contratadas" estava
  errado: hoje daria `contratação × (1 − comissão − RET)`.
- **EVI-018 reescrita** — consumia `imposto_dedutivel_t` e `corretagem_dedutivel_t`, que não existem
  como série mensal, e proibia o desconto multiplicativo que o app faz.
- **EVI-019 reescrita e ampliada** — não são 5 campos mortos, é **o Bloco G inteiro**.
- **EVI-008** ganhou a contagem dupla de corretagem; **EVI-005**, a `cronogramaPadrao()`;
  **EVI-006**, o caso do Lançamento terminando depois da Obra; **EVI-011**, um critério marcado
  como condicional; **EVI-007**, dependência de EVI-006.

---

## EVI-001 — Cenário dourado de Incorporação reconciliado mês a mês

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#220 / EVI-001`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **`cronogramaPadrao()` também tem de mudar.** O default do próprio app viola a regra:
> `planejamento` 0–5, `pre_lancamento` começa em 6, mas **`obra` começa em 17**. Sem corrigir essa
> função em `backend/rotas/avancado.ts`, todo estudo novo nasce fora da regra e a issue não fecha.
> Corrigir o default também desloca as âncoras de custo dos estudos novos — o que é o
> comportamento desejado, mas precisa estar nos testes.

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

> ⚠️ **O caso não coberto: Lançamento terminando DEPOIS do fim da Obra.** Nada hoje impede um
> Lançamento longo o bastante para ultrapassar a entrega. Nesse cenário "Durante a obra" fica vazia
> **e** o Após-chaves (ancorado em fim-da-Obra + 1 por EVI-007) **se sobrepõe ao Lançamento** — ou
> seja, reintroduz exatamente a sobreposição que esta issue existe para eliminar. A issue tem de
> decidir e testar uma das saídas: barrar a combinação na validação, ou truncar o Lançamento na
> entrega. Deixar implícito recria o defeito por outro caminho.

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

## EVI-007 — Fixar Após-chaves em 12 meses, desacoplada do evento de cronograma

**Título:** `fix(absorcao): fixar a janela Após-chaves em 12 meses, desacoplada do evento de cronograma`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2/P3 · **Risco:** alto para estudos existentes

**Contexto.** A regra aprovada define janela comercial fixa de 12 meses após a entrega.

**Comportamento atual confirmado.** O **início** já é o mês seguinte ao fim da Obra (`pos_obra`
travado em `recalcularTravados`). A **duração é livre e editável**: `faixasAbsorcao`, em
`frontend/fluxo-shared.ts`, calcula
`durPos = Math.max(1, Math.round(posObraMeses ?? pos.duracao_meses))`. Há estudos gravados com
duração diferente de 12. O default de `cronogramaPadrao()` já é 12.

> ⚠️ **O evento `pos_obra` tem DOIS papéis, e a issue original travava os dois.**
>
> Além de definir a janela comercial, `pos_obra` é **âncora válida de linha de custo**
> (`EVENTOS_ANCORA` em `backend/rotas/avancado.ts`), e `ancorarLinhaCusto` copia do evento **o
> início E a duração**:
>
> ```
> return { inicio_mes: ev.inicio_mes, duracao_meses: ev.duracao_meses };
> ```
>
> Travar `pos_obra.duracao_meses = 12` forçaria toda linha de custo ancorada nesse evento —
> tipicamente **manutenção e assistência técnica** — a exatamente 12 meses. O Doc 2 §8.2 separa
> justamente **Após-chaves** (12 meses de venda) de **Posterior** (parcelas, manutenção, dívida); o
> app usa um evento só para ambos.

**Comportamento esperado — desacoplar, não travar.** A janela comercial **Após-chaves** passa a ser
um conceito **derivado**, calculado pelo motor de absorção:

```text
inicio_apos_chaves  = fim da Obra + 1
duracao_apos_chaves = 12    (constante do padrão, não campo)
```

O evento `pos_obra` do cronograma **continua existindo com duração livre**, servindo de âncora de
custos pós-entrega. Os dois deixam de ser a mesma coisa.

Essa escolha resolve o conflito **sem migração de dados**: nenhum estudo precisa ter
`pos_obra.duracao_meses` reescrito, e as linhas de custo ancoradas continuam com a duração que
sempre tiveram. O que muda é só de onde a **absorção** tira sua janela.

**Escopo.** Derivar a janela Após-chaves no helper de absorção a partir do fim da Obra, ignorando
`pos_obra.duracao_meses`; remover o parâmetro de override `posObraMeses`; manter o evento
`pos_obra` editável no Cronograma, com rótulo que deixe claro que ali é **período de custos
pós-entrega**, não a janela de vendas; atualizar gráfico, validações e defaults.

**Alternativa considerada e descartada.** Travar `pos_obra.duracao_meses = 12` e criar um evento
novo para manutenção: exigiria migração, quebraria âncoras de custo existentes e criaria um sexto
evento no gantt sem ganho analítico.

**Fora de escopo.** Condição à vista para novas vendas (EVI-015). Repasse (EVI-014). Renomear rótulo
(EVI-004).

**Arquivos prováveis.** `frontend/fluxo-shared.ts`, tela de Cronograma, modal de absorção,
`backend/rotas/avancado.ts`, possível migração.

**Impacto em estudos existentes.** Alto no resultado — a janela de vendas muda em todo estudo cujo
`pos_obra.duracao_meses` ≠ 12. **Mas nenhuma linha de custo é afetada**, que era o risco escondido.
**Migração:** **não** — nenhum dado é reescrito.

**Compatibilidade obrigatória — a issue não pode ser implementada antes de responder:**
quantos estudos têm duração diferente de 12 (é o levantamento da EVI-002); se estudos **aprovados**
serão preservados ou recalculados; como ficam os cenários salvos.

**Critérios de aceite.**
- [ ] A janela de absorção Após-chaves tem 12 meses, começando no mês seguinte ao fim da Obra.
- [ ] A duração é **constante do motor**, não campo editável, e não há override.
- [ ] **Alterar `pos_obra.duracao_meses` no Cronograma não muda mais a absorção** — só as âncoras de custo.
- [ ] **Linha de custo ancorada em `pos_obra` mantém a duração que tinha**, testado explicitamente.
- [ ] A absorção residual fecha em 100% sobre os **quatro** períodos de EVI-006.
- [ ] Nenhum recebimento é truncado pelo horizonte (ver EVI-011).

**Testes mínimos.** Estudo novo; estudo legado com `pos_obra` de 24 meses (absorção passa a 12, custo
de manutenção segue 24); 100% vendido antes da entrega; 100% vendido Após-chaves; combinação de
percentuais; exportação e gráfico.

**Dependências.** EVI-001, EVI-002, EVI-005 e **EVI-006** — o critério do resíduo de 100% só faz
sentido depois que a absorção tiver quatro períodos.

**Documentação afetada.** `padrao-incorporacao.md` §8.5, §10.4, §16.2.

---

## EVI-008 — Série canônica de vendas contratadas

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#227 / EVI-008`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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
caixa. Custos com base `pct_receita` herdam essa base (`fluxo-shared.ts` →
`case 'pct_receita': (valor / 100) * (ctx.receitaTotal ?? ctx.vgvTotal)`).

**Segundo achado — corretagem pode ser contada duas vezes.** Ela existe em **dois lugares**:

1. `fluxo_pagamento.comissao` por Grupo — deduz o recebível **quando `tipo === 'destacada'`**;
2. a linha de custo **obrigatória** "Corretagem de vendas" em `diretos`, sempre `pct_vgv` (#121),
   criada automaticamente em todo estudo.

O default é `tipo: 'embutida'`, que **não** deduz — nesse caminho a conta fecha, porque só a linha
de custo conta. Mas ao marcar **Destacada** na tela, a corretagem passa a reduzir a receita **e**
continuar como custo: **contada duas vezes**. Esta issue tem de declarar onde a corretagem vive de
verdade e garantir uma fonte só; a mecânica de desagregação está em **EVI-022**.

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
- [ ] A corretagem usa a mesma série, com base declarada, e **existe em um só lugar** — marcar "Destacada" não pode dobrar o valor.
- [ ] Juros não entram na contratação.
- [ ] Permuta física não gera contratação de caixa.
- [ ] A visão anual soma os meses sem recalcular a lógica.

**Testes mínimos.** Uma tipologia em um Grupo; mesma tipologia em dois Grupos com preços
diferentes; vários Grupos com absorções diferentes; arredondamento de área e valor; corretagem com
e sem permuta física; estoque final.

**Dependências.** EVI-001. **Documentação afetada.** `padrao-incorporacao.md` §12, §16.3.

---

## EVI-022 — Desagregar deduções do recebível e derivar impostos mensais

**Título:** `fix(fluxo): desagregar deduções do recebível e derivar impostos mensais`
**Label:** `bug` · **Prioridade:** P1 · **Classe:** M2 · **Risco:** alto
**Onda: 2** (o número é maior porque nasceu na segunda auditoria, não porque executa depois)

**Contexto.** Um app de viabilidade precisa responder "quanto o cliente pagou" e "quanto disso
sobrou" como **duas grandezas separadas**. Hoje o Avançado só sabe a segunda: as deduções estão
dobradas dentro do recebível, e não existem como série.

**Comportamento atual confirmado.** Em `frontend/fluxo-caixa-motor.ts`:

```
fator     = vglLinha(vgv, linha.fluxo_pagamento) / vgv
recebivel = venda * fator
```

e `vglLinha`, em `frontend/fluxo-shared.ts`, subtrai do VGV a **comissão destacada** e o **RET**:

```
if (fp.comissao?.ativo && fp.comissao?.tipo === 'destacada') liquido -= vgv * (fp.comissao.pct / 100);
if (fp.ret?.ativo)                                            liquido -= vgv * (fp.ret.pct  / 100);
```

Consequências, todas verificadas:

1. **`receitaMensal` não é "recebimento do cliente"** — é recebimento já líquido de corretagem e
   RET. O Doc 1 §4.6 define Receita Bruta como a soma do que **o cliente paga**; a corretagem é
   desembolso do incorporador, não desconto na nota do comprador.
2. **Não existe série mensal de imposto nem de corretagem.** Elas nunca aparecem no fluxo como
   linha — só encolhem a receita por dentro.
3. **O desconto é multiplicativo**, aplicado sobre o VGV da linha, e não subtração explícita mês a
   mês sobre o caixa recebido.
4. **O regime tributário detalhado não participa.** O motor não lê `regime_tributario` nem
   `aliquota_pis/cofins/csll/irpj/itbi_pct`. O único imposto que existe no Avançado é o **RET por
   Grupo**, marcado no modal de Fluxo de Pagamento e **desligado por default**
   (`ret: { ativo: false }`). Ou seja: há **duas entradas fiscais concorrentes** no app — uma viva
   (o checkbox RET do Grupo) e uma morta (o bloco de regime da aba Financeiro).
5. Na Proforma (Preliminar) o imposto **é** calculado, de outra forma:
   `imposto = vgv × (sujeito_ret ? aliquota_ret_pct : imposto_percentual) / 100`. Preliminar e
   Avançado usam modelos fiscais diferentes para o mesmo empreendimento.

**Comportamento esperado.** O motor passa a produzir, por mês:

```text
recebimento_bruto_t     — o que o cliente pagou, sem nenhuma dedução
corretagem_t            — despesa comercial sobre a contratação do mês
imposto_t               — tributo sobre a receita do mês, conforme o regime
recebimento_liquido_t   = recebimento_bruto_t − corretagem_t − imposto_t
```

com `recebimento_bruto_t` alimentando a Receita Bruta (EVI-017) e `corretagem_t`/`imposto_t`
disponíveis como séries próprias para o fluxo, para a permuta financeira (EVI-018) e para os
relatórios (EVI-021).

**Escopo.**

- Remover o `fator` multiplicativo de `receitaMensalLinha`, mantendo o valor cheio no recebimento.
- Criar a série mensal de **corretagem**, resolvendo a duplicidade apontada em EVI-008: uma fonte
  só, com a outra desativada ou convertida.
- Criar a série mensal de **imposto**, decidindo explicitamente qual das duas entradas fiscais
  concorrentes é a oficial — o RET por Grupo ou o regime da aba Financeiro. **As duas não podem
  coexistir.**
- Reconciliar Preliminar e Avançado: ou compartilham a regra de imposto, ou a diferença fica
  documentada e justificada.
- Recalcular a base de `pct_receita` sobre a grandeza correta e declarar qual é.

**Fora de escopo.** Juros ao cliente e carteiras (EVI-012 a EVI-016). Financiamento à produção
(EVI-019). Alterar alíquotas ou criar regime novo — esta issue **liga** o que já existe, não
inventa tributo.

**Arquivos prováveis.** `frontend/fluxo-caixa-motor.ts` (`receitaMensalLinha`, `fator`),
`frontend/fluxo-shared.ts` (`vglLinha`, `resolverBase`), `frontend/tela-fluxo-receitas.ts` (modal de
pagamento), `frontend/tela-fluxo-custos.ts` (linha obrigatória de corretagem).

**Impacto em estudos existentes.** **Alto e visível.** A receita exibida sobe (passa a ser bruta) e
aparecem duas linhas de dedução novas. O **Resultado final não deve mudar** — se mudar, é sinal de
que havia contagem dupla ou ausente, e o caso tem de ser investigado, não acomodado.
**Migração:** não; é reinterpretação de cálculo, não de dado.

**Critérios de aceite.**
- [ ] `recebimento_bruto` de um Grupo sem juros é igual às suas vendas contratadas.
- [ ] Corretagem e imposto aparecem como séries mensais próprias, somando ao total do empreendimento.
- [ ] **Nenhuma dedução é aplicada em dois lugares** — marcar "Destacada" não muda o Resultado.
- [ ] Existe uma única entrada fiscal oficial no Avançado, e a outra foi removida ou migrada.
- [ ] O Resultado final de um estudo existente é **idêntico** antes e depois, ou a diferença está
      explicada como correção de defeito.
- [ ] A base de `pct_receita` está declarada e testada.
- [ ] Preliminar e Avançado usam a mesma definição de imposto, ou a divergência está documentada.

**Testes mínimos.** Comissão embutida; comissão destacada; RET ligado e desligado; os quatro
cruzamentos; estudo com permuta física (para pegar a base errada da EVI-008); custo em
`pct_receita`; comparação de Resultado antes/depois num estudo real; fixture dourada.

**Dependências.** EVI-001 e EVI-008. **É portão para EVI-017, EVI-018 e EVI-019.**

**Documentação afetada.** `docs/viabilidade/padrao-incorporacao.md` §11, §14, §15.2, §16.3,
Anexo A (C6).

---

## EVI-009 — Taxonomia de VGV, contratação, recebimento e juros

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#229 / EVI-009`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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
| Receita Bruta — VGV | soma dos recebimentos **brutos** dos clientes |
| Receita líquida | Receita Bruta menos corretagem e impostos |

> **A distinção bruto × líquido é o ponto sensível.** Hoje a única série de receita do Avançado já
> é líquida de comissão destacada e RET, dobradas num fator (ver EVI-022). Enquanto isso não for
> desagregado, "Receita Bruta" e "Receita líquida" não têm como ser nomes diferentes — são o mesmo
> número.

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

**Dependências.** EVI-008 e **EVI-022** — a taxonomia só é implementável depois que bruto e líquido
forem grandezas distintas no motor.

**Documentação afetada.** `padrao-incorporacao.md` §14, §19.1.

---

## EVI-010 — Contrato canônico de pagamento por Grupo

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#230 / EVI-010`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#231 / EVI-011`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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
- [ ] A visão anual cobre todos os meses.
- [ ] O horizonte reage a mudanças de cronograma e de pagamento.
- [ ] *(condicional — só verificável após EVI-019)* Dívidas terminam em zero.

> **Sobre o critério condicional.** A função de derivação deve **já prever** a quitação do
> financiamento à produção entre suas entradas, mas o critério só pode ser exercido quando existir
> dívida a quitar. Deixe o ponto de extensão pronto e o teste marcado como pendente — não remova a
> entrada da fórmula, senão EVI-019 terá de reabrir esta issue.

**Testes mínimos.** Tabela curta originada no último mês pré-entrega; manutenção maior que
Após-chaves; financiamento com prazo longo; repasse após a Obra; cenário sem recebíveis longos;
prazo explícito insuficiente.

**Dependências.** EVI-001 e EVI-010. **É portão para EVI-012 e EVI-013.**

**Documentação afetada.** `padrao-incorporacao.md` §18.2, §18.4.

---

## EVI-012 — Tabela curta com sinal, 36 parcelas e juros por safra

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#232 / EVI-012`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. **A premissa de primeiro vencimento deste corpo está errada** — ver a emenda. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#233 / EVI-013`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#234 / EVI-014`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#236 / EVI-016`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#237 / EVI-017`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

**Título:** `feat(receitas): Receita Bruta — VGV formada pelos recebimentos, com juros`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2/U1 · **Risco:** alto — altera números e nomenclatura

**Contexto.** No padrão aprovado, `Receita Bruta — VGV = soma de todos os recebimentos dos clientes`,
juros incluídos — e pode superar as vendas contratadas.

**Comportamento atual confirmado — dois problemas, não um.**

1. `receitaBrutaVgv = vgvTotal − vgvPermutaFisica` (#188) é o **VGV vendável**: grandeza de
   contratação, sem juros, marcada no código como "informativo; não altera o fluxo". O nome promete
   o conceito do padrão e entrega outro.
2. **A série de receita do fluxo também não serve de base.** `receitaMensal` já é **líquida** de
   comissão destacada e RET, dobradas no `fator` de `receitaMensalLinha`. Não é "recebimento do
   cliente" — o cliente paga o valor cheio, e a corretagem é desembolso do incorporador.

> ⚠️ **Por isso esta issue não é "somar juros na série existente".** Sem a desagregação da EVI-022,
> o invariante não fecha **nem com taxa zero**: daria
> `contratação × (1 − comissão − RET)`, não `contratação`.

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
- [ ] O total é a soma das séries mensais de recebimento **bruto**; funding não entra.
- [ ] Juros aparecem separadamente.
- [ ] Estudo com taxa zero fecha `Receita Bruta = vendas contratadas` — **exatamente**, sem o desconto de comissão/RET que existe hoje.
- [ ] Estudo com juros apresenta Receita Bruta superior às vendas contratadas.
- [ ] Corretagem e imposto aparecem como dedução **explícita**, não embutida na receita.
- [ ] Grupo e tipologia fecham com o total.
- [ ] KPI, tabela, cenários e exportação usam a mesma fonte.

**Testes mínimos.** Só à vista; só curta; só longa; combinação; taxa zero **com comissão destacada
ligada** (o caso que hoje quebraria o invariante); Após-chaves; repasse; reconciliação total;
fixture dourada.

**Dependências.** EVI-008, **EVI-022** e EVI-012 a EVI-016.

**Documentação afetada.** `padrao-incorporacao.md` §14.

---

## EVI-018 — Permuta financeira bruta e líquida no regime de caixa

**Título:** `feat(terreno): permuta financeira bruta e líquida no regime de caixa`
**Label:** `enhancement` · **Prioridade:** P2 · **Classe:** M2 · **Risco:** médio a alto

**Contexto.** A permuta financeira sai do caixa no mesmo mês em que a incorporadora recebe a receita
correspondente, e o estudo precisa das duas visões: sem e com descontos de imposto e corretagem.

**Comportamento atual confirmado — parte já entregue, mas a fórmula-alvo não tem insumo.** A #195
fez a permuta física reduzir unidades vendidas, VGV e Resultado no Avançado; a #196 fez a permuta
financeira do Terreno ser deduzida da receita. O que existe é **uma visão só**.

> ⚠️ **As duas séries que a fórmula consome não existem hoje.** `imposto_dedutivel_t` e
> `corretagem_dedutivel_t` não são produzidos pelo motor: corretagem e RET vivem dobrados no
> `fator` do recebível, e o regime tributário da aba Financeiro é ignorado. Além disso, o app faz
> **exatamente o desconto multiplicativo** que esta issue proíbe. Sem EVI-022 não há o que
> subtrair.

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

**Dependências.** EVI-008, **EVI-022** (fornece `imposto_t` e `corretagem_t` como séries) e EVI-017.

**Documentação afetada.** `padrao-incorporacao.md` §15.2.

---

## EVI-019 — A aba Financeiro do Avançado não alimenta o motor: decidir o destino do Bloco G

**Título:** `fix(financeiro): a aba Financeiro do Avançado não alimenta o motor — decidir o destino do Bloco G`
**Label:** `bug` · **Prioridade:** P3 · **Classe:** M2/P3 · **Risco:** muito alto

**Contexto.** Financiamento à produção é dívida da incorporadora para financiar custos elegíveis, e
deve permanecer totalmente separado do repasse. Mas o problema é maior do que o financiamento.

**Comportamento atual confirmado — a aba Financeiro inteira é inerte.** Não são cinco campos: é o
**Bloco G completo**. `backend/rotas/estudos.ts` os lista apenas como colunas persistíveis, e
`frontend/fluxo-caixa-motor.ts` **não referencia nenhum deles**:

| Grupo | Campos mortos |
|---|---|
| Financiamento à produção | `financiamento_obra_pct`, `_juros_aa`, `_sistema_amortizacao`, `_prazo_meses`, `_carencia_meses` |
| Estrutura de capital | `estrutura_capital_proprio_pct`, `_financiamento_pct`, `_investidores_pct` |
| Investidor | `investidor_aporte_valor`, `_retorno_tipo`, `_juros_aa`, `_carencia_meses`, `_parcelas` |
| Regime tributário | `regime_tributario`, `aliquota_pis/cofins/csll/irpj/itbi_pct`, `imposto_sobre_permuta_fisica` |
| Correção e juros | `indice_correcao`, `_taxa_aa`, `juros_financeiros_aa`, `juros_inicio_cobranca_mes` |

`frontend/tela-financeiro.ts` renderiza controles para todos. O usuário preenche uma aba inteira que
não altera número nenhum, sem aviso — violação frontal da convenção de que **UI e API andam sempre
juntas**.

> **Esta issue é, antes de tudo, uma decisão — e ela se divide.** O bloco **regime tributário** sai
> daqui: ele é insumo de EVI-022, que precisa escolher entre o regime da aba Financeiro e o RET por
> Grupo como entrada fiscal oficial. O que sobra para esta issue é **funding**: financiamento à
> produção, estrutura de capital, investidor e correção monetária.
>
> Para cada um dos quatro, a issue tem de escolher **integrar** ou **remover as duas pontas**.
> Manter como está não é opção. O escopo abaixo cobre o caminho "integrar" do financiamento à
> produção, que é o mais definido pelo Doc 1 §4.12; estrutura de capital, investidor e correção
> podem legitimamente ser removidos se não houver modelo aprovado para eles.

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

**Escopo.** Auditar os parâmetros existentes; **decidir, campo a campo, entre integrar e remover**;
definir custos elegíveis; implementar gatilho e liberações; calcular juros; política de amortização;
expor saldo e endividamento máximo; separar fluxo livre de fluxo após funding; garantir quitação
final. Todo campo que ficar sem implementação nesta issue **sai da tela**.

**Fora de escopo.** O bloco de **regime tributário** — ele pertence a EVI-022. Confundir repasse com
liberação bancária. Inventar contrato bancário não informado. Antecipação de repasse. Tratar funding
como Receita Bruta.

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
- [ ] **Nenhum campo do Bloco G continua na tela sem efeito no motor** — cada um foi implementado ou removido.
- [ ] O critério condicional de EVI-011 ("dívidas terminam em zero") passa a ser exercível e é exercido.

**Testes mínimos.** Sem financiamento; exposição mínima não atingida; primeira liberação; várias
liberações; amortização antecipada se suportada; quitação no repasse; taxa zero; limite de
financiamento; horizonte final.

**Dependências.** EVI-001, EVI-011, EVI-017 e **EVI-022** (que resolve o regime tributário antes).

**Documentação afetada.** `padrao-incorporacao.md` §17, Anexo B.

---

## EVI-020 — Invariantes e relatório de reconciliação

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#240 / EVI-020`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

> ⚠️ **Corpo publicado, com premissa superada.** A revisão de recebíveis Calliandra (2026-07-31) exige emenda antes da implementação desta issue. Texto proposto em [Emendas pendentes de aprovação](#emendas-pendentes-de-aprovação) → `#241 / EVI-021`. O corpo abaixo é preservado como registro do que foi aberto no GitHub.

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

---

# Emendas pendentes de aprovação

**Origem:** revisão de recebíveis por safras contra os dois EVIs de Calliandra, 2026-07-31.
Reconciliação completa em `docs/revisao-recebiveis-calliandra-2026-07-31.md`.

**Estado:** nenhuma issue foi aberta, fechada, editada ou comentada no GitHub. Os corpos acima
continuam sendo o que está publicado. Esta seção registra **o que precisa mudar em cada um** para
que a implementação não parta de premissa superada. Aplicar as emendas é decisão do autor.

**O total continua 22 issues, todas abertas, nenhuma implementada.** As ordens não negociáveis
permanecem: #220/#221 antes de qualquer M2 · #231 antes de #232/#233 · #228 antes de #237, #238 e
#239.

---

## #220 / EVI-001 — cenário dourado

**Emenda.** O escopo passa a exigir **dois** fixtures, não um:

1. **Calliandra prazo fixo** — 20% à vista com 5% de desconto, 13,3% em 36 parcelas, ~64,81% em
   120 parcelas, 15% de sinal nos parcelados, 15% a.a., primeira parcela em `s + 1`.
2. **Calliandra até Obra + repasse** — 15% de entrada, 15% em parcelas de `s + 1` até o mês 24,
   70% de repasse no mês 25, taxa zero.

**Inputs obrigatórios** (sem eles os valores esperados são números sem premissa):

```text
Cenário 1 — base R$ 28.601.115,20
  meses 1 a 4   → R$ 2.860.111,52 por mês
  meses 5 a 12  → R$ 2.145.083,64 por mês
  taxa mensal   = 1,15^(1/12) − 1 = 1,1714917% a.m.

Cenário 2 — base R$ 28.547.740,29
  meses 1 a 12  → R$ 2.378.978,36 por mês (uniforme)
  taxa          = zero
```

**Advertência que precisa entrar no corpo.** No cenário 1 as participações à vista, curta e longa
somam **98,1132%**. O restante — **1,8868%, exatamente 1 de 53 lotes** — é `Venda Casas`, com regra
própria (240 parcelas, 30% de sinal) que **não aparece nas colunas de receita do fluxo**. A fixture
precisa isolar a base das três modalidades ou modelar a quarta regra. **Não force um fechamento
artificial contra a linha agregada de `Vendas Contratadas`.**

**Valores mínimos de conferência.**

| Cenário 1 — mês | Receita | | Cenário 2 — mês | Receita |
|---:|---:|---|---:|---:|
| 1 | R$ 878.539,92 | | 1 | R$ 356.846,75 |
| 2 | R$ 914.119,61 | | 2 | R$ 372.361,83 |
| 3 | R$ 949.699,31 | | 3 | R$ 388.582,14 |
| 4 | R$ 985.279,01 | | 12 | R$ 582.045,90 |
| 13 | R$ 355.796,98 | | 13 a 24 | R$ 254.936,38 por mês |
| 38 | R$ 344.737,04 | | 25 | R$ 19.983.418,20 |
| 49 | R$ 245.197,58 | | | |
| 122 | R$ 220.677,83 | | | |
| 132 | R$ 18.389,82 | | | |
| 133 | R$ 0,00 | | | |

**Critério de aceite novo.** O teste identifica a primeira divergência por **linha, safra e mês**.

## #227 / EVI-008 — série canônica de contratação

**Emenda.** O escopo deixa de ser "uma série canônica" e passa a ser **três**:

- valor bruto contratado (`área contratada × preço/m²`);
- desconto comercial (série própria, não fator embutido);
- valor contratado líquido (`bruto − desconto`).

Acrescentar: **base única de corretagem**, declarada explicitamente como bruto **ou** líquido. A
mesma despesa não pode existir como dedução embutida no recebível **e** como linha de custo.

## #229 / EVI-009 — taxonomia

**Emenda.** A taxonomia passa a ter oito grandezas, não quatro:

VGV potencial · VGV vendável · valor bruto contratado · descontos · valor contratado líquido ·
principal recebido · juros · Receita Bruta.

## #230 / EVI-010 — contrato canônico de pagamento

**Emenda.** Substituir o contrato rígido (à vista / curta / longa) por **contrato de componentes**,
com quatro regras econômicas: **imediato**, **prazo fixo**, **até marco** e **concentrado em
marco**.

Campos mínimos de cada componente: participação · sinal · prazo ou marco · defasagem do primeiro
vencimento · periodicidade · taxa · **juros no mês da contratação** (default falso) · regra de
fechamento da última parcela.

O adapter do JSON legado continua obrigatório.

## #231 / EVI-011 — horizonte

**Emenda.** O horizonte passa a ser derivado de **todos os componentes e todas as safras** — não
apenas do cronograma e do repasse:

```text
fim do fluxo = máximo entre
  fim das vendas Após-chaves,
  última parcela de cada componente de prazo fixo,
  marco final de cada componente até marco,
  pagamento concentrado ou repasse,
  manutenção pós-obra, último custo, quitação de funding
```

O fallback que empilha excedente no último mês continua removido.

## #232 / EVI-012 — prazo fixo por safra

**Título proposto:** `feat(receitas): componentes de prazo fixo por safra, com sinal, juros e primeiro vencimento`

**Emenda.** Deixa de ser "tabela curta de 36" e passa a ser o **componente de prazo fixo
generalizado**. Escopo: curta de 36 · longa de 120 · primeiro vencimento em `s + 1` · PMT · taxa
zero · saldo por safra.

```text
principal_s     = valor do componente_s − sinal_s
primeiro venc.  = s + 1
último venc.    = s + N
parcela_s       = PMT(taxa mensal; N; principal_s)      — com juros
parcela_s       = principal_s ÷ N                        — sem juros
```

## #233 / EVI-013 — até marco por safra

**Título proposto:** `feat(receitas): componentes até marco por safra`

> 🔴 **Esta é a emenda crítica da rodada.** O corpo publicado afirma, no contexto e no primeiro
> critério de aceite, que *"a 1ª parcela ocorre no mês da venda"*. **A premissa está errada** e foi
> desmentida numericamente contra a planilha de Calliandra. Implementar a issue pelo corpo atual
> produz a regra errada com aparência de aderência ao documento.

**Correções obrigatórias:**

- remover a primeira parcela no mês da venda → **primeira parcela em `s + 1`**;
- remover `prazo da safra = último mês da Obra − mês da venda + 1` → **`N_s = M − s`**;
- venda tardia tem **menos** parcelas e parcela **maior**;
- suportar taxa zero (divisão simples) e PMT;
- **erro explícito quando `N_s ≤ 0`** — bloquear a configuração ou convertê-la, com decisão do
  usuário, em pagamento imediato ou concentrado. O motor não pode criar prazo negativo.

**Critério de aceite corrigido:**

- ~~[ ] O prazo varia conforme o mês da venda; a 1ª parcela ocorre no mês da venda.~~
- [ ] O prazo varia conforme o mês da venda (`N_s = M − s`); a **1ª parcela ocorre no mês seguinte**.

## #234 / EVI-014 — concentrado e repasse

**Título proposto:** `feat(receitas): pagamentos concentrados e repasse com saldo reconciliado`

**Emenda.** Acrescentar: taxa **zero ou positiva** · convenção de juros **explícita** · juros
começam, por padrão, **depois** da contratação (`saldo_s,s = principal_s`) · repasse no primeiro mês
Após-chaves · liquidação integral (`saldo final = 0`).

Com taxa zero, o repasse é apenas a soma dos principais.

## #236 / EVI-016 — carteira

**Emenda.** Exigir **saldos por safra e componente**. Proibir recorrência agregada sobre um saldo
único — é ela que produz carteira negativa e carteira que volta a crescer depois do último
pagamento (o defeito observado no arquivo Urbitá, que **não** deve ser copiado).

## #237 / EVI-017 — Receita Bruta

**Emenda.** Corrigir o invariante para as duas formas equivalentes:

```text
Receita Bruta = valor contratado líquido + juros
Receita Bruta = valor bruto − descontos + juros
```

A segunda forma é a que falha quando o desconto comercial não existe como série — por isso #227
antecede.

## #240 / EVI-020 — invariantes

**Emenda.** Acrescentar quatro invariantes:

- soma dos componentes da safra = valor contratado líquido da safra;
- saldo de cada safra = zero no último vencimento;
- nenhuma carteira volta a crescer depois do último pagamento;
- a divergência é reportada com **primeira linha, safra e mês**.

## #241 / EVI-021 — apresentação

**Emenda.** Acrescentar as linhas de apresentação: bruto · desconto · líquido · imediato · prazo
fixo · até marco · concentrado · principal · juros · carteira.

---

## Issues sem emenda

**#221, #222, #223, #224, #225, #226, #228, #235, #238, #239** seguem válidas com os corpos
publicados. A revisão não alterou nenhuma premissa delas.
