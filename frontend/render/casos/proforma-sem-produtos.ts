// Caso de render: a Proforma de um estudo SEM catálogo de Produtos efetivo.
//
// Este caso mede FIAÇÃO, não cálculo. `calcularProforma` expor `semProdutos`
// não obriga `tela-proforma.ts` a olhar para ele: apagar o ramo do estado
// vazio do template deixa a suíte de lógica pura inteira verde, porque nenhum
// teste dela monta a tela. O `exigir` de `urbi-estado-vazio` é a prova — sem
// o ramo ligado, o seletor não casa nada e o harness rejeita a montagem em vez
// de reportar "limpo" para uma tela que voltou a desenhar números-fantasma.
//
// O estudo é o mesmo `ESTUDO` dos outros casos, com o catálogo trocado por uma
// LINHA EM BRANCO — o que "Adicionar Produto" grava: só a ordem, as três
// colunas vazias. É o estudo da issue, não um estudo inventado.

import '../../tela-proforma.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTO_EM_BRANCO = [
  { id: 1, nome: '', ordem: 0, area_media_m2: null, preco_venda_m2: null, unidades: 0 },
];

export const caso = {
  nome: 'proforma-sem-produtos',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo".
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    // O seletor é o WRAPPER, e não o `urbi-estado-vazio`: o stub do harness não
    // desenha o miolo do primitivo (`padding: 48px 24px` mora no shadow DOM
    // dele), então o próprio `urbi-estado-vazio` mede 0 de altura aqui e não
    // conta como visível. O wrapper tem padding no CSS do app, existe só quando
    // o ramo do estado vazio renderiza, e é isso que se quer provar.
    { seletor: 'div.pf-vazio', minimo: 1 },
  ],
  // Props que o stub NÃO reproduz e este caso usa mesmo assim — revisadas uma a
  // uma. O harness confronta nos dois sentidos (usada e não declarada → falha;
  // declarada e sem uso → falha), então a lista não envelhece em silêncio.
  aceitaNaoReproduzido: [
    'urbi-card.titulo',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
    'urbi-estado-vazio.submensagem',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` roda no `connectedCallback`, é assíncrono e escreve por cima do
    // estado forçado — aqui a resposta precisa trazer a MESMA linha em branco,
    // senão o caso mediria "sem catálogo" pelo motivo errado (lista vazia da
    // API) em vez do motivo que a issue trata (linha existe e não compõe VGV).
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return { dados: PRODUTO_EM_BRANCO };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-proforma');
    forcarEstado(el, {
      estudo: ESTUDO, secao: 'proforma', benchmarks: [], produtos: PRODUTO_EM_BRANCO, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
