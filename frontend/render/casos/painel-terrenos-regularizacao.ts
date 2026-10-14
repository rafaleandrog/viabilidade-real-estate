// Caso de render: aba Terrenos do Painel — lote só se NÃO for de regularização fundiária; glebas, qualquer uma.
//
// Cenário do Núcleo: parcelamentos 10 (regularizacao=true), 20 (false, com setor habitacional) e 30
// (sem setor); lotes um por parcelamento (o de regularização na 1ª página, o sem parcelamento na 4ª)
// e duas glebas. Só o lote do parcelamento 10 fica de fora. O teste existe porque a lógica pura
// (`terrenos-nucleo.ts`) estar testada não prova que o Painel a chama: apagar a chamada em
// `_carregarTerrenos` deixa a suíte de função pura inteira verde e a tela listando todos os lotes.
//
// `sem-permissao` reproduz a flag de `parcelamentos` não concedida (403): o Painel tem que esconder
// TODOS os lotes e avisar, não listar sem filtro.

import '../../tela-dashboard.js';
import { forcarEstado } from './dados.js';

// Lista MEDIDA: o banner (e a prop `variante` dele) só monta no caso sem permissão.
export const aceitaNaoReproduzidoBase = [
  'urbi-abas.abas',
  'urbi-abas.ativa',
  'urbi-abas.expandir',
  'urbi-shell-page.titulo',
];

export type ModoParcelamentos = 'ok' | 'sem-permissao';

export function montarCaso(modo: ModoParcelamentos, complementos: any[] = []) {
  return async function montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async (rota: string) => (
      String(rota).startsWith('/terrenos-complemento') ? { dados: complementos, total: complementos.length } : { dados: [] }
    );
    (globalThis as any).urbiVerso.modulo = async (slug: string, rota: string) => {
      if (slug !== 'imobiliario') throw new Error(`módulo não declarado: ${slug}`);
      const pag = (dados: any[]) => ({ dados, total: dados.length, pagina: 1, por_pagina: 200, paginas: 1 });
      // Servidor que clampeia a página em 1 item (o pedido é 200). Só a paginação de verdade
      // (`paginas` + `pagina`) enxerga todos; trocar `coletarPaginas` por uma chamada única esconde lotes.
      const emPaginas = (todos: any[]) => {
        const pagina = Number(new URLSearchParams(rota.split('?')[1] ?? '').get('pagina')) || 1;
        return { dados: todos.slice(pagina - 1, pagina), total: todos.length, pagina, por_pagina: 1, paginas: todos.length };
      };
      if (rota.startsWith('/parcelamentos')) {
        if (modo === 'sem-permissao') throw new Error('Sem permissão de leitura em parcelamentos');
        return pag([
          { id: 10, regularizacao: true, setor_habitacional_id: null },
          { id: 20, regularizacao: false, setor_habitacional_id: 1 },
          { id: 30, regularizacao: false, setor_habitacional_id: null },
        ]);
      }
      if (rota.startsWith('/lotes')) {
        return emPaginas([
          { id: 1, id_legivel: 'LOTE-REGULARIZACAO', parcelamento_id: 10, area: '300' },
          { id: 2, id_legivel: 'LOTE-COM-SETOR', parcelamento_id: 20, area: '300' },
          { id: 3, id_legivel: 'LOTE-NORMAL', parcelamento_id: 30, area: '300' },
          { id: 4, id_legivel: 'LOTE-SEM-PARCELAMENTO', parcelamento_id: null, area: '300' },
        ]);
      }
      if (rota.startsWith('/glebas')) {
        return pag([
          { id: 7, id_legivel: 'GLEBA-A', area: '1000' },
          { id: 8, id_legivel: 'GLEBA-B', area: '2000' },
        ]);
      }
      return pag([]);
    };

    const el = document.createElement('viab-tela-dashboard');
    forcarEstado(el, { aba: 'terrenos' });
    raiz.appendChild(el);
    for (let i = 0; i < 4; i++) {
      await (el as any).updateComplete;
      await new Promise((r) => setTimeout(r, 0));
    }
  };
}

export async function medirCaso(raiz: HTMLElement): Promise<{ linhas: string[]; aviso: string; carregada: boolean }> {
  const el = raiz.querySelector('viab-tela-dashboard') as any;
  const tabela = el.shadowRoot!.querySelector('urbi-tabela') as any;
  const banner = el.shadowRoot!.querySelector('urbi-banner');
  return {
    linhas: ((tabela?.linhas ?? []) as any[]).map((l) => l.id_legivel),
    aviso: banner?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    // Falha transitória NÃO pode marcar a aba como carregada: voltar a ela tem que tentar de novo.
    carregada: !!el.terrenosCarregados,
  };
}

export const caso = {
  nome: 'painel-terrenos-regularizacao',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: aceitaNaoReproduzidoBase,
  montar: montarCaso('ok'),
  medir: medirCaso,
};
