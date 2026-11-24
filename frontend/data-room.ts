// Data room do estudo — agrupamento puro dos documentos já guardados (empreendimento e
// apelo comercial) por categoria. Sem lit, sem rede, sem banco: não muta as entradas.

export type CategoriaDataRoom = 'terreno' | 'juridico' | 'projeto' | 'comercial' | 'financeiro' | 'outros';

export const CATEGORIAS_DATA_ROOM: { id: CategoriaDataRoom; rotulo: string }[] = [
  { id: 'terreno', rotulo: 'Terreno' },
  { id: 'juridico', rotulo: 'Jurídico' },
  { id: 'projeto', rotulo: 'Projeto' },
  { id: 'comercial', rotulo: 'Comercial' },
  { id: 'financeiro', rotulo: 'Financeiro' },
  { id: 'outros', rotulo: 'Outros' },
];

export type OrigemDataRoom = 'empreendimento' | 'apelo';

export interface ItemDataRoom {
  origem: OrigemDataRoom;
  id: string;
  nome: string;
  tipo: string;
  rotuloTipo: string;
  categoria: CategoriaDataRoom;
  url: string | null;
  soTexto: boolean;
}

const CATEGORIA_EMPREENDIMENTO: Record<string, CategoriaDataRoom> = {
  imagem_principal: 'projeto',
  render: 'projeto',
  planta: 'projeto',
};

const CATEGORIA_APELO: Record<string, CategoriaDataRoom> = {
  anuncios: 'comercial',
  populacao: 'comercial',
  mercado: 'comercial',
  outro: 'outros',
};

const ROTULO_TIPO: Record<string, string> = {
  imagem_principal: 'Imagem principal',
  render: 'Render',
  planta: 'Planta',
  anuncios: 'Anúncios',
  populacao: 'População',
  mercado: 'Mercado',
  outro: 'Outro',
};

const CATEGORIAS_SEM_TIPO: CategoriaDataRoom[] = ['terreno', 'juridico', 'financeiro'];

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function rotuloDe(tipo: string): string {
  return Object.prototype.hasOwnProperty.call(ROTULO_TIPO, tipo) ? ROTULO_TIPO[tipo] : 'Outro';
}

function categoriaDe(mapa: Record<string, CategoriaDataRoom>, tipo: string): CategoriaDataRoom {
  return Object.prototype.hasOwnProperty.call(mapa, tipo) ? mapa[tipo] : 'outros';
}

function vazio<T>(): Record<CategoriaDataRoom, T[]> {
  return { terreno: [], juridico: [], projeto: [], comercial: [], financeiro: [], outros: [] };
}

export function agruparDataRoom(
  docsEmpreendimento: any[] | null | undefined,
  docsApelo: any[] | null | undefined,
): Record<CategoriaDataRoom, ItemDataRoom[]> {
  const grupos = vazio<ItemDataRoom>();

  for (const d of Array.isArray(docsEmpreendimento) ? docsEmpreendimento : []) {
    if (d == null) continue;
    const doc = d;
    const tipo = texto(doc.categoria);
    const categoria = categoriaDe(CATEGORIA_EMPREENDIMENTO, tipo);
    grupos[categoria].push({
      origem: 'empreendimento',
      id: String(doc.id ?? ''),
      nome: texto(doc.nome_arquivo) || rotuloDe(tipo),
      tipo,
      rotuloTipo: rotuloDe(tipo),
      categoria,
      url: texto(doc.url) || null,
      soTexto: false,
    });
  }

  for (const d of Array.isArray(docsApelo) ? docsApelo : []) {
    if (d == null) continue;
    const doc = d;
    const tipo = texto(doc.tipo_dado);
    const categoria = categoriaDe(CATEGORIA_APELO, tipo);
    const arquivo = texto(doc.nome_arquivo);
    const semArquivo = !arquivo && !doc.documento;
    const adicional = texto(doc.texto_adicional).trim();
    const nome = arquivo || (adicional ? `Texto: ${adicional.slice(0, 60)}` : 'Texto');
    grupos[categoria].push({
      origem: 'apelo',
      id: String(doc.id ?? ''),
      nome,
      tipo,
      rotuloTipo: rotuloDe(tipo),
      categoria,
      url: texto(doc.url) || null,
      soTexto: semArquivo,
    });
  }

  return grupos;
}

export const CHECKLIST_DATA_ROOM: Record<
  CategoriaDataRoom,
  { tipo: string; rotulo: string; origem: OrigemDataRoom }[]
> = {
  terreno: [],
  juridico: [],
  projeto: [
    { tipo: 'imagem_principal', rotulo: 'Imagem principal', origem: 'empreendimento' },
    { tipo: 'render', rotulo: 'Render', origem: 'empreendimento' },
    { tipo: 'planta', rotulo: 'Planta', origem: 'empreendimento' },
  ],
  comercial: [
    { tipo: 'anuncios', rotulo: 'Anúncios', origem: 'apelo' },
    { tipo: 'populacao', rotulo: 'População', origem: 'apelo' },
    { tipo: 'mercado', rotulo: 'Mercado', origem: 'apelo' },
  ],
  financeiro: [],
  outros: [],
};

export function checklistDataRoom(
  grupos: Record<CategoriaDataRoom, ItemDataRoom[]>,
): Record<CategoriaDataRoom, { rotulo: string; presente: boolean }[]> {
  const saida = vazio<{ rotulo: string; presente: boolean }>();
  for (const { id } of CATEGORIAS_DATA_ROOM) {
    const itens = grupos?.[id] ?? [];
    saida[id] = CHECKLIST_DATA_ROOM[id].map((c) => ({
      rotulo: c.rotulo,
      presente: itens.some((i) => i.origem === c.origem && i.tipo === c.tipo),
    }));
  }
  return saida;
}

/** Recarrega ao VOLTAR à sub-aba (inativa -> ativa) quando já houve carga: os documentos
 *  podem ter sido anexados em Informações ou no Apelo Comercial enquanto o painel esteve oculto. */
export function deveRecarregarDataRoom(ativaAntes: boolean, ativaAgora: boolean, jaCarregou: boolean): boolean {
  return !ativaAntes && ativaAgora && jaCarregou;
}

export function categoriaSemTipo(c: CategoriaDataRoom): boolean {
  return CATEGORIAS_SEM_TIPO.includes(c);
}

/** A resposta de uma carga só vale se for a mais recente (`seq === seqAtual`) e o estudo
 *  não tiver trocado. Duas cargas do mesmo estudo podem se sobrepor; a mais velha, ao
 *  terminar por último, não pode sobrescrever a lista nova. */
export function respostaDaCargaVale(
  seq: number, seqAtual: number, idPedido: number | undefined, idAtual: number | undefined,
): boolean {
  return seq === seqAtual && idPedido === idAtual;
}
