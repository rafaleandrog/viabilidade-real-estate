// Caso de render: o relatório da derivação, no estudo NOVO. Um alerta e dois itens comuns, com textos
// longos de propósito — a lista interpola `origem → destino: regra. nota` dentro de um banner, e é essa
// forma que estoura a caixa quando o texto cresce. O alerta tem de vir primeiro, e o aviso de que o
// relatório não volta depois de fechado tem de estar na tela.

import { ACEITA_NAO_REPRODUZIDO, montarEstudo } from './estudo-derivar-botao.js';

const RELATORIO = [
  { origem: 'Catálogo de produtos', destino: 'Tipologias do Avançado', regra: 'uma tipologia por produto, com a área por unidade em 2 casas' },
  {
    origem: 'Juros de tabela', destino: 'Viabilidade › Financeiro', regra: '0% até preencher',
    nota: 'O Preliminar não tem juros de tabela; sem eles a receita parcelada não é corrigida.', alerta: true,
  },
  { origem: 'Cronograma', destino: 'Cronograma do Avançado', regra: 'cronograma padrão criado', nota: 'Revise o Cronograma: o Preliminar não tem prazos.' },
];

export const caso = {
  nome: 'estudo-derivar-relatorio',
  exigir: [
    { seletor: 'div.relatorio-derivacao', minimo: 1 },
    { seletor: 'div.relatorio-derivacao urbi-banner', minimo: 1 },
    { seletor: 'span.relatorio-alerta', minimo: 1 },
    { seletor: 'ul.relatorio-itens li', minimo: 3 },
  ],
  // O stub não reproduz a variante do banner (cor); o conteúdo é o que se mede.
  aceitaNaoReproduzido: [...ACEITA_NAO_REPRODUZIDO, 'urbi-banner.variante'],
  async montar(raiz: HTMLElement): Promise<void> {
    const el = await montarEstudo(raiz, { relatorioDerivacao: RELATORIO });
    const itens = [...(el.shadowRoot?.querySelectorAll('ul.relatorio-itens li') ?? [])];
    if (!(itens[0]?.textContent ?? '').includes('Alerta')) {
      throw new Error('o alerta deveria vir primeiro na lista do relatório');
    }
    const texto = (el.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ');
    if (!texto.includes('ele não volta à tela')) throw new Error('falta o aviso de que o relatório não volta depois de fechado');
    if (texto.includes('Notas do estudo')) throw new Error('a tela não tem Notas do estudo: a promessa é falsa');
  },
};
