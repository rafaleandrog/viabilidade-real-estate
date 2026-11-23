import { Router, type Request, type Response } from 'express';
import { exigirEditor, acessoLeituraEstudo, acessoNegado } from '../permissoes-estudo.js';
import { idDeRota } from './coercao-numerica.js';

export const rotasImoveisEstudo: ReturnType<typeof Router> = Router();

// Vínculo imóvel ↔ estudo (§4.3). A seleção só é editável em Rascunho.
// Loteamento → exatamente 1 gleba. Incorporação → 1+ lotes.
// imovel_nucleo_id é referência lógica, sem FK, a um imóvel (gleba/lote) do
// módulo imobiliário da plataforma — o frontend o lê por urbiVerso.modulo().

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// GET /estudos/:id/imoveis
rotasImoveisEstudo.get('/estudos/:id/imoveis', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }
    const acesso = await acessoLeituraEstudo(req, estudoId);
    if (acessoNegado(acesso)) { erro(res, acesso.http, acesso.codigo, acesso.mensagem); return; }
    const imoveis = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    res.json(imoveis);
  } catch (e: any) {
    console.error('Erro em GET /estudos/:id/imoveis:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/imoveis — vincular imóvel (editor+, apenas Rascunho)
rotasImoveisEstudo.post('/estudos/:id/imoveis', async (req: Request, res: Response) => {
  try {
    const estudoId = idDeRota(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    // #871: a permissão vem ANTES do status. Na ordem inversa, quem não é membro
    // recebia 422 IMOVEL_TRAVADO fora de Rascunho e 403 em Rascunho — e lia o
    // status de um estudo alheio pela diferença (o id é sequencial).
    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para vincular imóveis'); return; }
    if (estudo.status !== 'rascunho') {
      erro(res, 422, 'IMOVEL_TRAVADO', 'O imóvel vinculado só pode ser alterado em Rascunho');
      return;
    }

    const imovelNucleoId = parseInt(req.body.imovel_nucleo_id);
    if (isNaN(imovelNucleoId)) {
      erro(res, 400, 'IMOVEL_INVALIDO', 'imovel_nucleo_id deve ser um número inteiro');
      return;
    }

    // Consistência tipo_imovel × tipo_empreendimento.
    const tipoEsperado = estudo.tipo_empreendimento === 'loteamento' ? 'gleba' : 'lote';
    const tipoImovel = req.body.tipo_imovel ?? tipoEsperado;
    if (tipoImovel !== tipoEsperado) {
      erro(res, 422, 'TIPO_IMOVEL_INCOMPATIVEL',
        `${estudo.tipo_empreendimento} exige imóvel do tipo "${tipoEsperado}"`);
      return;
    }

    // O imóvel tem de existir no módulo imobiliário. Falha fechada: sem helper ou
    // com o módulo falhando, não vincula. Vem depois de permissão, status, id e tipo.
    const conferido = await conferirImovelNoModulo(req.modulos?.imobiliario, tipoImovel, imovelNucleoId);
    if (!conferido.ok) { erro(res, conferido.http, conferido.codigo, conferido.mensagem); return; }

    // Loteamento: no máximo 1 gleba.
    const existentes = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
    if (estudo.tipo_empreendimento === 'loteamento' && existentes.total >= 1) {
      erro(res, 422, 'GLEBA_UNICA', 'Loteamento admite exatamente 1 gleba; remova a atual antes de vincular outra');
      return;
    }
    if (existentes.dados.some((im) => Number(im.imovel_nucleo_id) === imovelNucleoId)) {
      erro(res, 409, 'IMOVEL_DUPLICADO', 'Este imóvel já está vinculado ao estudo');
      return;
    }

    const criado = await req.dados!.criar('estudo_imoveis', {
      estudo_id: estudoId,
      imovel_nucleo_id: imovelNucleoId,
      tipo_imovel: tipoImovel,
    });
    res.status(201).json(criado);
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/imoveis:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH …/remover (e DELETE) /estudos/:id/imoveis/:vinculoId — desvincular (editor+, apenas Rascunho)
async function desvincularImovel(req: Request, res: Response): Promise<void> {
  try {
    const estudoId = idDeRota(req.params.id);
    const vinculoId = idDeRota(req.params.vinculoId);
    if (isNaN(estudoId) || isNaN(vinculoId)) { erro(res, 400, 'ID_INVALIDO', 'IDs devem ser números'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    // #871: permissão antes do status, pelo mesmo motivo do POST acima.
    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para desvincular imóveis'); return; }
    if (estudo.status !== 'rascunho') {
      erro(res, 422, 'IMOVEL_TRAVADO', 'O imóvel vinculado só pode ser alterado em Rascunho');
      return;
    }

    const vinculo = await req.dados!.buscar('estudo_imoveis', vinculoId);
    if (!vinculo || Number(vinculo.estudo_id) !== estudoId) {
      erro(res, 404, 'VINCULO_NAO_ENCONTRADO', 'Vínculo não encontrado neste estudo');
      return;
    }
    await req.dados!.deletar('estudo_imoveis', vinculoId);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro ao remover (PATCH …/remover ou DELETE) /estudos/:id/imoveis/:vinculoId:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
}
// #860: remover é PATCH …/remover, porque o shell só deixa `admin` usar DELETE
// (SDK, permissoes.md § Contrato uniforme método→nível) e o editor precisa remover.
// O DELETE fica como alias (admin e clientes antigos); as guardas são as mesmas.
rotasImoveisEstudo.patch('/estudos/:id/imoveis/:vinculoId/remover', desvincularImovel);
rotasImoveisEstudo.delete('/estudos/:id/imoveis/:vinculoId', desvincularImovel);

// Confere, pelo helper do módulo imobiliário (`req.modulos.imobiliario`), que o imóvel
// existe. Não usa `instanceof` nem importa o SDK: o erro de flag se reconhece pelo
// `name`, que atravessa o bundle.
type HelperImobiliario = {
  buscarPorChave(tabela: string, camposChave: readonly string[], valores: ReadonlyArray<Record<string, any>>):
    Promise<{ achados: Map<string, Record<string, any>> }>;
};
export type ConferenciaImovel = { ok: true } | { ok: false; http: number; codigo: string; mensagem: string };

export async function conferirImovelNoModulo(
  helper: HelperImobiliario | undefined,
  tipoImovel: 'gleba' | 'lote',
  imovelId: number,
): Promise<ConferenciaImovel> {
  if (!helper) {
    return { ok: false, http: 502, codigo: 'MODULO_INDISPONIVEL', mensagem: 'Módulo imobiliário indisponível; o imóvel não foi vinculado' };
  }
  const tabela = tipoImovel === 'gleba' ? 'glebas' : 'lotes';
  try {
    const { achados } = await helper.buscarPorChave(tabela, ['id'], [{ id: imovelId }]);
    if (!achados || achados.size === 0) {
      return { ok: false, http: 404, codigo: 'IMOVEL_NAO_ENCONTRADO', mensagem: 'Imóvel não encontrado no módulo imobiliário' };
    }
    return { ok: true };
  } catch (e: any) {
    if (e && e.name === 'ErroFlagNucleoApp' && Number.isInteger(e.status) && e.status >= 400 && e.status < 600) {
      return { ok: false, http: e.status, codigo: String(e.codigo ?? 'NUCLEO_FLAG_NEGADA'), mensagem: String(e.message ?? 'Acesso ao módulo imobiliário negado') };
    }
    console.error('Falha ao consultar o módulo imobiliário:', e);
    return { ok: false, http: 502, codigo: 'MODULO_FALHOU', mensagem: 'Falha ao consultar o módulo imobiliário; o imóvel não foi vinculado' };
  }
}
