import { useEffect, useMemo, useState } from 'react'
import { getJob, getArtifacts } from '@/api/jobs'
import SpinePixiPreview from '@/components/SpinePixiPreview'
import { useParams, Link } from 'react-router-dom'

type Artifact = { name: string; type: string; url: string; size: number }

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState<any>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [origErr, setOrigErr] = useState<string>('')
  const [overlayErr, setOverlayErr] = useState<string>('')
  const [origSrc, setOrigSrc] = useState<string | null>(null)
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null)

  useEffect(() => {
    let timer: any
    const poll = async () => {
      if (!id) return
      let statusVal: string | undefined
      try {
        const j = await getJob(id)
        if (!j) {
          setJob({ id, status: 'FAILED', progress: 0, error: '任务不存在或已过期' })
          return
        }
        setJob(j)
        statusVal = j.status
      } catch (_e) {
        setJob((prev: any) => ({ ...(prev || {}), id, status: 'FAILED', error: '接口不可用或代理异常' }))
        return
      }
      const a = await getArtifacts(id)
      setArtifacts(prev => {
        if (prev.length === a.length && prev.every((p, i) => p.name === a[i].name && p.url === a[i].url && p.size === a[i].size)) {
          return prev
        }
        return a
      })
      if (statusVal !== 'SUCCEEDED' && statusVal !== 'FAILED') {
        timer = setTimeout(poll, 1500)
      }
    }
    poll()
    return () => timer && clearTimeout(timer)
  }, [id])

  const url = (name: string) => artifacts.find(a => a.name === name)?.url
  const assetUrl = (u?: string | null) => u || (u as any)

  useEffect(() => {
    setOrigSrc(null); setOverlaySrc(null); setOrigErr(''); setOverlayErr('')
  }, [id])

  useEffect(() => {
    const u1 = assetUrl(url('original.mp4'))
    if (!origSrc && u1) setOrigSrc(u1)
    const u2 = assetUrl(url('pose_overlay.mp4'))
    if (!overlaySrc && u2) setOverlaySrc(u2)
  }, [artifacts, origSrc, overlaySrc])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">任务详情 #{id}</h1>
        <Link to="/jobs" className="text-blue-600">返回列表</Link>
      </div>
      <div>状态：{job?.status} · 进度：{job?.progress}%</div>
      {job?.error && (
        <div className="text-red-600 text-sm">错误：{job.error}</div>
      )}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h2 className="font-medium mb-2">原视频</h2>
          {origSrc ? (
            <>
              <video src={origSrc} controls preload="metadata" playsInline crossOrigin="anonymous" className="w-full border" onError={() => setOrigErr('资源加载失败')} />
              {origErr && (
                <div className="text-sm text-red-600">原视频加载失败，尝试直接打开：<a className="underline" href={origSrc} target="_blank" rel="noreferrer">链接</a></div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">生成中...</div>
          )}
        </div>
        <div>
          <h2 className="font-medium mb-2">Pose Overlay</h2>
          {overlaySrc ? (
            <>
              <video src={overlaySrc} controls preload="metadata" playsInline crossOrigin="anonymous" className="w-full border" onError={() => setOverlayErr('资源加载失败')} />
              {overlayErr && (
                <div className="text-sm text-red-600">覆盖视频加载失败，尝试直接打开：<a className="underline" href={overlaySrc} target="_blank" rel="noreferrer">链接</a></div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">生成中...</div>
          )}
        </div>
        <div>
          <h2 className="font-medium mb-2">Spine预览</h2>
          {url('spine_animation.json') ? (
            <SpinePixiPreview animUrl={url('spine_animation.json')!} />
          ) : (
            <div className="text-sm text-gray-600">生成中...</div>
          )}
        </div>
      </div>
      <div>
          <h2 className="font-medium mb-2">下载</h2>
          <div className="flex flex-wrap gap-2">
            {artifacts.map(a => (
              <a key={a.name} href={assetUrl(a.url)} download className="px-3 py-1 border rounded">{a.name}</a>
            ))}
          </div>
        </div>
      </div>
  )
}
