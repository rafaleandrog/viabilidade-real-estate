// Wrapper da API do app `viabilidade` sobre o global window.urbiVerso.
// Espelha o padrão de okr-api.ts. urbiVerso.api(path) já resolve /api + auth.

interface UrbiVersoApi {
  api(url: string, opts?: RequestInit): Promise<any>;
  // Acesso ao Núcleo compartilhado. Monta /api/<appId>/nucleo/... e aplica os
  // gates do manifesto (permissoes_nucleo) + toggles do admin. Lança em não-2xx.
  nucleo(url: string, opts?: RequestInit): Promise<any>;
  usuario(): { id: number; nome: string; email: string; tipo: string; avatar_url: string };
  contexto(): { nivel: string | null; roles: string[] };
  navegar(rota: string): void;
  notificar(mensagem: string, tipo?: 'info' | 'sucesso' | 'erro' | 'alerta'): void;
  subRota(): string;
  href(sub: string): string;
  navegarSub(sub: string): void;
  escutarRota(cb: (subRota: string) => void): () => void;
}

declare global {
  // eslint-disable-next-line no-var
  var urbiVerso: UrbiVersoApi;
}

export const urbiVerso = globalThis.urbiVerso as UrbiVersoApi;

const APP = '/viabilidade';

// ── Estudos ──
export function listarEstudos(filtros: { tipo_empreendimento?: string; status?: string } = {}): Promise<any> {
  const qs = new URLSearchParams();
  if (filtros.tipo_empreendimento) qs.set('tipo_empreendimento', filtros.tipo_empreendimento);
  if (filtros.status) qs.set('status', filtros.status);
  const sufixo = qs.toString() ? `?${qs}` : '';
  return urbiVerso.api(`${APP}/estudos${sufixo}`);
}

export function criarEstudo(dados: Record<string, any>): Promise<any> {
  return urbiVerso.api(`${APP}/estudos`, { method: 'POST', body: JSON.stringify(dados) });
}

export function buscarEstudo(id: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${id}`);
}

export function atualizarEstudo(id: number, dados: Record<string, any>): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
}

export function removerEstudo(id: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${id}`, { method: 'DELETE' });
}

export function duplicarEstudo(id: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${id}/duplicar`, { method: 'POST' });
}

export function transicaoStatus(id: number, status: string): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
}

// ── Membros ──
export function listarMembros(estudoId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/membros`);
}
export function adicionarMembro(estudoId: number, usuarioId: number, funcao: string): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/membros`, {
    method: 'POST', body: JSON.stringify({ usuario_id: usuarioId, funcao }),
  });
}
export function alterarFuncaoMembro(estudoId: number, usuarioId: number, funcao: string): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/membros/${usuarioId}`, {
    method: 'PATCH', body: JSON.stringify({ funcao }),
  });
}
export function removerMembro(estudoId: number, usuarioId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/membros/${usuarioId}/remover`, { method: 'PATCH' });
}

// ── Imóveis ──
export function listarImoveis(estudoId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/imoveis`);
}
export function vincularImovel(estudoId: number, imovelNucleoId: number, tipoImovel?: string): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/imoveis`, {
    method: 'POST', body: JSON.stringify({ imovel_nucleo_id: imovelNucleoId, tipo_imovel: tipoImovel }),
  });
}
export function desvincularImovel(estudoId: number, vinculoId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/imoveis/${vinculoId}`, { method: 'DELETE' });
}

// ── Benchmarks ──
export function listarBenchmarks(tipo?: string): Promise<any> {
  const sufixo = tipo ? `?tipo_empreendimento=${tipo}` : '';
  return urbiVerso.api(`${APP}/benchmarks${sufixo}`);
}
export function criarBenchmark(dados: Record<string, any>): Promise<any> {
  return urbiVerso.api(`${APP}/benchmarks`, { method: 'POST', body: JSON.stringify(dados) });
}
export function atualizarBenchmark(id: number, dados: Record<string, any>): Promise<any> {
  return urbiVerso.api(`${APP}/benchmarks/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
}
export function removerBenchmark(id: number): Promise<any> {
  return urbiVerso.api(`${APP}/benchmarks/${id}`, { method: 'DELETE' });
}
export function semearBenchmarks(): Promise<any> {
  return urbiVerso.api(`${APP}/benchmarks/semear`, { method: 'POST' });
}

// ── Config ──
export function buscarConfig(): Promise<any> {
  return urbiVerso.api(`${APP}/config`);
}

// ── Núcleo (glebas/lotes/imóveis) ──
// Consumo padrão via urbiVerso.nucleo → /api/viabilidade/nucleo/... (o shell
// provê essas rotas para apps que declaram dependencias_nucleo no manifesto).
// Loteamento usa glebas; Incorporação usa lotes. Só leitura (flag "ler").
export function listarGlebasNucleo(busca = ''): Promise<any> {
  const qs = new URLSearchParams({ por_pagina: '200' });
  if (busca) qs.set('busca', busca);
  return urbiVerso.nucleo(`/glebas?${qs}`);
}
export function listarLotesNucleo(busca = ''): Promise<any> {
  const qs = new URLSearchParams({ por_pagina: '200' });
  if (busca) qs.set('busca', busca);
  return urbiVerso.nucleo(`/lotes?${qs}`);
}
export function buscarImovelNucleo(id: number): Promise<any> {
  return urbiVerso.nucleo(`/imoveis/${id}`);
}

// ── Apelo Comercial (IA) ──
export function buscarApelo(estudoId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/apelo-comercial`);
}
export async function uploadDocumentoApelo(file: File): Promise<{ upload_id: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/dados/viabilidade/apelo_comercial_documentos/__upload?coluna=documento', {
    method: 'POST', body: fd, credentials: 'same-origin',
  });
  return res.json();
}
export function anexarDocumentoApelo(estudoId: number, dados: { upload_id?: number; tipo_dado?: string; texto_adicional?: string; nome_arquivo?: string }): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/apelo-comercial/documentos`, { method: 'POST', body: JSON.stringify(dados) });
}
export function removerDocumentoApelo(estudoId: number, docId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/apelo-comercial/documentos/${docId}`, { method: 'DELETE' });
}
export function analisarApelo(estudoId: number): Promise<any> {
  return urbiVerso.api(`${APP}/estudos/${estudoId}/apelo-comercial`, { method: 'POST' });
}

// ── Usuários (para gestão de membros) ──
export async function listarUsuarios(): Promise<any[]> {
  const res = await urbiVerso.api('/shell/apps/viabilidade/roles/usuarios');
  const usuarios = Array.isArray(res) ? res : (res?.usuarios || []);
  return [...usuarios].sort((a, b) =>
    (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' }));
}
