// Caso de render: a sub-aba CENÁRIOS de um estudo SEM catálogo de Produtos
// efetivo — a #610.
//
// É o par de `proforma-sem-produtos.ts` (#563), e existe porque a #563 gateou
// só a tabela PRINCIPAL. Com o mesmo estudo, a aba Proforma mostrava o estado
// vazio e a sub-aba Cenários, ao lado, desenhava Bear/Base/Bull inteiros:
// mesma tela, mesmo estudo, duas respostas opostas sobre haver ou não receita
// modelada. E os números da sensibilidade nessa condição vinham da mesma fonte
// que a #563 recusou — os pares legados de área × preço, que não têm campo em
// tela nenhuma —, agora multiplicados por ±10% em três colunas.
//
// ⚠️ Este caso mede FIAÇÃO, não cálculo, e é a ÚNICA camada que o faz. Não há
// teste de lógica pura capaz de reprovar `_renderSensibilidade` por ignorar
// `semProdutos`: o motor já expõe o campo, e nenhum teste da suíte monta a
// tela. Apagar o ramo do estado vazio no template deixa os 800+ testes verdes
// — o que fica vermelho é o `exigir` daqui.
//
// O estudo é o MESMO `ESTUDO` de `proforma-sem-produtos.ts`, com o catálogo
// trocado pela mesma LINHA EM BRANCO que "Adicionar Produto" grava (só a
// ordem, as três colunas vazias). Usar o mesmo par estudo+catálogo é
// deliberado: é o que torna as duas abas comparáveis, e a divergência entre
// elas era exatamente o defeito.

import '../../tela-proforma.js';
import { ESTUDO, forcarEstado } from './dados.js';

const PRODUTO_EM_BRANCO = [
  { id: 1, nome: '', ordem: 0, area_media_m2: null, preco_venda_m2: null, unidades: 0 },
];

export const caso = {
  nome: 'cenarios-sem-produtos',
  // `exigir` é OBRIGATÓRIO em todo caso, e o harness lança sem ele. Motivo: um
  // caso que não renderiza nada — spinner, campo de estado renomeado, seletor
  // que mudou — passa por TODAS as lentes com "limpo".
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    // O seletor é o WRAPPER, e não o `urbi-estado-vazio`: o stub do harness não
    // desenha o miolo do primitivo (`padding: 48px 24px` mora no shadow DOM
    // dele), então o próprio `urbi-estado-vazio` mede 0 de altura aqui e não
    // conta como visível. O wrapper tem padding no CSS do app, existe só quando
    // o ramo do estado vazio renderiza, e é isso que se quer provar. Mesma
    // decisão, pelo mesmo motivo, de `proforma-sem-produtos.ts`.
    { seletor: 'div.pf-vazio', minimo: 1 },
  ],
  // ⚠️ A AUSÊNCIA é a outra metade da prova, e `exigir` só sabe exigir
  // PRESENÇA: um ramo que desenhasse o estado vazio E as tabelas satisfaria o
  // `exigir` acima com os números-fantasma ainda na tela. O harness não tem
  // asserção de ausência — declarar um campo inventado aqui (`seletoresAusentes`
  // e afins) seria pior que não ter nenhuma, porque ele é IGNORADO em silêncio,
  // exatamente como a prop inexistente de primitivo `urbi-*` que o CLAUDE.md
  // descreve.
  //
  // Quem cobre a ausência é o mecanismo que já existe, pelo avesso: a lista
  // abaixo NÃO declara `urbi-select.label`/`urbi-select.opcoes`, que
  // `cenarios-sensibilidade.ts` precisa declarar. Se a sensibilidade voltar a
  // renderizar nesta condição, o `urbi-select` aparece, as duas props entram em
  // uso sem declaração, e o `naoDeclaradas` do teste fica vermelho. Medido — ver
  // o registro no PROGRESSO.
  //
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
      estudo: ESTUDO, secao: 'cenarios', benchmarks: [], produtos: PRODUTO_EM_BRANCO, aliquotaRet: 4,
    });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },
};
