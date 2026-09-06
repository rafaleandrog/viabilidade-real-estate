// Caso de render: #683 — abrir o Painel na aba Estudos (a default) não pode
// disparar os requests das OUTRAS 4 abas (Terrenos, Benchmark, Curvas,
// Regiões monitoradas).
//
// Por que isto precisa de MEDIÇÃO, não leitura de fonte: as 5 abas
// compartilham uma ÚNICA instância de `viab-tela-dashboard`, e os 5
// `<urbi-hospedeiro slot="...">` eram montados INCONDICIONALMENTE — slot é
// projeção de light DOM, então o filho existe assim que o componente
// renderiza, independente de qual aba `urbi-abas` mostra por dentro.
// `viabilidade-config-benchmarks`/`-curvas`/`-mercado` chamam `_carregar()`
// no próprio `connectedCallback`, sem guard nenhum — um teste que só lesse o
// fonte e confirmasse "existe uma condição `this.aba === 'x'`" não provaria
// que o componente errado não monta primeiro; só montar de verdade e
// verificar o que a API stub recebeu prova isso. Mesma classe de defeito nº 1
// do CLAUDE.md (a fiação, não o cálculo) do caso irmão
// `funding-fap-checkbox.ts`, de onde este caso copia a técnica de espionar
// `urbiVerso.api`/`urbiVerso.nucleo` e devolver o resultado por `medir()`.

import '../../tela-dashboard.js';
import { forcarEstado } from './dados.js';

export const caso = {
  nome: 'painel-abas-lazy',
  // `urbi-hospedeiro[slot="estudos"]` prova que o SLOT CERTO (o da aba
  // ativa) montou de verdade — sem isso um caso que não renderiza nada
  // reportaria "limpo". Não exige `urbi-tabela`/`urbi-select`: medido
  // (getBoundingClientRect), o conteúdo DENTRO do hospedeiro (filtros +
  // tabela) colapsa para altura 0 neste harness — `viab-tela-dashboard`
  // depende da cadeia de altura flex de produção (`estiloPagina` no shell →
  // `flex:1`/`min-height:0` descendo por `urbi-shell-page` → `urbi-abas` →
  // `urbi-hospedeiro`), que o `<div id="raiz">` do harness não fornece (sem
  // `height:100%` ancorando o topo). O próprio `urbi-hospedeiro` (h=12px) e
  // tudo ACIMA dele (`urbi-shell-page`, `urbi-abas`) tem altura real — só o
  // conteúdo que depende de `flex-grow` para preencher o resto da tela
  // colapsa. Mesma classe de limitação que `estudo-editar-nome.ts` já
  // documentou para telas que envolvem `urbi-shell-page`: este caso mede
  // REDE (`medir()`), não geometria, então a limitação não compromete a
  // prova que ele existe para fazer.
  exigir: [
    { seletor: 'urbi-hospedeiro[slot="estudos"]', minimo: 1 },
  ],
  // Lista MEDIDA (naoDeclaradas/declaracoesOciosas do teste) — não é a mesma
  // conta que #679/#680 fariam para esta tela: o conteúdo dentro do
  // hospedeiro colapsa para altura 0 (ver o comentário de `exigir` acima),
  // então `urbi-select`/`urbi-tabela`/`urbi-hospedeiro.slot`/
  // `urbi-shell-page.dashboard` não chegam a "participar da medição" e não
  // entram nem como reproduzidas nem como não-reproduzidas.
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-abas.expandir',
    'urbi-botao.icone',
    'urbi-botao.pequeno',
    'urbi-botao.variante',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    // Espiona AS DUAS portas que os 5 destinos usam (`urbiVerso.api` para
    // curvas/benchmarks/mercado/estudos, `urbiVerso.nucleo` para terrenos) —
    // e grava cada chamada num array global que `medir()` lê depois. Precisa
    // estar montado ANTES do `appendChild`: `connectedCallback` chama
    // `_carregar()` de forma síncrona no momento da conexão.
    (globalThis as any).__chamadasPainel = [];
    const registrar = (rota: string) => { (globalThis as any).__chamadasPainel.push(rota); return { dados: [] }; };
    (globalThis as any).urbiVerso.api = async (rota: string) => registrar(rota);
    (globalThis as any).urbiVerso.nucleo = async (rota: string) => registrar(rota);

    const el = document.createElement('viab-tela-dashboard');
    forcarEstado(el, { aba: 'estudos' });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    // `_carregar()` (chamada por `connectedCallback`) é assíncrona — espera
    // o ciclo de update seguinte, que ela dispara ao popular `this.estudos`.
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
  },
  // Roda DENTRO do navegador, depois do assentamento — lê o que a fiação de
  // fato mandou para os dois stubs de API.
  async medir(): Promise<{ chamadas: string[] }> {
    return { chamadas: (globalThis as any).__chamadasPainel ?? [] };
  },
};
