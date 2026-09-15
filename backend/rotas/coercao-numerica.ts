// Coerção numérica na fronteira de ESCRITA — o parser único desta app para
// qualquer valor que vá parar numa coluna `decimal`/`inteiro`/`referencia`.
//
// ─────────────────────────────────────────────────────────────────────────────
// POR QUE ISTO EXISTE, e por que quatro correções anteriores não resolveram
// ─────────────────────────────────────────────────────────────────────────────
//
// Sintoma, relatado por meses: "Salvar premissas" devolvia
// `Erros de validação: Campo "gabarito_maximo" deve ser um número; Campo
// "ret_pct" deve ser um número`, e NADA era gravado (a validação do shell roda
// antes de qualquer SQL, então o PATCH inteiro é recusado).
//
// A causa escrita no código até aqui — em `estudos.ts`, em `duplicar-utils.ts` e
// no `PROGRESSO.md` — era *"o validador do shell rejeita `null` explícito em
// coluna decimal/inteiro, mesmo sendo nullable"*. **Isso é falso**, e foi medido
// contra o shell 0.55.22, a versão que a instância roda:
//
//   - `shell/backend/src/dados/validacao-dados.ts` (`validarUpdate`):
//       `if (valor === null || valor === undefined) continue;  // optional field set to null is fine`
//     e o mesmo em `validarInsert`. `null` só é recusado em coluna
//     `obrigatorio`, e aí a mensagem é "Campo obrigatório X não pode ser nulo" —
//     NUNCA "deve ser um número".
//   - o que ele recusa é `typeof valor !== 'number'`, sem coerção nenhuma.
//
// E a app manda STRING. `decimal` do `schema.json` vira `NUMERIC(p,s)` no
// Postgres, e o shell registra um único type parser customizado do `pg` — o de
// `DATE`. Sem parser para `NUMERIC` (OID 1700), o driver devolve **string**
// (medido: `pg-types@2.2.0`, `getTypeParser(1700)('4.00') === '4.00'`; já
// `INT4` devolve número). Então `GET /estudos/:id` responde `ret_pct: "4.00"`, a
// tela copia o registro inteiro para o formulário e devolve a string no PATCH.
//
// Por isso as correções anteriores não pegaram: `CAMPOS_OMITIR_SE_NULO` (#694) e
// `omitirValoresNulos` (#714) filtram `null` — e o valor nunca foi `null`. As
// duas listas que pareciam funcionar (`CAMPOS_SOMENTE_AVANCADO`,
// `CAMPOS_APOSENTADOS`) funcionam por omitirem a chave SEMPRE, o que escapa do
// `typeof` por tabela.
//
// Quatro listas nomeadas para a mesma classe é exatamente o gatilho da armadilha
// 14 do `CLAUDE.md`: *"na segunda entrada suja da mesma classe, pare de
// acrescentar guarda e inverta — um parser único, fail-closed, usado por todos
// os ramos"*. Este módulo é essa inversão.
//
// ─────────────────────────────────────────────────────────────────────────────
// A REGRA
// ─────────────────────────────────────────────────────────────────────────────
//
// Para toda chave cuja coluna o `schema.json` declara numérica:
//
//   | valor                         | resultado                                |
//   |-------------------------------|------------------------------------------|
//   | `null` / `undefined`          | passa intacto (o shell aceita, medido)   |
//   | `number` finito               | passa                                    |
//   | string decimal estrita        | `Number(v)`                              |
//   | qualquer outra coisa          | **falha nomeando o campo**               |
//
// Fail-closed de propósito: `''`, `'0x10'`, `'1e3'`, `NaN`, `Infinity`, `true`,
// objeto — nada disso vira número plausível, tudo vira erro. É a lição da
// armadilha 14, que já custou seis rodadas no PR 656 com `Number()` cru.
//
// `null` PASSA, e isso é requisito, não descuido: `_editarCustoUnidade`
// (`frontend/tela-premissas.ts`) grava `null` DE PROPÓSITO em
// `*_valor_canonico`/`*_area_canonica` quando o usuário limpa um custo por
// unidade. Omitir ou recusar esse `null` apagaria a escrita legítima.

import esquema from '../../schema.json';

/** Tipos do `schema.json` que o shell valida com `typeof valor === 'number'`. */
const TIPOS_NUMERICOS = new Set(['decimal', 'inteiro', 'referencia']);

/** Tipos que o shell exige INTEIROS (`Number.isInteger`), não só numéricos. */
const TIPOS_INTEIROS = new Set(['inteiro', 'referencia']);

/**
 * Literal decimal estrito. Recusa o que `Number()` aceitaria e não deveria:
 * `''` (vira 0), `'0x10'` (vira 16), `'1e3'` (vira 1000), `' '`, `Infinity`.
 */
const RE_DECIMAL_ESTRITO = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/;

/**
 * Parser numérico único da app: devolve o número, ou `null` quando o valor NÃO
 * é um número — o que é diferente de o valor ser `null` (ver
 * `coagirNumericosDeclarados`, que trata `null` antes de chegar aqui).
 *
 * `percentualEstrito` (`backend/rotas/estudos.ts`) delega para cá justamente
 * para não existir um segundo validador do mesmo campo — o corolário mais caro
 * da armadilha 14: *"conte quantos validadores existem para o mesmo campo"*.
 */
export function numeroEstrito(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  if (!RE_DECIMAL_ESTRITO.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Colunas numéricas por tabela, derivadas do `schema.json` (fonte única). */
const NUMERICAS_POR_TABELA: Map<string, Map<string, boolean>> = (() => {
  const mapa = new Map<string, Map<string, boolean>>();
  const tabelas = (esquema as any).tabelas as Record<string, { colunas: Record<string, { tipo: string }> }>;
  for (const [tabela, def] of Object.entries(tabelas)) {
    const colunas = new Map<string, boolean>();
    for (const [coluna, col] of Object.entries(def.colunas ?? {})) {
      if (TIPOS_NUMERICOS.has(col.tipo)) colunas.set(coluna, TIPOS_INTEIROS.has(col.tipo));
    }
    mapa.set(tabela, colunas);
  }
  return mapa;
})();

/** Só para teste de inventário — o conjunto de colunas numéricas de uma tabela. */
export function colunasNumericas(tabela: string): Set<string> {
  return new Set(exigirTabela(tabela).keys());
}

function exigirTabela(tabela: string): Map<string, boolean> {
  const colunas = NUMERICAS_POR_TABELA.get(tabela);
  // Fail-closed: tabela desconhecida não pode virar "coerção desligada em
  // silêncio". Todo chamador passa nome literal, então isto só dispara em erro
  // de digitação — e dispara no teste, não em produção.
  if (!colunas) throw new Error(`coercao-numerica: tabela "${tabela}" não existe no schema.json`);
  return colunas;
}

export interface FalhaCoercao {
  campo: string;
  mensagem: string;
}

/**
 * Coage os campos numéricos declarados de `dados`. Devolve um objeto NOVO —
 * não muta a entrada. Campos não declarados numéricos passam intactos.
 */
export function coagirNumericosDeclarados(
  tabela: string,
  dados: Record<string, any>,
): { dados: Record<string, any> } | { falha: FalhaCoercao } {
  const colunas = exigirTabela(tabela);
  const saida: Record<string, any> = {};
  for (const [campo, valor] of Object.entries(dados ?? {})) {
    const exigeInteiro = colunas.get(campo);
    if (exigeInteiro === undefined) { saida[campo] = valor; continue; }
    if (valor === null || valor === undefined) { saida[campo] = valor; continue; }
    const n = numeroEstrito(valor);
    if (n === null) {
      return { falha: { campo, mensagem: `Campo "${campo}" deve ser um número` } };
    }
    if (exigeInteiro && !Number.isInteger(n)) {
      return { falha: { campo, mensagem: `Campo "${campo}" deve ser um número inteiro` } };
    }
    saida[campo] = n;
  }
  return { dados: saida };
}

/**
 * Variante que LANÇA — para os caminhos que copiam linhas já persistidas
 * (duplicação). Ali um valor não-coercível não é entrada de usuário: é
 * inconsistência interna, e 500 com o campo nomeado é o desfecho honesto.
 */
export function coagirNumericosOuLancar(tabela: string, dados: Record<string, any>): Record<string, any> {
  const r = coagirNumericosDeclarados(tabela, dados);
  if ('falha' in r) throw new Error(`${r.falha.mensagem} (tabela "${tabela}")`);
  return r.dados;
}
