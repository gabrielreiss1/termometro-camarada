// Endereços e leitura dos arquivos públicos de resultados do TSE (formato 2026).

export const BASE_TSE = 'https://resultados.tse.jus.br/oficial/ele2026';
export const ELEICAO_1T = 6257;
export const ELEICAO_2T = 6258;

export const NUM_LULA = '13';
export const NUM_FLAVIO = '22';

const codEleicao = (e: number) => 'e' + String(e).padStart(6, '0');

export const urlTSE = {
  municipios: (e: number, base = BASE_TSE) => `${base}/${e}/config/mun-${codEleicao(e)}-cm.json`,
  /** abr = 'br' (andamento por UF) ou sigla da UF (andamento por município) */
  andamento: (e: number, abr: string, base = BASE_TSE) =>
    `${base}/${e}/dados/${abr}/${abr}-${codEleicao(e)}-ab.json`,
  /** abr = 'br' ou sigla da UF */
  resultado: (e: number, abr: string, base = BASE_TSE) =>
    `${base}/${e}/dados/${abr}/${abr}-c0001-${codEleicao(e)}-u.json`,
  resultadoMunicipio: (e: number, uf: string, cd: string, base = BASE_TSE) =>
    `${base}/${e}/dados/${uf}/${uf}${cd}-c0001-${codEleicao(e)}-u.json`,
  foto: (e: number, sqcand: string, base = BASE_TSE) => `${base}/${e}/fotos/br/${sqcand}.jpeg`,
};

export interface ResultadoTSE {
  abr: string;
  /** votos por número de candidato */
  votos: Record<string, number>;
  validos: number;
  brancos: number;
  nulos: number;
  comparecimento: number;
  eleitorado: number;
  /** eleitorado das seções já totalizadas */
  eleitoradoApurado: number;
  secoes: number;
  secoesApuradas: number;
  /** "dd/mm/aaaa hh:mm:ss" da última totalização */
  totalizacao: string;
  /** identificador da geração do arquivo; muda a cada publicação */
  geracao: string;
}

export interface AndamentoTSE {
  tipo: string; // 'mun' | 'uf' | 'br'
  abr: string;
  secoes: number;
  secoesApuradas: number;
  eleitorado: number;
  eleitoradoApurado: number;
  comparecimento: number;
  totalizacao: string;
}

const n = (v: unknown) => (v === undefined || v === null || v === '' ? 0 : Number(v));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export function lerResultado(j: Json): ResultadoTSE {
  const votos: Record<string, number> = {};
  for (const agr of j.carg?.[0]?.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const cand of par.cand ?? []) votos[cand.n] = (votos[cand.n] ?? 0) + n(cand.vap);
    }
  }
  return {
    abr: j.cdabr,
    votos,
    validos: n(j.v?.vv),
    brancos: n(j.v?.vb),
    nulos: n(j.v?.tvn),
    comparecimento: n(j.e?.c),
    eleitorado: n(j.e?.te),
    eleitoradoApurado: n(j.e?.est),
    secoes: n(j.s?.ts),
    secoesApuradas: n(j.s?.st),
    totalizacao: j.dt ? `${j.dt} ${j.ht}` : '',
    geracao: String(j.idg ?? ''),
  };
}

export function lerAndamento(j: Json): AndamentoTSE[] {
  return (j.abr ?? []).map((a: Json) => ({
    tipo: a.tpabr,
    abr: a.cdabr,
    secoes: n(a.s?.ts),
    secoesApuradas: n(a.s?.st),
    eleitorado: n(a.e?.te),
    eleitoradoApurado: n(a.e?.est),
    comparecimento: n(a.e?.c),
    totalizacao: a.dt ? `${a.dt} ${a.ht}` : '',
  }));
}

export interface MunicipioLista {
  uf: string;
  cd: string;
  nome: string;
  capital: boolean;
}

export function lerMunicipios(j: Json): MunicipioLista[] {
  const out: MunicipioLista[] = [];
  for (const uf of j.abr ?? []) {
    for (const m of uf.mu ?? []) out.push({ uf: uf.cd, cd: m.cd, nome: m.nm, capital: m.c === 's' });
  }
  return out;
}
