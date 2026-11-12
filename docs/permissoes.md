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
| `editor` | criar, editar, duplicar; vincular e desvincular imóveis (só em Rascunho); enviar Rascunho para Em análise. Inclui o leitor. |
| `aprovador` | aprovar, reprovar, devolver ao Rascunho e reabrir um Arquivado; editar em qualquer status (exceto trocar imóvel fora de Rascunho). Inclui o editor. |

Quem cria o estudo entra como `editor`. O `admin` do app age como aprovador em qualquer estudo.

### Quem concede cada função

A função no estudo nunca passa do nível que a pessoa tem no app:

| Função | Nível mínimo no app |
|---|---|
| `leitor` | `leitura` |
| `editor` | `escrita` |
| `aprovador` | `admin` |

- O `editor` adiciona e altera **leitores e editores**. Só o `aprovador` ou o `admin` do app concede a
  função de aprovador, ou altera e remove quem já é aprovador.
- Ninguém altera a **própria** função, exceto o `admin` do app. Para sair de um estudo, remova-se da
  lista de membros.
- O estudo nunca fica sem **editor nem aprovador**: a remoção ou o rebaixamento do último é recusado.
  Adicione outro antes. (Um estudo antigo que já esteja sem nenhum não trava: o `admin` do app
  adiciona um editor.)
- Um estudo sem membros só é acessível ao `admin` do app, que adiciona quem precisar.

Na tela, a janela **Membros** só oferece as funções que você pode conceder, e não mostra o seletor
de função na sua própria linha (nem para o `admin` do app, que pode alterá-la pela API).

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
`aprovador`; em Aprovado e Reprovado ficam em modo de leitura para todos. Em Arquivado a tela deixa
digitar, mas só o `aprovador` consegue salvar: o servidor recusa o `editor` ao gravar.

### Renomear um estudo

Renomeia-se no cabeçalho do estudo aberto: quem pode editar o estudo naquele status pode
renomeá-lo (`editor` e `aprovador` em Rascunho e Em análise; só `aprovador` em Aprovado,
Reprovado e Arquivado). O nome tem até 200 caracteres e não pode ficar vazio. O identificador
legível não muda ao renomear: é a identidade estável do estudo.

## Instruções para não humanos

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
- As rotas com `/estudos/:id/` exigem membro do estudo ou `admin` do app.
- `POST /estudos/:id/membros` e `PATCH /estudos/:id/membros/:usuarioId` (e o `…/remover`) recusam
  com `403 AUTOPROMOCAO` (alterar a própria função), `403 FUNCAO_ACIMA_DO_ATOR` (editor concedendo,
  alterando ou removendo aprovador), `422 ULTIMO_RESPONSAVEL` (o estudo ficaria sem editor nem
  aprovador) e `422 NIVEL_INSUFICIENTE` (o nível do usuário no app não comporta a função — usuário
  inexistente conta como nível `nenhuma`). `usuario_id` que não é inteiro positivo dá
  `400 USUARIO_INVALIDO`.
- A função que vale é a menor entre a gravada no estudo e a que o nível do app comporta: um
  `aprovador` com nível `escrita` age como `editor`; com `leitura`, como `leitor`.

## Eventos

`estudo_criado`, `estudo_status_alterado` (cobre aprovação, reprovação, devolução e arquivamento) e
`apelo_comercial_concluido`. Os membros do estudo são inscritos automaticamente.

## Veja também

- [Estudo de Viabilidade](readme) · [Administração](administracao) · [Estudo Preliminar](preliminar)
