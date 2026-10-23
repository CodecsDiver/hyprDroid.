import { CanvasTexture, SRGBColorSpace } from 'three'

function makeCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function dotTexture(): CanvasTexture {
  return makeCanvas(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  })
}

export function sparkTexture(): CanvasTexture {
  return makeCanvas(64, (ctx, s) => {
    const c = s / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.4)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.fillRect(c - 1, 4, 2, s - 8)
    ctx.fillRect(4, c - 1, s - 8, 2)
  })
}

export function heartTexture(): CanvasTexture {
  return makeCanvas(64, (ctx, s) => {
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(255,255,255,0.8)'
    ctx.shadowBlur = 6
    ctx.beginPath()
    const c = s / 2
    ctx.moveTo(c, s * 0.82)
    ctx.bezierCurveTo(s * 0.05, s * 0.5, s * 0.2, s * 0.1, c, s * 0.32)
    ctx.bezierCurveTo(s * 0.8, s * 0.1, s * 0.95, s * 0.5, c, s * 0.82)
    ctx.fill()
  })
}

export function envelopeTexture(): CanvasTexture {
  return makeCanvas(96, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,214,150,0.55)')
    g.addColorStop(1, 'rgba(255,214,150,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    ctx.fillStyle = '#fff3dc'
    ctx.strokeStyle = '#b8763a'
    ctx.lineWidth = 2
    ctx.fillRect(s * 0.24, s * 0.34, s * 0.52, s * 0.34)
    ctx.strokeRect(s * 0.24, s * 0.34, s * 0.52, s * 0.34)
    ctx.beginPath()
    ctx.moveTo(s * 0.24, s * 0.34)
    ctx.lineTo(s * 0.5, s * 0.55)
    ctx.lineTo(s * 0.76, s * 0.34)
    ctx.stroke()
    ctx.fillStyle = '#ff7aaa'
    ctx.beginPath()
    ctx.arc(s * 0.5, s * 0.55, 4, 0, Math.PI * 2)
    ctx.fill()
  })
}
