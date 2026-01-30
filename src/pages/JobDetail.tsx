import { useEffect, useState } from 'react';
import { getJob, getArtifacts } from '@/api/jobs';
import SpinePixiPreview from '@/components/SpinePixiPreview';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  FileJson, 
  Video, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ExternalLink,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Artifact = { name: string; type: string; url: string; size: number };

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [origSrc, setOrigSrc] = useState<string | null>(null);
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [origErr, setOrigErr] = useState<string>('');
  const [overlayErr, setOverlayErr] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    const poll = async () => {
      if (!id) return;
      try {
        const j = await getJob(id);
        if (!j) {
          setError('任务不存在或已过期');
          return;
        }
        setJob(j);
        
        const a = await getArtifacts(id);
        setArtifacts(a);

        if (j.status !== 'SUCCEEDED' && j.status !== 'FAILED') {
          timer = setTimeout(poll, 2000);
        }
      } catch (_e) {
        setError('接口不可用或代理异常');
      }
    };
    poll();
    return () => timer && clearTimeout(timer);
  }, [id]);

  const url = (name: string) => artifacts.find(a => a.name === name)?.url;

  useEffect(() => {
    const u1 = url('original.mp4');
    if (u1) setOrigSrc(u1);
    const u2 = url('pose_overlay.mp4');
    if (u2) setOverlaySrc(u2);
  }, [artifacts]);

  useEffect(() => {
    setOrigErr('');
    setOverlayErr('');
  }, [origSrc, overlaySrc]);

  const getStatusDisplay = () => {
    if (error) return { icon: <XCircle className="w-5 h-5 text-red-500" />, text: error, color: 'text-red-600' };
    switch (job?.status) {
      case 'SUCCEEDED': return { icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, text: '处理完成', color: 'text-green-600' };
      case 'FAILED': return { icon: <XCircle className="w-5 h-5 text-red-500" />, text: '处理失败', color: 'text-red-600' };
      case 'RUNNING': return { icon: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />, text: `正在处理 (${job.progress}%)`, color: 'text-blue-600' };
      default: return { icon: <History className="w-5 h-5 text-gray-400" />, text: '排队中', color: 'text-gray-500' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/jobs" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            任务详情
            <span className="text-sm font-mono font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded">#{id}</span>
          </h1>
        </div>
        <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border bg-white shadow-sm font-medium", status.color)}>
          {status.icon}
          {status.text}
        </div>
      </div>

      {job?.error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-red-800 mb-1">错误详情</p>
            {job.error}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Videos & Spine */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b flex items-center gap-2 font-semibold text-gray-700">
                <Video className="w-4 h-4 text-blue-500" />
                原始视频
              </div>
              <div className="aspect-video bg-black flex items-center justify-center">
                {origSrc ? (
                  <div className="w-full h-full flex flex-col">
                    <video
                      src={origSrc}
                      controls
                      className="w-full h-full"
                      crossOrigin="anonymous"
                      playsInline
                      preload="metadata"
                      onError={() => setOrigErr('视频资源加载失败')}
                    />
                    {origErr && (
                      <div className="p-3 text-xs text-red-300 bg-black/60">
                        {origErr}，尝试直接打开：
                        <a className="underline ml-1" href={origSrc} target="_blank" rel="noreferrer">链接</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm animate-pulse">等待资源中...</div>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b flex items-center gap-2 font-semibold text-gray-700">
                <Video className="w-4 h-4 text-purple-500" />
                姿态叠加 (Pose Overlay)
              </div>
              <div className="aspect-video bg-black flex items-center justify-center">
                {overlaySrc ? (
                  <div className="w-full h-full flex flex-col">
                    <video
                      src={overlaySrc}
                      controls
                      className="w-full h-full"
                      crossOrigin="anonymous"
                      playsInline
                      preload="metadata"
                      onError={() => setOverlayErr('覆盖视频无法播放（可能是编码不兼容）')}
                    />
                    {overlayErr && (
                      <div className="p-3 text-xs text-red-300 bg-black/60">
                        {overlayErr}，尝试直接打开/下载：
                        <a className="underline ml-1" href={overlaySrc} target="_blank" rel="noreferrer">链接</a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm animate-pulse">等待资源中...</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex items-center justify-between font-semibold text-gray-700">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-orange-500" />
                Spine 动画实时预览
              </div>
              <span className="text-[10px] text-gray-400 font-mono">POWERED BY PIXIJS</span>
            </div>
            <div className="p-6 bg-gray-50">
              {url('spine_animation.json') ? (
                <SpinePixiPreview animUrl={url('spine_animation.json')!} />
              ) : (
                <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  {job?.status === 'FAILED' ? '生成失败，无法预览' : '生成中，请稍候...'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Artifacts & Info */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b font-semibold text-gray-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" />
              下载产物 ({artifacts.length})
            </div>
            <div className="p-2">
              {artifacts.length > 0 ? (
                <div className="space-y-1">
                  {artifacts.map(a => (
                    <a 
                      key={a.name} 
                      href={a.url} 
                      download 
                      className="flex items-center justify-between p-3 hover:bg-blue-50 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        {a.type === 'video' ? <Video className="w-4 h-4 text-blue-400" /> : <FileJson className="w-4 h-4 text-orange-400" />}
                        <div className="text-sm">
                          <p className="font-medium text-gray-700 group-hover:text-blue-700 transition-colors">{a.name}</p>
                          <p className="text-[10px] text-gray-400">{(a.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-400">暂无可用产物</div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-blue-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              使用说明
            </h3>
            <div className="text-xs text-blue-800/80 space-y-2 leading-relaxed">
              <p>1. <b>原始视频</b> 显示了姿态提取的源数据。</p>
              <p>2. <b>Pose Overlay</b> 帮助你确认 MediaPipe 的提取质量。</p>
              <p>3. <b>Spine 预览</b> 使用实时重定向后的动画数据。</p>
              <p>4. 你可以下载 JSON 文件并导入到 Spine 编辑器中进一步调整。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
