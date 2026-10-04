// Caso de render: aba Terrenos do Painel — só lotes do setor Urbitá; glebas, qualquer uma.
//
// Cenário do Núcleo: setores 1 (Sol Nascente) e 2 (Urbitá); parcelamentos 10 (setor 2),
// 20 (setor 1) e 30 (sem setor); três lotes (um por parcelamento, o do Urbitá na 3ª página) e duas glebas. Só o lote do
// parcelamento 10 pode aparecer. O teste existe porque a lógica pura (`terrenos-setor.ts`) estar
// testada não prova que o Painel a chama: apagar a chamada em `_carregarTerrenos` deixa a suíte
// de função pura inteira verde e a tela listando todos os lotes.
//
// `semPermissao: true` reproduz a flag `setores_habitacionais` ainda não concedida (403): o
// Painel tem que esconder TODOS os lotes e avisar, não listar sem filtro.

import '../../tela-dashboard.js';
import { forcarEstado } from './dados.js';

// Lista MEDIDA: o banner (e a prop `variante` dele) só monta no caso sem permissão.
export const aceitaNaoReproduzidoBase = [
  'urbi-abas.abas',
  'urbi-abas.ativa',
  'urbi-abas.expandir',
  'urbi-shell-page.titulo',
];

export type ModoSetor = 'ok' | 'sem-permissao' | 'sem-setor';

export function montarCaso(modo: ModoSetor) {
  return async function montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).urbiVerso.api = async () => ({ dados: [] });
    (globalThis as any).urbiVerso.modulo = async (slug: string, rota: string) => {
      if (slug !== 'imobiliario') throw new Error(`módulo não declarado: ${slug}`);
      const pag = (dados: any[]) => ({ dados, total: dados.length, pagina: 1, por_pagina: 200, paginas: 1 });
      // Servidor que clampeia a página em 1 item (o pedido é 200) — o lote do setor Urbitá fica na
      // 3ª página. Só a paginação de verdade (`paginas` + `pagina`) enxerga os dois; trocar
      // `coletarPaginas` por uma chamada única esconde o lote do Urbitá.
      const emPaginas = (todos: any[]) => {
        const pagina = Number(new URLSearchParams(rota.split('?')[1] ?? '').get('pagina')) || 1;
        return { dados: todos.slice(pagina - 1, pagina), total: todos.length, pagina, por_pagina: 1, paginas: todos.length };
      };
      if (rota.startsWith('/setores-habitacionais')) {
        if (modo === 'sem-permissao') throw new Error('Sem permissão de leitura em setores_habitacionais');
        if (modo === 'sem-setor') return pag([{ id: 1, slug: 'sol-nascente', nome: 'Sol Nascente' }]);
        return pag([{ id: 1, slug: 'sol-nascente', nome: 'Sol Nascente' }, { id: 2, slug: 'urbita', nome: 'Urbitá' }]);
      }
      if (rota.startsWith('/parcelamentos')) {
        return pag([
          { id: 10, setor_habitacional_id: 2 },
          { id: 20, setor_habitacional_id: 1 },
          { id: 30, setor_habitacional_id: null },
        ]);
      }
      if (rota.startsWith('/lotes')) {
        return emPaginas([
          { id: 2, id_legivel: 'LOTE-OUTRO-SETOR', parcelamento_id: 20, area: '300' },
          { id: 3, id_legivel: 'LOTE-SEM-SETOR', parcelamento_id: 30, area: '300' },
          { id: 1, id_legivel: 'LOTE-URBITA', parcelamento_id: 10, area: '300' },
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
  nome: 'painel-terrenos-setor-urbita',
  exigir: [{ seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 }],
  aceitaNaoReproduzido: aceitaNaoReproduzidoBase,
  montar: montarCaso('ok'),
  medir: medirCaso,
};
