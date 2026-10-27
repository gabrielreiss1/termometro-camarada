# Termômetro Camarada ☭

Site que projeta o 2º turno presidencial de 25/10/2026 (Lula × Flávio Bolsonaro) durante a apuração. No ar em https://termometro-2turno.netlify.app. O dono do projeto não é programador: responda em português simples.

## Como publicar

- **Todo push para `main` publica em produção sozinho** (Netlify ligado a este repositório). Cada publicação gasta 15 créditos do plano gratuito do Netlify (300 por mês, compartilhados com o tráfego do site). Junte mudanças num push só e não faça push de teste.
- Fluxo preferido: trabalhe num branch e abra um pull request. O Netlify cria uma prévia do PR (não gasta o crédito de publicação; a prévia pede login do Netlify). Passe o link da prévia ao dono e só faça merge na `main` quando ele aprovar. Se ele pedir para publicar direto, faça push na `main`.
- Antes do push: `npm install`, `npm run build` (checa os tipos e monta o site) e, se mexer em `src/engine/`, `npm run replay:testar`. O erro médio dos cenários normais fica perto de 0,4 a 0,6 ponto; se piorar muito, algo quebrou.
- Se uma publicação quebrar o site: no painel do Netlify, Deploys → escolher a versão anterior → Publish deploy.

## Como funciona

- O navegador de cada visitante lê direto do TSE (`src/engine/coletor.ts`) a cada 1 minuto: placar e andamento do Brasil, e resultado e andamento por município das UFs que mudaram. Não há servidor na apuração.
- `public/dados/base-1t.json`: resultado do 1º turno por município (5.757: 5.571 no Brasil e 186 no exterior), gerado uma vez por `npm run base` e conferido com o total nacional. Não regenere sem motivo (são 5.757 requisições ao TSE).
- Exterior: o TSE o trata como a UF `zz` (186 cidades, nas listas do 1º e do 2º turno). Ele já entra em tudo como mais um estado: base, leitura ao vivo, conta (região `EX` em `config.ts`) e tela ("EXT" na aba Estados). Pesa cerca de 0,3% dos votos válidos.
- `src/engine/motor.ts`: esperado por município = 1º turno + transferência dos outros candidatos (`CONFIG.matriz`, Quaest 17–20/10), ajustado por igual para o total nacional dar `CONFIG.esperadoNacionalLula` (50%, Datafolha 20–22/10). Compara o observado com o esperado nos mesmos municípios apurados, por UF (puxando para a região e depois para o Brasil quando há pouco dado), projeta o restante, calcula a faixa (simulações) e o efeito do comparecimento.
- `src/engine/simulador.ts`: apuração simulada para testes. No site: `?replay=igual|mais2|menos2|regional|matriz-errada|comparecimento|vies|curva-1t` e `&vel=6`. `?eleicao=1t` lê os arquivos reais do 1º turno no TSE. `?espera=1` força a contagem regressiva.
- `netlify/functions/gravador.mts`: roda a cada minuto só na janela da apuração e guarda a série do gráfico (Netlify Blobs); `serie.mts` a serve em `/api/serie`.
- **Versão neutra** (cópia para o chefe do dono): o mesmo código com `VITE_MARCA=neutra` (`src/marca.ts`). Nome "Termômetro do 2º turno", sem ☭ e sem "camaradas", sem nada de "Lula acima/abaixo do previsto" (frase, linha da conta, "precisa", segundo gráfico), projeção final dos dois candidatos, etiquetas "Vantagem Lula/Flávio", comparecimento dizendo a quem favorece e aba Estados com a fatia de cada um. Fica em https://termometro-segundo-turno.netlify.app (site Netlify `7a04b0ba-ce36-46aa-a3b6-ce5cb7e6907d`), publicado à mão, sem ligação com o GitHub: `VITE_MARCA=neutra npx vite build --outDir dist-neutra` e depois `npx netlify-cli deploy --prod --no-build --dir dist-neutra --functions <pasta vazia> --site 7a04b0ba-ce36-46aa-a3b6-ce5cb7e6907d`.
- `public/dados/serie-2t.json`: a série do gráfico gravada na noite de 25/10, guardada no site (as duas versões a leem).
- Visual: o mesmo do app de bolão do dono (Poppins, azul `#2f2bf0`, limão `#b6e617`), em `src/styles.css`. Textos da tela em `src/ui/blocos.tsx`.

## Cuidados

- O TSE bloqueia o IP por 10 minutos com excesso de requisições ou 404 repetidos. Use só os endereços de `src/engine/tse.ts`; não invente URLs.
- Mantenha algum aviso de que não é resultado oficial. Hoje ele está no rodapé do "Como funciona" (aba Entenda e tela de espera: "Projeção independente. Não é um site do TSE nem da Justiça Eleitoral") e no veredito ("Estimativa independente, não é probabilidade nem resultado oficial"). A faixa do topo e a frase "As urnas que chegam primeiro favorecem Flávio" saíram a pedido do dono em 25/10.
- Endereços do TSE: eleição do 1º turno 6257, do 2º turno 6258, cargo Presidente 1.
