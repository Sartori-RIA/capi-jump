import { GameAudio } from "./audio"
import { copy, isNight } from "./locale"

const STORAGE_KEY = "capivara-zen-best"
const FRAME = 1000 / 60
const GRAVITY = 0.38
const FLAP = -9.4
const MAX_FALL = 10
const BUOYANCY = 0.42
const SCROLL_BASE = 7.8
const SPEED_EVERY = 10
const SPEED_BUMP = 0.45
const SPEED_BUMPS_MAX = 8

function bestScore() {
  return Number(localStorage.getItem(STORAGE_KEY) || 0)
}

function saveBest(score) {
  const best = Math.max(bestScore(), score)
  localStorage.setItem(STORAGE_KEY, String(best))
  return best
}

function hitbox(capi) {
  return {
    x: capi.x - 18,
    y: capi.y - 14,
    w: 46,
    h: 28,
  }
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function pickKind() {
  return Math.random() < 0.5 ? "gator" : "anaconda"
}

export class CapivaraGame {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")
    this.state = "ready"
    this.score = 0
    this.best = bestScore()
    this.t = 0
    this.running = false
    this.raf = 0
    this.last = 0
    this.obstacles = []
    this.weeds = []
    this.spawnX = 0
    this.capi = { x: 0, y: 0, vy: 0 }
    this.stars = []
    this.copy = copy()
    this.audio = new GameAudio()
    this.onResize = () => this.resize()
    this.onPointer = (event) => {
      event.preventDefault()
      const pos = this.pointerPos(event)
      if (this.hitMute(pos.x, pos.y)) {
        this.audio.toggleMute()
        return
      }
      this.flap()
    }
    this.onKey = (event) => {
      if (event.code === "KeyM") {
        event.preventDefault()
        this.audio.toggleMute()
        return
      }
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault()
        this.flap()
      }
    }
    this.onVisibility = () => {
      if (document.hidden) this.audio.suspend()
      else this.audio.resume()
    }
  }

  start() {
    this.resize()
    window.addEventListener("resize", this.onResize)
    this.canvas.addEventListener("pointerdown", this.onPointer)
    window.addEventListener("keydown", this.onKey)
    document.addEventListener("visibilitychange", this.onVisibility)
    this.reset("ready")
    this.running = true
    this.last = performance.now()
    this.loop()
  }

  destroy() {
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener("resize", this.onResize)
    this.canvas.removeEventListener("pointerdown", this.onPointer)
    window.removeEventListener("keydown", this.onKey)
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.audio.destroy()
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = Math.max(320, this.canvas.clientWidth)
    this.h = Math.max(480, this.canvas.clientHeight)
    this.canvas.width = Math.floor(this.w * dpr)
    this.canvas.height = Math.floor(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.waterY = this.h * 0.7
    this.capi.x = this.w * 0.28
    this.seedStars()
  }

  seedStars() {
    const stars = []
    const count = Math.max(28, Math.floor(this.w / 16))
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: Math.random() * this.w,
        y: 36 + Math.random() * (this.waterY * 0.48),
        r: 0.5 + Math.random() * 1.3,
        phase: Math.random() * Math.PI * 2,
      })
    }
    this.stars = stars
  }

  reset(state = "playing") {
    this.state = state
    this.score = 0
    this.t = 0
    this.capi.y = this.waterY - 24
    this.capi.vy = 0
    this.obstacles = []
    this.weeds = this.seedWeeds()
    this.spawnX = this.w + 40
    this.spawnObstacle()
    this.spawnObstacle()
    if (state === "playing") this.audio.duck(1)
  }

  seedWeeds() {
    const weeds = []
    for (let i = 0; i < 4; i += 1) {
      weeds.push({
        x: 40 + Math.random() * this.w,
        h: 28 + Math.random() * 46,
        phase: Math.random() * Math.PI * 2,
        strands: 1 + Math.floor(Math.random() * 2),
      })
    }
    return weeds
  }

  flap() {
    this.audio.unlock()
    if (this.state === "ready") {
      this.state = "playing"
      this.capi.vy = FLAP
      this.audio.startBgm()
      this.audio.jump()
      return
    }
    if (this.state === "dead") {
      this.reset("playing")
      this.capi.vy = FLAP
      this.audio.startBgm()
      this.audio.jump()
      return
    }
    this.capi.vy = FLAP
    this.audio.jump()
  }

  spawnObstacle() {
    const kind = pickKind()
    const air = Math.max(120, this.waterY - 40)
    const gapY = 70 + Math.random() * (air * 0.58)
    const gapH = Math.max(110, this.waterY - gapY)
    const width = kind === "gator" ? 92 : 68
    this.obstacles.push({
      x: this.spawnX,
      w: width,
      gapY,
      gapH,
      scored: false,
      kind,
      phase: Math.random() * Math.PI * 2,
    })
    this.spawnX += 250 + Math.random() * 90
  }

  speed() {
    const bumps = Math.min(SPEED_BUMPS_MAX, Math.floor(this.score / SPEED_EVERY))
    return SCROLL_BASE + bumps * SPEED_BUMP
  }

  tick(steps) {
    this.t += steps
    if (this.state !== "playing") return

    this.capi.vy = Math.min(MAX_FALL, this.capi.vy + GRAVITY * steps)
    if (this.capi.y > this.waterY) {
      this.capi.vy -= BUOYANCY * steps
    }
    this.capi.y += this.capi.vy * steps

    if (this.capi.y < 28) {
      this.die()
      return
    }
    if (this.capi.y > this.h - 18) {
      this.die()
      return
    }

    const dx = this.speed() * steps
    this.spawnX -= dx
    for (const ob of this.obstacles) {
      ob.x -= dx
      if (!ob.scored && ob.x + ob.w < this.capi.x - 18) {
        ob.scored = true
        this.score += 1
        if (this.score % 10 === 0) this.audio.plim()
      }
    }
    this.obstacles = this.obstacles.filter((ob) => ob.x + ob.w > -80)
    if (this.obstacles.length < 3) this.spawnObstacle()

    for (const weed of this.weeds) {
      weed.x -= dx * 0.55
      if (weed.x < -30) {
        weed.x = this.w + 20
        weed.h = 40 + Math.random() * 70
      }
    }

    const box = hitbox(this.capi)
    for (const ob of this.obstacles) {
      if (ob.kind === "gator") {
        const gator = {
          x: ob.x - 66,
          y: this.waterY - 10,
          w: ob.w + 90,
          h: 38,
        }
        if (overlaps(box, gator)) {
          this.die()
          return
        }
        continue
      }

      const top = { x: ob.x, y: 0, w: ob.w, h: ob.gapY }
      const bottom = {
        x: ob.x,
        y: this.waterY,
        w: ob.w,
        h: this.h - this.waterY,
      }
      if (overlaps(box, top) || overlaps(box, bottom)) {
        this.die()
        return
      }
    }
  }

  die() {
    this.state = "dead"
    this.best = saveBest(this.score)
    this.audio.hit()
    this.audio.duck(0.22)
  }

  loop = (now = performance.now()) => {
    if (!this.running) return
    const dt = Math.min(48, now - this.last)
    this.last = now
    this.tick(dt / FRAME)
    this.audio.fillMelody()
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  draw() {
    const { ctx, w, h, waterY, t, capi, score, best, state } = this
    const night = isNight()
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    if (night) {
      sky.addColorStop(0, "#0b1730")
      sky.addColorStop(0.42, "#16324a")
      sky.addColorStop(1, "#0f2f32")
    } else {
      sky.addColorStop(0, "#f3c98a")
      sky.addColorStop(0.42, "#8ec4a8")
      sky.addColorStop(1, "#1c4d4a")
    }
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    if (night) this.drawStars()
    if (night) this.drawMoon()
    else this.drawSun()
    this.drawCanopy(night)

    for (const ob of this.obstacles) this.drawObstacleTop(ob)

    this.drawWater(waterY, t, night)
    this.drawWeeds()
    for (const ob of this.obstacles) this.drawObstacleBottom(ob)
    this.drawCapybara(capi, t)

    ctx.fillStyle = night ? "rgba(246, 234, 212, 0.88)" : "rgba(20, 24, 18, 0.78)"
    ctx.font = `700 ${Math.max(28, Math.floor(w / 14))}px Trebuchet MS, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(String(score), w / 2, 118)

    if (state === "ready") {
      this.banner(this.copy.title, this.readyHint())
    }
    if (state === "dead") {
      this.banner(this.copy.dead, this.deadHint(score, best))
    }
    this.drawMute()
  }

  pointerPos(event) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.w,
      y: ((event.clientY - rect.top) / rect.height) * this.h,
    }
  }

  muteBox() {
    const size = 40
    return { x: this.w - 56, y: 16, w: size, h: size }
  }

  hitMute(x, y) {
    const b = this.muteBox()
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
  }

  drawMute() {
    const { ctx } = this
    const b = this.muteBox()
    ctx.fillStyle = "rgba(12, 28, 26, 0.55)"
    ctx.beginPath()
    ctx.roundRect(b.x, b.y, b.w, b.h, 10)
    ctx.fill()

    const cx = b.x + 15
    const cy = b.y + b.h / 2
    ctx.fillStyle = "#f6ead4"
    ctx.beginPath()
    ctx.moveTo(cx + 6, cy - 7)
    ctx.lineTo(cx + 6, cy + 7)
    ctx.lineTo(cx - 2, cy + 4)
    ctx.lineTo(cx - 8, cy + 4)
    ctx.lineTo(cx - 8, cy - 4)
    ctx.lineTo(cx - 2, cy - 4)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = "#f6ead4"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    if (this.audio.muted) {
      ctx.beginPath()
      ctx.moveTo(cx + 10, cy - 6)
      ctx.lineTo(cx + 18, cy + 6)
      ctx.moveTo(cx + 18, cy - 6)
      ctx.lineTo(cx + 10, cy + 6)
      ctx.stroke()
      return
    }
    ctx.beginPath()
    ctx.arc(cx + 6, cy, 6, -0.6, 0.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + 6, cy, 11, -0.55, 0.55)
    ctx.stroke()
  }

  usesTouch() {
    return this.w < 720 || window.matchMedia("(pointer: coarse)").matches
  }

  readyHint() {
    const { copy } = this
    if (this.usesTouch()) {
      return [copy.tapJump, copy.dodge]
    }
    return [copy.keyJump, copy.dodge]
  }

  deadHint(score, best) {
    const retry = this.usesTouch() ? this.copy.tapRetry : this.copy.retry
    return [this.copy.scoreLine(score, best), retry]
  }

  drawStars() {
    const { ctx, t } = this
    for (const star of this.stars) {
      ctx.globalAlpha = 0.4 + Math.sin(t / 16 + star.phase) * 0.35
      ctx.fillStyle = "#f4f1de"
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  drawSun() {
    const { ctx, w } = this
    ctx.fillStyle = "rgba(255, 214, 140, 0.85)"
    ctx.beginPath()
    ctx.arc(w * 0.82, 90, 38, 0, Math.PI * 2)
    ctx.fill()
  }

  drawMoon() {
    const { ctx, w } = this
    const x = w * 0.82
    const y = 90
    ctx.fillStyle = "#e8e4d0"
    ctx.beginPath()
    ctx.arc(x, y, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#0b1730"
    ctx.beginPath()
    ctx.arc(x + 9, y - 5, 24, 0, Math.PI * 2)
    ctx.fill()
  }

  drawCanopy(night = false) {
    const { ctx, w } = this
    ctx.fillStyle = night ? "#163528" : "#245c3a"
    ctx.beginPath()
    ctx.moveTo(0, 0)
    for (let x = 0; x <= w; x += 22) {
      const y = 28 + Math.abs(Math.sin(x / 38)) * 18
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, 0)
    ctx.closePath()
    ctx.fill()
  }

  drawWeeds() {
    const { ctx, h, t, waterY } = this
    ctx.globalAlpha = 0.45
    for (const weed of this.weeds) {
      for (let s = 0; s < weed.strands; s += 1) {
        const x = weed.x + s * 9
        ctx.strokeStyle = "#163f32"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, h)
        const sway = Math.sin(t / 22 + weed.phase + s) * 8
        ctx.quadraticCurveTo(x + sway, h - weed.h * 0.55, x + sway * 0.3, waterY + 28 + weed.h * 0.15)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  drawWater(waterY, t, night = false) {
    const { ctx, w, h } = this
    const water = ctx.createLinearGradient(0, waterY, 0, h)
    if (night) {
      water.addColorStop(0, "rgba(18, 70, 78, 0.62)")
      water.addColorStop(0.35, "rgba(8, 36, 42, 0.9)")
      water.addColorStop(1, "#07181c")
    } else {
      water.addColorStop(0, "rgba(46, 120, 118, 0.55)")
      water.addColorStop(0.35, "rgba(22, 78, 72, 0.82)")
      water.addColorStop(1, "#0f2f32")
    }
    ctx.fillStyle = water
    ctx.beginPath()
    ctx.moveTo(0, waterY)
    for (let x = 0; x <= w; x += 8) {
      const y = waterY + Math.sin(x / 28 + t / 14) * 4
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = night ? "rgba(160, 210, 220, 0.22)" : "rgba(200, 240, 230, 0.35)"
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = waterY + Math.sin(x / 28 + t / 14) * 4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  drawObstacleTop(ob) {
    if (ob.kind === "anaconda") this.drawAnacondaTop(ob)
  }

  drawObstacleBottom(ob) {
    if (ob.kind === "gator") this.drawGator(ob)
    else this.drawAnacondaBottom(ob)
  }

  drawGator(ob) {
    const { ctx, waterY, t } = this
    const y = waterY - 8 + Math.sin(t / 32 + (ob.phase || 0)) * 1.2
    const x = ob.x - 10
    const len = ob.w + 36

    ctx.save()
    ctx.translate(x, y)

    ctx.fillStyle = "#2f5728"
    ctx.beginPath()
    ctx.moveTo(len - 18, 16)
    ctx.lineTo(len + 22, 6)
    ctx.lineTo(len + 34, 14)
    ctx.lineTo(len + 18, 18)
    ctx.lineTo(len + 30, 26)
    ctx.lineTo(len - 14, 24)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#2a4d24"
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath()
      ctx.moveTo(len - 4 + i * 10, 14)
      ctx.lineTo(len + 2 + i * 10, 6)
      ctx.lineTo(len + 8 + i * 10, 14)
      ctx.fill()
    }

    ctx.fillStyle = "#3c6b32"
    ctx.beginPath()
    ctx.roundRect(8, 10, len - 22, 22, 11)
    ctx.fill()

    ctx.fillStyle = "#6b8f3a"
    ctx.beginPath()
    ctx.roundRect(22, 24, len - 52, 8, 4)
    ctx.fill()

    ctx.fillStyle = "#2a4d24"
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath()
      ctx.moveTo(24 + i * 14, 12)
      ctx.lineTo(30 + i * 14, 1)
      ctx.lineTo(36 + i * 14, 12)
      ctx.fill()
    }

    ctx.fillStyle = "#4a7d3c"
    ctx.beginPath()
    ctx.roundRect(-4, 6, 28, 22, 8)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(6, 13)
    ctx.lineTo(-46, 13)
    ctx.quadraticCurveTo(-56, 13, -56, 18)
    ctx.lineTo(-50, 22)
    ctx.lineTo(6, 22)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#355c2c"
    ctx.beginPath()
    ctx.moveTo(4, 21)
    ctx.lineTo(-42, 21)
    ctx.quadraticCurveTo(-48, 21, -48, 24)
    ctx.lineTo(-42, 27)
    ctx.lineTo(4, 27)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = "#f0ead8"
    for (let i = 0; i < 4; i += 1) {
      const tx = -38 + i * 10
      ctx.beginPath()
      ctx.moveTo(tx, 22)
      ctx.lineTo(tx + 3, 28)
      ctx.lineTo(tx + 6, 22)
      ctx.fill()
    }

    ctx.fillStyle = "#1a120c"
    ctx.beginPath()
    ctx.arc(-46, 16, 1.6, 0, Math.PI * 2)
    ctx.arc(-40, 16, 1.6, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#2a4d24"
    ctx.beginPath()
    ctx.ellipse(10, 5, 7, 6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#1a120c"
    ctx.beginPath()
    ctx.arc(10, 4, 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#e8f08a"
    ctx.beginPath()
    ctx.arc(11, 3.2, 1.1, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  drawAnacondaTop(ob) {
    const start = { x: ob.x + ob.w * 0.5, y: 2 }
    const c1 = { x: ob.x - 18, y: ob.gapY * 0.32 }
    const c2 = { x: ob.x + ob.w + 22, y: ob.gapY * 0.68 }
    const end = { x: ob.x + ob.w * 0.45, y: ob.gapY }
    this.strokeSnake(start, c1, c2, end)
    const angle = Math.atan2(end.y - c2.y, end.x - c2.x)
    this.drawSnakeHead(end.x, end.y, angle)
  }

  drawAnacondaBottom(ob) {
    const { h, waterY } = this
    const start = { x: ob.x + ob.w * 0.55, y: h - 8 }
    const c1 = { x: ob.x - 24, y: (waterY + h) * 0.62 }
    const c2 = { x: ob.x + ob.w + 28, y: waterY + 36 }
    const end = { x: ob.x + 10, y: waterY + 8 }
    this.strokeSnake(start, c1, c2, end)
    const angle = Math.atan2(end.y - c2.y, end.x - c2.x)
    this.drawSnakeHead(end.x, end.y, angle)
  }

  strokeSnake(start, c1, c2, end) {
    const { ctx } = this
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#5d7f24"
    ctx.lineWidth = 18
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y)
    ctx.stroke()
    ctx.strokeStyle = "#8fb83a"
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.strokeStyle = "#d4e878"
    ctx.lineWidth = 3
    ctx.setLineDash([8, 16])
    ctx.stroke()
    ctx.setLineDash([])
  }

  drawSnakeHead(x, y, angle) {
    const { ctx } = this
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.fillStyle = "#7aa32e"
    ctx.beginPath()
    ctx.ellipse(12, 0, 15, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#1a120c"
    ctx.beginPath()
    ctx.arc(16, -3, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#f2ead0"
    ctx.beginPath()
    ctx.arc(16.6, -3.6, 0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#c45c3a"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(26, 0)
    ctx.lineTo(36, -5)
    ctx.moveTo(26, 0)
    ctx.lineTo(36, 5)
    ctx.stroke()
    ctx.restore()
  }

  drawCapybara(capi, t) {
    const { ctx, waterY } = this
    const angle = Math.max(-0.45, Math.min(0.45, capi.vy / 14))
    ctx.save()
    ctx.translate(capi.x, capi.y)
    ctx.rotate(angle)

    if (capi.y > waterY - 6) {
      ctx.fillStyle = "rgba(180, 230, 220, 0.35)"
      ctx.beginPath()
      ctx.ellipse(4, 18, 28 + Math.sin(t / 6) * 3, 6, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.fillStyle = "#a8642e"
    ctx.beginPath()
    ctx.ellipse(-4, 14, 7, 5, 0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(10, 15, 7, 5, 0.2, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#b56a32"
    ctx.beginPath()
    ctx.ellipse(-4, 6, 26, 16, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#c47a3a"
    ctx.beginPath()
    ctx.arc(14, -2, 16, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#a8642e"
    ctx.beginPath()
    ctx.arc(8, -16, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(20, -14, 5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#e8b07a"
    ctx.beginPath()
    ctx.ellipse(26, 3, 9, 5.5, -0.15, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "#1a120c"
    ctx.beginPath()
    ctx.arc(18, -4, 2.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.arc(18.8, -4.8, 0.9, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  banner(title, lines) {
    const { ctx, w, h } = this
    const subtitles = Array.isArray(lines) ? lines : [lines]
    ctx.fillStyle = "rgba(12, 28, 26, 0.72)"
    const boxW = Math.min(w - 32, 420)
    const boxH = 92 + subtitles.length * 26
    const x = (w - boxW) / 2
    const y = h * 0.32
    ctx.beginPath()
    ctx.roundRect(x, y, boxW, boxH, 18)
    ctx.fill()
    ctx.fillStyle = "#f6ead4"
    ctx.font = "700 28px Trebuchet MS, sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(title, w / 2, y + 44)
    ctx.fillStyle = "#c9e6df"
    ctx.font = "16px Trebuchet MS, sans-serif"
    subtitles.forEach((line, i) => {
      ctx.fillText(line, w / 2, y + 72 + i * 24)
    })
  }
}
