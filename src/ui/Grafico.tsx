import type { Ponto } from '../fonte.ts';
import { pct } from '../formato.ts';

const W = 340;
const H = 210;
const M = { l: 36, r: 10, t: 10, b: 28 };

export function Grafico({ serie: todos }: { serie: Ponto[] }) {
  // Com quase nada apurado, a fatia oscila demais e só achata o resto do gráfico
  const serie = todos.filter((p) => p.pct >= 0.005);
  if (serie.length < 2) {
    return <p className="nota">O gráfico aparece a partir das primeiras atualizações da apuração.</p>;
  }
  const valores = serie.flatMap((p) => [p.observado, p.esperado, p.p10, p.p90]).concat(0.5);
  let lo = Math.floor((Math.min(...valores) - 0.005) * 50) / 50;
  let hi = Math.ceil((Math.max(...valores) + 0.005) * 50) / 50;
  if (hi - lo < 0.06) {
    const meio = (hi + lo) / 2;
    lo = meio - 0.03;
    hi = meio + 0.03;
  }
  const passo = hi - lo > 0.2 ? 0.05 : 0.02;
  const x = (v: number) => M.l + v * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);
  const linha = (f: (p: Ponto) => number) => serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(f(p)).toFixed(1)}`).join('');
  const faixa =
    serie.map((p, i) => `${i ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(p.p90).toFixed(1)}`).join('') +
    [...serie].reverse().map((p) => `L${x(p.pct).toFixed(1)},${y(p.p10).toFixed(1)}`).join('') + 'Z';
  const marcas: number[] = [];
  for (let v = Math.ceil(lo / passo) * passo; v <= hi + 1e-9; v += passo) marcas.push(v);
  const ultimo = serie[serie.length - 1];

  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Com ${pct(ultimo.pct)} apurado, Lula tem ${pct(ultimo.observado)} no apurado, o esperado nos mesmos lugares era ${pct(ultimo.esperado)} e a projeção é ${pct(ultimo.projecao)}.`}>
        {marcas.map((v) => (
          <g key={v.toFixed(3)}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="grade" />
            <text x={M.l - 6} y={y(v) + 4} className="eixo" textAnchor="end">{Math.round(v * 100)}%</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={x(v)} y={H - 10} className="eixo" textAnchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}>
            {Math.round(v * 100)}%
          </text>
        ))}
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
