import { useMemo, useState } from 'react';
import { CONFIG, NOMES_OUTROS, NOMES_REGIAO } from '../engine/config.ts';
import type { Resultado, ResultadoUF } from '../engine/motor.ts';
import type { Candidato } from '../engine/tipos.ts';
import { horaBrasilia, pct, plural, pontos, votos } from '../formato.ts';

export type Status =
  | { tipo: 'carregando' }
  | { tipo: 'espera' }
  | { tipo: 'ao-vivo' }
  | { tipo: 'sem-resposta'; minutos: number }
  | { tipo: 'replay' }
  | { tipo: 'teste-1t' };

const TEXTO_STATUS: Record<Status['tipo'], string> = {
  carregando: 'Carregando',
  espera: 'Domingo, 17h',
  'ao-vivo': 'Ao vivo',
  'sem-resposta': 'TSE sem resposta',
  replay: 'Simulação',
  'teste-1t': 'Teste 1º turno',
};

export function Topo({ status }: { status: Status }) {
  const texto = status.tipo === 'sem-resposta' ? `Sem resposta há ${status.minutos} min` : TEXTO_STATUS[status.tipo];
  return (
    <header className="topbar">
      <div className="topbar-user">
        <div className="avatar simbolo" aria-hidden="true">☭</div>
        <div className="topbar-name">
          <strong>Termômetro Camarada</strong>
          <span>2º turno · Presidente</span>
        </div>
      </div>
      <span className={`selo selo-${status.tipo}`}>
        {(status.tipo === 'ao-vivo' || status.tipo === 'sem-resposta') && <i className="live-dot" />}
        {texto}
      </span>
    </header>
  );
}

export type Aba = 'agora' | 'estados' | 'como';

export function Abas({ aba, mudar }: { aba: Aba; mudar: (a: Aba) => void }) {
  const abas: [Aba, string][] = [['agora', 'Agora'], ['estados', 'Estados'], ['como', 'Entenda']];
  return (
    <nav className="tabs" aria-label="Seções">
      {abas.map(([id, nome]) => (
        <button key={id} className={`tab ${aba === id ? 'active' : ''}`} aria-current={aba === id ? 'page' : undefined} onClick={() => mudar(id)}>
          {nome}
        </button>
      ))}
    </nav>
  );
}

export function Aviso() {
  return (
    <p className="info">
      <strong>Projeção independente.</strong> Não é um site do TSE. Resultado oficial em{' '}
      <a href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">resultados.tse.jus.br</a>.
    </p>
  );
}

export function Apuracao({ pctSecoes, atualizado }: { pctSecoes: number; atualizado: Date | null }) {
  return (
    <section className="card">
      <div className="apuracao-topo">
        <span>Seções apuradas</span>
        <strong>{pct(pctSecoes, 2)}</strong>
      </div>
      <div className="barra"><div style={{ width: `${100 * pctSecoes}%` }} /></div>
      {atualizado && <p className="atualizado">Atualizado às {horaBrasilia(atualizado)} (Brasília)</p>}
    </section>
  );
}

const CANDIDATOS = {
  lula: { nome: 'LULA', partido: 'PT', foto: '/fotos/lula.jpg' },
  flavio: { nome: 'FLÁVIO', partido: 'PL', foto: '/fotos/flavio.jpg' },
};

function Confronto({ lula, flavio, rotulo }: { lula: number; flavio: number; rotulo: (fatia: number, v: number) => [string, string] }) {
  const total = lula + flavio;
  const fLula = total > 0 ? lula / total : 0.5;
  const [lulaNum, lulaSub] = rotulo(fLula, lula);
  const [flavioNum, flavioSub] = rotulo(1 - fLula, flavio);
  return (
    <>
      <div className="teams">
        <div className="team">
          <img src={CANDIDATOS.lula.foto} alt="" className="foto foto-lula" width={56} height={56} />
          <span className="team-code">{CANDIDATOS.lula.nome}</span>
          <span className="team-partido">{CANDIDATOS.lula.partido}</span>
        </div>
        <span className="vs">×</span>
        <div className="team">
          <img src={CANDIDATOS.flavio.foto} alt="" className="foto foto-flavio" width={56} height={56} />
          <span className="team-code">{CANDIDATOS.flavio.nome}</span>
          <span className="team-partido">{CANDIDATOS.flavio.partido}</span>
        </div>
      </div>
      <div className="placar">
        <div className={`score-box ${total > 0 && lula > flavio ? 'lider' : ''}`}>
          <strong>{lulaNum}</strong>
          <span>{lulaSub}</span>
        </div>
        <div className={`score-box ${total > 0 && flavio > lula ? 'lider' : ''}`}>
          <strong>{flavioNum}</strong>
          <span>{flavioSub}</span>
        </div>
      </div>
      <div className="barra-dividida" aria-hidden="true">
        <div className="parte-lula" style={{ width: `${100 * fLula}%` }} />
        <div className="parte-flavio" />
        <i className="marca-50" />
      </div>
      <div className="legenda-barra"><span>Lula</span><span>50%</span><span>Flávio</span></div>
    </>
  );
}

export function Placar({ r }: { r: Resultado }) {
  const { lula, flavio } = r.placar;
  const total = lula + flavio;
  return (
    <section className="card">
      <h2 className="card-title">Placar do TSE agora</h2>
      <Confronto lula={lula} flavio={flavio} rotulo={(f, v) => (total > 0 ? [pct(f, 2), `${votos(v)} votos`] : ['—', '0 votos'])} />
      {total > 0 && (
        <p className="nota">Diferença: <b>{votos(Math.abs(lula - flavio))}</b> votos para {lula >= flavio ? 'Lula' : 'Flávio'}.</p>
      )}
      <p className="info" style={{ marginTop: 12 }}>
        <strong>As urnas que chegam primeiro favorecem Flávio.</strong> Por isso o placar engana no começo.
      </p>
    </section>
  );
}

const VEREDITOS = {
  aguardando: { texto: 'Aguardando resultados', cls: 'v-aguardando' },
  bom: { texto: 'Bom para Lula', cls: 'v-bom' },
  empate: { texto: 'Empate técnico', cls: 'v-empate' },
  ruim: { texto: 'Ruim para Lula', cls: 'v-ruim' },
};

function textoResumo(r: Resultado) {
  const d = r.delta ?? 0;
  const lado = d >= 0 ? 'acima' : 'abaixo';
  const insta = CONFIG.instagram ? ` · Insta @${CONFIG.instagram}` : '';
  return `Termômetro Camarada ☭ Com ${pct(r.pctSecoes)} das seções apuradas, Lula está ${pontos(d)} ponto ${lado} do que as pesquisas previam nos mesmos municípios. Projeção: ${pct(r.projecao)} (${pct(r.p10)} a ${pct(r.p90)}). ${location.origin}${insta}`;
}

const linkInsta = () => `https://www.instagram.com/${CONFIG.instagram}/`;

function IconeInsta({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" className="icone-insta">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.3" stopColor="#fa7e1e" />
          <stop offset="0.55" stopColor="#d62976" />
          <stop offset="0.8" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ig-grad)" />
      <rect x="9" y="9" width="22" height="22" rx="7" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="20" cy="20" r="5.2" fill="none" stroke="#fff" strokeWidth="2.6" />
      <circle cx="26.6" cy="13.4" r="1.6" fill="#fff" />
    </svg>
  );
}

function IconesInsta() {
  return (
    <span className="insta-icones" aria-hidden="true">
      <span className="avatar simbolo insta-app">☭</span>
      <IconeInsta />
    </span>
  );
}

export function CartaoInsta({ seguir }: { seguir: () => void }) {
  if (!CONFIG.instagram) return null;
  return (
    <a className="card cartao-insta" href={linkInsta()} target="_blank" rel="noreferrer" onClick={seguir}>
      <IconesInsta />
      <span className="insta-texto">
        <strong>Camarada, siga @{CONFIG.instagram}</strong>
        <span>no Insta e apoie quem faz este site de graça <span className="simbolo verm">☭</span></span>
      </span>
      <span className="insta-botao">Quero seguir</span>
    </a>
  );
}

export function AvisoInsta({ fim, fechar }: { fim: boolean; fechar: (seguiu: boolean) => void }) {
  if (!CONFIG.instagram) return null;
  return (
    <div className="aviso-insta" role="dialog" aria-label="Siga o Termômetro Camarada no Instagram">
      <button className="aviso-fechar" onClick={() => fechar(false)} aria-label="Fechar">×</button>
      <div className="aviso-topo">
        <IconesInsta />
        <div>
          {fim && <span className="aviso-selo">Apuração encerrada</span>}
          <strong>Camarada, siga @{CONFIG.instagram}</strong>
          <p>no Insta e apoie quem faz este site de graça <span className="simbolo verm">☭</span></p>
        </div>
      </div>
      <a className="btn btn-insta" href={linkInsta()} target="_blank" rel="noreferrer" onClick={() => fechar(true)}>Quero seguir</a>
      <p className="aviso-gratis">Site grátis, sem anúncios, feito por camaradas.</p>
    </div>
  );
}

export function Veredito({ r }: { r: Resultado }) {
  const v = VEREDITOS[r.veredito];
  const [copiado, setCopiado] = useState(false);
  const d = r.decomposicao;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoResumo(r));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <section className="card">
      <span className={`etiqueta ${v.cls}`}>{v.texto}</span>
      {r.delta === null ? (
        <p className="frase">Assim que os primeiros votos forem apurados, o termômetro compara cada lugar com o que as pesquisas previam para ele.</p>
      ) : (
        <>
          <p className="frase">
            Nos lugares já apurados, Lula está <strong>{pontos(r.delta)} ponto</strong> {r.delta >= 0 ? 'acima' : 'abaixo'} do que as pesquisas previam.
          </p>
          <div className="me-banner">
            <div>
              <span className="me-banner-label">Projeção final do Lula</span>
              <span className="me-banner-num">{pct(r.projecao)}</span>
              <span className="me-banner-faixa">provável entre {pct(r.p10)} e {pct(r.p90)}</span>
            </div>
            <div className="me-banner-direita">
              <span className="me-banner-label">Chance de vencer</span>
              <span className="me-banner-num menor">{Math.round(100 * r.chance)}%</span>
            </div>
          </div>
          <ul className="conta">
            <li><span className="conta-nome">Pesquisas ({CONFIG.fonteEsperadoCurta})</span><span className="conta-valor">{pct(d.esperado)}</span></li>
            <li><span className="conta-nome">Lula indo {d.efeitoFatia >= 0 ? 'melhor' : 'pior'} que o previsto</span><span className="conta-valor">{pontos(d.efeitoFatia)}</span></li>
            <li><span className="conta-nome">Efeito do comparecimento</span><span className="conta-valor">{pontos(d.efeitoComparecimento)}</span></li>
            <li className="conta-total"><span className="conta-nome">Projeção final</span><span className="conta-valor">{pct(d.final)}</span></li>
          </ul>
          {r.precisa !== null && (
            <p className="info" style={{ marginTop: 12 }}>
              {Math.abs(r.precisa) < 0.0005
                ? 'No que falta apurar, Lula precisa ficar exatamente no previsto para empatar.'
                : r.precisa > 0
                  ? <>No que falta apurar, Lula precisa ficar pelo menos <strong>{pontos(r.precisa)}</strong> acima do previsto para vencer.</>
                  : <>No que falta apurar, Lula pode ficar até <strong>{pontos(-r.precisa).replace('+', '')}</strong> abaixo do previsto e ainda vence.</>}
            </p>
          )}
          <p className="nota">Estimativa independente, não é probabilidade nem resultado oficial.</p>
          <button className="btn" onClick={copiar}>{copiado ? 'Resumo copiado' : 'Copiar resumo'}</button>
        </>
      )}
    </section>
  );
}

export function Comparecimento({ r }: { r: Resultado }) {
  const c = r.comparecimento;
  const regioes = c.porRegiao.filter((x) => x.delta !== null);
  const escala = Math.max(0.03, ...regioes.map((x) => Math.abs(x.delta!)));
  const efeito = r.decomposicao.efeitoComparecimento;
  const semDados = c.municipios === 0 || c.t1 === null || c.t2 === null;
  return (
    <section className="card">
      <h2 className="card-title">Comparecimento</h2>
      {semDados ? (
        <p className="card-sub">Medido nos municípios com 95% ou mais das seções apuradas. Ainda não há nenhum.</p>
      ) : (
        <>
          <p className="card-sub">Nos {plural(c.municipios, 'município', 'municípios')} já quase todo apurados:</p>
          <div className="compara">
            <div className="score-box"><strong>{pct(c.t1 ?? 0)}</strong><span>1º turno</span></div>
            <div className="score-box"><strong>{pct(c.t2 ?? 0)}</strong><span>Agora</span></div>
          </div>
          {c.brancosNulos1 !== null && c.brancosNulos2 !== null && (
            <p className="nota">Brancos e nulos: <b>{pct(c.brancosNulos1)}</b> no 1º turno → <b>{pct(c.brancosNulos2)}</b> agora.</p>
          )}
          <div className="divergente">
            {regioes.map((x) => (
              <div className="div-linha" key={x.regiao}>
                <span>{NOMES_REGIAO[x.regiao]}</span>
                <div className="div-trilho">
                  <i className="div-zero" />
                  <div
                    className={`div-barra ${x.delta! >= 0 ? 'pos' : 'neg'}`}
                    style={{
                      left: x.delta! >= 0 ? '50%' : `${50 - (50 * Math.abs(x.delta!)) / escala}%`,
                      width: `${(50 * Math.abs(x.delta!)) / escala}%`,
                    }}
                  />
                </div>
                <span className="div-valor">{pontos(x.delta!)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className={`ajuda ${semDados ? 'ajuda-neutra' : efeito >= 0.0005 ? 'ajuda-sim' : efeito <= -0.0005 ? 'ajuda-nao' : 'ajuda-neutra'}`}>
        {semDados
          ? 'Ainda não dá para saber se o comparecimento está ajudando o Lula.'
          : efeito >= 0.0005
            ? <>O comparecimento está <strong>ajudando o Lula</strong>: {pontos(efeito, 2)} ponto na projeção.</>
            : efeito <= -0.0005
              ? <>O comparecimento está <strong>atrapalhando o Lula</strong>: {pontos(efeito, 2)} ponto na projeção.</>
              : <>O comparecimento <strong>não está mudando nada</strong> para o Lula até agora.</>}
      </p>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      Desenvolvido por camaradas <span className="simbolo">☭</span>
    </footer>
  );
}

const MOSTRAR_TRANSFERENCIA: Candidato[] = ['cury', 'renan', 'caiado', 'zema'];

export function Transferencia({ votos1t }: { votos1t: Record<Candidato, number> }) {
  return (
    <section className="card">
      <h2 className="card-title">Para onde vão os votos dos outros</h2>
      <p className="card-sub">O que supomos que fazem os eleitores dos derrotados no 1º turno ({CONFIG.fonteMatriz}).</p>
      {MOSTRAR_TRANSFERENCIA.map((c) => {
        const m = CONFIG.matriz[c];
        const nenhum = Math.max(0, 1 - m.flavio - m.lula);
        return (
          <div className="transf" key={c}>
            <div className="transf-topo">
              <strong>{NOMES_OUTROS[c]}</strong>
              <span>{pct(votos1t[c])} no 1º turno{c === 'zema' ? '*' : ''}</span>
            </div>
            <div className="empilhada">
              <div className="e-flavio" style={{ width: `${100 * m.flavio}%` }}>{Math.round(100 * m.flavio)}%</div>
              <div className="e-lula" style={{ width: `${100 * m.lula}%` }}>{Math.round(100 * m.lula)}%</div>
              <div className="e-nenhum" style={{ width: `${100 * nenhum}%` }}>{Math.round(100 * nenhum)}%</div>
            </div>
          </div>
        );
      })}
      <div className="legenda-cores">
        <span className="leg"><i className="leg-flavio" />Flávio</span>
        <span className="leg"><i className="leg-lula" />Lula</span>
        <span className="leg"><i className="leg-nenhum" />Nenhum</span>
      </div>
      <p className="nota">Essa suposição quase não muda a projeção: ela só serve para dizer o que seria esperado em cada cidade.</p>
      <p className="nota">* A pesquisa não traz os eleitores do Zema; usamos o mesmo do Caiado.</p>
    </section>
  );
}

type Ordem = 'peso' | 'delta' | 'apurado';

const NOME_CURTO: Record<Candidato, string> = { cury: 'Cury', renan: 'Renan', caiado: 'Caiado', zema: 'Zema', demais: 'Demais' };

export function Estados({ r, terceiro }: { r: Resultado; terceiro: Map<string, { candidato: Candidato; pct: number }> }) {
  const [ordem, setOrdem] = useState<Ordem>('peso');
  const limiar = r.precisa ?? 0;
  const linhas = useMemo(() => {
    const chave: Record<Ordem, (u: ResultadoUF) => number> = {
      delta: (u) => (u.delta === null ? -Infinity : u.delta),
      apurado: (u) => u.pctSecoes,
      peso: (u) => u.eleitorado,
    };
    return [...r.ufs].sort((a, b) => chave[ordem](b) - chave[ordem](a));
  }, [r.ufs, ordem]);
  return (
    <>
      <div>
        <h2 className="titulo-aba">Por estado</h2>
        <p className="sub-aba">Fatia do Lula entre os dois, nos municípios já apurados</p>
      </div>
      <div className="pills" role="group" aria-label="Ordenar por">
        {(['peso', 'delta', 'apurado'] as Ordem[]).map((o) => (
          <button key={o} className={`pill ${ordem === o ? 'active' : ''}`} aria-pressed={ordem === o} onClick={() => setOrdem(o)}>
            {o === 'peso' ? 'Eleitorado' : o === 'delta' ? 'Diferença' : '% apurado'}
          </button>
        ))}
      </div>
      <div className="lista-uf">
        <div className="uf-head">
          <span>UF</span><span>Apurado</span><span className="c">Previsto</span><span className="c">Agora</span><span className="d">Dif.</span>
        </div>
        {linhas.map((u, i) => {
          const t = terceiro.get(u.uf);
          const cor = u.delta === null || Math.abs(u.delta - limiar) < 0.0005 ? '' : u.delta > limiar ? 'bom' : 'atencao';
          return (
            <div className={`uf-item ${i % 2 ? 'alt' : ''}`} key={u.uf}>
              <div className="uf-row">
                <span className="uf-sigla">{u.uf === 'zz' ? 'EXT' : u.uf.toUpperCase()}</span>
                <div>
                  <div className="mini-barra"><div style={{ width: `${100 * u.pctSecoes}%` }} /></div>
                  <div className="mini-pct">{pct(u.pctSecoes, 0)}</div>
                </div>
                <span className="uf-num c">{u.esperado === null ? '—' : pct(u.esperado)}</span>
                <span className="uf-num c">{u.observado === null ? '—' : pct(u.observado)}</span>
                <span className={`uf-dif d ${cor}`}>{u.delta === null ? '—' : pontos(u.delta)}</span>
              </div>
              <p className="uf-sub">
                {t ? `3º no 1º turno: ${NOME_CURTO[t.candidato]} (${pct(t.pct)})` : ''}
                {u.dComparecimento !== null ? ` · comparecimento ${pontos(u.dComparecimento)} pt` : ''}
              </p>
            </div>
          );
        })}
      </div>
      <p className="nota">Dif. em verde: Lula no ritmo de vencer naquele estado. Em vermelho: abaixo do ritmo.</p>
    </>
  );
}

export function ComoFunciona() {
  return (
    <>
      <section className="card regras">
        <h2>Como funciona</h2>
        <p>O placar do TSE engana no começo porque as cidades que apuram primeiro votam mais no Flávio.</p>
        <p>O termômetro compara cada cidade apurada com o que as pesquisas e o 1º turno previam para aquela mesma cidade.</p>
        <p>Se Lula está indo melhor ou pior que o previsto, essa diferença é aplicada ao que falta apurar, e daí sai a projeção.</p>
        <h3>De onde vem o "previsto"</h3>
        <p>Do resultado de cada cidade no 1º turno, mais a transferência dos votos dos outros candidatos. Depois, tudo é ajustado por igual para o total do Brasil dar o empate da pesquisa {CONFIG.fonteEsperadoCurta}.</p>
        <h3>Limitações</h3>
        <p>Dentro de uma cidade grande, as primeiras urnas podem não representar a cidade inteira. O TSE só publica os dados por município, então esse erro some conforme a apuração avança.</p>
      </section>
      <p className="fontes">
        Dados: <a href="https://resultados.tse.jus.br" target="_blank" rel="noreferrer">TSE</a>, lidos direto pelo seu navegador.
        Nível esperado: {CONFIG.fonteEsperado}. Transferência: {CONFIG.fonteMatriz}.
        Projeção independente. Não é um site do TSE nem da Justiça Eleitoral.
      </p>
    </>
  );
}

export function Espera({ agora, votos1t }: { agora: number; votos1t: { lula: number; flavio: number; validos: number } }) {
  const alvo = new Date(CONFIG.inicioApuracao).getTime();
  const falta = Math.max(0, alvo - agora);
  const h = Math.floor(falta / 3_600_000);
  const m = Math.floor((falta % 3_600_000) / 60_000);
  const s = Math.floor((falta % 60_000) / 1000);
  const dois = (x: number) => String(x).padStart(2, '0');
  return (
    <>
      <section className="card centro">
        <h2 className="card-title">A apuração começa às 17h de domingo</h2>
        <p className="relogio">{h >= 24 ? `${Math.floor(h / 24)}d ` : ''}{dois(h % 24)}:{dois(m)}:{dois(s)}</p>
        <p className="card-sub">A página se atualiza sozinha quando os primeiros resultados saírem.</p>
      </section>
      <section className="card">
        <h2 className="card-title">Como foi o 1º turno</h2>
        <Confronto lula={votos1t.lula} flavio={votos1t.flavio} rotulo={(_, v) => [pct(v / votos1t.validos, 2), `${votos(v)} votos`]} />
        <p className="nota">A pesquisa mais recente ({CONFIG.fonteEsperadoCurta}) indica empate no 2º turno: 50% a 50% dos votos válidos.</p>
      </section>
      <section className="card">
        <h2 className="card-title">O que vai aparecer aqui</h2>
        <p className="card-sub">Às 17h, o placar do TSE vai mostrar Flávio na frente: as cidades que apuram primeiro votam mais nele.</p>
        <p className="card-sub">O termômetro desconta isso: compara cada cidade apurada com o que era previsto para ela e projeta o resultado final.</p>
      </section>
    </>
  );
}
