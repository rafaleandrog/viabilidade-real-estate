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

test('#678: o botão de renomear existe no cabeçalho e é guardado por podeEditarEstudo(st, funcaoEfetiva)', () => {
  // ⚠️ A guarda é conferida pela forma INTEIRA da ternária, não pela presença
  // da chamada — mesma lição da #660: invertida, ela mostra o botão a quem o
  // PATCH recusa, e uma asserção de presença continuaria verde.
  //
  // ⚠️ `p.podeEditar` sozinho NÃO BASTA aqui — é role-only (`perm.ehEditor ||
  // podeAprovar`, `backend/rotas/estudos.ts:681`), e o PATCH real usa
  // `podeEditarEstudo(status, funcao)` (`backend/rotas/estudos.ts:727`), que
  // trava rascunho/aprovado/reprovado/arquivado para só o aprovador editar.
  // Um editor num estudo travado veria o lápis com `p.podeEditar` e levaria
  // 403 ao salvar — foi exatamente o defeito que esta issue introduziu na
  // primeira versão deste arquivo, achado relendo o próprio diff.
  assert.ok(
    FONTE_ESTUDO.includes('${podeEditarEstudo(st, funcaoEfetiva) ? html`'),
    'a guarda tem de ser a MESMA função que o PATCH usa, com o status do estudo — não só o papel do usuário',
  );
  assert.ok(
    FONTE_ESTUDO.includes('@click=${this._abrirEditarNome}'),
    'o botão do cabeçalho precisa abrir o modal de renomear',
  );
});

test('#678: `funcaoEfetiva` eleva admin de app a aprovador, como o PATCH faz — não usa `p.funcao` cru', () => {
  // Achado do Codex na 1ª correção (`7647f42`): `_permissao.funcao` vem CRU
  // (`funcao: perm.funcao,`, `backend/rotas/estudos.ts:687`) e NÃO carrega a
  // elevação de admin de app; `p.podeAprovar` sim (`perm.ehAprovador ||
  // perm.ehAdminApp`). Usar `p.funcao` puro esconde o lápis de um admin
  // não-membro num estudo travado, mesmo o PATCH permitindo — a mesma
  // classe de defeito da guarda original, na direção oposta (esconde demais
  // em vez de mostrar demais).
  assert.ok(
    FONTE_ESTUDO.includes("const funcaoEfetiva = p.podeAprovar ? 'aprovador' : (p.funcao === 'editor' ? 'editor' : 'leitor');"),
    'a elevação de admin (`p.podeAprovar`) tem que vir ANTES do papel bruto — mesma prioridade do `funcaoEfetiva` do backend',
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
    // O merge passa por `reaplicarRascunho` para não apagar uma edição de
    // Premissas ainda não salva (premissas-rascunho.ts).
    FONTE_ESTUDO.includes('this.estudo = reaplicarRascunho({ ...this.estudo, ...res }, this.estudo, this._estudoSalvo)'),
    'o merge tem que atualizar this.estudo (o cabeçalho já lê nome_exibicao dele), não this.estudos',
  );
});

test('#678: o modal está ligado ao render — estado sem montagem não desenha nada', () => {
  assert.ok(
    FONTE_ESTUDO.includes('${this.editarAlvo ? this._renderEditarNome() : nothing}'),
    'o modal existe mas nunca é montado',
  );
});

test('rascunho das Premissas: o retrato do servidor só muda com o servidor, e o beforeunload sai com a tela', () => {
  assert.ok(FONTE_ESTUDO.includes(".estudoSalvo=${this._estudoSalvo}"),
    'a tela do Preliminar não recebe o retrato do servidor — Premissas remontada volta a se dar por salva');
  assert.ok(FONTE_ESTUDO.includes('@viab:premissas-salvas=${(e: CustomEvent) => { this._estudoSalvo = { ...this._estudoSalvo, ...e.detail.dados }; }}'),
    'o save das Premissas não atualiza o retrato do servidor — o salvo volta a parecer rascunho');
  assert.ok(FONTE_ESTUDO.includes("window.addEventListener('beforeunload', this._antesDeSair)"),
    'sem beforeunload, recarregar com rascunho perde a edição sem aviso');
  assert.ok(FONTE_ESTUDO.includes("window.removeEventListener('beforeunload', this._antesDeSair)"),
    'o listener de beforeunload não sai com a tela — vaza para o próximo estudo');
});

test('rascunho das Premissas: recarga do estudo preserva o rascunho; Financeiro e Premissas propagam só o que é deles', () => {
  assert.ok(FONTE_ESTUDO.includes('this.estudo = estudoDepoisDaRecarga(estudo, this.estudo, this._estudoSalvo)'),
    '`_carregar` voltou a trocar o estudo pelo servidor e apaga o rascunho');
  const fin = semComentarios(readFileSync(new URL('./tela-financeiro.ts', import.meta.url), 'utf8'));
  assert.ok(/new CustomEvent\('viab:premissas-salvas', \{\s*detail: \{ dados \}/.test(fin),
    'o save do Financeiro não atualiza o retrato do servidor — o aviso de saída dispara à toa no Avançado');
  const prem = semComentarios(readFileSync(new URL('./tela-premissas.ts', import.meta.url), 'utf8'));
  assert.ok(prem.includes("new CustomEvent('viab:premissas-change', {\n      detail: { dados: dadosPropagaveis(this.form) }"),
    'a tela de Premissas voltou a espalhar o formulário inteiro (com o nome velho) sobre o estudo');
});

test('rascunho das Premissas: o modal de transição avisa quando o status novo descarta o rascunho', () => {
  assert.ok(FONTE_ESTUDO.includes('${transicaoDescartaRascunho(c.novo, this.estudo, this._estudoSalvo) ? html`'),
    'o modal de Aprovar/Reprovar não avisa que as alterações não salvas das Premissas serão descartadas');
  assert.ok(/_renderConfirmStatus\(\)[\s\S]{0,600}transicaoDescartaRascunho/.test(FONTE_ESTUDO),
    'o aviso saiu do modal de confirmação da transição');
});

test('Premissas só de leitura: uma regra só, usada pela tela do Preliminar e pelo rascunho', () => {
  const pre = semComentarios(readFileSync(new URL('./tela-preliminar.ts', import.meta.url), 'utf8'));
  assert.ok(pre.includes('return this._podeEscrever && !premissasSoLeitura(this.status);'),
    '`_editavelPremissas` deixou de usar `premissasSoLeitura` — a regra duplicada volta a divergir');
  const ras = semComentarios(readFileSync(new URL('./premissas-rascunho.ts', import.meta.url), 'utf8'));
  assert.ok(ras.includes('if (premissasSoLeitura(String(novo.status))) return novo;'),
    '`estudoDepoisDaRecarga` deixou de usar `premissasSoLeitura`');
  assert.ok(ras.includes('return premissasSoLeitura(novo) && premissasNaoSalvas(estudo, estudoSalvo);'),
    '`transicaoDescartaRascunho` deixou de usar `premissasSoLeitura`');
  assert.ok(!/['"]aprovado['"][\s\S]{0,40}['"]reprovado['"]/.test(ras + pre),
    'a lista aprovado/reprovado voltou a ser escrita à mão fora de `premissasSoLeitura`');
});
