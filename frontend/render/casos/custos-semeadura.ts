// Caso de render: #802 — a semeadura das linhas obrigatórias (Preço/terreno,
// Construção/obra, Corretagem de vendas/diretos) acontece UMA vez por estudo,
// mesmo com duas instâncias da tela carregando o mesmo estudo ao mesmo tempo
// (remontagem do componente, dupla navegação), e remontar depois não cria nada.
//
// A guarda `carregado` de `updated()` só protege UMA instância; o que protege
// duas é o single-flight por estudo em `_garantirLinhasObrigatorias`. Teste de
// função pura não alcança isso — é fiação do componente (classe de defeito
// nº 1 do CLAUDE.md) —, então o caso monta as instâncias de verdade, com
// `estudo.id` presente, e deixa `updated()` → `_carregar()` correr.
//
// O servidor falso abaixo é DELIBERADAMENTE não idempotente (cria sempre) e
// segura o POST alguns milissegundos: é o pior caso — uma réplica do backend
// que não vê a fila da outra. Se a tela semear duas vezes, ele grava duas.

import '../../tela-fluxo-custos.js';
import { forcarEstado } from './dados.js';

const ESTUDO_ID = 802;

export interface MedidaSemeadura {
  /** Linhas por `grupo::categoria` no servidor falso, depois de as duas instâncias assentarem. */
  porCategoria: Record<string, number>;
  /** POSTs recebidos até aí. */
  posts: number;
  /** Os mesmos dois números depois de REMONTAR a tela (uma 3ª instância). */
  porCategoriaRemontado: Record<string, number>;
  postsRemontado: number;
  /**
   * Uma 4ª instância cuja carga inicial veio VELHA (a lista de antes da
   * semeadura — a aba que abriu antes de a outra semear). Ela reconsulta o
   * servidor antes de criar, então não cria nada.
   */
  porCategoriaListaVelha: Record<string, number>;
  postsListaVelha: number;
  /** POSTs que NÃO se declararam semeadura (`semeadura: true`) — tem de ser 0. */
  postsSemMarca: number;
  /** A lista que cada instância mostra — as duas têm de ver as 3 linhas, sem repetir. */
  custosPorInstancia: number[];
}

// Estado do servidor falso — no módulo, porque `montar` e `medir` rodam na
// mesma página.
const linhas: any[] = [];
let posts = 0;
let postsSemMarca = 0;
let proximoId = 1;
// Quando ligado, o PRÓXIMO GET de custos devolve a lista vazia de antes da
// semeadura — e só ele.
let proximoGetVelho = false;

function contar(): Record<string, number> {
  const c: Record<string, number> = {};
  for (const l of linhas) {
    const k = `${l.grupo}::${l.categoria}`;
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
}

function novaTela(): HTMLElement {
  const el = document.createElement('viab-fluxo-custos');
  forcarEstado(el, {
    estudo: { id: ESTUDO_ID, nivel_analise: 'avancado', tipo_empreendimento: 'incorporacao' },
    editavel: true,
    grupo: 'terreno',
  });
  return el;
}

// Espera as instâncias terminarem a carga: cada uma tem de ver as 3 linhas.
async function assentar(telas: any[]): Promise<void> {
  const limite = Date.now() + 5000;
  while (Date.now() < limite) {
    if (telas.every((t) => (t.custos?.length ?? 0) >= 3)) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  // Uma folga para um POST atrasado de uma semeadura duplicada aparecer.
  await new Promise((r) => setTimeout(r, 150));
  await Promise.all(telas.map((t) => t.updateComplete));
}

export const caso = {
  nome: 'custos-semeadura',
  // A prova de que a tela montou; as duas instâncias são contadas por
  // `medir()` (`custosPorInstancia`) — o `exigir` só conta o que está VISÍVEL,
  // e a 2ª instância fica abaixo da dobra.
  exigir: [
    { seletor: 'viab-fluxo-custos', minimo: 1 },
  ],
  // Props da tela que o stub do espelho não reproduz (o mesmo conjunto que
  // `custos-permuta-fisica` declara, menos o `urbi-select` de permuta, que
  // aqui não aparece; `urbi-tabela.*` é o limite documentado lá).
  aceitaNaoReproduzido: [
    'urbi-botao.desabilitado',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-tabela.colunas',
    'urbi-tabela.linhas',
    'urbi-tabela.mensagemVazio',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Estudo montado por API SEM nenhuma obrigatória — o caso da issue.
    (globalThis as any).urbiVerso.api = async (rota: string, opts: { method?: string; body?: string } = {}) => {
      if (rota === `/estudos/${ESTUDO_ID}/avancado/custos`) {
        if ((opts.method ?? 'GET') === 'POST') {
          posts++;
          if (JSON.parse(opts.body || '{}').semeadura !== true) postsSemMarca++;
          await new Promise((r) => setTimeout(r, 40));
          const linha = { id: proximoId++, estudo_id: ESTUDO_ID, subcategoria: null, ...JSON.parse(opts.body || '{}') };
          linhas.push(linha);
          return { ...linha };
        }
        if (proximoGetVelho) { proximoGetVelho = false; return { dados: [] }; }
        return { dados: linhas.map((l) => ({ ...l })) };
      }
      return { dados: [] };
    };
    const a = novaTela();
    const b = novaTela();
    raiz.appendChild(a);
    raiz.appendChild(b);
    await Promise.all([(a as any).updateComplete, (b as any).updateComplete]);
    await assentar([a, b]);
  },
  async medir(raiz: HTMLElement): Promise<MedidaSemeadura> {
    const telas = [...raiz.querySelectorAll('viab-fluxo-custos')] as any[];
    const porCategoria = contar();
    const postsAntes = posts;
    const custosPorInstancia = telas.map((t) => t.custos.length);

    // Remontar: tira as duas e põe uma nova — ela carrega o estudo já semeado.
    for (const t of telas) t.remove();
    const c = novaTela();
    raiz.appendChild(c);
    await (c as any).updateComplete;
    await assentar([c]);

    const porCategoriaRemontado = contar();
    const postsRemontado = posts;

    // Lista velha: a carga inicial não vê as 3 linhas que já existem.
    c.remove();
    proximoGetVelho = true;
    const d = novaTela();
    raiz.appendChild(d);
    await (d as any).updateComplete;
    await assentar([d]);

    return {
      porCategoria,
      posts: postsAntes,
      porCategoriaRemontado,
      postsRemontado,
      porCategoriaListaVelha: contar(),
      postsListaVelha: posts,
      postsSemMarca,
      custosPorInstancia,
    };
  },
};
