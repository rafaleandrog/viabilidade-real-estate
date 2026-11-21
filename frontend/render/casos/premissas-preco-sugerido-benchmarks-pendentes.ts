// Caso de render: o banner de PREÇO SUGERIDO com o catálogo LIDO e vazio
// enquanto benchmarks/config ainda não responderam (pendentes, ou falhando).
// O benchmark `resultado_final` já está na tela (estudo anterior na mesma
// instância da tela: `_init` não zera `benchmarks`). O gate do texto é o
// catálogo lido (`_produtosLidos`), não o `Promise.all` inteiro de `_init`
// (`_catalogoCarregado`): com este preso, o banner dizia "inatingível" por
// falta de produtos.

import '../../tela-premissas.js';
import { ESTUDO, forcarEstado } from './dados.js';

const BENCHMARKS = [
  { id: 1, campo: 'resultado_final', valor: 25, regra_comparacao: 'atingir_ou_superar' },
];

export const caso = {
  nome: 'premissas-preco-sugerido-benchmarks-pendentes',
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
    // Benchmarks e config nunca respondem (o `Promise.all` de `_init` fica
    // preso, como numa falha); o catálogo responde vazio.
    (globalThis as any).urbiVerso.api = (rota: string) => {
      if (rota.includes('/preliminar/produtos')) return Promise.resolve({ dados: [] });
      return new Promise(() => {});
    };
    const el = document.createElement('viab-tela-premissas');
    forcarEstado(el, {
      estudo: { ...ESTUDO, tipo_empreendimento: 'incorporacao' },
      secao: 'produtos',
      editavel: true,
      aliquotaRet: 4,
      benchmarks: BENCHMARKS,
    });
    raiz.appendChild(el);
    // Espera o catálogo assentar (`_produtosLidos`); `_catalogoCarregado` nunca vira `true` aqui.
    await new Promise((r) => setTimeout(r, 50));
    await (el as any).updateComplete;
  },
  async medir(raiz: HTMLElement): Promise<{ banners: string[] }> {
    const sr = (raiz.querySelector('viab-tela-premissas') as any).shadowRoot!;
    const texto = (n: Element) => (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    return { banners: [...sr.querySelectorAll('urbi-banner')].map(texto) };
  },
};
