import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

type AudioState = {
  analyser: AnalyserNode
  context: AudioContext
  gain: GainNode
  stop: () => void
}

type Bands = {
  bass: number
  mids: number
  highs: number
  energy: number
}

const bpm = 122
const lineCount = 42
const pointsPerLine = 160
const beatLength = 60 / bpm

function createPlaceholderAudio(): AudioState {
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  const master = context.createGain()
  const bass = context.createOscillator()
  const tone = context.createOscillator()
  const air = context.createOscillator()
  const bassGain = context.createGain()
  const toneGain = context.createGain()
  const airGain = context.createGain()

  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0.82

  bass.type = 'sine'
  bass.frequency.value = 55
  tone.type = 'triangle'
  tone.frequency.value = 220
  air.type = 'sawtooth'
  air.frequency.value = 880

  bassGain.gain.value = 0.18
  toneGain.gain.value = 0.035
  airGain.gain.value = 0.012
  master.gain.value = 0.34

  bass.connect(bassGain)
  tone.connect(toneGain)
  air.connect(airGain)
  bassGain.connect(analyser)
  toneGain.connect(analyser)
  airGain.connect(analyser)
  analyser.connect(master)
  master.connect(context.destination)

  bass.start()
  tone.start()
  air.start()

  let raf = 0
  const modulate = () => {
    const t = context.currentTime
    const beat = (t % beatLength) / beatLength
    const kick = Math.exp(-beat * 10)
    const offbeat = Math.exp(-Math.abs(beat - 0.5) * 12)

    bass.frequency.setTargetAtTime(50 + kick * 18, t, 0.018)
    bassGain.gain.setTargetAtTime(0.09 + kick * 0.25, t, 0.018)
    tone.frequency.setTargetAtTime(190 + offbeat * 42, t, 0.08)
    toneGain.gain.setTargetAtTime(0.028 + offbeat * 0.045, t, 0.04)
    airGain.gain.setTargetAtTime(0.007 + Math.max(0, Math.sin(t * 8)) * 0.018, t, 0.04)
    raf = requestAnimationFrame(modulate)
  }

  modulate()

  return {
    analyser,
    context,
    gain: master,
    stop: () => {
      cancelAnimationFrame(raf)
      bass.stop()
      tone.stop()
      air.stop()
      void context.close()
    },
  }
}

function readBands(analyser: AnalyserNode, data: Uint8Array<ArrayBuffer>): Bands {
  analyser.getByteFrequencyData(data)

  const rangeAverage = (start: number, end: number) => {
    let total = 0
    for (let i = start; i < end; i += 1) {
      total += data[i] ?? 0
    }
    return total / Math.max(1, end - start) / 255
  }

  const bass = rangeAverage(1, 7)
  const mids = rangeAverage(8, 34)
  const highs = rangeAverage(35, 112)
  return {
    bass,
    mids,
    highs,
    energy: bass * 0.55 + mids * 0.3 + highs * 0.15,
  }
}

function buildLineGeometry() {
  const positions = new Float32Array(lineCount * (pointsPerLine - 1) * 2 * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return { geometry, positions }
}

export function AudioReactiveHero() {
  const mountRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<AudioState | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const primary = buildLineGeometry()
    const echo = buildLineGeometry()
    const frequencyData = new Uint8Array(new ArrayBuffer(512))

    camera.position.z = 2
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const primaryLines = new THREE.LineSegments(
      primary.geometry,
      new THREE.LineBasicMaterial({
        color: 0xf7f2ea,
        transparent: true,
        opacity: 0.92,
      }),
    )
    const echoLines = new THREE.LineSegments(
      echo.geometry,
      new THREE.LineBasicMaterial({
        color: 0xff3457,
        transparent: true,
        opacity: 0.18,
      }),
    )

    scene.add(echoLines, primaryLines)

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      renderer.setSize(width, height)
      camera.left = -width / height
      camera.right = width / height
      camera.top = 1
      camera.bottom = -1
      camera.updateProjectionMatrix()
    }

    const writeLines = (target: Float32Array, time: number, bands: Bands, offset: number) => {
      let pointer = 0
      const aspect = mount.clientWidth / Math.max(1, mount.clientHeight)
      const width = Math.max(2.1, aspect * 2)
      const vortexPull = 0.22 + bands.bass * 0.52
      const mountainRise = 0.44 + bands.mids * 0.2
      const tunnelSpin = time * (0.12 + bands.energy * 0.16)

      for (let line = 0; line < lineCount; line += 1) {
        const v = line / (lineCount - 1)
        const yBase = -0.82 + v * 1.42
        const spacingCurve = Math.pow(v, 1.35)

        const pointAt = (u: number) => {
          const x = (u - 0.5) * width
          const distance = Math.hypot(x * 0.85, yBase + 0.58)
          const vortex = Math.atan2(yBase + 0.64, x + 0.02) + tunnelSpin
          const funnel = Math.exp(-distance * (2.3 - bands.bass * 0.75))
          const leftPeak = Math.exp(-Math.pow((x + 0.48) * 2.3, 2)) * Math.exp(-Math.pow((yBase - 0.2) * 2.8, 2))
          const rightPeak = Math.exp(-Math.pow((x - 0.28) * 2.0, 2)) * Math.exp(-Math.pow((yBase - 0.28) * 2.5, 2))
          const ridge = Math.max(leftPeak * 0.74, rightPeak)
          const ripple = Math.sin(x * 8.2 + line * 0.72 + time * 1.9) * 0.022 * (0.4 + bands.mids)
          const shimmer = Math.sin(u * pointsPerLine * 0.47 + time * 7 + line) * 0.012 * bands.highs
          const bend = Math.sin(vortex * 3.2 + spacingCurve * 7) * funnel * vortexPull
          const terrain = ridge * mountainRise
          const y = yBase + terrain - funnel * 0.38 + bend + ripple + shimmer + offset

          return [x, y] as const
        }

        for (let point = 0; point < pointsPerLine - 1; point += 1) {
          const current = point / (pointsPerLine - 1)
          const next = (point + 1) / (pointsPerLine - 1)
          const [x1, y1] = pointAt(current)
          const [x2, y2] = pointAt(next)

          target[pointer] = x1
          target[pointer + 1] = y1
          target[pointer + 2] = 0
          target[pointer + 3] = x2
          target[pointer + 4] = y2
          target[pointer + 5] = 0
          pointer += 6
        }
      }
    }

    let frame = 0
    const render = (timeMs: number) => {
      const time = timeMs * 0.001
      const bands = audioRef.current
        ? readBands(audioRef.current.analyser, frequencyData)
        : { bass: 0.12, mids: 0.08, highs: 0.05, energy: 0.08 }

      writeLines(primary.positions, time, bands, 0)
      writeLines(echo.positions, time + 0.1, bands, 0.012 + bands.bass * 0.018)
      primary.geometry.attributes.position.needsUpdate = true
      echo.geometry.attributes.position.needsUpdate = true
      primaryLines.rotation.z = Math.sin(time * 0.2) * 0.015
      echoLines.rotation.z = primaryLines.rotation.z - 0.018 - bands.bass * 0.02
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      primary.geometry.dispose()
      echo.geometry.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  const toggleAudio = async () => {
    if (audioRef.current) {
      audioRef.current.stop()
      audioRef.current = null
      setIsPlaying(false)
      return
    }

    const audio = createPlaceholderAudio()
    audioRef.current = audio
    setIsPlaying(true)
    await audio.context.resume().catch(() => {
      audio.stop()
      audioRef.current = null
      setIsPlaying(false)
    })
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-visual" ref={mountRef} aria-hidden="true" />
      <header className="site-nav" aria-label="Primary navigation">
        <a href="#listen">Listen</a>
        <a href="#about">About</a>
        <a href="#connect">Connect</a>
      </header>
      <div className="hero-content">
        <p className="eyebrow">Producer / Sound Design</p>
        <h1 id="hero-title" aria-label="MARLEAU">
          MARLEΛU
        </h1>
        <button className="play-button" type="button" onClick={toggleAudio}>
          {isPlaying ? 'Pause Signal' : 'Play Signal'}
        </button>
      </div>
      <div className="hero-footer" aria-hidden="true">
        <span>122 BPM</span>
        <span>Placeholder Deep House Signal</span>
      </div>
    </section>
  )
}
