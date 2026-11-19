# Etapa PREPARAR — uma vez, com o dono

Entrega um único PR, que o dono revisa e mergeia. Nada mais muda no repositório.

1. **Conhecer o app.** Leia `CLAUDE.md`, `KIT.md` se houver, o manifesto, o `schema.json`, as issues
   abertas, o `ideias.md` se existir e os documentos de referência do assunto.
2. **Redigir o Estado da Arte v1** a partir de `modelos/estado-da-arte.md`: o que o app é hoje e
   para onde os sinais existentes apontam. Tudo que for interpretação sua entra marcado como
   pergunta ao dono, no fim. Não invente regra de negócio.
3. **Criar os arquivos da rotina**, pelos modelos:
   - `.claude/estado-da-arte/estado-da-arte.md` (um por app, se o repositório tiver vários:
     `<appId>.md`);
   - `.claude/estado-da-arte/config.md` e `.claude/estado-da-arte/aprendizados.md`;
   - `ideias.md` na raiz, se não existir.
   **Nunca ponha o Estado da Arte em `docs/`:** essa pasta entra no pacote e é servida na
   instância, para os usuários do app. A pasta `.claude/` não entra. Confira rodando o empacotador
   e listando o conteúdo do pacote.
4. **Criar a issue-painel** com o rótulo `painel-estado-da-arte` e o corpo de `modelos/painel.md`.
5. **Abrir o PR** e dizer ao dono, em uma mensagem curta: o que ele precisa ler (o Estado da Arte),
   quais perguntas ficaram em aberto e que a rotina só começa depois do merge.

Com o dono presente, pergunte o que faltar. O Estado da Arte v1 vale mais curto e certo do que
longo e suposto.
