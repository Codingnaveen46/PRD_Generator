import { FileText, Sparkles } from 'lucide-react';
import AuthForm from '../components/AuthForm';

export default function Signup() {
    return (
        <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dcfce7_0,_#ecfdf5_24%,_#ffffff_62%)] px-4 py-8 sm:px-6 lg:px-8">
            <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-100/70 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-lime-100/60 blur-3xl" />

            <div className="relative max-w-5xl mx-auto min-h-[80vh] flex items-center">
                <div className="w-full grid md:grid-cols-2 bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden border border-emerald-100 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                    <section className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-emerald-700 via-emerald-600 to-lime-500 text-white">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold w-fit">
                            <Sparkles className="w-4 h-4" />
                            PRD Intelligence
                        </div>
                        <div>
                            <h1 className="text-4xl font-black leading-tight">Create your account and start building better PRDs.</h1>
                            <p className="mt-4 text-emerald-100 leading-relaxed">
                                Sign up once, then access AI-powered PRD generation, refinement, and risk insights.
                            </p>
                        </div>
                        <div className="text-xs text-emerald-100/90">
                            Structured requirements, less ambiguity, faster delivery.
                        </div>
                    </section>

                    <section className="p-6 sm:p-10">
                        <div className="md:hidden flex items-center justify-center mb-6">
                            <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold">
                                <FileText className="w-4 h-4" />
                                PRD Intelligence
                            </div>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-3xl font-black text-slate-900">Create Account</h2>
                            <p className="mt-2 text-sm text-slate-500">Sign up before starting. Existing users can log in directly.</p>
                        </div>

                        <AuthForm
                            mode="signup"
                            redirectTo="/dashboard"
                            switchModeHref="/login"
                        />
                    </section>
                </div>
            </div>
        </div>
    );
}
