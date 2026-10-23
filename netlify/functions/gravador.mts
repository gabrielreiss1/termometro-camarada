// Roda a cada minuto no Netlify durante a apuração e guarda a série do gráfico,
// para quem abrir a página no meio da noite ver a curva desde o começo.
import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import arquivoBase from '../../public/dados/base-1t.json';
import { CONFIG } from '../../src/engine/config.ts';
import { ColetorTSE } from '../../src/engine/coletor.ts';
import { calcular, prepararBase } from '../../src/engine/motor.ts';
import { lerBase, type ArquivoBase } from '../../src/engine/tipos.ts';
import { ELEICAO_2T } from '../../src/engine/tse.ts';
import { juntarSeries, pontoDe, type Ponto } from '../../src/fonte.ts';

const prep = prepararBase(lerBase(arquivoBase as ArquivoBase), CONFIG);

async function buscarJson(url: string) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'termometro-2turno (projeção independente)' } });
  if (!resp.ok) throw new Error(`TSE respondeu ${resp.status} em ${url}`);
  return resp.json();
}

export default async () => {
  // TESTE_ELEICAO=6257 roda fora do horário, com o 1º turno, gravando em outra chave
  const teste = Number(process.env.TESTE_ELEICAO) || 0;
  const agora = Date.now();
  const inicio = new Date(CONFIG.inicioApuracao).getTime();
  if (!teste && (agora < inicio - 10 * 60_000 || agora > inicio + 8 * 3_600_000)) {
    return new Response('fora do horário da apuração');
  }
  const entrada = await new ColetorTSE(teste || ELEICAO_2T, buscarJson).atualizar();
  const ponto = pontoDe(calcular(prep, entrada, CONFIG));
  if (!ponto) return new Response('sem votos apurados ainda');

  const chave = teste ? 'serie-teste' : 'serie';
  const store = getStore('termometro');
  const atual = ((await store.get(chave, { type: 'json' })) as { pontos: Ponto[] } | null) ?? { pontos: [] };
  const pontos = juntarSeries(atual.pontos, [ponto]);
  await store.setJSON(chave, { pontos, atualizado: new Date().toISOString() });
  return new Response(`ok: ${pontos.length} pontos, ${(100 * ponto.pct).toFixed(2)}% apurado`);
};

export const config: Config = { schedule: '* * * * *' };
