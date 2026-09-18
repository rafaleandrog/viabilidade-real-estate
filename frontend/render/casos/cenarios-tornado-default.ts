// Caso de render: a sub-aba CENÁRIOS escolhe a seleção INICIAL do tornado
// pela maior amplitude do ranking — não mais o literal `'preco'` (Rodada 13,
// issue #729, defeito 2 do handoff §4.6: "o estado inicial é `varSens =
// 'preco'`... por sorte costuma ser a maior alavanca, mas é literal, não
// medido").
//
// O fixture é desenhado para que 'custo_obras' vença o ranking, não 'preco'
// — se o teste usasse um estudo comum, onde preço domina de qualquer forma
// (é o caso do fixture de `cenarios-sensibilidade.ts`), a prova seria
// ambígua: passaria tanto com o comportamento novo (maior amplitude) quanto
// com o antigo (literal 'preco'), por coincidência. Aqui as duas respostas
// DIVERGEM: literal escolheria 'preco', medido escolhe 'custo_obras'.

import '../../tela-proforma.js';
import { forcarEstado } from './dados.js';

const PRODUTOS = [{ id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 100, preco_venda_m2: 10_000, unidades: 100 }]; // vgv = 10.000.000

const ESTUDO_CUSTO_DOMINANTE = {
  id: 900,
  nome: 'Tornado — custo de obra domina',
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 1_000,
  imposto_percentual: 4,
  corretagem_percentual: 4,
  marketing_percentual: 2,
  construcao_modo: 'valor_total',
  // Grande o bastante para a amplitude de ±10% em custo de obra (R$ 30M)
  // superar a de preço (R$ 18M) — medido com `rankearAlavancas` diretamente.
  construcao_valor_total: 150_000_000,
};

export const caso = {
  nome: 'cenarios-tornado-default',
  exigir: [
    { seletor: 'viab-grafico-tornado', minimo: 1 },
    { seletor: 'div.linha', minimo: 5 },
    // A prova: a linha de 'custo_obras' — e só ela — nasce com a classe
    // `ativa`, sem nenhum clique nem seleção manual.
    { seletor: 'div.linha.ativa[data-variavel="custo_obras"]', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-select.label',
    'urbi-select.opcoes',
    // A cor do badge por cenário (Bear/Base/Bull) — mesma declaração de
    // `cenarios-sensibilidade.ts`, que este caso também herda ao montar a
    // tela inteira (a tabela "Análise de sensibilidade" continua abaixo do
    // tornado).
    'urbi-badge.cor',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    // Sem forçar `_varSensManual` — é exatamente a seleção AUTOMÁTICA que
    // este caso prova.
    forcarEstado(el, {
      estudo: ESTUDO_CUSTO_DOMINANTE, secao: 'cenarios', benchmarks: [],
      produtos: PRODUTOS, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
