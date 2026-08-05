---
titulo: Padrão de Viabilidade — Incorporação
descricao: Documento funcional de como o app representa, organiza, calcula e apresenta um estudo de viabilidade de Incorporação — com contratação por safras, componentes de pagamento, carteiras e contraste explícito entre o comportamento vigente e o modelo funcional de referência.
tipo: app
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Padrão de Viabilidade — Incorporação

> **App:** Estudo de Viabilidade · **Ambiente:** UrbiVerso · **Tipo de empreendimento:** Incorporação (SIGLA `INC`)
>
> **Escopo principal:** dinâmica funcional do estudo avançado — produto, cronograma, Grupos comerciais, absorção, fluxo de pagamento, custos, funding, fluxo de caixa e resultados. Loteamento tem seu próprio conjunto de premissas e não é coberto aqui.

Este documento descreve **como o aplicativo representa funcionalmente** o conhecimento econômico definido em [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao).

Ele traduz conceitos de negócio em:

- entidades percebidas pelo usuário;
- telas e jornadas;
- relações entre informações;
- regras de cálculo e apresentação;
- validações funcionais;
- resultados e relatórios esperados.

Este documento **não é uma especificação de código**. Ele não determina linguagem, biblioteca, endpoint, nome de tabela, migração ou estratégia de implementação.

> ⚠️ **Status: documento funcional CONSULTIVO, não normativo.**
>
> O código, o schema, as migrações, a especificação já aprovada (`docs/spec/estudo-de-viabilidade-spec.md`) e os contratos do UrbiVerso continuam sendo a fonte de verdade do comportamento que está em produção. Uma divergência entre este documento e o app deve gerar análise de impacto e, quando aprovada, uma issue específica. **A divergência não autoriza uma alteração automática ou uma refatoração ampla** — e, se o texto discordar do que o código faz, o código está certo até que uma issue aprovada diga o contrário.

A introdução deste padrão deve preservar o que já funciona. O objetivo é tornar explícita a dinâmica funcional de referência e permitir uma evolução controlada do aplicativo.

A versão atual incorpora a reconciliação de dois modelos de fluxo do projeto Calliandra. Eles demonstram que o motor-alvo não pode distribuir diretamente o VGV total: **cada mês de contratação cria uma safra própria**, e cada safra gera pagamentos imediatos, parcelas e liquidações segundo sua regra temporal.

## Como ler este documento

Ele mistura, de propósito, duas camadas — e elas estão sempre rotuladas:

| Rótulo | Significado |
|---|---|
| **Comportamento vigente** | O que o código faz **hoje**, com o arquivo onde isso vive |
| **Modelo funcional de referência** | A regra de negócio aprovada, que o app deve alcançar |
| **Evolução dependente de issue** | A lacuna entre os dois, com o identificador da issue proposta |

Uma seção **sem** esses rótulos descreve comportamento vigente e modelo de referência que **coincidem**.

Os identificadores `EVI-0NN` citados ao longo do texto correspondem às issues **#220–#241**, abertas
na Rodada 5. A matriz de aderência completa — conceito, evidência em `arquivo:linha`, status e classe
de impacto — está em `docs/rodada-5-evi-2026-07-31.md`.

> **Revisão de recebíveis.** A validação posterior contra os dois arquivos de Calliandra corrige
> premissas das issues EVI-001, EVI-008, EVI-009, EVI-010, EVI-012, EVI-013, EVI-014,
> EVI-016, EVI-017, EVI-020 e EVI-021. Antes de implementar qualquer uma delas, seus corpos e os
> mapas documentais precisam ser reconciliados com esta versão. Em especial, a primeira parcela
> recorrente passa a ocorrer, por padrão, no mês seguinte à contratação, e o motor passa a suportar
> componentes de prazo fixo e componentes até marco como regras distintas.

**Regra de ouro do app:** a Proforma **roda no frontend em tempo real** e é determinística — dado o
mesmo conjunto de premissas, o resultado é sempre o mesmo. O backend **persiste apenas os inputs**;
nenhum indicador é gravado.

> **Nomenclatura.** Este documento usa o vocabulário aprovado — **Grupo** (não "Fase") e
> **Após-chaves** (não "Pós-obra"). A implementação atual ainda exibe "Fase" e "Pós-obra" na tela, e
> usa `avancado_fases`, `fase_id` e `pos_obra` internamente. Isso está registrado seção a seção e é
> tratado pelas issues EVI-003 e EVI-004; **nada foi renomeado no código**.

Os anexos A a G, ao final, preservam o material específico do app que este padrão não cobre:
dicionário de campos reais, modelo de dados, convenções de cálculo, armadilhas conhecidas e API.

---

## Índice

1. [Papel do aplicativo](#1-papel-do-aplicativo)
2. [Autoridade dos documentos e princípio de compatibilidade](#2-autoridade-dos-documentos-e-princípio-de-compatibilidade)
3. [Vocabulário funcional oficial](#3-vocabulário-funcional-oficial)
4. [Níveis de análise e navegação](#4-níveis-de-análise-e-navegação)
5. [Ciclo de vida, membros e permissões](#5-ciclo-de-vida-membros-e-permissões)
6. [Criação do estudo e origem do terreno](#6-criação-do-estudo-e-origem-do-terreno)
7. [Empreendimento e catálogo de tipologias](#7-empreendimento-e-catálogo-de-tipologias)
8. [Cronograma global](#8-cronograma-global)
9. [Grupos comerciais e alocações](#9-grupos-comerciais-e-alocações)
10. [Absorção de vendas](#10-absorção-de-vendas)
11. [Fluxo de pagamento](#11-fluxo-de-pagamento)
12. [Vendas contratadas, descontos e controle de estoque](#12-vendas-contratadas-descontos-e-controle-de-estoque)
13. [Recebimentos, safras, carteiras e repasse](#13-recebimentos-safras-carteiras-e-repasse)
14. [Receita Bruta — VGV](#14-receita-bruta--vgv)
15. [Permutas](#15-permutas)
16. [Custos, obra e despesas](#16-custos-obra-e-despesas)
17. [Funding e estrutura de capital](#17-funding-e-estrutura-de-capital)
18. [Motor mensal e horizonte do estudo](#18-motor-mensal-e-horizonte-do-estudo)
19. [Resultados, indicadores e visualizações](#19-resultados-indicadores-e-visualizações)
20. [Cenários, mercado e apoio à decisão](#20-cenários-mercado-e-apoio-à-decisão)
21. [Validações funcionais e invariantes](#21-validações-funcionais-e-invariantes)
22. [Exportação, auditabilidade e reprodutibilidade](#22-exportação-auditabilidade-e-reprodutibilidade)
23. [Jornadas principais do usuário](#23-jornadas-principais-do-usuário)
24. [Aderência geral do app atual ao padrão](#24-aderência-geral-do-app-atual-ao-padrão)
25. [Limites deste documento e governança de mudanças](#25-limites-deste-documento-e-governança-de-mudanças)
26. [Critérios funcionais de aceite](#26-critérios-funcionais-de-aceite)
27. [Glossário funcional](#27-glossário-funcional)

**Anexos — material específico do app instalado**

- A. [Convenções de cálculo do app](#anexo-a--convenções-de-cálculo-do-app)
- B. [Dicionário de premissas (campos reais)](#anexo-b--dicionário-de-premissas-campos-reais)
- C. [Modelo de dados](#anexo-c--modelo-de-dados)
- D. [Armadilhas conhecidas](#anexo-d--armadilhas-conhecidas)
- E. [API](#anexo-e--api)
- F. [Decisões históricas e vigência](#anexo-f--decisões-históricas-e-vigência)
- G. [Cenários dourados de recebíveis](#anexo-g--cenários-dourados-de-recebíveis)

---

## 1. Papel do aplicativo

O app de Viabilidade existe para transformar premissas dispersas em um estudo único, comparável e auditável.

No caso de Incorporação, ele precisa conectar:

```text
TERRENO E POTENCIAL CONSTRUTIVO
        ↓
PRODUTO E TIPOLOGIAS
        ↓
GRUPOS COMERCIAIS, PREÇOS E ABSORÇÃO
        ↓
CONTRATAÇÃO, RECEBÍVEIS E REPASSE
        ↓
CUSTOS, OBRA E FUNDING
        ↓
FLUXO DE CAIXA E INDICADORES
```

O aplicativo deve permitir que o usuário responda, com rastreabilidade:

- o que será construído;
- quanto estará disponível para venda;
- como o estoque será agrupado comercialmente;
- por qual preço cada parcela do produto será comercializada;
- em quais períodos ocorrerão as vendas;
- como os compradores pagarão;
- quanto ficará em carteira;
- quando ocorrerá o repasse;
- quando cada custo será pago;
- quanto capital próprio e dívida serão exigidos;
- qual resultado, retorno e exposição o projeto produzirá.

O aplicativo não deve ser apenas uma reprodução visual de uma planilha. Ele deve preservar as identidades econômicas do estudo e impedir combinações de premissas que produzam resultados internamente incoerentes.

### 1.1 Determinismo

Dado o mesmo conjunto de premissas, a aplicação deve produzir o mesmo resultado.

```text
mesmas premissas
+ mesmas regras
+ mesma precisão
= mesmo fluxo e mesmos indicadores
```

A interface pode apresentar visões diferentes — mensal, anual, por Grupo ou consolidada — sem modificar o cálculo-base.

### 1.2 Separação entre entrada e resultado

O app deve distinguir claramente:

- **premissas informadas**;
- **parâmetros organizacionais**;
- **valores derivados**;
- **resultados do fluxo**;
- **alertas e validações**.

Campos calculados não devem se comportar como inputs livres. Campos editáveis não devem parecer resultados definitivos.

---

## 2. Autoridade dos documentos e princípio de compatibilidade

Quatro camadas convivem no projeto:

| Camada | Papel |
|---|---|
| **Inteligência de negócio** | Define o significado econômico dos conceitos e fórmulas |
| **Padrão funcional do app** | Define como esses conceitos devem aparecer e se relacionar na experiência do usuário |
| **Especificação técnica e contratos do UrbiVerso** | Define como a solução pode ser implementada dentro da plataforma |
| **Código, schema, migrações e testes** | Definem o comportamento efetivamente executado na versão instalada |

### 2.1 Regra de prudência

Quando o padrão funcional divergir do código atual:

1. a divergência deve ser confirmada;
2. o impacto sobre estudos existentes deve ser medido;
3. a mudança deve ser dividida em uma issue específica;
4. migração e compatibilidade devem ser avaliadas;
5. testes devem ser definidos antes da alteração;
6. a alteração só deve ocorrer depois de aprovação.

### 2.2 O documento não ordena renomeações internas

O termo funcional oficial passa a ser **Grupo**. A interface atual pode ainda exibir “Fase” e a persistência interna pode conter identificadores legados associados a esse nome.

Este documento exige a evolução da **nomenclatura percebida pelo usuário**, mas não exige, por si só:

- renomear tabelas;
- renomear colunas;
- alterar contratos de API;
- migrar identificadores internos;
- quebrar compatibilidade com estudos existentes.

A eventual alteração interna deve ser tratada em uma issue técnica independente, apenas se trouxer benefício suficiente para justificar o risco.

---

## 3. Vocabulário funcional oficial

A aplicação deve evitar usar o mesmo termo para conceitos diferentes.

| Termo oficial | Significado funcional | Termo legado ou ambíguo a evitar |
|---|---|---|
| **Estudo** | Registro completo de uma análise de viabilidade | Projeto, simulação, arquivo |
| **Cronograma global** | Régua temporal do empreendimento | Fase comercial |
| **Evento do cronograma** | Planejamento, Pré-lançamento, Lançamento, Obra e Após-chaves | Grupo |
| **Período de absorção** | Janela na qual uma parcela das vendas é contratada | Fase |
| **Grupo** | Agrupamento comercial de estoque, preços, absorção e pagamento | Fase |
| **Tipologia** | Produto homogêneo, com área e características próprias | Unidade individual |
| **Alocação** | Quantidade de uma tipologia destinada a um Grupo, com preço por m² | Tipologia do Grupo |
| **Safra** | Contratos originados no mesmo mês, Grupo, alocação e componente | Parcela |
| **Valor bruto contratado** | Área contratada × preço por m², antes de descontos | Receita mensal |
| **Valor contratado líquido** | Valor bruto menos descontos, sem juros futuros | Receita Bruta |
| **Componente de pagamento** | Regra que transforma parte do contrato em recebimentos | Coluna genérica sem semântica |
| **Pagamento imediato** | À vista, entrada, sinal ou parcela no ato | Parcela futura |
| **Prazo fixo** | Número fixo de parcelas contado a partir da safra | Parcelamento até a Obra |
| **Até um marco** | Parcelas encerradas num marco comum, como fim da Obra | Prazo fixo |
| **Pagamento concentrado** | Liquidação em um único mês, como repasse | Funding |
| **Receita Bruta — VGV** | Soma de todos os recebimentos dos clientes, incluindo juros | Funding ou valor apenas contratado |
| **Carteira de clientes** | Saldo econômico ainda devido pelos compradores | Caixa futuro sem reconciliação |
| **Repasse** | Liquidação bancária do saldo do comprador após a entrega | Financiamento à produção |
| **Financiamento à produção** | Dívida da incorporadora para financiar custos do empreendimento | Repasse |
| **Após-chaves** | Período de 12 meses após a entrega | Vendas nas chaves ou Pós-obra indefinido |

### 3.1 Grupo substitui Fase na linguagem do usuário

A interface deverá evoluir, por issue própria, de:

```text
1ª Fase
2ª Fase
Adicionar Fase
```

para:

```text
1º Grupo
2º Grupo
Adicionar Grupo
```

A mudança deve alcançar textos de interface, documentação, relatórios e mensagens. Identificadores internos podem permanecer como estão para evitar uma migração desnecessária.

> **Comportamento vigente.** A tela de Receitas, os cabeçalhos do Fluxo de Caixa e as exportações
> dizem "Fase" (`frontend/tela-fluxo-receitas.ts`), e o rótulo `pos_obra: 'Pós-obra'` vive em
> `frontend/fluxo-shared.ts`. No banco, a entidade é `avancado_fases` e a chave estrangeira é
> `fase_id`.
>
> **Evolução dependente de issue.** EVI-003 (Fase → Grupo) e EVI-004 (Pós-obra → Após-chaves), as
> duas restritas à **linguagem do usuário**. A renomeação de `avancado_fases`, `fase_id`, rotas e
> chaves JSON está explicitamente **fora do backlog** desta rodada.

### 3.2 Grupo não é período

Um Grupo não possui início, duração ou fim próprios.

Ele representa:

```text
seleção de estoque
+ preço por m²
+ absorção
+ plano de pagamento
```

Dois Grupos podem vender nos mesmos meses. A ordem “1º”, “2º” ou “3º” organiza a apresentação e a estratégia comercial, mas não cria uma sequência temporal automática.

## 4. Níveis de análise e navegação

O aplicativo pode oferecer dois níveis de estudo.

### 4.1 Estudo Preliminar

O Preliminar é uma validação estática. Ele responde principalmente:

- qual é o potencial do produto;
- qual é o VGV potencial;
- qual é a estrutura de custos;
- qual é o resultado e a margem;
- qual preço por m² seria necessário para atingir determinado benchmark.

Ele não precisa reproduzir toda a dinâmica mensal de recebíveis, carteira e funding.

> **Comportamento vigente, alinhado ao padrão.** O Preliminar roda em `frontend/proforma.ts`, um
> motor puro (sem DOM, sem I/O) coberto por teste. A sequência é:
>
> ```text
> 1. Áreas          → áreaTerreno, áreaPrivativa, áreaConstruída, área vendável líquida (após permuta física)
> 2. VGV            → área_pvt_r_fechada × preço R + área_pvt_nr_fechada × preço NR
> 3. Deduções       → imposto (RET/percentual) + corretagem + marketing + permutas financeiras
>                     Receita líquida = VGV − deduções
> 4. Custos diretos → terreno + projetos + construção + gestão + decoração + outorga
>                     + incorporação/registro + manutenção + contingências
> 5. Custos indiretos → marketing global + gestão/indiretos
> 6. Resultado      → Receita líquida − Custo direto total − Custo indireto total (+ permutas)
> 7. KPIs           → Margem bruta, Margem líquida, ROI, Custo obras/VGV, Investimento total,
>                     Resultado por unidade (e por tipo R/NR)
> ```
>
> A engine devolve a interface `Proforma`, que alimenta a aba Proforma, os KPIs ao vivo da aba
> Premissas e a exportação. O backend **nunca** calcula indicadores — não há endpoint de "simular".

A navegação típica inclui:

- Premissas;
- Proforma;
- Gráficos;
- Apelo Comercial;
- Análise de Mercado, quando aplicável.

### 4.2 Estudo Avançado

O Avançado acrescenta a dimensão temporal e deve suportar:

- cronograma;
- catálogo de tipologias;
- Grupos e alocações;
- absorção de vendas;
- fluxo de pagamento;
- custos com curvas temporais;
- carteiras;
- repasse;
- funding;
- fluxo mensal;
- TIR, VPL, payback e exposição máxima;
- cenários e comparação com mercado.

A organização funcional pode conter módulos como:

- **Resumo**;
- **Empreendimento**;
  - Informações;
  - Cronograma;
  - Tipologias;
- **Viabilidade**;
  - Receitas;
  - Financeiro ou Custos;
- **Obra**;
- **Fluxo de Caixa**;
- **Cenários**;
- **Análise de Mercado**;
- **Apelo Comercial**.

A nomenclatura exata das abas pode evoluir, desde que a relação entre as informações permaneça clara.

### 4.3 O Avançado não deve duplicar o Preliminar sem necessidade

Premissas comuns devem ser reutilizadas ou reconciliadas. O usuário não deve informar duas vezes o mesmo dado sem saber qual versão prevalece.

Quando o Avançado detalhar um valor agregado do Preliminar, a aplicação deve mostrar a relação entre ambos.

---

## 5. Ciclo de vida, membros e permissões

O acesso é controlado por estudo, além das permissões gerais do app no UrbiVerso.

### 5.1 Funções

| Função | Comportamento esperado |
|---|---|
| **Leitor** | Visualiza estudos permitidos e exporta relatórios |
| **Editor** | Cria, edita, duplica e submete o estudo para análise |
| **Aprovador** | Aprova, reprova, devolve ao rascunho e reabre estudos arquivados |
| **Administrador do app** | Possui capacidade ampliada conforme as regras do UrbiVerso |

### 5.2 Estados

```text
Rascunho
   ↓ editor submete
Em análise
   ├── aprovado
   ├── reprovado
   └── devolvido ao Rascunho
```

Estudos inativos podem ser arquivados conforme a política da instância.

> **Comportamento vigente, alinhado ao padrão.** O ciclo é
> `rascunho → em_analise → aprovado | reprovado`, com devolução ao Rascunho e reabertura de
> Arquivado pelo aprovador. Estudos parados (exceto Aprovado) por **30 dias** são arquivados
> automaticamente. A função por estudo vive em `estudo_membros.funcao`
> (`leitor` | `editor` | `aprovador`), sobre a permissão de app (`nivelApp`/`rolesApp`) do shell —
> a app **nunca** implementa autenticação, usa `req.contexto`. Ver
> [Permissões e Ciclo de Vida](permissoes).

### 5.3 Restrições funcionais

- A origem e os imóveis vinculados ao terreno devem ficar protegidos depois da submissão, conforme a regra vigente.
- Resultados precisam refletir imediatamente qualquer alteração permitida nas premissas.
- Alterações feitas por um aprovador em estudo já submetido devem permanecer auditáveis.
- O app não implementa autenticação própria: utiliza identidade, papéis e contexto fornecidos pelo UrbiVerso.

---

## 6. Criação do estudo e origem do terreno

Na criação, o usuário define:

- nome;
- tipo de empreendimento;
- UF ou localidade;
- nível de análise;
- origem do terreno;
- membros iniciais, quando aplicável.

### 6.1 Origem pelo Núcleo

Para Incorporação, o estudo pode referenciar um ou mais lotes existentes no Núcleo.

O app deve:

- consumir os dados autorizados pela instância;
- apresentar claramente quais imóveis estão vinculados;
- somar a área dos lotes para formar a área do terreno;
- degradar de forma segura quando a permissão do Núcleo não estiver disponível;
- nunca substituir silenciosamente um vínculo por um valor manual.

### 6.2 Origem manual

O usuário informa:

- nome ou identificação do terreno;
- área;
- matrícula e descrição, quando aplicável.

A origem escolhida deve permanecer explícita no estudo e nos relatórios.

### 6.3 Integração com o UrbiVerso

O app foi concebido para funcionar **somente dentro de uma instância do UrbiVerso**. Ele não deve ser tratado como aplicação autônoma nem validado como se autenticação, persistência, componentes de interface e serviços da plataforma fossem dependências opcionais. A validação funcional completa ocorre no ambiente do shell.

A experiência deve respeitar:

- autenticação do shell;
- permissões concedidas à app;
- contratos de acesso ao Núcleo;
- componentes e tokens do design system;
- padrões de documentação, eventos e empacotamento da plataforma.

Nenhuma funcionalidade deste documento autoriza contornar as regras do UrbiVerso.

---

## 7. Empreendimento e catálogo de tipologias

### 7.1 Função do catálogo

O catálogo descreve o produto que poderá ser alocado nos Grupos.

Cada tipologia deve conter, conforme o tipo de produto:

- nome;
- tipo de unidade;
- área privativa unitária;
- dormitórios;
- vagas;
- quantidade total;
- quantidade ou área destinada à permuta física, quando a nova dinâmica estiver definida;
- ordem de apresentação.

### 7.2 Unidade física e unidade econômica

O app usa unidades para controlar o produto, mas calcula a receita por m².

```text
área total da tipologia
= área privativa unitária × quantidade total
```

```text
área alocada no Grupo
= área privativa unitária × quantidade alocada
```

```text
valor potencial da alocação
= área alocada × preço por m²
```

Isso permite que o fluxo mensal seja proporcional mesmo quando a absorção produza uma quantidade econômica fracionária de unidades em determinado mês.

### 7.3 Não cadastrar cada unidade individual

O estudo não precisa manter uma linha para cada apartamento ou loja. Ele trabalha com conjuntos homogêneos.

Unidades devem ser separadas em tipologias distintas quando houver diferença relevante de:

- área;
- uso;
- produto;
- padrão construtivo;
- comportamento comercial necessário.

### 7.4 Totais do catálogo

A tela deve consolidar, no mínimo:

- área privativa total;
- quantidade total de unidades;
- vagas;
- quantidade e área de permuta física, quando aplicável;
- estoque potencialmente alocável.

Os totais precisam reconciliar com as alocações dos Grupos.

### 7.5 Edição e integridade

- Alterar nome ou área de uma tipologia deve refletir nas alocações que a referenciam.
- Excluir tipologia em uso deve ser bloqueado.
- Reduzir a quantidade total abaixo do que já foi alocado deve ser bloqueado ou exigir regularização prévia.
- A quantidade disponível deve considerar todas as alocações do estudo, e não apenas o Grupo aberto na tela.

### 7.6 Permuta física

A futura forma de entrada das unidades permutadas ainda será tratada separadamente.

Este documento fixa apenas a consequência funcional:

- estoque permutado não pode gerar receita;
- estoque permutado não pode ser vendido novamente;
- a evolução da interface não deve ser feita de forma improvisada enquanto a dinâmica de entrada não estiver aprovada.

---

## 8. Cronograma global

O cronograma é único para o estudo. Grupos não possuem cronogramas próprios.

### 8.1 Relação econômica entre os eventos

```text
PLANEJAMENTO
    ↓
começam simultaneamente PRÉ-LANÇAMENTO e OBRA FÍSICA
    ↓
LANÇAMENTO
    ↓
período comercial DURANTE A OBRA
    ↓
ENTREGA DAS CHAVES
    ↓
APÓS-CHAVES — 12 meses
    ↓
CAUDA FINANCEIRA, se houver
```

### 8.2 Eventos e períodos

| Elemento | Função |
|---|---|
| **Planejamento** | Produto, projetos, aprovações e preparação anterior à comercialização |
| **Pré-lançamento** | Primeiro período comercial |
| **Lançamento** | Abertura formal e concentração de esforço comercial |
| **Obra física** | Execução construtiva, iniciada junto ao Pré-lançamento |
| **Durante a obra** | Período comercial depois do Lançamento até o fim da Obra |
| **Entrega das chaves** | Marco que separa vendas pré e pós-entrega |
| **Após-chaves** | 12 meses de venda do estoque remanescente |
| **Posterior** | Parcelas, manutenção, dívida e outros eventos que ultrapassam o Após-chaves |

> **Comportamento vigente.** O cronograma tem **5 eventos** persistidos em `avancado_cronograma`
> (`planejamento`, `pre_lancamento`, `lancamento`, `obra`, `pos_obra`), cada um com `inicio_mes`
> 0-based e `duracao_meses`. O encadeamento é feito por `recalcularTravados`, em
> `backend/rotas/avancado.ts`, que trava **três** inícios: `pre_lancamento` = fim do `planejamento`
> (entregue pela #165), `lancamento` = fim do `pre_lancamento`, `pos_obra` = fim da `obra`. Toda
> **duração** é livre, inclusive a do Lançamento (#166 — antes fixa em 1 mês).
>
> **Divergência:** o início da **Obra** é livre. Nada hoje a ancora ao fim do Planejamento, então
> Obra e Pré-lançamento podem começar em meses diferentes.
>
> **Evolução dependente de issue.** EVI-005 — ancorar a Obra ao fim do Planejamento. O
> Pré-lançamento já está ancorado e sai do escopo original da issue.

### 8.3 Obra física não é a faixa comercial inteira “Durante a obra”

A Obra física começa com o Pré-lançamento. A faixa de absorção chamada “Durante a obra” começa somente depois do Lançamento.

```text
início de Durante a obra
= primeiro mês depois do fim do Lançamento
```

```text
fim de Durante a obra
= último mês da Obra física
```

A interface deve evitar mostrar a mesma janela integral da Obra em três linhas de absorção simultâneas.

> **Comportamento vigente.** `faixasAbsorcao`, em `frontend/fluxo-shared.ts`, deriva a faixa `obra`
> como `inicio_mes` até `inicio_mes + duracao_meses − 1` do **evento Obra inteiro**. Como a Obra
> cobre o Pré-lançamento e o Lançamento, os três períodos comerciais **se sobrepõem** e percentuais
> de absorção diferentes incidem sobre os mesmos meses.
>
> **Evolução dependente de issue.** EVI-006 — derivar "Durante a obra" a partir do fim do
> Lançamento, com os quatro períodos contíguos ou explicitamente vazios.

### 8.4 Entrega é marco, não período de venda

Não existe uma faixa independente “Vendas nas chaves”.

A entrega:

- encerra a Obra física;
- encerra a contratação financiada diretamente pela incorporadora;
- dispara o repasse no primeiro mês seguinte;
- inicia o Após-chaves.

### 8.5 Após-chaves

```text
duração do Após-chaves = 12 meses
```

O período começa no primeiro mês posterior ao fim da Obra.

> **Comportamento vigente.** O início já é o mês seguinte ao fim da Obra (`pos_obra` travado em
> `recalcularTravados`), mas a **duração é livre e editável**: `faixasAbsorcao` lê
> `Math.max(1, Math.round(posObraMeses ?? pos.duracao_meses))`, em `frontend/fluxo-shared.ts`. Há
> estudos gravados com duração diferente de 12.
>
> **Evolução dependente de issue.** EVI-007 — fixar a janela em 12 meses. É a issue com maior
> impacto em dados legados desta rodada: exige decidir explicitamente o tratamento dos estudos
> existentes **antes** de implementar.

### 8.6 Representação temporal no app

O app atual pode usar meses relativos 0-based a partir da data de início do projeto, incluindo o Planejamento nos primeiros índices.

O padrão de negócio pode tratar o mês zero comercial como o início simultâneo do Pré-lançamento e da Obra. As duas representações são compatíveis desde que:

- as datas reais coincidam;
- os vínculos entre eventos sejam preservados;
- a interface deixe claro o marco utilizado;
- nenhum recebimento ou custo seja deslocado por erro de índice.

Não é necessário introduzir meses negativos no código apenas para reproduzir a nomenclatura analítica.

---

## 9. Grupos comerciais e alocações

### 9.1 Função do Grupo

Cada Grupo é um card ou bloco comercial que reúne:

- nome;
- alocações de tipologias;
- preços por m²;
- perfil de absorção;
- perfil de fluxo de pagamento;
- VGV potencial do Grupo.

> **Comportamento vigente, com nomenclatura legada.** A estrutura de catálogo + Grupo + alocação
> **já existe** e é considerada o fundamento correto. No banco: `avancado_tipologias` (catálogo do
> estudo, desacoplado da receita), `avancado_fases` e `avancado_alocacoes`.
>
> `avancado_fases` é separada por `tipo` (#168): `tipo='receita'` é o **Grupo** comercial, dono da
> Absorção e do Fluxo de Pagamento, gerido na aba Receitas; `tipo='cronograma'` é um marcador do
> gantt (nome/início/duração), sem Absorção, Fluxo nem Alocações. As duas telas faziam CRUD na
> mesma lista antes de o `tipo` existir; hoje cada uma só enxerga as suas.
>
> A trava de saldo é **agregada por estudo** (`saldoTipologiaNoEstudo`): a soma das unidades
> alocadas da tipologia em **todos** os Grupos não pode exceder a `quantidade` do catálogo. Na
> tela, as unidades **cascateiam** de um Grupo para o seguinte — o `Total` de cada linha é a
> quantidade do catálogo menos o que as linhas acima já venderam (#170).
>
> **Estrutura vestigial.** A tabela `avancado_linhas_receita` continua declarada no `schema.json` e
> convive com `avancado_fases` + `avancado_alocacoes`, que a superaram. Inventariá-la é objeto de
> EVI-002; **remover não está autorizado nesta rodada**.

### 9.2 Estrutura da alocação

Uma alocação conecta uma tipologia a um Grupo e contém:

- tipologia escolhida;
- quantidade alocada;
- preço por m²;
- ordem de apresentação.

Valores derivados:

```text
área alocada
= quantidade alocada × área privativa unitária
```

```text
preço unitário
= área privativa unitária × preço por m²
```

```text
VGV potencial da alocação
= quantidade alocada × preço unitário
```

```text
VGV potencial do Grupo
= soma dos VGVs potenciais das alocações
```

### 9.3 A mesma tipologia em vários Grupos

A mesma tipologia pode aparecer em vários Grupos com:

- quantidades diferentes;
- preços diferentes;
- absorções diferentes;
- fluxos de pagamento diferentes.

Exemplo:

```text
Studio de 21 m²
├── 10 unidades no 1º Grupo a R$ 12.000/m²
└── 90 unidades no 2º Grupo a R$ 14.000/m²
```

### 9.4 Um Grupo pode ter várias tipologias

O Grupo não deve ser limitado a uma única tipologia. Studio, 2 dormitórios, 3 dormitórios e loja podem compartilhar a mesma absorção e o mesmo fluxo de pagamento quando essa for a estratégia comercial.

### 9.5 Saldo de unidades

A interface deve mostrar, em cada linha:

- total disponível antes da alocação;
- quantidade alocada;
- saldo depois da alocação.

O saldo é global por tipologia:

```text
saldo disponível
= quantidade vendável da tipologia
− soma das alocações anteriores em todos os Grupos
```

A ordem de exibição pode determinar a leitura em cascata, mas a validação final deve considerar o estudo inteiro.

### 9.6 Quando criar outro Grupo

Um novo Grupo é apropriado quando parte do estoque possuir:

- preço diferente;
- estratégia de absorção diferente;
- fluxo de pagamento diferente;
- venda em bloco;
- condição comercial institucional;
- tratamento distinto de produto.

Não se deve criar outro Grupo apenas para reproduzir um período do cronograma.

### 9.7 Nome e ordem

O nome pode ser “1º Grupo”, “2º Grupo”, “Investidor”, “Varejo”, “Lojas” ou outra descrição útil.

A ordem organiza a tela, o relatório e a leitura do saldo. Ela não cria, por si só, precedência temporal.

### 9.8 Extensibilidade

Adicionar uma tipologia, um Grupo ou uma alocação deve significar adicionar informação ao estudo, e não alterar sua estrutura fixa. A experiência não deve impor um número predeterminado de Grupos ou criar uma nova coluna estrutural para cada produto.

---

## 10. Absorção de vendas

### 10.1 Propriedade do Grupo

Cada Grupo possui um perfil único de absorção, aplicado a todas as suas alocações.

A configuração informa quanto do estoque do Grupo será vendido em cada período global.

### 10.2 Quatro períodos

| Período | Percentual |
|---|---|
| **Pré-lançamento** | Informado |
| **Lançamento** | Informado |
| **Durante a obra** | Informado |
| **Após-chaves** | Derivado como resíduo |

```text
% Após-chaves
= 100%
− % Pré-lançamento
− % Lançamento
− % Durante a obra
```

A soma dos três percentuais informados não pode ultrapassar 100%.

> **Comportamento vigente.** O JSON `absorcao` de `avancado_fases` guarda o modo **Distribuído** em
> **três** períodos: `lancamento` (que cobre Pré-lançamento **e** Lançamento juntos), `obra` e
> `pos_obra`. O resíduo derivado é o `pos_obra` (`100 − p1 − p2`), e a validação de entrada
> (`frontend/premissas-validacao.ts`) barra `lancamento + obra > 100`.
>
> **Divergência:** o padrão exige **quatro** períodos informados separadamente, com Pré-lançamento
> distinto do Lançamento.
>
> **Evolução dependente de issue.** EVI-006 (separação da janela comercial) e EVI-010 (contrato
> canônico), que juntas definem o novo shape sem quebrar o JSON legado.

### 10.3 Distribuição mensal

Dentro de cada período, a distribuição padrão é uniforme.

```text
% mensal do período
= % do período ÷ quantidade de meses do período
```

Para cada alocação:

```text
área contratada no mês
= área alocada × % mensal
```

A mesma curva percentual é aplicada a todas as tipologias do Grupo.

### 10.4 Após-chaves fixo

O percentual residual é distribuído por 12 meses.

```text
% mensal Após-chaves
= % Após-chaves ÷ 12
```

A duração não deve ser editável no padrão funcional de Incorporação.

### 10.5 Gráfico de absorção

O modal ou painel deve mostrar:

- percentuais por período;
- datas ou meses de cada período;
- curva acumulada;
- total final de 100%;
- mensagens de erro antes de aplicar uma configuração inválida.

A visualização acumulada deve terminar em 100%.

### 10.6 Correção de estoque

Quando existir uma opção de correção de estoque, seu comportamento deve ser explícito e testável.

Ela não pode:

- criar um quinto período;
- alterar o VGV total;
- esconder percentuais que não fecham;
- produzir estoque negativo;
- modificar silenciosamente preços ou condições de pagamento.

### 10.7 Absorção não define o recebimento

A absorção determina a contratação. O caixa é determinado pelo fluxo de pagamento.

```text
absorção → vendas contratadas
fluxo de pagamento → recebimentos
```

Misturar os dois conceitos impede a correta apuração de corretagem, carteira e exposição.

---

## 11. Fluxo de pagamento

> 🔄 **Nota de UX acrescentada em 2026-08-01.** Esta seção descreve o **contrato econômico**. A
> **experiência de configuração** do editor tem issue própria: **#248** (`BUGLIST-005`).
>
> **Comportamento vigente:** o editor expõe a estrutura de persistência, não o modelo econômico —
> listas genéricas `entrada[]` e `parcelas[]` com quatro periodicidades (`mensal`, `trimestral`,
> `semestral`, `anual`), no máximo 4 linhas, uma periodicidade por linha, mais um checkbox `juros`
> que **não alimenta cálculo nenhum** (`frontend/tela-fluxo-receitas.ts:33-34,633-637,668-681,745-780`).
>
> **Modelo funcional de referência:** o editor apresenta pagamento no ato, quantidade de parcelas
> **mensais**, taxa quando aplicável e evento de liquidação/repasse — sem periodicidades fora do
> padrão aprovado. A #248 depende do contrato canônico da **#230** e não implementa motor: ela
> **não substitui** a cadeia #232–#237.

### 11.1 Propriedade do Grupo

Cada Grupo possui um plano de pagamento aplicável a todas as suas alocações.

O plano não é uma curva pronta de caixa. Ele é um conjunto de regras que, aplicado a cada mês de contratação, cria uma ou mais safras de recebimentos.

### 11.2 Base financeira do plano

Para cada alocação e mês:

```text
valor bruto contratado
= área contratada × preço por m²
```

```text
valor contratado líquido
= valor bruto contratado − descontos comerciais
```

Os componentes de pagamento são aplicados sobre o valor contratado líquido.

A soma das participações precisa fechar:

```text
Σ participação dos componentes = 100%
```

### 11.3 Regras econômicas de componente

O contrato funcional deve conseguir representar quatro regras.

| Regra | Parâmetros mínimos | Comportamento |
|---|---|---|
| **Imediato** | participação | Recebimento no mês da contratação |
| **Prazo fixo** | participação, sinal, prazo, primeiro vencimento, taxa | Número fixo de parcelas contado a partir de cada safra |
| **Até um marco** | participação, sinal, marco final, primeiro vencimento, taxa | Quantidade de parcelas depende do mês da venda |
| **Concentrado em marco** | participação, marco, taxa e convenção de juros | Liquidação única, como repasse |

Cada componente precisa informar ou derivar:

- participação;
- percentual de sinal ou entrada;
- principal financiado;
- periodicidade;
- defasagem do primeiro vencimento;
- prazo fixo ou marco final;
- taxa;
- incidência ou não de juros no mês da contratação;
- regra de fechamento da última parcela.

### 11.4 Modelos comerciais que o app precisa suportar

#### À vista

```text
participação à vista
→ recebimento no mês da contratação
```

#### Curta de 36 parcelas

```text
sinal no mês da contratação
+ 36 parcelas
+ primeira parcela no mês seguinte
```

Cada parcela é monetária, com duas casas decimais. Se o arredondamento das 35 primeiras deixar resíduo, ele é aplicado exclusivamente na 36ª parcela; não se cria uma parcela adicional nem se deixa saldo residual.

A mesma regra se aplica ao componente pago até um marco: o resíduo das parcelas anteriores fica na última parcela do marco, que encerra a safra sem ultrapassar a entrega.

O componente concentrado é liquidado uma única vez no marco configurado, já capitalizado e quantizado em centavos. Um marco anterior à contratação é inválido: o motor não antecipa repasse para uma data em que a venda ainda não existia.

#### Longa de prazo fixo

```text
sinal ou entrada configurável
+ N parcelas
+ primeira parcela no mês seguinte
```

O cenário de referência possui 120 parcelas. Essa modalidade é financiamento direto de longo prazo; não é repasse.

#### Durante a Obra + repasse

```text
entrada ou sinal no mês da contratação
+ parcelas do mês seguinte até o fim da Obra
+ saldo concentrado no primeiro mês Após-chaves
```

Uma venda tardia possui menos parcelas até a Obra e, portanto, parcela maior.

### 11.5 Primeiro vencimento

A convenção funcional é:

```text
mês da venda
→ à vista, entrada, sinal ou parcela no ato explicitamente configurada

mês seguinte
→ primeira parcela recorrente
```

O motor não deve criar uma parcela no próprio mês apenas porque o componente é chamado de “ao longo da Obra”.

A incidência de juros no mês da contratação precisa ser um parâmetro explícito. O padrão é **não** contar o mês da venda como período financeiro completo.

### 11.6 Estratégia de compatibilidade do motor (#283)

O JSON `fluxo_pagamento` guarda:

- opcionalmente, `componentes`: plano canônico de pagamento com participações que fecham 100%;
- `comissao`;
- `ret`;
- listas de `entrada`;
- listas de `parcelas`;
- `repasse.apos_entrega_meses`.

Desde a #283, a compatibilidade é decidida **por linha de receita e por opt-in**:

- quando `fluxo_pagamento.componentes` está explicitamente persistido, `calcularFluxo` usa o motor por safras e expõe principal, juros de clientes, carteira e repasse;
- quando `componentes` está ausente, o app mantém integralmente o caminho legado (`entrada`, `parcelas` e `repasse`), sem reinterpretar nem migrar o estudo durante a leitura;
- estudos aprovados ou arquivados não mudam retroativamente: só passam ao motor canônico se a linha for deliberadamente salva no novo contrato;
- a tela de Cenários reutiliza o mesmo `FluxoCalc`, portanto recebe as mesmas séries e regras sem um cálculo paralelo.

Essa escolha evita uma migração global silenciosa e permite auditar a adoção linha a linha. O caminho canônico calcula safra, PMT, juros sobre saldo, prazo fixo, vencimento até marco, carteira reconciliada e liquidação concentrada. O caminho legado permanece documentado abaixo apenas como regra de compatibilidade.

### 11.6.1 Parcelas legadas “ao longo da Obra”

O comportamento atual, originado nas #190/#191, é ancorado no calendário físico da Obra, **não no
mês da venda**. A mecânica exata, em `vencimentosAoLongoObra` (`frontend/fluxo-caixa-motor.ts`), é:

- número de parcelas = `max(1, floor(duração da obra / intervalo))`, com intervalo 1/3/6/12
  conforme a periodicidade (Mensal, Trimestral, Semestral, Anual);
- a 1ª vence no `inicio_mes` da Obra e as demais a cada intervalo;
- **o resto da divisão não vira parcela** — obra de 10 meses em Trimestral dá 3 parcelas;
- venda depois do início da Obra: a 1ª parcela cai no primeiro vencimento `>=` mês da venda, e o
  valor nominal é repartido entre os vencimentos restantes;
- obra sem duração, ou venda após o último vencimento: 1 parcela no mês da venda;
- não existe primeira parcela definida como `mês da venda + 1`;
- não existe saldo financeiro por safra.

Esse comportamento permanece como descrição do runtime atual, mas **não é o modelo funcional de
referência** depois da reconciliação com Calliandra: no modelo por safra o prazo depende do mês da
contratação, e a primeira parcela vence em `s + 1`. EVI-013 / #233 substitui uma mecânica pela
outra — e **muda os números de estudos existentes**.

### 11.7 Evolução dependente de issues

As issues já abertas precisam ser revisadas antes de implementação:

- **EVI-010 / #230** — contrato canônico deve ser baseado nas quatro regras de componente, não apenas em à vista/curta/longa rígidas;
- **EVI-012 / #232** — deve implementar componente de prazo fixo por safra, incluindo curta de 36 e longa de 120 meses;
- **EVI-013 / #233** — deve implementar componente até marco, com primeira parcela no mês seguinte, substituindo a premissa anterior de parcela no mês da contratação;
- **EVI-014 / #234** — deve implementar pagamento concentrado e repasse, com convenção explícita de juros;
- **EVI-016 / #236** — deve consolidar saldos reais por safra e componente;
- **EVI-017 / #237** — deve reconciliar Receita Bruta com valor contratado líquido e juros.

A documentação e os corpos das issues precisam ser atualizados antes de qualquer alteração no motor.

### 11.8 Regra para novas vendas Após-chaves

O plano financiado do Grupo não se aplica a novas vendas depois da entrega.

```text
recebimento da nova venda Após-chaves
= 100% do valor contratado líquido no mesmo mês
```

A fronteira é explícita: vendas até o mês da entrega preservam o plano do Grupo; somente safras posteriores à entrega são convertidas em recebimento integral no mês da contratação.

O comprador pode pagar parte diretamente e financiar parte com o banco, mas ambas chegam à incorporadora no mesmo mês.

> **Comportamento vigente.** O motor **não distingue** venda anterior de venda posterior à entrega:
> o mesmo `fluxo_pagamento` do Grupo é aplicado a todas as safras, inclusive às contratadas no
> Após-chaves — que assim geram parcelas e repasse como se fossem vendas pré-entrega
> (`frontend/fluxo-caixa-motor.ts` → `receitaMensalLinha`).
>
> **Evolução dependente de issue.** EVI-015 / #235.

### 11.9 Recebimentos antigos continuam

O fato de uma nova venda Após-chaves ser recebida à vista não elimina:

- parcelas de prazo fixo de vendas anteriores;
- parcelas até marco que ainda vencerem no mês permitido;
- repasse;
- outros valores já contratados antes da entrega.

## 12. Vendas contratadas, descontos e controle de estoque

### 12.1 Séries obrigatórias

O fluxo deve possuir três séries comerciais separadas do recebimento:

```text
valor bruto contratado
= área contratada × preço por m²
```

```text
desconto comercial
= valor bruto contratado × percentual de desconto aplicável
```

```text
valor contratado líquido
= valor bruto contratado − desconto comercial
```

As três precisam ser abertas por mês, Grupo e tipologia.

### 12.2 Usos da contratação

O valor contratado líquido é a base de:

- formação das safras;
- decomposição dos componentes de pagamento;
- principal financiado;
- reconciliação da Receita Bruta.

A área contratada é a base de:

- baixa de estoque;
- aderência da absorção.

A corretagem acompanha a contratação e precisa declarar se sua base é o valor bruto ou líquido. A mesma despesa não pode existir simultaneamente como dedução embutida e linha de custo.

> **Comportamento vigente.** Existe `vgvVendidoMensal`, em `frontend/fluxo-shared.ts`, mas ela não
> é canônica: reparte o **VGV bruto** da linha (`vgvLinha`, que conta a tipologia inteira), enquanto
> `receitaMensalLinha`, em `frontend/fluxo-caixa-motor.ts`, reparte o **VGV vendável**
> (`vgvVendavelLinha`, que exclui as unidades permutadas fisicamente). As bases divergem.
>
> **Evolução dependente de issue.** EVI-008 / #227 deve criar uma função canônica e agora também
> separar valor bruto, desconto e valor líquido. EVI-009 / #229 deve atualizar a taxonomia.

### 12.3 Contratação não contém juros futuros

O valor contratado líquido é o principal comercial assumido pelo comprador. Juros surgem ao longo do recebimento.

```text
valor contratado líquido acumulado
≠ Receita Bruta final, quando houver juros
```

Quando não existem juros:

```text
Receita Bruta final = valor contratado líquido acumulado
```

Quando existem descontos:

```text
Receita Bruta final
= valor bruto contratado
− descontos
+ juros
```

### 12.4 Controle em unidades e em m²

A aplicação deve manter duas leituras coerentes:

- quantidade de unidades para saldo comercial;
- área em m² para cálculo econômico.

O motor mensal pode contratar frações econômicas de área sem identificar a unidade física exata.

### 12.5 Fechamento do estoque

```text
estoque final
= estoque inicial vendável − área contratada acumulada
```

Ao fim da absorção:

- o estoque vendável deve ser zero;
- o estoque nunca pode ser negativo;
- a soma das alocações não pode ultrapassar o catálogo.

## 13. Recebimentos, safras, carteiras e repasse

> ⚠️ **Esta seção descreve o modelo funcional de referência, não o app instalado.**
>
> **Comportamento vigente.** `frontend/fluxo-caixa-motor.ts` distribui valores nominais por linhas de
> entrada, parcelas e repasse. Não há safra, PMT, taxa aplicada ao saldo, carteira ou reconciliação
> por componente.
>
> **Revisão obrigatória.** Os corpos atuais de EVI-012, EVI-013 e EVI-014 foram escritos antes da
> validação completa dos dois fluxos de Calliandra. Antes de implementar, devem ser corrigidos para
> refletir as regras abaixo.

### 13.1 Safras

Cada mês de contratação cria safras por:

- Grupo;
- alocação;
- mês;
- componente de pagamento.

A safra conserva:

- valor bruto;
- desconto;
- valor líquido;
- sinal ou entrada;
- principal;
- taxa;
- primeiro vencimento;
- prazo ou marco;
- parcela;
- saldo.

O fluxo do mês é:

```text
receita_t
= pagamentos imediatos das vendas de t
+ Σ pagamentos das safras anteriores e atuais com vencimento em t
```

### 13.2 Pagamentos imediatos

Entram no mês da contratação:

- à vista;
- entrada;
- sinal;
- parcela no ato expressamente configurada.

Não geram carteira futura.

### 13.3 Componente de prazo fixo

Para uma safra `s`:

```text
principal_s
= valor do componente_s − sinal_s
```

```text
primeiro vencimento = s + 1
último vencimento = s + N
```

Com juros:

```text
parcela_s
= PMT(taxa mensal; N; principal_s)
```

Sem juros:

```text
parcela_s = principal_s ÷ N
```

A receita mensal é a soma de todas as safras ativas.

Esse componente suporta:

- curta de 36 parcelas;
- longa de 120 parcelas;
- outros prazos fixos aprovados.

### 13.4 Componente até um marco

Para:

- `s` = mês da contratação;
- `M` = último mês permitido para parcela;

a primeira parcela ocorre em `s + 1` e a quantidade é:

```text
N_s = M − s
```

Com juros:

```text
parcela_s = PMT(taxa mensal; N_s; principal_s)
```

Sem juros:

```text
parcela_s = principal_s ÷ N_s
```

Uma venda tardia possui menos parcelas e parcela maior.

Se `N_s ≤ 0`, a configuração deve ser bloqueada ou transformada explicitamente em pagamento imediato/concentrado. O motor não pode criar prazo negativo.

### 13.5 Pagamento concentrado e repasse

O componente concentrado mantém um saldo até um marco.

No padrão:

```text
mês do repasse = primeiro mês Após-chaves
```

A incidência de juros precisa ser explícita.

Convenção padrão:

```text
saldo no mês da contratação = principal
```

```text
juros começam no mês seguinte
```

No repasse:

```text
repasse = principal acumulado + juros acumulados
saldo final = 0
```

Com taxa zero, o repasse é apenas a soma dos principais.

### 13.6 Carteira por safra

Para componente com primeira parcela no mês seguinte:

```text
saldo_s,s = principal_s
```

Nos meses posteriores:

```text
juros_s,t = saldo_s,t-1 × taxa
saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t
```

No último vencimento:

```text
saldo_s,t = 0
```

A última parcela pode absorver resíduo imaterial dentro da tolerância.

### 13.7 Carteira total

```text
carteira total_t
= Σ saldo de todas as safras e componentes em t
```

A interface deve abrir, no mínimo:

- prazo fixo curto;
- prazo fixo longo;
- componentes até marco;
- saldo para repasse;
- total.

Regras:

- nenhum saldo negativo;
- nenhum saldo crescendo depois do último pagamento;
- cada safra fecha;
- a carteira total termina em zero.

O motor consolida uma série mensal aberta em `prazoFixo`, `ateMarco` e `concentrado`, além do total. A carteira máxima e seu mês são obtidos dessa série real; vendas Após-chaves recebidas à vista não aumentam nenhum dos saldos.

### 13.8 Vendas Após-chaves

Novas vendas Após-chaves entram integralmente no mês.

Elas não criam:

- nova safra parcelada;
- nova carteira;
- novo saldo para repasse.

No mesmo mês podem continuar parcelas e repasses de contratos antigos.

> **Evolução dependente de issue.** EVI-015 / #235 — ver §11.8 para o comportamento vigente.

### 13.9 O que muda nas issues da Rodada 5

| Issue | Correção necessária |
|---|---|
| **EVI-001 / #220** | Dois cenários dourados: Calliandra prazo fixo e Calliandra até Obra + repasse |
| **EVI-010 / #230** | Contrato baseado em componentes e regras temporais |
| **EVI-012 / #232** | Generalizar para prazo fixo por safra; curta de 36 e longa de 120 |
| **EVI-013 / #233** | Primeira parcela no mês seguinte; componente até marco, não parcela no ato |
| **EVI-014 / #234** | Repasse como pagamento concentrado, taxa zero ou positiva e juros explicitamente convencionados |
| **EVI-016 / #236** | Carteira derivada de saldos por safra, não de recorrência agregada defeituosa |
| **EVI-017 / #237** | Receita Bruta = valor contratado líquido + juros |
| **EVI-020 / #240** | Invariantes por safra e identificação do primeiro mês divergente |
| **EVI-021 / #241** | Exibir bruto, desconto, líquido, principal, juros, parcelas, repasse e carteira |

## 14. Receita Bruta — VGV

### 14.1 Definição funcional

No padrão adotado pela empresa:

```text
Receita Bruta do mês
= pagamentos imediatos
+ parcelas de prazo fixo
+ parcelas até marco
+ pagamentos concentrados
+ repasse
+ novas vendas Após-chaves
```

```text
Receita Bruta — VGV
= soma da Receita Bruta de todos os meses
```

### 14.2 Relação com contratação e descontos

```text
valor contratado líquido
= valor bruto contratado − descontos comerciais
```

Depois do encerramento de todos os recebíveis:

```text
Receita Bruta — VGV
= valor contratado líquido acumulado
+ juros recebidos acumulados
```

Equivalentemente:

```text
Receita Bruta — VGV
= valor bruto contratado acumulado
− descontos comerciais acumulados
+ juros recebidos acumulados
```

Essa é a identidade que o motor deve validar.

> **Comportamento vigente desde #237/#283.** `receitaBruta` e
> `receitaBrutaMensal` são formadas pelos recebimentos dos clientes, com juros,
> sem funding e antes de RET, corretagem e permuta financeira. A aplicação
> preserva `receitaBrutaVgv` apenas como alias histórico do **VGV vendável**;
> código novo usa `vgvVendavel`. A Receita Bruta é aberta por linha e tipologia
> na tela e nas exportações e reconciliada com principal recebido + juros.

### 14.3 O que não integra a Receita Bruta

Não entram:

- permuta física;
- financiamento à produção;
- capital de giro;
- aporte de sócio;
- aporte de investidor;
- qualquer liberação de dívida.

### 14.4 Linhas obrigatórias de resultado

O fluxo e os relatórios devem apresentar separadamente:

- valor bruto contratado;
- descontos comerciais;
- valor contratado líquido;
- principal recebido;
- juros recebidos;
- Receita Bruta — VGV acumulada.

O usuário não deve precisar deduzir uma dessas grandezas a partir de uma linha ambígua.

### 14.5 Hierarquia de apresentação

```text
Valor contratado
├── Bruto
├── Descontos
└── Líquido
    └── Grupo → Tipologia

Receita Bruta — VGV
├── Pagamentos imediatos
├── Prazo fixo
├── Até marco
├── Repasse
├── Novas vendas Após-chaves
└── Juros
    └── Grupo → Tipologia
```

## 15. Permutas

### 15.1 Permuta física

A permuta física:

- reduz estoque vendável;
- não gera contratação;
- não gera recebimento;
- não gera saída de caixa no momento da transferência;
- pode ter valor econômico informativo.

A futura forma de cadastro e identificação das unidades permutadas será especificada separadamente.

> 🔄 **Evolução dependente de issue — acrescentado em 2026-08-01.** Essa "futura forma de cadastro"
> ganhou escopo: é a epic **#258** (`BUGLIST-015`), com quatro sub-issues (**#266** modelo e UI,
> **#267** fonte de verdade e migração, **#268** motor, **#269** relatórios e invariantes).
>
> **Comportamento vigente:** a quantidade permutada é informada no **catálogo de Tipologias**
> (`frontend/tela-empreendimento-tipologias.ts:212`, `schema.json:289`) e consumida pelo motor via
> `vgvPermutaFisicaLinha` (`frontend/fluxo-shared.ts:149-154`, #195). Não existe vínculo
> tipologia ↔ quantidade na linha de custo do Terreno.
>
> **Modelo funcional de referência:** ao selecionar `Permuta física`, a célula **Orçamento** passa a
> conter um single-select de tipologia e um campo de quantidade; **Distribuição** exibe "Entrega de
> unidades", bloqueada; **Cronograma, Início e Duração ficam vazios**. Uma linha representa uma
> tipologia. Depois disso — e só depois —, a coluna do catálogo é desligada pela **#253**
> (`BUGLIST-010`), que nasce bloqueada até a #267 fechar.
>
> **ADR da #266 — decidido pelo autor em 2026-08-02.** Quando a mesma tipologia tem `preco_m2`
> diferente em Grupos diferentes (`avancado_alocacoes`), a base de valoração da permuta física NÃO é
> derivada (nem média ponderada, nem "preço do Grupo de origem" — que só reintroduziria a mesma
> ambiguidade sob outro nome). É **declarada explicitamente** pelo usuário na própria linha de
> permuta, no momento de configurá-la: um valor auditável, escrito, não calculado. Funciona igual
> com 1 ou N alocações de preços diferentes para a mesma tipologia.

Até essa definição:

- o app não deve receber uma refatoração ampla improvisada;
- a documentação deve preservar o princípio econômico;
- qualquer inconsistência atual deve ser tratada em issue própria e conservadora.

### 15.2 Permuta financeira

A permuta financeira é uma saída vinculada à receita efetivamente recebida.

O aplicativo deve calcular duas visões.

#### Visão sem deduções

```text
permuta financeira bruta
= receita de caixa × % de permuta
```

#### Visão com deduções

```text
base líquida
= receita de caixa
− imposto dedutível
− corretagem dedutível
```

> **Comportamento vigente.** A permuta física já reduz unidades vendidas, VGV e Resultado no
> Avançado (#195), e a permuta financeira do Terreno já é deduzida da receita (#196), em
> `frontend/fluxo-caixa-motor.ts`. O que existe hoje é **uma visão só** — a dedução aplicada ao
> fluxo. As duas séries paralelas (bruta e líquida de imposto e corretagem) não são calculadas nem
> expostas para auditoria.
>
> ⚠️ **As duas séries que a fórmula da visão líquida consome não existem.** Não há série mensal de
> imposto (o único tributo do Avançado é o RET por Grupo, embutido no fator do recebível, e o bloco
> `regime_tributario`/`aliquota_*` é ignorado pelo motor) nem de corretagem. E o app aplica os
> descontos de forma **multiplicativa**, que é justamente o que o padrão pede para evitar quando o
> contrato determina subtração direta.
>
> **Evolução dependente de issue.** **EVI-022** precisa vir antes, produzindo `imposto_t` e
> `corretagem_t` como séries próprias. Só então EVI-018 calcula as duas visões no regime de caixa e
> declara qual delas alimenta o fluxo. O redesenho do **cadastro** da permuta física permanece fora
> do backlog por decisão do autor.
>
> 🔄 **Contrato de interface acrescentado em 2026-08-01** (item 16 da lista de bugs,
> `BUGLIST-016`), como emenda **aditiva** da **#238**. Além das duas séries, a linha de
> `Permuta financeira` passa a ter comportamento de tela definido:
>
> - **Orçamento** aceita `% VGV` **ou** `R$`, com o valor canônico da **#259**;
> - **Distribuição** é preenchida com **"Receita das vendas"** e fica **bloqueada** — mesmo padrão
>   da Corretagem;
> - **Cronograma, Início e Duração ficam vazios** (`—`): nada ali influencia a velocidade com que a
>   despesa entra no fluxo, porque ela sai **conforme a receita entra**.
>
> **Comportamento vigente a corrigir:** hoje esses campos só somem quando
> `distribuicao_modo !== 'fixo'` (`frontend/tela-fluxo-custos.ts:697-699,728-730,762-764`) — a regra
> depende da **curva de rateio**, não da subcategoria. Quem classifica a permuta como financeira é
> a subcategoria (`frontend/fluxo-caixa-motor.ts:385-387`). Ver a armadilha **A10** no Anexo D.

```text
permuta financeira líquida
= base líquida × % de permuta
```

### 15.3 Série utilizada no fluxo

O fluxo visível deve usar a visão que representa o contrato e a realidade de caixa do incorporador.

As duas visões devem permanecer disponíveis para auditoria.

### 15.4 Momento

A saída ocorre no mesmo mês em que a receita-base entra.

Não deve ser distribuída por uma curva independente quando o contrato for proporcional ao recebimento.

---

## 16. Custos, obra e despesas

### 16.1 Estrutura funcional das linhas de custo

Cada linha deve possuir:

- grupo de custo;
- categoria;
- valor ou percentual;
- unidade de orçamento;
- base de cálculo;
- modo de distribuição;
- evento ou período de ancoragem;
- início e duração, quando livres;
- curva temporal.

### 16.2 Grupos de custo

A organização funcional pode utilizar:

- Terreno;
- Obra;
- Custos Diretos;
- Custos Indiretos;
- Financeiro.

> **Comportamento vigente, alinhado ao padrão.** `avancado_linhas_custo` implementa exatamente esses
> 5 grupos (`terreno` | `obra` | `diretos` | `indireto` | `financeiro`), com `orcamento_valor` +
> `orcamento_unidade` (`rs` | `rs_m2_priv` | `rs_m2_terreno` | `pct_vgv` | `pct_receita` |
> `pct_obra`), ancoradas ao Cronograma (`cronograma_evento`, `inicio_mes`, `duracao_meses`) e a uma
> curva (`curva_id`). O campo `fase_ancora_id` (#167) é uma âncora alternativa que referencia uma
> fase do Cronograma em vez de um dos 5 eventos fixos — mutuamente exclusiva com
> `cronograma_evento`.
>
> As **curvas** (`avancado_curvas`) distribuem valores no tempo (Curva S padrão + customizadas da
> instância). A engine reamostra a curva para a duração real e normaliza para somar 100%
> (`reamostrarCurva`), com fallback `linear`.
>
> **Atenção à base.** `pct_receita` resolve hoje sobre `ctxCusto.receitaTotal`, que parte do VGV
> **bruto** (ver §12). EVI-009 precisa declarar a base de cada custo percentual **sem mudá-la
> silenciosamente**.

### 16.3 Bases possíveis

Uma linha pode ser expressa como:

- valor fixo em reais;
- R$/m² privativo;
- R$/m² de terreno;
- percentual do VGV;
- percentual da receita;
- percentual do custo da Obra.

A tela deve sempre mostrar a unidade e o total resolvido.

### 16.4 Distribuição temporal

O custo pode ser:

- pontual;
- linear;
- distribuído por curva;
- proporcional à contratação;
- proporcional ao recebimento;
- proporcional à entrega de unidades;
- ancorado a um evento do cronograma.

### 16.5 Corretagem

A corretagem segue a contratação, não o recebimento.

```text
corretagem do mês
= base contratual declarada do mês × % de corretagem
```

A base — valor bruto ou líquido contratado — precisa ser explícita e única. A despesa não pode ser simultaneamente dedução embutida no recebível e linha de custo.

### 16.6 Impostos

Impostos sobre receita seguem o caixa recebido, conforme o regime configurado.

```text
imposto do mês
= receita tributável recebida no mês × alíquota
```

### 16.7 Construção e gestão

Construção e gestão da construção devem permanecer linhas distintas.

O custo da gestão não pode ser embutido no custo por m² e lançado novamente como percentual.

### 16.8 Obra e curvas

A tela de Obra deve permitir visualizar:

- custo mensal projetado;
- custo acumulado;
- avanço físico ou financeiro;
- gestão da Obra, quando destacada;
- aderência entre cronograma e fluxo de custos.

Curvas personalizadas devem conservar 100% do valor distribuído.

### 16.9 Custos obrigatórios

Linhas consideradas obrigatórias pelo produto devem existir uma única vez ou possuir uma regra clara de oficialização.

A interface deve impedir duplicação acidental de categorias obrigatórias sem bloquear linhas adicionais legítimas com outra finalidade.

---

## 17. Funding e estrutura de capital

> 🔄 **Atualizado em 2026-08-01.** O modelo funcional completo de funding — Capital Stack por
> instrumentos, waterfall de pagamentos, retorno por provedor de capital e reconciliação mensal —
> passou a viver em documento próprio: **[Funding, Capital Stack e Retorno do Capital](funding-capital-stack)**.
> Esta seção continua sendo a visão funcional resumida dentro do padrão; o documento novo é a
> especificação vinculante da epic **#239** e das dez sub-issues **#270–#279** (FIN-01…FIN-10).
>
> **Comportamento vigente, inalterado:** a aba `Viabilidade → Financeiro` é **inerte**. O Bloco G
> inteiro — ~25 colunas de financiamento, estrutura de capital, investidor e correção — é
> persistido e renderizado, mas o motor **não referencia nenhuma delas** (grep = 0 em
> `frontend/fluxo-caixa-motor.ts`, `frontend/proforma.ts` e `frontend/fluxo-shared.ts`). Nada
> descrito abaixo, nem no documento novo, está implementado.
>
> **Decisão registrada (2026-08-01):** o alvo do Capital Stack é a aba **`Viabilidade → Financeiro`**
> (`frontend/tela-financeiro.ts`). O grupo de custos `Custos → Financeiro` permanece sendo despesa
> financeira operacional e **não** é absorvido pelo Capital Stack.

### 17.1 Separação entre projeto e capital

O app deve permitir duas leituras:

- **fluxo de caixa livre do projeto**, antes de funding;
- **fluxo final**, depois dos instrumentos financeiros.

### 17.2 Financiamento à produção

É uma dívida da incorporadora destinada a financiar custos do empreendimento.

O estudo completo deve conseguir representar:

- base de custos financiáveis;
- exposição mínima;
- percentual financiado;
- limite;
- liberação mensal;
- juros;
- amortização;
- saldo devedor;
- quitação.

> **Comportamento vigente — a aba Financeiro inteira é inerte.** Não são só os campos de
> financiamento: é o **Bloco G completo**. `schema.json` declara e `frontend/tela-financeiro.ts`
> renderiza controles para financiamento à produção (`financiamento_*`), estrutura de capital
> (`estrutura_*_pct`), investidor (`investidor_*`), regime tributário
> (`regime_tributario`, `aliquota_*_pct`, `imposto_sobre_permuta_fisica`) e correção
> (`indice_correcao`, `juros_financeiros_aa`, …). **O motor não lê nenhum deles** —
> `backend/rotas/estudos.ts` os trata apenas como colunas persistíveis. O usuário preenche uma aba
> inteira que não altera número nenhum, sem qualquer aviso.
>
> Isso viola a convenção do monorepo de que **UI e API andam sempre juntas**: capacidade que existe
> na tela tem que existir no cálculo, e vice-versa.
>
> **Há ainda duas entradas fiscais concorrentes.** O único imposto que o Avançado aplica é o **RET
> por Grupo**, marcado no modal de Fluxo de Pagamento e **desligado por default** — enquanto o bloco
> de regime tributário desta aba fica sem uso. A Proforma (Preliminar) usa uma terceira regra,
> `sujeito_ret`/`imposto_percentual`.
>
> **Evolução dependente de issue.** **EVI-022** resolve o eixo fiscal (escolhe a entrada oficial e
> cria a série mensal de imposto). **EVI-019** decide, campo a campo, o destino do funding —
> **integrar ou remover as duas pontas**. Manter como está não é opção, e todo campo que não for
> implementado sai da tela.

### 17.3 Repasse não é financiamento à produção

| Operação | Devedor econômico | Função |
|---|---|---|
| **Financiamento à produção** | Incorporadora ou SPE | Financiar a construção e custos elegíveis |
| **Repasse** | Comprador, financiado pelo banco | Liquidar o saldo do cliente junto à incorporadora |

O repasse pode gerar caixa utilizado para amortizar o financiamento à produção, mas as duas linhas devem permanecer separadas.

### 17.4 Capital de giro e investidores

Quando utilizados, precisam ter:

- mês de entrada;
- valor;
- taxa;
- prazo;
- carência;
- regra de remuneração;
- pagamentos;
- saldo final.

### 17.5 Funding não integra VGV

Liberações de funding entram no caixa financeiro, não na Receita Bruta — VGV.

### 17.6 Situação funcional

O app pode possuir campos de funding ainda não integrados integralmente ao motor. O padrão funcional registra a estrutura esperada, mas a incorporação de cada instrumento ao cálculo deve ocorrer por issues pequenas e testadas.

---

## 18. Motor mensal e horizonte do estudo

### 18.1 Linha do tempo do cálculo

O motor calcula mês a mês, mas a unidade financeira elementar é a safra.

A sequência funcional é:

1. classificar o mês no cronograma;
2. identificar janelas de absorção;
3. calcular área contratada por Grupo e alocação;
4. baixar estoque;
5. calcular valor bruto contratado;
6. calcular descontos e valor contratado líquido;
7. calcular corretagem;
8. identificar vendas pré ou pós-entrega;
9. decompor contratos pré-entrega em componentes;
10. registrar pagamentos imediatos;
11. criar safras de prazo fixo;
12. criar safras até marco;
13. criar saldos concentrados;
14. processar pagamentos e juros de todas as safras ativas;
15. liquidar repasse no primeiro mês Após-chaves;
16. consolidar carteiras;
17. consolidar principal, juros e Receita Bruta;
18. calcular impostos;
19. calcular permuta financeira;
20. distribuir os demais custos;
21. formar o fluxo de caixa livre;
22. processar financiamento à produção;
23. processar outros instrumentos;
24. formar o fluxo final;
25. atualizar acumulados e indicadores;
26. executar validações de fechamento.

### 18.2 Horizonte derivado

O horizonte precisa alcançar o último evento relevante de todas as safras.

```text
fim do fluxo
= máximo entre:
  fim das vendas Após-chaves,
  última parcela de cada componente de prazo fixo,
  marco final de cada componente até marco,
  pagamento concentrado ou repasse,
  manutenção pós-obra,
  último custo,
  quitação de funding,
  demais obrigações
```

### 18.3 Constantes e parâmetros

- Modalidade curta: 36 parcelas.
- Após-chaves: 12 meses.
- Primeiro vencimento recorrente: defasagem padrão de 1 mês.
- Juros no mês da contratação: padrão falso.

Prazos longos, marcos e taxas são premissas do plano de pagamento.

### 18.4 Proteção contra truncamento

O app não deve deslocar recebimentos excedentes para o último mês apenas para caber em um array predefinido.

Quando um vencimento ultrapassar o horizonte, o horizonte deve ser ampliado.

> **Comportamento vigente.** `frontend/fluxo-caixa-motor.ts` deriva o prazo sem considerar todas as
> parcelas e possui fallback que empilha excedentes no último mês.
>
> **Evolução dependente de issue.** EVI-011 / #231 deve dimensionar o horizonte a partir dos
> componentes normalizados e remover o fallback silencioso.

### 18.4.1 Visão Mensal e Anual da tela

A tela oferece dois modos de exibição.

- **Mensal:** uma coluna por mês.
- **Anual:** soma das séries mensais em anos-calendário.

A agregação anual é somente visual. VPL, TIR, payback, exposição e carteiras são calculados sobre o fluxo mensal.

### 18.5 Precisão e arredondamento

- Cálculos internos usam precisão financeira suficiente.
- Arredondamento de exibição não altera somas econômicas.
- A última parcela de cada safra pode absorver resíduo imaterial.
- A tolerância precisa ser documentada.
- Uma divergência deve indicar primeira linha, safra e mês afetados.

### 18.6 Visão anual

Na visão anual:

- receitas, descontos, juros e custos são somados;
- carteira e acumulados usam o saldo do último mês do período;
- indicadores permanecem os mesmos da visão mensal.

## 19. Resultados, indicadores e visualizações

### 19.1 KPIs principais

O Resumo e o Fluxo devem exibir:

- Receita Bruta — VGV;
- valor bruto contratado;
- descontos comerciais;
- valor contratado líquido;
- juros recebidos;
- custo total;
- resultado;
- margem;
- TIR;
- VPL;
- payback;
- exposição máxima;
- carteira máxima;
- endividamento máximo.

> **Comportamento vigente (#241).** O app calcula Resultado, margens, ROI,
> VPL, TIR, Payback, Exposição máxima e Receita Bruta — VGV. VGV Vendável
> permanece um KPI separado. Contratação, recebimentos, carteira e funding são
> blocos distintos na tabela e nas exportações mensal/anual. As séries
> comerciais também alimentam um gráfico próprio, sem recálculo na UI.

### 19.2 Exposição máxima

```text
exposição máxima
= menor valor do caixa acumulado
```

A tela deve apresentar:

- valor;
- mês ou data;
- curva que conduz ao pico negativo.

### 19.3 Tabela mensal

A tabela deve permitir expansão hierárquica.

#### Contratação

```text
Valor contratado
├── Bruto
├── Descontos
├── Líquido
└── Grupo → Tipologia
```

#### Recebimentos

```text
Receita Bruta — VGV
├── À vista
├── Tabela curta
├── Tabela longa — Obra
├── Repasse
├── Após-chaves
├── Principal
└── Juros
    └── Grupo → Tipologia
```

#### Carteira

```text
Carteira de clientes
├── Curta
├── Longa — Obra
└── Saldo a repassar
```

#### Custos

```text
Custo Total
├── Terreno
├── Obra
├── Diretos
├── Indiretos
└── Financeiro
```

#### Consolidação

```text
Fluxo de Caixa Livre
Funding
Fluxo Final
Caixa Acumulado
Carteira
Endividamento
```

### 19.4 Colunas fixas

Antes das colunas mensais, a tabela deve apresentar, quando aplicável:

- Total;
- VPL;
- percentual da base;
- unidade;
- regra de pagamento;
- prazo ou marco;
- outros atributos necessários à leitura.

### 19.5 Filtros

A visualização pode permitir:

- global;
- por Grupo;
- por tipologia;
- por componente;
- mensal;
- anual;
- expandir ou recolher hierarquia.

O filtro não altera o cálculo.

### 19.6 Gráficos

Gráficos úteis incluem:

- contratação bruta e líquida;
- receita e custo mensal;
- principal e juros;
- fluxo mensal;
- caixa acumulado;
- avanço da Obra;
- composição de custos;
- absorção acumulada;
- carteira por componente;
- endividamento;
- comparação de cenários.

Marcos do cronograma devem aparecer na mesma régua temporal dos dados.

> **Implementação #241.** O gráfico econômico confronta Venda líquida
> contratada, Receita Bruta — VGV, Carteira de clientes e Repasse. Na visão
> anual, fluxos são somados e saldos de carteira usam o fechamento do período;
> os KPIs continuam derivados do cálculo mensal.

## 20. Cenários, mercado e apoio à decisão

### 20.1 Cenários

O app pode aplicar variações sobre o estudo-base, como:

- preço de venda;
- custo da Obra;
- outras premissas aprovadas futuramente.

Cada cenário deve:

- manter as demais premissas constantes;
- recalcular todo o fluxo;
- mostrar a diferença para o base;
- preservar o estudo-base sem mutação.

### 20.2 Análise de sensibilidade

A sensibilidade mostra o efeito de uma premissa variada dentro de limites definidos.

Ela não substitui um cenário completo e não deve alterar permanentemente as premissas.

> **Comportamento vigente, alinhado ao padrão.** `avancado_cenarios` guarda variações nomeadas por
> dois eixos: `preco_venda_pct` e `custo_obra_pct`. Cada cenário reaplica o motor sobre o mesmo
> estudo com esses deltas, sem mutar o estudo-base.
>
> Na aba Proforma, a **sensibilidade** estressa **uma** variável (preço/m², permuta física,
> permuta financeira ou custo de obras na Incorporação) e exibe **Bear** (`base × (1 − var⁻)`),
> **Base** e **Bull** (`base × (1 + var⁺)`) lado a lado. O MVP é **unidimensional**. As faixas vêm
> do benchmark (`variacao_positiva_pct`/`_negativa_pct`), sobrescrevíveis por estudo
> (`sensibilidade_variacao_*_pct`).

### 20.3 Análise de Mercado

O módulo deve separar:

- **lado do projeto**, derivado do próprio estudo;
- **lado do mercado**, obtido de fontes externas ou snapshot validado.

A procedência dos dados de mercado deve ficar visível.

### 20.4 Apelo Comercial

A análise qualitativa por IA é apoio à decisão, não substituto do EVI.

Ela deve utilizar documentos e informações fornecidos, manter a rastreabilidade das fontes e não modificar premissas financeiras automaticamente.

---

## 21. Validações funcionais e invariantes

### 21.1 Validações de entrada

| Regra | Condição |
|---|---|
| Tipologia inválida | Área, quantidade ou preço incompatíveis com a operação |
| Saldo excedido | Soma das alocações ultrapassa o estoque disponível |
| Absorção inválida | Pré-lançamento + Lançamento + Durante a obra > 100% |
| Desconto inválido | Desconto negativo ou superior ao valor bruto |
| Plano inválido | Participações dos componentes não fecham 100% |
| Sinal inválido | Sinal fora do intervalo de 0% a 100% do componente |
| Prazo inválido | Prazo fixo não positivo |
| Primeiro vencimento inválido | Defasagem negativa ou parcela no ato não explicitada |
| Marco inválido | Marco anterior ao primeiro vencimento |
| Cronograma inválido | Lançamento ou período comercial fora da Obra |
| Funding inválido | Percentual, limite ou prazo incoerente |

> **Comportamento vigente (#240).** As validações de entrada continuam junto
> aos editores. A saída do motor também passa por um validador puro de
> reconciliação, com tolerância monetária de R$ 0,01 e diagnóstico estruturado.

### 21.2 Invariantes de produto

```text
soma das alocações por tipologia
≤ estoque vendável da tipologia
```

```text
estoque final ≥ 0 em todos os meses
```

```text
estoque final = 0 ao fim da absorção de 100%
```

### 21.3 Invariantes de contratação

```text
valor bruto contratado
= Σ área contratada × preço por m²
```

```text
valor contratado líquido
= valor bruto contratado − descontos
```

```text
Σ componentes da safra
= valor contratado líquido da safra
```

### 21.4 Invariantes de recebimento

Por safra:

```text
sinal + principal financiado
= valor do componente
```

```text
Σ amortizações = principal
```

```text
Σ pagamentos = principal + juros
```

No empreendimento:

```text
Receita Bruta — VGV
= Σ recebimentos mensais
```

```text
Receita Bruta — VGV
= valor contratado líquido acumulado + juros recebidos
```

### 21.5 Invariantes de carteira

- cada safra começa com o principal correto;
- juros incidem no período correto;
- nenhum saldo é negativo;
- cada safra zera no último vencimento;
- nenhum saldo volta a crescer depois do encerramento;
- carteira total é a soma dos componentes;
- carteira total termina em zero.

### 21.6 Invariantes do repasse

- ocorre em um único mês;
- ocorre no primeiro mês Após-chaves;
- liquida o saldo integral;
- a taxa pode ser zero ou positiva;
- a convenção de juros é explícita;
- não é funding;
- não recebe contratos novos depois da entrega.

### 21.7 Invariantes de funding

- cada dívida termina em zero;
- liberações não integram Receita Bruta;
- amortizações não reduzem custos operacionais;
- juros financeiros permanecem identificáveis;
- fluxo final reconcilia com fluxo livre e funding.

### 21.8 Cenários dourados

A suíte de referência deve incluir dois casos Calliandra.

#### Prazo fixo

Valores mínimos de conferência:

| Mês | Receita esperada |
|---:|---:|
| 1 | R$ 878.539,92 |
| 2 | R$ 914.119,61 |
| 3 | R$ 949.699,31 |
| 4 | R$ 985.279,01 |
| 13 | R$ 355.796,98 |
| 38 | R$ 344.737,04 |
| 132 | R$ 18.389,82 |
| 133 | R$ 0,00 |

#### Até Obra + repasse

| Mês | Receita esperada |
|---:|---:|
| 1 | R$ 356.846,75 |
| 2 | R$ 372.361,83 |
| 3 | R$ 388.582,14 |
| 12 | R$ 582.045,90 |
| 13 a 24 | R$ 254.936,38 por mês |
| 25 | R$ 19.983.418,20 |

O teste deve identificar a primeira linha, safra e mês divergente.

### 21.9 Alertas não bloqueantes

O app deve alertar sobre:

- custo fora de benchmark;
- eficiência atípica;
- absorção agressiva;
- desconto elevado;
- concentração no repasse;
- prazo longo de carteira;
- ausência de contingência;
- exposição acima da capacidade de capital.

### 21.10 Mensagens

A mensagem de validação deve informar:

- o que está errado;
- onde está o campo;
- qual regra foi violada;
- qual valor foi encontrado;
- qual safra ou mês foi afetado;
- o que precisa ser corrigido.

### 21.11 Relatório de reconciliação implementado

Cada divergência contém `codigo`, `severidade`, `esperado`, `encontrado`,
`diferenca` e, quando aplicável, `linha`, `safra` e `mes`. A tela de Fluxo de
Caixa executa o relatório a cada recálculo e o inclui nas exportações CSV e
PDF. A ausência de divergências é registrada explicitamente como estudo
reconciliado.

`erro` identifica quebra de uma identidade matemática ou estado impossível
(estoque/carteira/dívida negativos, saldo terminal indevido ou fluxo que não
fecha). `alerta` identifica uma premissa economicamente possível, porém
agressiva — por exemplo, lacuna de funding — e não é confundido com defeito de
implementação. Juros de dívida capitalizados permanecem no saldo e não são
contados uma segunda vez como saída de caixa.

## 22. Exportação, auditabilidade e reprodutibilidade

### 22.1 Formatos

O app pode exportar:

- PDF;
- CSV compatível com Excel;
- outros formatos aprovados futuramente.

### 22.2 Fidelidade

O relatório deve refletir exatamente:

- premissas vigentes;
- valores calculados na tela;
- visão mensal ou anual selecionada;
- hierarquia de Grupos e tipologias;
- componentes de pagamento;
- indicadores do mesmo cálculo-base.

### 22.3 Conteúdo mínimo do estudo avançado

- identificação e versão do estudo;
- cronograma;
- tipologias;
- Grupos e alocações;
- absorção;
- plano de pagamento;
- valor bruto contratado;
- descontos;
- valor contratado líquido;
- Receita Bruta — VGV;
- principal e juros;
- carteiras;
- repasse;
- custos;
- funding;
- fluxo mensal;
- indicadores;
- alertas relevantes.

### 22.4 Visão de auditoria por safra

O relatório de diagnóstico deve permitir rastrear, ao menos em formato técnico:

- Grupo;
- tipologia;
- mês da contratação;
- componente;
- principal;
- sinal;
- primeiro vencimento;
- prazo ou marco;
- parcela;
- juros;
- saldo final.

A apresentação executiva pode permanecer consolidada. A visão por safra é necessária para explicar divergências.

### 22.5 Reprodutibilidade

Uma exportação deve conter informação suficiente para que o estudo seja conferido sem depender apenas da tela.

Quando um resultado for derivado, o relatório deve identificar a premissa ou base que o originou.

### 22.6 CSV não é modelo de dados

Meses podem aparecer como colunas no relatório. Isso não significa que a persistência interna deva criar uma coluna para cada mês.

O relatório é uma visão horizontal de séries temporais; o modelo interno deve continuar extensível.

## 23. Jornadas principais do usuário

### Jornada 1 — Criar o estudo

1. Criar novo estudo.
2. Escolher Incorporação.
3. Escolher Preliminar ou Avançado.
4. Selecionar origem do terreno.
5. Vincular lotes ou informar terreno manual.
6. Definir membros.
7. Salvar como Rascunho.

### Jornada 2 — Definir o produto

1. Preencher informações do empreendimento.
2. Configurar cronograma.
3. Cadastrar tipologias.
4. Conferir área, unidades e vagas.
5. Validar coerência com potencial construtivo.

### Jornada 3 — Montar a estratégia comercial

1. Criar o 1º Grupo.
2. Alocar tipologias e quantidades.
3. Informar preço por m² de cada alocação.
4. Conferir preço unitário, VGV e saldo.
5. Configurar absorção.
6. Configurar fluxo de pagamento.
7. Criar novos Grupos quando houver preço ou condição diferente.
8. Conferir que todo o estoque vendável foi alocado.

### Jornada 4 — Montar custos e Obra

1. Revisar linhas obrigatórias.
2. Informar valores e bases.
3. Escolher curvas e ancoragens.
4. Conferir custo total resolvido.
5. Revisar cronograma e avanço da Obra.

### Jornada 5 — Configurar funding

1. Informar financiamento à produção.
2. Informar capital de giro ou investidor, quando houver.
3. Conferir liberações e amortizações.
4. Verificar quitação final.

### Jornada 6 — Analisar o fluxo

1. Abrir a visão mensal.
2. Conferir valor bruto contratado, descontos e valor líquido.
3. Conferir pagamentos imediatos e parcelas das safras.
4. Conferir receita, juros e repasse.
5. Conferir carteiras.
6. Conferir custos e funding.
7. Ver exposição, VPL, TIR e payback.
8. Alternar para visão anual sem alterar KPIs.
9. Expandir Grupos, tipologias e componentes quando necessário.

### Jornada 7 — Decidir e reportar

1. Rodar cenários.
2. Consultar análise de mercado.
3. Revisar alertas.
4. Exportar relatório.
5. Submeter para análise.
6. Aprovar, reprovar ou devolver ao Rascunho.

---

## 24. Aderência geral do app atual ao padrão

Esta seção é diagnóstica. Ela não substitui o documento de issues e não autoriza mudanças diretas.

A auditoria original está em `docs/rodada-5-evi-2026-07-31.md`. A validação posterior dos recebíveis acrescenta uma segunda conclusão: o motor-alvo precisa ser **por safras e componentes**, e algumas premissas dos corpos já abertos devem ser corrigidas antes da implementação.

### 24.1 Estruturas já alinhadas

O desenho atual possui fundamentos adequados:

- catálogo de tipologias;
- Grupos com várias tipologias;
- alocações de quantidade e preço por m²;
- tipologia repetida em Grupos diferentes;
- absorção e plano de pagamento pertencentes ao Grupo;
- cálculo mensal;
- visão anual como agregação;
- hierarquia por Grupo e tipologia;
- permissões, ciclo de vida, cenários e exportação;
- integração com o UrbiVerso.

Esses fundamentos devem ser preservados.

### 24.2 Lacunas do motor de recebíveis

O runtime atual:

- distribui valor nominal por linhas genéricas;
- não cria safras;
- não calcula PMT;
- não separa prazo fixo de prazo até marco;
- não controla primeiro vencimento de forma econômica;
- não possui descontos como série;
- não possui principal e juros separados;
- não possui carteira real;
- trata repasse como vencimento residual;
- pode truncar valores no último mês.

### 24.3 Correção de premissas anteriores

A reconciliação com Calliandra corrige os seguintes pontos:

- a primeira parcela recorrente ocorre no mês seguinte à venda;
- pagamento no próprio mês deve ser imediato e explícito;
- uma tabela longa pode ser prazo fixo, como 120 meses;
- um fluxo até a Obra + repasse é outro modelo;
- desconto comercial reduz a base antes dos juros;
- a carteira deve ser derivada por safra;
- Urbitá serve como referência de sobreposição de recebimentos, mas não de carteira.

### 24.4 Issues que precisam de revisão documental

Antes de implementação, revisar:

- #220;
- #227;
- #229;
- #230;
- #231;
- #232;
- #233;
- #234;
- #236;
- #237;
- #240;
- #241.

A revisão pode ser feita por atualização dos corpos ou comentários de escopo aprovados. Nenhuma mudança de runtime deve começar com uma premissa desatualizada.

### 24.5 Funding e permutas

As conclusões anteriores permanecem:

- financiamento à produção é separado do repasse;
- permuta física não gera caixa;
- permuta financeira acompanha recebimentos;
- o Bloco Financeiro ainda precisa de decisão de integração ou remoção.

### 24.6 Conversão em mudanças

Cada evolução deve preservar:

- leitura de dados existentes;
- compatibilidade com o UrbiVerso;
- testes atuais;
- rastreabilidade entre documento, issue, código e resultado;
- comparação contra os dois cenários dourados.

## 25. Limites deste documento e governança de mudanças

### 25.1 O que este documento define

- terminologia funcional;
- relações entre as informações;
- comportamento econômico esperado;
- jornadas;
- validações;
- saídas e resultados.

### 25.2 O que este documento não define

- nomes de tabelas;
- formato de schema;
- rotas;
- contratos HTTP;
- componentes Lit;
- arquivos de código;
- migrações;
- ordem de commits;
- estratégia de release.

### 25.3 Proteção ao app existente

A evolução deve:

- preservar estudos já criados;
- manter compatibilidade de leitura;
- evitar renomeações internas desnecessárias;
- respeitar o shell e o SDK do UrbiVerso;
- validar schema e migrações;
- manter testes existentes verdes;
- adicionar testes para cada nova regra;
- dividir mudanças em escopo pequeno.

### 25.4 Documentação não é autorização de implementação

A existência de uma regra neste arquivo não é autorização suficiente para alterar o código.

A implementação ocorrerá somente quando:

1. a diferença estiver listada como issue;
2. o escopo estiver aprovado;
3. os contratos do UrbiVerso tiverem sido lidos;
4. o impacto estiver compreendido;
5. os testes estiverem definidos.

---

## 26. Critérios funcionais de aceite

O aplicativo estará funcionalmente aderente quando demonstrar os pontos abaixo em estudos controlados.

### 26.1 Produto e Grupos

- Tipologias são cadastradas uma vez.
- Uma tipologia pode ser alocada em vários Grupos.
- Um Grupo pode conter várias tipologias.
- Preço por m² pertence à alocação.
- Saldo global não pode ser excedido.
- Grupo não possui calendário próprio.

### 26.2 Absorção

- Existem Pré-lançamento, Lançamento, Durante a obra e Após-chaves.
- Após-chaves é residual e dura 12 meses.
- A soma final é 100%.
- A curva é aplicada a todas as alocações do Grupo.
- A Obra física e a faixa comercial Durante a obra não são confundidas.

### 26.3 Contratação

- Existem valor bruto, desconto e valor líquido.
- A contratação é mensal e aberta por Grupo e tipologia.
- Contratação baixa estoque e calcula corretagem.
- Contratação não inclui juros futuros.
- A soma fecha com área × preço − descontos.

### 26.4 Plano de pagamento

- Componentes fecham 100% do valor líquido.
- O app suporta imediato, prazo fixo, até marco e concentrado.
- Curta possui 36 parcelas.
- Longa de prazo fixo pode possuir outro prazo, como 120.
- Primeiro vencimento recorrente é no mês seguinte, salvo exceção explícita.
- Juros no mês da contratação são configuração explícita.
- Novas vendas Após-chaves entram integralmente no mês.

### 26.5 Safras e carteira

- Cada mês de venda cria safras.
- As parcelas de safras diferentes se sobrepõem corretamente.
- Cada safra possui principal, juros, pagamento e saldo.
- Nenhum saldo é negativo.
- Cada safra zera no último vencimento.
- Carteira total fecha com a soma dos componentes.
- Carteira final é zero.

### 26.6 Repasse

- O repasse é pagamento concentrado no primeiro mês Após-chaves.
- Taxa zero e taxa positiva funcionam.
- A convenção de juros é explícita.
- O repasse zera o saldo.
- Não é financiamento à produção.

### 26.7 Receita Bruta — VGV

- É a soma de todos os recebimentos dos clientes.
- Inclui juros.
- Não inclui funding.
- Reconcilia com valor líquido contratado mais juros.
- Reconcilia com valor bruto menos descontos mais juros.
- Pode ser aberta por Grupo, tipologia e componente.

### 26.8 Custos e funding

- Corretagem acompanha contratação.
- Imposto acompanha recebimento.
- Custos respeitam curvas.
- Financiamento à produção possui fluxo separado.
- Dívidas terminam zeradas.

### 26.9 Resultados e referência

- Fluxo mensal fecha.
- Visão anual não altera KPIs.
- TIR, VPL, payback e exposição derivam do fluxo mensal.
- Exportação reproduz a tela.
- Os dois cenários Calliandra são reproduzidos dentro da tolerância.
- A primeira divergência é identificável por linha, safra e mês.

## 27. Glossário funcional

| Termo | Definição |
|---|---|
| **Absorção** | Distribuição percentual das vendas contratadas pelos períodos globais |
| **Alocação** | Quantidade de uma tipologia destinada a um Grupo, com preço por m² |
| **Após-chaves** | Período fixo de 12 meses após a entrega |
| **Carteira** | Soma dos saldos econômicos ainda devidos pelos clientes |
| **Componente até marco** | Parte do contrato paga em parcelas que terminam num marco comum |
| **Componente concentrado** | Parte do contrato liquidada num único mês |
| **Componente de prazo fixo** | Parte do contrato paga em quantidade fixa de parcelas por safra |
| **Desconto comercial** | Redução do preço de tabela antes da formação do recebível |
| **Durante a obra** | Período comercial entre o fim do Lançamento e o fim da Obra |
| **Estudo Avançado** | Estudo com dimensão temporal, recebíveis, funding e retorno |
| **Estudo Preliminar** | Estudo estático de produto, preço, custo e resultado |
| **Evento do cronograma** | Marco ou janela temporal global |
| **Financiamento à produção** | Dívida da incorporadora para financiar custos elegíveis |
| **Grupo** | Agrupamento comercial de estoque, preço, absorção e pagamento |
| **Juros do cliente** | Remuneração pelo financiamento direto concedido pela incorporadora |
| **Obra física** | Execução construtiva do empreendimento |
| **Pagamento imediato** | À vista, entrada, sinal ou parcela no ato |
| **Permuta financeira** | Pagamento proporcional ao recebimento, com visão bruta e líquida |
| **Permuta física** | Transferência de área ou unidades, sem receita de caixa |
| **PMT** | Parcela periódica calculada por principal, taxa e prazo |
| **Primeiro vencimento** | Primeiro mês de parcela recorrente; padrão mês seguinte à venda |
| **Receita Bruta — VGV** | Soma de todos os recebimentos dos clientes, inclusive juros |
| **Repasse** | Liquidação bancária concentrada no primeiro mês Após-chaves |
| **Safra** | Contratos originados no mesmo mês, Grupo, alocação e componente |
| **Tabela curta** | Componente de prazo fixo com 36 parcelas |
| **Tabela longa de prazo fixo** | Financiamento direto longo, como 120 parcelas |
| **Tabela longa com repasse** | Pagamento durante a Obra combinado com saldo concentrado |
| **Tipologia** | Conjunto homogêneo de unidades com área e características próprias |
| **Valor bruto contratado** | Área contratada × preço por m², antes de descontos |
| **Valor contratado líquido** | Valor bruto menos descontos, sem juros futuros |

### 27.1 Termos do app não cobertos acima

Preservados do vocabulário vigente:

| Termo | Definição |
|---|---|
| **Área privativa** | Área de propriedade exclusiva da unidade |
| **Área vendável líquida** | Área/VGV disponível após a permuta física |
| **Apelo Comercial** | Análise qualitativa por IA do imóvel |
| **Benchmark** | Indicador de referência por tipo de empreendimento |
| **Exposição máxima** | Maior saldo negativo do fluxo acumulado |
| **Nível de análise** | `preliminar` ou `avancado` |
| **Outorga onerosa** | Contrapartida pelo potencial acima do coeficiente básico |
| **Preço Sugerido/m²** | Menor preço para atingir o piso do benchmark |
| **RET** | Regime Especial de Tributação |
| **VGV potencial** | Área privativa fechada × preço, antes dos recebimentos |
| **Fase** | Termo legado da interface para Grupo comercial ou marcador de cronograma, conforme o contexto |

## Anexo A — Convenções de cálculo do app

Decisões metodológicas explícitas. Um cálculo que as adote diferente produz números não comparáveis
com os do estudo.

| # | Convenção | Onde vive |
|---|---|---|
| **C1** | **VGV da Incorporação usa as áreas fechadas.** `VGV = área_pvt_r_fechada × preço residencial + área_pvt_nr_fechada × preço não residencial`. Áreas abertas (varandas/terraços) entram na área privativa, mas não somam VGV direto. | `formulas.md`, `proforma.ts` |
| **C2** | **Custo do terreno incide sobre a área do terreno**, não sobre a privativa: `custo_terreno_m2 × área do terreno`, zerável pelo `considerar_custo_terreno`. | `proforma.ts` (cabeçalho) |
| **C3** | **Receita positiva, custos positivos nos arrays; o sinal entra na consolidação** (`fluxo = receita − custo`). A Proforma e o Fluxo somam linhas, nunca invertem sinal na apresentação. | `fluxo-caixa-motor.ts` |
| **C4** | **No Avançado, o tempo é em meses relativos 0-based**: mês 0 = `data_inicio_projeto`; o índice do array mensal coincide com o número do mês. **Não há meses negativos.** | `fluxo-caixa-motor.ts` |
| **C5** | **Permuta física não entra no fluxo** — reduz a área/VGV vendável do incorporador. **Permuta financeira é dedução da receita**, % do VGV residencial/não residencial (ou valor fixo). | `proforma.ts`, `formulas.md` |
| **C6** | **Imposto segue o regime tributário**: `4%` quando `sujeito_ret`, senão `imposto_percentual`. Corretagem, marketing e permutas financeiras são deduções da receita antes dos custos. | `formulas.md`, schema |
| **C7** | **Todo valor monetário resultado de fórmula tem 2 casas decimais** — na apresentação, na entrada e no motor. O **valor canônico** de uma premissa multiunidade é o monetário; `% do VGV` e `R$/m²` são representações **derivadas**, que carregam precisão plena internamente e arredondam só para exibir. Contrato do autor, 2026-08-01. **Ainda não implementado:** a tela usa 0 casas (`viab-format.ts:8`) e a exportação usa 2 (`exportar.ts:9`) — ver #259, #260 e #281. | `formulas.md`, `viab-format.ts`, `premissas-conversao.ts` |

## Anexo B — Dicionário de premissas (campos reais)

Nomes em **snake_case, em português**, exatamente como no `schema.json`. Valores monetários e áreas
em `decimal(12,2)`; percentuais de entrada em `decimal(5,2)`; scores em `decimal(3,1)`. Percentuais
são **digitados como número inteiro/decimal** (ex.: `7` = 7%), não como fração.

**Identidade & ciclo:** `id_legivel`, `nome`, `nome_exibicao`, `tipo_empreendimento` (`incorporacao`), `uf`, `sequencia`, `nivel_analise` (`preliminar`\|`avancado`), `status`, `autor_id`, `origem_terreno` (`nucleo`\|`manual`).

**Produto:** `area_terreno_nucleo`, `terreno_manual_area`, `coef_aproveitamento_basico`, `coef_aproveitamento_maximo`, `gabarito_maximo`, `area_pvt_r_fechada`, `area_pvt_r_aberta`, `area_pvt_nr_fechada`, `area_pvt_nr_aberta`, `area_comum_total`, `num_unidades`, `num_unidades_residencial`, `num_unidades_nao_residencial`.

**Preços:** `preco_venda_m2_residencial`, `preco_venda_m2_nao_residencial`, `valor_venal_terreno_m2`.

**Deduções:** `sujeito_ret`, `imposto_percentual`, `corretagem_percentual`, `marketing_percentual`, `permuta_financeira_residencial_pct`/`_modo`/`_valor`, `permuta_financeira_nao_residencial_pct`/`_modo`/`_valor`.

**Custos diretos:** `considerar_custo_terreno`, `custo_terreno_m2`, `projetos_modo`/`_pct`/`_valor_fixo`, `licenciamento_modo`/`_pct`/`_valor_fixo`, `construcao_modo`/`custo_construcao_m2`/`construcao_valor_total`, `taxa_gestao_pct`, `custo_decoracao_m2`, `incorporacao_registro_pct`, `manutencao_pct`, `contingencias_pct`.

**Custos indiretos:** `marketing_global_pct`, `gestao_indiretos_pct`, `stand_vendas_valor` (Loteamento).

**Permuta física:** `permuta_fisica_modo`/`_area_m2`/`_pct` e `permuta_fisica_nr_modo`/`_nr_area_m2`/`_nr_pct`.

**Sensibilidade & desconto:** `sensibilidade_variacao_positiva_pct`, `sensibilidade_variacao_negativa_pct`, `taxa_desconto_aa`, `data_inicio_projeto`.

**Funding (Avançado):** `estrutura_capital_proprio_pct`, `estrutura_financiamento_pct`, `estrutura_investidores_pct`, `financiamento_obra_pct`, `financiamento_juros_aa`, `financiamento_sistema_amortizacao`, `financiamento_prazo_meses`, `financiamento_carencia_meses`, `investidor_aporte_valor`, `investidor_retorno_tipo`, `investidor_juros_aa`, `investidor_carencia_meses`, `investidor_parcelas`, `regime_tributario`, `aliquota_*_pct`, `indice_correcao`/`_taxa_aa`, `juros_financeiros_aa`, `juros_inicio_cobranca_mes`.

> ⚠️ **Todo o Bloco G acima é inerte no Avançado**: financiamento, estrutura de capital, investidor,
> regime tributário e correção estão declarados e têm controle na tela, mas o motor **não lê nenhum
> deles**. Ver §17.2, EVI-019 (funding) e EVI-022 (regime tributário).

Para os campos das tabelas `avancado_*`, ver [Modelo de Dados](modelo-de-dados).

## Anexo C — Modelo de dados

O registro central é a tabela `estudos` (`soft_delete`, `acesso_externo: "restrito"`). Um estudo
Avançado acrescenta `avancado_cronograma`, `avancado_tipologias`, `avancado_fases`,
`avancado_alocacoes`, `avancado_linhas_custo`, `avancado_curvas` e `avancado_cenarios`. Membership
por estudo em `estudo_membros`; vínculo com o Núcleo em `estudo_imoveis`; benchmarks em
`benchmarks`; IA em `apelo_comercial` (+ `_documentos`) e anexos do empreendimento em
`estudo_documentos`.

Todas as escritas passam pelas rotas customizadas (`acesso_externo: "restrito"`) — regras de negócio
e permissão por estudo.

**id_legivel** — template `{SIGLA} - {nome} - {UF} - {sequência}` (ex.: `INC - Pátio Urbitá 1 - DF -
002`; na base `inc_patiourbita1_df_002`). A sequência incrementa por `tipo_empreendimento`.

Detalhes de cada tabela e relações em [Modelo de Dados](modelo-de-dados).

## Anexo D — Armadilhas conhecidas

Erros que o app já resolve por construção — documentados no cabeçalho de `frontend/proforma.ts` e
`frontend/fluxo-caixa-motor.ts`.

**A1 — Base do custo de terreno.** Custo de terreno incide sobre a **área do terreno**, não sobre a privativa (C2). Trocar a base infla a maior linha de aquisição.

**A2 — VGV das áreas fechadas.** O VGV usa `area_pvt_*_fechada` (C1); áreas abertas entram na privativa mas não geram VGV direto. Somá-las ao VGV superestima a receita.

**A3 — "Obras" depende do tipo.** Na Incorporação, obras = construção + decoração + gestão da construção; não existe infraestrutura de loteamento. O `custoObrasVgvPct` reflete isso.

**A4 — Permuta física vs. financeira.** Física reduz a área/VGV vendável e **não entra no fluxo** (C5); financeira é dedução da receita. Tratá-las igual distorce Receita líquida e Resultado.

**A5 — Meses relativos 0-based.** No Avançado o mês 0 é `data_inicio_projeto` e o índice do array coincide com o mês; **não há meses negativos** (C4). Ancorar eventos fora dessa régua desloca toda a curva.

**A6 — Repasse é derivado.** O `%` do Repasse é `100 − Σ entrada − Σ parcelas`; persistir um valor independente quebra a conservação de receita.

**A7 — Curva reamostrada.** A curva de distribuição é reamostrada para a duração real e normalizada para 100% (`reamostrarCurva`); usar os pontos brutos sem normalizar vaza valor para fora do horizonte.

**A8 — Um único indicador decide.** Margem alta com exposição de caixa incompatível é projeto inviável. Exibir os indicadores estruturais juntos, contra benchmark, é requisito de produto.

### Armadilhas mapeadas pela lista de bugs (2026-08-01)

> Diferente das A1–A8 acima, **estas ainda NÃO estão resolvidas** — cada uma tem issue aberta. Elas
> ficam aqui porque são o tipo de erro que se reintroduz sozinho.

**A9 — Início e Duração não são campos simétricos em Custos.** A UI trava o Início em três casos
(Construção, fase-âncora, evento fixo) e a Duração **só** em Construção
(`frontend/tela-fluxo-custos.ts:724-757` vs `:758-780`). O backend faz o mesmo: devolve 422 para
`inicio_mes` em linha ancorada (`backend/rotas/avancado.ts:1134,1148`), mas **aceita** sobrescrever
`duracao_meses` (`:1130,1144`). Corrigir só a tela deixa a API divergente — e a próxima mudança de
Cronograma apaga a duração editada sem aviso, porque `reancorarCustos` reescreve as duas grandezas.
→ **#249**, validada por **#255**.

**A10 — `distribuicao_modo` não classifica permuta.** `unit_delivery` e `sales_revenue` são
**curvas de rateio** do Preço do Terreno — receita em caixa e VGV vendido
(`frontend/tela-fluxo-custos.ts:163-167`). Quem classifica é a **subcategoria**: toda linha
`Preço/Permuta` é tratada como permuta **financeira** pelo motor
(`frontend/fluxo-caixa-motor.ts:385-387`). A permuta **física** vem de outra entidade,
`unidades_permutadas` no catálogo de Tipologias. Usar `distribuicao_modo` como critério de migração
reclassifica linhas financeiras como físicas, remove a dedução de caixa e conta a permuta física em
dobro. → **#257**, **#258**.

**A11 — valor canônico multiunidade (#259).** Premissas persistem `*_canonico` e Custos do
Avançado persistem `orcamento_valor_canonico`. A badge altera apenas a unidade exibida; editar o
valor visível recalcula o canônico uma vez. Registros antigos mantêm seu valor econômico até a
primeira edição. A #260 migra todos os demais consumidores para o resolver canônico.

> ✅ **A regra que fecha esta armadilha existe desde 2026-08-01** (convenção **C7**, Anexo A): o
> canônico é o **valor monetário a 2 casas**; `%` e `R$/m²` são derivados, com precisão plena
> internamente. `converterUnidade` arredondar **tudo** a 2 casas
> (`frontend/premissas-conversao.ts:50-58`), inclusive o percentual, é o que quebra o round-trip —
> o percentual não é monetário e não deveria ser quantizado.

**A13 — A tela e a exportação formatam dinheiro diferente.** `fmtR$` usa
`maximumFractionDigits: 0` (`frontend/viab-format.ts:8`) e serve **53 chamadas em 11 telas**;
`exportar.ts:9` define o seu próprio `R$ = (v) => v.toFixed(2)`. O mesmo estudo mostra valores
diferentes no CSV e na tela, e a diferença cresce com o número de linhas somadas. Como `fmtR$` é
definido num ponto só, a correção é pequena — mas ela muda **toda** a apresentação monetária do app
de uma vez, então não é ajuste pontual. → **#281**.

**A12 — `travado_*` legado não é normalizado em leitura.** `recalcularTravados` corrige
`travado_inicio` de três eventos e **nunca toca `travado_duracao`**
(`backend/rotas/avancado.ts:53-75`). Corrigir o default em `cronogramaPadrao()` não alcança os
registros já gravados: a leitura devolve a flag antiga (`:278,299`) e o PATCH toma 422 (`:422`).
Toda correção de flag precisa valer **na leitura**, não só na criação. → **#246**.

## Anexo E — API

Rotas **relativas**; o shell prefixa tudo com `/api/viabilidade/`. O frontend chama via
`urbiVerso.api('/viabilidade/…')` e o Núcleo via
`urbiVerso.nucleo('/glebas' | '/lotes' | '/imoveis/:id')`. Persistência via `req.dados`; o cálculo é
do frontend (a API **não** tem endpoint de "simular").

Endpoints principais: `/estudos` (CRUD + duplicar + ciclo de status), `/benchmarks` (leitura livre;
`POST`/`PATCH`/`DELETE` e `POST /benchmarks/semear` para admin), rotas de
Empreendimento/Tipologias/Fases/Custos do Avançado, `/apelo-comercial` e exportação.

## Anexo F — Decisões históricas e vigência

Preservadas dos mapas anteriores para impedir perda de contexto.

| Origem | Decisão histórica | Situação atual |
|---|---|---|
| **#185** | Gráfico de fluxo acumulado usa `urbi-grafico-linha` com 2 séries diferenciadas por cor | **Continua vigente.** O primitivo não oferece tracejado nem anotações. Marcos ficam como texto fora do gráfico. |
| **#190**, **#191** | Parcelas “ao longo da Obra” são fixas e ancoradas no cronograma físico | **Vigente apenas como comportamento do runtime atual.** Foi superado como modelo-alvo pela validação Calliandra. Deve permanecer até a implementação aprovada de EVI-013, sem refatoração antecipada. |
| **#192** | Gráficos de avanço de Obra exibem somente `Projetado` | **Continua vigente.** Realizado, Desvio e Forecast permanecem fora de escopo. |
| **#187** | Tabela de Cenários salvos **deixou de esticar a 100%** (`width:auto`), com colunas de 84px/68px | **Em revisão por decisão do autor.** A **#265** (`BUGLIST-023`) pede o oposto: que a tabela ocupe a largura do card. A reversão é consciente; a invariante que permanece é manter cada coluna de variação **adjacente** ao seu indicador. |
| **#131**, **#132** | No estado 0% os sliders **não** geram segunda curva nem setas de variação — "o cenário É a base" | **Vigente, mas sob decisão explícita.** A **#264** (`BUGLIST-022`) exige registrar e testar essa escolha, em vez de deixá-la implícita no comentário do código. A `main` já mostra as duas séries quando qualquer slider sai do zero. |
| **#92** | Indicador de Absorção/Fluxo aplicado usa `var(--cor-info)` — azul | **Revisto pela #247** (`BUGLIST-004`): "aplicado" é conclusão bem-sucedida e passa ao token de sucesso. Pendente/erro continua vermelho. |
| **#40** | Página renomeada para "Custos" **preservando** o id de rota `obra` | **Em revisão pela #250** (`BUGLIST-007`): `/custos` vira o slug público e `/obra` permanece alias legado. O id **interno** de domínio e `avancado_linhas_custo.grupo` não mudam. |

A mudança de entendimento sobre #190/#191 não autoriza alteração direta. Ela exige:

1. atualização da documentação e do corpo da issue;
2. fixture dourada;
3. inventário de impacto em estudos existentes;
4. implementação isolada;
5. comparação de resultados antes e depois.

> **Regra geral:** atributo ou prop inexistente num primitivo `urbi-*` não dá erro — simplesmente não
> faz nada. Leia o `dist/index.d.ts` do SDK ou o componente no monorepo antes de presumir uma prop.

---

## Anexo G — Cenários dourados de recebíveis

> **Origem da referência.** Os dois cenários vêm de EVIs do projeto **Calliandra**, que é um
> **loteamento**. O que se importa deles é a **mecânica de recebíveis** — safra, sinal, primeiro
> vencimento, PMT, marco e repasse —, que é idêntica na Incorporação. Não se importa produto,
> tipologia, custo nem estrutura de obra. Uma fixture de Incorporação reproduz a mecânica com
> tipologias e Grupos próprios.

### G.1 Cenário Calliandra — prazo fixo

Premissas de referência:

- 20% à vista;
- 5% de desconto à vista;
- 13,3% em 36 parcelas;
- aproximadamente 64,81% em 120 parcelas;
- aproximadamente 1,8868% em uma linha separada de `Venda Casas`;
- 15% de sinal nos componentes parcelados;
- 15% a.a.;
- primeira parcela no mês seguinte.

#### Inputs mínimos da fixture

Os valores esperados abaixo só são reproduzíveis com a base contratada e a curva de absorção. Elas
são parte da fixture, não detalhe do arquivo de origem:

```text
base contratada total = R$ 28.601.115,20

meses 1 a 4   → R$ 2.860.111,52 por mês   (10,0% da base por mês)
meses 5 a 12  → R$ 2.145.083,64 por mês   ( 7,5% da base por mês)
meses 13+     → sem contratação
```

```text
taxa mensal equivalente
= 1,15^(1/12) − 1
= 1,1714917% a.m.
```

Conferências que a fixture deve reproduzir por construção, não por cópia:

```text
à vista do mês 1   = 20% × (1 − 5%) × 2.860.111,52 = R$ 543.421,19
sinal curta mês 1  = 13,3% × 15% × 2.860.111,52    = R$  57.059,22
parcela curta de uma safra de pré-lançamento
                   = PMT(1,1714917%; 36; 13,3% × 85% × 2.860.111,52)
                   = R$  11.059,94
```

#### A quarta modalidade

A `Venda Casas` corresponde a **1 de 53 lotes** (1 ÷ 53 = 1,8868%) e possui regra própria: **240
parcelas** com **30% de sinal**. Essa regra existe nas premissas do estudo, mas **não foi levada
para as colunas de receita do fluxo** — o fluxo abre somente à vista, tabela curta e tabela longa.

Consequência para a fixture: a linha agregada de `Vendas Contratadas` **inclui** a `Venda Casas`,
de modo que as três modalidades representadas somam **98,1132%**, não 100%. A fixture precisa
isolar a base das três modalidades ou modelar a quarta regra. **Não force um fechamento
artificial.**

Valores mínimos das modalidades à vista, curta e longa:

| Mês | Receita |
|---:|---:|
| 1 | R$ 878.539,92 |
| 2 | R$ 914.119,61 |
| 3 | R$ 949.699,31 |
| 4 | R$ 985.279,01 |
| 13 | R$ 355.796,98 |
| 38 | R$ 344.737,04 |
| 49 | R$ 245.197,58 |
| 122 | R$ 220.677,83 |
| 132 | R$ 18.389,82 |
| 133 | R$ 0,00 |

### G.2 Cenário Calliandra — até Obra + repasse

Premissas inferidas e reconciliadas:

- 15% de entrada;
- 15% em parcelas do mês seguinte até o mês 24;
- 70% de repasse no mês 25;
- taxa zero.

#### Inputs mínimos da fixture

A curva de absorção deste cenário é **diferente** da do G.1 — é uniforme:

```text
base contratada total = R$ 28.547.740,29

meses 1 a 12  → R$ 2.378.978,36 por mês   (1/12 da base por mês)
meses 13+     → sem contratação
```

Para uma safra do mês `s`:

```text
N_s            = 24 − s
parcela_s      = 15% × 2.378.978,36 ÷ N_s
primeiro venc. = s + 1
último venc.   = 24
repasse        = 70% × 28.547.740,29 no mês 25
```

Conferências que fecham com os valores esperados:

```text
mês 1        = 15% × 2.378.978,36                        = R$    356.846,75
meses 13–24  = 15% × 2.378.978,36 × Σ_{s=1..12} 1/(24−s) = R$    254.936,38
mês 25       = 70% × 28.547.740,29                       = R$ 19.983.418,20
```

Valores mínimos:

| Mês | Receita |
|---:|---:|
| 1 | R$ 356.846,75 |
| 2 | R$ 372.361,83 |
| 3 | R$ 388.582,14 |
| 12 | R$ 582.045,90 |
| 13 a 24 | R$ 254.936,38 por mês |
| 25 | R$ 19.983.418,20 |

### G.3 Uso nos testes

A fixture deve:

- manter inputs e valores esperados versionados;
- conferir cada mês;
- separar contratação, descontos, principal, juros e saldo;
- identificar primeira divergência;
- verificar horizonte;
- fechar cada safra e a carteira total;
- funcionar sem depender dos arquivos Excel em runtime.

## Veja também

- [Inteligência EVI — Incorporação](inteligencia-evi-incorporacao) — o significado econômico por trás deste padrão
- [Estudo de Viabilidade — Visão Geral](visao-geral)
- [Modelo de Dados](modelo-de-dados)
- [Fórmulas da Proforma](formulas)
- [Benchmarks e Sensibilidade](benchmarks)
- [Apelo Comercial](apelo-comercial)
- [Permissões e Ciclo de Vida](permissoes)
- [Exportação](exportacao)
- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência · `docs/issues-evi-propostas-2026-07-31.md` — issues preparadas

---

*Padrão de Viabilidade — Incorporação · Documento funcional consultivo · UrbiVerso*
