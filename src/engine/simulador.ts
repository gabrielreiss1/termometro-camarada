// Apuração simulada para testes: cria um 2º turno "verdadeiro" a partir do 1º turno e libera os
// municípios na ordem em que terminaram de apurar no 1º turno.
import { REGIAO_DA_UF, type Matriz, type Regiao } from './config.ts';
import { votosEsperados, type BasePreparada, type DadosUF, type Entrada } from './motor.ts';
import { NUM_FLAVIO, NUM_LULA, type AndamentoTSE, type ResultadoTSE } from './tse.ts';

export interface Cenario {
  nome: string;
  descricao: string;
  /** matriz verdadeira; sem ela, usa a da configuração */
  matriz?: Matriz;
  /** pontos (fração) somados à fatia do Lula em todo lugar, além do ajuste nacional */
  choque?: number;
  choqueRegiao?: Partial<Record<Regiao, number>>;
  dComparecimento?: Partial<Record<Regiao, number>>;
  /** quanto as primeiras seções de cada município puxam para o Flávio (some quando o município termina) */
  viesInicio?: number;
  /** repete Lula e Flávio do 1º turno, sem transferência (para comparar com a curva real do 1º turno) */
  repetir1t?: boolean;
  /** município começa a aparecer nesta fração do seu horário de término (cidades lentas começam mais tarde) */
  inicioRelativo?: number;
}

interface Verdade {
  lula: Float64Array;
  flavio: Float64Array;
  comparecimento: Float64Array;
  fim: Float64Array;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function verdade(prep: BasePreparada, cen: Cenario, matrizPadrao: Matriz): Verdade {
  const n = prep.municipios.length;
  const v: Verdade = {
    lula: new Float64Array(n),
    flavio: new Float64Array(n),
    comparecimento: new Float64Array(n),
    fim: new Float64Array(n),
  };
  prep.municipios.forEach((m, i) => {
    v.fim[i] = m.fim > 5 ? m.fim : 60;
    if (cen.repetir1t) {
      v.lula[i] = m.lula;
      v.flavio[i] = m.flavio;
      v.comparecimento[i] = m.comparecimento;
      return;
    }
    const reg = REGIAO_DA_UF[m.uf];
    const { lula, flavio } = votosEsperados(m, cen.matriz ?? matrizPadrao);
    const fatia0 = lula + flavio > 0 ? lula / (lula + flavio) : 0.5;
    const s = clamp01(fatia0 + prep.ajuste + (cen.choque ?? 0) + (cen.choqueRegiao?.[reg] ?? 0));
    const t2 = clamp01(m.t1 + (cen.dComparecimento?.[reg] ?? 0));
    const c2 = m.eleitorado * t2;
    const validos = m.comparecimento > 0 ? (c2 * (lula + flavio)) / m.comparecimento : 0;
    v.lula[i] = s * validos;
    v.flavio[i] = (1 - s) * validos;
    v.comparecimento[i] = c2;
  });
  return v;
}

export interface Simulacao {
  /** estado da apuração a tantos minutos depois das 17h */
  em(minutos: number): Entrada;
  /** fatia final verdadeira do Lula */
  resultadoFinal: number;
}

export function criarSimulacao(prep: BasePreparada, cen: Cenario, matrizPadrao: Matriz): Simulacao {
  const v = verdade(prep, cen, matrizPadrao);
  // Padrões calibrados para o placar simulado se parecer com a evolução real do 1º turno
  const vies = cen.viesInicio ?? 0.01;
  const alfa = cen.inicioRelativo ?? 0.15;
  let somaL = 0, somaT = 0;
  for (let i = 0; i < v.lula.length; i++) {
    somaL += v.lula[i];
    somaT += v.lula[i] + v.flavio[i];
  }

  function em(minutos: number): Entrada {
    const ufs = new Map<string, DadosUF>();
    const brasil = vazio('br');
    let i = 0;
    for (const uf of prep.ufs) {
      const res = vazio(uf);
      const andamento = new Map<string, AndamentoTSE>();
      for (const m of prep.porUf.get(uf)!) {
        const inicio = alfa * v.fim[i];
        const p = Math.pow(clamp01((minutos - inicio) / (v.fim[i] - inicio)), 0.8);
        const st = Math.round(m.secoes * p);
        const f = m.secoes > 0 ? st / m.secoes : 0;
        const validos = (v.lula[i] + v.flavio[i]) * f;
        const fatia = clamp01(v.lula[i] / (v.lula[i] + v.flavio[i] || 1) - vies * (1 - f));
        const lula = Math.round(validos * fatia);
        const flavio = Math.round(validos) - lula;
        const comparecimento = Math.round(v.comparecimento[i] * f);
        const est = Math.round(m.eleitorado * f);
        andamento.set(m.cd, {
          tipo: 'mun', abr: m.cd, secoes: m.secoes, secoesApuradas: st,
          eleitorado: m.eleitorado, eleitoradoApurado: est, comparecimento, totalizacao: '',
        });
        for (const r of [res, brasil]) {
          r.votos[NUM_LULA] += lula;
          r.votos[NUM_FLAVIO] += flavio;
          r.validos += lula + flavio;
          r.nulos += Math.max(0, comparecimento - lula - flavio);
          r.comparecimento += comparecimento;
          r.eleitorado += m.eleitorado;
          r.eleitoradoApurado += est;
          r.secoes += m.secoes;
          r.secoesApuradas += st;
        }
        i++;
      }
      ufs.set(uf, { resultado: res, andamento });
    }
    return { brasil, ufs };
  }

  return { em, resultadoFinal: somaL / somaT };
}

function vazio(abr: string): ResultadoTSE {
  return {
    abr, votos: { [NUM_LULA]: 0, [NUM_FLAVIO]: 0 }, validos: 0, brancos: 0, nulos: 0, comparecimento: 0,
    eleitorado: 0, eleitoradoApurado: 0, secoes: 0, secoesApuradas: 0, totalizacao: '', geracao: '',
  };
}

export const CENARIOS: Cenario[] = [
  { nome: 'igual', descricao: 'Ninguém muda: o resultado é exatamente o esperado (Δ deve ficar perto de 0)' },
  { nome: 'mais2', descricao: 'Lula +2 pontos em todo lugar', choque: 0.02 },
  { nome: 'menos2', descricao: 'Lula −2 pontos em todo lugar', choque: -0.02 },
  {
    nome: 'regional', descricao: 'Lula +3 no Nordeste, −2 no Sul, −1 no Sudeste',
    choqueRegiao: { NE: 0.03, S: -0.02, SE: -0.01 },
  },
  {
    nome: 'matriz-errada', descricao: 'Transferência real diferente da suposta (PoderData 16–18/10)',
    matriz: {
      cury: { flavio: 0.56, lula: 0.31 }, renan: { flavio: 0.36, lula: 0.29 },
      caiado: { flavio: 0.46, lula: 0.19 }, zema: { flavio: 0.36, lula: 0.31 }, demais: { flavio: 0.36, lula: 0.31 },
    },
  },
  {
    nome: 'comparecimento', descricao: 'Comparecimento cai 3 pontos no Nordeste e sobe 1 no Sul',
    dComparecimento: { NE: -0.03, S: 0.01 },
  },
  { nome: 'vies', descricao: 'Primeiras seções de cada cidade puxam 3 pontos para o Flávio', viesInicio: 0.03 },
  { nome: 'curva-1t', descricao: 'Repete o 1º turno (para comparar com a curva real)', repetir1t: true },
];
