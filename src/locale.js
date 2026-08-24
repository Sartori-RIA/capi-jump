const COPY = {
  pt: {
    title: "Capi Jump",
    dead: "foi de arrasta.",
    dodge: "desvia de jacaré e cobra",
    tapJump: "toque na tela para pular",
    keyJump: "toque · espaço · ↑ para pular",
    tapRetry: "toque na tela para tentar",
    retry: "toque para tentar",
    scoreLine: (score, best) => `score ${score}   recorde ${best}`,
    aria: "Capi Jump",
  },
  en: {
    title: "Capi Jump",
    dead: "went splat.",
    dodge: "dodge the gator and the snake",
    tapJump: "tap the screen to jump",
    keyJump: "tap · space · ↑ to jump",
    tapRetry: "tap the screen to retry",
    retry: "tap to retry",
    scoreLine: (score, best) => `score ${score}   best ${best}`,
    aria: "Capi Jump",
  },
}

function query(name) {
  try {
    return new URLSearchParams(window.location.search).get(name)
  } catch {
    return null
  }
}

export function lang() {
  const forced = query("lang")
  if (forced === "en" || forced === "pt") return forced
  const nav = String(navigator.language || "en").toLowerCase()
  return nav.startsWith("pt") ? "pt" : "en"
}

export function copy() {
  return COPY[lang()]
}

export function isNight() {
  const forced = query("night")
  if (forced === "1") return true
  if (forced === "0") return false
  const hour = new Date().getHours()
  return hour < 6 || hour >= 19
}
