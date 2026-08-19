import {
  BALL_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  flipperSegment,
  type Segment,
} from './table.ts'
import {
  REBUILD_DURATION,
  activeSegments,
  currentConfig,
  type GlassworksState,
} from './simulation.ts'
import { glowDot, neonLine, strokeNeonPath } from '../../lib/neon.ts'
import { renderParticles, type Juice } from '../../lib/juice.ts'

export function render(
  ctx: CanvasRenderingContext2D,
  state: GlassworksState,
  juice: Juice,
  width: number,
  height: number,
): void {
  ctx.fillStyle = '#05030d'
  ctx.fillRect(0, 0, width, height)

  const scale = Math.min(width / TABLE_WIDTH, height / TABLE_HEIGHT) * 0.96
  const offsetX = (width - TABLE_WIDTH * scale) / 2
  const offsetY = (height - TABLE_HEIGHT * scale) / 2

  ctx.save()
  ctx.translate(offsetX + juice.shakeX, offsetY + juice.shakeY)
  ctx.scale(scale, scale)

  drawPlayfield(ctx, state)
  drawBumpers(ctx, state)
  drawSegments(ctx, state)
  drawFlippers(ctx, state)
  drawBalls(ctx, state)
  renderParticles(ctx, juice.particles)

  ctx.restore()

  drawStatus(ctx, state, width, height)
}

function drawPlayfield(ctx: CanvasRenderingContext2D, state: GlassworksState): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT)
  gradient.addColorStop(0, 'rgba(255, 0, 255, 0.07)')
  gradient.addColorStop(0.5, 'rgba(60, 20, 90, 0.05)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT)

  // Mission progress reads as lit panes in the glass.
  const config = currentConfig(state)
  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.strokeStyle = '#ff5ce1'
  ctx.lineWidth = 0.08
  for (let y = 6; y < TABLE_HEIGHT; y += 6) {
    ctx.beginPath()
    ctx.moveTo(2, y)
    ctx.lineTo(TABLE_WIDTH - 2, y)
    ctx.stroke()
  }
  ctx.restore()
  void config
}

function drawSegments(ctx: CanvasRenderingContext2D, state: GlassworksState): void {
  const flipperSegs = state.flippers.map(flipperSegment)
  const isFlipper = (segment: Segment) =>
    flipperSegs.some((f) => f.x1 === segment.x1 && f.y1 === segment.y1
      && f.x2 === segment.x2 && f.y2 === segment.y2)

  for (const segment of activeSegments(state)) {
    if (isFlipper(segment)) continue

    let colour = '#6f7bbf'
    let glow = 0.7
    let width = 0.28

    if (segment.kind === 'target') {
      const hit = segment.id ? state.hitTargets.has(segment.id) : false
      colour = hit ? '#3dff9e' : '#ffd166'
      glow = hit ? 2.2 : 1.6
      width = 0.42
    } else if (segment.kind === 'diverter') {
      colour = '#ff5ce1'
      glow = 2
      width = 0.4
    } else if (segment.kind === 'sling') {
      colour = '#ff9ff3'
      glow = 1.2
      width = 0.34
    }

    neonLine(ctx, segment.x1, segment.y1, segment.x2, segment.y2, { color: colour, width, glow })
  }
}

function drawBumpers(ctx: CanvasRenderingContext2D, state: GlassworksState): void {
  for (const bumper of currentConfig(state).bumpers) {
    const pulse = 0.9 + Math.sin(state.elapsed * 4 + bumper.x) * 0.08
    ctx.beginPath()
    ctx.arc(bumper.x, bumper.y, bumper.radius * pulse, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 92, 225, 0.12)'
    ctx.fill()
    strokeNeonPath(ctx, { color: '#ff5ce1', width: 0.26, glow: 1.6 })

    ctx.beginPath()
    ctx.arc(bumper.x, bumper.y, bumper.radius * 0.42, 0, Math.PI * 2)
    strokeNeonPath(ctx, { color: '#ffffff', width: 0.16, glow: 1.2, alpha: 0.7 })
  }
}

function drawFlippers(ctx: CanvasRenderingContext2D, state: GlassworksState): void {
  for (const flipper of state.flippers) {
    const segment = flipperSegment(flipper)
    const active = Math.abs(flipper.angularVelocity) > 0.5
    neonLine(ctx, segment.x1, segment.y1, segment.x2, segment.y2, {
      color: state.tilted ? '#6b6b7a' : active ? '#ffffff' : '#00fff2',
      width: 0.95,
      glow: active ? 2.4 : 1.3,
    })
    glowDot(ctx, flipper.pivotX, flipper.pivotY, 0.42, '#00fff2', 1)
  }
}

function drawBalls(ctx: CanvasRenderingContext2D, state: GlassworksState): void {
  for (const ball of state.balls) {
    if (!ball.active) continue
    // A short trail communicates speed without needing motion blur.
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed > 6) {
      const trail = Math.min(speed * 0.035, 2.6)
      neonLine(
        ctx,
        ball.x - (ball.vx / speed) * trail,
        ball.y - (ball.vy / speed) * trail,
        ball.x, ball.y,
        { color: '#dfe6ff', width: BALL_RADIUS * 1.1, glow: 1.2, alpha: 0.45 },
      )
    }
    glowDot(ctx, ball.x, ball.y, BALL_RADIUS, '#ffffff', 1.5)
  }
}

/** In-world announcements only: the HUD carries score, balls and the tilt meter. */
function drawStatus(
  ctx: CanvasRenderingContext2D,
  state: GlassworksState,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.textAlign = 'center'

  if (state.multiball) {
    ctx.font = '11px Orbitron, monospace'
    ctx.fillStyle = '#ff5ce1'
    ctx.fillText('MULTIBALL', width / 2, 84)
  }

  if (state.tilted) {
    ctx.font = '28px Orbitron, monospace'
    ctx.fillStyle = '#ff4d6d'
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(state.elapsed * 12)
    ctx.fillText('TILT', width / 2, height / 2)
    ctx.globalAlpha = 1
  }

  if (state.phase === 'plunger') {
    // Kept high in the frame so it never sits over the flippers, which is
    // where the on-screen controls live on a touch device.
    ctx.font = '10px Orbitron, monospace'
    ctx.fillStyle = 'rgba(233,236,245,0.6)'
    ctx.fillText('HOLD TO CHARGE — RELEASE TO LAUNCH', width / 2, 104)

    const barWidth = 150
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(width / 2 - barWidth / 2, 112, barWidth, 5)
    ctx.fillStyle = '#00fff2'
    ctx.fillRect(width / 2 - barWidth / 2, 112, barWidth * state.plungerPower, 5)
  }

  if (state.phase === 'rebuilding') {
    const progress = 1 - state.rebuildTimer / REBUILD_DURATION
    ctx.font = '30px Orbitron, monospace'
    ctx.fillStyle = '#ff5ce1'
    ctx.globalAlpha = Math.sin(progress * Math.PI)
    ctx.fillText('REBUILDING', width / 2, height / 2 - 16)
    ctx.font = '13px Orbitron, monospace'
    ctx.fillStyle = '#e9ecf5'
    ctx.fillText(currentConfig(state).name, width / 2, height / 2 + 12)
  }

  ctx.restore()
}
