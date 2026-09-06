import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─────────────────────────────────────────────────────────────────────────
// #678 — bateria de fiação MOVIDA de `frontend/tela-dashboard.test.ts` (era
// a bateria #660), porque a #678 moveu renomear do Painel para o cabeçalho
// do estudo. `frontend/estudo-status.test.ts` prova que `nomeEstudoLimpo`
// responde certo; nenhum daqueles testes fica vermelho se o componente
// parar de chamá-la — é a classe de defeito nº 1 do CLAUDE.md. Estes testes
// olham para o FONTE do componente, como a bateria original fazia.
//
// A asserção de "à esquerda de Duplicar" da bateria original não tem
// equivalente aqui: o botão saiu da coluna de ações da tabela (que tinha
// ordem entre botões) para o cabeçalho do estudo (um botão isolado, sem
// vizinho para ordenar contra) — substituída pela guarda de alçada, que é a
// que de fato importa neste local novo.
// ─────────────────────────────────────────────────────────────────────────

// Mesma função das outras suítes de fiação (`tela-dashboard.test.ts`,
// `kpi-casas-decimais.test.ts`): comentário `//` casando por acidente com o
// literal buscado não pode fingir que a chamada real ainda existe.
function semComentarios(conteudo: string): string {
  return conteudo
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((linha) => {
      const i = linha.indexOf('//');
      return i === -1 ? linha : linha.slice(0, i);
    })
    .join('\n');
}

const FONTE_ESTUDO = semComentarios(
  readFileSync(new URL('./tela-estudo.ts', import.meta.url), 'utf8'),
);

test('#678: o botão de renomear existe no cabeçalho e é guardado por podeEditarEstudo(st, p.funcao)', () => {
  // ⚠️ A guarda é conferida pela forma INTEIRA da ternária, não pela presença
  // da chamada — mesma lição da #660: invertida, ela mostra o botão a quem o
  // PATCH recusa, e uma asserção de presença continuaria verde.
  //
  // ⚠️ `p.podeEditar` sozinho NÃO BASTA aqui — é role-only (`perm.ehEditor ||
  // podeAprovar`, `backend/rotas/estudos.ts:589`), e o PATCH real usa
  // `podeEditarEstudo(status, funcao)` (`backend/rotas/estudos.ts:631`), que
  // trava rascunho/aprovado/reprovado/arquivado para só o aprovador editar.
  // Um editor num estudo travado veria o lápis com `p.podeEditar` e levaria
  // 403 ao salvar — foi exatamente o defeito que esta issue introduziu na
  // primeira versão deste arquivo, achado relendo o próprio diff.
  assert.ok(
    FONTE_ESTUDO.includes('${podeEditarEstudo(st, p.funcao) ? html`'),
    'a guarda tem de ser a MESMA função que o PATCH usa, com o status do estudo — não só o papel do usuário',
  );
  assert.ok(
    FONTE_ESTUDO.includes('@click=${this._abrirEditarNome}'),
    'o botão do cabeçalho precisa abrir o modal de renomear',
  );
});

test('#678: o modal de renomear edita `nome` cru e valida com o MESMO parser do portão', () => {
  assert.ok(
    FONTE_ESTUDO.includes('nomeEstudoLimpo(this.editarNome)'),
    'a tela precisa usar o parser compartilhado, não uma segunda regra de validação',
  );
  // O resultado do parser tem de GOVERNAR o botão — sem esta asserção, trocar
  // `?desabilitado=${limpo === null}` por `${false}` deixava a chamada no
  // lugar, o resultado ignorado, e a suíte verde.
  assert.ok(
    FONTE_ESTUDO.includes('?desabilitado=${limpo === null}'),
    'o Salvar tem de estar desabilitado enquanto o nome não for válido — senão o parser é decorativo',
  );
  assert.ok(
    FONTE_ESTUDO.includes("this.editarNome = String(this.estudo?.nome ?? '')"),
    'o campo editável é `nome`; `nome_exibicao` é derivado e carrega sigla/UF/sequência',
  );
  assert.ok(
    FONTE_ESTUDO.includes('atualizarEstudo(this.estudoId, { nome: limpo })'),
    'salvar tem de chamar o PATCH — sem isso o modal fecha sem persistir',
  );
});

test('#678: salvar faz merge em `this.estudo`, não em uma lista — o cabeçalho é UM estudo só', () => {
  assert.ok(
    FONTE_ESTUDO.includes('this.estudo = { ...this.estudo, ...res }'),
    'o merge tem que atualizar this.estudo (o cabeçalho já lê nome_exibicao dele), não this.estudos',
  );
});

test('#678: o modal está ligado ao render — estado sem montagem não desenha nada', () => {
  assert.ok(
    FONTE_ESTUDO.includes('${this.editarAlvo ? this._renderEditarNome() : nothing}'),
    'o modal existe mas nunca é montado',
  );
});
