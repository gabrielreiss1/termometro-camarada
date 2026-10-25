import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from './engine/config.ts';
import { calcular, prepararBase, terceiroColocado, type BasePreparada, type Entrada, type Resultado } from './engine/motor.ts';
import { CENARIOS, criarSimulacao } from './engine/simulador.ts';
import { CANDIDATOS_OUTROS, lerBase, type Candidato } from './engine/tipos.ts';
import { ELEICAO_1T, ELEICAO_2T } from './engine/tse.ts';
import { ColetorTSE } from './engine/coletor.ts';
import {
  buscarJson, gravarSerieLocal, juntarSeries, lerSerieGravador, lerSerieLocal, pontoDe, type Ponto,
} from './fonte.ts';
import { Grafico, GraficoProjecao } from './ui/Grafico.tsx';
import {
  Abas, Apuracao, ComoFunciona, Comparecimento, Espera, Estados, Placar, Rodape, Topo, Transferencia, Veredito,
  type Aba, type Status,
} from './ui/blocos.tsx';

const params = new URLSearchParams(location.search);
const CENARIO = CENARIOS.find((c) => c.nome === params.get('replay'));
const MODO: 'ao-vivo' | 'replay' | 'teste-1t' = CENARIO ? 'replay' : params.get('eleicao') === '1t' ? 'teste-1t' : 'ao-vivo';
const INICIO = new Date(CONFIG.inicioApuracao).getTime();
const INTERVALO_MS = 60_000;

export function App() {
  const [prep, setPrep] = useState<BasePreparada | null>(null);
  const [erroBase, setErroBase] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [serie, setSerie] = useState<Ponto[]>(() => (MODO === 'ao-vivo' ? lerSerieLocal() : []));
  const [atualizado, setAtualizado] = useState<Date | null>(null);
  const [falhaDesde, setFalhaDesde] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [minutoReplay, setMinutoReplay] = useState(0);
  const [aba, setAba] = useState<Aba>('agora');
  const forcarEspera = params.get('espera') === '1';
  const esperando = MODO === 'ao-vivo' && (forcarEspera || (agora < INICIO && params.get('agora') !== '1'));

  useEffect(() => {
    fetch('/dados/base-1t.json')
      .then((r) => r.json())
      .then((arq) => setPrep(prepararBase(lerBase(arq), CONFIG)))
      .catch(() => setErroBase('Não foi possível carregar a base do 1º turno. Recarregue a página.'));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const terceiro = useMemo(() => (prep ? terceiroColocado(prep) : new Map()), [prep]);
  const totais1t = useMemo(() => {
    const t = { lula: 0, flavio: 0, validos: 0, cury: 0, renan: 0, caiado: 0, zema: 0, demais: 0 };
    for (const m of prep?.municipios ?? []) {
      t.lula += m.lula;
      t.flavio += m.flavio;
      t.validos += m.validos;
      for (const c of CANDIDATOS_OUTROS) t[c] += m[c];
    }
    return t;
  }, [prep]);
  const votos1t = useMemo(() => {
    const o = {} as Record<Candidato, number>;
    for (const c of CANDIDATOS_OUTROS) o[c] = totais1t.validos ? totais1t[c] / totais1t.validos : 0;
    return o;
  }, [totais1t]);

  const aplicar = (entrada: Entrada, guardar: boolean) => {
    if (!prep) return;
    const r = calcular(prep, entrada, CONFIG);
    setResultado(r);
    setAtualizado(new Date());
    const p = pontoDe(r);
    if (p) {
      setSerie((s) => {
        const nova = juntarSeries(s, [p]);
        if (guardar) gravarSerieLocal(nova);
        return nova;
      });
    }
  };
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  // Ao vivo (ou teste com o 1º turno): lê o TSE a cada minuto, só com a página visível
  useEffect(() => {
    if (!prep || MODO === 'replay' || esperando) return;
    const coletor = new ColetorTSE(MODO === 'teste-1t' ? ELEICAO_1T : ELEICAO_2T, buscarJson);
    let parado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ciclo = async () => {
      clearTimeout(timer);
      if (document.hidden) return;
      try {
        const entrada = await coletor.atualizar();
        if (parado) return;
        aplicarRef.current(entrada, MODO === 'ao-vivo');
        setFalhaDesde(null);
      } catch {
        setFalhaDesde((f) => f ?? Date.now());
      }
      if (!parado) timer = setTimeout(ciclo, INTERVALO_MS);
    };
    const aoVoltar = () => { if (!document.hidden) ciclo(); };
    document.addEventListener('visibilitychange', aoVoltar);
    ciclo();
    return () => {
      parado = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [prep, esperando]);

  // Série gravada na nuvem, para quem abre a página no meio da apuração
  useEffect(() => {
    if (MODO !== 'ao-vivo' || esperando) return;
    const buscar = () => lerSerieGravador().then((pts) => pts.length && setSerie((s) => juntarSeries(pts, s)));
    buscar();
    const t = setInterval(buscar, 15 * 60_000);
    return () => clearInterval(t);
  }, [esperando]);

  // Replay: apuração simulada, 3 minutos por segundo
  useEffect(() => {
    if (!prep || !CENARIO) return;
    const sim = criarSimulacao(prep, CENARIO, CONFIG.matriz);
    let minuto = 0;
    const vel = Number(params.get('vel') ?? 3);
    const t = setInterval(() => {
      minuto += vel;
      setMinutoReplay(minuto);
      aplicarRef.current(sim.em(minuto), false);
      if (minuto >= 420) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [prep]);

  const status: Status =
    MODO === 'replay' ? { tipo: 'replay' }
      : MODO === 'teste-1t' ? { tipo: 'teste-1t' }
        : esperando ? { tipo: 'espera' }
        : falhaDesde !== null ? { tipo: 'sem-resposta', minutos: Math.max(1, Math.round((agora - falhaDesde) / 60_000)) }
          : resultado ? { tipo: 'ao-vivo' } : { tipo: 'carregando' };

  const mudarAba = (a: Aba) => {
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="app">
      <Topo status={status} />
      {!esperando && <Abas aba={aba} mudar={mudarAba} />}
      <main className="content">
        {CENARIO && (
          <p className="info info-replay">
            <strong>Simulação:</strong> {CENARIO.descricao}. Minuto {minutoReplay} depois das 17h.
          </p>
        )}
        {erroBase && <p className="erro">{erroBase}</p>}
        {esperando && prep && (
          <>
            <Espera agora={agora} votos1t={totais1t} />
            <ComoFunciona />
          </>
        )}
        {!esperando && aba === 'como' && (
          <>
            <ComoFunciona />
            <Transferencia votos1t={votos1t} />
          </>
        )}
        {!esperando && aba !== 'como' && !resultado && !erroBase && <p className="empty">Buscando os dados do TSE…</p>}
        {!esperando && aba === 'agora' && resultado && (
          <>
            <Apuracao pctSecoes={resultado.pctSecoes} atualizado={atualizado} />
            <Placar r={resultado} />
            <Veredito r={resultado} />
            <section className="card">
              <h2 className="card-title">Projeção ao longo da apuração</h2>
              <p className="card-sub">Projeção final do Lula a cada atualização. A faixa clara é o resultado provável.</p>
              <GraficoProjecao serie={serie} />
            </section>
            <section className="card">
              <h2 className="card-title">Como a apuração está andando</h2>
              <p className="card-sub">Fatia do Lula entre os dois, conforme as seções são apuradas.</p>
              <Grafico serie={serie} />
            </section>
            <Comparecimento r={resultado} />
          </>
        )}
        {!esperando && aba === 'estados' && resultado && <Estados r={resultado} terceiro={terceiro} />}
      </main>
      <Rodape />
    </div>
  );
}
