// Caso de render: #611 — o KPI "Vendável / gleba" de um Loteamento **sem área
// de gleba**, na aba Premissas → Produtos (`frontend/tela-premissas.ts:_renderResumo`).
//
// ⚠️ O QUE SÓ ESTE CASO MEDE, E COMO. `eficienciaParaFaixa` está testada como
// função pura em `proforma.test.ts`; trocar a chamada de volta por
// `p.eficienciaPct` no template **não derruba nenhum teste de lógica pura** —
// é a classe 1 do `CLAUDE.md`, o defeito na fiação. A prova aqui é
// **aritmética sobre o atributo**: `variante` é binding de ATRIBUTO no
// template, então o Lit o escreve literalmente no DOM, e o seletor
// `urbi-kpi[variante=""]` conta quantos KPIs saíram **sem cor**.
//
// O Resumo do Loteamento tem 6 KPIs, e cinco deles nascem com `variante: ''`
// por construção. O sexto é o "Vendável / gleba": com o conserto ele também
// sai vazio (6 casam); sem o conserto ele sai `variante="erro"` e só 5 casam —
// o piso de 6 reprova. É a forma de provar uma AUSÊNCIA de cor com um `exigir`
// que só sabe exigir presença.
//
// Por isso o fixture precisa das duas metades: um benchmark de eficiência
// REALMENTE configurado (senão `varianteFaixa` devolveria '' por falta de
// medidor, e o caso passaria sem medir nada) e uma gleba de área ZERO.

import '../../tela-premissas.js';
import { forcarEstado } from './dados.js';

// Loteamento recém-criado: sem área de terreno informada. `areaTerreno = 0`
// → `eficienciaPct = null` e `eficienciaMedida = false`.
const ESTUDO_LOT_SEM_GLEBA: Record<string, any> = {
  id: 23,
  nome: 'Render Check — Loteamento sem gleba',
  tipo_empreendimento: 'loteamento',
  nivel_analise: 'preliminar',
  origem_terreno: 'manual',
  terreno_manual_area: 0,
  sujeito_ret: true,
  imposto_percentual: 4,
  corretagem_percentual: 5,
  marketing_percentual: 1,
};

// Benchmark de eficiência com as 4 âncoras (40 · 50 · 60 · 80, "atingir ou
// superar"): o valor 0 cai na primeira faixa, que nessa regra é a VERMELHA.
// Sem ele o caso seria vacuidade — `varianteFaixa` devolve '' para qualquer
// valor quando não há medidor configurado.
const BENCHMARKS = [
  {
    id: 1, campo: 'eficiencia_aproveitamento', rotulo: 'Vendável / gleba',
    regra_comparacao: 'atingir_ou_superar', valor: 55,
    medidor_min: 40, medidor_faixa1_ate: 50, medidor_faixa2_ate: 60, medidor_max: 80,
  },
];

export const caso = {
  nome: 'eficiencia-sem-gleba',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'div.kpis', minimo: 1 },
    // Os 6 KPIs do Resumo do Loteamento: Área da gleba · Área vendável ·
    // Vendável / gleba · VGV · Nº de lotes · Margem sobre VGV.
    { seletor: 'div.kpis urbi-kpi', minimo: 6 },
    // ⚠️ A ASSERÇÃO DA #611, e ela é a contagem acima INTEIRA sem cor. Sem o
    // conserto, "Vendável / gleba" sai `variante="erro"` e sobram 5.
    { seletor: 'div.kpis urbi-kpi[variante=""]', minimo: 6 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  //
  // ⚠️ `urbi-kpi.variante` aparece aqui, e vale entender por que isso NÃO
  // esvazia a asserção: o que o stub deixa de reproduzir é a **pintura** da
  // variante. Este caso não mede pintura — mede o **atributo** que o Lit
  // escreve no DOM, que existe com stub ou sem ele, e é sobre ele que o
  // seletor `urbi-kpi[variante=""]` conta. A declaração registra que a cor em
  // si não está sendo vista, o que é verdade e é irrelevante para a #611: o
  // conserto é justamente o atributo sair vazio.
  aceitaNaoReproduzido: [
    // Os `urbi-card` da aba ("Imagem principal", "Produtos", "Resumo") — mesma
    // natureza dos outros casos de `viab-tela-premissas`: o stub não desenha o
    // título.
    'urbi-card.titulo',
    // Rodapé do formulário ("Salvar premissas") e o botão "Adicionar produto"
    // do grid vazio — o stub não pinta variante nem desenha ícone.
    'urbi-botao.variante',
    'urbi-botao.icone',
    // Estado vazio do grid de Produtos (nenhum produto neste fixture).
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    // Ver a nota acima — pintura não medida, atributo sim.
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // ⚠️ O BENCHMARK PRECISA VIR PELA API, e descobrir isso custou uma rodada
    // de mutação verde. `viab-tela-premissas` tem `estudo` como `@property`, e
    // atribuí-lo dispara `_init()`, que refaz o fetch e SOBRESCREVE
    // `this.benchmarks` com `bm?.dados || []`. Passar o array por
    // `forcarEstado` funcionava até o `Promise.all` resolver; depois dele a
    // lista voltava a ficar vazia, `varianteFaixa` não achava medidor e
    // devolvia '' — o caso passava com e sem o conserto, medindo nada.
    //
    // Os outros casos de `viab-tela-premissas` não tropeçam nisso porque
    // declaram `benchmarks: []`, que é o mesmo valor que o fetch devolve.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/benchmarks')) return { dados: BENCHMARKS };
      if (rota.includes('/config')) return { parametros: { aliquota_ret_pct: 4 } };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO_LOT_SEM_GLEBA,
      secao: 'produtos',
      editavel: true,
      benchmarks: BENCHMARKS,
      produtos: [],
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // Um segundo `updateComplete` depois de a microtask do `_init()` drenar:
    // o primeiro assenta o render inicial, e o fetch (mesmo resolvido na hora)
    // só chega ao template no ciclo seguinte.
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
  },
};
