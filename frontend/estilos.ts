import { css } from 'lit';

// ─────────────────────────────────────────────────────────────────
// Contrato de altura do framework de UI do UrbiVerso (docs/shell/ui.md
// — "Cadeia de altura"). Apps plugáveis NÃO importam valor de
// @urbiverso/ui (o pacote é `external` no esbuild), então replicamos os
// mixins `estiloPagina`/`estiloPrimitivo` à mão. Os componentes `urbi-*`
// vêm por TAG (registrados globalmente pelo shell), nunca por import.
// ─────────────────────────────────────────────────────────────────

// Raiz da app (= UrbiPageBase.estiloPagina). ÚNICO lugar com height:100%
// — ancora no viewport e propaga altura pras telas filhas.
export const estiloPagina = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
`;

// Telas roteadas (filhas da raiz) (= UrbiPrimitivoDeLayout.estiloPrimitivo).
// flex:1 + min-height:0 mantêm a cadeia sem colapsar; o urbi-shell-page
// interno herda a altura e cuida do próprio scroll.
export const estiloPrimitivo = css`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
`;

// Helpers de conteúdo puramente tipográficos (só tokens, sem layout).
// Espaçamento/estrutura são responsabilidade dos primitivos, não daqui.
export const estiloConteudo = css`
  h2, h3 {
    color: var(--cor-texto-forte, rgba(255, 255, 255, 0.95));
    font-weight: 600;
  }
  .sec {
    color: var(--cor-texto-sec, rgba(255, 255, 255, 0.5));
    font-size: var(--texto-corpo, 0.8125rem);
  }
  .erro {
    color: var(--cor-erro, #d45a3a);
    font-size: var(--texto-corpo, 0.8125rem);
  }
`;
