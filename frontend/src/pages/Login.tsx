import { useLocation } from 'react-router-dom';
import { FileText, Sparkles } from 'lucide-react';
import AuthForm from '../components/AuthForm';

export default function Login() {
    const location = useLocation();
    const state = location.state as { from?: string; email?: string } | null;

    const redirectTo = state?.from || '/dashboard';

    return (
        <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_#dbeafe_0,_#eff6ff_28%,_#ffffff_60%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-blue-100/70 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-cyan-100/60 blur-3xl" />

            <div className="relative max-w-5xl mx-auto min-h-[80vh] flex items-center">
                <div className="w-full grid md:grid-cols-2 bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden border border-blue-100 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                    <section className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold w-fit">
                            <Sparkles className="w-4 h-4" />
                            PRD Intelligence
                        </div>
                        <div>
                            <h1 className="text-4xl font-black leading-tight">Welcome back to your product workspace.</h1>
                            <p className="mt-4 text-blue-100 leading-relaxed">
                                Sign in to continue generating, refining, and validating high-quality PRDs with AI.
                            </p>
                        </div>
                        <div className="text-xs text-blue-100/90">
                            Build faster with better requirements clarity.
                        </div>
                    </section>

                    <section className="p-6 sm:p-10">
                        <div className="md:hidden flex items-center justify-center mb-6">
                            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white font-semibold">
                                <FileText className="w-4 h-4" />
                                PRD Intelligence
                            </div>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-3xl font-black text-slate-900">Sign In</h2>
                            <p className="mt-2 text-sm text-slate-500">Login to access dashboard, uploads, and PRD refinement.</p>
                        </div>

                        <AuthForm
                            mode="login"
                            initialEmail={state?.email}
                            redirectTo={redirectTo}
                            switchModeHref="/signup"
                        />
                    </section>
                </div>
            </div>
        </div>
    );
}
