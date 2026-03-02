import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { FileText, Lock, Mail, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { TEST_EMAIL, TEST_PASSWORD } from '../utils/authDefaults';

export default function Signup() {
    const [email, setEmail] = useState(TEST_EMAIL);
    const [password, setPassword] = useState(TEST_PASSWORD);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setInfoMessage('');
        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail.endsWith('@example.com')) {
            setError('Please use a real email domain. Addresses with @example.com are not accepted.');
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        if (!data.session) {
            setInfoMessage('Account created. If email verification is enabled, please verify and then log in.');
            setLoading(false);
            return;
        }

        navigate('/dashboard', { replace: true });
    };

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

                        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Test Credentials</p>
                            <p className="mt-2 text-sm text-emerald-900"><span className="font-semibold">Email:</span> {TEST_EMAIL}</p>
                            <p className="text-sm text-emerald-900"><span className="font-semibold">Password:</span> {TEST_PASSWORD}</p>
                            <button
                                type="button"
                                className="mt-3 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                                onClick={() => {
                                    setEmail(TEST_EMAIL);
                                    setPassword(TEST_PASSWORD);
                                }}
                            >
                                Use these credentials
                            </button>
                        </div>

                        <form className="space-y-5" onSubmit={handleSignup}>
                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {infoMessage && (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span>{infoMessage}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        minLength={8}
                                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
                                        placeholder="Minimum 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-lg hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-70"
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                                {!loading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-600">
                            Already registered?{' '}
                            <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-700">
                                Sign in
                            </Link>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
