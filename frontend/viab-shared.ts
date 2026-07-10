import { css } from 'lit';

// Estilos compartilhados dos componentes do app (tema escuro do shell via tokens).

export const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
  arquivado: 'Arquivado',
};

export const TIPO_LABEL: Record<string, string> = {
  loteamento: 'Loteamento',
  incorporacao: 'Incorporação',
};

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export const estilosBase = css`
  :host {
    display: block;
    color: var(--cor-texto, rgba(255, 255, 255, 0.85));
    font-family: 'Inter', system-ui, sans-serif;
  }
  h1, h2, h3 { color: var(--cor-texto, rgba(255, 255, 255, 0.92)); font-weight: 600; }
  a { color: var(--cor-primaria-solida, #2AA9E0); text-decoration: none; }
  .sec { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  .vazio { text-align: center; padding: 40px; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }

  button {
    font-family: inherit; font-size: 0.85rem; cursor: pointer;
    border-radius: 6px; padding: 7px 14px; border: 1px solid transparent;
  }
  .btn-primario { background: var(--cor-primaria-solida, #2AA9E0); color: #06121c; font-weight: 600; }
  .btn-cta { background: var(--cor-cta, #F7A111); color: #1a1200; font-weight: 600; }
  .btn-sec {
    background: var(--cor-superficie, rgba(255,255,255,0.04));
    border-color: var(--cor-borda, rgba(255,255,255,0.14));
    color: var(--cor-texto, rgba(255,255,255,0.85));
  }
  .btn-perigo { background: transparent; border-color: var(--cor-erro, #D45A3A); color: var(--cor-erro, #D45A3A); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sm { padding: 4px 10px; font-size: 0.78rem; }

  .card {
    background: var(--cor-superficie, rgba(255,255,255,0.04));
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
    border-radius: 10px; padding: 16px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td {
    text-align: left; padding: 10px 12px;
    border-bottom: 1px solid var(--cor-borda, rgba(255,255,255,0.08));
  }
  th { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; font-size: 0.75rem;
       text-transform: uppercase; letter-spacing: 0.04em; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--cor-superficie, rgba(255,255,255,0.04)); }

  .badge {
    display: inline-block; font-size: 0.72rem; font-weight: 600;
    padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  }
  .badge.rascunho   { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.7); }
  .badge.em_analise { background: rgba(42,169,224,0.16); color: #2AA9E0; }
  .badge.aprovado   { background: rgba(19,169,141,0.16); color: #13A98D; }
  .badge.reprovado  { background: rgba(212,90,58,0.16); color: #D45A3A; }
  .badge.arquivado  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }

  .campo { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .campo label { font-size: 0.8rem; color: var(--cor-texto-sec, rgba(255,255,255,0.55)); }
  input, select, textarea {
    font-family: inherit; font-size: 0.88rem; padding: 8px 10px; border-radius: 6px;
    background: var(--cor-fundo, #0D1B2A);
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.14));
    color: var(--cor-texto, rgba(255,255,255,0.9));
  }
  .erro { color: var(--cor-erro, #D45A3A); font-size: 0.82rem; }

  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
  }
  .modal {
    background: var(--cor-topbar, #0a0e1a);
    border: 1px solid var(--cor-borda, rgba(255,255,255,0.12));
    border-radius: 12px; padding: 22px; width: 100%; max-width: 460px;
    max-height: 90vh; overflow-y: auto;
  }
  .modal h3 { margin: 0 0 16px; font-size: 1.05rem; }
  .acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
`;
