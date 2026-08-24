// ─────────────────────────────────────────────────────────────────────────
// #463 — cenário dourado de recebíveis da EVI Urbitá, SAFRA ÚNICA (mês 0).
//
// Este módulo é FIXTURE, não runtime: não entra no bundle de `index.ts`,
// serve só a `evi-urbita-golden.test.ts`. Traz os NÚMEROS já apurados de
// `docs/rodada-8/02-regras-evi.md` §3 (cenário dourado, reconciliado
// célula a célula contra `EVI_Urbita.xlsx`), como dado versionado — não
// como expectativa sobre uma instância viva (que não existe: nenhum estudo
// real reproduz este cenário em Pinguim hoje).
//
// ⚠️ SAFRA ÚNICA, e só — mesma restrição que `#428 golden EVI safra única`
// já declara em `frontend/fluxo-caixa-motor.test.ts:2240-2246`: `cfINC!AY` é
// um PMT rolante sobre um POOL multi-safra, não amortização por safra
// isolada. As "36 parcelas iguais" e as "29 parcelas iguais" só existem
// quando há UMA safra. Este fixture não tenta, e não deve tentar, reproduzir
// os totais de PROJETO (VGV completo R$ 174.870.231,97, juros totais
// R$ 8.981.262 = 5,41% do VGV, receita líquida 90,26% do VGV) — esses
// dependem do motor somar uma curva de vendas inteira, método que o app
// deliberadamente não replica célula a célula (ver `#428` e `#465`, esta
// última ainda sem a grandeza "Receita líquida de proforma" no código).
//
// Os 4 componentes e as taxas: `Premissas e Resultados!H14`
// (`ClienteJurosAA = 12,5% a.a.`), convertida por
// `ClienteJurosAM = (1+aa)^(1/12) − 1 = 0,0098635806…` — a MESMA taxa mensal
// já usada pelos dois goldens de `#428` em `fluxo-caixa-motor.test.ts`, para
// que os três arquivos fiquem cruzáveis entre si.

/** Base contratada da safra do mês 0 (`cfINC!AH19`/coluna de contratação). */
export const BASE_CONTRATADA = 7_603_022.19;

/** Taxa de juros de tabela mensal, `(1,125)^(1/12) − 1`, plena precisão. */
export const TAXA_MENSAL = 0.0098635806;

/** Mês do fim da Obra no cenário dourado (`EtapaObraFim` = 29 → repasse no mês 30). */
export const FIM_OBRA_MES = 29;
export const MES_REPASSE = FIM_OBRA_MES + 1;

/**
 * Os 4 componentes do plano de pagamento da EVI, no shape canônico do app
 * (`ComponentePagamento` de `frontend/fluxo-caixa-motor.ts`) — repetido aqui
 * como literal, não importado, para que este fixture não dependa do TIPO do
 * motor (só dos valores) e continue compilando mesmo que o motor acrescente
 * campos opcionais novos.
 */
export const COMPONENTES_EVI = [
  { tipo: 'imediato' as const, participacaoPct: 10, descontoPct: 0, rotulo: 'à vista' },
  {
    tipo: 'prazo_fixo' as const, participacaoPct: 10, sinalPct: 15, prazoMeses: 36,
    defasagemMeses: 1, taxaMensal: TAXA_MENSAL, jurosNoMesDaContratacao: false,
    rotulo: 'tabela curta',
  },
  {
    tipo: 'ate_marco' as const, participacaoPct: 24, sinalPct: 0, marcoMes: FIM_OBRA_MES,
    defasagemMeses: 1, taxaMensal: TAXA_MENSAL, jurosNoMesDaContratacao: false,
    rotulo: 'ao longo da obra',
  },
  {
    tipo: 'concentrado' as const, participacaoPct: 56, mesPagamento: MES_REPASSE,
    taxaMensal: TAXA_MENSAL, rotulo: 'saldo a repassar',
  },
];

/** Os números apurados na planilha, para o cenário de safra única acima. */
export const EVI_ESPERADO = {
  /** `cfINC!BI19` — receita do mês 0: imediato (10%) + sinal do prazo fixo (15% de 10%). */
  receitaMes0: 874_347.55,
  /** `cfINC!AY20` — sinal do componente `prazo_fixo` (10% × 15%). */
  sinalPrazoFixo: 114_045.33,
  /** `cfINC!AY20` — 36 parcelas iguais do componente `prazo_fixo` (PMT rolante sobre pool = amortização por safra, só em safra única). */
  qtdParcelasPrazoFixo: 36,
  parcelaPrazoFixo: 21_414.48,
  /** `cfINC!AD20` — 29 parcelas iguais do componente `ate_marco` (marco = fim da Obra). */
  qtdParcelasAteMarco: 29,
  parcelaAteMarco: 72_656.88,
  /** `cfINC!AJ/AK/AL` — saldo a repassar, capitalizado do mês 0 ao mês 30. */
  principalRepasse: 4_257_692.43, // 56% × BASE_CONTRATADA
  repasseMes30: 5_715_517.93,
  jurosRepasseMes30: 1_457_825.50,
};
