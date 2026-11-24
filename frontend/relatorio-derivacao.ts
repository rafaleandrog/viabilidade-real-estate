/**
 * Relatório da criação de um estudo Avançado a partir de um Preliminar.
 *
 * A rota `POST /estudos/:id/derivar-avancado` devolve `{ estudo, relatorio }`. Depois de criar, a tela
 * navega para o estudo novo — e a navegação troca a tela —, então o relatório precisa atravessar essa
 * troca. Este módulo o guarda em memória (e em `sessionStorage`, quando disponível) por id do estudo
 * novo, e a tela do estudo o consome uma única vez ao carregar.
 *
 * Sem DOM e sem `lit`: é lido pela tela e pelos testes. Recarregar a página perde o relatório daqui; o
 * mesmo texto fica gravado no campo de notas do estudo (a API o devolve; a tela não o exibe).
 */

export interface ItemRelatorioDerivacao {
  origem: string;
  destino: string;
  regra: string;
  nota?: string;
  alerta?: boolean;
}

const PREFIXO = 'viab:relatorio-derivacao:';
const memoria = new Map<number, ItemRelatorioDerivacao[]>();

function armazenamento(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Guarda o relatório do estudo recém-criado. Lista vazia ou id inválido não guardam nada. */
export function guardarRelatorio(estudoId: number, itens: ItemRelatorioDerivacao[] | null | undefined): void {
  if (!Number.isFinite(estudoId) || estudoId <= 0 || !Array.isArray(itens) || itens.length === 0) return;
  memoria.set(estudoId, itens);
  try {
    armazenamento()?.setItem(PREFIXO + estudoId, JSON.stringify(itens));
  } catch { /* sem armazenamento: a memória basta */ }
}

/** Devolve o relatório guardado e o esquece — só a primeira abertura do estudo o mostra. */
export function consumirRelatorio(estudoId: number): ItemRelatorioDerivacao[] | null {
  let itens: ItemRelatorioDerivacao[] | null = memoria.get(estudoId) ?? null;
  memoria.delete(estudoId);
  try {
    const st = armazenamento();
    if (st) {
      const bruto = st.getItem(PREFIXO + estudoId);
      st.removeItem(PREFIXO + estudoId);
      if (!itens && bruto) {
        const lido = JSON.parse(bruto);
        if (Array.isArray(lido)) itens = lido as ItemRelatorioDerivacao[];
      }
    }
  } catch { /* armazenamento indisponível ou conteúdo inválido: sem relatório */ }
  return itens && itens.length > 0 ? itens : null;
}

/** Alertas primeiro; dentro de cada grupo, a ordem original do relatório. */
export function ordenarAlertasPrimeiro(itens: ItemRelatorioDerivacao[]): ItemRelatorioDerivacao[] {
  return [...itens.filter((i) => i.alerta), ...itens.filter((i) => !i.alerta)];
}

export function resumirRelatorio(itens: ItemRelatorioDerivacao[]): { total: number; alertas: number } {
  return { total: itens.length, alertas: itens.filter((i) => i.alerta).length };
}

/**
 * O botão "Criar estudo Avançado a partir deste" aparece só num estudo que não é Avançado e a que o
 * usuário pode editar (`_permissao.podeEditar`). A rota reavalia tudo — editor do estudo e nível de
 * escrita no app —; isto é só para a tela não oferecer o que ela vai recusar.
 */
export function podeCriarAvancado(
  estudo: { nivel_analise?: string } | null | undefined,
  permissao: { podeEditar?: boolean } | null | undefined,
): boolean {
  return !!estudo && estudo.nivel_analise !== 'avancado' && !!permissao?.podeEditar;
}

/**
 * O botão Criar do modal pode agir? Não com alteração não salva nas Premissas (a rota deriva do que está
 * GRAVADO, então o estudo novo omitiria o que a tela mostra) e não com uma criação em andamento.
 */
export function podeConfirmarCriacao(naoSalvas: boolean, criando: boolean): boolean {
  return !naoSalvas && !criando;
}
