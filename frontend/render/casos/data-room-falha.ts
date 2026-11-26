// Variação com a rota do Apelo falhando: o checklist do Comercial deve sair "não verificado".
// Monta a `viab-tela-avancado` em Empreendimento › Data room com a rota de
// documentos do Empreendimento respondendo e a do Apelo Comercial devolvendo erro.

import '../../tela-avancado.js';
import { ESTUDO } from './dados.js';

const DOCS_EMPREENDIMENTO = [
  { id: 1, categoria: 'imagem_principal', nome_arquivo: 'capa.png', documento: 'd1', url: '/u/1', ordem: 0 },
  { id: 2, categoria: 'planta', nome_arquivo: 'planta-tipo.pdf', documento: 'd2', url: '/u/2', ordem: 1 },
];


export const caso = {
  nome: 'data-room-falha',
  exigir: [
    { seletor: 'viab-data-room', minimo: 1 },
    { seletor: 'urbi-card[data-categoria]', minimo: 6 },
  ],
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-banner.variante',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-card.titulo',
    'urbi-nav.ativo',
    'urbi-nav.secoes',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => {
      if (rota.includes('/empreendimento/documentos')) return { dados: DOCS_EMPREENDIMENTO };
      if (rota.includes('/apelo-comercial')) return { erro: 'falhou' };
      return { dados: [] };
    };
    const el = document.createElement('viab-tela-avancado') as any;
    el.estudo = { ...ESTUDO, id: 1, nivel_analise: 'avancado' };
    el.aba = 'empreendimento';
    el.subAba = 'data-room';
    raiz.appendChild(el);
    await el.updateComplete;
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
      await el.updateComplete;
      const painel = el.shadowRoot?.querySelector('viab-data-room') as any;
      if (painel) await painel.updateComplete;
    }
  },
  /** Roda no navegador: lê o que o data room desenhou. */
  async medir(raiz: HTMLElement): Promise<{
    ativa: boolean; arquivoApelo: string[]; secoes: string[]; nomes: string[]; checklist: string[]; semTipo: string[];
  }> {
    const av = raiz.querySelector('viab-tela-avancado') as any;
    const painel = av?.shadowRoot?.querySelector('viab-data-room') as any;
    const cards = Array.from(painel?.shadowRoot?.querySelectorAll('urbi-card[data-categoria]') ?? []) as HTMLElement[];
    return {
      ativa: painel?.ativa === true,
      arquivoApelo: Array.from(painel?.shadowRoot?.querySelectorAll('.arquivo-apelo') ?? []).map((n: any) => n.textContent.trim()),
      secoes: cards.map((c) => c.getAttribute('data-categoria') || ''),
      nomes: Array.from(painel?.shadowRoot?.querySelectorAll('li.doc .nome') ?? []).map((n: any) => n.textContent.trim()),
      // A marca do item é um `urbi-icone`, não texto: a sonda a traduz pelo
      // ícone de fato desenhado (`fa-check` → "✓ ", `fa-circle` → "○ "), para
      // a asserção continuar provando que o item presente leva a marca certa.
      checklist: Array.from(painel?.shadowRoot?.querySelectorAll('.check li') ?? []).map((n: any) => {
        const classe = n.querySelector('urbi-icone.marca')?.getAttribute('classe') ?? '';
        const marca = classe.includes('fa-check') ? '✓ ' : classe.includes('fa-circle') ? '○ ' : '';
        return marca + n.textContent.trim().replace(/\s+/g, ' ');
      }),
      semTipo: Array.from(painel?.shadowRoot?.querySelectorAll('p.vazio') ?? []).map((n: any) => n.textContent.trim()),
    };
  },
};
