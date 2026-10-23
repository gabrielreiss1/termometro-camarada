import type { Candidato } from './tipos.ts';

export type Matriz = Record<Candidato, { flavio: number; lula: number }>;

export const CONFIG = {
  /** Fração dos eleitores de cada candidato derrotado que vai para Flávio/Lula; o resto não vota em nenhum dos dois. */
  matriz: {
    cury: { flavio: 0.33, lula: 0.48 },
    caiado: { flavio: 0.57, lula: 0.21 },
    renan: { flavio: 0.51, lula: 0.25 },
    zema: { flavio: 0.57, lula: 0.21 }, // sem dado na pesquisa: usa o do Caiado
    demais: { flavio: 0.33, lula: 0.48 }, // sem dado na pesquisa: usa o do Cury
  } satisfies Matriz as Matriz,
  fonteMatriz: 'Quaest, 17 a 20/10/2026',

  /** O "esperado" nacional é ajustado por igual em todas as cidades para dar este resultado. */
  esperadoNacionalLula: 0.5,
  fonteEsperado: 'Datafolha, 20 a 22/10/2026 (50% × 50% dos válidos)',
  fonteEsperadoCurta: 'Datafolha, 20 a 22/10',

  /** Votos válidos apurados em que o estado passa a pesar metade (o resto vem da média nacional). */
  k: 200_000,
  /** Mesmo papel, para o comparecimento, em eleitores de municípios quase todo apurados. */
  kComparecimento: 200_000,
  /** Município entra na medição de comparecimento a partir desta fração de seções apuradas. */
  minApuradoComparecimento: 0.95,

  simulacoes: 400,
  inicioApuracao: '2026-10-25T17:00:00-03:00',
  /** Abaixo desta fração do eleitorado apurado, o veredito fica "aguardando". */
  minApuradoVeredito: 0.01,
};

export type Config = typeof CONFIG;

export const NOMES_OUTROS: Record<Candidato, string> = {
  cury: 'Augusto Cury',
  renan: 'Renan Santos',
  caiado: 'Ronaldo Caiado',
  zema: 'Romeu Zema',
  demais: 'Demais',
};

export type Regiao = 'N' | 'NE' | 'CO' | 'SE' | 'S' | 'EX';

export const REGIAO_DA_UF: Record<string, Regiao> = {
  ac: 'N', am: 'N', ap: 'N', pa: 'N', ro: 'N', rr: 'N', to: 'N',
  al: 'NE', ba: 'NE', ce: 'NE', ma: 'NE', pb: 'NE', pe: 'NE', pi: 'NE', rn: 'NE', se: 'NE',
  df: 'CO', go: 'CO', ms: 'CO', mt: 'CO',
  es: 'SE', mg: 'SE', rj: 'SE', sp: 'SE',
  pr: 'S', rs: 'S', sc: 'S',
  zz: 'EX',
};

export const NOMES_REGIAO: Record<Regiao, string> = {
  N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul', EX: 'Exterior',
};
