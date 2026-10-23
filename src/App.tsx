import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG } from './engine/config.ts';
import { calcular, prepararBase, terceiroColocado, type BasePreparada, type Entrada, type Resultado } from './engine/motor.ts';
import { CENARIOS, criarSimulacao } from './engine/simulador.ts';
import { CANDIDATOS_OUTROS, lerBase, type Candidato } from './engine/tipos.ts';
import { ELEICAO_1T, ELEICAO_2T } from './engine/tse.ts';
import { ColetorTSE } from './engine/coletor.ts';
import {
  buscarJson, contarVisita, gravarSerieLocal, juntarSeries, lerSerieGravador, lerSerieLocal, lerVisitas, pontoDe, type Ponto,
} from './fonte.ts';
import { Grafico } from './ui/Grafico.tsx';
import {
  Abas, Apuracao, Aviso, AvisoInsta, CartaoInsta, ComoFunciona, Comparecimento, Espera, Estados, Placar, Rodape, Topo,
  Transferencia, Veredito,
  type Aba, type Status,
} from './ui/blocos.tsx';

const params = new URLSearchParams(location.search);
const CENARIO = CENARIOS.find((c) => c.nome === params.get('replay'));
const MODO: 'ao-vivo' | 'replay' | 'teste-1t' = CENARIO ? 'replay' : params.get('eleicao') === '1t' ? 'teste-1t' : 'ao-vivo';
const INICIO = new Date(CONFIG.inicioApuracao).getTime();
const INTERVALO_MS = 60_000;
/** 'fechou' ou 'seguiu' */
const CHAVE_INSTA = 'termometro-insta';
/** '1' depois que o aviso do fim da apuração foi mostrado */
const CHAVE_INSTA_FIM = 'termometro-insta-fim';
// Na simulação o aviso aparece logo e nada fica guardado, para dar para ver como fica
const ESPERA_AVISO_MS = MODO === 'replay' ? 8_000 : 60_000;

function lerInsta(chave: string) {
  if (MODO === 'replay') return null;
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarInsta(chave: string, valor: string) {
  if (MODO === 'replay') return;
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: o aviso pode aparecer de novo numa próxima visita
  }
}

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
  const [avisoInsta, setAvisoInsta] = useState<null | 'inicio' | 'fim'>(null);
  const insta = useRef({ estado: lerInsta(CHAVE_INSTA), fimVisto: lerInsta(CHAVE_INSTA_FIM) === '1' });
  const [visitas, setVisitas] = useState<number | null>(null);

  // Conta este aparelho (uma vez só) e acompanha o total de aparelhos que abriram o site
  useEffect(() => {
    if (MODO !== 'ao-vivo') return;
    contarVisita();
    const ler = () => lerVisitas().then((n) => n !== null && setVisitas(n));
    ler();
    const t = setInterval(ler, 10 * 60_000);
    return () => clearInterval(t);
  }, []);
  // O Instagram só aparece depois de CONFIG.instagramMinVisitas aparelhos (na simulação, sempre)
  const liberarInsta =
    !!CONFIG.instagram &&
    (MODO === 'replay' || CONFIG.instagramMinVisitas <= 0 || (visitas !== null && visitas >= CONFIG.instagramMinVisitas));

  // Aviso do Instagram: sobe uma vez por pessoa depois de um tempo usando o site...
  useEffect(() => {
    if (!liberarInsta || insta.current.estado) return;
    const t = setTimeout(() => {
      if (!insta.current.estado) setAvisoInsta((a) => a ?? 'inicio');
    }, ESPERA_AVISO_MS);
    return () => clearTimeout(t);
  }, [liberarInsta]);
  // ...e uma última vez no fim da apuração, para quem fechou sem seguir
  useEffect(() => {
    if (!liberarInsta || !resultado || resultado.pctSecoes < 0.99) return;
    if (insta.current.estado === 'seguiu' || insta.current.fimVisto) return;
    setAvisoInsta('fim');
  }, [resultado, liberarInsta]);
  const fecharInsta = (seguiu: boolean) => {
    const eraFim = avisoInsta === 'fim';
    setAvisoInsta(null);
    insta.current.estado = seguiu ? 'seguiu' : insta.current.estado ?? 'fechou';
    gravarInsta(CHAVE_INSTA, insta.current.estado);
    if (eraFim) {
      insta.current.fimVisto = true;
      gravarInsta(CHAVE_INSTA_FIM, '1');
    }
  };
  const seguirPeloCartao = () => {
    insta.current.estado = 'seguiu';
    gravarInsta(CHAVE_INSTA, 'seguiu');
    setAvisoInsta(null);
  };
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
        {(esperando || aba === 'agora') && <Aviso />}
        {esperando && prep && (
          <>
            <Espera agora={agora} votos1t={totais1t} />
            {liberarInsta && <CartaoInsta seguir={seguirPeloCartao} />}
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
            {liberarInsta && <CartaoInsta seguir={seguirPeloCartao} />}
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
      {avisoInsta && <AvisoInsta fim={avisoInsta === 'fim'} fechar={fecharInsta} />}
    </div>
  );
}
