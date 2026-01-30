import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob } from '@/api/jobs';
import { 
  Upload as UploadIcon, 
  Settings2, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function Upload() {
  const [video, setVideo] = useState<File | null>(null);
  const [poseModel, setPoseModel] = useState('mediapipe');
  const [smooth, setSmooth] = useState(true);
  const [retarget, setRetarget] = useState('rotate');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideo(file);
  };

  const submit = async () => {
    if (!video) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('video', video);
    fd.append('poseModel', poseModel);
    fd.append('smooth', String(smooth));
    fd.append('retarget', retarget);
    try {
      const { jobId } = await createJob(fd);
      navigate(`/jobs/${jobId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">新建任务</h1>
        <p className="text-gray-500">上传视频并配置参数，我们将为你生成对应的 Spine 动画。</p>
      </div>

      <div className="grid gap-8">
        {/* File Upload Area */}
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center relative hover:border-blue-400 transition-colors group">
          {video ? (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{video.name}</p>
                <p className="text-sm text-gray-500">{(video.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <button 
                onClick={() => setVideo(null)}
                className="text-sm text-red-500 hover:underline"
              >
                更换视频
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <UploadIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-medium">点击或拖拽视频到这里</p>
                <p className="text-sm text-gray-400">支持 MP4, MOV, AVI 等常用格式</p>
              </div>
            </div>
          )}
          <input 
            type="file" 
            accept="video/*" 
            onChange={handleFileChange} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Configuration */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Settings2 className="w-5 h-5 text-blue-600" />
            处理参数配置
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">姿态提取模型</label>
              <select 
                value={poseModel} 
                onChange={(e) => setPoseModel(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                <option value="mediapipe">MediaPipe (推荐)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">重定向策略</label>
              <select 
                value={retarget} 
                onChange={(e) => setRetarget(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              >
                <option value="rotate">旋转优先 (保持肢体比例)</option>
              </select>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 sm:col-span-2">
              <input 
                type="checkbox" 
                id="smooth-toggle"
                checked={smooth} 
                onChange={(e) => setSmooth(e.target.checked)} 
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="smooth-toggle" className="flex-1 text-sm font-medium text-gray-700 cursor-pointer">
                开启平滑处理
                <span className="block text-xs text-gray-400 font-normal">减少原始姿态提取带来的抖动</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          disabled={loading || !video} 
          onClick={submit} 
          className={`
            flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg
            ${loading || !video 
              ? 'bg-gray-300 cursor-not-allowed shadow-none' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 hover:-translate-y-0.5'
            }
          `}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              正在提交任务...
            </div>
          ) : (
            <>
              提交处理任务
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        {!video && (
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-4 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            请先选择一个需要转换的视频文件。
          </div>
        )}
      </div>
    </div>
  );
}
