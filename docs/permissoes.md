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

Quem cria o estudo entra como `editor`. O `admin` do app age como aprovador em qualquer estudo. Num
estudo ainda sem membros, qualquer usuário com nível `escrita` ou superior é aceito como editor.

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
`aprovador`; em Aprovado e Reprovado ficam em modo de leitura para todos; em Arquivado, só o
`aprovador` edita.

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
- As rotas com `/estudos/:id/` exigem membro do estudo, `admin` do app, ou nível `escrita`+ num
  estudo ainda sem membros.

## Eventos

`estudo_criado`, `estudo_status_alterado` (cobre aprovação, reprovação, devolução e arquivamento) e
`apelo_comercial_concluido`. Os membros do estudo são inscritos automaticamente.

## Veja também

- [Estudo de Viabilidade](readme) · [Administração](administracao) · [Estudo Preliminar](preliminar)
