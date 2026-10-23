# Termômetro do 2º turno — especificação para o Claude Code

> Cole no Claude Code: **"Leia PROMPT_termometro.md inteiro e comece pela Fase 0. Pare no fim de cada fase e me mostre o resultado antes de seguir."**

---

## 0. Como você (agente) deve trabalhar

- **Prazo duro:** a apuração do 2º turno começa no **domingo, 25/10/2026, às 17h (Brasília)**. Tudo precisa estar no ar e **testado até sábado à noite**. Se algo ameaçar o prazo, corte escopo opcional (seção 12), nunca o núcleo.
- Trabalhe em **fases** (seção 13). No fim de cada fase, pare, mostre o que foi feito e o que testou, e espere o meu ok.
- **Não invente URLs, códigos de eleição, nomes de campos nem nomes de colunas.** Descubra tudo lendo as fontes do TSE (seção 4) e os próprios arquivos JSON/CSV. Quando precisar supor algo, diga explicitamente.
- O **1º turno já está publicado** no mesmo servidor de resultados do TSE. Use os arquivos dele para desenvolver e testar tudo antes de domingo.
- **Antes de criar contas, rodar deploy ou gastar dinheiro, me pergunte.** Os segredos ficam em `.env` (nunca no repositório).
- Linguagem: **TypeScript** em tudo (Node 20+ para scripts, Vite + React no front). Mantenha simples.

---

## 1. Objetivo

Um painel web, acessível pelo celular, que durante a apuração do 2º turno (Lula × Flávio Bolsonaro) responde: **"Considerando o 1º turno, a apuração está boa ou ruim para o Lula?"**

O placar bruto do TSE engana, porque Flávio sempre começa na frente: as urnas que chegam primeiro favorecem ele. Por isso o painel compara **cada município apurado no 2º turno com o mesmo município no 1º turno**, ajustado pela transferência dos votos dos outros candidatos e pela variação do comparecimento. A partir disso, projeta o resultado final.

---

## 2. Resultado do 1º turno (para conferência)

Use estes números para conferir a linha de base. A soma dos municípios mais o exterior tem que bater com eles.

- Flávio Bolsonaro (PL, 22): **56.104.503** votos (**47,03%** dos válidos)
- Lula (PT, 13): **53.879.538** (**45,16%**)
- Augusto Cury 2,89% · Renan Santos 2,24% · Ronaldo Caiado 2,18% · Romeu Zema 0,27% · demais < 0,2%
- Válidos ≈ 125,27 milhões · brancos ≈ 2,30 milhões · nulos ≈ 3,67 milhões · abstenção 21,08%

Evolução da apuração do 1º turno, de boletins da imprensa (% de seções apuradas → Flávio / Lula, em % dos válidos). Serve para o modo de emergência (seção 10):

```
1.5 → 49.2 / 42.2     6.0 → 50.51 / 40.97    7.6 → 50.7 / 41.0
10.08 → 50.96 / 40.78 22 → 51.1 / 40.8      36.6 → 50.63 / 41.23
41 → 50.41 / 41.44    64.81 → 49.58 / 42.25  85 → 48.5 / 43.5
88 → 48.2 / 43.8      90.61 → 48.02 / 44.01  93 → 47.8 / 44.2
99 → 47.2 / 44.9      99.7 → 47.1 / 45.1     100 → 47.03 / 45.16
```

---

## 3. Arquitetura

```
TSE (resultados.tse.jus.br)  ──►  POLLER (Node)  ──►  SUPABASE (Postgres + Realtime)  ──►  FRONT (Netlify)
   JSON por município              varre, calcula,        tabelas + views                     React, atualiza
                                   grava a cada ciclo     leitura pública só leitura           sozinho (realtime)
```

- **Front:** Vite + React + TS, hospedado no **Netlify** (site estático). Lê o Supabase com a chave `anon` e se inscreve no Realtime.
- **Banco:** **Supabase**, projeto na região **São Paulo (sa-east-1)**. RLS ligada: `anon` só tem SELECT. Só o poller escreve, com a `service_role` key, que fica apenas no `.env` do poller.
- **Poller:** script Node de longa duração (`poller/`), num loop.
  - **Execução principal:** no meu computador, no domingo. Tem IP residencial brasileiro, o que evita bloqueio por IP estrangeiro ou de datacenter.
  - **Backup opcional:** o mesmo script num container na **Fly.io, região `gru` (São Paulo)**. Só configure se sobrar tempo e se eu aprovar. Precisa de lock para não rodar dois pollers escrevendo ao mesmo tempo: uma linha `poller_lock` com heartbeat.
- **Por que não rodar tudo no navegador:** cada visitante faria milhares de requisições ao TSE. Também não usar Netlify Functions agendadas como poller, porque o limite de tempo de execução é curto demais para varrer ~5.570 municípios.

---

## 4. Fontes de dados do TSE (descubra os detalhes, não chute)

1. **Página técnica de divulgação de resultados 2026 (leia primeiro):**
   https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
   - Base de produção: `https://resultados.tse.jus.br/oficial/...`
   - Os códigos de eleição do 1º turno (04/10) e do 2º turno (25/10) vêm do arquivo de configuração **EA11 (`ele-c.json`)**.
   - Arquivos: **EA20** (resultados Brasil, UF e município), **EA14/EA15** (andamento da totalização, Brasil e UF), **EA12** (lista de municípios), **EA16/EA18** (seções).
   - Exemplos de caminho do simulado: `.../ele2026/21270/dados/br/br-e021270-ab.json`, `.../ele2026/21272/dados/ac/ac-c0003-e021272-u.json`, `.../ele2026/21272/dados/ac/ac01120-c0005-e021272-u.json`. **Confirme o código do cargo de Presidente**; não assuma.
   - **Regras de acesso:** no máximo 100 requisições/s por IP, senão bloqueio de 10 min, renovado a cada nova tentativa. **404 repetidos também bloqueiam.** Respostas 304 contam no limite. A CDN suporta ETag e Last-Modified. Não existe listagem de diretórios. **Monte as URLs de município só a partir da lista oficial (EA12),** nunca por tentativa.
2. **Portal de Dados Abertos (conferência da linha de base):** https://dadosabertos.tse.jus.br
   - Procure os conjuntos de 2026 de votação por município e zona (nomes no estilo `votacao_candidato_munzona_2026` e `detalhe_votacao_munzona_2026`, que trazem aptos, comparecimento, brancos e nulos) e o **"Resultados - 2026 - Boletim de Urna"** (CSV por UF, já publicado para o 1º turno).
   - Os CSVs do TSE costumam vir em **latin-1**, separados por `;`. Confirme.

**Linha de base (estratégia preferida):** gere a linha de base do 1º turno varrendo os **próprios JSON de município do 1º turno** em `resultados.tse.jus.br`. Assim os códigos e o formato ficam idênticos aos do 2º turno, e o mesmo parser serve para os dois. Use os Dados Abertos só para conferir os totais.

**Antes de escrever o poller, investigue e me reporte:**
- Se existe algum arquivo por UF que já traga todos os municípios. Se existir, use-o: muito menos requisições.
- Quais campos o JSON de município traz: votos por candidato, brancos, nulos, comparecimento, abstenção, eleitorado, seções totalizadas, % apurado, eleitorado das seções já apuradas, horário de atualização.
- Se a CDN responde com CORS e se aceita requisições condicionais (ETag/If-Modified-Since).

---

## 5. Método (o coração da ferramenta)

Notação por município *m*. No 1º turno: `L1`, `F1`, votos de cada outro candidato `V_c`, brancos, nulos, aptos `A`, comparecimento `C1`, taxa de comparecimento `t1 = C1/A`.

### 5.1 Esperado sem mudança de opinião

A **matriz de transferência** é configurável, uma linha por candidato *c*: `pF_c` (vai para Flávio), `pL_c` (vai para Lula) e `pO_c` (branco, nulo ou abstenção), com soma 1. Valores padrão, editáveis num arquivo de configuração e também na interface:

| Candidato | Flávio | Lula | Branco/nulo/não vota |
|---|---|---|---|
| Ronaldo Caiado | 0,70 | 0,15 | 0,15 |
| Renan Santos | 0,65 | 0,15 | 0,20 |
| Romeu Zema | 0,75 | 0,10 | 0,15 |
| Augusto Cury | 0,45 | 0,35 | 0,20 |
| Demais | 0,45 | 0,35 | 0,20 |

Supõe-se que os eleitores de Lula e Flávio no 1º turno repetem o voto.

```
EL_m = L1 + Σ_c pL_c · V_c
EF_m = F1 + Σ_c pF_c · V_c
e_m  = EL_m / (EL_m + EF_m)        ← fatia esperada do Lula no município
```

### 5.2 O que está acontecendo (2º turno, ao vivo)

- `o_m = L2 / (L2 + F2)`: fatia observada do Lula no que já foi apurado no município.
- `Δ_m = o_m − e_m`.
- **Δ por UF** = média de `Δ_m` ponderada pelos votos válidos já apurados (`L2 + F2`).
- **Encolhimento:** com pouca apuração na UF, puxe o Δ da UF em direção ao Δ nacional: `Δ_uf* = w·Δ_uf + (1−w)·Δ_nac`, com `w = n/(n + k)`, onde *n* = votos válidos apurados na UF e *k* = configurável (comece com 200.000).

### 5.3 Comparecimento

- **Só use municípios com ≥ 95% das seções apuradas** para medir comparecimento. Município parcial distorce, porque as seções que chegam primeiro não são uma amostra aleatória.
- `Δt_m = t2_m − t1_m` (em pontos). **Δt por UF** = média ponderada pelos aptos. Aplique o mesmo encolhimento.
- Brancos e nulos: mesmo tratamento, em proporção do comparecimento.

### 5.4 Projeção final

Para cada município:
- **Parte apurada:** votos reais de Lula e Flávio.
- **Parte restante:** `aptos_restantes` = aptos das seções não apuradas (use o campo do JSON, se houver; senão `A × (1 − %seções apuradas)`, e diga qual usou).
  - `válidos_restantes = aptos_restantes × (t1_m + Δt_uf*) × (1 − taxa de branco/nulo ajustada)`
  - `fatia_Lula_restante = clamp(e_m + Δ_uf*, 0, 1)`

**Exterior (UF "ZZ"):** trate como uma UF própria.

**Totais:** some tudo. A projeção é a fatia do Lula nos válidos totais.

**Decomposição**, para mostrar na tela:
1. **Esperado pelo 1º turno:** projeção com Δ = 0 e Δt = 0.
2. **Efeito da fatia:** projeção com Δ real e Δt = 0, menos o esperado.
3. **Efeito do comparecimento:** projeção completa, menos o item 2, menos o esperado.

**Faixa de incerteza:** bootstrap simples. Reamostre os municípios apurados dentro de cada UF (200 iterações), recalcule os Δ, reprojete, e mostre os percentis 10 e 90. Também mostre "chance aproximada de Lula > 50%" como a fração das iterações. **Rotule como estimativa, não probabilidade oficial.**

**"Precisa de"** = quanto Δ nacional uniforme levaria a projeção a exatamente 50%. Calcule por busca binária.

### 5.5 Agregados para o gráfico

A cada ciclo, grave um snapshot nacional com:
- % de seções apuradas;
- fatia observada do Lula no conjunto apurado;
- fatia **esperada no mesmo conjunto apurado**: `Σ e_m·(L2+F2) / Σ (L2+F2)`;
- projeção e faixa.

A distância entre a linha observada e a esperada é o Δ nacional. Isso mantém o gráfico coerente com o veredito.

---

## 6. Banco (Supabase)

Proponha o SQL de migração. Sugestão:

- `baseline_municipio`: `cd_municipio` (código TSE), `uf`, `nome`, `aptos`, `comparecimento`, `brancos`, `nulos`, `lula`, `flavio`, `outros jsonb` (votos por candidato), `e_lula` (esperado; recalculado se a matriz mudar).
- `live_municipio`: `cd_municipio`, `pct_secoes`, `aptos_apurados` (se houver), `comparecimento`, `brancos`, `nulos`, `lula`, `flavio`, `atualizado_tse` (timestamp do TSE), `atualizado_em`.
- `uf_estado`: por UF, com % apurado, Δ, Δ*, Δt, Δt*, observado, esperado, projeção da UF e o 3º colocado do 1º turno (nome e %).
- `snapshot_nacional`: série temporal descrita na seção 5.5, mais a decomposição.
- `config`: matriz de transferência, *k*, modo (`ao_vivo` | `replay` | `manual`), eleição/turno ativo.
- `poller_status`: último ciclo, duração, requisições, erros, 304s, bloqueios detectados.

**RLS:** `anon` = SELECT em tudo, exceto nada sensível (não há dado pessoal). Escrita só via `service_role`. **Realtime** ligado em `snapshot_nacional`, `uf_estado` e `poller_status`.

---

## 7. Poller

- **Ciclo:**
  1. Lê EA14/EA15 para saber o andamento.
  2. Busca os arquivos de município que mudaram ou ainda não estão em 100%. Usa requisição condicional (ETag/Last-Modified) e **concorrência limitada (comece com 10 req/s, configurável, teto 30)**.
  3. Recalcula tudo (seção 5).
  4. Faz upsert no Supabase.
  5. Espera e repete. **Alvo: um ciclo completo a cada 1–3 min.**
- Municípios em 100% e já gravados saem da varredura.
- **Detecção de bloqueio:** se vierem vários erros 403/429 ou timeouts seguidos, pause 11 minutos, registre em `poller_status` e mostre o aviso no front.
- Nenhum 404 por tentativa: só URLs montadas a partir da lista oficial.
- Logs claros no terminal: % apurado, Δ nacional, projeção, req/s, erros.
- Flags de CLI:
  - `--eleicao 1t|2t`
  - `--replay` (seção 9)
  - `--once` (um ciclo só)
  - `--dry-run` (não grava no banco)
- No computador: instrua como impedir que ele durma durante a apuração (Windows: plano de energia; macOS: `caffeinate -i`).

---

## 8. Front-end (celular primeiro)

**Visual:**
- Fundo cinza bem claro `#F4F5F7`, cartões brancos com raio 16 px, texto `#14171C`, secundário `#5B6270`.
- Flávio em azul `#1F4E9C`, Lula em vermelho `#B3261E`.
- Bom: verde-petróleo `#0F766E`. Atenção: âmbar `#8A5A00`.
- Fontes: **Barlow Condensed** (números grandes e títulos) e **Source Sans 3** (texto), via Google Fonts, com números tabulares.
- Funciona bem em 390 px de largura e não pode ter rolagem horizontal.

**Blocos, nesta ordem:**
1. **Cabeçalho:** "Termômetro do 2º turno", horário da última atualização, % de seções apuradas e barra de progresso. Um selo de status: "ao vivo", "replay de teste", "modo manual" ou "TSE sem resposta há X min".
2. **Placar do TSE agora:** % de Flávio e de Lula, barra dividida com marcador nos 50% e diferença em votos. Abaixo, a frase fixa "As urnas que chegam primeiro favorecem Flávio."
3. **Veredito (cartão escuro `#14171C`):**
   - Etiqueta "Bom para Lula" (Δ ≥ precisa), "Empate técnico" (faixa cruza 50%) ou "Ruim para Lula".
   - Frase "Lula está **+X,X pontos** acima/abaixo do esperado nos mesmos municípios".
   - Decomposição: esperado pelo 1º turno → efeito da fatia → efeito do comparecimento → **projeção final**, com faixa e "precisa de +Y pt".
4. **Gráfico:** eixo X = % apurado; linhas para observado (vermelho), esperado no mesmo conjunto (cinza) e projeção final (tracejada), com a faixa sombreada e uma linha nos 50%. Em SVG próprio ou com uma biblioteca leve.
5. **Comparecimento:** 1º turno × agora (mesmos municípios), brancos e nulos, e barras divergentes de Δt por região (Norte, Nordeste, Centro-Oeste, Sudeste, Sul). Mais uma frase com o efeito na projeção.
6. **"Para onde foi o voto dos outros":** para cada candidato derrotado, uma barra empilhada com a transferência suposta. Quando a estimativa observada existir (seção 12), mostre também a linha "observado".
7. **Tabela por UF:** UF, % apurado (mini barra), esperado, agora, Δ (verde se ≥ precisa, âmbar se não). Numa linha secundária, o 3º colocado do 1º turno (nome e %) e o Δt de comparecimento. Ordenável por Δ, % apurado ou peso eleitoral.
8. **Rodapé:** "Como funciona" em 3 linhas e link para a fonte (TSE).

**Comportamento:**
- Atualiza sozinho via Supabase Realtime, com polling de 30 s como reserva.
- Se o último snapshot tiver mais de 5 min, mostre o aviso de dados atrasados.
- **Antes das 17h de domingo:** mostre uma tela de espera com a contagem regressiva e o resultado do 1º turno.

---

## 9. Testes (obrigatórios antes de domingo)

1. **Linha de base:** a soma dos municípios mais o exterior bate com os totais da seção 2 (tolerância zero para votos de Lula e Flávio).
2. **Parser:** rode o poller com `--eleicao 1t --once --dry-run` contra os arquivos reais do 1º turno e confira os totais.
3. **Replay (simulação de apuração):** um modo que usa os dados finais do 1º turno como se fossem do 2º turno, liberando os municípios aos poucos numa ordem realista. Calibre a ordem para que a curva Flávio × Lula se pareça com a evolução da seção 2: Sul, Centro-Oeste e Sudeste adiantados; Norte, Nordeste e exterior no fim.
   - Nesse teste, o Δ esperado é ≈ 0, porque é o mesmo eleitorado. **Se o painel acusar Δ grande no começo, o método está enviesado: investigue e me reporte.**
   - Faça também uma variante que soma +2 pontos para o Lula em todos os municípios. O painel deve detectar ≈ +2 cedo, e a projeção deve convergir para o resultado verdadeiro dessa variante.
4. **Carga:** um ciclo completo dentro do limite de requisições, medido e registrado.
5. **Front:** abra no celular (390 px) e confira os estados ao vivo, replay, manual, atrasado e "antes das 17h".

---

## 10. Modo de emergência (manual)

Se o poller cair ou o TSE bloquear, o front precisa funcionar sozinho:
- Um formulário com "% apurado" e "% do Lula nos válidos" (nacional) e, opcionalmente, linhas por UF.
- **Método nacional:** compare com a curva do 1º turno da seção 2, convertida para fatia do Lula entre os dois e interpolada. Ajuste pelo esperado da transferência: o deslocamento entre a fatia mano a mano final do 1º turno (≈49,0%) e o esperado nacional com transferência. Daí sai "Lula X pt acima ou abaixo da curva" e a projeção correspondente.
- **Por UF**, se preenchido: use os esperados por UF calculados da linha de base.
- Rotule bem: "Modo manual — menos preciso".

---

## 11. Deploy e operação

- **README** com o passo a passo:
  1. Criar o projeto no Supabase (região São Paulo), rodar as migrações e copiar as chaves.
  2. Rodar a linha de base.
  3. Configurar o Netlify (variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`) e fazer o deploy.
  4. Rodar o poller.
- **Checklist do domingo**, curto, no README:
  - 15h: conferir o código da eleição do 2º turno no `ele-c.json`.
  - 16h30: rodar `--once` para ver se os arquivos do 2º turno existem.
  - 17h: ligar o poller.
  - A cada hora: olhar `poller_status`.
  - Se houver bloqueio: esperar, reduzir req/s ou ligar o modo manual.

---

## 12. Opcional (só se o núcleo estiver pronto e testado)

1. **Transferência observada:** com ≥ 30% apurado, estimar `pL_c` e `pF_c` por regressão ponderada entre municípios: a variação de votos de Lula e Flávio explicada pelos votos de cada candidato derrotado no 1º turno, com restrições 0–1. Mostrar como "observado até agora" e oferecer um botão para usar essa matriz na projeção. Rotular a limitação: é comportamento médio de lugares, não de pessoas.
2. Backup do poller na Fly.io (`gru`) com lock.
3. Botão "copiar resumo", que gera um texto curto para postar ("Com 62% apurado, Lula está +2,6 acima do esperado; projeção 51,6% (50,7–52,5)").
4. Mapa simples por UF colorido pelo Δ.

---

## 13. Fases

- **Fase 0 — Reconhecimento:** ler a página técnica do TSE, achar os códigos das eleições e o código do cargo de Presidente, baixar uma amostra de arquivos (Brasil, uma UF, dois municípios) do 1º turno, documentar os campos e testar CORS, ETag e a existência de arquivo por UF com municípios. **Me reportar e propor o plano de requisições.**
- **Fase 1 — Linha de base:** gerar `baseline_municipio` e conferir com a seção 2.
- **Fase 2 — Supabase:** migrações, RLS e Realtime.
- **Fase 3 — Poller + método:** implementar a seção 5 e testar com `--eleicao 1t --once`.
- **Fase 4 — Replay:** testes da seção 9.3 (Δ ≈ 0 e +2).
- **Fase 5 — Front:** seção 8, mais o modo manual (seção 10).
- **Fase 6 — Deploy:** Netlify, README e checklist.
- **Fase 7 — Opcionais**, se houver tempo.
