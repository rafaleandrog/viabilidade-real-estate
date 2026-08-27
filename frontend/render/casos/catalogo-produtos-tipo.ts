// Caso de render: #565 — a coluna "Tipo" (Residencial/Não Residencial) do
// catálogo de Produtos, aba "Produtos" (`frontend/tela-premissas.ts:_linhaProduto`).
//
// Este caso mede FIAÇÃO, não cálculo: `ProdutoPreliminar.tipo` já existe no
// tipo e o backend já aceita o campo — nada disso obriga o TEMPLATE a
// desenhar a coluna. Apagar o `<td class="tipo">` do template deixaria a
// suíte de lógica pura inteira verde, porque nenhum teste dela monta a tela;
// o `exigir` abaixo é a única prova de que o `urbi-select` está entre Nome e
// Área média, na tela de verdade.
//
// Duas linhas de propósito: a primeira tem `tipo: 'nao_residencial'`
// EXPLÍCITO (prova que o valor persistido chega ao `.valor` do select); a
// segunda OMITE `tipo` — é a forma exata de um produto LEGADO, gravado antes
// desta migração — e prova o default de leitura (`p.tipo || 'residencial'`)
// sem quebrar a tela.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTOS_TIPO = [
  { id: 1, nome: 'Torre A', ordem: 0, area_media_m2: 62, preco_venda_m2: 11_000, unidades: 80, tipo: 'nao_residencial' },
  // Legado: sem `tipo` — o schema anterior à #565 não tinha a coluna.
  { id: 2, nome: 'Torre B', ordem: 1, area_media_m2: 55, preco_venda_m2: 9_500, unidades: 40 },
];

export const caso = {
  nome: 'catalogo-produtos-tipo',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo". Reproduzido no PR 506.
  exigir: [
    { seletor: 'table.prod', minimo: 1 },
    // 2 linhas de produto + 1 linha de total.
    { seletor: 'table.prod tbody tr', minimo: 3 },
    // A prova central: um `urbi-select` por linha de produto, dentro da célula
    // `td.tipo` — não um `urbi-select` qualquer da tela.
    { seletor: 'table.prod td.tipo urbi-select', minimo: 2 },
    // A coluna tem que estar ENTRE Nome e Área média: o `col.p-tipo` do
    // colgroup é a prova de posição (ordem de `<col>` = ordem das colunas).
    { seletor: 'colgroup col.p-tipo', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. Não é isenção: é o registro do que a medida deste caso NÃO cobre. O
  // harness confronta nos dois sentidos (usada e não declarada → falha; declarada
  // e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    // Binding de PROPRIEDADE (o Lit nem escreve atributo); o stub não desenha
    // opção nenhuma — mesma natureza documentada em modal-pagamento.ts,
    // kpis-resumo.ts e grupo-badge-legado.ts.
    'urbi-select.opcoes',
    'urbi-input.placeholder',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    // Os 3 `urbi-kpi` do `_renderResumo` (KPIs de VGV/margem etc. abaixo do
    // catálogo) ligam `variante` — mesma natureza de `cascata-areas-incorporacao.ts`.
    'urbi-kpi.variante',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e escreve por cima do
    // estado forçado — a resposta precisa trazer as MESMAS duas linhas, senão
    // este caso mediria o catálogo default do stub (`{ dados: [] }`) em vez do
    // que se quer medir. Mesmo padrão de `proforma-sem-produtos.ts`.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTOS_TIPO };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: ESTUDO,
      secao: 'produtos',
      editavel: true,
      benchmarks: [],
      produtos: PRODUTOS_TIPO,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
