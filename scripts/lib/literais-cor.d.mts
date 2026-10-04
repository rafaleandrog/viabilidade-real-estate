// Tipos de `literais-cor.mjs`, para os testes de frontend importarem o mesmo
// contador que o guard do bundle usa, em vez de uma terceira cópia da regex.
export function literaisDeCor(conteudo: string): string[];
export function contarLiteraisDeCor(conteudo: string): number;
export function auditarDiretorio(dir: string): {
  total: number;
  lidos: number;
  arquivos: Array<{ arquivo: string; literais: string[] }>;
};
