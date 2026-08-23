// Apoio dos testes de render. Três decisões moram aqui, e não em cada teste,
// porque as três já apareceram como divergência de veredito entre ambientes.

import { harnessDisponivel, descrever, type Achados } from '../../scripts/render-check.mjs';

/**
 * Motivo para PULAR, ou `null` quando o harness está pronto.
 *
 * ⚠️ A assimetria entre pular e reprovar é deliberada, e é o ponto mais
 * delicado deste arquivo — porque "não deu para rodar" virando "passou" é
 * exatamente o modo de falha que o CLAUDE.md nomeia.
 *
 *  · sem `RENDER_CHECK_OBRIGATORIO`: navegador ausente PULA, com o motivo no
 *    nome do teste. É o caso da máquina do autor, que não tem Playwright e
 *    não deveria ficar impedida de rodar `pnpm test`;
 *  · com `RENDER_CHECK_OBRIGATORIO=1`: navegador ausente REPROVA. É o que o
 *    CI exporta, sempre. Lá a ausência não é circunstância, é defeito de
 *    ambiente — e um pulo silencioso no runner tornaria esta camada inteira
 *    decorativa sem que nada ficasse vermelho.
 */
export async function motivoParaPular(): Promise<string | null> {
  const d = await harnessDisponivel();
  if (d.ok) return null;
  if (process.env.RENDER_CHECK_OBRIGATORIO === '1') {
    throw new Error(
      'RENDER_CHECK_OBRIGATORIO=1 e o harness de render não está utilizável: ' + d.motivo,
    );
  }
  return `sem navegador — ${d.motivo}`;
}

/** O relatório completo, para entrar na mensagem de falha do `node --test`. */
export function relato(a: Achados): string {
  return '\n' + descrever(a).join('\n') + '\n';
}

/** Total de achados de uma lente, somado em todas as larguras medidas. */
export function contar(a: Achados, lente: 'transbordoDeCaixa' | 'transbordoDeTexto' | 'sobreposicao'): number {
  return Object.values(a.larguras).reduce((s, m) => s + m[lente].length, 0);
}

/** Larguras em que o DOCUMENTO rolou na horizontal. */
export function larguraComOverflowDeDocumento(a: Achados): string[] {
  return Object.entries(a.larguras).filter(([, m]) => m.overflowDocumento !== null).map(([l]) => l);
}

/** Tokens citados pelo CSS em uso que não resolvem, em qualquer variante de tema. */
export function tokensSemValor(a: Achados): string[] {
  const fora = new Set<string>();
  for (const v of Object.values(a.variantes)) for (const t of v.naoResolvem) fora.add(t);
  return [...fora].sort();
}

/** Textos que saíram pintados da mesma cor do próprio fundo, em qualquer variante. */
export function textosInvisiveis(a: Achados): string[] {
  const fora: string[] = [];
  for (const [k, v] of Object.entries(a.variantes)) {
    for (const i of v.invisiveis) fora.push(`variante ${k}: ${i.onde} (${i.cor} sobre ${i.fundo})`);
  }
  return fora;
}
