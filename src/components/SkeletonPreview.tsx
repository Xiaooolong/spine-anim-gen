import { useEffect, useRef, useState } from 'react'

type TrackRotate = Array<{ time: number; angle: number }>
type TrackTranslate = Array<{ time: number; x: number; y: number }>
type BoneKeys = Record<string, { rotate?: TrackRotate; translate?: TrackTranslate }>
type BoneDef = { name: string; parent?: string; length?: number }

export default function SkeletonPreview({ animUrl }: { animUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bones, setBones] = useState<BoneKeys | null>(null)
  const [defs, setDefs] = useState<Record<string, BoneDef>>({})

  useEffect(() => {
    const load = async () => {
      const r = await fetch(animUrl)
      if (!r.ok) return
      const j = await r.json()
      const bk: BoneKeys = j.animations?.animation?.bones || {}
      const dfArr: BoneDef[] = j.bones || []
      const df: Record<string, BoneDef> = {}
      dfArr.forEach(b => { df[b.name] = b })
      setBones(bk)
      setDefs(df)
    }
    load()
  }, [animUrl])

  useEffect(() => {
    if (!bones || !defs['hip']) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const duration = (() => {
      let d = 0
      Object.values(bones).forEach(v => {
        v.rotate?.forEach(k => { if (k.time > d) d = k.time })
        v.translate?.forEach(k => { if (k.time > d) d = k.time })
      })
      return d || 1
    })()

    const interpRotate = (tr: TrackRotate | undefined, time: number) => {
      if (!tr || tr.length === 0) return 0
      const idx = tr.findIndex(k => k.time >= time)
      if (idx <= 0) return tr[0].angle
      const k0 = tr[idx - 1], k1 = tr[idx]
      const w = (time - k0.time) / Math.max(k1.time - k0.time, 1e-6)
      return k0.angle + (k1.angle - k0.angle) * Math.min(Math.max(w, 0), 1)
    }

    const interpTranslate = (tt: TrackTranslate | undefined, time: number) => {
      if (!tt || tt.length === 0) return { x: 320, y: 180 }
      const idx = tt.findIndex(k => k.time >= time)
      if (idx <= 0) return { x: tt[0].x, y: tt[0].y }
      const k0 = tt[idx - 1], k1 = tt[idx]
      const w = (time - k0.time) / Math.max(k1.time - k0.time, 1e-6)
      return { x: k0.x + (k1.x - k0.x) * Math.min(Math.max(w, 0), 1), y: k0.y + (k1.y - k0.y) * Math.min(Math.max(w, 0), 1) }
    }

    let t = 0
    const fps = 30
    const orderChains: string[][] = [
      ['hip', 'spine'],
      ['hip', 'front_thigh', 'front_shin'],
      ['hip', 'rear_thigh', 'rear_shin'],
      ['spine', 'front_upper_arm', 'front_lower_arm'],
      ['spine', 'rear_upper_arm', 'rear_lower_arm'],
    ]

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.strokeStyle = '#06f'
      ctx.lineWidth = 3

      const hipR = interpRotate(bones['hip']?.rotate, t)
      const hipT0 = interpTranslate(bones['hip']?.translate, t)
      const hipT = {
        x: Math.max(20, Math.min(canvas.width - 20, hipT0.x)),
        y: Math.max(20, Math.min(canvas.height - 20, hipT0.y)),
      }

      const pos: Record<string, { sx: number; sy: number; ex: number; ey: number; angle: number }> = {}
      const seg = (name: string, parentName?: string) => {
        const def = defs[name]
        const len = def?.length || 60
        const rot = interpRotate(bones[name]?.rotate, t)
        const parentEnd = parentName ? pos[parentName] : undefined
        const sx = parentEnd ? parentEnd.ex : hipT.x
        const sy = parentEnd ? parentEnd.ey : hipT.y
        const baseAng = parentName ? (pos[parentName]?.angle || 0) : hipR
        const ang = baseAng + rot
        const rad = ang * Math.PI / 180
        const ex = sx + Math.cos(rad) * len
        const ey = sy + Math.sin(rad) * len
        pos[name] = { sx, sy, ex, ey, angle: ang }
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }

      orderChains.forEach(chain => {
        for (let i = 0; i < chain.length; i++) {
          const name = chain[i]
          const parent = i === 0 ? undefined : chain[i - 1]
          seg(name, parent)
        }
      })

      t = (t + 1 / fps) % duration
      requestAnimationFrame(draw)
    }
    draw()
  }, [bones, defs])

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-700">Spine骨骼预览（线框）：支持循环播放</div>
      <canvas ref={canvasRef} width={640} height={360} className="border" />
    </div>
  )
}
