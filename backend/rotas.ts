import '@urbiverso/sdk/express';
import { Router } from 'express';
import { rotasEstudos } from './rotas/estudos.js';
import { rotasMembrosEstudo } from './rotas/membros-estudo.js';
import { rotasImoveisEstudo } from './rotas/imoveis-estudo.js';

// Rotas de negócio da app `viabilidade`.
// O shell prefixa tudo com /api/viabilidade/ — as rotas aqui são sempre relativas.
// req.contexto (usuário/nível/roles), req.dados (persistência) e req.eventos já
// vêm injetados pelo shell.
export const rotas: ReturnType<typeof Router> = Router();

rotas.use(rotasEstudos);
rotas.use(rotasMembrosEstudo);
rotas.use(rotasImoveisEstudo);
