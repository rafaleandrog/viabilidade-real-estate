// Sonda de medida da torre do capital stack (`viab-grafico-stack-capital`),
// compartilhada pelos casos `grafico-stack-capital` e `funding-estrutura`.
//
// Mede, no DOM real e em cada variante de tema do harness: a geometria de cada
// camada (altura, texto dentro dela, valor e % nunca cortados), a posição
// vertical (a base é a mais sênior) e o CONTRASTE do texto sobre o
// preenchimento da camada (WCAG, com a cor do texto composta sobre o fundo).
// A torre não pode passar da largura do documento.

type Rgba = { r: number; g: number; b: number; a: number };

/** Lê `rgb()`, `rgba()` e `color(srgb …)` — a forma que o Chromium devolve para `color-mix`. */
function cor(s: string): Rgba | null {
  let m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  m = /color\(srgb\s+([^)]+)\)/.exec(s);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 };
  }
  return null;
}

function luminancia(c: Rgba): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
}

/** Razão de contraste WCAG do texto (composto sobre o fundo) contra o fundo. */
function contraste(texto: Rgba, fundo: Rgba): number {
  const a = texto.a;
  const comp = { r: texto.r * a + fundo.r * (1 - a), g: texto.g * a + fundo.g * (1 - a), b: texto.b * a + fundo.b * (1 - a), a: 1 };
  const l1 = luminancia(comp);
  const l2 = luminancia(fundo);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export interface MedidaCamada {
  id: string;
  tipo: string;
  altura: number;
  topo: number;
  linhas: 'uma' | 'duas';
  /** Texto escrito na camada, normalizado. */
  texto: string;
  pct: string;
  rotuloAcessivel: string;
  /** Peças de texto que saem da camada (borda) ou estão cortadas (valor e %). */
  fora: string[];
}

export interface MedidaStack {
  larguraDocumento: number;
  torreDireita: number;
  torreScroll: number;
  torreClient: number;
  camadas: MedidaCamada[];
  /** Menor contraste de texto por variante de tema. */
  contrastePorTema: Record<string, number>;
  vazio: string | null;
  /** Rótulos do eixo lateral, de cima para baixo, e se o eixo está fora da árvore acessível. */
  eixo: { textos: { texto: string; topo: number }[]; ocultoDoLeitor: boolean } | null;
}

export async function medirStack(grafico: HTMLElement & { shadowRoot: ShadowRoot }): Promise<MedidaStack> {
  const sr = grafico.shadowRoot;
  const torre = sr.querySelector('div.torre') as HTMLElement | null;
  const camadasEl = [...sr.querySelectorAll('div.camada')] as HTMLElement[];
  const medirCamadas = (): MedidaCamada[] => camadasEl.map((c) => {
    const caixa = c.getBoundingClientRect();
    const fora: string[] = [];
    for (const p of [...c.querySelectorAll('.nome, .nivel, .sep, .valor, .pct')] as HTMLElement[]) {
      const r = p.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > caixa.right + 0.5 || r.left < caixa.left - 0.5 || r.top < caixa.top - 0.5 || r.bottom > caixa.bottom + 0.5) {
        fora.push(`${p.className} fora da camada`);
      }
      if ((p.classList.contains('valor') || p.classList.contains('pct')) && p.scrollWidth > p.clientWidth + 1) {
        fora.push(`${p.className} cortado`);
      }
    }
    for (const l of [...c.querySelectorAll('.linha-texto')] as HTMLElement[]) {
      if (l.scrollWidth > l.clientWidth + 1) fora.push('linha de texto transbordou');
    }
    return {
      id: c.dataset.id ?? '',
      tipo: c.dataset.tipo ?? '',
      altura: caixa.height,
      topo: caixa.top,
      linhas: c.classList.contains('duas') ? 'duas' : 'uma',
      texto: (c.textContent ?? '').replace(/\s+/g, ' ').trim(),
      pct: (c.querySelector('.pct')?.textContent ?? '').trim(),
      rotuloAcessivel: c.getAttribute('aria-label') ?? '',
      fora,
    };
  });

  const contrastePorTema: Record<string, number> = {};
  for (const v of ['0', '1', '2', '3']) {
    document.documentElement.dataset.variante = v;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    let menor = Number.POSITIVE_INFINITY;
    for (const c of camadasEl) {
      const fundo = cor(getComputedStyle(c).backgroundColor);
      if (!fundo) { menor = 0; continue; }
      for (const p of [...c.querySelectorAll('.nome, .nivel, .valor, .pct')] as HTMLElement[]) {
        const t = cor(getComputedStyle(p).color);
        if (!t) { menor = 0; continue; }
        menor = Math.min(menor, contraste(t, fundo));
      }
    }
    contrastePorTema[v] = menor;
  }
  document.documentElement.dataset.variante = '0';
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  return {
    larguraDocumento: document.documentElement.clientWidth,
    torreDireita: torre ? torre.getBoundingClientRect().right : 0,
    torreScroll: torre?.scrollWidth ?? 0,
    torreClient: torre?.clientWidth ?? 0,
    camadas: medirCamadas(),
    contrastePorTema,
    vazio: sr.querySelector('p.vazio')?.textContent?.trim() ?? null,
    eixo: (() => {
      const e = sr.querySelector('div.eixo') as HTMLElement | null;
      if (!e) return null;
      const textos = ([...e.children] as HTMLElement[])
        .filter((x) => (x.textContent ?? '').trim() !== '')
        .map((x) => ({ texto: (x.textContent ?? '').trim(), topo: x.getBoundingClientRect().top }));
      return { textos, ocultoDoLeitor: e.getAttribute('aria-hidden') === 'true' };
    })(),
  };
}
