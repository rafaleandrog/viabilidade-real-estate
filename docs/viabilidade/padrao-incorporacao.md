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
> 7. KPIs           → Receita líquida/VGV, Margem líquida, ROI, Custo obras/VGV, Investimento total,
>                     Resultado por unidade (e por tipo R/NR)
> ```
>
> A engine devolve a interface `Proforma`, que alimenta a aba Proforma, os KPIs ao vivo da aba
> Premissas e a exportação. O backend **nunca** calcula indicadores — não há endpoint de "simular".
>
> O Avançado tem proforma própria e **desalavancada** — ver
> [Fórmulas da Proforma](formulas) § A segunda proforma.

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

> **Comportamento vigente — NÃO EXISTE promoção de nível (#486).** Um estudo nasce Preliminar ou
> Avançado e **continua o que nasceu**: `nivel_analise` só é gravado na criação
> (`backend/rotas/estudos.ts:180`) e o `PATCH` recusa alterá-lo com **422 `NIVEL_IMUTAVEL`**
> (`:339-345`). A duplicação **preserva** o nível — ela copia os dados do Avançado justamente
> quando `novo.nivel_analise === 'avancado'` (`:420-422`). Nenhuma rota promove.
>
> Quem preserva o nível na duplicação é `CAMPOS_NAO_COPIAVEIS` (`:46-50`) **não** listar
> `nivel_analise`, mais `montarCopiaEstudo` (`:59-67`). O `if` de `:420` apenas **consome** o nível
> já preservado, para decidir se copia as tabelas do Avançado.
>
> Isso responde a pergunta que a #486 fazia sobre a permuta física dos estudos de Pinguim, e a
> resposta **não é nenhuma das duas hipóteses dela**. O estado observado nos Avançados —
> `permuta_fisica_modo: 'area_m2'`, valores nulos, `quantidade: 0` — é **exatamente o padrão de
> criação declarado no `schema.json`** (`permuta_fisica_modo.padrao = "area_m2"`,
> `permuta_fisica_quantidade.padrao = 0`, `schema.json:116,121`), e o `POST /estudos` monta os
> dados por allowlist (`backend/rotas/estudos.ts:176-190`) sem citar campo de permuta algum.
>
> **Nenhuma tela grava esses campos num Avançado:** `frontend/tela-premissas.ts:490` devolve
> `nothing` quando `nivel_analise === 'avancado'`, e Premissas é a **única** escritora de
> `permuta_fisica_*` no frontend — `proforma.ts` e `premissas-conversao.ts` só leem.
>
> ⚠️ **Até aqui é o que a leitura do código prova. O que segue é inferência, e fica separada de
> propósito.** O estado observado é *indistinguível* do padrão de criação — mas indistinguível não
> é o mesmo que "nunca preenchido". Escrita direta por API, importação ou qualquer coisa fora da UI
> produziria o **mesmo** estado final, e este ambiente não tem trilha de auditoria da instância
> para separar as hipóteses. A porta de API está aberta: o `PATCH /estudos/:id` **não** bloqueia
> `permuta_fisica_*` num Avançado — o filtro de `CAMPOS_SOMENTE_AVANCADO` só pula campos quando o
> estudo é **Preliminar**. "Nenhuma UI escreve" não é "ninguém escreveu".
>
> **O que muda com essa ressalva, e o que não muda.** A conclusão que interessa à gravidade
> **não** depende da proveniência: como não há promoção, o pior caso da #486 — *"atinge todo estudo
> promovido"* — não existe, venha o estado de onde vier. O que a proveniência decidiria é se há
> ainda um terceiro ator escrevendo nesses campos, e isso **não foi verificado**.
>
> ⚠️ **A divergência entre as camadas continua real** — é a **#441** que decide o que fazer com
> ela. O que a #486 estabeleceu é só que a causa não é um bug de conversão, e portanto **não
> atinge "todo estudo promovido"**: não há estudo promovido.
>
> ⚠️ **Se um caminho de promoção for criado**, ele passa a precisar converter
> `pct_area_venda → area_m2` — e a família `permuta_fisica_nr_*` junto, que a #486 não mencionava.
> **Atenção à grandeza de ligação, que difere por tipo E por fonte.** ⚠️ **A redação anterior
> desta passagem cravava os campos legados, e a #570 a tornou falsa para o caso normal.** Com
> catálogo efetivo, a base das duas permutas físicas é a **área do catálogo da categoria**, que o
> motor publica em `areaBasePermutaResidencial`/`areaBasePermutaNaoResidencial`
> (`frontend/proforma.ts`) e a tela consome por `ctxConversaoPreliminar`
> (`frontend/premissas-conversao.ts`), convertida por `converterUnidade`/`paraBase`. Só o estudo
> **sem** catálogo efetivo continua usando as bases legadas — `area_pvt_r_fechada` /
> `area_pvt_nr_fechada` na Incorporação, e a ALV da cascata (`CASCATA_LOTEAMENTO`) no
> **Loteamento**, que segue sendo a única cascata que alimenta base de permuta. Desde a **#564**,
> `CASCATA_INCORPORACAO` (`frontend/areas-cascata.ts:211-216`) **é renderizada** pela aba Terreno &
> Áreas do Preliminar de Incorporação (`frontend/tela-premissas.ts`, tabela de Áreas) — mas continua
> **não sendo fonte da grandeza de ligação** em nenhuma das duas fontes. Sem isso, o bug que a #486
> procurou passa a existir de verdade.

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

A forma de entrada das unidades permutadas **já foi definida** — ver a §15.1, que descreve a
linha de custo `Preço → Permuta física` como fonte de verdade. Esta seção fixa a consequência
funcional, que não mudou:


- estoque permutado não pode gerar receita;
- estoque permutado não pode ser vendido novamente.

> 📌 **O terceiro item saiu.** Ele dizia que *"a evolução da interface não deve ser feita de forma
> improvisada enquanto a dinâmica de entrada não estiver aprovada"* — condição que a abertura desta
> mesma seção agora declara **cumprida**, e manter as duas era contradição em um parágrafo. A
> cautela dele já está honrada: a entrada é a linha de custo `Preço → Permuta física`, definida
> pelas #266/#267/#268.

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

> ✅ **Comportamento vigente para cronograma coerente (#225).** `faixasAbsorcao`, em
> `frontend/fluxo-shared.ts:265-291`, deriva "Durante a obra" a partir do **mês seguinte ao fim do
> Lançamento** (`:284-286`), não do início físico da Obra — e aí os quatro períodos comerciais são
> contíguos e não se sobrepõem. Pré-lançamento ausente vira faixa vazia (`fim < inicio`,
> `:278-280`).
>
> ⚠️ **A não-sobreposição NÃO é garantida quando o Lançamento alcança o fim da Obra.** Nesse caso
> a faixa `obra` fica vazia, mas `lancamento` continua até o **próprio** fim (`:283`) enquanto o
> Pós-chaves começa em fim-da-Obra + 1 (`:289`) — os dois **se sobrepõem**, e `absorcaoMensal`
> espalha percentual nas duas faixas. `problemaJanelaDuranteObra` (`:300-310`) só devolve texto
> para um `urbi-banner variante="alerta"` (`tela-fluxo-cronograma.ts:186-187`): **não bloqueia o
> salvamento** nem impede o cálculo. É aviso, não invariante.

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

> ✅ **Comportamento vigente, alinhado ao padrão e à EVI (#226 / EVI-007).** O início é o mês
> seguinte ao fim da Obra (`pos_obra` travado por `recalcularTravados`) e a duração é a
> **constante** `APOS_CHAVES_MESES = 12` (`frontend/fluxo-shared.ts:237`), consumida em
> `faixasAbsorcao:289` e declarada em `absorcaoMensal:407-408`.
>
> **A planilha de referência vota do mesmo lado.** Na EVI Urbitá, `cfINC!J` divide por **12
> literal** e ignora os próprios inputs `EtapaChavesDuracao`/`EtapaPosChavesDuracao` — a janela de
> vendas pós-entrega nunca foi parâmetro, nem lá. O travamento **reproduz** o oráculo; não é
> simplificação do app.
>
> ⚠️ **São duas variáveis distintas, e o app hoje as chama pelo mesmo nome.** Decisão do autor de
> 2026-08-22 (**D1**, issue **#430**): **Pós-obras** é o prazo do Cronograma que rege os
> **desembolsos** de pós-obra; **Pós-chaves** é a janela de **vendas e pagamento** posterior à
> entrega, ao lado de pré-lançamento, lançamento e durante-obras. Os 12 meses travados acima são o
> **Pós-chaves** — e ficam. O que muda é a taxonomia: cada um passa a ter nome e campo próprios.
>
> **Comportamento vigente (pós-#430).** A separação está feita **no identificador e na tela**, não no
> dado: a faixa comercial de `faixasAbsorcao` chama-se `pos_chaves`, o derivado chama-se
> `pctPosChavesDerivado`, a linha da tabela de Absorção diz "Pós-chaves · 12 meses fixos", e a linha
> do Pós-obras no Cronograma diz "duração de custos". O **bloco persistido** do 4º período continua
> gravado com `evento: 'pos_obra'` — é dado em coluna `json`, reconhecido por esse nome pelo backend
> (`backend/rotas/avancado.ts:217`), e renomeá-lo seria mudança de dado com migração.
>
> ⚠️ **Enquanto isso, `pos_obra.duracao_meses` continua editável e não faz o que o nome promete.**
> O evento nasce com `duracao_meses: 12` e `travado_duracao: false`
> (`backend/rotas/avancado.ts:42`); editá-lo **não** move a janela de vendas, só a **âncora de
> custos** pós-entrega — que é exatamente por que a D1 os separa. Medido em Pinguim: o estudo 6 tem
> `duracao_meses: 13` e uma curva de absorção `personalizado` que chega ao 13º mês; o 13º mês cai
> fora de `periodoAbsorcao` e **não é computado** — **1,41% das vendas, R$ 2.007.856,95**. Ver a
> issue **#429** (o texto anterior apontava a #485, que é outra coisa — o destravamento do início
> da obra, decisão D6).
>
> ✅ **Comportamento vigente (#429): o descarte deixou de ser silencioso.** Ele **continua não
> sendo computado** — a camada denuncia, não corrige, e nenhum número de estudo existente muda.
> O que mudou é que `absorcaoMensal` devolve `pctTotal`/`pctDescartado`/`mesesDescartados` ao lado
> de `pcts` (`frontend/fluxo-shared.ts:365-376`, acumulados em `:424-432` no modo `personalizado`
> e em `:439-457` no `distribuido`), `calcularFluxo` emite `console.warn`
> (`frontend/fluxo-caixa-motor.ts:1768-1786`) e o painel de Reconciliação acusa
> **`ABSORCAO_NAO_FECHA`** (severidade `erro`, `encontrado:` a absorção efetiva; `esperado:` 100,
> ou o total que a curva declarou quando houve descarte —
> `frontend/fluxo-invariantes.ts:266-322`, chamada por `validarProduto:333`).
>
> 🔴 **Por que ela não podia sair da validação existente.** `validarContratacao`
> (`pctNoHorizonte`) soma `abs.pcts`, a saída **já truncada** de `absorcaoMensal`: consome a saída
> de quem deveria fiscalizar, e por isso `VENDA_BRUTA_NAO_RECONCILIA` fechava certinho enquanto
> 1,41% do VGV evaporava. O `somaPct` de `validarProduto` chegava a comparar essa soma com 100,
> mas só para **suprimir** `ESTOQUE_FINAL_NAO_ZERA` — a informação existia, o relato é que não.
>
> A invariante tem **duas condições**, e é a segunda que a torna impossível de derivar de `pcts`:
> `pctAbsorcaoEfetivo` (= `pctTotal − pctDescartado`) fora de 100, **ou** `pctDescartado > 0`.
> Sozinha, a primeira seria numericamente idêntica a `Σ pcts` no modo `personalizado`; a segunda
> pega o caso em que a soma truncada fecha 100 por coincidência — uma curva que declara 110% e
> perde 10 pp fora da janela.

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
> A trava de saldo é **agregada por estudo** (`saldoTipologiaNoEstudo`): o comprometido da
> tipologia — as alocações em **todos** os Grupos **mais a permuta física**, que consome catálogo
> igual — não pode exceder a `quantidade`. Na tela, as unidades **cascateiam** de um Grupo para o
> seguinte: o `Total` de cada linha é a quantidade do catálogo menos o que as linhas acima já
> venderam (#170).
>
> São **quatro** as portas que gravam contra esse saldo, e a #433 fechou a última:
> `POST` e `PATCH` de alocação, a permuta física, e o **`PATCH` da própria tipologia** — reduzir o
> catálogo por baixo do comprometido chegava ao mesmo estado impossível sem `422` nenhum. O portão
> do `PATCH` de tipologia recusa a redução com `422 SALDO_EXCEDIDO`, e recusa `quantidade`
> **presente e não numérica** (`null`, `''`, `'abc'`) com `400 QUANTIDADE_INVALIDA` — sem esse
> segundo, esvaziar o campo na tela gravaria `NULL` e apagaria o teto.
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
− unidades comprometidas em permuta física
```

A ordem de exibição pode determinar a leitura em cascata, mas a validação final deve considerar o estudo inteiro — e a permuta física entra na conta, porque consome catálogo igual a uma venda.

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

> ✅ **Comportamento vigente: o Grupo (linha de receita) é a unidade de regime comercial —
> menos nos JUROS DE TABELA, que a #585 tornou do ESTUDO.** Cada Grupo tem sua própria
> absorção (§10.1 acima) e seu próprio plano de pagamento (`fluxo_pagamento`, com
> `entrada`/`parcelas`/`repasse`/`comissao`).
>
> 🔴 **A taxa de juros de tabela NÃO é mais do Grupo.** Decisão do autor de 2026-08-26
> (issue #585): *"campo juros de tabela funciona para todos os imóveis igualmente e o valor
> não é inserido aqui. será na aba financeiro"*. A taxa é **uma só para o estudo inteiro**,
> digitada em Viabilidade → Financeiro (`estudos.juros_tabela_aa_padrao`), e o motor a aplica
> a todo componente financiado de todas as linhas — as já gravadas inclusive
> (`componentesPagamento`, `frontend/fluxo-caixa-motor.ts`). A chave
> `fluxo_pagamento.juros_tabela_aa` que a #428 gravava por linha continua nos JSONs antigos e
> é **inerte**; a primeira gravação de cada linha a descarta.
>
> ⚠️ **O que isso retirou, e a issue o declara:** dois regimes comerciais com taxas diferentes
> no mesmo estudo (Residencial a 12,5% a.a. × Não residencial a 13% a.a., o par que a EVI trata
> via `VendasNaoResidDiferenciarCondicoes`, `Premissas!H16`) **deixaram de ser representáveis**.
> Criar dois Grupos ainda separa absorção e plano de pagamento — não separa mais os juros.
>
> O que a #477 estabeleceu e **continua valendo**: cada Grupo participa do `jurosClientes` e do
> `receitaPorComponenteMensal` do estudo independentemente, com sua própria carteira de safras —
> o motor nunca mistura a carteira de um Grupo com a de outro
> (`frontend/fluxo-caixa-motor.ts:1094`: cada safra é isolada por linha). O que mudou foi a
> TAXA que entra nessas carteiras, não o isolamento delas.
>
> O papel de `estudos.juros_tabela_aa_padrao` também mudou: era **default de criação** (#477,
> migração `033`) e passou a ser o **valor vigente** (#585, migração `037`, que faz o backfill
> a partir das taxas das linhas — a mais frequente do estudo).
>
> Fora de escopo desta seção: "venda à vista num único mês" (a "NR diferenciada" da EVI,
> `Premissas!M11`) não é um modo de absorção implementado — é modelo novo, sem demanda
> registrada.

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

> ✅ **Comportamento vigente, alinhado ao padrão (#108/#347).** O JSON `absorcao` de
> `avancado_fases` guarda o modo **Distribuído** em **quatro** blocos —
> `pre_lancamento`, `lancamento`, `obra` e `pos_obra` (`absorcaoParaSalvar`,
> `frontend/fluxo-absorcao-editor.ts`).
> Os três primeiros são informados; o Pós-chaves é **derivado**
> (`pctPosChavesDerivado`: `100 − p1 − p2 − p3`; o nome era `pctPosObraDerivado` até a #430). A soma dos três
> informados é validada por `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:345-353`) — sem
> isso, um total acima de 100% clampava no derivado e a absorção fechava abaixo de 100% sem aviso.
> ⚠️ **Quando o Cronograma não tem Pré-lançamento, o bloco NÃO chega zerado ao motor — e uma
> fatia das vendas deixa de ser computada.** `formularioAbsorcao(..., temPreLancamento=false)`
> (`frontend/fluxo-absorcao-editor.ts`) zera apenas o valor **do formulário**, ao abrir o modal — e
> guarda o valor cru em `form.lido`, justamente para que esse zero conte como **edição** e não seja
> engolido pelo no-op da #431. Salvar os parâmetros do Cronograma **não toca no JSON de absorção**
> (`backend/rotas/avancado.ts:473-495`): o bloco `pre_lancamento` persistido continua lá, com o
> percentual antigo.
>
> Até alguém abrir o modal e clicar em **Aplicar**, `absorcaoMensal` segue lendo esse bloco e o
> **descarta**, porque a faixa é vazia — `espalhar` retorna cedo quando `fim < inicio`
> (`frontend/fluxo-shared.ts:441-447`). Como o Pós-chaves é `100 − p1 − p2 − p3`, o percentual do
> Pré-lançamento **não é redistribuído**: a absorção fecha abaixo de 100%. Um estudo com 20% em
> Pré-lançamento que desative a fase passa a vender 80%.
>
> ✅ **Desde a #429, "e ninguém é avisado" deixou de valer.** O percentual da faixa vazia entra em
> `pctDescartado` (`frontend/fluxo-shared.ts:579`, o incremento dentro de `espalhar`) e o
> painel de Reconciliação acusa
> `ABSORCAO_NAO_FECHA`. O comportamento **não** mudou: o percentual continua não sendo computado e
> continua não sendo redistribuído — a camada denuncia, não corrige.
>
> A normalização acontece **só ao reaplicar o modal**, não ao desativar a fase.

> ✅ **A curva `personalizado` sobrevive ao modal desde a #431.** `absorcao.modo` aceita
> `personalizado` com uma série mês a mês em `absorcao.meses[]`, e `absorcaoMensal`
> (`frontend/fluxo-shared.ts`) a consome. **Esse dado veio da própria app** — o commit `2c0e793`
> tinha o seletor "Personalizado" na tela; a UI perdeu o modo depois e o motor continuou lendo, o
> que faz disto uma **regressão de interface**, não uma feature que nunca existiu. Até a #431,
> abrir o modal de Absorção e clicar em "Aplicar" convertia a linha para `distribuido` e descartava
> a curva inteira, sem aviso e sem undo (medido no estudo 6 de Pinguim: 43 pontos, VPL
> −R$ 360.591,41).
>
> Hoje: aplicar **sem editar bloco nenhum** devolve o registro **verbatim**; trocar só o badge
> "Correção de estoque" também preserva a curva; e editar um percentual de bloco **substitui**, mas
> só depois de um aviso `urbi-banner variante="alerta"` no corpo do modal e de uma **confirmação
> explícita** (`_renderConfirmAbsorcao`, `frontend/tela-fluxo-receitas.ts`).
>
> ⚠️ **Isto não dá superfície para EDITAR a curva** (criar ou mover pontos) — continua sendo
> feature. E não conserta a janela fixa de 12 meses que a trunca, que é a **#429**: depois deste
> conserto a curva do estudo 6 sobrevive **e continua truncada**. "A curva voltou" não fecha
> aquela issue.

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
> **Comportamento vigente (pós-#248/#342/#345/#346).** O modal
> (`_renderModalPagamento`, `frontend/tela-fluxo-receitas.ts`) tem quatro blocos. *Juros de tabela*
> (#436) é **somente-leitura** e só aparece quando algum componente persistido tem `taxaMensal ≠ 0`:
> mostra a taxa anual equivalente e — desde a #431, que fez o "Aplicar" parar de destruí-la — diz
> que ela é **preservada** ao aplicar, e que o que falta é onde **criar** uma (#428). Os outros três
> são *Definições* (só texto — corretagem
> e RET migraram para Custos, `:728-737`), *Condições de entrada* (`% do total`, `Nº parcelas`,
> `Desconto %`, `:741-763`) e *Parcelamento* (`% do total`, `Nº parcelas` ou checkbox "Ao longo da
> obra", máximo 4 linhas, `:764-806`); o *Repasse* é **derivado e somente-leitura**
> (`100 − entradas − parcelas`, `:807-817`), sempre no 1º mês após o fim da Obra. O checkbox de
> juros foi **removido**; a badge de periodicidade também (#342) — linha nova nasce `mensal` e
> linha legada mantém a periodicidade gravada, que o motor continua lendo
> (`fluxo-caixa-motor.ts:318-320`).
>
> **O que ainda falta para o modelo econômico:** não há campo de **taxa** nem de **sinal** — é a
> **#428**. O adaptador `componentesDoLegado` continua fixando `taxaMensal: 0`
> (`fluxo-caixa-motor.ts:591,603,610,619`) e `sinalPct: 0` (`:590,602,608`), porque o espelho legado
> não tem onde guardar essas grandezas.
>
> **O que MUDOU na #431:** `fluxoPagamentoParaSalvar` não grava mais
> `componentes: componentesDoLegado(...)`, e sim `componentesParaSalvar(...)` — que devolve o array
> persistido verbatim quando o espelho legado não mudou, e transplanta os campos só-canônicos por
> identidade quando mudou. Aplicar o modal numa linha que tinha juros **não os apaga mais**; o
> estudo 5 de Pinguim (`taxaMensal: 0.0098636`, R$ 1.259.273,59) sobrevive ao "Aplicar". O que ainda
> não existe é **criar** taxa pela tela.
>
> ⚠️ **E não é só o juro: a PERIODICIDADE legada também se perde no "Aplicar".** O mesmo adaptador
> converte `ao_longo_obra` em `ate_marco` com `defasagemMeses: 1`, **descartando a periodicidade**
> (`:599-604`); e converte o parcelamento comum em `prazo_fixo` usando a periodicidade **só como
> defasagem da primeira parcela** — as seguintes voltam a ser mensais (`:606-611`). Como
> `recebimentoBrutoMensal` passa a preferir os componentes canônicos, uma linha trimestral,
> semestral ou anual **muda de calendário** ao ser aplicada. O texto acima diz que "o motor continua
> lendo" a periodicidade gravada, e isso vale **enquanto ninguém abre e aplica o modal**.

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
- listas de `entrada`;
- listas de `parcelas`;
- `repasse.apos_entrega_meses`.

> ⚠️ **`ret` saiu do blob (#452).** Até esta issue o sub-objeto `ret: { ativo, pct }` sobrevivia por
> linha, regravado pelo spread de `fluxoPagamentoParaSalvar` em toda escrita — morto desde a #346,
> que tornou a RET **global do estudo** (`estudos.considerar_ret`/`estudos.ret_pct`). Um consumidor
> da API que lesse `ret.ativo: false` numa linha de estudo com RET ligada concluía, errado, que
> aquela linha não tinha RET.

Desde a #283, a compatibilidade é decidida **por linha de receita e por opt-in**:

- quando `fluxo_pagamento.componentes` está explicitamente persistido, `calcularFluxo` usa o motor por safras e expõe principal, juros de clientes, carteira e repasse;
- quando `componentes` está ausente, o app mantém integralmente o caminho legado (`entrada`, `parcelas` e `repasse`), sem reinterpretar nem migrar o estudo durante a leitura;
- estudos aprovados ou arquivados não mudam retroativamente: só passam ao motor canônico se a linha for deliberadamente salva no novo contrato;
- a tela de Cenários reutiliza o mesmo `FluxoCalc`, portanto recebe as mesmas séries e regras sem um cálculo paralelo.

Essa escolha evita reinterpretar dado durante a leitura. Na prática, porém, a adoção **não é
gradual**: `fluxoPagamentoParaSalvar` (`frontend/fluxo-pagamento-editor.ts`) grava `componentes` em
toda escrita, então qualquer "Aplicar" no modal de Fluxo de Pagamento converte a linha para o
canônico. Só linha nunca reeditada desde a #248 permanece no legado — e os dois ramos **produzem
números diferentes** com o mesmo `fluxo_pagamento` (PMT contra divisão simples, 1º vencimento em
`s+1` contra o mês da venda, venda pós-entrega à vista contra plano do Grupo; ver o teste de
divergência em `frontend/fluxo-caixa-motor.test.ts`, `#458`). O caminho canônico calcula safra, PMT,
juros sobre saldo, prazo fixo, vencimento até marco, carteira reconciliada e liquidação concentrada.
O caminho legado permanece documentado abaixo apenas como regra de compatibilidade.

> ✅ **Desde a #458, o ramo deixou de ser invisível.** A tela marca com a badge "Plano não migrado"
> (`frontend/tela-fluxo-receitas.ts`) todo Grupo cujo `fluxo_pagamento.componentes` não é um array —
> o mesmo teste que `recebimentoBrutoMensal` usa para escolher o ramo — e a mesma checagem emite
> `console.warn` nomeando a linha. **A migração continua sendo a mesma ("Aplicar" converte); o que
> mudou é que agora dá para saber, olhando a tela, quais linhas ainda não passaram por ela.** O que
> ainda não existe é um inventário agregado (quantas linhas, em quais estudos) — isso é a #464.

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

### 11.7 A cadeia EVI de recebíveis — entregue, e o que sobrou

> ✅ **As seis issues abaixo estão implementadas e ligadas ao cálculo real desde a #283.** A lista é
> mantida como **registro do que cada uma pedia**, não como trabalho a fazer — era ela que dizia
> "precisam ser revisadas antes de implementação", e dois agentes desta rodada quase
> reimplementaram o motor por causa disso.

| Issue | O que pedia | Onde está |
|---|---|---|
| **EVI-010 / #230** | contrato canônico pelas quatro regras de componente | `ComponentePagamento` (`fluxo-caixa-motor.ts:519-550`) |
| **EVI-012 / #232** | componente de prazo fixo por safra (curta 36, longa 120) | `pagamentosComponenteSafra` `:1058` |
| **EVI-013 / #233** | componente até marco, 1ª parcela no mês seguinte | mesmo motor, `tipo: 'ate_marco'` |
| **EVI-014 / #234** | pagamento concentrado e repasse, com juros convencionados | `tipo: 'concentrado'`, `taxaMensal` |
| **EVI-016 / #236** | saldos reais por safra e componente | `carteiraSaldoSafra` `:826`, consolidação `:1149-1169` |
| **EVI-017 / #237** | Receita Bruta = contratado líquido + juros | separação em `:1126-1141` |

> ⚠️ **A porta continua sendo o opt-in da §11.6:** linha sem `componentes` persistido segue pelo
> caminho legado. "Implementado" não quer dizer "aplicado a todo estudo".

### 11.8 Regra para novas vendas Após-chaves

O plano financiado do Grupo não se aplica a novas vendas depois da entrega.

```text
recebimento da nova venda Após-chaves
= 100% do valor contratado líquido no mesmo mês
```

A fronteira é explícita: vendas até o mês da entrega preservam o plano do Grupo; somente safras posteriores à entrega são convertidas em recebimento integral no mês da contratação.

O comprador pode pagar parte diretamente e financiar parte com o banco, mas ambas chegam à incorporadora no mesmo mês.

> ✅ **Comportamento vigente no caminho canônico (#235/#283).** `ehVendaAposChaves`
> (`frontend/fluxo-caixa-motor.ts:958-960`) marca como Após-chaves toda safra com
> `safra > mesEntrega`, e `componentesEfetivosSafra` (`:962`) substitui os componentes do Grupo
> por um único `imediato` de 100% sem desconto — sem sinal futuro, parcela nem repasse para aquela
> venda. Cada safra é tratada isoladamente: contratos antigos não são afetados. A aplicação por
> safra está em `calcularRecebiveisComponentes:1096`, via `componentesIntegradosSafra:1030-1043`.
>
> ⚠️ **Vale só para linha com `fluxo_pagamento.componentes` persistido.** A linha que nunca passou
> pelo modal desde a #248 cai no motor legado (`recebimentoBrutoMensal:1622` em diante, ramo a
> partir de `:1629`), que **não** distingue a fronteira da entrega — aplica o plano do Grupo a toda
> safra. 🔧 endereço conferido na #458 (2026-08-24, depois do merge com a #532/main) — era `:1342`.

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

> **Comportamento vigente (#473, 2026-08-24).** `frontend/fluxo-shared.ts` expõe as DUAS bases,
> nomeadas explicitamente — é o que a #227 pedia e ficou pela metade até aqui:
> `vgvVendidoBrutoMensal` reparte o **VGV bruto** da linha (`vgvLinha`, tipologia inteira) e
> `vgvVendidoVendavelMensal` reparte o **VGV vendável** (`vgvVendavelLinha`, exclui as unidades
> permutadas fisicamente — a mesma base de `vendaBrutaContratadaMensal`/`receitaMensalLinha`).
>
> A Corretagem de vendas (`corretagemMensal`, `frontend/fluxo-caixa-motor.ts`) escolhe entre as
> duas por `estudos.corretagem_sobre_permuta_fisica` (só no Avançado — `CAMPOS_SOMENTE_AVANCADO`,
> `backend/rotas/estudos.ts`): **default `true`** (VGV bruto, permuta física inclusa — preserva o
> número de todo estudo existente) ou `false` (VGV vendável, alinhando a corretagem à baixa de
> estoque). O Preço do Terreno em `distribuicao_modo: 'sales_revenue'` (#194) continua na base
> bruta histórica — a chave não se estende a ele, é fora do escopo da #473.
>
> 📊 **A base vendável tem lastro na EVI** (`cfINC!BL` × `cfINC!U` × `Areas e Precos!F17` —
> `BRIEF-EVI.md` T10): a planilha não incide corretagem sobre a permuta física. O default do app
> continua sendo a base bruta, por decisão do autor (D7) — a EVI é consultiva e não autoriza mudar
> lógica existente; o achado só pesa na escolha de quem configura o estudo.

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
- a soma das alocações **mais a permuta física** não pode ultrapassar o catálogo — e o catálogo não
  pode ser reduzido por baixo desse total (#433).

## 13. Recebimentos, safras, carteiras e repasse

> ✅ **O CÁLCULO desta seção é comportamento vigente desde a #283.** `frontend/fluxo-caixa-motor.ts`
> implementa safra (`ehVendaAposChaves` `:958`, laço das contratações em `:1107`), PMT (`pmt`
> `:666`), taxa sobre o saldo de abertura (`:1122-1141`), carteira por safra (`carteiraSaldoSafra`
> `:826`; consolidação em `:1149-1169`) e reconciliação por componente
> (`receitaPorComponenteMensal`/`carteiraPorComponenteMensal`, `:1090`/`:1094`, agregadas em
> `calcularFluxo` `:2070-2076`; invariantes em `validarComponentesSafra`,
> `frontend/fluxo-invariantes.ts:496`).
>
> ⚠️ **O ✅ é do MOTOR, não da INTERFACE.** A §13.7 pede que prazo curto, prazo longo, até marco e
> saldo para repasse sejam **abertos na tela**, e isso **não** está entregue: os seis
> "Componente · …" de receita e o bloco "Carteira de clientes com seus 3 componentes" foram
> **removidos da tabela do Fluxo** (`frontend/fluxo-tabela.ts:462-467`). Continuam existindo no
> motor e nos testes; a tela mostra só as séries **agregadas** de carteira e repasse. A abertura
> por componente segue **evolução pendente**.
>
> ⚠️ **Mais duas ressalvas.** (1) A porta é `fluxo_pagamento.componentes` — linha nunca reeditada
> segue pelo motor legado. (2) A **taxa** ainda não tem onde ser digitada (#428); o que a #431
> mudou é que ela deixou de ser **apagada** quando a linha passa pelo modal — os juros que existem
> em estudo real sobrevivem ao "Aplicar".

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

> ✅ **Entregue (#235/#283)** — ver §11.8, que descreve o comportamento vigente e as ressalvas.

### 13.9 O que as issues da Rodada 5 pediram — e o que foi entregue

> ✅ **Registro histórico, não backlog.** A tabela dizia "Correção necessária" para trabalho que a
> **#283** entregou. Fica como memória do que cada issue pedia, com o estado real ao lado.

| Issue | O que pedia | Estado |
|---|---|---|
| **EVI-001 / #220** | Dois cenários dourados: Calliandra prazo fixo e até Obra + repasse | ✅ |
| **EVI-010 / #230** | Contrato baseado em componentes e regras temporais | ✅ |
| **EVI-012 / #232** | Prazo fixo por safra; curta de 36 e longa de 120 | ✅ |
| **EVI-013 / #233** | Primeira parcela no mês seguinte; componente até marco | ✅ |
| **EVI-014 / #234** | Repasse concentrado, juros explicitamente convencionados | ✅ no motor — **falta a ENTRADA**: o modal não tem campo de taxa nem de sinal (§11) |
| **EVI-016 / #236** | Carteira por saldos de safra, não recorrência agregada | ✅ |
| **EVI-017 / #237** | Receita Bruta = contratado líquido + juros | ✅ |
| **EVI-020 / #240** | Invariantes por safra e primeiro mês divergente | ✅ `validarComponentesSafra` (`fluxo-invariantes.ts:496`) |
| **EVI-021 / #241** | Exibir bruto, desconto, líquido, principal, juros, parcelas, repasse e carteira | 🟡 **parcial** — o motor produz tudo, mas os 6 "Componente · …" e a carteira por componente **saíram da tabela** (`fluxo-tabela.ts:462-467`); a tela mostra só as séries agregadas |

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

> 📌 **Texto original do padrão, mantido como registro:** *"A futura forma de cadastro e
> identificação das unidades permutadas será especificada separadamente."* Ela **foi** especificada
> — o bloco abaixo descreve o resultado.

> 🔄 **Evolução dependente de issue — acrescentado em 2026-08-01.** Essa "futura forma de cadastro"
> ganhou escopo: é a epic **#258** (`BUGLIST-015`), com quatro sub-issues (**#266** modelo e UI,
> **#267** fonte de verdade e migração, **#268** motor, **#269** relatórios e invariantes).
>
> ✅ **Comportamento vigente (#266/#267/#268).** A fonte de verdade da permuta física é a **linha de
> custo** `Preço → Permuta física`, com `permuta_tipologia_id` + `permuta_quantidade`
> (`schema.json:373-374`).
>
> ⚠️ **O valor NÃO é declarado — é derivado, e o texto anterior desta linha dizia o contrário.** A
> coluna Orçamento dessa linha renderiza **só** a tipologia e a quantidade
> (`frontend/tela-fluxo-custos.ts:704-716`): não há campo de valor. E `reservarPermutasFisicas`
> calcula o KPI como `quantidade × area_privativa_m2 × preco_m2` da tipologia alocada
> (`frontend/fluxo-caixa-motor.ts:85`), **sem ler `orcamento_valor`**. Quem procurar uma entrada de
> valor ou uma regra de valoração própria não vai achar: elas não existem. O CRUD de tipologias deixou de ler e
> escrever `unidades_permutadas` (`backend/rotas/avancado.ts:773`, #253); a coluna permanece no
> schema como dado histórico. O motor resolve a reserva em `reservarPermutasFisicas`
> (`frontend/fluxo-caixa-motor.ts:58`, chamada em `:1811`) e a projeta de volta nas tipologias uma
> única vez (`:1821-1828`), para que toda função que já lia `t.unidades_permutadas` fique correta
> sem replicar a reserva. **Sem linha de custo de Permuta física, o KPI é 0** — não há fallback
> para o campo legado (`:2046-2049`, decisão do autor de 2026-08-02, #267).

> A ressalva original ("até essa definição, nada de refatoração ampla improvisada; inconsistência
> vira issue própria e conservadora") **cumpriu o papel dela**: a definição chegou pelas
> #266/#267/#268, e o que restou de conservador virou o comportamento descrito acima — a coluna
> `unidades_permutadas` permanece no schema como dado histórico em vez de ser removida.

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

> ✅ **Comportamento vigente — a base é DOIS flags independentes, por linha de custo
> (#195/#196/#227/#228/#346/#459).** A permuta física reduz unidades vendidas, VGV e Resultado no
> Avançado (#195), e a permuta financeira do Terreno é deduzida da receita (#196). Até a #459, a
> base era um enum único `bruta`/`liquida` (#238); a EVI declara dois booleanos separados
> (`Premissas!N17`/`N18`, "deduzir das permutas financeiras: ☑ corretagem ☑ impostos"), e a #459
> separou os dois na mesma direção: `permuta_financeira_deduzir_imposto` e
> `permuta_financeira_deduzir_corretagem`, editáveis por linha de custo, defaults `false`/`false`.
>
> `permutaFinanceiraDeduzidaMensal` (`frontend/fluxo-caixa-motor.ts:2094`) **subtrai** cada
> série ativada diretamente do recebimento do mês — `max(0, v − (deduzirImposto ? imposto : 0) −
> (deduzirCorretagem ? corretagem : 0))` — e só então aplica o percentual: é a **subtração direta**
> que o padrão pede, a dedução não é composta multiplicativamente, e as duas deduções agem cada
> uma por conta própria (as quatro combinações são todas representáveis, inclusive as duas mistas
> que o enum não representava). `permutaFinanceiraBrutaMensal`/`permutaFinanceiraLiquidaMensal`
> (`:1998-2016`) sobrevivem como os dois extremos `(false,false)`/`(true,true)`, para
> compatibilidade com os testes e o vocabulário histórico "bruta"/"líquida".
>
> `calcularFluxo` calcula a série ESCOLHIDA pelos dois flags da linha e a série OPOSTA (os dois
> flags invertidos) para auditoria; a tela oferece dois checkboxes ("Deduzir das permutas
> financeiras: ☑ corretagem ☑ impostos", `frontend/tela-fluxo-custos.ts:761-777`) e exibe o total
> da base oposta ao lado deles. As séries de dedução são `impostoMensal` (`:1447`, RET já resolvido
> como parâmetro **global** do estudo) e `corretagemMensal` (`:1516`, linha de custo obrigatória
> "Corretagem de vendas", base **bruto/VGV** — fonte única desde que a #228 removeu a dedução
> concorrente de `vglLinha`).
>
> ℹ️ **O bloco `regime_tributario`/`aliquota_*` não é lido pelo motor do Avançado** — o imposto
> oficial dele é o RET (`frontend/fluxo-shared.ts:210-212`, #228, decisão do autor em 2026-08-01).
>
> ⚠️ **Correção: dizer que o regime é "exclusivo do Preliminar" está errado, e a frase anterior
> desta nota dizia isso.** A Proforma **não** lê `regime_tributario`: `frontend/proforma.ts:245`
> calcula o imposto só a partir de `sujeito_ret`, `aliquota_ret_pct` e `imposto_percentual`.
> `regime_tributario` não tem leitor nenhum, em nenhum nível — só era mais um controle sem efeito.
>
> ✅ **#450 (2026-08-24): saiu do render.** `regime_tributario` e os cinco `aliquota_*_pct` não
> aparecem mais na aba `Viabilidade → Financeiro` — `camposVisiveisFinanceiro`
> (`frontend/tela-financeiro.ts:74-77`) só lista `taxa_desconto_aa` e `imposto_percentual`. As
> colunas continuam no schema como dado histórico; só o formulário saiu.

```text
permuta financeira líquida
= base líquida × % de permuta
```

### 15.3 Série utilizada no fluxo

O fluxo visível deve usar a visão que representa o contrato e a realidade de caixa do incorporador.

As duas visões devem permanecer disponíveis para auditoria.

> ✅ **Comportamento vigente.** É o que a §15.2 descreve: a visão do fluxo é a que os dois flags da
> linha escolhem (`permuta_financeira_deduzir_imposto`/`_corretagem`), e a base oposta (os dois
> flags invertidos) continua disponível como `permutaAlternativa`, exibida na tela ao lado dos
> checkboxes.

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
> Esta seção continua sendo a visão funcional resumida dentro do padrão.
>
> ⚠️ **O que este parágrafo dizia a seguir venceu.** Ele chamava o documento novo de "especificação
> vinculante da epic #239 e das dez sub-issues #270–#279". A **#355 apagou esse modelo inteiro**: a
> epic e as sub-issues não existem mais como caminho, e do documento **só a §4.3** (Financiamento à
> produção) continua vigente — o resto é **ADR histórico**. A spec de `divida`/`equity` é
> [Fluxo do Investidor](fluxo-investidor-formulas). Ver o bloco de comportamento vigente abaixo,
> que é a fonte de verdade desta seção.
>
> ✅ **Comportamento vigente desde a #355 (2026-08-12).** O funding existe e roda: três operações
> independentes — `financiamento_producao` (única por estudo), `divida` e `equity` —, **sem
> waterfall, sem prioridades e sem competição por caixa**. Motor: `frontend/funding-motor.ts`;
> tela: `frontend/tela-funding.ts` (aba "Funding"); rotas: `backend/rotas/funding.ts`; tabela
> `avancado_funding_operacoes` (migração `029`). A spec de `divida`/`equity` é
> [Fluxo do Investidor](fluxo-investidor-formulas); a de `financiamento_producao` continua sendo a
> §4.3 de [Funding, Capital Stack e Retorno do Capital](funding-capital-stack), preservada de
> propósito. O resto daquele documento é **ADR histórico**.
>
> ✅ **#450 (2026-08-24): o inventário abaixo está desatualizado — os sete controles citados
> saíram do render.** `regime_tributario`, os cinco `aliquota_*_pct` e
> `imposto_sobre_permuta_fisica` foram removidos da aba `Viabilidade → Financeiro` (sem leitor em
> nenhum nível — não havia o que preservar). `sujeito_ret` também saiu do render **dali**: é
> condição de nível (`sujeitoRetVisivelFinanceiro`, `frontend/tela-financeiro.ts:135-137`) — a aba só
> existe para `nivel_analise === 'avancado'`, e nesse nível a Proforma não é consultada, então a
> condição colapsa em "sempre oculto". `imposto_percentual` é o único que fica **visível**, mas
> sempre **desabilitado** (`impostoPercentualEditavel`, `:87-89`) — o único editor de verdade é
> Premissas (Preliminar), que grava a mesma coluna. Nenhuma coluna saiu do schema; só o formulário.
>
> ⚠️ **Capital de giro EXISTE, sob o nome `divida`** — decisão 2 do autor, 2026-08-22. O tipo
> `divida` **é** o produto de CG por calendário: a migração `029_funding_operacoes.js:38-43,127-130`
> converte `capital_giro` para `divida` — **sem perda de parâmetro** (valor, taxa anual, carência e prazo
> são os mesmos nos dois modelos) —, e `frontend/funding-motor.test.ts:28-38` exercita uma operação
> `divida` chamada "Capital de giro".
>
> ⚠️ **A conversão não é fiel em todo caso, e o próprio código sinaliza:** `politicaAmortizacao`
> deixa de existir no modelo novo, que só tem Price com carência. Camada legada com `cash_sweep` ou
> `bullet` vira Price com o mesmo prazo e recebe **`[revisar]` no nome**
> (`migracoes/029_funding_operacoes.js:138-159`) — é pedido de conferência humana, não equivalência.
>
> O que o enum recusa é o **literal** `capital_giro` como tipo novo
> (`backend/rotas/funding.ts:43`, `backend/rotas/funding.test.ts:26`) — não o produto.
>
> **O que de fato não existe é a linha ROTATIVA**, e por decisão: ela reintroduziria a competição
> por caixa que a #355 apagou. Empréstimo-ponte também não existe. **A §17.4 abaixo NÃO descreve
> o conceito rotativo** — é uma lista de oito atributos que `simularDivida`
> (`frontend/funding-motor.ts:237-292`) já implementa hoje, pelo tipo `divida`; o rotativo não
> tem seção neste documento.
>
> ⚠️ **O que falta é o RÓTULO**, não o produto — a tela ainda chama de "Dívida" o que também é
> capital de giro. É a issue #466.

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

> ✅ **Comportamento vigente desde 2026-08-11 — os nove itens acima estão implementados**, no
> Capital Stack (camada `financiamento_producao`), não no Bloco G. O modelo é o da planilha de
> referência: gatilho de exposição mínima, **catch-up retroativo** na primeira liberação, juros
> capitalizados sobre o saldo anterior e cash sweep até zerar. A especificação completa está em
> `docs/viabilidade/funding-capital-stack.md` §4.3; o oráculo de regressão contra a planilha, em
> `frontend/financiamento-producao-golden.test.ts`.
>
> **O inventário do que sobrou inerte era o da §17** — e a #450 (2026-08-24) fechou até esse
> resto: `regime_tributario`, os cinco `aliquota_*_pct` e `imposto_sobre_permuta_fisica` saíram do
> render da aba Financeiro (não tinham leitor em nível nenhum). Estrutura de capital, investidor e
> correção monetária **saíram do formulário** antes (#279/#355) — não estão inertes, não estão lá.


### 17.3 Repasse não é financiamento à produção

| Operação | Devedor econômico | Função |
|---|---|---|
| **Financiamento à produção** | Incorporadora ou SPE | Financiar a construção e custos elegíveis |
| **Repasse** | Comprador, financiado pelo banco | Liquidar o saldo do cliente junto à incorporadora |

O repasse pode gerar caixa utilizado para amortizar o financiamento à produção, mas as duas linhas devem permanecer separadas.

### 17.4 Capital de giro e investidores

> ✅ **Comportamento vigente.** Os oito atributos abaixo são o que `simularDivida`
> (`frontend/funding-motor.ts:237-292`) já implementa hoje, pelo tipo `divida` (rotulado
> "Dívida / Capital de giro" na UI, #466). **Esta lista NÃO descreve a linha rotativa** — a
> decisão sobre o rotativo, e por que ela não existe, está em `frontend/tela-funding.ts` (o
> comentário junto ao rótulo) e na nota da §17 acima.

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

> ✅ **Comportamento vigente (#231, #446).** `calcularFluxo` (`frontend/fluxo-caixa-motor.ts:2330`)
> dimensiona o horizonte por `max(último mês do Cronograma, último recebível de qualquer linha,
> último mês de custo, último mês das operações de Funding, 11) + 1`, com `ultimoMesRecebivelLinha`
> derivando o recebível a partir dos componentes normalizados e `ultimoMesFunding`
> (`frontend/fluxo-shared.ts`) derivando o das operações — a #446 acrescentou este último termo,
> porque dívida e equity ficavam de fora e eram truncadas. `config.prazoMeses` é **piso**, nunca
> teto: um prazo digitado pode esticar o fluxo, jamais encurtá-lo. O fallback silencioso que empilhava excedente no último mês **foi
> removido** (`:1371-1373`); no caminho canônico, um pagamento fora do horizonte emite
> `console.warn` e não é computado (`deposita`, `:1098-1104`), em vez de deformar o último mês em
> silêncio.
>
> ⚠️ **A proteção é PARCIAL, e o requisito acima não é atendido quando o chamador passa
> `config.prazoMeses`.** A linha é `const prazo = Math.max(1, Math.round(n(config.prazoMeses) ||
> prazoDerivado))` (`:1809`): o valor explícito **vence** o horizonte derivado. Se for menor, o
> horizonte **não é ampliado** — os recebíveis excedentes são descartados por `deposita`, com
> `console.warn` e sem entrar no fluxo. O aviso na consola é melhor que o empilhamento silencioso
> de antes, mas **não é** "o horizonte deve ser ampliado": nesse caminho, há perda de valor.

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

> **Comportamento vigente (#241, atualizado pela #456).** O app calcula Resultado, margens, ROI,
> VPL, TIR, Payback, Exposição máxima e Receita Bruta — VGV. VGV Vendável
> permanece um KPI separado. Contratação, recebimentos, carteira e funding são
> blocos distintos na tabela e nas exportações mensal/anual. As séries
> comerciais também alimentam um gráfico próprio, sem recálculo na UI.
>
> A #456 (2026-08-24) acrescentou **Juros de clientes** (R$ e % da Receita Bruta) e **Carteira
> máxima de clientes** (R$, % da Receita Bruta e o mês) como KPIs próprios de `kpisFluxo`
> (`frontend/fluxo-tabela.ts`), e o card de **Exposição máxima** ganhou o mesmo tratamento (% da
> Receita Bruta e o mês) mais o rótulo "(fluxo livre)", que declara que a série é **desalavancada**
> — `FluxoCalc.exposicaoMaxima` nunca inclui funding. O "VGV" dos três percentuais é a **Receita
> Bruta** (`c.receitaBruta`), não `vgvTotal`/`vgvVendavel` — é a grandeza que corresponde ao
> `VGVIncorpIndividual` da EVI. **Endividamento máximo** (funding) continua fora — não é grandeza do
> `FluxoCalc` desalavancado, e fica para issue própria.

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

A auditoria original está em `docs/rodada-5-evi-2026-07-31.md`. A validação posterior dos recebíveis
concluiu que o motor-alvo precisa ser **por safras e componentes**.

> ✅ **Esse motor-alvo foi construído — a #283 o ligou ao `calcularFluxo`.** O texto abaixo foi
> escrito quando ele não existia, e as subseções que descreviam ausências levam agora o estado real
> ao lado. Leia a §24 como **diagnóstico datado com anotação**, não como lista de trabalho: foi
> tomando-a ao pé da letra que dois agentes desta rodada quase reimplementaram o motor.

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

### 24.2 Lacunas do motor de recebíveis — **fechadas pela #283**

> ✅ **Esta lista descrevia o runtime ANTES da #283 e não vale mais.** A §24 se apresenta como
> diagnóstico do app **atual**, então deixá-la como estava mandava reimplementar um motor pronto.
> Mantida como registro do ponto de partida, com o estado de cada item:

| A lista dizia | Hoje |
|---|---|
| não cria safras | ✅ laço das contratações, `fluxo-caixa-motor.ts:1107` |
| não calcula PMT | ✅ `pmt` `:666` |
| não separa prazo fixo de até marco | ✅ `tipo: 'prazo_fixo'` × `'ate_marco'` |
| não controla o primeiro vencimento | ✅ `defasagemMeses` por componente |
| não tem descontos como série | ✅ `descontoComercialMensal` (#227) |
| não separa principal e juros | ✅ `:1126-1141` |
| não tem carteira real | ✅ `carteiraSaldoSafra` `:826`, consolidação `:1149-1169` |
| trata repasse como vencimento residual | ✅ `tipo: 'concentrado'` |
| pode truncar valores no último mês | 🟡 o empilhamento silencioso saiu (`:1371-1373`), mas com `prazoMeses` explícito menor que o derivado ainda **há descarte**, com `console.warn` — ver §18 |
| distribui valor nominal por linhas genéricas | 🟡 só no caminho **legado**, para linha sem `componentes` persistido (§11.6) |

### 24.3 Correção de premissas anteriores

A reconciliação com Calliandra corrige os seguintes pontos:

- a primeira parcela recorrente ocorre no mês seguinte à venda;
- pagamento no próprio mês deve ser imediato e explícito;
- uma tabela longa pode ser prazo fixo, como 120 meses;
- um fluxo até a Obra + repasse é outro modelo;
- desconto comercial reduz a base antes dos juros;
- a carteira deve ser derivada por safra;
- Urbitá serve como referência de sobreposição de recebimentos, mas não de carteira.

### 24.4 Issues que precisavam de revisão documental — **registro**

> ✅ **A cadeia foi entregue pela #283; esta lista não é backlog.** Ela dizia "antes de
> implementação, revisar", e é exatamente o texto que quase fez dois agentes desta rodada
> reimplementarem o motor. Fica como registro de quais issues compunham a cadeia — o estado de cada
> uma está na §11.7 e na §13.9.

Compunham a cadeia:

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

A recomendação original — *"nenhuma mudança de runtime deve começar com uma premissa
desatualizada"* — continua valendo como princípio, e é justamente ela que este PR aplica ao próprio
documento.

### 24.5 Funding e permutas

As conclusões anteriores permanecem:

- financiamento à produção é separado do repasse;
- permuta física não gera caixa;
- permuta financeira acompanha recebimentos.

> ✅ **O quarto item saiu: o Bloco Financeiro já teve a decisão.** Ele dizia que o bloco "ainda
> precisa de decisão de integração ou remoção". A #279/#355 decidiram — os campos de financiamento,
> estrutura de capital, investidor e correção **saíram do formulário**, e o funding passou a rodar
> por `avancado_funding_operacoes` na aba Funding (§17). O que sobrava sem leitor
> (`regime_tributario`, os `aliquota_*_pct`) também saiu do formulário — #450, 2026-08-24.

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
| **C1** | **Só a área fechada é vendável, e o VGV vem do catálogo, por categoria.** Áreas abertas (varandas/terraços) entram na área privativa, mas **não** são vendáveis: `areaVendavel` da Incorporação é `area_pvt_r_fechada + area_pvt_nr_fechada`. ⚠️ A redação anterior desta convenção dava a FÓRMULA do VGV em cima desses dois campos × os preços legados, e isso deixou de valer: desde a **#315** o VGV é o catálogo de Produtos, e desde a **#570** ele é somado **por categoria** (`tipo` da linha) — `VGV = VGV residencial + VGV não residencial`, cada um já líquido da permuta física da sua categoria. Os campos legados só governam o estudo **sem** catálogo efetivo. | `formulas.md`, `proforma.ts` |
| **C2** | **Custo do terreno incide sobre a área do terreno**, não sobre a privativa: `custo_terreno_m2 × área do terreno`, zerável pelo `considerar_custo_terreno`. | `proforma.ts` (cabeçalho) |
| **C3** | **Receita positiva, custos positivos nos arrays; o sinal entra na consolidação** (`fluxo = receita − custo`). A Proforma e o Fluxo somam linhas, nunca invertem sinal na apresentação. | `fluxo-caixa-motor.ts` |
| **C4** | **No Avançado, o tempo é em meses relativos 0-based**: mês 0 = `data_inicio_projeto`; o índice do array mensal coincide com o número do mês. **Não há meses negativos.** | `fluxo-caixa-motor.ts` |
| **C5** | **Permuta física não entra no fluxo** — reduz a área/VGV vendável do incorporador, e no Preliminar ela é medida e valorada pelo total da **sua categoria** no catálogo, capando no VGV bruto dessa categoria (#570). **Permuta financeira é dedução da receita**, % do VGV residencial/não residencial — cada uma sobre o VGV da sua categoria — ou valor fixo. | `proforma.ts`, `formulas.md` |
| **C6** | **O imposto NÃO segue `regime_tributario`** — a redação anterior desta convenção dizia que sim, e é falso. **Preliminar:** `frontend/proforma.ts:245` escolhe pelo booleano `sujeito_ret` (`aliquota_ret_pct`, default 4) ou, se falso, `imposto_percentual`; o campo `regime_tributario` **não é consultado**. **Avançado:** usa o par global `considerar_ret`/`ret_pct` e ignora os três (§17). Corretagem, marketing e permutas financeiras são deduções da receita antes dos custos. | `formulas.md`, `proforma.ts:245`, schema |
| **C7** | **Todo valor monetário resultado de fórmula tem 2 casas decimais** — na apresentação, na entrada e no motor. O **valor canônico** de uma premissa multiunidade é o monetário; `% do VGV` e `R$/m²` são representações **derivadas**, que carregam precisão plena internamente e arredondam só para exibir. Contrato do autor, 2026-08-01. **Estado:** `fmtR$` (`viab-format.ts:11-23`) usa 2 casas, a exportação passou a importá-lo em vez de definir formatador próprio (`exportar.ts:16`) e a sensibilidade da Proforma migrou (`tela-proforma.ts:70`, `celulaSensibilidade`, #492). **A #281 fechou com a #449** (2026-08-24): `fluxo-tabela.ts:40`, `celulaProforma` (`exportar.ts:69`, reexportada pela tela) e `celulaProformaM2` (`tela-proforma.ts:44`) — ambas extraídas de método privado pela #567 e `tela-fluxo-receitas.ts:485-486` (`precoUnit`/`precoTotal`) delegam para `celula`/`fmtR$` de `viab-format.ts`: 2 casas em todo lugar. Tabela completa (com evidência arquivo:linha) em `formulas.md`. **⚠️ Uma exceção, do autor em 2026-08-26 (#581):** valor em R$ exibido em **card de KPI** sai **sem casas decimais** (percentual em card, com **uma**), por `fmtR$Kpi` (`frontend/viab-format.ts:52`) — é exibição, não dado: persistência, entrada, motor, tabelas, Proforma, Fluxo de Caixa e exportação seguem em 2 casas. | `formulas.md`, `viab-format.ts`, `premissas-conversao.ts` |
| **C8** | **Teto de aproveitamento é DERIVADO, sem coluna própria** (#569). `areaTerreno × coef_aproveitamento_maximo` é a área privativa vendável máxima; comparada contra a área privativa **TOTAL** (`areaPrivativa` — as 4 parcelas PVT, a MESMA soma que a cascata da Incorporação chama `privativa_total`, `areas-cascata.ts`), **não** contra a área fechada que forma o VGV (C1/A2). Sem coeficiente preenchido (0/vazio) o indicador não se aplica — sai `null`, nunca "0% de aproveitamento". | `proforma.ts` (`calcularProforma`), `tela-premissas.ts` |

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

> 🔄 **Reescrito — o aviso anterior está vencido em duas frentes.** Ele dizia que todo o Bloco G é
> inerte **e** que os campos "têm controle na tela". Hoje:
>
> - **O funding roda**, desde a #355 — mas por **outras** colunas, na tabela
>   `avancado_funding_operacoes` e na aba **Funding** (§17). As colunas de Bloco G listadas acima
>   (`estrutura_*`, `financiamento_*`, `investidor_*`, `indice_correcao*`, `juros_financeiros_aa`)
>   são **dado histórico**: saíram do formulário pela #279/#355 e **não têm mais controle na tela**.
>   Procurá-las na interface é procurar o que foi removido.
> - **`regime_tributario` e os `aliquota_*_pct` continuavam sem leitor nenhum**, em qualquer
>   nível — até a #450 (2026-08-24), que os tirou também da tela (§17 tem o detalhe).
>
> O inventário vigente do que sobra sem efeito no Avançado está na **§17**.

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

**A2 — Só a área fechada é vendável.** `areaVendavel` usa `area_pvt_*_fechada` (C1); áreas abertas entram na privativa mas não são vendáveis. Somá-las à área de venda — e, num estudo sem catálogo, ao VGV — superestima a receita.

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
(`frontend/tela-fluxo-custos.ts:790-791`). Quem classifica é a **subcategoria**: toda linha
`Preço/Permuta` é tratada como permuta **financeira** pelo motor
(`ePermutaFinanceira`, `frontend/fluxo-shared.ts:601-603`). A permuta **física** vem da linha de custo
`Preço → Permuta física` (`permuta_tipologia_id` + `permuta_quantidade`), e **não** de
`unidades_permutadas` no catálogo de Tipologias: desde as #266/#267/#268 esse campo é dado
histórico, sem fallback — sem a linha de custo, o KPI é 0 (§15.1). Usar `distribuicao_modo` como critério de migração
reclassifica linhas financeiras como físicas, remove a dedução de caixa e conta a permuta física em
dobro. → **#257**, **#258**.

**A11 — valor canônico multiunidade (#259).** Premissas persistem `*_canonico` e Custos do
Avançado persistem `orcamento_valor_canonico`. A badge altera a unidade exibida **e acerta o campo legado** (#442): ele passa a carregar o mesmo
número que a tela mostra sob a badge nova, em vez de ficar congelado na unidade antiga. É a regra do
campo de Infraestrutura do Preliminar de Loteamento aplicada aqui — o canônico é o valor de registro
e não se move; a coluna por unidade é espelho de compatibilidade, que a #260 aposenta. Editar o
valor visível recalcula o canônico uma vez. Registros antigos mantêm seu valor econômico até a
primeira edição. A #260 migra todos os demais consumidores para o resolver canônico.

> ✅ **A regra que fecha esta armadilha existe desde 2026-08-01** (convenção **C7**, Anexo A): o
> canônico é o **valor monetário a 2 casas**; `%` e `R$/m²` são derivados, com precisão plena
> internamente. `converterUnidade` arredondar **tudo** a 2 casas
> (`frontend/premissas-conversao.ts:50-58`), inclusive o percentual, é o que quebra o round-trip —
> o percentual não é monetário e não deveria ser quantizado.

**A13 — A tela e a exportação formatavam dinheiro diferente; hoje a divergência é outra.**
🔄 **Reescrita:** o texto anterior dizia que `fmtR$` usava `maximumFractionDigits: 0` e que
`exportar.ts` definia o próprio `R$ = (v) => v.toFixed(2)`. **As duas coisas deixaram de valer** —
`fmtR$` fixa **2 casas** (`frontend/viab-format.ts:11-23`) e a exportação **importa** `fmtR$`
(`exportar.ts:10`). Mantê-lo como estava deixava duas descrições vigentes incompatíveis no mesmo
documento, contra o contrato **C7** do Anexo A.

**Essa armadilha fechou com a #449** (2026-08-24): `fluxo-tabela.ts:40` e a exportação
(`exportar.ts:319`, `celulaFx`) chamam a MESMA `celula` de `viab-format.ts`; a coluna R$ da Proforma
(`celulaProforma`, `exportar.ts:69` — a tela a reexporta; e `celulaProformaM2`,
`tela-proforma.ts:44` — ambas extraídas de método privado pela #567) e `tela-fluxo-receitas.ts:485-486`
(`precoUnit`/`precoTotal`) chamam `fmtR$(v, false)`. A
mesma célula sai `1.234,56` na tela, no CSV e no PDF. → **#281 fechada**; tabela de conformidade
completa em `formulas.md`.

**A12 — `travado_*` legado não é normalizado em leitura.** `recalcularTravados` corrige
`travado_inicio` de três eventos e **nunca toca `travado_duracao`**
(`backend/rotas/avancado.ts:53-75`). Corrigir o default em `cronogramaPadrao()` não alcança os
registros já gravados: a leitura devolve a flag antiga (`:278,299`) e o PATCH toma 422 (`:422`).
Toda correção de flag precisa valer **na leitura**, não só na criação. → **#246**.

**A14 — Não existe promoção Preliminar → Avançado, e o conserto dela tem grandeza diferente por
tipo (#486).** `nivel_analise` é gravado só na criação (`backend/rotas/estudos.ts:180`) e o `PATCH`
recusa alterá-lo com 422 `NIVEL_IMUTAVEL` (`montarPatchEstudo`, `:339-345` no handler antigo). Quem
supuser que existe promoção vai procurar um bug de conversão que não existe — o estado
`permuta_fisica_modo: 'area_m2'` com nulos é **indistinguível do padrão de criação**
(`schema.json:116,121`), e como não há promoção, a hipótese de resíduo de conversão cai
independentemente de qual seja a proveniência. E quem **criar** o caminho de promoção precisa saber que a grandeza de ligação difere por fonte e
por tipo: com catálogo efetivo é a **área do catálogo da categoria**
(`areaBasePermutaResidencial`/`areaBasePermutaNaoResidencial`, #570); sem catálogo, os campos
legados `area_pvt_r_fechada`/`area_pvt_nr_fechada` na Incorporação e a ALV da cascata no
Loteamento. Desde a **#564** `CASCATA_INCORPORACAO` é renderizada pela tabela de Áreas da
Incorporação (`frontend/tela-premissas.ts`), mas segue sem ser a grandeza de ligação
(`frontend/areas-cascata.ts:201-206`). A família `permuta_fisica_nr_*` vai junto.
→ registro completo na **§4.3**; a reconciliação entre as camadas é a **#441**.

**A15 — Teto de aproveitamento usa a área privativa TOTAL, não a fechada do VGV (#569).** O
indicador de aproveitamento do coeficiente máximo (**C8**) compara o teto contra `areaPrivativa` —
as 4 parcelas PVT (abertas **e** fechadas). A área vendável (**C1**/**A2**) só soma as fechadas. Um projeto com
bastante área aberta pode aparecer **sob o teto para a área vendável** e **estourando o aproveitamento** ao
mesmo tempo — não é contradição, são duas grandezas diferentes medindo coisas diferentes; tratá-las
como a mesma área leva a "consertar" um dos dois cálculos para bater com o outro, quando os dois
já estão certos.

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
