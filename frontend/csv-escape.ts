// Escape de células de texto do CSV (#897) — módulo à parte para não deslocar
// os endereços `arquivo:linha` que a documentação cita em `exportar.ts`.

/** Rótulo escrito pelo app no Fluxo (não vem do usuário): só recebe escape de CSV. */
export const ROTULO_FIXO_FLUXO = '= Receita Líquida do Projeto';

/**
 * Célula de TEXTO do CSV (separador ';'): aspas dobradas e célula entre aspas
 * quando contém `;`, `"`, `\n` ou `\r`; e, contra injeção de fórmula, texto
 * iniciado por `=`, `+`, `-`, `@`, tab ou CR ganha `'` na frente.
 *
 * ⚠️ Só para TEXTO. Número já formatado (`fmtR$`, `fmtPct`, `celulaProforma`,
 * `pctVgvProforma`, `celulaFx`, `fmtNum`, `fmtPctOuIndef`) não passa por aqui:
 * `-1.234,56` é um negativo legítimo e o `'` o transformaria em texto.
 *
 * `neutralizar = false` serve só para rótulos FIXOS do app (ex.: "= Resultado"),
 * que nunca vêm do usuário; o escape de CSV continua valendo.
 * `prefixo` é recuo que entra DEPOIS da neutralização (o gatilho é o primeiro
 * caractere do texto, não do recuo), mas DENTRO das aspas.
 */
export function celulaTextoCsv(s: unknown, neutralizar = true, prefixo = ''): string {
  let t = s === null || s === undefined ? '' : String(s);
  if (neutralizar && /^[=+\-@\t\r]/.test(t)) t = "'" + t;
  t = prefixo + t;
  return /[;"\n\r]/.test(t) ? '"' + t.replaceAll('"', '""') + '"' : t;
}
