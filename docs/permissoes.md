---
titulo: Permissões e Ciclo de Vida
descricao: As três funções por estudo (leitor, editor, aprovador), o que cada uma pode, as transições de status e quem as valida, o renomear e os eventos.
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Permissões e Ciclo de Vida

> A permissão é por estudo: cada estudo tem os próprios membros, com uma função cada. Não há leitura global — quem não é membro (nem administrador do app) não vê o estudo.

## O que é

Sobre o nível de acesso ao app que a instância dá a cada pessoa (`leitura`, `escrita`, `admin` —
ver [Administração](administracao)), o app põe uma quarta camada: a **função no estudo**. Ela decide
o que a pessoa pode fazer dentro de um estudo específico e quais transições de status pode
disparar.

## Para usuários

### Funções por estudo

| Função | Pode |
|---|---|
| `leitor` | ver e exportar. Não vê estudos em Rascunho nem Arquivado. |
| `editor` | criar, editar, duplicar e remover itens do estudo (custos, tipologias, grupos, alocações, cenários, operações de funding, produtos e documentos); vincular e desvincular imóveis (só em Rascunho); excluir o próprio estudo só em Rascunho; enviar Rascunho para Em análise. Em Aprovado, Reprovado e Arquivado, toda escrita — remover inclusive — fica com o aprovador. Inclui o leitor. |
| `aprovador` | aprovar, reprovar, devolver ao Rascunho e reabrir um Arquivado; editar em qualquer status (exceto trocar imóvel fora de Rascunho). Inclui o editor. |

Quem cria o estudo entra como `editor`. O `admin` do app age como aprovador em qualquer estudo, e é
o único que entra num estudo sem membros — para re-adicionar quem precisar.

### Gerenciar membros

O `editor` adiciona, troca e remove `leitor`es e `editor`es. Conceder a função `aprovador`, ou
mexer em quem já é aprovador, é só do `aprovador` (ou do `admin` do app). Só o `admin` do app muda
a própria função, e o estudo nunca fica sem responsável: o último `editor` ou `aprovador` não pode
ser removido nem passar a `leitor`. Como toda escrita, gerenciar membros de um estudo Aprovado,
Reprovado ou Arquivado é só do `aprovador`.

A função no estudo nunca passa do nível que a pessoa tem no app:

| Função | Nível mínimo no app |
|---|---|
| `leitor` | `leitura` |
| `editor` | `escrita` |
| `aprovador` | `admin` |

Adicionar alguém, ou mudar a função de alguém, para uma função acima do nível dele no app é
recusado. E a função que vale é a menor entre a gravada no estudo e a que o nível comporta: um
membro gravado como `aprovador` que tem só `escrita` no app age como `editor` (não aprova); com
`leitura`, como `leitor`; sem acesso ao app, não entra no estudo.

Na lista de membros, a tela só oferece as linhas que a sua função permite alterar e, em cada uma,
só as funções que você pode conceder e que cabem no nível da pessoa. Ao escolher quem adicionar, o
seletor de função se ajusta ao nível dela.

### Ciclo de vida

```text
Rascunho ──(editor)──▶ Em análise ──(aprovador)──▶ Aprovado
   ▲                        │  └──(aprovador)──▶ Reprovado
   └──(aprovador devolve)───┘
Arquivado ──(aprovador reabre)──▶ Rascunho
```

- **Aprovado é final.** Não há transição de saída — nem arquivar, nem reabrir, para função nenhuma —
  e a linha do estudo Aprovado não desenha botão de transição.
- **Imóvel vinculado** só muda em Rascunho, para qualquer função.
- **Arquivamento.** Estudos parados (exceto Aprovados) por mais dias que o prazo configurado são
  arquivados pela manutenção que o administrador dispara ou agenda; ver [Administração](administracao).

Na tela, a coluna **Status** do Painel é informativa (uma badge), e as transições são botões
dedicados na coluna de ações — um por transição válida, filtrados pela sua função no estudo — para
não oferecer o que o servidor recusaria.

### Editar Premissas por status

No Preliminar, as sub-abas de Premissas são editáveis em Rascunho e Em análise por `editor` e
`aprovador`; em Aprovado e Reprovado ficam em modo de leitura para todos. Em Arquivado só o
`aprovador` edita; para o `editor` elas aparecem em modo de leitura.

### Renomear um estudo

Renomeia-se no cabeçalho do estudo aberto: quem pode editar o estudo naquele status pode
renomeá-lo (`editor` e `aprovador` em Rascunho e Em análise; só `aprovador` em Aprovado,
Reprovado e Arquivado). O nome tem até 200 caracteres e não pode ficar vazio. O identificador
legível não muda ao renomear: é a identidade estável do estudo.

## Instruções para não humanos

- Toda remoção de dentro de um estudo é `PATCH <rota do item>/remover` (por exemplo
  `PATCH /estudos/:id/avancado/custos/:cid/remover` e `PATCH /estudos/:id/remover`). O shell só deixa
  o `admin` do app usar `DELETE`, então quem tem nível `escrita` remove por esse caminho; o `DELETE`
  das mesmas rotas continua valendo para o `admin`. Em estudo Aprovado, Reprovado ou Arquivado, só
  aprovador ou `admin` remove itens; o estudo inteiro, o `editor` só exclui em Rascunho. Os cadastros
  globais (benchmarks, curvas, regiões) seguem em `DELETE`, só para o `admin`.

- `POST /estudos/:id/status` é o portão: reavalia a transição e a alçada a cada chamada e recusa
  com `422 TRANSICAO_INVALIDA` ou `403 SEM_PERMISSAO`, venha o pedido da tela ou de um cliente
  qualquer. A tabela de transições é uma só, compartilhada com o Painel, que a usa para decidir
  quais botões desenhar.
- `PATCH /estudos/:id` aceita `nome` de quem pode editar o estudo no status atual. O servidor
  recompõe `nome_exibicao` — o rótulo que as telas mostram — sempre que qualquer parte que o compõe
  chega no pedido (`nome`, `uf` ou `tipo_empreendimento`, este só em Rascunho). `nome_exibicao` não
  aceita escrita do cliente, e `id_legivel` nunca muda. Como `nome_exibicao` é o nome mais sigla,
  UF e sequência, e tem o mesmo limite de 200 caracteres, o servidor encolhe a parte do nome quando
  o rótulo estouraria; o `nome` gravado nunca é truncado.
- As rotas com `/estudos/:id/` exigem membro do estudo ou `admin` do app. Todas — inclusive produtos, documentos, apelo, análise de mercado e
  membros — aplicam as mesmas três regras: estudo excluído responde `404 ESTUDO_NAO_ENCONTRADO`;
  `leitor` recebe `403` em Rascunho e Arquivado; e escrita em estudo Aprovado, Reprovado ou
  Arquivado exige `aprovador` (`403` para o `editor`). A exceção são os imóveis: vincular e
  desvincular exigem `editor` ou acima e só acontecem em Rascunho (`422 IMOVEL_TRAVADO` nos demais
  status).
- A permissão é conferida antes do status. Quem não é membro (nem `admin` do app) recebe o mesmo
  `403` com qualquer status do estudo, inclusive ao vincular ou desvincular imóvel e ao excluir o
  estudo; o `leitor` também, nessas três ações. A resposta nunca revela o status de um estudo de
  que a pessoa não participa, nem um Rascunho ou Arquivado ao `leitor`.
- Todo `DELETE` exige nível `admin` do app: o shell recusa os demais com `403
  AUTH_NIVEL_INSUFICIENTE` antes de a rota rodar. Por isso cada exclusão de dentro do estudo tem
  também a rota `PATCH …/remover` (ver o primeiro item desta lista), pela qual o `editor` remove.
- Sub-recurso com id próprio (`:pid`, `:docId`, `:vinculoId`…) que não pertence ao estudo da URL
  responde `404`.
- Membros: `403 PROPRIA_FUNCAO` ao mudar a própria função (salvo `admin` do app);
  `403 SO_APROVADOR` quando um editor concede, altera ou remove um aprovador;
  `422 ULTIMO_RESPONSAVEL` ao remover ou rebaixar a `leitor` o último editor ou aprovador;
  `422 NIVEL_INSUFICIENTE` quando o nível do usuário no app não comporta a função pedida
  (`aprovador` exige `admin`, `editor` exige `escrita`, `leitor` exige `leitura`; usuário inexistente
  ou sem acesso conta como `nenhuma`). Em `POST /estudos/:id/membros`, `usuario_id` ausente dá
  `400 USUARIO_OBRIGATORIO` e o que não for inteiro positivo dá `400 USUARIO_INVALIDO`.
- A função que todas as rotas aplicam — e que `_permissao.funcao` do `GET /estudos/:id` e
  `_funcao` do `GET /estudos` publicam — é a efetiva: a menor entre a linha de membro e a que o
  nível do app comporta. Quem fica com função efetiva nula não vê o estudo na listagem e recebe
  `403` no detalhe.

## Eventos

`estudo_criado`, `estudo_status_alterado` (cobre aprovação, reprovação, devolução e arquivamento) e
`apelo_comercial_concluido`. Os membros do estudo são inscritos automaticamente.

## Veja também

- [Estudo de Viabilidade](readme) · [Administração](administracao) · [Estudo Preliminar](preliminar)
