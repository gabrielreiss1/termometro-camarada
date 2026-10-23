// Contador de aparelhos que abriram o site. POST soma 1 (cada aparelho chama uma vez só); GET devolve o total.
// O total fica dividido em fatias sorteadas para dois acessos ao mesmo tempo quase nunca se atropelarem.
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

const FATIAS = 32;

export default async (req: Request) => {
  const store = getStore('termometro');
  if (req.method === 'POST') {
    const chave = `visitas/${Math.floor(Math.random() * FATIAS)}`;
    const atual = Number(await store.get(chave, { consistency: 'strong' })) || 0;
    await store.set(chave, String(atual + 1));
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  const valores = await Promise.all(Array.from({ length: FATIAS }, (_, i) => store.get(`visitas/${i}`)));
  const total = valores.reduce((soma, v) => soma + (Number(v) || 0), 0);
  return Response.json(
    { total },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, durable, max-age=60, stale-while-revalidate=120',
      },
    },
  );
};

export const config: Config = { path: '/api/visitas' };
