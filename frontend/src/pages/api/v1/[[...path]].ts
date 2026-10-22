import type { IncomingMessage, ServerResponse } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';

// La API NestJS (carpeta backend) se sirve desde este mismo proyecto Next.js.
// Next solo entrega la petición sin procesar; Nest se encarga del body, la
// autenticación, la validación y la respuesta.
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const state = globalThis as typeof globalThis & { __armApi?: Promise<Handler> };

function loadApi(): Promise<Handler> {
  if (!state.__armApi) {
    state.__armApi = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createNestApp } = require('intranet-backend/dist/app-factory');
      const app = await createNestApp();
      await app.init();
      return app.getHttpAdapter().getInstance() as Handler;
    })().catch((error) => {
      state.__armApi = undefined; // reintentar en la próxima petición
      throw error;
    });
  }
  return state.__armApi;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let api: Handler;
  try {
    api = await loadApi();
  } catch (error) {
    console.error('No se pudo iniciar la API', error);
    res.status(503).json({ statusCode: 503, message: 'La API no está disponible' });
    return;
  }
  await new Promise<void>((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    api(req, res);
  });
}
