import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Upload as UploadIcon, 
  List, 
  Eye, 
  Home as HomeIcon,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { name: '首页', path: '/', icon: HomeIcon },
    { name: '新建任务', path: '/upload', icon: UploadIcon },
    { name: '任务列表', path: '/jobs', icon: List },
    { name: '快速预览', path: '/quick-preview', icon: Eye },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-600">
            <LayoutDashboard className="w-6 h-6" />
            Spine Anim Gen
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-600 font-medium" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t text-xs text-gray-400 text-center">
          v0.1.0-alpha
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b flex items-center px-8">
          <div className="flex items-center text-sm text-gray-500 gap-2">
            <Link to="/" className="hover:text-blue-600">App</Link>
            {location.pathname !== '/' && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="capitalize text-gray-900 font-medium">
                  {location.pathname.split('/').filter(Boolean).join(' / ')}
                </span>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
