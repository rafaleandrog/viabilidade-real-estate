// Monta os limites (min/max) e as faixas coloridas de um medidor a partir do
// benchmark. Se o admin configurou min/máx + 2 cortes (na aba Benchmark), usa 3
// faixas com cores fixas por semântica (vermelho/amarelo/verde), invertidas quando
// a regra é "não exceder" (menor é melhor). Sem configuração válida, cai na faixa
// automática de 2 cores em torno da meta. Função pura, testada.

export interface FaixaMedidor { ate: number; cor: string; }
export interface ConfigMedidor { min: number; max: number; faixas: FaixaMedidor[]; }

const COR = {
  erro: 'var(--cor-erro, #D45A3A)',
  alerta: 'var(--cor-alerta, #E0AA2A)',
  sucesso: 'var(--cor-sucesso, #13A98D)',
} as const;

export function montarMedidor(b: any, val: number): ConfigMedidor | null {
  const naoExceder = b?.regra_comparacao === 'nao_exceder';
  const cMin = Number(b?.medidor_min);
  const cMax = Number(b?.medidor_max);
  const c1 = Number(b?.medidor_faixa1_ate);
  const c2 = Number(b?.medidor_faixa2_ate);
  // Configurado = os 4 valores finitos e estritamente crescentes (min<f1<f2<max).
  const configurado = [cMin, c1, c2, cMax].every(Number.isFinite) && cMin < c1 && c1 < c2 && c2 < cMax;
  if (configurado) {
    // Cores fixas; "não exceder" inverte (verde na região baixa).
    const cores = naoExceder ? [COR.sucesso, COR.alerta, COR.erro] : [COR.erro, COR.alerta, COR.sucesso];
    return {
      min: cMin, max: cMax,
      faixas: [{ ate: c1, cor: cores[0] }, { ate: c2, cor: cores[1] }, { ate: cMax, cor: cores[2] }],
    };
  }
  // Fallback automático (2 faixas em torno da meta).
  const meta = Number(b?.valor) || 0;
  if (meta <= 0) return null;
  const max = Math.max(meta * 2, val * 1.2, meta + 10);
  const faixas: FaixaMedidor[] = naoExceder
    ? [{ ate: meta, cor: COR.sucesso }, { ate: max, cor: COR.erro }]
    : [{ ate: meta, cor: COR.erro }, { ate: max, cor: COR.sucesso }];
  return { min: 0, max, faixas };
}

// Cor da faixa do velocímetro em que o valor cai — a MESMA faixa/cor do medidor
// (config de 3 faixas ou fallback de 2). null quando não há medidor válido.
function corFaixa(b: any, val: number): string | null {
  const cfg = montarMedidor(b, val);
  if (!cfg) return null;
  const faixa = cfg.faixas.find((f) => val <= f.ate) ?? cfg.faixas[cfg.faixas.length - 1];
  return faixa.cor;
}

// Bola colorida (🟢/🟡/🔴) da faixa — para usar como emoji de status em urbi-badge.
const BOLA: Record<string, string> = {
  [COR.erro]: '🔴',
  [COR.alerta]: '🟡',
  [COR.sucesso]: '🟢',
};

// Variante (sucesso/alerta/erro) da faixa — para colorir o texto de urbi-kpi com
// os 3 níveis do velocímetro (sem emoji). Todas já suportadas pelo urbi-kpi.
const VARIANTE: Record<string, string> = {
  [COR.erro]: 'erro',
  [COR.alerta]: 'alerta',
  [COR.sucesso]: 'sucesso',
};

export function bolaFaixa(b: any, val: number): string {
  const cor = corFaixa(b, val);
  return cor ? (BOLA[cor] ?? '') : '';
}

export function varianteFaixa(b: any, val: number): string {
  const cor = corFaixa(b, val);
  return cor ? (VARIANTE[cor] ?? '') : '';
}
