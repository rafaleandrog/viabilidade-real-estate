// Regras de concessão de função por estudo (#861) — funções puras, sem DOM.
//
// Ponto ÚNICO da regra: o backend (`backend/rotas/membros-estudo.ts`) é o
// portão e chama estas funções a cada pedido; a tela (`frontend/tela-estudo.ts`)
// usa as mesmas para não oferecer o que o servidor recusaria. Mesmo desenho de
// `estudo-status.ts`: o backend importa daqui, e não o contrário, para não
// haver uma segunda fonte de verdade.
//
// O que elas fecham (reproduzido ao vivo na Pinguim em 2026-11-12):
//   1. AUTOPROMOÇÃO — um editor mudava a própria função para `aprovador` e
//      aprovava o próprio estudo;
//   2. ESTUDO SEM MEMBROS — o último membro saía e o estudo ficava aberto a
//      qualquer usuário com escrita, que se adicionava como `aprovador`.
// A segunda porta também depende do atalho `semMembros`, que saiu de
// `backend/permissoes-estudo.ts` no mesmo PR; a regra do "último responsável"
// abaixo é o que impede o estado de existir.

export type FuncaoEstudo = 'leitor' | 'editor' | 'aprovador';
export type NivelApp = 'nenhuma' | 'leitura' | 'escrita' | 'admin';

export const FUNCOES_ESTUDO: readonly FuncaoEstudo[] = ['leitor', 'editor', 'aprovador'];

/**
 * Nível MÍNIMO no app para exercer cada função — o mesmo teto que o manifesto
 * declara para os papéis (`leitor` sob `leitura`, `editor` sob `escrita`,
 * `aprovador` sob `admin`). Decisão do autor em 2026-11-12: aprovador exige
 * `admin` no app. Função de estudo nunca eleva o nível do app.
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

/** Quem está agindo sobre os membros, com a função JÁ efetiva (ver `funcaoEfetivaDoAtor`). */
export interface AtorMembros {
  usuarioId: number;
  ehAdminApp: boolean;
  /** Função efetiva no estudo: `aprovador` só se o nível do app comportar. */
  funcao: FuncaoEstudo | null;
}

export interface RecusaMembros {
  http: 403 | 422;
  codigo: 'AUTOPROMOCAO' | 'FUNCAO_ACIMA_DO_ATOR' | 'ULTIMO_RESPONSAVEL' | 'NIVEL_INSUFICIENTE';
  mensagem: string;
}

/** Funções que o ator pode conceder — a tela usa para montar o seletor. */
export function funcoesQueAtorConcede(ator: Pick<AtorMembros, 'ehAdminApp' | 'funcao'>): FuncaoEstudo[] {
  if (ator.ehAdminApp || ator.funcao === 'aprovador') return [...FUNCOES_ESTUDO];
  if (ator.funcao === 'editor') return ['leitor', 'editor'];
  return [];
}

/**
 * O ator pode pôr o alvo na função `funcaoNova` (`null` = remover do estudo)?
 * `funcaoAtual` é a função do alvo hoje (`null` = ainda não é membro).
 *
 * - admin do app: tudo (os limites de nível e de último responsável continuam
 *   valendo, nas outras duas funções);
 * - ninguém altera a PRÓPRIA função — pode só sair do estudo (sempre);
 * - só aprovador (ou admin) concede `aprovador` e altera ou remove quem já é
 *   aprovador; o editor gere leitores e editores.
 */
export function decidirAlteracaoMembro(
  ator: AtorMembros,
  alvo: { usuarioId: number; funcaoAtual: FuncaoEstudo | null },
  funcaoNova: FuncaoEstudo | null,
): RecusaMembros | null {
  if (ator.ehAdminApp) return null;
  if (alvo.usuarioId === ator.usuarioId) {
    // Sair do próprio estudo é sempre permitido (o último responsável é a outra regra).
    if (funcaoNova === null) return null;
    return {
      http: 403, codigo: 'AUTOPROMOCAO',
      mensagem: 'Você não pode alterar a própria função neste estudo — peça a um aprovador ou ao administrador do app',
    };
  }
  if (ator.funcao === 'aprovador') return null;
  if (funcaoNova === 'aprovador' || alvo.funcaoAtual === 'aprovador') {
    return {
      http: 403, codigo: 'FUNCAO_ACIMA_DO_ATOR',
      mensagem: 'Só um aprovador ou o administrador do app concede, altera ou remove a função de aprovador',
    };
  }
  return null;
}

/**
 * Depois da mudança, o estudo continua com alguém que o edite? Recusa a
 * remoção ou o rebaixamento que deixaria zero membros `editor`/`aprovador` —
 * é o estado que abria o estudo a qualquer usuário com escrita.
 */
export function decidirResponsavelRestante(
  membros: { usuario_id: number | string; funcao: string }[],
  usuarioId: number,
  funcaoNova: FuncaoEstudo | null,
): RecusaMembros | null {
  const ehResponsavel = (f: string | null) => f === 'editor' || f === 'aprovador';
  const antes = membros.filter((m) => ehResponsavel(m.funcao)).length;
  const depois = membros
    .map((m) => (Number(m.usuario_id) === usuarioId ? { ...m, funcao: funcaoNova } : m))
    .filter((m) => ehResponsavel(m.funcao)).length;
  // Recusa só a mudança que TIRA o último responsável. Um estudo que já está sem
  // editor/aprovador (dado legado) não fica travado: remover ou mudar um leitor
  // ali não piora nada — e é o admin quem o conserta, re-adicionando um editor.
  if (depois > 0 || antes === 0) return null;
  return {
    http: 422, codigo: 'ULTIMO_RESPONSAVEL',
    mensagem: 'O estudo ficaria sem editor nem aprovador — adicione outro antes de sair ou de rebaixar este membro',
  };
}

/** Recusa por nível do app do usuário-alvo, ou `null` se comporta a função. */
export function decidirNivelDoAlvo(nivel: string | null | undefined, funcao: FuncaoEstudo): RecusaMembros | null {
  if (nivelComportaFuncao(nivel, funcao)) return null;
  return {
    http: 422, codigo: 'NIVEL_INSUFICIENTE',
    mensagem: `A função "${funcao}" exige nível "${NIVEL_MINIMO_DA_FUNCAO[funcao]}" no app, e este usuário tem "${nivel || 'nenhuma'}"`,
  };
}

/** Maior função que cada nível do app comporta (o inverso de `NIVEL_MINIMO_DA_FUNCAO`). */
const MAIOR_FUNCAO_DO_NIVEL: Record<NivelApp, FuncaoEstudo | null> = {
  nenhuma: null, leitura: 'leitor', escrita: 'editor', admin: 'aprovador',
};
const ORDEM_FUNCAO: Record<FuncaoEstudo, number> = { leitor: 1, editor: 2, aprovador: 3 };

/**
 * Função EFETIVA de quem tem a linha `funcao` no estudo e o `nivel` no app: o
 * MÍNIMO entre a linha gravada e a maior função que o nível comporta. Uma linha
 * `aprovador` de quem tem `escrita` age como `editor`; de quem caiu para
 * `leitura`, como `leitor`; e sem nível nenhum, não vale nada. Função de estudo
 * nunca eleva o nível do app — é a defesa para linhas gravadas antes da regra
 * de concessão, ou cujo dono perdeu nível depois.
 */
export function funcaoEfetivaDoMembro(funcao: string | null | undefined, nivel: string | null | undefined): FuncaoEstudo | null {
  if (!ehFuncaoEstudo(funcao)) return null;
  const teto = MAIOR_FUNCAO_DO_NIVEL[(nivel ?? 'nenhuma') as NivelApp] ?? null;
  if (teto === null) return null;
  return ORDEM_FUNCAO[funcao] <= ORDEM_FUNCAO[teto] ? funcao : teto;
}

/** Rótulos das funções, na ordem do seletor. */
export const FUNCOES = [
  { valor: 'leitor', rotulo: 'Leitor' },
  { valor: 'editor', rotulo: 'Editor' },
  { valor: 'aprovador', rotulo: 'Aprovador' },
];

/**
 * #861: o que a linha de um membro oferece, derivado das mesmas regras que o
 * servidor aplica. `p` é o `_permissao` do GET do estudo: `podeAprovar` já
 * inclui o admin do app. É a regra de TELA, testada sem DOM.
 *
 * Um subconjunto CONSERVADOR do servidor, de propósito: o `_permissao` não diz se
 * quem vê é admin do app, então a tela trata o admin como aprovador e esconde o
 * seletor da própria linha, que o servidor aceitaria do admin. O erro é para
 * MENOS — a tela nunca oferece o que o servidor recusa por estas regras. A regra
 * do último responsável não é antecipada aqui: o servidor a recusa com 422.
 */
export function acoesDoMembro(
  p: { podeEditar?: boolean; podeAprovar?: boolean },
  meuId: number | null | undefined,
  membro: { usuario_id: number | string; funcao: string },
): { opcoes: { valor: string; rotulo: string }[]; podeTrocarFuncao: boolean; podeRemover: boolean } {
  const ator = { ehAdminApp: false, funcao: (p.podeAprovar ? 'aprovador' : p.podeEditar ? 'editor' : null) as FuncaoEstudo | null };
  const concede = funcoesQueAtorConcede(ator);
  const opcoes = FUNCOES.filter((f) => concede.includes(f.valor as FuncaoEstudo));
  const ehProprio = meuId != null && Number(membro.usuario_id) === Number(meuId);
  const alvoAcimaDoAtor = !concede.includes(membro.funcao as FuncaoEstudo);
  return {
    opcoes,
    // Ninguém troca a própria função; editor não mexe em aprovador.
    podeTrocarFuncao: concede.length > 0 && !ehProprio && !alvoAcimaDoAtor,
    // Sair do próprio estudo é permitido (o servidor recusa se for o último responsável).
    podeRemover: concede.length > 0 && (ehProprio || !alvoAcimaDoAtor),
  };
}
