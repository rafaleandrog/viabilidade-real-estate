// Motor de cascata de áreas (2026-08-03) — funções puras, sem DOM/I/O.
//
// Modela a tabela de áreas em cascata pedida pelo autor (referência:
// `Downloads/padrao_areas.png`, planilha "MACEDO REV 10"): uma sequência
// ordenada de linhas onde cada linha é uma de três coisas —
//   · ÂNCORA 1 — a primeira linha, valor conhecido de fora (m², do Núcleo ou
//     manual), sempre 100% de si mesma.
//   · EDITÁVEL — o usuário escolhe qual unidade é a MESTRE (m² · % âncora 1 ·
//     % âncora 2, quando permitido) e digita nela; as outras duas + ha são
//     sempre derivadas, nunca persistidas.
//   · COMPUTADA — soma ou subtração de linhas anteriores; pode se tornar a
//     ÂNCORA 2 (uma nova base de 100%, usada pelas % das linhas seguintes).
//
// Regra de não-circularidade (por isso "% âncora 2" não é oferecida a toda
// editável): uma linha só referencia uma âncora que já existe ANTES dela na
// cascata. A linha que ajuda a formar a âncora 2 (ex.: APP, subtraída da
// Poligonal para dar a Parcelável) nunca pode se expressar como % dessa
// mesma âncora — no motor isso é `permiteAncora2: false`.

export type UnidadeMestre = 'm2' | 'pct_ancora1' | 'pct_ancora2';

export type Papel =
  | { tipo: 'ancora1' }
  | { tipo: 'editavel'; permiteAncora2: boolean }
  | { tipo: 'computada'; operacao: 'soma' | 'subtracao'; base?: string; termos: string[]; ehAncora2?: boolean };

export interface DefinicaoLinha {
  id: string;
  label: string;
  papel: Papel;
  /** false só para linhas ANTES da âncora 2 existir (âncora 1 e quem a compõe) — mostram "—" na coluna %âncora2. */
  mostraPctAncora2?: boolean;
}

/** Estado só das linhas `editavel` — modo escolhido + valor na unidade desse modo (m² se `m2`, senão 0–100). */
export type EstadoLinha = { modo: UnidadeMestre; valor: number };

export interface LinhaResolvida {
  id: string;
  label: string;
  papel: Papel;
  m2: number;
  ha: number;
  pctAncora1: number;
  /** `null` = célula em branco (linha antes da âncora 2 existir, ou linha que não a compõe por regra de não-circularidade não aplicável aqui — ver `permiteAncora2`). */
  pctAncora2: number | null;
}

const n = (v: any): number => Number(v) || 0;

/**
 * Resolve a cascata inteira numa passada — cada linha só depende de linhas
 * ANTERIORES no array `definicao` (garantido por construção, não verificado
 * em runtime). Precisão plena internamente (contrato C7); quem exibe é que
 * arredonda (m²/ha com `fmtNum`, % com `fmtPct`).
 */
export function calcularCascata(
  definicao: DefinicaoLinha[],
  estados: Record<string, EstadoLinha>,
  ancora1M2: number,
): LinhaResolvida[] {
  const resolvidosM2: Record<string, number> = {};
  let ancora1 = 0;
  let ancora2Provisorio: number | null = null;

  // Passada 1 — resolve todos os m² em ordem (cada linha só depende de
  // linhas ANTERIORES, garantido pela definição). `pct_ancora2` como MESTRE
  // de uma editável só é válido quando a âncora 2 já existe nesse ponto
  // (regra de não-circularidade); se a linha que a usa vier antes da âncora
  // existir na cascata, é erro de definição, não de execução — cai em 0.
  for (const def of definicao) {
    let m2: number;
    if (def.papel.tipo === 'ancora1') {
      m2 = n(ancora1M2);
      ancora1 = m2;
    } else if (def.papel.tipo === 'editavel') {
      const estado = estados[def.id];
      const modo = estado?.modo ?? 'm2';
      const valor = n(estado?.valor);
      if (modo === 'm2') m2 = valor;
      else if (modo === 'pct_ancora1') m2 = ancora1 * (valor / 100);
      else m2 = ancora2Provisorio != null ? ancora2Provisorio * (valor / 100) : 0;
    } else {
      const termosSoma = def.papel.termos.reduce((s, id) => s + (resolvidosM2[id] ?? 0), 0);
      m2 = def.papel.operacao === 'soma'
        ? termosSoma
        : (resolvidosM2[def.papel.base!] ?? 0) - termosSoma;
      if (def.papel.ehAncora2) ancora2Provisorio = m2;
    }
    resolvidosM2[def.id] = m2;
  }

  // Passada 2 — % de cada linha contra as duas âncoras, agora TOTALMENTE
  // conhecidas (a âncora 2 pode só existir depois de linhas que precisam
  // exibir % relativo a ela — ex.: "Área Privativa Total" é um componente
  // de "Área Construída Total", a âncora 2, mas quer mostrar sua própria
  // fração da âncora mesmo assim; isso é display, não cálculo de m², então
  // uma segunda passada resolve sem violar a não-circularidade dos valores).
  const ancora2 = ancora2Provisorio;
  return definicao.map((def) => {
    const m2 = resolvidosM2[def.id];
    return {
      id: def.id,
      label: def.label,
      papel: def.papel,
      m2,
      ha: m2 / 10_000,
      pctAncora1: ancora1 > 0 ? (m2 / ancora1) * 100 : 0,
      pctAncora2: def.mostraPctAncora2 && ancora2 != null && ancora2 > 0 ? (m2 / ancora2) * 100 : null,
    };
  });
}

// ── Cascata do Loteamento — as 10 linhas de `padrao_areas.png` ────────────

export const CASCATA_LOTEAMENTO: DefinicaoLinha[] = [
  { id: 'poligonal', label: 'Área da Poligonal', papel: { tipo: 'ancora1' } },
  { id: 'app', label: 'APP', papel: { tipo: 'editavel', permiteAncora2: false } },
  {
    id: 'parcelavel', label: 'Área Parcelável', mostraPctAncora2: true,
    papel: { tipo: 'computada', operacao: 'subtracao', base: 'poligonal', termos: ['app'], ehAncora2: true },
  },
  { id: 'elup_epu', label: 'Espaço Livre de Uso Público (ELUP/EPU)', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  { id: 'epc', label: 'EPC — Equipamento Público Comunitário', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  { id: 'viario_publico', label: 'Sistema viário público', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  {
    id: 'liquida', label: 'Área Líquida', mostraPctAncora2: true,
    papel: { tipo: 'computada', operacao: 'subtracao', base: 'parcelavel', termos: ['elup_epu', 'epc', 'viario_publico'] },
  },
  { id: 'viario_privado', label: 'Sistema viário privado', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  { id: 'comuns_privadas', label: 'Áreas comuns privadas (incl. portaria)', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  { id: 'verdes', label: 'Áreas verdes', mostraPctAncora2: true, papel: { tipo: 'editavel', permiteAncora2: true } },
  {
    id: 'alv', label: 'Área Líquida de Venda (ALV)', mostraPctAncora2: true,
    papel: { tipo: 'computada', operacao: 'subtracao', base: 'liquida', termos: ['viario_privado', 'comuns_privadas', 'verdes'] },
  },
];

// ── Cascata da Incorporação — proposta em 2026-08-03, ligada à tela pela
// issue #564: aba "Terreno & Áreas" renderiza esta cascata no mesmo modelo
// visual do Loteamento (`frontend/tela-premissas.ts`), sem os pares `_modo`
// de troca de unidade (a entrada é só em m², #564 critério 2). ──────────────

export const CASCATA_INCORPORACAO: DefinicaoLinha[] = [
  { id: 'terreno', label: 'Área do Terreno', papel: { tipo: 'ancora1' } },
  { id: 'pvt_r_fechada', label: 'Área Privativa Residencial Fechada', papel: { tipo: 'editavel', permiteAncora2: false } },
  { id: 'pvt_r_aberta', label: 'Área Privativa Residencial Aberta', papel: { tipo: 'editavel', permiteAncora2: false } },
  { id: 'pvt_nr_fechada', label: 'Área Privativa Não Residencial Fechada', papel: { tipo: 'editavel', permiteAncora2: false } },
  { id: 'pvt_nr_aberta', label: 'Área Privativa Não Residencial Aberta', papel: { tipo: 'editavel', permiteAncora2: false } },
  {
    id: 'privativa_total', label: 'Área Privativa Total', mostraPctAncora2: true,
    papel: { tipo: 'computada', operacao: 'soma', termos: ['pvt_r_fechada', 'pvt_r_aberta', 'pvt_nr_fechada', 'pvt_nr_aberta'] },
  },
  { id: 'comum', label: 'Área Comum Total', papel: { tipo: 'editavel', permiteAncora2: false } },
  {
    id: 'construida_total', label: 'Área Construída Total', mostraPctAncora2: true,
    papel: { tipo: 'computada', operacao: 'soma', termos: ['privativa_total', 'comum'], ehAncora2: true },
  },
];

// ── A cascata do Loteamento a partir das colunas de `estudos` (#574) ───────
//
// As 7 linhas EDITÁVEIS moram em `estudos` como um par de colunas por linha
// (`area_<x>_modo` / `area_<x>_valor`), criado pela migração
// `020_areas_cascata_loteamento.js`. Quem precisa da cascata FORA de
// `proforma.ts` — a aba Gráficos é o caso — precisa deste mapa; sem ele a
// única alternativa é ler os 7 campos "% da gleba" que a `020` APOSENTOU
// (`app_pct`, `sistema_viario_pct`, `elup_pct`, …), que nenhuma tela escreve
// desde a reestruturação do Preliminar e que ficam zerados em todo estudo
// criado depois dela.
//
// ⚠️ HOJE ESTA PONTE EXISTE TRÊS VEZES, e o nome longo é para não esconder
// isso: `proforma.ts` tem a sua (`estadosCascataLoteamento`, privada, sobre
// `ProformaInput`) e `tela-premissas.ts` tem a sua
// (`_estadosCascataAreasLot`, privada, sobre o `form` da tela). As três fazem
// a mesma tradução. Convergir as outras duas para cá é o passo seguinte —
// ficou de fora deste diff porque os dois arquivos estavam com PR em voo na
// fila da Rodada 10 (regra R3, um assunto por PR), e não porque a duplicação
// seja desejável.

/** id da linha editável da cascata do Loteamento → prefixo da coluna em `estudos`. */
export const CAMPO_POR_LINHA_LOTEAMENTO: Record<string, string> = {
  app: 'area_app', elup_epu: 'area_elup_epu', epc: 'area_epc',
  viario_publico: 'area_viario_publico', viario_privado: 'area_viario_privado',
  comuns_privadas: 'area_comuns_privadas', verdes: 'area_verdes',
};

/**
 * `area_<x>_modo` (nomes de domínio do schema) → `UnidadeMestre` (nomes
 * genéricos do motor). Qualquer valor desconhecido — inclusive `null` de
 * estudo nunca migrado — cai em `m2`, que é o padrão da coluna.
 */
export function modoMestreDoSchema(v: unknown): UnidadeMestre {
  if (v === 'pct_poligonal') return 'pct_ancora1';
  if (v === 'pct_parcelavel') return 'pct_ancora2';
  return 'm2';
}

/** Estados das 7 linhas editáveis da cascata do Loteamento, lidos de um estudo. */
export function estadosCascataLoteamentoDoEstudo(estudo: Record<string, any> | null | undefined): Record<string, EstadoLinha> {
  const estados: Record<string, EstadoLinha> = {};
  for (const [linhaId, campo] of Object.entries(CAMPO_POR_LINHA_LOTEAMENTO)) {
    estados[linhaId] = {
      modo: modoMestreDoSchema(estudo?.[`${campo}_modo`]),
      valor: n(estudo?.[`${campo}_valor`]),
    };
  }
  return estados;
}

/**
 * Composição da gleba de um Loteamento, pronta para uma pizza de áreas: as 7
 * deduções editáveis mais a Área Líquida de Venda.
 *
 * As 8 fatias fecham na poligonal POR CONSTRUÇÃO, e não por coincidência de
 * arredondamento: a cascata é `poligonal − app = parcelável`,
 * `parcelável − (elup_epu + epc + viário público) = líquida` e
 * `líquida − (viário privado + comuns privadas + verdes) = ALV`, então
 * `poligonal = as 7 deduções + ALV`. As linhas COMPUTADAS intermediárias
 * (parcelável, líquida) ficam de fora justamente porque contá-las junto
 * somaria a mesma área duas vezes.
 *
 * `areaTerrenoM2` é OBRIGATÓRIO de propósito (sem valor default): esquecer o
 * argumento vira erro de compilação em vez de uma pizza silenciosamente
 * calculada sobre uma gleba de zero.
 */
export function itensAlocacaoGleba(
  estudo: Record<string, any> | null | undefined,
  areaTerrenoM2: number,
): { l: string; v: number }[] {
  return calcularCascata(CASCATA_LOTEAMENTO, estadosCascataLoteamentoDoEstudo(estudo), areaTerrenoM2)
    .filter((l) => l.papel.tipo === 'editavel' || l.id === 'alv')
    .map((l) => ({ l: l.label, v: l.m2 }));
}
