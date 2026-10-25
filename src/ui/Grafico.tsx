import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { Ponto } from '../fonte.ts';
import { pct } from '../formato.ts';

const W = 340;
const H = 210;
const M = { l: 36, r: 10, t: 10, b: 28 };

// Com quase nada apurado, a fatia oscila demais e só achata o resto do gráfico
const MIN_APURADO = 0.005;
const AVISO_SEM_DADOS = 'O gráfico aparece a partir das primeiras atualizações da apuração.';

/** Eixo vertical com marcas redondas, sempre incluindo os 50% e com pelo menos 6 pontos de altura. */
function escalaY(valores: number[]) {
  let lo = Math.floor((Math.min(...valores, 0.5) - 0.005) * 50) / 50;
  let hi = Math.ceil((Math.max(...valores, 0.5) + 0.005) * 50) / 50;
  if (hi - lo < 0.06) {
    const meio = (hi + lo) / 2;
    lo = meio - 0.03;
    hi = meio + 0.03;
  }
  const passo = hi - lo > 0.2 ? 0.05 : 0.02;
  const marcas: number[] = [];
  for (let v = Math.ceil(lo / passo) * passo; v <= hi + 1e-9; v += passo) marcas.push(v);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  return { y, marcas };
}

function GradeY({ y, marcas }: ReturnType<typeof escalaY>) {
  return (
    <>
      {marcas.map((v) => (
        <g key={v.toFixed(3)}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="grade" />
          <text x={M.l - 6} y={y(v) + 4} className="eixo" textAnchor="end">{Math.round(v * 100)}%</text>
        </g>
      ))}
    </>
  );
}

function MarcasX({ x, marcas }: { x: (v: number) => number; marcas: number[] }) {
  return (
    <>
      {marcas.map((v, i) => (
        <text key={v.toFixed(3)} x={x(v)} y={H - 10} className="eixo"
          textAnchor={i === 0 ? 'start' : i === marcas.length - 1 ? 'end' : 'middle'}>
          {Math.round(v * 100)}%
        </text>
      ))}
    </>
  );
}

export function Grafico({ serie: todos }: { serie: Ponto[] }) {
  const serie = todos.filter((p) => p.pct >= MIN_APURADO);
  if (serie.length < 2) {
    return <p className="nota">{AVISO_SEM_DADOS}</p>;
  }
  const escala = escalaY(serie.flatMap((p) => [p.observado, p.esperado, p.p10, p.p90]));
  const { y } = escala;
  const x = (v: number) => M.l + v * (W - M.l - M.r);
  const linha = (f: (p: Ponto) => number) => serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(f(p)).toFixed(1)}`).join('');
  const faixa =
    serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(p.p90).toFixed(1)}`).join('') +
    [...serie].reverse().map((p) => `L${x(p.pct).toFixed(1)},${y(p.p10).toFixed(1)}`).join('') + 'Z';
  const ultimo = serie[serie.length - 1];

  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Com ${pct(ultimo.pct)} apurado, Lula tem ${pct(ultimo.observado)} no apurado, o esperado nos mesmos lugares era ${pct(ultimo.esperado)} e a projeção é ${pct(ultimo.projecao)}.`}>
        <GradeY {...escala} />
        <MarcasX x={x} marcas={[0, 0.25, 0.5, 0.75, 1]} />
        <line x1={M.l} x2={W - M.r} y1={y(0.5)} y2={y(0.5)} className="linha-50" />
        <path d={faixa} className="faixa" />
        <path d={linha((p) => p.esperado)} className="l-esperado" />
        <path d={linha((p) => p.observado)} className="l-observado" />
        <path d={linha((p) => p.projecao)} className="l-projecao" />
        <circle cx={x(ultimo.pct)} cy={y(ultimo.observado)} r="3.5" className="pt-observado" />
        <circle cx={x(ultimo.pct)} cy={y(ultimo.projecao)} r="3.5" className="pt-projecao" />
      </svg>
      <figcaption>
        <span className="leg"><i className="leg-observado" />Lula no apurado</span>
        <span className="leg"><i className="leg-esperado" />Previsto nos mesmos lugares</span>
        <span className="leg"><i className="leg-projecao" />Projeção final</span>
        <span className="eixo-x">Eixo de baixo: seções apuradas</span>
      </figcaption>
    </figure>
  );
}

/**
 * Só a projeção final do Lula, com a faixa provável, a cada atualização, e um pontilhado que leva a
 * projeção de agora até 100% apurado. Tocar ou passar o mouse mostra cada momento.
 */
export function GraficoProjecao({ serie: todos }: { serie: Ponto[] }) {
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const serie = todos.filter((p) => p.pct >= MIN_APURADO);
  if (serie.length < 2) {
    return <p className="nota">{AVISO_SEM_DADOS}</p>;
  }
  const ultimo = serie.length - 1;
  const x = (v: number) => M.l + v * (W - M.l - M.r);
  const escala = escalaY(serie.flatMap((p) => [p.projecao, p.p10, p.p90]));
  const { y } = escala;
  const linha = serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(p.projecao).toFixed(1)}`).join('');
  const faixa =
    serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(p.p90).toFixed(1)}`).join('') +
    [...serie].reverse().map((p) => `L${x(p.pct).toFixed(1)},${y(p.p10).toFixed(1)}`).join('') + 'Z';

  const i = escolhido === null ? ultimo : Math.min(escolhido, ultimo);
  const ponto = serie[i];
  const fim = serie[ultimo];
  const fimX = x(fim.pct);
  const fimY = y(fim.projecao);

  const escolher = (e: PointerEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    if (caixa.width <= 0) return;
    const alvo = ((e.clientX - caixa.left) / caixa.width) * W;
    let melhor = 0;
    for (let k = 1; k < serie.length; k++) {
      if (Math.abs(x(serie[k].pct) - alvo) < Math.abs(x(serie[melhor].pct) - alvo)) melhor = k;
    }
    setEscolhido(melhor);
  };
  const teclas = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') setEscolhido(Math.max(0, i - 1));
    else if (e.key === 'ArrowRight') setEscolhido(Math.min(ultimo, i + 1));
    else if (e.key === 'Escape') setEscolhido(null);
    else return;
    e.preventDefault();
  };

  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} className="grafico-interativo"
        aria-label={`Projeção do Lula: ${pct(serie[0].projecao)} com ${pct(serie[0].pct)} apurado e ${pct(fim.projecao)} com ${pct(fim.pct)} apurado, provável entre ${pct(fim.p10)} e ${pct(fim.p90)}. Um pontilhado leva esse valor até 100% apurado. Use as setas para ver cada momento.`}
        onPointerDown={escolher} onPointerMove={escolher} onPointerLeave={() => setEscolhido(null)}
        onKeyDown={teclas} onBlur={() => setEscolhido(null)}>
        <GradeY {...escala} />
        <MarcasX x={x} marcas={[0, 0.25, 0.5, 0.75, 1]} />
        <line x1={M.l} x2={W - M.r} y1={y(0.5)} y2={y(0.5)} className="linha-50" />
        <path d={faixa} className="faixa" />
        <path d={linha} className="l-projecao-cheia" />
        <line x1={fimX} x2={x(1)} y1={fimY} y2={fimY} className="l-projecao-guia" />
        {escolhido !== null && (
          <>
            <line x1={x(ponto.pct)} x2={x(ponto.pct)} y1={M.t} y2={H - M.b} className="mira" />
            <circle cx={x(ponto.pct)} cy={y(ponto.projecao)} r="4" className="pt-projecao anel" />
          </>
        )}
        <circle cx={fimX} cy={fimY} r="4" className="pt-projecao anel" />
        <text x={x(1)} y={fimY - 10 < M.t + 10 ? fimY + 18 : fimY - 8} className="rotulo-fim" textAnchor="end">
          {pct(fim.projecao)}
        </text>
      </svg>
      <figcaption className="leitura">
        <span>
          Com {pct(ponto.pct)} apurado: <strong>{pct(ponto.projecao)}</strong> (provável entre {pct(ponto.p10)} e {pct(ponto.p90)})
        </span>
        <span className="eixo-x">Eixo de baixo: seções apuradas. O pontilhado azul leva a projeção de agora até 100%. Toque no gráfico para ver cada momento.</span>
      </figcaption>
    </figure>
  );
}
