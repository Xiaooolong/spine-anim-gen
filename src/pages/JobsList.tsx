import { useEffect, useState } from 'react'
import { listJobs } from '@/api/jobs'
import { Link } from 'react-router-dom'

type Job = { id: string; status: string; progress: number; createdAt: number }

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    const load = async () => {
      const list = await listJobs()
      setJobs(list)
    }
    load()
  }, [])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">任务列表</h1>
      <ul className="space-y-2">
        {jobs.map((j) => (
          <li key={j.id} className="border p-3 rounded flex justify-between">
            <div>
              <div>#{j.id}</div>
              <div className="text-sm text-gray-600">{j.status} · {j.progress}%</div>
            </div>
            <Link to={`/jobs/${j.id}`} className="text-blue-600">详情</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
