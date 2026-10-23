// Dados no navegador: leitura do TSE e a série do gráfico (guardada no aparelho e no gravador).
import type { Resultado } from './engine/motor.ts';

export async function buscarJson(url: string) {
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`TSE respondeu ${resp.status}`);
  return resp.json();
}

export interface Ponto {
  /** fração de seções apuradas */
  pct: number;
  observado: number;
  esperado: number;
  projecao: number;
  p10: number;
  p90: number;
}

export function pontoDe(r: Resultado): Ponto | null {
  if (r.observado === null || r.esperadoMesmoConjunto === null) return null;
  return { pct: r.pctSecoes, observado: r.observado, esperado: r.esperadoMesmoConjunto, projecao: r.projecao, p10: r.p10, p90: r.p90 };
}

const CHAVE_SERIE = 'termometro-serie-2t';

export function lerSerieLocal(): Ponto[] {
  try {
    const s = localStorage.getItem(CHAVE_SERIE);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

export function gravarSerieLocal(serie: Ponto[]) {
  try {
    localStorage.setItem(CHAVE_SERIE, JSON.stringify(serie));
  } catch {
    // sem armazenamento: o gráfico só vale enquanto a página estiver aberta
  }
}

/** Junta séries (do gravador e do navegador), um ponto por percentual apurado. */
export function juntarSeries(...series: Ponto[][]): Ponto[] {
  const porPct = new Map<string, Ponto>();
  for (const s of series) for (const p of s) porPct.set(p.pct.toFixed(4), p);
  return [...porPct.values()].sort((a, b) => a.pct - b.pct);
}

export async function lerSerieGravador(): Promise<Ponto[]> {
  try {
    const resp = await fetch('/api/serie', { cache: 'no-cache' });
    if (!resp.ok) return [];
    const dados = await resp.json();
    return Array.isArray(dados?.pontos) ? dados.pontos : [];
  } catch {
    return [];
  }
}
