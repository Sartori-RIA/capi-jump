import { useEffect, useRef } from "react"
import { CapivaraGame } from "./engine"
import { copy, isNight, lang } from "./locale"

export default function Game() {
  const canvasRef = useRef(null)
  const text = copy()

  useEffect(() => {
    document.documentElement.lang = lang() === "pt" ? "pt-BR" : "en"
    const theme = document.querySelector('meta[name="theme-color"]')
    if (theme) theme.content = isNight() ? "#0b1730" : "#1c4d4a"

    const canvas = canvasRef.current
    const game = new CapivaraGame(canvas)
    game.start()
    return () => game.destroy()
  }, [])

  return <canvas ref={canvasRef} aria-label={text.aria} />
}
