import { useEffect, useRef } from "react"
import { CapivaraGame } from "./engine"

export default function Game() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const game = new CapivaraGame(canvas)
    game.start()
    return () => game.destroy()
  }, [])

  return <canvas ref={canvasRef} aria-label="Capi Jump" />
}
