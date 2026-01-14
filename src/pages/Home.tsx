import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">V2S-Spine 演示</h1>
      <div className="flex gap-4">
        <Link to="/upload" className="px-4 py-2 bg-blue-600 text-white rounded">新建任务</Link>
        <Link to="/jobs" className="px-4 py-2 border rounded">任务列表</Link>
      </div>
    </div>
  )
}
