// Caso de render: benchmark `margem_liquida` LIMPO (valor: null, estado que
// `POST /benchmarks` grava de propósito — `backend/rotas/benchmarks.ts:105`,
// `valor: valor ?? null`, e a coluna não é obrigatória em `schema.json`) tem
// que cair no fallback de 20%, não virar meta 0% em silêncio.
//
// `bmValorMargem !== undefined` sozinho deixava `null` passar (`null !==
// undefined` é verdadeiro), e `Number(null) === 0` é finito — a margem-alvo
// virava 0% sem aviso, e "Terreno máximo" superestimava o valor residual por
// não subtrair lucro-alvo nenhum (achado do App do Codex, PR #757, rodada 3).
//
// A prova é o `title` do cartão "Terreno máximo", que SEMPRE cita
// `fmtPct(margemAlvoPct)` (ao contrário dos outros três, que podem cair num
// ramo sem percentual): com o fix, começa com "...margem-alvo (20,0%...".

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';

const PRODUTOS = [{ id: 1, nome: 'Bloco A', ordem: 0, area_media_m2: 100, preco_venda_m2: 5_000, unidades: 50 }];

const ESTUDO_BENCHMARK_NULO = {
  id: 902,
  nome: 'Margem de segurança — benchmark de margem-alvo limpo (null)',
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 2_000,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 2_000,
};

const BENCHMARKS_MARGEM_NULA = [
  { tipo_empreendimento: 'incorporacao', campo: 'margem_liquida', valor: null, regra_comparacao: 'atingir_ou_superar', variacao_positiva_pct: 10, variacao_negativa_pct: 10 },
];

export const caso = {
  nome: 'margem-seguranca-benchmark-nulo',
  exigir: [
    { seletor: 'div.margem-cartao', minimo: 4 },
    // A prova: o cartão "Terreno máximo" cita 20,0% (o fallback), não 0,0%
    // (o que `Number(null)` produziria sem a checagem de `null`).
    { seletor: 'div.margem-cartao[title^="Valor residual do terreno até a margem-alvo (20,0%"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.label',
    'urbi-select.opcoes',
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono, e ESCREVE POR CIMA
    // do `benchmarks` forçado abaixo assim que `listarBenchmarks` resolve —
    // por isso o benchmark nulo precisa vir do MOCK da API (`/benchmarks`),
    // não só do `forcarEstado` (mesma armadilha documentada em
    // `cenarios-sensibilidade.ts`).
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      if (rota.includes('/benchmarks')) return { dados: BENCHMARKS_MARGEM_NULA };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO_BENCHMARK_NULO, secao: 'cenarios', benchmarks: BENCHMARKS_MARGEM_NULA,
      produtos: PRODUTOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
