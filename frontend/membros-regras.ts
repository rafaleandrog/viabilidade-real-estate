// Teto da função no estudo pelo nível do usuário no app — funções puras, sem DOM.
//
// Ponto ÚNICO da regra: o backend é o portão e as chama a cada pedido
// (`backend/permissoes-estudo.ts` na função efetiva, `backend/rotas/membros-estudo.ts`
// na concessão, `backend/rotas/estudos.ts` na listagem); a tela
// (`frontend/tela-estudo.ts`) usa as mesmas para não oferecer o que o servidor
// recusaria. Mesmo desenho de `estudo-status.ts`: o backend importa daqui, e
// não o contrário, para não haver uma segunda fonte de verdade.
//
// As regras de QUEM concede O QUÊ (editor × aprovador, a própria função, o
// último responsável) continuam em `recusaAlteracaoMembro`, no backend; aqui
// mora só o que depende do NÍVEL DO APP, mais o espelho de tela das duas.

export type FuncaoEstudo = 'leitor' | 'editor' | 'aprovador';
export type NivelApp = 'nenhuma' | 'leitura' | 'escrita' | 'admin';

export const FUNCOES_ESTUDO: readonly FuncaoEstudo[] = ['leitor', 'editor', 'aprovador'];

/**
 * Nível MÍNIMO no app para exercer cada função — o mesmo teto que o manifesto
 * declara para os papéis (`leitor` sob `leitura`, `editor` sob `escrita`,
 * `aprovador` sob `admin`). Decisão do autor: aprovador exige `admin` no app.
 * Função de estudo nunca eleva o nível do app.
 */
export const NIVEL_MINIMO_DA_FUNCAO: Readonly<Record<FuncaoEstudo, NivelApp>> = {
  leitor: 'leitura',
  editor: 'escrita',
  aprovador: 'admin',
};

const ORDEM_NIVEL: Record<NivelApp, number> = { nenhuma: 0, leitura: 1, escrita: 2, admin: 3 };

export function ehFuncaoEstudo(v: unknown): v is FuncaoEstudo {
  return v === 'leitor' || v === 'editor' || v === 'aprovador';
}

/** O nível do app comporta a função? Nível desconhecido conta como `nenhuma`. */
export function nivelComportaFuncao(nivel: string | null | undefined, funcao: FuncaoEstudo): boolean {
  const n = ORDEM_NIVEL[(nivel ?? 'nenhuma') as NivelApp] ?? 0;
  return n >= ORDEM_NIVEL[NIVEL_MINIMO_DA_FUNCAO[funcao]];
}

export interface RecusaNivel { http: 422; codigo: 'NIVEL_INSUFICIENTE'; mensagem: string }

/** Recusa por nível do app do usuário-alvo, ou `null` se o nível comporta a função. */
export function decidirNivelDoAlvo(nivel: string | null | undefined, funcao: FuncaoEstudo): RecusaNivel | null {
  if (nivelComportaFuncao(nivel, funcao)) return null;
  return {
    http: 422, codigo: 'NIVEL_INSUFICIENTE',
    mensagem: `A função "${funcao}" exige nível "${NIVEL_MINIMO_DA_FUNCAO[funcao]}" no app, e este usuário tem "${nivel || 'nenhuma'}"`,
  };
}

/**
 * Maior função que o nível do app comporta — DERIVADA de `NIVEL_MINIMO_DA_FUNCAO`,
 * para o teto da concessão e o da função efetiva não poderem divergir.
 */
function maiorFuncaoDoNivel(nivel: string | null | undefined): FuncaoEstudo | null {
  for (let i = FUNCOES_ESTUDO.length - 1; i >= 0; i--) {
    if (nivelComportaFuncao(nivel, FUNCOES_ESTUDO[i])) return FUNCOES_ESTUDO[i];
  }
  return null;
}

/**
 * Função EFETIVA de quem tem a linha `funcao` no estudo e o `nivel` no app: o
 * MÍNIMO entre a linha gravada e a maior função que o nível comporta. Uma linha
 * `aprovador` de quem tem `escrita` age como `editor`; de quem tem `leitura`,
 * como `leitor`; e sem nível nenhum, não vale nada. É a defesa para linhas
 * gravadas antes do teto, ou cujo dono perdeu nível depois.
 */
export function funcaoEfetivaDoMembro(funcao: string | null | undefined, nivel: string | null | undefined): FuncaoEstudo | null {
  if (!ehFuncaoEstudo(funcao)) return null;
  const teto = maiorFuncaoDoNivel(nivel);
  if (teto === null) return null;
  return FUNCOES_ESTUDO.indexOf(funcao) <= FUNCOES_ESTUDO.indexOf(teto) ? funcao : teto;
}

/**
 * Funções que o ator pode conceder — as mesmas que `recusaAlteracaoMembro`
 * aceita: o aprovador (ou o admin do app) concede as três; o editor, só
 * leitor e editor; o leitor, nenhuma.
 */
export function funcoesQueAtorConcede(ator: { ehAdminApp?: boolean; funcao: FuncaoEstudo | null }): FuncaoEstudo[] {
  if (ator.ehAdminApp || ator.funcao === 'aprovador') return [...FUNCOES_ESTUDO];
  if (ator.funcao === 'editor') return ['leitor', 'editor'];
  return [];
}

/** Rótulos das funções, na ordem do seletor. */
export const FUNCOES: { valor: FuncaoEstudo; rotulo: string }[] = [
  { valor: 'leitor', rotulo: 'Leitor' },
  { valor: 'editor', rotulo: 'Editor' },
  { valor: 'aprovador', rotulo: 'Aprovador' },
];

/** O `_permissao` do `GET /estudos/:id`, no que a janela Membros usa. */
export interface PermissaoTela {
  podeEditar?: boolean;
  /** Já inclui o admin do app, e já é a função EFETIVA (teto pelo nível). */
  podeAprovar?: boolean;
  ehAdminApp?: boolean;
  usuarioId?: number | null;
}

const ehResponsavel = (f: unknown) => f === 'editor' || f === 'aprovador';
const STATUS_TRAVADO_MEMBROS = ['aprovado', 'reprovado', 'arquivado'];

/** O ator gere membros neste status? Travado, só o aprovador (ou o admin). */
export function podeGerirMembros(p: PermissaoTela, status: unknown): boolean {
  return !!p.podeEditar && (!STATUS_TRAVADO_MEMBROS.includes(String(status)) || !!p.podeAprovar);
}

/**
 * Opções do seletor de função para pôr um usuário de nível `nivelAlvo`: o que o
 * ator concede, cortado pelo teto do nível do alvo. `nivelAlvo` desconhecido
 * (`undefined`: a lista de usuários não carregou) não corta — o servidor
 * continua sendo o portão e recusa com `422 NIVEL_INSUFICIENTE`.
 */
export function opcoesDeFuncao(p: PermissaoTela, nivelAlvo: string | null | undefined): { valor: FuncaoEstudo; rotulo: string }[] {
  const concede = funcoesQueAtorConcede({
    ehAdminApp: p.ehAdminApp, funcao: p.podeAprovar ? 'aprovador' : p.podeEditar ? 'editor' : null,
  });
  return FUNCOES.filter((f) => concede.includes(f.valor)
    && (nivelAlvo === undefined || nivelComportaFuncao(nivelAlvo, f.valor)));
}

/**
 * Estado do formulário "adicionar membro" para a pessoa escolhida (`nivelAlvo`
 * dela no app; `undefined` = nível desconhecido, ver `opcoesDeFuncao`): a
 * função que fica selecionada — a atual, se ainda cabe; senão a primeira que
 * cabe — e se o Adicionar pode mandar o pedido. Quando NENHUMA função cabe
 * (pessoa sem acesso ao app, ou o ator não concede nada), `funcao` é `null` e o
 * Adicionar fica desabilitado: o pedido seria um `422 NIVEL_INSUFICIENTE` certo.
 */
export function formNovoMembro(
  p: PermissaoTela,
  usuarioEscolhido: boolean,
  nivelAlvo: string | null | undefined,
  funcaoAtual: string,
): { funcao: FuncaoEstudo | null; podeAdicionar: boolean; semFuncaoPossivel: boolean } {
  const cabem = opcoesDeFuncao(p, usuarioEscolhido ? nivelAlvo : undefined).map((o) => o.valor);
  const funcao = cabem.find((f) => f === funcaoAtual) ?? cabem[0] ?? null;
  return { funcao, podeAdicionar: usuarioEscolhido && funcao !== null, semFuncaoPossivel: cabem.length === 0 };
}

/**
 * O que a linha de um membro oferece na janela Membros — espelho de
 * `recusaAlteracaoMembro` (backend/rotas/membros-estudo.ts) e do teto pelo
 * nível do alvo, para a tela não oferecer o que o servidor recusa:
 *
 * - em estudo travado só o aprovador gere membros;
 * - `aprovador` só se concede ou altera por aprovador/admin;
 * - a própria linha não se altera (salvo admin do app);
 * - o último editor/aprovador não sai nem vira leitor (`ULTIMO_RESPONSAVEL`);
 * - a função não passa do nível do alvo no app (`NIVEL_INSUFICIENTE`).
 */
export function acoesDoMembro(
  p: PermissaoTela,
  status: unknown,
  membros: { usuario_id: number | string; funcao: string }[],
  membro: { usuario_id: number | string; funcao: string },
  nivelAlvo: string | null | undefined,
): { opcoes: { valor: FuncaoEstudo; rotulo: string }[]; podeTrocarFuncao: boolean; podeRemover: boolean } {
  const gere = podeGerirMembros(p, status);
  const linhaEditavel = gere
    && (!!p.ehAdminApp || Number(membro.usuario_id) !== Number(p.usuarioId))
    && (!!p.podeAprovar || membro.funcao !== 'aprovador');
  const ultimoResp = ehResponsavel(membro.funcao) && membros.filter((m) => ehResponsavel(m.funcao)).length <= 1;
  const permitidas = opcoesDeFuncao(p, nivelAlvo).filter((o) => !(ultimoResp && o.valor === 'leitor'));
  // A função ATUAL entra sempre, só para o seletor mostrá-la (escolhê-la de novo
  // não é troca, e a tela não manda pedido); as outras são as que o servidor aceita.
  const opcoes = FUNCOES.filter((f) => f.valor === membro.funcao || permitidas.some((o) => o.valor === f.valor));
  return {
    opcoes,
    // Sem seletor quando não há para onde trocar (só a função atual sobrou).
    podeTrocarFuncao: linhaEditavel && permitidas.some((o) => o.valor !== membro.funcao),
    podeRemover: linhaEditavel && !ultimoResp,
  };
}
