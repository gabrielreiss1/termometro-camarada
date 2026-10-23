// Baixa os resultados do 1º turno por município (uma vez) e monta public/dados/base-1t.json.
// Uso: npm run base            (baixa o que falta e monta)
//      npm run base -- --montar (só monta, com o que já foi baixado)
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  ELEICAO_1T, NUM_FLAVIO, NUM_LULA, lerAndamento, lerMunicipios, lerResultado, urlTSE,
} from '../src/engine/tse.ts';
import { CAMPOS_BASE, type MunicipioBase } from '../src/engine/tipos.ts';

const BRUTOS = 'dados-brutos/1t';
const SAIDA = 'public/dados/base-1t.json';
const REQ_POR_SEG = 10;
const CONCORRENCIA = 6;

const existe = (p: string) => access(p).then(() => true, () => false);

let ultimoInicio = 0;
async function esperarVez() {
  const intervalo = 1000 / REQ_POR_SEG;
  const agora = Date.now();
  const proximo = Math.max(agora, ultimoInicio + intervalo);
  ultimoInicio = proximo;
  if (proximo > agora) await new Promise((r) => setTimeout(r, proximo - agora));
}

async function baixar(url: string, destino: string): Promise<void> {
  if (await existe(destino)) return;
  for (let tentativa = 1; ; tentativa++) {
    await esperarVez();
    try {
      const resp = await fetch(url);
      if (resp.status === 403 || resp.status === 429) {
        console.warn(`\n${resp.status} em ${url}: pausando 11 min para não piorar um bloqueio`);
        await new Promise((r) => setTimeout(r, 11 * 60_000));
        continue;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const texto = await resp.text();
      JSON.parse(texto);
      await mkdir(dirname(destino), { recursive: true });
      await writeFile(destino, texto);
      return;
    } catch (e) {
      if (tentativa >= 4) throw new Error(`falhou ${url}: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * tentativa));
    }
  }
}

async function emParalelo<T>(itens: T[], fn: (item: T) => Promise<void>) {
  let i = 0;
  let feitos = 0;
  const inicio = Date.now();
  await Promise.all(
    Array.from({ length: CONCORRENCIA }, async () => {
      while (i < itens.length) {
        const item = itens[i++];
        await fn(item);
        feitos++;
        if (feitos % 200 === 0 || feitos === itens.length) {
          const s = (Date.now() - inicio) / 1000;
          process.stdout.write(`\r  ${feitos}/${itens.length} (${(feitos / s).toFixed(1)} req/s)   `);
        }
      }
    }),
  );
  process.stdout.write('\n');
}

const lerJson = async (p: string) => JSON.parse(await readFile(p, 'utf8'));

// Horário local da UF → minutos depois das 17h de Brasília no dia da eleição.
const FUSO_HORAS: Record<string, number> = { ac: 2, am: 1, mt: 1, ms: 1, ro: 1, rr: 1 };
function minutosApos17h(totalizacao: string, uf: string): number {
  const m = totalizacao.match(/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d):(\d\d)$/);
  if (!m) return -1;
  const [, dia, , , hh, mm] = m;
  const minutos = (Number(dia) - 4) * 24 * 60 + Number(hh) * 60 + Number(mm) + (FUSO_HORAS[uf] ?? 0) * 60;
  return minutos - 17 * 60;
}

async function main() {
  const soMontar = process.argv.includes('--montar');
  const arqMun = join(BRUTOS, 'municipios.json');
  await baixar(urlTSE.municipios(ELEICAO_1T), arqMun);
  const municipios = lerMunicipios(await lerJson(arqMun));
  const ufs = [...new Set(municipios.map((m) => m.uf))];
  console.log(`${municipios.length} municípios em ${ufs.length} UFs`);

  if (!soMontar) {
    console.log('Baixando andamento e resultado por UF...');
    await emParalelo(['br', ...ufs], async (abr) => {
      await baixar(urlTSE.andamento(ELEICAO_1T, abr), join(BRUTOS, 'ab', `${abr}.json`));
      await baixar(urlTSE.resultado(ELEICAO_1T, abr), join(BRUTOS, 'uf', `${abr}.json`));
    });
    console.log('Baixando resultado por município...');
    await emParalelo(municipios, (m) =>
      baixar(urlTSE.resultadoMunicipio(ELEICAO_1T, m.uf, m.cd), join(BRUTOS, 'mun', `${m.uf}${m.cd}.json`)),
    );
  }

  const fim = new Map<string, number>();
  for (const uf of ufs) {
    for (const a of lerAndamento(await lerJson(join(BRUTOS, 'ab', `${uf}.json`)))) {
      if (a.tipo === 'mun') fim.set(uf + a.abr, minutosApos17h(a.totalizacao, uf));
    }
  }

  const base: MunicipioBase[] = [];
  for (const m of municipios) {
    const r = lerResultado(await lerJson(join(BRUTOS, 'mun', `${m.uf}${m.cd}.json`)));
    const v = r.votos;
    const pega = (num: string) => v[num] ?? 0;
    const lula = pega(NUM_LULA);
    const flavio = pega(NUM_FLAVIO);
    const cury = pega('70');
    const renan = pega('14');
    const caiado = pega('55');
    const zema = pega('30');
    const demais = Object.values(v).reduce((s, x) => s + x, 0) - lula - flavio - cury - renan - caiado - zema;
    base.push({
      uf: m.uf, cd: m.cd,
      eleitorado: r.eleitorado, secoes: r.secoes, comparecimento: r.comparecimento,
      validos: r.validos, brancosNulos: r.brancos + r.nulos,
      lula, flavio, cury, renan, caiado, zema, demais,
      fim: fim.get(m.uf + m.cd) ?? -1,
    });
  }

  // Conferência com o total nacional publicado pelo TSE
  const br = lerResultado(await lerJson(join(BRUTOS, 'uf', 'br.json')));
  const soma = (f: (b: MunicipioBase) => number) => base.reduce((s, b) => s + f(b), 0);
  const checagens: [string, number, number][] = [
    ['Lula', soma((b) => b.lula), br.votos[NUM_LULA]],
    ['Flávio', soma((b) => b.flavio), br.votos[NUM_FLAVIO]],
    ['Válidos', soma((b) => b.validos), br.validos],
    ['Comparecimento', soma((b) => b.comparecimento), br.comparecimento],
    ['Eleitorado', soma((b) => b.eleitorado), br.eleitorado],
    ['Seções', soma((b) => b.secoes), br.secoes],
  ];
  let ok = true;
  for (const [nome, municipiosSoma, nacional] of checagens) {
    const bate = municipiosSoma === nacional;
    ok &&= bate;
    console.log(`${bate ? 'OK ' : 'ERRO'} ${nome.padEnd(15)} municípios ${municipiosSoma.toLocaleString('pt-BR')}  nacional ${nacional.toLocaleString('pt-BR')}`);
  }
  if (!ok) throw new Error('A soma dos municípios não bate com o total nacional.');
  const semHorario = base.filter((b) => b.fim < 0).length;
  if (semHorario) console.warn(`${semHorario} municípios sem horário de totalização`);

  await mkdir(dirname(SAIDA), { recursive: true });
  const linhas = base.map((b) => CAMPOS_BASE.map((c) => b[c]));
  await writeFile(SAIDA, JSON.stringify({ eleicao: ELEICAO_1T, campos: CAMPOS_BASE, linhas }));
  console.log(`Base gravada em ${SAIDA} (${base.length} municípios)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
