// Caso de render: o banner de PREÇO SUGERIDO do card "Resumo" de Premissas →
// Produtos com o catálogo carregado e VAZIO e o benchmark `resultado_final`
// cadastrado. Mede FIAÇÃO: `_renderResumo` em `tela-premissas.ts` tem de passar
// `catalogoCarregado` e `semProdutos` a `textoPrecoSugerido`. A função pura é
// testada à parte (`sem-produtos.test.ts`), mas voltar o ternário "inatingível"
// inline, ou fixar `semProdutos: false`, deixa a suíte de lógica pura verde;
// o que fica vermelho é a asserção do texto do banner no teste.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const BENCHMARKS = [
  { id: 1, campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar' },
];

export const caso = {
  nome: 'premissas-preco-sugerido-sem-produtos',
  exigir: [
    { seletor: 'urbi-card', minimo: 1 },
    { seletor: 'div.kpis', minimo: 1 },
  ],
  aceitaNaoReproduzido: [
    'urbi-botao.icone',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-kpi.variante',
    'urbi-banner.variante',
    'urbi-estado-vazio.icone',
    'urbi-estado-vazio.mensagem',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // `_init()` sobrescreve o estado forçado com o que a "API" devolver: o
    // benchmark e o catálogo vazio têm de vir por aqui.
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.startsWith('/benchmarks')) return { dados: BENCHMARKS };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao' },
      secao: 'produtos',
      editavel: true,
      aliquotaRet: 4,
    });
    raiz.appendChild(el);
    // Espera a carga assentar (`_catalogoCarregado` vira `true` no fim de `_init`).
    await new Promise((r) => setTimeout(r, 50));
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ banners: string[] }> {
    const sr = (raiz.querySelector('viab-tela-premissas') as any).shadowRoot!;
    const texto = (n: Element) => (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { banners: [...sr.querySelectorAll('urbi-banner')].map(texto) };
  },
};
