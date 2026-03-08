import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

function AuthLoadingScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex items-center gap-3 text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-sm font-semibold tracking-wide">Checking session...</span>
            </div>
        </div>
    );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <AuthLoadingScreen />;
    if (!user) {
        return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const redirectTo = (location.state as { from?: string } | null)?.from || '/dashboard';

    if (loading) return <AuthLoadingScreen />;
    if (user) return <Navigate to={redirectTo} replace />;

    return <>{children}</>;
}
