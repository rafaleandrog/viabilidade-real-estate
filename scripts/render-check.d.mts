// Tipos de `scripts/render-check.mjs`, para os testes de `frontend/render/`.
//
// O harness é `.mjs` de propósito: ele é código de NODE (servidor http,
// esbuild, Playwright), não do bundle do app, e não tem lugar em `frontend/`.
// Sem este arquivo o `tsc --strict` do `validar-frontend.sh` reprova o import
// com TS7016 — `any` implícito num módulo JS sem declaração.

export interface AchadoTransbordo { onde: string; scrollWidth: number; clientWidth: number }
export interface AchadoSobreposicao { a: string; b: string; px: number; py: number }
export interface AchadoInvisivel { onde: string; cor: string; fundo: string }

export interface MedidaDeLargura {
  overflowDocumento: { scrollWidth: number; clientWidth: number } | null;
  transbordoDeCaixa: AchadoTransbordo[];
  transbordoDeTexto: AchadoTransbordo[];
  sobreposicao: AchadoSobreposicao[];
  fingerprint: { largura: number; familia: string };
}

export interface MedidaDeVariante {
  tokensCitados: number;
  naoResolvem: string[];
  invisiveis: AchadoInvisivel[];
}

export interface Achados {
  caso: string;
  nVariantes: number;
  fingerprint: { largura: number; familia: string } | null;
  erroConsole: string[];
  larguras: Record<string, MedidaDeLargura>;
  variantes: Record<string, MedidaDeVariante>;
}

export function verificarRender(opcoes: {
  caso: string;
  larguras?: number[];
  altura?: number;
}): Promise<Achados>;

export function harnessDisponivel(): Promise<{ ok: boolean; motivo?: string }>;

export function descrever(achados: Achados, teto?: number): string[];
