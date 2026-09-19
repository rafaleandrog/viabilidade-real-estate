// Formatadores compartilhados (pt-BR).
//
// Números usam sempre "." como separador de milhar (Intl pt-BR) — inclusive
// dentro de R$ e m² (bug #1). Porcentagens (bug #5):
//   - fmtPct       → valor CALCULADO: uma casa decimal ("xx,x%").
//   - fmtPctEntrada→ valor de ENTRADA/config: duas casas decimais ("xx,xx%").
//
// #281: todo valor monetário tem 2 casas decimais — contrato C7. A mesma
// função atende tela/PDF (com símbolo) e CSV (sem símbolo, pois o cabeçalho
// já informa R$), evitando uma segunda regra de arredondamento na exportação.
export const CASAS_DECIMAIS_MONETARIAS = 2;

export function fmtR$(v: number, comSimbolo = true): string {
  const opcoes: Intl.NumberFormatOptions = {
    minimumFractionDigits: CASAS_DECIMAIS_MONETARIAS,
    maximumFractionDigits: CASAS_DECIMAIS_MONETARIAS,
  };
  if (comSimbolo) {
    opcoes.style = 'currency';
    opcoes.currency = 'BRL';
  }
  return new Intl.NumberFormat('pt-BR', opcoes).format(v || 0);
}
/**
 * #581 — a PRIMEIRA exceção declarada ao contrato C7 (hoje são três: esta,
 * `fmtR$Milhoes` e `celulaInteira` — ver `CLAUDE.md` § Contratos inegociáveis).
 *
 * Decisão do autor em 2026-08-26 (leva Avançado, item 4): "ajustar valores em
 * R$ nos urbi-kpis para não terem casas decimais". Ela vale **só para o valor
 * exibido no card de KPI** — a figura grande que o card publica. Persistência,
 * entrada, motor, Fluxo de Caixa e as demais tabelas continuam em 2 casas (a
 * Proforma tem a SUA exceção, `celulaInteira`, #754): `R$ 171.448.400` num card
 * e `R$ 171.448.400,00` numa linha do Fluxo de Caixa são O MESMO número, e a
 * diferença é tipográfica.
 *
 * ⚠️ É uma função PRÓPRIA, e não um segundo parâmetro de `fmtR$`, de propósito.
 * Parâmetro opcional espalharia a exceção por um argumento que qualquer
 * chamador pode passar por engano — a classe de defeito que a #449 apagou.
 * Símbolo próprio torna a exceção GREPPÁVEL: `grep -rn 'fmtR\$Kpi'` devolve
 * exatamente onde ela vale, e `frontend/kpi-casas-decimais.test.ts` trava esse
 * inventário por contagem exata, nos dois sentidos.
 *
 * Fora do escopo, de propósito e por decisão registrada no PR da #581:
 *   · o `title` do card "VGV Vendável" (`frontend/fluxo-tabela.ts`), que é uma
 *     LISTA de 6 grandezas de detalhe — leitura precisa, não figura de card;
 *   · os cards de comparação de `frontend/tela-analise-mercado.ts`, que
 *     publicam R$/m² (derivada não monetária, fora do C7) e não estão no
 *     inventário da issue;
 *   · a linha de detalhe `_unidadesTipo` de `frontend/tela-premissas.ts`
 *     ("37 un · R$ 8.513,29/un"), texto corrido SEM caixa dentro do card
 *     Resumo — fica em 2 casas ao lado do card sem centavos, e mudar isso
 *     é decisão do autor (registrada no PR da #581).
 */
export function fmtR$Kpi(v: number): string {
  // Sinal normalizado APÓS o arredondamento: entre -R$ 0,50 (exclusivo) e
  // R$ 0 o Intl arredonda a fração fora mas preserva o sinal, e o card
  // publicaria "-R$ 0" — zero negativo não é um valor de KPI. O critério de
  // "arredonda a zero" é o DO PRÓPRIO Intl (half away from zero): |v| < 0,5.
  // `Math.round` não serve de proxy — `Math.round(-0.5)` é -0 (half toward
  // +∞) e engoliria o "-R$ 1" legítimo da fronteira exata -0,50.
  // (Achados do App de revisão no PR da #581, rodadas 1 e 2.)
  const valor = v || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(valor) < 0.5 ? 0 : valor);
}

/**
 * Rótulo de barra da **cascata do resultado** (aba Gráficos do Preliminar):
 * R$ em MILHÕES, com UMA casa decimal — `26.540.000` vira `"R$ 26,5"`.
 *
 * ⚠️ É a SEGUNDA exceção declarada ao contrato C7 ("todo valor monetário
 * resultado de fórmula tem 2 casas"), depois de `fmtR$Kpi` (#581). Ela vale
 * **só** para o rótulo que a barra publica: persistência, entrada, motor,
 * Fluxo de Caixa e as demais tabelas continuam em 2 casas (a Proforma tem a
 * SUA exceção, `celulaInteira`, #754) — e o valor exato, com as 2 casas,
 * continua acessível no `title` de
 * cada coluna. Ver `CLAUDE.md` § Contratos inegociáveis.
 *
 * Símbolo próprio, e não um parâmetro de `fmtR$`, pelo mesmo motivo de
 * `fmtR$Kpi`: a exceção precisa ser **greppável**. O inventário de call sites
 * é travado por contagem exata em `frontend/cascata-milhoes.test.ts`.
 *
 * O sinal é normalizado APÓS o arredondamento, como em `fmtR$Kpi`: entre
 * -R$ 50.000 (exclusivo) e R$ 0 o Intl arredonda a fração fora mas preserva o
 * sinal, e a barra publicaria "-R$ 0,0" — zero negativo não é um valor. O
 * critério é o DO PRÓPRIO Intl (half away from zero), aplicado à escala de
 * milhões: |v/1e6| < 0,05.
 */
export function fmtR$Milhoes(v: number): string {
  // `Number.isFinite`, e nao `v || 0`: o `||` engole `NaN` e `undefined` mas
  // deixa `Infinity` passar, e o Intl publica "R$ ∞" na barra. Achado da lente
  // T4 (Kimi) na rodada 1 do PR — o teste dizia cobrir "entrada nao finita" e
  // exercitava so `NaN`.
  const milhoes = (Number.isFinite(v) ? v : 0) / 1e6;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(milhoes) < 0.05 ? 0 : milhoes);
}

/**
 * Célula da coluna **R$ da Proforma** — Preliminar e Avançado, tela, tabela de
 * sensibilidade, CSV e PDF —, em **inteiros**: `283.411.826,35` sai
 * `283.411.826`; `(11.336.473,05)` sai `(11.336.473)`.
 *
 * ⚠️ É a TERCEIRA exceção declarada ao contrato C7 ("todo valor monetário
 * resultado de fórmula tem 2 casas"), depois de `fmtR$Kpi` (#581) e
 * `fmtR$Milhoes` (cascata). Pedido do autor em 2026-09-18 (#754): "todos
 * [os valores em R$ do proforma] devem mostrar números inteiros sempre. Isso
 * em qualquer proforma, preliminar ou avançado." Diferente das duas
 * anteriores, esta ALCANÇA a exportação da Proforma (CSV/PDF): elas
 * compartilham `celulaProforma` com a tela, e a paridade tela×arquivo é
 * contrato (`frontend/proforma-ordem-linhas.test.ts`). O que NÃO muda:
 * persistência, entrada, motor, Fluxo de Caixa (`celula`/`celulaFx`), as
 * demais tabelas e os textos de detalhe dentro do card — tudo em 2 casas.
 *
 * Símbolo próprio, e não um parâmetro de `celula`/`fmtR$`, pelo mesmo motivo
 * das duas anteriores: a exceção precisa ser **greppável**, e `celula` é a
 * fonte única do Fluxo de Caixa. O inventário de call sites é travado por
 * contagem exata em `frontend/proforma-inteiros.test.ts`. Não delega para
 * `fmtR$Kpi` de propósito: `kpi-casas-decimais.test.ts` exige exatamente UMA
 * ocorrência dele neste arquivo.
 *
 * Mesma regra de sinal de `celula` (`negativoContabil`), aplicada ao valor
 * JÁ arredondado — como em `fmtR$Kpi`/`fmtR$Milhoes`: uma receita a −0,3
 * arredonda para 0 e sai `0`, nunca `(0)`; um custo a 0 sai `(0)`, porque a
 * app grava custo como valor positivo e a notação contábil marca despesa
 * independente do sinal. `sempreExibir` tem a mesma semântica de `celula`,
 * com o limiar de célula vazia no análogo inteiro (< 0,5).
 */
/**
 * #754: o valor que a coluna R$ da Proforma PUBLICA — o inteiro já arredondado e
 * com o sinal normalizado (−0,3 vira 0, nunca −0). É a fonte única para
 * `celulaInteira` E para as classes de sinal (`pos`/`neg`) das linhas da
 * Proforma: a classe tem de acompanhar o texto exibido, não o valor cru —
 * senão uma receita a −R$ 0,30 publica "0" pintado de vermelho (achado P2 do
 * App do Codex no PR 758). Half away from zero, como o Intl (e `fmtR$Kpi`);
 * `Math.round(-0.5)` daria -0.
 */
export function inteiroExibido(v: number): number {
  const valor = Number.isFinite(v) ? v : 0;
  if (Math.abs(valor) < 0.5) return 0;
  return (Math.sign(valor) * Math.round(Math.abs(valor))) || 0;
}

/**
 * #754 — as colunas DERIVADAS da linha da Proforma (R$/m², % VGV) herdam o
 * sinal do R$ publicado. Quando a coluna R$ publica "0" (|v| < 0,5), o valor
 * cru que alimenta as outras duas perde o SINAL (vira o módulo) — senão a
 * mesma linha mostraria "0" em R$ e "(0)" / "-0,0%" em R$/m² e % VGV, com a
 * classe de sinal da linha (que segue o R$) pintando de positivo um texto com
 * marca de negativo (achado P2 do App do Codex no PR 758, rodada 4). Só o
 * SINAL é normalizado, nunca a magnitude: com um denominador minúsculo
 * (área 0,01 m², VGV de R$ 0,49) a R$/m² e a % VGV de um valor na faixa do
 * zero continuam sendo o número certo ("30", "61,2%"), e um valor POSITIVO
 * na faixa passa intacto — zerar a magnitude publicaria "0,0%" onde a conta é
 * 100% (achado P2 do App na rodada 7). Fora da faixa devolve o valor CRU. Uma
 * função para as três superfícies (Preliminar, Avançado, CSV/PDF), para a
 * regra não divergir por cópia.
 */
export function semZeroNegativo(v: number): number {
  if (!Number.isFinite(v)) return 0;   // mesma guarda de `inteiroExibido`: NaN/Infinity publicam 0
  return inteiroExibido(v) === 0 ? Math.abs(v) : v;
}

export function celulaInteira(v: number, opcoes: OpcoesCelula = { comParenteses: true }): string {
  const arredondado = inteiroExibido(v);
  if (!opcoes.sempreExibir && arredondado === 0) return '';
  const abs = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    .format(Math.abs(arredondado));
  if (!opcoes.comParenteses) return arredondado < 0 ? `-${abs}` : abs;
  return negativoContabil(arredondado, !!opcoes.custo) ? `(${abs})` : abs;
}

export const fmtNum = (v: number, d = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: d }).format(v || 0);

// Área em m². Existia montado à mão em cada chamador (`${fmtNum(x)} m²`), o que
// deixava a casa decimal a critério de quem escrevia a linha — e o contrato do
// repo é `decimal(12,2)` para m². Duas casas, como o R$, e o mesmo separador de
// milhar do Intl pt-BR. `null`/`undefined` viram "—", nunca "0,00 m²": zero é um
// terreno de área zero, ausência é ausência, e a tabela precisa distinguir.
export const fmtM2 = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v))
    ? '—'
    : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} m²`;

// Porcentagem calculada (resultado de conta): 1 casa decimal, vírgula.
export const fmtPct = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v || 0)}%`;

// #571: indicador cujo DENOMINADOR pode ser inválido (ex.: VGV ≤ 0) — o motor
// devolve `null` nesse caso (nunca 0), e aqui vira "—", nunca "0,0%". Mesmo
// padrão de `fmtM2`/`pctAproveitamentoCoef` (#569): ausência de base é
// diferente de "mediu zero". `fmtPct` continua exigindo `number` — quem
// chamá-lo direto com um campo agora `number | null` (`custoObrasVgvPct`,
// `margemLiquidaPct`, `receitaLiquidaSobreVgvPct`) quebra o typecheck, e é
// essa quebra que impede a regressão silenciosa de voltar a exibir "0,0%".
export const fmtPctOuIndef = (v: number | null) => (v === null ? '—' : fmtPct(v));

// Porcentagem digitada pelo usuário / benchmark: 2 casas decimais, vírgula.
export const fmtPctEntrada = (v: number) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0)}%`;

/** `formato` de uma célula não-monetária do Fluxo de Caixa — `percentual`
 * (fração de tempo/base) ou `sinal` (booleano exibido como "sim"/vazio). */
export type FormatoCelula = 'percentual' | 'sinal';

export interface OpcoesCelula {
  /** Notação contábil (parênteses) vs. sinal de menos para negativo. */
  comParenteses: boolean;
  /** Linha de CUSTO: com `comParenteses`, aparece entre parênteses mesmo
   * quando positiva (o app grava custo como valor positivo). */
  custo?: boolean;
  formato?: FormatoCelula;
  /** #567: quando true, NÃO some com o valor abaixo de R$ 0,005 — mostra
   * "0,00"/"(0,00)" em vez de célula vazia. O Fluxo de Caixa usa célula vazia
   * de propósito (mês sem movimento); a Proforma (`celulaProforma`,
   * `frontend/exportar.ts` — a tela a reexporta) controla visibilidade por LINHA
   * (`ocultarSeZero`), não por célula, e uma linha-total que fecha em zero
   * precisa continuar mostrando "0,00", não sumir. */
  sempreExibir?: boolean;
}

/**
 * #567: núcleo da notação contábil — decide só se o valor entra entre
 * parênteses (sem formatar número), para `celula` (R$, `fmtR$`) e
 * `celulaProformaM2` (`frontend/tela-proforma.ts`, R$/m², `fmtNum`) reusarem
 * a MESMA regra em vez de cada formatação numérica duplicá-la: linha de
 * CUSTO sempre entre parênteses (a app grava custo como valor positivo, e a
 * notação contábil marca despesa independente do sinal); linha de
 * receita/resultado só entre parênteses quando o valor é REALMENTE negativo
 * — nunca em módulo.
 */
export function negativoContabil(v: number, ehCusto: boolean): boolean {
  return ehCusto || v < 0;
}

/**
 * #449: célula do Fluxo de Caixa — FONTE ÚNICA para a tabela (tela) e para
 * CSV/PDF (exportação); antes desta issue cada uma tinha sua própria
 * expressão de formatação e divergiam em casas decimais, limiar de célula
 * vazia e representação do negativo (C7 — `docs/viabilidade/formulas.md`).
 *
 * Regras: 2 casas decimais monetárias (`fmtR$`, contrato C7), célula vazia
 * abaixo de R$ 0,005 (a menos que `sempreExibir`), thousand separator pt-BR.
 * `comParenteses=true` é a notação contábil que a tabela sempre usou:
 * negativo SEMPRE entre parênteses, e positivo também quando `custo=true`
 * (`negativoContabil`, acima). `comParenteses=false` usa sinal de menos
 * (`-100,00`) — o modo que a linha informativa "antes do funding" da
 * exportação usava.
 */
export function celula(v: number, opcoes: OpcoesCelula = { comParenteses: true }): string {
  if (opcoes.formato === 'percentual') return v ? fmtPct(v * 100) : '';
  if (opcoes.formato === 'sinal') return v ? 'sim' : '';
  if (!opcoes.sempreExibir && (!v || Math.abs(v) < 0.005)) return '';
  const abs = fmtR$(Math.abs(v), false);
  if (!opcoes.comParenteses) return v < 0 ? `-${abs}` : abs;
  return negativoContabil(v, !!opcoes.custo) ? `(${abs})` : abs;
}

// Interpreta um número no formato pt-BR digitado pelo usuário: "." é separador
// de milhar (descartado) e "," é o separador decimal. Vazio/inválido → null.
export function parseNumeroBR(bruto: string | null | undefined): number | null {
  if (bruto == null) return null;
  const s = String(bruto).trim();
  if (s === '') return null;
  const limpo = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  if (limpo === '' || limpo === '-' || limpo === '.' || limpo === '-.') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}
