import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

export default async () => {
  const chave = process.env.TESTE_ELEICAO ? 'serie-teste' : 'serie';
  const serie = (await getStore('termometro').get(chave, { type: 'json' })) ?? { pontos: [] };
  return Response.json(serie, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=30, stale-while-revalidate=60',
    },
  });
};

export const config: Config = { path: '/api/serie' };
