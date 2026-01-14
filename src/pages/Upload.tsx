import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createJob } from '@/api/jobs'

export default function Upload() {
  const [video, setVideo] = useState<File | null>(null)
  const [poseModel, setPoseModel] = useState('mediapipe')
  const [smooth, setSmooth] = useState(true)
  const [retarget, setRetarget] = useState('rotate')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async () => {
    if (!video) return
    setLoading(true)
    const fd = new FormData()
    fd.append('video', video)
    fd.append('poseModel', poseModel)
    fd.append('smooth', String(smooth))
    fd.append('retarget', retarget)
    try {
      const { jobId } = await createJob(fd)
      navigate(`/jobs/${jobId}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">新建任务</h1>
      <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
      <div className="flex gap-4">
        <label>
          姿态模型
          <select value={poseModel} onChange={(e) => setPoseModel(e.target.value)} className="ml-2 border p-1">
            <option value="mediapipe">MediaPipe</option>
          </select>
        </label>
        <label>
          稳定化
          <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="ml-2" />
        </label>
        <label>
          重定向
          <select value={retarget} onChange={(e) => setRetarget(e.target.value)} className="ml-2 border p-1">
            <option value="rotate">旋转优先</option>
          </select>
        </label>
      </div>
      <button disabled={loading || !video} onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded">
        {loading ? '提交中...' : '提交任务'}
      </button>
    </div>
  )
}
