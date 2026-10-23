export interface MunicipioBase {
  uf: string;
  cd: string;
  eleitorado: number;
  secoes: number;
  comparecimento: number;
  validos: number;
  brancosNulos: number;
  lula: number;
  flavio: number;
  cury: number;
  renan: number;
  caiado: number;
  zema: number;
  demais: number;
  /** minutos depois das 17h (Brasília) em que o município terminou de apurar no 1º turno */
  fim: number;
}

export const CAMPOS_BASE = [
  'uf', 'cd', 'eleitorado', 'secoes', 'comparecimento', 'validos', 'brancosNulos',
  'lula', 'flavio', 'cury', 'renan', 'caiado', 'zema', 'demais', 'fim',
] as const satisfies readonly (keyof MunicipioBase)[];

export interface ArquivoBase {
  eleicao: number;
  campos: readonly string[];
  linhas: (string | number)[][];
}

export function lerBase(arq: ArquivoBase): MunicipioBase[] {
  return arq.linhas.map((l) => {
    const o: Record<string, string | number> = {};
    arq.campos.forEach((c, i) => (o[c] = l[i]));
    return o as unknown as MunicipioBase;
  });
}

export type Candidato = 'cury' | 'renan' | 'caiado' | 'zema' | 'demais';
export const CANDIDATOS_OUTROS: Candidato[] = ['cury', 'renan', 'caiado', 'zema', 'demais'];
