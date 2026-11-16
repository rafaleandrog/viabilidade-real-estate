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

import { premissasSoLeitura } from './estudo-status.js';

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
 * Número decimal escrito na forma canônica (`4`, `4.00`, `-0.5`). Zero à
 * esquerda (`0123`) fica de fora: não é a forma em que o Postgres devolve um
 * `decimal`.
 */
const DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?$/;

const vazio = (v: unknown): boolean => v === '' || v == null;

/** O lado vale como número: número finito, ou decimal canônico em string. */
function comoNumero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && DECIMAL.test(v)) return Number(v);
  return null;
}

/**
 * Um campo mudou em relação ao retrato salvo? Normaliza `''`/`null` para o
 * mesmo valor antes de comparar, porque um input limpo devolve `''` onde o
 * registro trazia `null`, e isso não é edição.
 *
 * **Campo numérico compara como número; texto, como texto.** O que diz que o
 * campo é numérico é o VALOR do lado da tela ser `number`: o input numérico
 * entrega `number`, o Financeiro grava `Number(v)`, e o Postgres devolve a
 * mesma coluna `decimal` como string (`"4.00"`) — então `4` × `"4.00"` é o
 * mesmo valor. Campo de texto tem string dos dois lados e compara como texto:
 * `"10"` → `"10.0"` num nome é edição, e conta. Não é uma lista de colunas de
 * propósito: o aviso de saída compara o estudo inteiro, de qualquer tela, e
 * uma lista teria de conhecer os campos numéricos de todas elas.
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
  if (vazio(a) || vazio(b)) return vazio(a) !== vazio(b);
  if (typeof a === 'number' || typeof b === 'number') {
    const an = comoNumero(a);
    const bn = comoNumero(b);
    if (an !== null && bn !== null) return an !== bn;
  }
  return String(a) !== String(b);
}

/**
 * Chaves que pertencem a OUTRA tela e que a de Premissas carrega só porque
 * copia o registro inteiro: `nome` é do cabeçalho do estudo (renomear).
 */
const CHAVES_DE_OUTRA_TELA: ReadonlySet<string> = new Set(['nome']);

/**
 * O que a tela de Premissas propaga, a cada tecla, para a tela do estudo: o
 * formulário SEM as chaves que ela não edita. Espalhar o formulário inteiro
 * levaria de volta a cópia velha de `nome`/`nome_exibicao`/`status` que ela
 * fez ao montar — desfazendo, no `estudo`, um renomear feito depois.
 */
export function dadosPropagaveis(form: Record<string, any>): Record<string, any> {
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(form)) {
    if (CHAVES_NAO_ENVIADAS.has(k) || CHAVES_DE_OUTRA_TELA.has(k)) continue;
    r[k] = v;
  }
  return r;
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
 * O `estudo` corrente depois de a tela do estudo RECARREGAR o registro do
 * servidor (terreno do Núcleo alterado, troca de status). Recarga do mesmo
 * estudo preserva o rascunho das Premissas — ele só some no save —, exceto
 * quando o status novo deixa as Premissas só de leitura: ali não há como salvar
 * nem descartar, e a tela mostraria como do estudo números que nunca foram
 * gravados. Estudo novo (ou primeira carga) não tem rascunho a preservar.
 */
export function estudoDepoisDaRecarga(
  novo: Record<string, any>,
  atual: Record<string, any> | null | undefined,
  salvoAntigo: Record<string, any> | null | undefined,
): Record<string, any> {
  if (!atual || !salvoAntigo || salvoAntigo.id !== novo.id) return novo;
  if (premissasSoLeitura(String(novo.status))) return novo;
  return reaplicarRascunho(novo, atual, salvoAntigo);
}

/**
 * Rebase do formulário MONTADO quando o retrato do servidor muda sem trocar de
 * estudo (o Núcleo gravou a área do terreno, o status mudou). Campo que o
 * usuário NÃO editou — igual ao retrato anterior — adota o valor novo do
 * servidor; campo editado mantém a edição; e o retrato da tela passa a ser o
 * novo. Com o status novo só de leitura, as edições são descartadas (é o que o
 * modal da transição avisou).
 *
 * Sem isto, a tela montada seguia com a cópia velha de um campo que outra tela
 * gravou, devolvia-a ao estudo na primeira tecla e, depois de uma troca de
 * página, o Salvar a mandava de volta, desfazendo a gravação.
 */
export function rebasearRascunho(
  form: Record<string, any>,
  snapshotAntigo: Record<string, any>,
  salvoNovo: Record<string, any>,
): { form: Record<string, any>; snapshot: Record<string, any> } {
  const novoForm: Record<string, any> = { ...form, ...salvoNovo };
  if (!premissasSoLeitura(String(salvoNovo.status))) {
    for (const k of camposAlterados(form, snapshotAntigo)) novoForm[k] = form[k];
  }
  return { form: novoForm, snapshot: { ...salvoNovo } };
}

/**
 * A transição para `novo` vai DESCARTAR o rascunho das Premissas? É o caso em
 * que o modal de confirmação da transição avisa: há edição não salva e o
 * status novo deixa as Premissas só de leitura (`estudoDepoisDaRecarga`).
 */
export function transicaoDescartaRascunho(
  novo: string,
  estudo: Record<string, any> | null | undefined,
  estudoSalvo: Record<string, any> | null | undefined,
): boolean {
  return premissasSoLeitura(novo) && premissasNaoSalvas(estudo, estudoSalvo);
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
