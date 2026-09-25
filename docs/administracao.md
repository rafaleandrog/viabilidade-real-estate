---
titulo: Administração
descricao: O que o administrador configura antes e durante o uso do app — permissão do Núcleo, parâmetros, benchmarks, curvas de distribuição, regiões monitoradas, a rotina diária de mercado e a manutenção.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Administração

> Tudo o que é da instância e não de um estudo: a permissão de leitura do Núcleo, os sete parâmetros do app, as três telas de configuração, a rotina diária de coleta de mercado e o arquivamento de estudos parados.

## O que é

O app funciona com o que vem instalado, mas quatro coisas dependem do administrador: liberar a
leitura de imóveis do Núcleo (sem ela, só o terreno manual funciona), conferir os parâmetros
padrão (alíquotas e percentuais que preenchem os estudos novos), manter os benchmarks de cada tipo
de empreendimento (sem eles a Proforma não valida indicadores nem calcula o preço sugerido) e, se a
análise de mercado for usada, cadastrar as regiões monitoradas.

## Para administradores

### Permissão do Núcleo

Em *Admin → Apps → viabilidade → Núcleo*, conceda ao app a leitura de **imóveis** e
**parcelamentos**. É o que permite vincular uma gleba (Loteamento) ou lotes (Incorporação) a um
estudo e o que alimenta a aba **Terrenos** do Painel. A leitura de **parcelamentos** é a que
sustenta o filtro do seletor de lotes da Incorporação: lotes de parcelamento em regularização
fundiária ou vinculado a um setor habitacional ficam de fora. Sem ela, o seletor avisa que a lista
não está filtrada e mostra todos os lotes. Enquanto a permissão de **imóveis** não existir, a
criação de estudo avisa e só o terreno manual fica disponível.

### Parâmetros

Em *Admin → Apps → viabilidade*, os parâmetros do app. Cada um tem um valor padrão que vale
enquanto o administrador não o sobrescrever; a sobrescrita é o único valor persistido, e quem lê o
parâmetro lê o valor vigente — mudar o parâmetro vale a partir da próxima leitura (tela reaberta,
próxima execução da rotina ou da manutenção), sem reinstalar.

| Parâmetro | Padrão | Onde é usado |
|---|---|---|
| **Alíquota do RET** | 4 % | a alíquota fixa aplicada na Proforma quando o estudo está **Sujeito a RET**; lida ao abrir Premissas, Resultado e Gráficos |
| **Prazo de arquivamento** | 30 dias | dias sem movimentação (exceto Aprovado) até a manutenção arquivar o estudo |
| **Máximo de itens por região** | 10 | teto de itens guardados por região a cada coleta diária |
| **Alíquota padrão de imposto** (não RET) | 7 % | declarado e devolvido por `GET /config`; nenhuma tela o lê hoje |
| **Corretagem padrão** | 5 % | idem |
| **Marketing padrão** | 1 % | idem |
| **Gestão e outros indiretos padrão** | 1,25 % | idem |

Os quatro últimos existem no manifesto, mas o app ainda não os consome: os campos de imposto,
corretagem, marketing e gestão de um estudo novo nascem com o padrão do modelo de dados (7 %, 5 %,
1 % e 1,25 %), e é lá que o editor os altera. Sobrescrever esses quatro parâmetros não muda estudo
nenhum.

### Benchmarks

Aba **Benchmark** do Painel (também em *Admin → Apps → viabilidade → Benchmarks*). Um conjunto por
tipo de empreendimento, escolhido nas fichas **Loteamento** e **Incorporação**, em três seções:

- **Indicador de Benchmark** — os indicadores de meta, com **Valor** e **Regra** (*atingir ou
  superar* ou *não exceder*): `margem_bruta`, `margem_liquida`, `roi`, `custo_obras_vgv`,
  `resultado_final` e, só no Loteamento, `eficiencia_aproveitamento`.
- **Indicador de Sensibilidade** — as quatro variáveis que a análise de sensibilidade estressa
  (`preco`, `permuta_fisica`, `permuta_financeira`, `custo_obras`), com **Var + (%)** e **Var − (%)**,
  as variações padrão dos cenários Bull e Bear.
- **Faixas do medidor** — para os mesmos indicadores de meta, **Mín**, **Faixa 1 até**, **Faixa 2
  até** e **Máx**: os limites e cortes do velocímetro da aba Gráficos; em branco, as faixas saem
  automaticamente da meta.

Na primeira abertura por quem pode escrever, o app semeia sozinho, nos dois tipos, os indicadores
padrão que ainda faltam — os de meta e os quatro de sensibilidade. **Novo indicador** cria um com
identificador próprio; **Remover** apaga. Só o `admin` do app escreve; os demais veem a aba do
Painel em modo de leitura. O que cada indicador valida está em [Benchmarks](benchmarks).

### Curvas de distribuição

Aba **Curvas** do Painel (também em *Admin → Apps → viabilidade → Curvas de distribuição*). Uma
curva é um nome e uma lista de percentuais por mês, que somam 100 e repartem um custo do estudo
Avançado ao longo da sua duração. **Nova Curva** abre o editor (**Nome da curva**, **Adicionar
mês**, **Tirar**); **Editar** e **Excluir** agem sobre a linha. A **Curva S** padrão, em doze
meses, é criada sozinha na primeira leitura do catálogo e não pode ser excluída; **Criar Curva S
padrão** só a recria se por algum motivo ela faltar. A curva escolhida em cada linha de custo está descrita em
[Estudo Avançado](avancado).

### Regiões monitoradas

Aba **Regiões monitoradas** do Painel (também em *Admin → Apps → viabilidade → Regiões
monitoradas*). Cada região tem **Nome**, **UF**, **Palavras-chave** (separadas por vírgula) e o
interruptor **Ativa (entra na coleta diária)**. É a região que um estudo vincula na página
**Análise de mercado**; **Ver coletas** mostra o que a rotina guardou para ela. Ver
[Análise de Mercado](analise-mercado).

### Rotina diária de mercado

O manifesto declara a rotina **Coleta diária de mercado**, que o shell dispara uma vez por dia
para cada região ativa. Ela depende de uma fonte externa de busca, e o manifesto **não declara
hoje** os parâmetros dessa fonte: a rotina roda, registra para cada região o estado
`sem_fonte_externa` e **não grava item nenhum** — nada é inventado. A análise de mercado de um
estudo continua funcionando sobre o que existir em coletas e sobre os indicadores macro.

### Manutenção: arquivar estudos parados

O arquivamento **não é automático**. A rotina `POST /manutencao/arquivar-inativos` (só `admin` do
app) arquiva, de uma vez, os estudos sem movimentação há mais dias que o **Prazo de arquivamento**,
poupando os Aprovados, e responde quantos arquivou e o prazo usado. Cabe ao administrador chamá-la
ou agendá-la na instância. Um estudo arquivado pode ser reaberto pelo `aprovador`.

### Níveis de acesso ao app

O nível dado à pessoa em *Admin → Apps → viabilidade* decide o que ela pode fazer fora de um
estudo: `leitura` só vê os estudos de que é membro; `escrita` também cria estudos (e nasce como
`editor` deles); `admin` vê e edita todos os estudos, escreve nas três telas de configuração e
dispara a manutenção. Dentro de um estudo, o que vale é a função de membro — ver
[Permissões e ciclo de vida](permissoes).

## Instruções para não humanos

| Recurso | Rotas | Quem |
|---|---|---|
| Parâmetros | `GET /config` — devolve `{ parametros }` com seis valores vigentes (todos menos o máximo de itens por região, que só a rotina lê) | qualquer usuário do app |
| Benchmarks | `GET /benchmarks?tipo_empreendimento=…` · `POST /benchmarks` · `PATCH`/`DELETE /benchmarks/:id` · `POST /benchmarks/semear` (idempotente) | leitura para todos; escrita e semear só `admin` |
| Curvas | `GET /avancado/curvas` (cria a Curva S se faltar) · `POST /avancado/curvas` · `PATCH`/`DELETE /avancado/curvas/:cid` · `POST /avancado/curvas/semear` | escrita só `admin` |
| Regiões | `GET`/`POST /mercado/regioes` · `PATCH`/`DELETE /mercado/regioes/:rid` · `GET /mercado/regioes/:rid/coletas` | escrita só `admin` |
| Manutenção | `POST /manutencao/arquivar-inativos` → `{ ok, arquivados, prazo_dias }` | só `admin` (`403 SEM_PERMISSAO`) |

Eventos publicados no barramento da instância: `estudo_criado`, `estudo_status_alterado` e
`apelo_comercial_concluido`, cada um com link para o estudo. Os membros do estudo são inscritos
automaticamente.

## Veja também

- [Benchmarks](benchmarks) · [Análise de Mercado](analise-mercado) · [Permissões e ciclo de vida](permissoes)
- [Estudo de Viabilidade](readme) · [Estudo Avançado](avancado)
