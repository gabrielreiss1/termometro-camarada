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

interface LinhaProjecao {
  nome: string;
  /** sufixo das classes de cor ('' = azul do site) */
  cor: string;
  v: (p: Ponto) => number;
  lo: (p: Ponto) => number;
  hi: (p: Ponto) => number;
}

const SO_LULA: LinhaProjecao[] = [{ nome: 'Lula', cor: '', v: (p) => p.projecao, lo: (p) => p.p10, hi: (p) => p.p90 }];
// Na versão neutra, as duas projeções: a do Flávio é o espelho da do Lula em torno dos 50%
const OS_DOIS: LinhaProjecao[] = [
  { nome: 'Lula', cor: '-lula', v: (p) => p.projecao, lo: (p) => p.p10, hi: (p) => p.p90 },
  { nome: 'Flávio', cor: '-flavio', v: (p) => 1 - p.projecao, lo: (p) => 1 - p.p90, hi: (p) => 1 - p.p10 },
];

/**
 * A projeção final (do Lula, ou dos dois com `dupla`), com a faixa provável, a cada atualização, e um
 * pontilhado que leva a projeção de agora até 100% apurado. Tocar ou passar o mouse mostra cada momento.
 */
export function GraficoProjecao({ serie: todos, dupla = false }: { serie: Ponto[]; dupla?: boolean }) {
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const serie = todos.filter((p) => p.pct >= MIN_APURADO);
  if (serie.length < 2) {
    return <p className="nota">{AVISO_SEM_DADOS}</p>;
  }
  const linhas = dupla ? OS_DOIS : SO_LULA;
  const ultimo = serie.length - 1;
  const x = (v: number) => M.l + v * (W - M.l - M.r);
  const escala = escalaY(serie.flatMap((p) => linhas.flatMap((l) => [l.v(p), l.lo(p), l.hi(p)])));
  const { y } = escala;
  const caminho = (f: (p: Ponto) => number) => serie.map((p, k) => `${k ? 'L' : 'M'}${x(p.pct).toFixed(1)},${y(f(p)).toFixed(1)}`).join('');
  const faixa = (l: LinhaProjecao) =>
    caminho(l.hi) + [...serie].reverse().map((p) => `L${x(p.pct).toFixed(1)},${y(l.lo(p)).toFixed(1)}`).join('') + 'Z';

  const i = escolhido === null ? ultimo : Math.min(escolhido, ultimo);
  const ponto = serie[i];
  const fim = serie[ultimo];
  const fimX = x(fim.pct);
  // Rótulos do fim: quem está na frente fica acima da própria linha, o outro abaixo
  const rotuloY = (l: LinhaProjecao) => {
    const ly = y(l.v(fim));
    const acima = linhas.length === 1 ? ly - 10 >= M.t + 10 : l.v(fim) >= 0.5;
    return acima ? ly - 8 : ly + 18;
  };

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

  const descricao = dupla
    ? `Projeção com ${pct(fim.pct)} apurado: Lula ${pct(fim.projecao)} e Flávio ${pct(1 - fim.projecao)}. Um pontilhado leva esses valores até 100% apurado. Use as setas para ver cada momento.`
    : `Projeção do Lula: ${pct(serie[0].projecao)} com ${pct(serie[0].pct)} apurado e ${pct(fim.projecao)} com ${pct(fim.pct)} apurado, provável entre ${pct(fim.p10)} e ${pct(fim.p90)}. Um pontilhado leva esse valor até 100% apurado. Use as setas para ver cada momento.`;

  return (
    <figure className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0} className="grafico-interativo" aria-label={descricao}
        onPointerDown={escolher} onPointerMove={escolher} onPointerLeave={() => setEscolhido(null)}
        onKeyDown={teclas} onBlur={() => setEscolhido(null)}>
        <GradeY {...escala} />
        <MarcasX x={x} marcas={[0, 0.25, 0.5, 0.75, 1]} />
        <line x1={M.l} x2={W - M.r} y1={y(0.5)} y2={y(0.5)} className="linha-50" />
        {linhas.map((l) => <path key={`f${l.nome}`} d={faixa(l)} className={`faixa${l.cor}`} />)}
        {linhas.map((l) => (
          <g key={l.nome}>
            <path d={caminho(l.v)} className={`l-projecao-cheia${l.cor}`} />
            <line x1={fimX} x2={x(1)} y1={y(l.v(fim))} y2={y(l.v(fim))} className={`l-projecao-guia${l.cor}`} />
          </g>
        ))}
        {escolhido !== null && <line x1={x(ponto.pct)} x2={x(ponto.pct)} y1={M.t} y2={H - M.b} className="mira" />}
        {linhas.map((l) => (
          <g key={`p${l.nome}`}>
            {escolhido !== null && <circle cx={x(ponto.pct)} cy={y(l.v(ponto))} r="4" className={`pt-projecao${l.cor} anel`} />}
            <circle cx={fimX} cy={y(l.v(fim))} r="4" className={`pt-projecao${l.cor} anel`} />
            <text x={x(1)} y={rotuloY(l)} className="rotulo-fim" textAnchor="end">
              {dupla ? `${l.nome} ${pct(l.v(fim))}` : pct(l.v(fim))}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="leitura">
        {dupla ? (
          <span>
            Com {pct(ponto.pct)} apurado: Lula <strong>{pct(ponto.projecao)}</strong> · Flávio <strong>{pct(1 - ponto.projecao)}</strong>
          </span>
        ) : (
          <span>
            Com {pct(ponto.pct)} apurado: <strong>{pct(ponto.projecao)}</strong> (provável entre {pct(ponto.p10)} e {pct(ponto.p90)})
          </span>
        )}
        <span className="eixo-x">
          Eixo de baixo: seções apuradas. O pontilhado {dupla ? '' : 'azul '}leva a projeção de agora até 100%. Toque no gráfico para ver cada momento.
        </span>
      </figcaption>
    </figure>
  );
}
