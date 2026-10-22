// v2026-05-27 — CORS origins updated
import { ConfigService } from '@nestjs/config';
import { createNestApp } from './app-factory';

async function bootstrap() {
  const app = await createNestApp();
  const config = app.get(ConfigService);

  if (config.get('NODE_ENV') !== 'production') {
    console.log(`Swagger disponible en: http://localhost:${config.get('PORT', 3001)}/api/docs`);
  }

  // ── Graceful shutdown (Cloud Run envía SIGTERM) ───────────────
  app.enableShutdownHooks();

  // Cloud Run inyecta PORT dinámicamente (ej: 8080). Localmente cae a 3001.
  const port = parseInt(process.env.PORT ?? '') || config.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend escuchando en puerto ${port}`);

  // Cloud Run da 10s tras SIGTERM; cerramos conexiones limpiamente
  process.on('SIGTERM', async () => {
    console.log('SIGTERM recibido — cerrando servidor...');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('❌ BOOTSTRAP ERROR — el servidor no pudo iniciar:', err);
  process.exit(1);
});
