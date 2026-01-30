import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  List, 
  Eye, 
  Video, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      title: '姿态提取',
      description: '利用 MediaPipe 尖端技术，从视频中精准提取 2D 骨骼关键点。',
      icon: Video,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: '动作重定向',
      description: '智能将视频动作映射到 Spine 骨骼，支持平滑处理与旋转优化。',
      icon: Zap,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      title: '实时预览',
      description: '内置 PixiJS 渲染引擎，支持实时预览与动画调试。',
      icon: ShieldCheck,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-gray-900">
          让动画生成更简单
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Spine Anim Gen 是一款基于 AI 的动画辅助工具，能够将视频内容快速转化为高质量的 Spine 骨骼动画。
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link 
            to="/upload" 
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <PlusCircle className="w-5 h-5" />
            开始创作
          </Link>
          <Link 
            to="/quick-preview" 
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all shadow-sm"
          >
            <Eye className="w-5 h-5" />
            快速预览
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className={`w-12 h-12 ${f.bg} ${f.color} rounded-xl flex items-center justify-center`}>
              <f.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">{f.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
          </div>
        ))}
      </section>

      {/* Quick Access */}
      <section className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-2xl font-bold">查看已完成的任务？</h2>
          <p className="text-blue-100">你可以随时在任务列表中查看生成进度和下载最终产物。</p>
        </div>
        <Link 
          to="/jobs" 
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          前往任务列表
        </Link>
      </section>
    </div>
  );
}
