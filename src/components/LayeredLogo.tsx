import { type PointerEvent, useEffect, useRef } from 'react'

type LayeredLogoProps = {
  isPlaying?: boolean
}

const textureSize = { width: 1445, height: 962 }

const vertexShaderSource = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_cursor;
uniform vec2 u_cursor2;
uniform float u_cursorIntensity;
uniform float u_cursorIntensity2;
uniform float u_audio;
uniform float u_time;

varying vec2 v_uv;

void main() {
  vec2 uv = v_uv;
  vec2 cursor = vec2(u_cursor.x, 1.0 - u_cursor.y);
  vec2 delta = uv - cursor;
  float dist = length(delta);
  float radius = 0.28;
  float local = smoothstep(radius, 0.0, dist);
  local = local * local * (3.0 - 2.0 * local);
  local *= u_cursorIntensity;
  vec2 dir = dist > 0.0001 ? delta / dist : vec2(0.0);
  float falloff = max(0.0, 1.0 - dist / radius);
  falloff *= falloff;
  float ripple = sin(dist * 24.0 - u_time * 1.65) * 0.0055;
  float elasticPull = falloff * 0.021;
  vec2 cursorWarp = dir * (ripple + elasticPull) * local;

  vec2 cursor2 = vec2(u_cursor2.x, 1.0 - u_cursor2.y);
  vec2 delta2 = uv - cursor2;
  float dist2 = length(delta2);
  float radius2 = 0.22;
  float local2 = smoothstep(radius2, 0.0, dist2);
  local2 = local2 * local2 * (3.0 - 2.0 * local2);
  local2 *= u_cursorIntensity2;
  vec2 dir2 = dist2 > 0.0001 ? delta2 / dist2 : vec2(0.0);
  float falloff2 = max(0.0, 1.0 - dist2 / radius2);
  falloff2 *= falloff2;
  float ripple2 = sin(dist2 * 20.0 - u_time * 1.2) * 0.0038;
  float elasticPull2 = falloff2 * 0.014;
  cursorWarp += dir2 * (ripple2 + elasticPull2) * local2;

  float rollProgress = fract(u_time * 0.12);
  float contourCoord = uv.y + sin((uv.x - 0.5) * 3.4) * 0.045;
  vec2 lineDirection = normalize(vec2(0.22 + sin(uv.y * 6.0) * 0.08, -1.0));

  float primaryCenter = rollProgress;
  float primarySignedDistance = fract(contourCoord - primaryCenter + 0.5) - 0.5;
  float primaryDistance = abs(primarySignedDistance);
  float primaryBand = smoothstep(0.14, 0.0, primaryDistance);
  primaryBand = primaryBand * primaryBand * (3.0 - 2.0 * primaryBand);
  float primaryMotion = sin(primarySignedDistance * 10.0) * primaryBand;

  float secondaryProgress = fract(rollProgress + 0.25);
  float secondaryCenter = secondaryProgress;
  float secondarySignedDistance = fract(contourCoord - secondaryCenter + 0.5) - 0.5;
  float secondaryDistance = abs(secondarySignedDistance);
  float secondaryBand = smoothstep(0.14, 0.0, secondaryDistance);
  secondaryBand = secondaryBand * secondaryBand * (3.0 - 2.0 * secondaryBand);
  float secondaryMotion = sin(secondarySignedDistance * 10.0) * secondaryBand;

  float tertiaryProgress = fract(rollProgress + 0.5);
  float tertiaryCenter = tertiaryProgress;
  float tertiarySignedDistance = fract(contourCoord - tertiaryCenter + 0.5) - 0.5;
  float tertiaryDistance = abs(tertiarySignedDistance);
  float tertiaryBand = smoothstep(0.14, 0.0, tertiaryDistance);
  tertiaryBand = tertiaryBand * tertiaryBand * (3.0 - 2.0 * tertiaryBand);
  float tertiaryMotion = sin(tertiarySignedDistance * 10.0) * tertiaryBand;

  float quaternaryProgress = fract(rollProgress + 0.75);
  float quaternaryCenter = quaternaryProgress;
  float quaternarySignedDistance = fract(contourCoord - quaternaryCenter + 0.5) - 0.5;
  float quaternaryDistance = abs(quaternarySignedDistance);
  float quaternaryBand = smoothstep(0.14, 0.0, quaternaryDistance);
  quaternaryBand = quaternaryBand * quaternaryBand * (3.0 - 2.0 * quaternaryBand);
  float quaternaryMotion = sin(quaternarySignedDistance * 10.0) * quaternaryBand;

  float ambientMotion =
    sin(contourCoord * 20.0 - u_time * 0.95) * 0.55 +
    sin(uv.x * 12.0 + uv.y * 7.0 + u_time * 0.62) * 0.28;
  vec2 fieldPull =
    lineDirection * (primaryMotion + secondaryMotion + tertiaryMotion + quaternaryMotion) * 0.00484 +
    lineDirection * ambientMotion * 0.00143;
  vec2 baseUv = clamp(
    uv + cursorWarp + fieldPull * u_audio,
    vec2(0.0),
    vec2(1.0)
  );
  vec4 baseColor = texture2D(u_texture, baseUv);

  gl_FragColor = baseColor;
}
`

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function damp(current: number, target: number, smoothing: number, deltaSeconds: number) {
  return current + (target - current) * (1 - Math.exp(-smoothing * deltaSeconds))
}

type LogoGL = WebGLRenderingContext | WebGL2RenderingContext

function getLogoContext(canvas: HTMLCanvasElement) {
  const glOptions: WebGLContextAttributes = {
    alpha: false,
    antialias: true,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false,
  }

  return canvas.getContext('webgl2', glOptions) ?? canvas.getContext('webgl', glOptions)
}

function createShader(gl: LogoGL, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create WebGL shader')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(message)
  }

  return shader
}

function createProgram(gl: LogoGL) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create WebGL program')

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown WebGL link error'
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

export function LayeredLogo({ isPlaying = true }: LayeredLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef({
    intensity: 0,
    intensity2: 0,
    targetIntensity: 0,
    targetIntensity2: 0,
    targetX: 0.5,
    targetX2: 0.64,
    targetY: 0.68,
    targetY2: 0.56,
    x: 0.5,
    x2: 0.64,
    y: 0.68,
    y2: 0.56,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const gl = getLogoContext(canvas)
    if (!gl) return

    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches
    let animationFrame = 0
    let disposed = false
    let lastTimestamp = 0
    let audioAmount = 0

    const program = createProgram(gl)
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const textureLocation = gl.getUniformLocation(program, 'u_texture')
    const cursorLocation = gl.getUniformLocation(program, 'u_cursor')
    const cursor2Location = gl.getUniformLocation(program, 'u_cursor2')
    const cursorIntensityLocation = gl.getUniformLocation(program, 'u_cursorIntensity')
    const cursorIntensity2Location = gl.getUniformLocation(program, 'u_cursorIntensity2')
    const audioLocation = gl.getUniformLocation(program, 'u_audio')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const buffer = gl.createBuffer()
    const texture = gl.createTexture()

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(textureSize.width * dpr)
      const height = Math.round(textureSize.height * dpr)

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const render = (timestamp: number) => {
      const deltaSeconds = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 1 / 60
      lastTimestamp = timestamp
      const time = timestamp / 1000
      const cursor = cursorRef.current

      if (cursor.targetIntensity < 0.65) {
        cursor.targetIntensity = hasCoarsePointer ? 0.42 : 0.26
        cursor.targetX = 0.5 + Math.sin(time * 0.32) * 0.2
        cursor.targetY = 0.64 + Math.cos(time * 0.24) * 0.18
      }

      const secondaryOffsetX = Math.sin(time * 0.74) * 0.16
      const secondaryOffsetY = Math.cos(time * 0.58) * 0.12
      cursor.targetX2 = clamp(cursor.targetX + secondaryOffsetX, 0.05, 0.95)
      cursor.targetY2 = clamp(cursor.targetY + secondaryOffsetY, 0.05, 0.95)
      cursor.targetIntensity2 = cursor.targetIntensity * 0.72

      cursor.x = damp(cursor.x, cursor.targetX, 8, deltaSeconds)
      cursor.y = damp(cursor.y, cursor.targetY, 8, deltaSeconds)
      cursor.x2 = damp(cursor.x2, cursor.targetX2, 4.5, deltaSeconds)
      cursor.y2 = damp(cursor.y2, cursor.targetY2, 4.5, deltaSeconds)
      cursor.intensity = damp(cursor.intensity, cursor.targetIntensity, 7, deltaSeconds)
      cursor.intensity2 = damp(cursor.intensity2, cursor.targetIntensity2, 5, deltaSeconds)

      audioAmount = damp(audioAmount, 1, 1.5, deltaSeconds)

      resize()
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(textureLocation, 0)
      gl.uniform2f(cursorLocation, cursor.x, cursor.y)
      gl.uniform2f(cursor2Location, cursor.x2, cursor.y2)
      gl.uniform1f(cursorIntensityLocation, cursor.intensity)
      gl.uniform1f(cursorIntensity2Location, cursor.intensity2)
      gl.uniform1f(audioLocation, audioAmount)
      gl.uniform1f(timeLocation, time)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      animationFrame = requestAnimationFrame(render)
    }

    const image = new Image()
    image.onload = () => {
      if (disposed) return

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      animationFrame = requestAnimationFrame(render)
    }
    image.src = '/marleau-component-lines@3x-gapfix.png'

    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
      gl.deleteBuffer(buffer)
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    }
  }, [])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    const y = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1)

    cursorRef.current.targetIntensity = 1
    cursorRef.current.targetX = x
    cursorRef.current.targetY = y
  }

  const handlePointerLeave = () => {
    cursorRef.current.targetIntensity = 0
  }

  const handlePointerUp = () => {
    cursorRef.current.targetIntensity = 0
  }

  return (
    <div
      className={isPlaying ? 'layered-logo is-playing' : 'layered-logo'}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg aria-hidden="true" className="hero-wordmark" viewBox="0 0 954 104">
        <path d="M0 100V0h24l31 50L86 0h24v100H84V43L64 78H47L26 43v57H0Z" />
        <path
          d="M150 100 187 0h28l37 100h-29l-7-20h-31l-7 20h-28Zm42-42h17l-8-27-9 27Z"
          fillRule="evenodd"
        />
        <path
          d="M292 100V0h68c32 0 50 17 50 42 0 19-10 33-29 39l33 19h-40l-28-16h-25v16h-29Zm29-77v38h36c16 0 25-7 25-19s-9-19-25-19h-36Z"
          fillRule="evenodd"
        />
        <path d="M448 100V0h29v75h63v25h-92Z" />
        <path d="M575 100V0h92v24h-63v15h56v23h-56v14h65v24h-94Z" />
        <path d="M704 100 741 0h28l37 100h-29l-22-66-23 66h-28Z" />
        <path d="M854 0h29v64c0 10 8 16 21 16s21-6 21-16V0h29v66c0 25-19 38-50 38s-50-13-50-38V0Z" />
      </svg>
      <canvas
        aria-hidden="true"
        className="layered-logo-inner layered-logo-canvas"
        height={textureSize.height}
        ref={canvasRef}
        width={textureSize.width}
      />
    </div>
  )
}
