// Caso de render: #683 (achado do Codex, rodada 2) — abrir o Painel DIRETO
// numa aba que não é Estudos (aqui, Terrenos, via deep link) não pode buscar
// dados de Estudos.
//
// O gate dos 5 `<urbi-hospedeiro slot="...">` (ver `painel-abas-lazy.ts`)
// resolve o slot errado montando, mas `connectedCallback()` de
// `ViabTelaDashboard` chamava `_carregar()` (Estudos) INCONDICIONALMENTE,
// fora do controle dos slots — um usuário chegando direto em `/terrenos`
// (ex.: recarregando a página, ou um link direto) ainda disparava
// `listarEstudos()` e, em cascata, `_calcularAvancados()` (uma chamada extra
// por estudo Avançado) para uma tabela que nunca aparece na tela. Este caso
// prova que ISSO também parou, reusando a mesma técnica de espionar
// `urbiVerso.api`/`urbiVerso.nucleo` de `painel-abas-lazy.ts`.

import '../../tela-dashboard.js';
import { forcarEstado } from './dados.js';

export const caso = {
  nome: 'painel-abas-lazy-terrenos',
  exigir: [
    { seletor: 'urbi-hospedeiro[slot="terrenos"]', minimo: 1 },
  ],
  // Lista MEDIDA — diferente da de `painel-abas-lazy.ts`: nesta aba o slot
  // `actions` (Arquivar/Criar estudo) não monta (só aparece com
  // `aba === 'estudos'`), então os `urbi-botao.*` daquele slot não entram
  // aqui.
  aceitaNaoReproduzido: [
    'urbi-abas.abas',
    'urbi-abas.ativa',
    'urbi-abas.expandir',
    'urbi-shell-page.titulo',
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    (globalThis as any).__chamadasPainel = [];
    const registrar = (rota: string) => { (globalThis as any).__chamadasPainel.push(rota); return { dados: [] }; };
    (globalThis as any).urbiVerso.api = async (rota: string) => registrar(rota);
    (globalThis as any).urbiVerso.nucleo = async (rota: string) => registrar(rota);

    const el = document.createElement('viab-tela-dashboard');
    // Simula chegar direto na aba Terrenos (deep link) — não é 'estudos' desde
    // ANTES de conectar, então connectedCallback() já vê `this.aba ===
    // 'terrenos'` no primeiro `_pintar`/render.
    forcarEstado(el, { aba: 'terrenos' });
    raiz.appendChild(el);
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await (el as any).updateComplete;
  },
  async medir(): Promise<{ chamadas: string[] }> {
    return { chamadas: (globalThis as any).__chamadasPainel ?? [] };
  },
};
