// O cálculo do termômetro: compara cada lugar apurado com o esperado para ele e projeta o que falta.
import { CANDIDATOS_OUTROS, type MunicipioBase } from './tipos.ts';
import { REGIAO_DA_UF, type Config, type Matriz, type Regiao } from './config.ts';
import { NUM_FLAVIO, NUM_LULA, type AndamentoTSE, type ResultadoTSE } from './tse.ts';

export interface MunicipioCalc extends MunicipioBase {
  /** fatia esperada do Lula entre os dois, já com o ajuste nacional */
  e: number;
  /** votos em Lula ou Flávio esperados por eleitor que comparece */
  r: number;
  /** comparecimento do 1º turno, em fração do eleitorado */
  t1: number;
  /** votos em Lula ou Flávio esperados no município */
  peso: number;
}

export interface BasePreparada {
  municipios: MunicipioCalc[];
  ufs: string[];
  porUf: Map<string, MunicipioCalc[]>;
  /** pontos somados à fatia de todas as cidades para o total nacional bater com o esperado configurado */
  ajuste: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function votosEsperados(m: MunicipioBase, matriz: Matriz) {
  let lula = m.lula;
  let flavio = m.flavio;
  for (const c of CANDIDATOS_OUTROS) {
    lula += matriz[c].lula * m[c];
    flavio += matriz[c].flavio * m[c];
  }
  return { lula, flavio };
}

export function prepararBase(base: MunicipioBase[], config: Config): BasePreparada {
  const municipios: MunicipioCalc[] = base.map((m) => {
    const { lula, flavio } = votosEsperados(m, config.matriz);
    const peso = lula + flavio;
    return {
      ...m,
      e: peso > 0 ? lula / peso : 0.5,
      r: m.comparecimento > 0 ? peso / m.comparecimento : 0,
      t1: m.eleitorado > 0 ? m.comparecimento / m.eleitorado : 0,
      peso,
    };
  });
  let somaPeso = 0;
  let somaLula = 0;
  for (const m of municipios) {
    somaPeso += m.peso;
    somaLula += m.e * m.peso;
  }
  const ajuste = config.esperadoNacionalLula - somaLula / somaPeso;
  for (const m of municipios) m.e = clamp01(m.e + ajuste);

  const porUf = new Map<string, MunicipioCalc[]>();
  for (const m of municipios) {
    if (!porUf.has(m.uf)) porUf.set(m.uf, []);
    porUf.get(m.uf)!.push(m);
  }
  return { municipios, ufs: [...porUf.keys()], porUf, ajuste };
}

export interface DadosUF {
  resultado: ResultadoTSE;
  /** andamento por código TSE do município */
  andamento: Map<string, AndamentoTSE>;
}

export interface Entrada {
  brasil: ResultadoTSE;
  ufs: Map<string, DadosUF>;
}

export interface ResultadoUF {
  uf: string;
  regiao: Regiao;
  pctSecoes: number;
  pctEleitorado: number;
  lula: number;
  flavio: number;
  /** fatia do Lula no que já foi apurado */
  observado: number | null;
  /** fatia esperada do Lula nos mesmos municípios apurados */
  esperado: number | null;
  delta: number | null;
  /** delta depois de puxado para a média nacional quando há pouca apuração */
  deltaAjustado: number;
  /** variação do comparecimento (pontos de fração) nos municípios quase todo apurados */
  dComparecimento: number | null;
  /** peso eleitoral: eleitores aptos */
  eleitorado: number;
  /** fatia projetada do Lula na UF */
  projecao: number;
}

export interface Resultado {
  pctSecoes: number;
  pctEleitorado: number;
  placar: { lula: number; flavio: number };
  observado: number | null;
  esperadoMesmoConjunto: number | null;
  delta: number | null;
  projecao: number;
  p10: number;
  p90: number;
  /** fração das simulações em que Lula passa de 50% (estimativa, não probabilidade oficial) */
  chance: number;
  decomposicao: { esperado: number; efeitoFatia: number; efeitoComparecimento: number; final: number };
  /** quanto acima (+) ou abaixo (−) do esperado Lula precisa ficar no que falta para terminar em 50% */
  precisa: number | null;
  comparecimento: {
    municipios: number;
    t1: number | null;
    t2: number | null;
    brancosNulos1: number | null;
    brancosNulos2: number | null;
    porRegiao: { regiao: Regiao; delta: number | null; municipios: number }[];
  };
  veredito: 'aguardando' | 'bom' | 'empate' | 'ruim';
  ufs: ResultadoUF[];
  totalizacao: string;
}

function rngSemente(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rnd: () => number) {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Média em dois níveis: cada UF é puxada para a média da sua região e cada região para a nacional,
 * tanto mais quanto menos dados (peso) ela tem. Valor NaN = UF sem dado.
 */
function encolher(valor: Float64Array, peso: Float64Array, k: number, regiaoDe: Regiao[]) {
  let nacNum = 0, nacDen = 0;
  const reg = new Map<Regiao, { num: number; den: number }>();
  for (let u = 0; u < valor.length; u++) {
    if (Number.isNaN(valor[u]) || peso[u] <= 0) continue;
    nacNum += peso[u] * valor[u];
    nacDen += peso[u];
    const x = reg.get(regiaoDe[u]) ?? { num: 0, den: 0 };
    x.num += peso[u] * valor[u];
    x.den += peso[u];
    reg.set(regiaoDe[u], x);
  }
  const nacional = nacDen > 0 ? nacNum / nacDen : 0;
  const daRegiao = (rg: Regiao) => {
    const x = reg.get(rg);
    if (!x || x.den <= 0) return nacional;
    const w = x.den / (x.den + k);
    return w * (x.num / x.den) + (1 - w) * nacional;
  };
  const ajustado = new Float64Array(valor.length);
  const pesoAj = new Float64Array(valor.length);
  for (let u = 0; u < valor.length; u++) {
    const tem = !Number.isNaN(valor[u]) && peso[u] > 0;
    const w = tem ? peso[u] / (peso[u] + k) : 0;
    pesoAj[u] = w;
    ajustado[u] = w * (tem ? valor[u] : 0) + (1 - w) * daRegiao(regiaoDe[u]);
  }
  return { ajustado, peso: pesoAj, nacional };
}

const percentil = (ordenado: number[], p: number) =>
  ordenado[Math.min(ordenado.length - 1, Math.max(0, Math.round(p * (ordenado.length - 1))))];

export function calcular(prep: BasePreparada, entrada: Entrada, config: Config): Resultado {
  const nUf = prep.ufs.length;
  const idxUf = new Map(prep.ufs.map((u, i) => [u, i]));

  // Contas por UF no que já foi apurado
  const lulaUf = new Float64Array(nUf);
  const flavioUf = new Float64Array(nUf);
  const esperadoNum = new Float64Array(nUf);
  const esperadoDen = new Float64Array(nUf);
  const qEsperadoNum = new Float64Array(nUf);
  const compUf = new Float64Array(nUf);
  const dtNum = new Float64Array(nUf);
  const dtDen = new Float64Array(nUf);
  const apuradoUf = new Float64Array(nUf);
  const eleitoradoUf = new Float64Array(nUf);

  // Restante, município a município, em vetores para as simulações
  const nMun = prep.municipios.length;
  const restante = new Float64Array(nMun);
  const eleit = new Float64Array(nMun);
  const comp2 = new Float64Array(nMun);
  const t1 = new Float64Array(nMun);
  const r = new Float64Array(nMun);
  const e = new Float64Array(nMun);
  const ufDe = new Int32Array(nMun);

  const comp = { mun: 0, te: 0, c1: 0, est: 0, c2: 0, bnNum: 0, bnDen: 0 };
  const regDt = new Map<Regiao, { num: number; den: number; mun: number }>();

  let i = 0;
  for (const uf of prep.ufs) {
    const u = idxUf.get(uf)!;
    const dados = entrada.ufs.get(uf);
    const regiao = REGIAO_DA_UF[uf];
    if (dados) {
      lulaUf[u] = dados.resultado.votos[NUM_LULA] ?? 0;
      flavioUf[u] = dados.resultado.votos[NUM_FLAVIO] ?? 0;
      compUf[u] = dados.resultado.comparecimento;
    }
    for (const m of prep.porUf.get(uf)!) {
      const a = dados?.andamento.get(m.cd);
      const est = a ? Math.min(a.eleitoradoApurado, m.eleitorado) : 0;
      eleitoradoUf[u] += m.eleitorado;
      apuradoUf[u] += est;
      if (a && a.secoesApuradas > 0) {
        const c2 = a.comparecimento;
        const w = c2 * m.r;
        esperadoNum[u] += m.e * w;
        esperadoDen[u] += w;
        qEsperadoNum[u] += m.r * c2;
        comp.bnNum += (m.comparecimento > 0 ? m.brancosNulos / m.comparecimento : 0) * c2;
        comp.bnDen += c2;
        if (a.secoes > 0 && a.secoesApuradas / a.secoes >= config.minApuradoComparecimento && est > 0) {
          const dt = c2 / est - m.t1;
          dtNum[u] += m.eleitorado * dt;
          dtDen[u] += m.eleitorado;
          comp.mun++;
          comp.te += m.eleitorado;
          comp.c1 += m.comparecimento;
          comp.est += est;
          comp.c2 += c2;
          const rg = regDt.get(regiao) ?? { num: 0, den: 0, mun: 0 };
          rg.num += m.eleitorado * dt;
          rg.den += m.eleitorado;
          rg.mun++;
          regDt.set(regiao, rg);
        }
      }
      restante[i] = Math.max(0, m.eleitorado - est);
      eleit[i] = m.eleitorado;
      comp2[i] = a && a.secoesApuradas > 0 ? a.comparecimento : 0;
      t1[i] = m.t1;
      r[i] = m.r;
      e[i] = m.e;
      ufDe[i] = u;
      i++;
    }
  }

  // Médias nacionais e ajuste por UF (puxado para a média nacional quando há pouca apuração)
  const delta = new Float64Array(nUf).fill(NaN);
  const dq = new Float64Array(nUf).fill(NaN);
  const dt = new Float64Array(nUf).fill(NaN);
  let nTot = 0, dNum = 0, eNum = 0;
  for (let u = 0; u < nUf; u++) {
    const n = lulaUf[u] + flavioUf[u];
    if (n > 0 && esperadoDen[u] > 0) {
      const esp = esperadoNum[u] / esperadoDen[u];
      delta[u] = lulaUf[u] / n - esp;
      nTot += n;
      dNum += n * delta[u];
      eNum += n * esp;
    }
    if (compUf[u] > 0 && esperadoDen[u] > 0) dq[u] = n / compUf[u] - qEsperadoNum[u] / compUf[u];
    if (dtDen[u] > 0) dt[u] = dtNum[u] / dtDen[u];
  }
  const deltaNac = nTot > 0 ? dNum / nTot : 0;

  // Com pouca apuração, a UF puxa para a média da sua região, e a região para a média nacional
  const regiaoDe = prep.ufs.map((uf) => REGIAO_DA_UF[uf]);
  const votosUf = Float64Array.from(lulaUf, (l, u) => l + flavioUf[u]);
  const { ajustado: deltaAj, peso: pesoUf } = encolher(delta, votosUf, config.k, regiaoDe);
  const { ajustado: dqAj } = encolher(dq, votosUf, config.k, regiaoDe);
  const { ajustado: dtAj } = encolher(dt, dtDen, config.kComparecimento, regiaoDe);

  const lulaProj = new Float64Array(nUf);
  const totalProj = new Float64Array(nUf);
  function projetar(dUf: ArrayLike<number>, tUf: ArrayLike<number> | null, qUf: ArrayLike<number> | null, porUf = false) {
    let L = 0, T = 0;
    if (porUf) {
      for (let u = 0; u < nUf; u++) {
        lulaProj[u] = lulaUf[u];
        totalProj[u] = lulaUf[u] + flavioUf[u];
      }
    }
    for (let u = 0; u < nUf; u++) {
      L += lulaUf[u];
      T += lulaUf[u] + flavioUf[u];
    }
    for (let j = 0; j < nMun; j++) {
      if (restante[j] === 0) continue;
      const u = ufDe[j];
      const t = clamp01(t1[j] + (tUf ? tUf[u] : 0));
      const q = clamp01(r[j] + (qUf ? qUf[u] : 0));
      const v = restante[j] * t * q;
      const s = clamp01(e[j] + dUf[u]);
      L += s * v;
      T += v;
      if (porUf) {
        lulaProj[u] += s * v;
        totalProj[u] += v;
      }
    }
    return T > 0 ? L / T : 0.5;
  }

  const final = projetar(deltaAj, dtAj, dqAj, true);

  // Efeito total do comparecimento (no já apurado e no que falta): a projeção, com as mesmas fatias,
  // comparada com o que seria se cada cidade tivesse o comparecimento do 1º turno.
  let lCf = 0, tCf = 0, lAt = 0, tAt = 0;
  for (let j = 0; j < nMun; j++) {
    const u = ufDe[j];
    const s = clamp01(e[j] + deltaAj[u]);
    const q = clamp01(r[j] + dqAj[u]);
    const vCf = eleit[j] * t1[j] * q;
    const vAt = (comp2[j] + restante[j] * clamp01(t1[j] + dtAj[u])) * q;
    lCf += s * vCf;
    tCf += vCf;
    lAt += s * vAt;
    tAt += vAt;
  }
  const efeitoComparecimento = tCf > 0 && tAt > 0 ? lAt / tAt - lCf / tCf : 0;

  // Faixa de incerteza: refaz a projeção com variações no ajuste nacional, por UF e no comparecimento
  const eleitoradoTotal = eleitoradoUf.reduce((s, x) => s + x, 0);
  const apuradoTotal = apuradoUf.reduce((s, x) => s + x, 0);
  const f = eleitoradoTotal > 0 ? apuradoTotal / eleitoradoTotal : 0;
  let disp = 0, dispPeso = 0, dispUfs = 0;
  for (let u = 0; u < nUf; u++) {
    const n = lulaUf[u] + flavioUf[u];
    if (!Number.isNaN(delta[u]) && n > 20_000) {
      disp += n * (delta[u] - deltaNac) ** 2;
      dispPeso += n;
      dispUfs++;
    }
  }
  const tau = dispUfs >= 4 ? Math.min(0.04, Math.max(0.01, Math.sqrt(disp / dispPeso))) : 0.02;
  const sigmaComum = 0.004 + 0.012 * (1 - f);
  const sigmaComp = 0.01 * (1 - f);
  const sigmaUf = Array.from(pesoUf, (w, u) =>
    tau * Math.sqrt(1 - w) + 0.01 * (1 - (eleitoradoUf[u] > 0 ? apuradoUf[u] / eleitoradoUf[u] : 0)),
  );
  const rnd = rngSemente(20261025);
  const sims: number[] = [];
  const dSim = new Float64Array(nUf);
  const tSim = new Float64Array(nUf);
  for (let s = 0; s < config.simulacoes; s++) {
    const z = normal(rnd) * sigmaComum;
    const zt = normal(rnd) * sigmaComp;
    for (let u = 0; u < nUf; u++) {
      dSim[u] = deltaAj[u] + z + normal(rnd) * sigmaUf[u];
      tSim[u] = dtAj[u] + zt;
    }
    sims.push(projetar(dSim, tSim, dqAj));
  }
  sims.sort((a, b) => a - b);
  const p10 = percentil(sims, 0.1);
  const p90 = percentil(sims, 0.9);
  const chance = sims.filter((x) => x > 0.5).length / sims.length;

  // "Precisa de": desvio igual em todo o restante que leva a projeção a 50%
  let precisa: number | null = null;
  const restanteTotal = restante.reduce((s, x) => s + x, 0);
  if (restanteTotal > 0.005 * eleitoradoTotal) {
    const uniforme = new Float64Array(nUf);
    const proj = (x: number) => projetar(uniforme.fill(x), dtAj, dqAj);
    let lo = -0.5, hi = 0.5;
    if (proj(lo) <= 0.5 && proj(hi) >= 0.5) {
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        if (proj(mid) < 0.5) lo = mid;
        else hi = mid;
      }
      precisa = (lo + hi) / 2;
    }
  }

  const ufs: ResultadoUF[] = prep.ufs.map((uf, u) => {
    const n = lulaUf[u] + flavioUf[u];
    const dados = entrada.ufs.get(uf);
    return {
      uf,
      regiao: REGIAO_DA_UF[uf],
      pctSecoes: dados && dados.resultado.secoes > 0 ? dados.resultado.secoesApuradas / dados.resultado.secoes : 0,
      pctEleitorado: eleitoradoUf[u] > 0 ? apuradoUf[u] / eleitoradoUf[u] : 0,
      lula: lulaUf[u],
      flavio: flavioUf[u],
      observado: n > 0 ? lulaUf[u] / n : null,
      esperado: esperadoDen[u] > 0 ? esperadoNum[u] / esperadoDen[u] : null,
      delta: Number.isNaN(delta[u]) ? null : delta[u],
      deltaAjustado: deltaAj[u],
      dComparecimento: Number.isNaN(dt[u]) ? null : dt[u],
      eleitorado: eleitoradoUf[u],
      projecao: totalProj[u] > 0 ? lulaProj[u] / totalProj[u] : 0.5,
    };
  });

  const br = entrada.brasil;
  const placarLula = br.votos[NUM_LULA] ?? 0;
  const placarFlavio = br.votos[NUM_FLAVIO] ?? 0;
  const veredito: Resultado['veredito'] =
    f < config.minApuradoVeredito ? 'aguardando' : p10 > 0.5 ? 'bom' : p90 < 0.5 ? 'ruim' : 'empate';
  const regioes: Regiao[] = ['N', 'NE', 'CO', 'SE', 'S', 'EX'];

  return {
    pctSecoes: br.secoes > 0 ? br.secoesApuradas / br.secoes : 0,
    pctEleitorado: f,
    placar: { lula: placarLula, flavio: placarFlavio },
    observado: nTot > 0 ? (dNum + eNum) / nTot : null,
    esperadoMesmoConjunto: nTot > 0 ? eNum / nTot : null,
    delta: nTot > 0 ? deltaNac : null,
    projecao: final,
    p10,
    p90,
    chance,
    decomposicao: {
      esperado: config.esperadoNacionalLula,
      efeitoFatia: final - config.esperadoNacionalLula - efeitoComparecimento,
      efeitoComparecimento,
      final,
    },
    precisa,
    comparecimento: {
      municipios: comp.mun,
      t1: comp.te > 0 ? comp.c1 / comp.te : null,
      t2: comp.est > 0 ? comp.c2 / comp.est : null,
      brancosNulos1: comp.bnDen > 0 ? comp.bnNum / comp.bnDen : null,
      brancosNulos2: br.comparecimento > 0 ? (br.brancos + br.nulos) / br.comparecimento : null,
      porRegiao: regioes.map((rg) => {
        const x = regDt.get(rg);
        return { regiao: rg, delta: x && x.den > 0 ? x.num / x.den : null, municipios: x?.mun ?? 0 };
      }),
    },
    veredito,
    ufs,
    totalizacao: br.totalizacao,
  };
}

/** 3º colocado do 1º turno em cada UF (entre os candidatos derrotados) */
export function terceiroColocado(prep: BasePreparada) {
  const out = new Map<string, { candidato: (typeof CANDIDATOS_OUTROS)[number]; pct: number }>();
  for (const [uf, ms] of prep.porUf) {
    let melhor = { candidato: CANDIDATOS_OUTROS[0], pct: -1 };
    const validos = ms.reduce((s, m) => s + m.validos, 0);
    for (const c of CANDIDATOS_OUTROS) {
      if (c === 'demais') continue;
      const v = ms.reduce((s, m) => s + m[c], 0) / validos;
      if (v > melhor.pct) melhor = { candidato: c, pct: v };
    }
    out.set(uf, melhor);
  }
  return out;
}
