// Rascunho das Premissas do Preliminar — o estado "não salvo", sem DOM.
//
// O formulário de Premissas (`viab-tela-premissas`) propaga cada tecla para a
// tela do estudo (`viab-tela-estudo`), que a espelha em `estudo` para a
// Proforma e os Gráficos refletirem a edição ao vivo. Trocar de página do
// estudo DESMONTA a tela de Premissas; ao voltar, ela é montada de novo a
// partir desse `estudo` já editado. Se o retrato de comparação ("o que está
// salvo") também saísse dele, o rascunho voltaria com cara de salvo: faixa de
// "não salvo" apagada, e a edição perdida no recarregar.
//
// Por isso o retrato do servidor mora na tela do estudo (`estudoSalvo`) e é
// passado à tela de Premissas junto com o `estudo` corrente. As funções
// abaixo são o único predicado de "o que mudou" — da faixa, do Salvar e do
// aviso de saída da página.

/**
 * Chaves que o Salvar NUNCA manda: identidade e estado gerados pelo servidor,
 * colunas de soft-delete geridas pelo framework, e as estruturas de junção que
 * o GET anexa ao registro (`membros`, `imoveis`, `_permissao`, …).
 *
 * ⚠️ **A faixa de "alterações não salvas" usa a MESMA lista.** Se ela varresse
 * chaves que o Salvar descarta, o estado "não salvo" poderia ficar ligado com
 * payload vazio — a faixa acusando alteração que o PATCH nunca mandaria. A
 * defesa é a lista ser uma só, não duas iguais.
 */
export const CHAVES_NAO_ENVIADAS: ReadonlySet<string> = new Set([
  'id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id', 'criado_em', 'atualizado_em',
  'removido_em', 'removido_por_id',
  'membros', 'imoveis', '_permissao', '_funcao', 'autor_nome', 'autor_avatar_url',
]);

/**
 * Um campo mudou em relação ao retrato salvo? Normaliza `''`/`null` para o
 * mesmo valor antes de comparar, porque um input limpo devolve `''` onde o
 * registro trazia `null`, e isso não é edição.
 *
 * ⚠️ **É o predicado que decide a faixa de "alterações não salvas", o que o
 * Salvar manda e o aviso de saída da página.** Os três varrem o MESMO conjunto
 * de chaves — `Object.keys(form)` menos `CHAVES_NAO_ENVIADAS`.
 */
export function campoMudou(
  form: Record<string, any>,
  snapshot: Record<string, any>,
  k: string,
): boolean {
  const a = form[k];
  const b = snapshot[k];
  const an = (a === '' || a == null) ? null : a;
  const bn = (b === '' || b == null) ? null : b;
  return String(an) !== String(bn);
}

/** Chaves editáveis do formulário que diferem do retrato salvo. */
export function camposAlterados(form: Record<string, any>, snapshot: Record<string, any>): string[] {
  return Object.keys(form)
    .filter((k) => !CHAVES_NAO_ENVIADAS.has(k))
    .filter((k) => campoMudou(form, snapshot, k));
}

/** O formulário tem edição não salva? */
export function premissasNaoSalvas(
  form: Record<string, any> | null | undefined,
  snapshot: Record<string, any> | null | undefined,
): boolean {
  if (!form || !snapshot) return false;
  return camposAlterados(form, snapshot).length > 0;
}

/**
 * O retrato contra o qual a tela de Premissas compara, ao ser montada. É o
 * retrato do servidor quando ele é do MESMO estudo; sem ele (ou de outro
 * estudo, numa troca em voo), cai no próprio `estudo` — e aí não há rascunho
 * a acusar, que é o comportamento de quem abre o estudo agora.
 */
export function retratoSalvo(
  estudo: Record<string, any>,
  estudoSalvo: Record<string, any> | null | undefined,
): Record<string, any> {
  if (estudoSalvo && estudoSalvo.id === estudo.id) return { ...estudoSalvo };
  return { ...estudo };
}

/**
 * Remonta o `estudo` corrente sobre um retrato do servidor NOVO sem perder o
 * rascunho: todo campo que o `atual` tinha alterado em relação ao retrato
 * antigo volta por cima do novo. Usado quando a tela do estudo recebe do
 * servidor uma linha inteira por outro motivo (ex.: renomear), que não pode
 * apagar uma edição de Premissas ainda não salva.
 */
export function reaplicarRascunho(
  novoSalvo: Record<string, any>,
  atual: Record<string, any>,
  salvoAntigo: Record<string, any> | null | undefined,
): Record<string, any> {
  const r = { ...novoSalvo };
  if (!salvoAntigo) return r;
  for (const k of camposAlterados(atual, salvoAntigo)) r[k] = atual[k];
  return r;
}

/**
 * Tratador de `beforeunload`: com rascunho, pede ao navegador a confirmação
 * nativa de saída. Devolve se pediu.
 */
export function avisarSaidaSeNaoSalvo(e: Pick<BeforeUnloadEvent, 'preventDefault'> & { returnValue?: any }, naoSalvo: boolean): boolean {
  if (!naoSalvo) return false;
  e.preventDefault();
  // Navegadores antigos só mostram a confirmação com `returnValue` atribuído.
  e.returnValue = '';
  return true;
}
