# Termômetro Camarada ☭

Site que projeta o 2º turno presidencial de 25/10/2026 (Lula × Flávio Bolsonaro) durante a apuração. No ar em https://termometro-2turno.netlify.app. O dono do projeto não é programador: responda em português simples.

## Como publicar

- **Todo push para `main` publica em produção sozinho** (Netlify ligado a este repositório). Cada publicação gasta 15 créditos do plano gratuito do Netlify (300 por mês, compartilhados com o tráfego do site). Junte mudanças num push só e não faça push de teste.
- Fluxo preferido: trabalhe num branch e abra um pull request. O Netlify cria uma prévia do PR (não gasta o crédito de publicação; a prévia pede login do Netlify). Passe o link da prévia ao dono e só faça merge na `main` quando ele aprovar. Se ele pedir para publicar direto, faça push na `main`.
- Antes do push: `npm install`, `npm run build` (checa os tipos e monta o site) e, se mexer em `src/engine/`, `npm run replay:testar`. O erro médio dos cenários normais fica perto de 0,4 a 0,6 ponto; se piorar muito, algo quebrou.
- Se uma publicação quebrar o site: no painel do Netlify, Deploys → escolher a versão anterior → Publish deploy.

## Como funciona

- O navegador de cada visitante lê direto do TSE (`src/engine/coletor.ts`) a cada 1 minuto: placar e andamento do Brasil, e resultado e andamento por município das UFs que mudaram. Não há servidor na apuração.
- `public/dados/base-1t.json`: resultado do 1º turno por município (5.757), gerado uma vez por `npm run base` e conferido com o total nacional. Não regenere sem motivo (são 5.757 requisições ao TSE).
- `src/engine/motor.ts`: esperado por município = 1º turno + transferência dos outros candidatos (`CONFIG.matriz`, Quaest 17–20/10), ajustado por igual para o total nacional dar `CONFIG.esperadoNacionalLula` (50%, Datafolha 20–22/10). Compara o observado com o esperado nos mesmos municípios apurados, por UF (puxando para a região e depois para o Brasil quando há pouco dado), projeta o restante, calcula a faixa (simulações) e o efeito do comparecimento.
- `src/engine/simulador.ts`: apuração simulada para testes. No site: `?replay=igual|mais2|menos2|regional|matriz-errada|comparecimento|vies|curva-1t` e `&vel=6`. `?eleicao=1t` lê os arquivos reais do 1º turno no TSE. `?espera=1` força a contagem regressiva.
- `netlify/functions/gravador.mts`: roda a cada minuto só na janela da apuração e guarda a série do gráfico (Netlify Blobs); `serie.mts` a serve em `/api/serie`.
- Visual: o mesmo do app de bolão do dono (Poppins, azul `#2f2bf0`, limão `#b6e617`), em `src/styles.css`. Textos da tela em `src/ui/blocos.tsx`.

## Cuidados

- O TSE bloqueia o IP por 10 minutos com excesso de requisições ou 404 repetidos. Use só os endereços de `src/engine/tse.ts`; não invente URLs.
- A faixa "Projeção independente. Não é um site do TSE" deve continuar visível.
- Endereços do TSE: eleição do 1º turno 6257, do 2º turno 6258, cargo Presidente 1.

<!-- teste de prévia -->
