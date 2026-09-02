/**
 * Status do estudo: a TABELA DE TRANSIÇÕES, e quem pode fazer cada uma.
 *
 * ⚠️ **Este arquivo é lido pelos DOIS lados** — `backend/rotas/estudos.ts`
 * importa `gateTransicao`/`podeEditarEstudo` daqui, e `frontend/tela-dashboard.ts`
 * importa `acoesTransicao`/`podeEditarEstudo`. Não é conveniência: é a resposta à
 * armadilha que o comentário antigo de `_renderStatus` nomeava —
 * *"replicar a tabela de transições aqui criaria uma segunda fonte de verdade"*.
 * A #659 pede botão por transição válida, e botão por transição EXIGE que a tela
 * saiba quais são as válidas. Uma cópia da tabela na tela seria exatamente a
 * segunda fonte; um import da mesma função não é.
 *
 * O backend continua sendo o PORTÃO: `POST /estudos/:id/status` reavalia o gate
 * e a alçada, e nada aqui dispensa aquela conferência. O que este módulo oferece
 * à tela é só o que ela precisa para não OFERECER um botão que o servidor vai
 * recusar — feedback, não fronteira. É a mesma divisão que a #585 escreveu para
 * `juros_tabela_aa_padrao` ("a tela é feedback, o PATCH é o portão").
 *
 * ⚠️ Mora em `frontend/` porque a direção do import já é essa neste repositório:
 * `backend/apelo-comercial.ts:9` importa `../frontend/proforma.js`. O backend é
 * bundle self-contained (esbuild, `backend/rotas.js`), então importar daqui não
 * arrasta nada de navegador — este arquivo não importa `lit` nem toca DOM, e é
 * assim que ele tem que continuar.
 */

/** Função do usuário NO ESTUDO (`estudo_membros.funcao`). Admin de app entra como `aprovador`. */
export type FuncaoEstudo = 'leitor' | 'editor' | 'aprovador';

/** Alçada mínima que uma transição exige. */
export type GateTransicao = 'editor' | 'aprovador';

/** Os cinco status do `schema.json` (`estudos.status.opcoes`), na ordem do ciclo. */
export const STATUS_ESTUDO = [
  'rascunho', 'em_analise', 'aprovado', 'reprovado', 'arquivado',
] as const;

/**
 * Status em que só aprovador edita o estudo — o mesmo `travado` do
 * `PATCH /estudos/:id`.
 */
export const STATUS_TRAVADO: readonly string[] = ['aprovado', 'reprovado', 'arquivado'];

/**
 * Alçada exigida pela transição `de → para`, ou `null` quando a transição não
 * existe. É a MESMA função que o handler de `POST /estudos/:id/status` consulta.
 */
export function gateTransicao(de: string, para: string): GateTransicao | null {
  if (de === para) return null;
  if (de === 'rascunho' && para === 'em_analise') return 'editor';
  if (de === 'em_analise' && (para === 'aprovado' || para === 'reprovado' || para === 'rascunho')) return 'aprovador';
  if (de === 'arquivado' && para === 'rascunho') return 'aprovador'; // reabrir
  if (para === 'arquivado' && de !== 'aprovado' && de !== 'arquivado') return 'aprovador';
  return null;
}

/**
 * A função do usuário atende o gate?
 *
 * Espelha `exigirEditor`/`exigirAprovador` de `backend/permissoes-estudo.ts`:
 * aprovador inclui tudo do editor, e leitor não atende gate nenhum.
 *
 * ⚠️ **É um subconjunto CONSERVADOR do backend, de propósito.** O backend ainda
 * concede editor a quem tem `nivelApp` escrita+ num estudo SEM membros
 * (`exigirEditor` → `semMembros`). A listagem não traz esse caso: ela só devolve
 * estudo onde o usuário é membro (ou tudo, com `_funcao: 'aprovador'`, quando é
 * admin de app). Então a tela nunca esconde botão que o servidor aceitaria a
 * partir do que a listagem mandou — e, se um dia esconder, o erro é para MENOS,
 * que é o lado seguro.
 */
export function funcaoAtendeGate(funcao: string | null | undefined, gate: GateTransicao): boolean {
  if (funcao === 'aprovador') return true;
  if (gate === 'editor') return funcao === 'editor';
  return false;
}

/** Uma transição oferecida na linha do Painel, já pronta para virar botão. */
export interface AcaoTransicao {
  para: string;
  gate: GateTransicao;
  rotulo: string;
  icone: string;
  variante: 'primario' | 'fantasma' | 'perigo';
}

/**
 * Como cada transição se apresenta. As chaves são `${de}>${para}`, enumeradas
 * uma a uma — sem curinga.
 *
 * ⚠️ **O fecho entre este mapa e `gateTransicao` é conferido por CONTAGEM EXATA**
 * em `frontend/estudo-status.test.ts`: todo par com gate tem entrada aqui, toda
 * entrada daqui tem gate, e são 8. Sem esse teste, uma regra nova em
 * `gateTransicao` nasceria sem botão — e sem botão a transição some da tela sem
 * nada ficar vermelho, que é a falha calada de sempre.
 */
const APRESENTACAO: Readonly<Record<string, Omit<AcaoTransicao, 'para' | 'gate'>>> = {
  'rascunho>em_analise': { rotulo: 'Enviar para análise', icone: 'fa-solid fa-paper-plane', variante: 'fantasma' },
  'rascunho>arquivado': { rotulo: 'Arquivar', icone: 'fa-solid fa-box-archive', variante: 'fantasma' },
  'em_analise>aprovado': { rotulo: 'Aprovar', icone: 'fa-solid fa-check', variante: 'primario' },
  'em_analise>reprovado': { rotulo: 'Reprovar', icone: 'fa-solid fa-xmark', variante: 'perigo' },
  'em_analise>rascunho': { rotulo: 'Devolver para rascunho', icone: 'fa-solid fa-rotate-left', variante: 'fantasma' },
  'em_analise>arquivado': { rotulo: 'Arquivar', icone: 'fa-solid fa-box-archive', variante: 'fantasma' },
  'reprovado>arquivado': { rotulo: 'Arquivar', icone: 'fa-solid fa-box-archive', variante: 'fantasma' },
  'arquivado>rascunho': { rotulo: 'Reabrir', icone: 'fa-solid fa-rotate-left', variante: 'fantasma' },
};

/** As chaves de `APRESENTACAO`, para o teste de fecho conferir os dois sentidos. */
export const CHAVES_APRESENTACAO: readonly string[] = Object.keys(APRESENTACAO);

/** Chave de `APRESENTACAO` para um par. Exportada para o teste de fecho usar a MESMA. */
export function chaveTransicao(de: string, para: string): string {
  return `${de}>${para}`;
}

/**
 * As transições que a linha deve oferecer, dado o status atual e a função do
 * usuário. Lista vazia = nenhum botão (leitor sempre; e `aprovado`, que não tem
 * transição de saída nenhuma na tabela vigente, para função nenhuma).
 */
export function acoesTransicao(de: string, funcao: string | null | undefined): AcaoTransicao[] {
  const acoes: AcaoTransicao[] = [];
  for (const para of STATUS_ESTUDO) {
    const gate = gateTransicao(de, para);
    if (!gate) continue;
    if (!funcaoAtendeGate(funcao, gate)) continue;
    const ap = APRESENTACAO[chaveTransicao(de, para)];
    if (!ap) continue; // inalcançável: o teste de fecho prova que todo par com gate tem entrada
    acoes.push({ para, gate, ...ap });
  }
  return acoes;
}

/**
 * O usuário pode editar os campos do estudo (entre eles o nome, #660)?
 *
 * É a MESMA regra do `PATCH /estudos/:id`, que a chama: status travado
 * (aprovado/reprovado/arquivado) só aprovador edita; nos demais, editor+.
 */
export function podeEditarEstudo(status: string, funcao: string | null | undefined): boolean {
  if (STATUS_TRAVADO.includes(status)) return funcao === 'aprovador';
  return funcao === 'editor' || funcao === 'aprovador';
}

/**
 * Limite de `estudos.nome` no `schema.json` (`{ "tipo": "texto", "limite": 200 }`).
 * O nome é `obrigatorio: true` lá — daí o vazio ser recusado, não gravado em branco.
 */
export const LIMITE_NOME_ESTUDO = 200;

/**
 * O nome digitado, limpo, ou `null` quando não serve.
 *
 * ⚠️ **Fail-closed, e é a lição da armadilha 14 do `CLAUDE.md`**: em vez de
 * enumerar o que rejeitar (vazio, só espaço, número, objeto...), este parser
 * aceita apenas o que É um nome — string, não vazia depois do `trim`, dentro do
 * limite da coluna — e devolve `null` para todo o resto. Usado nos DOIS lados
 * (tela e `montarPatchEstudo`), então tela e portão não podem divergir.
 */
export function nomeEstudoLimpo(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpo = v.trim();
  if (limpo === '') return null;
  if (limpo.length > LIMITE_NOME_ESTUDO) return null;
  return limpo;
}
