// Roda o motor contra apurações simuladas e mede o erro da projeção.
// Uso: npm run replay:testar [-- nome-do-cenario] [-- --vies 0.02]
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/engine/config.ts';
import { calcular, prepararBase } from '../src/engine/motor.ts';
import { CENARIOS, criarSimulacao } from '../src/engine/simulador.ts';
import { lerBase } from '../src/engine/tipos.ts';

// Evolução real do 1º turno (% seções → Flávio / Lula, % dos válidos), da especificação
const CURVA_1T: [number, number, number][] = [
  [1.5, 49.2, 42.2], [6.0, 50.51, 40.97], [7.6, 50.7, 41.0], [10.08, 50.96, 40.78], [22, 51.1, 40.8],
  [36.6, 50.63, 41.23], [41, 50.41, 41.44], [64.81, 49.58, 42.25], [85, 48.5, 43.5], [88, 48.2, 43.8],
  [90.61, 48.02, 44.01], [93, 47.8, 44.2], [99, 47.2, 44.9], [99.7, 47.1, 45.1], [100, 47.03, 45.16],
];
function curva1t(pct: number) {
  const pts = CURVA_1T.map(([p, f, l]) => [p, l / (l + f)] as const);
  if (pct <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (pct <= pts[i][0]) {
      const [p0, v0] = pts[i - 1];
      const [p1, v1] = pts[i];
      return v0 + ((v1 - v0) * (pct - p0)) / (p1 - p0);
    }
  }
  return pts[pts.length - 1][1];
}

const pc = (x: number | null, d = 1) => (x === null ? '  -  ' : (100 * x).toFixed(d));
const pt = (x: number | null) => (x === null ? '  -  ' : `${x >= 0 ? '+' : ''}${(100 * x).toFixed(2)}`);

async function main() {
  const args = process.argv.slice(2);
  const opcao = (nome: string) => {
    const i = args.indexOf(nome);
    return i >= 0 ? Number(args[i + 1]) : undefined;
  };
  const viesExtra = opcao('--vies');
  const inicioExtra = opcao('--inicio');
  const filtro = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  const base = lerBase(JSON.parse(await readFile('public/dados/base-1t.json', 'utf8')));
  const prep = prepararBase(base, CONFIG);
  console.log(`Ajuste nacional para o esperado dar ${pc(CONFIG.esperadoNacionalLula)}%: ${pt(prep.ajuste)} pt\n`);

  const minutos = [5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240, 360];
  const resumo: string[] = [];
  for (const cen0 of CENARIOS) {
    if (filtro.length && !filtro.includes(cen0.nome)) continue;
    const cen = { ...cen0 };
    if (viesExtra !== undefined && cen0.viesInicio === undefined) cen.viesInicio = viesExtra;
    if (inicioExtra !== undefined) cen.inicioRelativo = inicioExtra;
    const sim = criarSimulacao(prep, cen, CONFIG.matriz);
    console.log(`== ${cen.nome}: ${cen.descricao} | resultado verdadeiro ${pc(sim.resultadoFinal, 2)}%`);
    console.log(' min  seções  placar  esperado-mesmo  Δ       projeção (p10–p90)      erro    chance  veredito' + (cen.repetir1t ? '  curva-1T-real' : ''));
    let dentro = 0, passos = 0;
    const erros: number[] = [];
    for (const min of minutos) {
      const ent = sim.em(min);
      const r = calcular(prep, ent, CONFIG);
      const placar = r.placar.lula / (r.placar.lula + r.placar.flavio || 1);
      const erro = r.projecao - sim.resultadoFinal;
      if (r.pctEleitorado > 0.01 && r.pctEleitorado < 0.99) {
        passos++;
        if (sim.resultadoFinal >= r.p10 && sim.resultadoFinal <= r.p90) dentro++;
        erros.push(Math.abs(erro));
      }
      console.log(
        `${String(min).padStart(4)}  ${pc(r.pctSecoes).padStart(5)}%  ${pc(placar).padStart(5)}  ${pc(r.esperadoMesmoConjunto).padStart(8)}       ${pt(r.delta).padStart(6)}  ${pc(r.projecao, 2)} (${pc(r.p10, 2)}–${pc(r.p90, 2)})  ${pt(erro).padStart(6)}  ${(100 * r.chance).toFixed(0).padStart(4)}%  ${r.veredito}  comp ${pt(r.decomposicao.efeitoComparecimento)}` +
          (cen.repetir1t ? `  ${pc(curva1t(100 * r.pctSecoes))}` : ''),
      );
    }
    const media = erros.reduce((s, x) => s + x, 0) / (erros.length || 1);
    const linha = `${cen.nome.padEnd(15)} erro médio ${(100 * media).toFixed(2)} pt | verdade dentro da faixa 10–90 em ${dentro}/${passos}`;
    resumo.push(linha);
    console.log(linha + '\n');
  }
  console.log('Resumo\n' + resumo.join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
