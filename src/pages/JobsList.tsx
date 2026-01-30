import { useEffect, useState } from 'react';
import { listJobs } from '@/api/jobs';
import { Link } from 'react-router-dom';
import { 
  List, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Job = { id: string; status: string; progress: number; createdAt: number };

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listJobs();
      setJobs(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'FAILED': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'RUNNING': return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCEEDED': return 'bg-green-50 text-green-700 border-green-100';
      case 'FAILED': return 'bg-red-50 text-red-700 border-red-100';
      case 'RUNNING': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <List className="w-8 h-8 text-blue-600" />
            任务列表
          </h1>
          <p className="text-gray-500 text-sm">管理和查看所有已提交的动画生成任务。</p>
        </div>
        <button 
          onClick={load}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          title="刷新列表"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {jobs.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {jobs.map((j) => (
              <Link 
                key={j.id} 
                to={`/jobs/${j.id}`}
                className="flex items-center p-6 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 flex items-center gap-6">
                  {getStatusIcon(j.status)}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-gray-900">#{j.id.slice(0, 8)}</span>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider",
                        getStatusColor(j.status)
                      )}>
                        {j.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-4">
                      <span>{new Date(j.createdAt).toLocaleString()}</span>
                      <span className="flex items-center gap-1">
                        进度: <span className="font-semibold text-gray-600">{j.progress}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar Mini */}
                {j.status === 'RUNNING' && (
                  <div className="hidden md:block w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden mr-8">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500" 
                      style={{ width: `${j.progress}%` }}
                    />
                  </div>
                )}

                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
              <List className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-gray-900 font-medium">暂无任务</p>
              <p className="text-gray-500 text-sm">点击侧边栏的“新建任务”来开始你的第一个创作。</p>
            </div>
            <Link 
              to="/upload" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              立即新建
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
