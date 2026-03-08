import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileText,
    LayoutDashboard,
    ShieldCheck,
    Sparkles,
    WandSparkles,
    X,
    Zap,
} from 'lucide-react';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'login' | 'signup';

const HIGHLIGHTS = [
    {
        icon: FileText,
        title: 'From Chaos to Structure',
        description: 'Transform BRDs, scattered notes, and raw ideas into polished requirement documents.',
    },
    {
        icon: WandSparkles,
        title: 'AI-Assisted Refinement',
        description: 'Improve clarity, tighten scope, and strengthen the narrative of every requirement.',
    },
    {
        icon: ShieldCheck,
        title: 'Detect Missing Requirements Early',
        description: 'Surface gaps and weak spots before they become delivery risks for the team.',
    },
    {
        icon: Clock3,
        title: 'Faster Product Decisions',
        description: 'Move from intake to decision-ready PRDs with less ambiguity and less back-and-forth.',
    },
] as const;

const WORKFLOW_STEPS = [
    {
        label: 'Upload document',
        detail: 'Drop in a BRD, notes, or a rough product idea.',
        badge: '01',
        tone: 'blue',
    },
    {
        label: 'AI analyzes context',
        detail: 'The platform extracts intent, structure, dependencies, and gaps.',
        badge: '02',
        tone: 'cyan',
    },
    {
        label: 'Structured PRD generated',
        detail: 'Receive a cleaner, clearer PRD ready for team review.',
        badge: '03',
        tone: 'emerald',
    },
] as const;

export default function LandingPage() {
    const { user } = useAuth();
    const location = useLocation();
    const state = location.state as { from?: string; loggedOut?: boolean } | null;
    const shouldRestoreRoute = Boolean(state?.from && !state?.loggedOut);
    const [manualAuthMode, setManualAuthMode] = useState<AuthMode | null>(null);
    const [dismissedRedirectAuth, setDismissedRedirectAuth] = useState(false);
    const activeAuth =
        manualAuthMode ?? (!user && shouldRestoreRoute && !dismissedRedirectAuth ? 'login' : null);
    const redirectTo = manualAuthMode ? '/dashboard' : shouldRestoreRoute ? state!.from! : '/dashboard';

    const openAuth = (mode: AuthMode) => {
        setDismissedRedirectAuth(false);
        setManualAuthMode(mode);
    };

    const closeAuth = () => {
        setManualAuthMode(null);
        setDismissedRedirectAuth(true);
    };

    useEffect(() => {
        if (!activeAuth) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeAuth();
        };

        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [activeAuth]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f5f9ff_0%,#f8fbff_18%,#ffffff_54%,#f7faff_100%)] text-slate-900">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-blue-200/45 blur-3xl" />
                <div className="absolute right-[-3rem] top-20 h-96 w-96 rounded-full bg-cyan-200/35 blur-3xl" />
                <div className="absolute bottom-[-6rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-100/60 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),transparent)]" />
            </div>

            <header className="relative z-10">
                <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-6 py-6 sm:px-8 lg:px-12 2xl:px-16">
                    <Link to="/" className="inline-flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-[0_20px_40px_rgba(37,99,235,0.28)]">
                            <Zap className="h-5 w-5 text-white" />
                        </span>
                        <span>
                            <span className="block text-[11px] font-semibold uppercase tracking-[0.34em] text-blue-700">
                                PRD Intelligence
                            </span>
                            <span className="block text-sm text-slate-500">
                                AI-powered clarity for product teams
                            </span>
                        </span>
                    </Link>

                    <div className="hidden items-center gap-3 sm:flex">
                        {user ? (
                            <Link
                                to="/dashboard"
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                            >
                                Open Dashboard
                                <LayoutDashboard className="h-4 w-4" />
                            </Link>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openAuth('login')}
                                    className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
                                >
                                    Login
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openAuth('signup')}
                                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                                >
                                    Start Creating PRDs
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                <section className="mx-auto grid w-full max-w-[1680px] gap-20 px-6 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:pb-28 lg:pt-14 2xl:px-16">
                    <div className="max-w-[760px]">
                        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-blue-100/90 bg-white/85 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm backdrop-blur">
                            <Sparkles className="h-4 w-4" />
                            AI support for cleaner, calmer product documentation
                        </div>

                        <h1 className="animate-fade-up-delayed mt-8 max-w-[720px] text-5xl font-black leading-[0.96] tracking-tight text-slate-950 sm:text-6xl lg:text-[5.4rem]">
                            Turn messy ideas into crystal-clear PRDs.
                        </h1>

                        <p className="animate-fade-up-delayed-2 mt-7 max-w-[720px] text-lg leading-8 text-slate-600 sm:text-xl">
                            Upload a BRD, meeting notes, or rough product thinking. PRD Intelligence analyzes the input, refines the structure, and generates a polished Product Requirement Document your team can act on.
                        </p>

                        <div className="animate-fade-up-delayed-2 mt-10 flex flex-col gap-3 sm:flex-row">
                            {user ? (
                                <>
                                    <Link
                                        to="/dashboard"
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                                    >
                                        Open Dashboard
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        to="/upload"
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/88 px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                                    >
                                        Upload a Document
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => openAuth('signup')}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                                    >
                                        Start Creating PRDs
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openAuth('login')}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white/88 px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                                    >
                                        Login
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="animate-fade-up-delayed-2 mt-10 grid max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-3">
                            {[
                                'Upload notes, BRDs, or raw ideas',
                                'Reveal gaps before review',
                                'Generate structured PRDs faster',
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="rounded-2xl border border-white/80 bg-white/72 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_14px_35px_rgba(15,23,42,0.05)] backdrop-blur"
                                >
                                    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="animate-fade-up-delayed-2 relative">
                        <div className="absolute -left-6 top-10 h-16 w-16 rounded-full bg-blue-200/60 blur-2xl" />
                        <div className="absolute right-8 top-0 h-14 w-14 rounded-full bg-cyan-200/60 blur-2xl" />
                        <div className="absolute bottom-16 left-10 h-14 w-14 rounded-full bg-sky-200/55 blur-2xl" />
                        <div className="landing-grid absolute inset-6 rounded-[2.5rem] opacity-55" />

                        <div className="animate-float relative overflow-hidden rounded-[2.25rem] border border-white/75 bg-white/74 p-5 shadow-[0_35px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
                            <div className="pointer-events-none absolute inset-x-8 top-0 h-24 rounded-b-[2rem] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.2),transparent_68%)]" />

                            <div className="relative rounded-[1.8rem] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,251,255,0.96),rgba(255,255,255,0.9))] p-5 shadow-inner shadow-white/40">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-700">
                                            Workflow Preview
                                        </p>
                                        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                                            See the transformation happen.
                                        </h2>
                                        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                                            A calm, AI-guided workflow that turns scattered input into a clear PRD your team can trust.
                                        </p>
                                    </div>
                                    <div className="hidden rounded-2xl bg-blue-50 p-3 text-blue-700 sm:block">
                                        <LayoutDashboard className="h-5 w-5" />
                                    </div>
                                </div>

                                <div className="mt-8 space-y-4">
                                    {WORKFLOW_STEPS.map((step, index) => (
                                        <div key={step.label} className="relative">
                                            {index < WORKFLOW_STEPS.length - 1 && (
                                                <div className="absolute left-6 top-14 h-10 w-px bg-gradient-to-b from-blue-200 via-slate-200 to-transparent" />
                                            )}

                                            <div className="group rounded-[1.4rem] border border-slate-200/90 bg-white/92 p-4 shadow-[0_18px_35px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(37,99,235,0.1)]">
                                                <div className="flex items-start gap-4">
                                                    <div className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                                                        step.tone === 'blue'
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : step.tone === 'cyan'
                                                                ? 'bg-cyan-50 text-cyan-700'
                                                                : 'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                        {step.tone === 'blue' ? (
                                                            <FileText className="h-5 w-5" />
                                                        ) : step.tone === 'cyan' ? (
                                                            <Sparkles className="h-5 w-5" />
                                                        ) : (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-sm font-bold text-slate-900">{step.label}</p>
                                                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                                step.tone === 'blue'
                                                                    ? 'bg-blue-50 text-blue-700'
                                                                    : step.tone === 'cyan'
                                                                        ? 'bg-cyan-50 text-cyan-700'
                                                                        : 'bg-emerald-50 text-emerald-700'
                                                            }`}>
                                                                {step.badge}
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-sm leading-6 text-slate-500">
                                                            {step.detail}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 rounded-[1.4rem] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
                                    <p className="text-sm font-semibold text-slate-300">Result</p>
                                    <p className="mt-2 text-xl font-black leading-tight">
                                        A structured PRD ready for product, design, and engineering review.
                                    </p>
                                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.8)]" />
                                        Gentle automation, stronger decisions
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="mx-auto w-full max-w-[1680px] px-6 pb-20 sm:px-8 lg:px-12 2xl:px-16">
                    <div className="mb-10 max-w-2xl">
                        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">Feature Highlights</p>
                        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                            Minimal on the surface. Powerful where teams need it.
                        </h2>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            Every interaction is designed to feel calm and lightweight while helping teams create better requirements with more confidence.
                        </p>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        {HIGHLIGHTS.map(({ icon: Icon, title, description }, index) => (
                            <article
                                key={title}
                                className="group animate-fade-up rounded-[1.85rem] border border-slate-200/80 bg-white/82 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.06)] backdrop-blur transition duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-[0_30px_65px_rgba(37,99,235,0.12)]"
                                style={{ animationDelay: `${index * 120}ms` }}
                            >
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-white text-blue-700 shadow-inner shadow-white transition group-hover:from-blue-600 group-hover:to-blue-500 group-hover:text-white">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <h3 className="mt-6 text-lg font-bold leading-7 text-slate-900">{title}</h3>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                            </article>
                        ))}
                    </div>
                </section>
            </main>

            {activeAuth && !user && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
                    <button
                        type="button"
                        aria-label="Close authentication dialog"
                        className="absolute inset-0"
                        onClick={closeAuth}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="auth-dialog-title"
                        className="animate-fade-up relative z-10 w-full max-w-md rounded-[2rem] border border-white/60 bg-white/95 p-6 shadow-[0_40px_100px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-8"
                    >
                        <button
                            type="button"
                            onClick={closeAuth}
                            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="pr-10">
                            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">Continue</p>
                            <h2 id="auth-dialog-title" className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                                {activeAuth === 'login' ? 'Welcome back' : 'Start creating PRDs'}
                            </h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                {activeAuth === 'login'
                                    ? 'Log in and continue working with clearer, better-structured requirements.'
                                    : 'Create your account and move straight into a calmer PRD workflow.'}
                            </p>
                        </div>

                        <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                            {(['login', 'signup'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => openAuth(mode)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                        activeAuth === mode
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    {mode === 'login' ? 'Login' : 'Sign Up'}
                                </button>
                            ))}
                        </div>

                        <div className="mt-6">
                            <AuthForm
                                mode={activeAuth}
                                compact
                                redirectTo={redirectTo}
                                onSwitchMode={() => openAuth(activeAuth === 'login' ? 'signup' : 'login')}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
