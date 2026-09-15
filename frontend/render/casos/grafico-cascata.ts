// Caso de render standalone: <viab-grafico-cascata> — monta o elemento
// sozinho, com dados de `calcularCascataResultado` sobre um estudo real.
//
// Desde a virada para COLUNAS VERTICAIS, o que este caso guarda é que as
// colunas, os trilhos e as barras chegam à tela, que o rótulo de valor em
// milhões é emitido, e que `idExpandivel` chega ao template (a coluna e o
// rótulo recebem a classe `clicavel`).

import '../../grafico-cascata.js';
import { calcularProforma, type ProformaInput } from '../../proforma.js';
import { calcularCascataResultado } from '../../cascata-resultado-motor.js';
import { forcarEstado } from './dados.js';

const ESTUDO_INCORP: ProformaInput = {
  tipo_empreendimento: 'incorporacao',
  origem_terreno: 'manual',
  terreno_manual_area: 5_000,
  area_pvt_r_fechada: 6_000,
  produtos: [{ area_media_m2: 100, preco_venda_m2: 10_000, unidades: 60 }],
  considerar_custo_terreno: true,
  custo_terreno_m2: 500,
  construcao_modo: 'valor_m2',
  custo_construcao_m2: 3_000,
  imposto_percentual: 7,
  corretagem_percentual: 5,
  marketing_percentual: 1,
  projetos_modo: 'pct_vgv',
  projetos_pct: 2,
  manutencao_pct: 1,
  contingencias_pct: 2,
  marketing_global_pct: 1,
  gestao_indiretos_pct: 1.25,
};

export const caso = {
  nome: 'grafico-cascata',
  exigir: [
    { seletor: 'div.coluna', minimo: 5 },
    { seletor: 'div.trilho', minimo: 5 },
    { seletor: 'div.barra', minimo: 5 },
    // Uma etiqueta de valor por coluna — é o que `fmtR$Milhoes` publica.
    { seletor: 'span.valor', minimo: 5 },
    // A coluna "Custo direto total" é a expansível (idExpandivel) — ela e o
    // rótulo recebem a classe `clicavel`, prova de que a prop chegou ao
    // template.
    { seletor: 'span.rotulo.clicavel', minimo: 1 },
    { seletor: 'div.coluna.clicavel', minimo: 1 },
    // Acessibilidade da coluna expansível: sem estes três, `role`/`tabindex`/
    // `aria-expanded` podem sumir do template e a suíte inteira fica verde —
    // o detalhamento volta a ser alcançável só por mouse, em silêncio.
    { seletor: 'div.coluna[role="button"]', minimo: 1 },
    { seletor: 'div.coluna[tabindex="0"]', minimo: 1 },
    // O VALOR, não só a presença: o caso monta com `expandido: true`, então
    // um `aria-expanded` preso em "false" (prop ignorada, fiação quebrada)
    // reprova aqui. Presença sozinha passaria (achado da rodada 3).
    { seletor: 'div.coluna[aria-expanded="true"]', minimo: 1 },
    // O clamp do `bottom` que mantém o filete de 2px DENTRO do trilho. Sem
    // este seletor, reverter para `bottom: ${e.inicioPct}%` deixa tudo verde e
    // a barra minúscula no topo volta a ser cortada pelo `overflow: hidden`.
    { seletor: 'div.barra[style*="min("]', minimo: 5 },
  ],
  async montar(raiz: HTMLElement): Promise<void> {
    const p = calcularProforma(ESTUDO_INCORP);
    const etapas = calcularCascataResultado(p);
    const el = document.createElement('viab-grafico-cascata');
    forcarEstado(el, { etapas, idExpandivel: 'custo_direto', expandido: true });
    raiz.appendChild(el);
    await (el as any).updateComplete;
  },

  // Comportamento de TECLADO, que nenhum seletor alcança: os três atributos
  // (`role`/`tabindex`/`aria-expanded`) provam marcação, não que Enter e Espaço
  // ativam a coluna. Sem esta sonda, apagar `_tecla` inteiro deixa a suíte
  // verde e o detalhamento volta a ser só de mouse (achado da rodada 3).
  async medir(raiz: HTMLElement): Promise<{
    enter: number; espaco: number; repetido: number; outraTecla: number;
    defaultCancelado: boolean; defaultCanceladoNoRepeat: boolean;
    rotulosDeValor: string[];
  }> {
    const el = raiz.querySelector('viab-grafico-cascata')! as any;
    const alvo = el.shadowRoot!.querySelector('div.coluna.clicavel')! as HTMLElement;
    const contagem = { enter: 0, espaco: 0, repetido: 0, outraTecla: 0 };
    let atual: keyof typeof contagem = 'enter';
    el.addEventListener('viab:cascata-linha-click', () => { contagem[atual] += 1; });

    const teclar = (key: string, repeat = false) => {
      const ev = new KeyboardEvent('keydown', { key, repeat, bubbles: true, composed: true, cancelable: true });
      alvo.dispatchEvent(ev);
      return ev.defaultPrevented;
    };

    atual = 'enter'; teclar('Enter');
    atual = 'espaco'; const cancelado = teclar(' ');
    // O Espaço REPETIDO tem que cancelar o default também: é a diferença entre
    // `preventDefault` antes ou depois da guarda de `ev.repeat`, e sem esta
    // medida a inversão passa despercebida — a página rolaria em rajada.
    atual = 'repetido'; const canceladoNoRepeat = teclar(' ', true);
    atual = 'outraTecla'; teclar('a');
    await el.updateComplete;

    // O TEXTO que cada barra publica, lido do DOM renderizado. É a única
    // medida que distingue `fmtR$Milhoes` de `fmtR$` onde importa — na tela —
    // e ela não depende de onde a chamada mora no fonte.
    const rotulosDeValor = [...el.shadowRoot!.querySelectorAll('span.valor')]
      .map((n: Element) => (n.textContent ?? '').trim());

    return {
      ...contagem,
      defaultCancelado: cancelado,
      defaultCanceladoNoRepeat: canceladoNoRepeat,
      rotulosDeValor,
    };
  },
};
