const MUTE_KEY = "capivara-zen-muted"
const STEP = 0.34
const TUNE = [
  523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 659.25, 783.99, 880, 783.99,
  659.25, 523.25, 659.25, 523.25, 392, 0,
]

export class GameAudio {
  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === "1"
    this.ctx = null
    this.master = null
    this.bgmGain = null
    this.noiseBuffer = null
    this.bgmOn = false
    this.melodyIndex = 0
    this.melodyTime = 0
  }

  canPlay() {
    return Boolean(this.ctx && this.master)
  }

  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!this.ctx) {
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 1
      this.master.connect(this.ctx.destination)
      this.noiseBuffer = this.makeNoise(2)
    }
    if (this.ctx.state === "suspended") this.ctx.resume()
  }

  toggleMute() {
    this.muted = !this.muted
    localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0")
    if (!this.muted) this.unlock()
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.03)
    }
    return this.muted
  }

  jump() {
    if (!this.canPlay()) return
    const t = this.ctx.currentTime
    this.tone({ type: "sine", freq: 620, freqEnd: 240, dur: 0.1, gain: 0.16, t })
    this.burst({ dur: 0.08, gain: 0.06, freq: 1400, q: 0.8, t })
  }

  hit() {
    if (!this.canPlay()) return
    const t = this.ctx.currentTime
    this.tone({ type: "triangle", freq: 98, freqEnd: 36, dur: 0.32, gain: 0.22, t })
    this.burst({ dur: 0.22, gain: 0.14, freq: 280, q: 0.55, t })
  }

  plim() {
    if (!this.canPlay()) return
    const t = this.ctx.currentTime
    this.bell(1046.5, t, 0.12, 0.22)
    this.bell(1318.5, t + 0.06, 0.14, 0.2)
    this.bell(1568, t + 0.12, 0.22, 0.18)
  }

  startBgm() {
    if (!this.canPlay()) return
    this.stopBgm()
    this.bgmGain = this.ctx.createGain()
    this.bgmGain.gain.value = 1
    this.bgmGain.connect(this.master)
    this.bgmOn = true
    this.melodyIndex = 0
    this.melodyTime = this.ctx.currentTime + 0.05
    this.fillMelody()
  }

  fillMelody() {
    if (!this.bgmOn || !this.ctx || !this.bgmGain) return
    const now = this.ctx.currentTime
    while (this.melodyTime < now + 1.8) {
      const freq = TUNE[this.melodyIndex % TUNE.length]
      if (freq && this.melodyTime >= now) this.pluck(freq, this.melodyTime)
      this.melodyTime += STEP
      this.melodyIndex += 1
    }
  }

  stopBgm() {
    this.bgmOn = false
    if (this.bgmGain) {
      try {
        this.bgmGain.disconnect()
      } catch {
        /* already disconnected */
      }
    }
    this.bgmGain = null
  }

  duck(amount) {
    if (!this.bgmGain || !this.ctx) return
    this.bgmGain.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.1)
  }

  suspend() {
    if (this.ctx?.state === "running") this.ctx.suspend()
  }

  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume()
    if (this.bgmOn) this.fillMelody()
  }

  destroy() {
    this.stopBgm()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
    this.master = null
  }

  pluck(freq, t) {
    this.bell(freq, t, 0.28, 0.12, this.bgmGain)
    this.bell(freq * 2, t, 0.16, 0.03, this.bgmGain)
  }

  bell(freq, t, dur, gain, dest = this.master) {
    if (!dest) return
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(dest)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  tone({ type, freq, freqEnd, dur, gain, t }) {
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  }

  burst({ dur, gain, freq, q, t }) {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = freq
    filter.Q.value = q
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.03)
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.4
    }
    return buffer
  }
}
