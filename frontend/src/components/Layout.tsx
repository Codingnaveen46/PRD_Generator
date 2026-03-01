import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileUp, Zap } from 'lucide-react';

export default function Layout() {
    const location = useLocation();
    
    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
                <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <Link to="/dashboard" className="flex items-center group">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg group-hover:shadow-lg transition-all duration-300">
                                    <Zap className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-black bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 bg-clip-text text-transparent hidden sm:inline">
                                    PRD Intelligence
                                </span>
                                <span className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent sm:hidden">
                                    PRD
                                </span>
                            </div>
                        </Link>

                        {/* Navigation Links */}
                        <div className="hidden sm:flex items-center gap-1">
                            <Link
                                to="/dashboard"
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                    isActive('/dashboard')
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                to="/upload"
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                                    isActive('/upload')
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                <FileUp className="w-4 h-4" />
                                Upload
                            </Link>
                        </div>

                        {/* Mobile menu button */}
                        <div className="flex sm:hidden gap-2">
                            <Link
                                to="/dashboard"
                                className={`p-2 rounded-lg transition-all ${
                                    isActive('/dashboard') ? 'bg-blue-100' : 'hover:bg-slate-100'
                                }`}
                            >
                                <LayoutDashboard className="w-5 h-5 text-slate-700" />
                            </Link>
                            <Link
                                to="/upload"
                                className={`p-2 rounded-lg transition-all ${
                                    isActive('/upload') ? 'bg-blue-100' : 'hover:bg-slate-100'
                                }`}
                            >
                                <FileUp className="w-5 h-5 text-slate-700" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-[1800px] mx-auto">
                    <Outlet />
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-20 border-t border-slate-200/50 bg-white/50 backdrop-blur-sm">
                <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="text-center text-sm text-slate-600">
                        <p>Built with ✨ for smarter product requirements</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
