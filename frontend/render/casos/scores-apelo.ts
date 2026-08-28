// Caso de render: os scores do Apelo Comercial (`.scores`, `frontend/tela-apelo.ts:132-135`)
// com um valor de 9 DÍGITOS (#579 — "o VALOR salta para fora do quadro do
// KPI") e um negativo. `viab-tela-apelo` é compartilhada entre Preliminar
// (`frontend/tela-preliminar.ts:141`) e Avançado
// (`frontend/tela-avancado.ts:238`) — um caso só cobre os dois.
//
// Os scores reais deste card são curtos (nota 0-5) — a issue pede a
// verificação "em todos os lugares" mesmo assim (critério 6: "nenhuma delas
// ramifica por padrão"), e o ROTULO de cada card é o NOME do fator
// (`"Segurança jurídica"`, 19 caracteres) — mais realista de estourar a
// caixa de 170px original que o próprio score. Este caso estressa os dois:
// um `valor` de 9 dígitos no primeiro card e os 6 nomes de fator reais do
// backend (`ROTULO_EIXO` de `tela-analise-mercado.ts`) nos demais.

import '../../tela-apelo.js';
import { forcarEstado } from './dados.js';

const FATORES = [
  // Critério 1 da #579: "um valor negativo entre parênteses". A notação
  // contábil real do app (`celula`, `viab-format.ts`) só aparece em células
  // de tabela — os cards usam `fmtR$` (sinal de menos) —, mas este campo é
  // passthrough (string exibida como veio), então dá para exercer aqui a
  // forma entre parênteses, que é 1 caractere MAIS LARGA que a de menos.
  { nome: 'Localização', nota_consolidada: '(R$ 12.345.678,90)' },
  { nome: 'Infraestrutura', nota_consolidada: 4.2 },
  { nome: 'Vetor de crescimento', nota_consolidada: 3.8 },
  { nome: 'Concorrência', nota_consolidada: 2.5 },
  { nome: 'Demanda', nota_consolidada: 4.9 },
  { nome: 'Segurança jurídica', nota_consolidada: 3.1 },
];

export const caso = {
  nome: 'scores-apelo',
  exigir: [
    { seletor: 'div.scores', minimo: 1 },
    { seletor: 'urbi-kpi', minimo: 7 },
  ],
  aceitaNaoReproduzido: [
    'urbi-badge.cor',
    'urbi-card.titulo',
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `render()` retorna `nothing` sem `estudo` truthy (`frontend/tela-apelo.ts:145`),
    // e `connectedCallback`/`updated` disparam `_carregar()` de verdade sempre
    // que `estudo` está presente — ao contrário do padrão `forcarEstado` +
    // `estudo: null` de `kpis-resumo.ts`. Mesmo mecanismo de
    // `medidores-graficos.ts`: mocka a rota e deixa o carregamento real correr.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/apelo-comercial')) {
        return {
          apelo: {
            // #579: exemplo literal da issue, no primeiro card.
            score_geral: 'R$ 171.448.400,00',
            resultado: { fatores: FATORES },
          },
          documentos: [],
        };
      }
      return {};
    };
    const el = document.createElement('viab-tela-apelo');
    forcarEstado(el, { estudo: { id: 1 } });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // Segunda volta do microtask loop: `_carregar()` é assíncrono
    // (`await buscarApelo(...)`), então o primeiro `updateComplete` resolve
    // ainda em `carregando`. Sem isto, o caso mediria o `urbi-loading`, não
    // os cards de score — e o `exigir` abaixo rejeitaria a montagem, que é
    // exatamente por que ele existe (ver o comentário em `kpis-resumo.ts`).
    await (el as any).updateComplete;
  },
};
