// Dossiê do projeto — o PDF que apresenta o estudo a quem vai investir.
//
// Este módulo é PURO na parte de montagem do HTML: recebe um `DadosDossie` (seções com textos JÁ
// formatados, pelos mesmos formatadores e a partir dos mesmos objetos calculados que as telas usam)
// e devolve o documento. Quem produz os dados são os montadores de `dossie-montar.ts`; quem abre a
// janela de impressão é `exportarDossiePDF`, abaixo.
//
// Contratos que o documento herda das outras exportações (`frontend/exportar.ts`):
//   · todo texto vindo de dado passa por `escaparHtml`;
//   · só token de cor (`var(--cor-*)`), com o tema claro da página (`cssTemaClaro`) embutido e
//     `data-theme="light"` no `<html>` — a janela de impressão não herda as variáveis do shell;
//   · borda escrita como `border: 1px solid` + `border-color: var(--cor-*)` à parte.
//
// Seção sem dado NÃO é emitida — nem o título. A decisão mora aqui (`secaoTemConteudo`), e não nos
// montadores, para valer igual no Preliminar e no Avançado.
import { cssTemaClaro, rotuloTipo, rotuloStatus } from './exportar.js';
import { escaparHtml } from './viab-format.js';

/** Um indicador: rótulo e valor, o valor já formatado como a tela o publica. */
export interface DossieKpi { rotulo: string; valor: string; }

/** Uma tabela de texto: a primeira coluna é o rótulo da linha; as demais são alinhadas à direita. */
export interface DossieTabela {
  titulo?: string;
  colunas: string[];
  linhas: string[][];
  nota?: string;
}

/** Uma lista de itens de texto (vantagens, riscos…). */
export interface DossieLista { titulo: string; itens: string[]; }

export interface DossieSecao {
  /** Identificador estável da seção (vira classe do bloco; não é texto de dado). */
  id: string;
  titulo: string;
  kpis?: DossieKpi[];
  tabelas?: DossieTabela[];
  paragrafos?: string[];
  listas?: DossieLista[];
}

export interface DadosDossie {
  /** Nome do estudo, como a tela o exibe (`nome_exibicao || nome`). */
  nome: string;
  /** Valor interno de `tipo_empreendimento` — sai com o rótulo da tela. */
  tipo: unknown;
  /** Valor interno de `status` — sai com o rótulo da tela. */
  status: unknown;
  nivel: 'Preliminar' | 'Avançado';
  secoes: DossieSecao[];
}

const tabelaTemLinhas = (t: DossieTabela): boolean => t.colunas.length > 0 && t.linhas.length > 0;

/** A seção tem algo a mostrar: um indicador, uma tabela com linhas, um parágrafo ou uma lista com itens. */
export function secaoTemConteudo(s: DossieSecao): boolean {
  return (s.kpis ?? []).length > 0
    || (s.tabelas ?? []).some(tabelaTemLinhas)
    || (s.paragrafos ?? []).some((p) => p.trim() !== '')
    || (s.listas ?? []).some((l) => l.itens.some((i) => i.trim() !== ''));
}

function htmlTabela(t: DossieTabela): string {
  const cab = t.colunas.map((c, i) => `<th class="${i === 0 ? 'r' : 'v'}">${escaparHtml(c)}</th>`).join('');
  const corpo = t.linhas.map((l) =>
    `<tr>${l.map((c, i) => `<td class="${i === 0 ? 'r' : 'v'}">${escaparHtml(c)}</td>`).join('')}</tr>`).join('');
  return `${t.titulo ? `<h3>${escaparHtml(t.titulo)}</h3>` : ''}
      <table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table>
      ${t.nota ? `<p class="nota">${escaparHtml(t.nota)}</p>` : ''}`;
}

function htmlSecao(s: DossieSecao): string {
  const kpis = (s.kpis ?? []).length > 0
    ? `<div class="kpis">${(s.kpis ?? []).map((k) =>
      `<div class="kpi"><div class="r">${escaparHtml(k.rotulo)}</div><div class="v">${escaparHtml(k.valor)}</div></div>`).join('')}</div>`
    : '';
  const tabelas = (s.tabelas ?? []).filter(tabelaTemLinhas).map(htmlTabela).join('');
  const paragrafos = (s.paragrafos ?? []).filter((p) => p.trim() !== '')
    .map((p) => `<p>${escaparHtml(p)}</p>`).join('');
  const listas = (s.listas ?? []).filter((l) => l.itens.some((i) => i.trim() !== '')).map((l) =>
    `<h3>${escaparHtml(l.titulo)}</h3><ul>${l.itens.filter((i) => i.trim() !== '')
      .map((i) => `<li>${escaparHtml(i)}</li>`).join('')}</ul>`).join('');
  // `s.id` é constante do código, mas passa pelo escape do mesmo jeito: a regra é "todo ponto de
  // interpolação", sem exceção por origem.
  return `<section class="secao s-${escaparHtml(s.id)}"><h2>${escaparHtml(s.titulo)}</h2>${kpis}${tabelas}${paragrafos}${listas}</section>`;
}

/**
 * O documento HTML do dossiê — separado de `exportarDossiePDF` pelo mesmo motivo de `htmlProforma`:
 * `window.open`/`print` não existem fora do navegador, e sem esta separação nenhum teste afirmaria o
 * que sai no arquivo.
 */
export function htmlDossie(dados: DadosDossie, temaCss = ''): string {
  const secoes = dados.secoes.filter(secaoTemConteudo).map(htmlSecao).join('');
  const titulo = escaparHtml(dados.nome);
  return `<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><title>${titulo} — Dossiê do projeto</title>
  <style>${temaCss}</style>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    body { font-family: 'Inter', system-ui, sans-serif; color: var(--cor-texto-forte); margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    h2 { font-size: 14px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid; border-bottom-color: var(--cor-borda-forte); }
    h3 { font-size: 11px; margin: 12px 0 4px; color: var(--cor-texto-sec); text-transform: uppercase; }
    p { font-size: 12px; margin: 6px 0; color: var(--cor-texto); }
    p.nota { font-size: 10px; font-style: italic; color: var(--cor-texto-sec); }
    .sub-h { color: var(--cor-texto-sec); font-size: 12px; margin-bottom: 4px; }
    .kpis { display: flex; gap: 10px; flex-wrap: wrap; margin: 6px 0 10px; }
    .kpi { border: 1px solid; border-color: var(--cor-borda); border-radius: 8px; padding: 8px 12px; }
    .kpi .r { font-size: 10px; color: var(--cor-texto-sec); text-transform: uppercase; } .kpi .v { font-size: 14px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 6px; }
    th { color: var(--cor-texto-sec); font-weight: 700; padding: 4px 8px; border-bottom: 1px solid; border-bottom-color: var(--cor-borda-forte); }
    td { padding: 4px 8px; border-bottom: 1px solid; border-bottom-color: var(--cor-borda-sutil); }
    th.r, td.r { text-align: left; } th.v, td.v { text-align: right; font-variant-numeric: tabular-nums; }
    ul { margin: 4px 0 8px; padding-left: 18px; font-size: 12px; color: var(--cor-texto); }
    section.secao { page-break-inside: avoid; }
    @media print { button { display: none; } }
  </style></head><body>
    <h1>${titulo}</h1>
    <div class="sub-h">Dossiê do projeto · Estudo ${escaparHtml(dados.nivel)} · ${escaparHtml(rotuloTipo(dados.tipo))} · ${escaparHtml(rotuloStatus(dados.status))}</div>
    ${secoes}
    <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
  </body></html>`;
}

// Janela do dossiê ainda em montagem: a trava de reentrada de `exportarDossiePDF`.
let janelaEmMontagem: Window | null = null;

/**
 * Abre a janela de impressão do dossiê. A janela é aberta ANTES de os dados chegarem: os
 * complementos (mercado, Apelo) vêm de rotas assíncronas, e abrir depois do `await` perderia o
 * gesto do clique — o navegador trataria como pop-up e bloquearia. Devolve `false` quando o
 * pop-up foi bloqueado (a tela avisa, como nas outras exportações); se a montagem falhar, a
 * janela é fechada e o erro sobe para a tela. Com uma montagem em curso, chamada nova NÃO abre outra
 * janela: foca a que está montando e devolve `true` (a trava cai ao fim da montagem, com sucesso ou
 * erro, e também quando o usuário fecha a janela em montagem).
 */
export async function exportarDossiePDF(montar: () => Promise<DadosDossie> | DadosDossie): Promise<boolean> {
  if (janelaEmMontagem && !janelaEmMontagem.closed) {
    janelaEmMontagem.focus?.();
    return true;
  }
  const w = window.open('', '_blank');
  if (!w) return false;
  janelaEmMontagem = w;
  try {
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Dossiê do projeto</title></head><body><p>Montando o dossiê…</p></body></html>');
    w.document.close();
    const dados = await montar();
    const html = htmlDossie(dados, cssTemaClaro(document));
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
    return true;
  } catch (e) {
    w.close();
    throw e;
  } finally {
    if (janelaEmMontagem === w) janelaEmMontagem = null;
  }
}
