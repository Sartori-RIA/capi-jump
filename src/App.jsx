import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import Game from "./Game.jsx"
import "./App.css"

export default function App() {
  return (
    <>
      <Game />
      <Analytics />
      <SpeedInsights />
    </>
  )
}
