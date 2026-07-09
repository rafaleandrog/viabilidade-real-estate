import '@urbiverso/sdk/express';
import { Router } from 'express';

// Rotas de negócio da app `viabilidade`.
// O shell prefixa tudo com /api/viabilidade/ — as rotas aqui são sempre relativas.
// req.contexto (usuário/nível/roles) e req.dados (persistência) já vêm injetados pelo shell.
// Etapa 0: router vazio (esqueleto). As rotas customizadas chegam na Etapa 2.
export const rotas: ReturnType<typeof Router> = Router();
