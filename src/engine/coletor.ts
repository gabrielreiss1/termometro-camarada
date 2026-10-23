import { lerAndamento, lerResultado, urlTSE, type AndamentoTSE } from './tse.ts';
import type { DadosUF, Entrada } from './motor.ts';

export type BuscarJson = (url: string) => Promise<unknown>;

const assinatura = (a: AndamentoTSE) => `${a.secoesApuradas}|${a.comparecimento}|${a.totalizacao}`;

/** Lê o placar nacional e, das UFs que mudaram, o resultado e o andamento por município. */
export class ColetorTSE {
  private ufs = new Map<string, DadosUF>();
  private vistas = new Map<string, string>();

  constructor(private eleicao: number, private buscar: BuscarJson, private base?: string) {}

  async atualizar(): Promise<Entrada> {
    const [brU, brAb] = await Promise.all([
      this.buscar(urlTSE.resultado(this.eleicao, 'br', this.base)),
      this.buscar(urlTSE.andamento(this.eleicao, 'br', this.base)),
    ]);
    const brasil = lerResultado(brU);
    const porUf = lerAndamento(brAb).filter((a) => a.tipo === 'uf');
    const mudaram = porUf.filter((a) => this.vistas.get(a.abr) !== assinatura(a));

    let proximo = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (proximo < mudaram.length) {
          const a = mudaram[proximo++];
          const [u, ab] = await Promise.all([
            this.buscar(urlTSE.resultado(this.eleicao, a.abr, this.base)),
            this.buscar(urlTSE.andamento(this.eleicao, a.abr, this.base)),
          ]);
          const resultado = lerResultado(u);
          const andamento = new Map(
            lerAndamento(ab).filter((x) => x.tipo === 'mun').map((x) => [x.abr, x] as const),
          );
          this.ufs.set(a.abr, { resultado, andamento });
          // Só marca como vista se os arquivos da UF já refletem o andamento nacional; senão, busca de novo.
          const somaMun = [...andamento.values()].reduce((s, x) => s + x.secoesApuradas, 0);
          if (somaMun === resultado.secoesApuradas && resultado.secoesApuradas === a.secoesApuradas) {
            this.vistas.set(a.abr, assinatura(a));
          }
        }
      }),
    );
    return { brasil, ufs: this.ufs };
  }
}
