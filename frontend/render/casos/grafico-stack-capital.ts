// Caso de render: a torre do capital stack (`viab-grafico-stack-capital`)
// isolada, com o pior caso de GEOMETRIA que a aba pode receber: sete camadas
// desenhadas (mais uma de valor zero, que fica fora), uma camada de 0,3% ao
// lado de uma de bilhão, valores de nove dígitos e de bilhões, e nomes longos.
//
// O que ele prova, e o teste de unidade não: que a camada pequena tem a altura
// mínima e escreve numa linha só sem transbordar, que o valor e o % nunca são
// cortados, que a camada de valor zero não é desenhada, que a base é a mais
// sênior e que o texto tem contraste em todas as variantes de tema.

import '../../grafico-stack-capital.js';
import type { CamadaDaTorre } from '../../funding-estrutura-dados.js';
import { corDoTipo } from '../../funding-cores.js';
import { forcarEstado } from './dados.js';
import { medirStack } from './medir-stack.js';

const BRUTAS: Omit<CamadaDaTorre, 'pct' | 'cor'>[] = [
  { id: 1, tipo: 'financiamento_producao', nome: 'Plano empresário do banco', nivel: 'sênior · base', valor: 1_234_500_000 },
  { id: 2, tipo: 'divida', nome: 'Crédito de terreno com um nome muito comprido que precisa truncar', nivel: 'dívida', valor: 123_456_789 },
  { id: 3, tipo: 'divida', nome: 'Capital de giro', nivel: 'dívida', valor: 6_000_000 },
  { id: 4, tipo: 'antecipacao_recebiveis', nome: 'Cessão sem lastro', nivel: 'cessão de recebíveis', valor: 0 },
  { id: 5, tipo: 'antecipacao_recebiveis', nome: 'Cessão de carteira', nivel: 'cessão de recebíveis', valor: 50_000_000 },
  { id: 6, tipo: 'equity', nome: 'Investidor estratégico com nome de fundo bastante longo', nivel: 'participa do resultado', valor: 80_000_000 },
  { id: 7, tipo: 'equity', nome: 'Sócio', nivel: 'recebe sobre a receita', valor: 20_000_000 },
  { id: 'incorporador', tipo: 'incorporador', nome: 'Incorporador', nivel: 'recebe por último', valor: 300_000_000 },
];
const TOTAL = BRUTAS.reduce((s, c) => s + c.valor, 0);
export const CAMADAS: CamadaDaTorre[] = BRUTAS.map((c) => ({ ...c, pct: (c.valor / TOTAL) * 100, cor: corDoTipo(c.tipo) }));

export const caso = {
  nome: 'grafico-stack-capital',
  exigir: [
    { seletor: 'div.torre[role="list"]', minimo: 1 },
    // Sete camadas com valor; a de valor zero NÃO é desenhada.
    { seletor: 'div.camada[role="listitem"]', minimo: 7 },
    { seletor: 'div.camada.uma', minimo: 1 },
    { seletor: 'div.camada.duas', minimo: 1 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = document.createElement('viab-grafico-stack-capital');
    forcarEstado(el, { camadas: CAMADAS });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement) {
    const el = raiz.querySelector('viab-grafico-stack-capital') as any;
    await el.updateComplete;
    return medirStack(el);
  },
};
