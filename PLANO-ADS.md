# Plano de ads (depois do tráfego)

O jogo continua **grátis para jogar**. Anúncio só entra quando existir gente jogando. Não ligue AdSense no `localhost` nem no primeiro deploy vazio.

Nome do jogo: **Capi Jump**. O plano de ads não depende do título.

## O que não fazer

- Colocar banner no meio do canvas (quebra o toque e o CPM é ruim).
- Interstitial a cada morte desde a 1ª partida (fecha a aba).
- Rede duvidosa (popunder, redirect). Queima domínio e portal.
- Contar com AdSense num HTML5 game no próprio domínio. Aprovação é chata e o preenchimento é baixo sem volume.

## Caminho 1 — portais (preferido)

Poki, CrazyGames e similares **trazem o player e o anúncio**. Você entrega o build (`npm run build`) no formato que eles pedem (iframe, sem paywall, sem redirect).

1. Publicar um build estático jogável (Cloudflare Pages / GitHub Pages).
2. Ler o guia de desenvolvedor do portal (SDK / `postMessage` / eventos `gameplayStart`, `gameplayStop`).
3. Encaixar o SDK só em `die()` (fim de run) e no primeiro `flap()` (início de run).
4. Enviar o jogo. Eles decidem se promovem.

Receita: fatia do ad do portal. Sem gerir rede, LGPD de anúncio de terceiro, nem layout de banner.

Ponto de código hoje: `CapivaraGame.die()` e `flap()` em `src/engine.js`. Quando for a hora, um módulo `src/ads.js` com no-op no dev:

```js
export const ads = {
  gameplayStart() {},
  gameplayStop() {},
  commercialBreak() { return Promise.resolve() },
}
```

No portal, essas funções chamam o SDK. No `npm run dev`, continuam vazias.

## Caminho 2 — próprio domínio (só com tráfego)

Se o jogo viralizar fora do portal:

| Momento | Formato | Frequência |
| --- | --- | --- |
| Depois do game over | Interstitial ou rewarded (“reviver / ver recorde”) | A cada 3–4 mortes, nunca na 1ª |
| Menu / tela inicial | Banner discreto **fora** do canvas | Opcional |
| Durante a run | Nada | — |

Rewarded (“assista para continuar”) converte melhor que banner, mas precisa de rede que suporte HTML5 rewarded (não é AdSense clássico).

## LGPD / consentimento

Se o anúncio rodar no **seu** domínio com cookies/tracking: banner de consentimento antes do ad. No portal, a política é a deles.

Não identifique o jogador. Recorde já está só em `localStorage`.

## Ordem prática

1. Nome + polish + um URL público estável.
2. Submeter a 1–2 portais.
3. Se recusarem e o tráfego próprio crescer: `src/ads.js` + interstitial no game over.
4. Só então pensar em rewarded / IAP “tirar ads”.

Até o passo 2, zero linha de anúncio no jogo.
