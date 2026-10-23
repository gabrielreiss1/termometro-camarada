# Termômetro do 2º turno

Projeção independente da apuração do 2º turno presidencial (25/10/2026). O site compara cada município apurado com o que era previsto para ele e projeta o resultado final.

## Como funciona (técnico)

- **Sem servidor na apuração.** O navegador de cada visitante lê direto do TSE, a cada minuto, 57 arquivos pequenos: o placar e o andamento do Brasil, mais o resultado e o andamento por município de cada UF que mudou. A conta é feita ali mesmo (`src/engine/motor.ts`).
- **Base do 1º turno.** `public/dados/base-1t.json` foi gerado uma vez com `npm run base`, a partir dos 5.757 arquivos de município do 1º turno, e conferido com o total nacional do TSE.
- **Esperado.** Para cada cidade: 1º turno + transferência dos outros candidatos (Quaest 17–20/10). Depois, um ajuste igual para todas as cidades faz o total nacional dar 50% × 50% (Datafolha 20–22/10). Tudo isso está em `src/engine/config.ts`.
- **Gravador (opcional).** `netlify/functions/gravador.mts` roda a cada minuto durante a apuração e guarda a série do gráfico. Assim, quem abre a página no meio da noite vê a curva desde o começo. Se ele falhar, o site continua funcionando e o gráfico só começa quando a pessoa abriu a página.

## Comandos

```
npm run dev                 # site local em http://localhost:5173
npm run base                # baixa o 1º turno e monta a base (já feito)
npm run replay:testar       # testa o método em apurações simuladas
npm run build               # gera o site em dist/
```

## Publicar

```
npx netlify login           # uma vez, autoriza no navegador
npx netlify deploy --build --prod
```

Contas novas do Netlify gastam créditos a cada publicação em produção. Por isso, teste localmente (`npm run build` e `npx vite preview`) antes de publicar.

## Checklist do domingo (25/10)

Nada precisa rodar no seu computador.

- **Até 16h:** abrir o site no celular. Ele deve mostrar a contagem regressiva.
- **16h30:** abrir `<site>/?eleicao=1t`. Deve mostrar o 1º turno com 100% apurado: isso prova que a leitura do TSE está funcionando.
- **17h:** a página troca sozinha para o painel. Nos primeiros minutos o veredito fica "Aguardando resultados".
- **Se aparecer "TSE sem resposta":** é o próprio TSE fora do ar ou lento. A página tenta de novo a cada minuto.

## Endereços úteis para teste

- `?replay=igual`: simulação em que ninguém muda de voto. Outros cenários: `mais2`, `menos2`, `regional`, `matriz-errada`, `comparecimento`, `vies`, `curva-1t`. `&vel=6` acelera.
- `?eleicao=1t`: lê os arquivos reais do 1º turno no TSE, para testar a leitura de ponta a ponta.
- `?espera=1`: força a tela de contagem regressiva. `?agora=1`: pula a contagem.
