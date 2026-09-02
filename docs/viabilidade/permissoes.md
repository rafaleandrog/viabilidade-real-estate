---
titulo: Permissões e Ciclo de Vida
descricao: Permissão por estudo (membership) e regras de transição de status.
tipo: app
ordem: 6
---
<!-- Siga o framework de documentação (docs/shell/documentacao.md) ao editar este arquivo -->

# Permissões e Ciclo de Vida

O app usa **permissão por estudo** (4ª camada, sobre o nível de app do shell): cada estudo tem seus próprios membros. Não há leitura global.

## Funções por estudo

| Função | Pode |
|---|---|
| **Leitor** | Visualiza e exporta. Não vê estudos em Rascunho ou Arquivado. |
| **Editor** | Cria, edita, duplica; edita imóveis (só em Rascunho); avança Rascunho → Em análise. Inclui o Leitor. |
| **Aprovador** | Aprova, reprova, devolve ao Rascunho e reabre Arquivado; edita qualquer campo mesmo após submissão (exceto trocar imóvel fora de Rascunho). Inclui o Editor. |

O criador do estudo entra como **editor**. Um administrador de app (nível `admin`) age como aprovador em qualquer estudo. Estudo sem membros: qualquer usuário com escrita+ assume editor.

## Ciclo de vida

```
Rascunho ──(editor)──▶ Em análise ──(aprovador)──▶ Aprovado
   ▲                        │  └──(aprovador)──▶ Reprovado
   └──(aprovador devolve)───┘
Arquivado ──(aprovador reabre)──▶ Rascunho
```

- **Imóvel vinculado:** editável apenas em Rascunho (restrição absoluta, mesmo para aprovador).
- **Aprovado é terminal.** Não há transição de saída de Aprovado — nem arquivar, nem reabrir, para função nenhuma. É comportamento de sempre (`gateTransicao` exclui `de === 'aprovado'` do ramo de arquivamento), registrado aqui porque a tela agora **mostra** essa ausência: a linha do estudo Aprovado não desenha botão de transição.
- **Arquivamento automático:** estudos parados (exceto Aprovado) por `prazo_arquivamento_dias` (default 30) → Arquivado. Regra em `POST /manutencao/arquivar-inativos` (idempotente); o disparo automático depende do agendador da instância.

## Onde a regra mora, e quem a lê

A tabela de transições é **uma só**, em `frontend/estudo-status.ts` (`gateTransicao`), e tem **dois leitores**:

| Leitor | Para quê |
|---|---|
| `POST /estudos/:id/status` (`backend/rotas/estudos.ts`) | **O portão.** Reavalia gate e alçada a cada chamada e recusa com `422 TRANSICAO_INVALIDA` ou `403 SEM_PERMISSAO`. Vale igual para pedido vindo da tela ou de um `curl`. |
| Painel de estudos (`frontend/tela-dashboard.ts`) | **Feedback.** `acoesTransicao(status, funcao)` decide quais botões a linha desenha, para não oferecer o que o servidor recusaria. |

O módulo mora em `frontend/` porque a direção do import já é essa no repositório (`backend/apelo-comercial.ts` importa `../frontend/proforma.js`) e o backend é bundle self-contained; ele não importa `lit` nem toca DOM.

**A coluna Status do Painel é somente informativa** — badge colorida, para toda função. As transições são botões dedicados na coluna de ações, **um por transição válida**, filtrados pela função do usuário no estudo. Até 2026-09 a coluna era um `urbi-select` com os cinco status para qualquer não-leitor, e o usuário descobria o que era proibido tomando `422`.

## Renomear um estudo

`PATCH /estudos/:id` aceita `nome` (não vazio, até 200 caracteres — o limite da coluna) de quem `podeEditarEstudo` autoriza: **editor+** em Rascunho e Em análise, **só aprovador** em Aprovado, Reprovado e Arquivado. A mesma função decide se o botão de renomear aparece na linha do Painel.

Ao gravar `nome`, o servidor **recompõe `nome_exibicao`** a partir das partes (sigla do tipo, nome, UF, sequência) — é `nome_exibicao` que as telas exibem, e sem a recomposição o nome novo ficaria invisível. `nome_exibicao` continua bloqueado para escrita pelo cliente: quem o escreve é o servidor. **`id_legivel` não muda** — ele é único e é a identidade estável do estudo; renomear altera como o estudo se apresenta, não quem ele é.

## Eventos

`estudo_criado`, `estudo_status_alterado` (cobre aprovação/reprovação/devolução/arquivamento) e `apelo_comercial_concluido`. Membros são inscritos automaticamente (forte).
