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
- **Arquivamento automático:** estudos parados (exceto Aprovado) por `prazo_arquivamento_dias` (default 30) → Arquivado. Regra em `POST /manutencao/arquivar-inativos` (idempotente); o disparo automático depende do agendador da instância.

## Eventos

`estudo_criado`, `estudo_status_alterado` (cobre aprovação/reprovação/devolução/arquivamento) e `apelo_comercial_concluido`. Membros são inscritos automaticamente (forte).
