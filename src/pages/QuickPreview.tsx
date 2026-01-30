import { useState } from 'react';
import { Upload as UploadIcon, FileJson, FileImage, FileText } from 'lucide-react';
import SpinePixiPreview from '@/components/SpinePixiPreview';

export default function QuickPreview() {
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">快速预览</h1>
        <p className="text-gray-500">
          直接上传本地 Spine 文件 (.json, .atlas, .png) 即可实时查看预览效果。此操作仅在浏览器本地进行。
        </p>
      </div>

      <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center relative hover:border-blue-400 transition-colors group">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
            <UploadIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium">拖拽所有相关文件到这里</p>
            <p className="text-sm text-gray-400">需包含 .json, .atlas 以及对应的 .png 贴图</p>
          </div>
        </div>
        <input 
          type="file" 
          multiple 
          accept=".json,.atlas,.png" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {files.length > 0 && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
            <h2 className="font-semibold flex items-center gap-2 text-gray-900">
              <FileText className="w-5 h-5 text-blue-600" />
              文件清单 ({files.length})
            </h2>
            <ul className="divide-y divide-gray-50 text-sm">
              {files.map((file) => (
                <li key={file.name} className="py-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 overflow-hidden">
                    {file.name.endsWith('.json') && <FileJson className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                    {file.name.endsWith('.png') && <FileImage className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {!file.name.endsWith('.json') && !file.name.endsWith('.png') && <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                    <span className="truncate">{file.name}</span>
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{(file.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
            <button 
              onClick={() => setFiles([])}
              className="w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-2"
            >
              清空文件
            </button>
          </div>

          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b font-semibold text-gray-900 flex items-center justify-between">
              预览区域
              <span className="text-[10px] text-gray-400 font-mono">LOCAL PREVIEW</span>
            </div>
            <div className="p-6 bg-gray-50">
              <SpinePixiPreview localFiles={files} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
