import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { TEST_EMAIL, TEST_PASSWORD } from '../utils/authDefaults';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
    mode: AuthMode;
    compact?: boolean;
    initialEmail?: string;
    redirectTo?: string;
    onSwitchMode?: () => void;
    switchModeHref?: string;
}

const COPY = {
    login: {
        accent: 'blue',
        submitLabel: 'Sign In',
        loadingLabel: 'Signing in...',
        helperText: 'New here?',
        switchLabel: 'Create your account',
        passwordPlaceholder: '••••••••',
    },
    signup: {
        accent: 'emerald',
        submitLabel: 'Create Account',
        loadingLabel: 'Creating account...',
        helperText: 'Already registered?',
        switchLabel: 'Sign in',
        passwordPlaceholder: 'Minimum 8 characters',
    },
} satisfies Record<AuthMode, {
    accent: string;
    submitLabel: string;
    loadingLabel: string;
    helperText: string;
    switchLabel: string;
    passwordPlaceholder: string;
}>;

const STYLES = {
    blue: {
        note: 'border-blue-200 bg-blue-50/80',
        noteText: 'text-blue-900',
        noteAccent: 'text-blue-700',
        inputFocus: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
        button: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
        switch: 'text-blue-600 hover:text-blue-700',
    },
    emerald: {
        note: 'border-emerald-200 bg-emerald-50/80',
        noteText: 'text-emerald-900',
        noteAccent: 'text-emerald-700',
        inputFocus: 'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200',
        button: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800',
        switch: 'text-emerald-600 hover:text-emerald-700',
    },
} as const;

export default function AuthForm({
    mode,
    compact = false,
    initialEmail,
    redirectTo = '/dashboard',
    onSwitchMode,
    switchModeHref,
}: AuthFormProps) {
    const config = COPY[mode];
    const color = STYLES[config.accent as keyof typeof STYLES];
    const [email, setEmail] = useState(initialEmail || TEST_EMAIL);
    const [password, setPassword] = useState(TEST_PASSWORD);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setInfoMessage('');

        const normalizedEmail = email.trim().toLowerCase();

        if (normalizedEmail.endsWith('@example.com')) {
            setError('Please use a real email domain. Addresses with @example.com are not accepted.');
            setLoading(false);
            return;
        }

        if (mode === 'login') {
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

            if (loginError) {
                setError(loginError.message);
                setLoading(false);
                return;
            }

            navigate(redirectTo, { replace: true });
            return;
        }

        const { data, error: signupError } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
        });

        if (signupError) {
            setError(signupError.message);
            setLoading(false);
            return;
        }

        if (!data.session) {
            setInfoMessage('Account created. If email verification is enabled, please verify and then log in.');
            setLoading(false);
            return;
        }

        navigate(redirectTo, { replace: true });
    };

    const switchControl = onSwitchMode ? (
        <button
            type="button"
            onClick={onSwitchMode}
            className={`font-bold transition-colors ${color.switch}`}
        >
            {config.switchLabel}
        </button>
    ) : switchModeHref ? (
        <Link to={switchModeHref} className={`font-bold transition-colors ${color.switch}`}>
            {config.switchLabel}
        </Link>
    ) : null;

    return (
        <div>
            <div className={`${compact ? 'mb-5' : 'mb-6'} rounded-xl border p-4 ${color.note}`}>
                <p className={`text-xs font-bold uppercase tracking-[0.24em] ${color.noteAccent}`}>Test Credentials</p>
                <p className={`mt-2 text-sm ${color.noteText}`}>
                    <span className="font-semibold">Email:</span> {TEST_EMAIL}
                </p>
                <p className={`text-sm ${color.noteText}`}>
                    <span className="font-semibold">Password:</span> {TEST_PASSWORD}
                </p>
                <button
                    type="button"
                    className={`mt-3 text-xs font-bold underline underline-offset-2 ${color.noteAccent}`}
                    onClick={() => {
                        setEmail(TEST_EMAIL);
                        setPassword(TEST_PASSWORD);
                    }}
                >
                    Use these credentials
                </button>
            </div>

            <form className={compact ? 'space-y-4' : 'space-y-5'} onSubmit={handleSubmit}>
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {infoMessage && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{infoMessage}</span>
                    </div>
                )}

                <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="email"
                            required
                            autoComplete="email"
                            className={`w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition ${color.inputFocus}`}
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="password"
                            required
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            minLength={mode === 'signup' ? 8 : undefined}
                            className={`w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 shadow-sm outline-none transition ${color.inputFocus}`}
                            placeholder={config.passwordPlaceholder}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-70 ${color.button}`}
                >
                    {loading ? config.loadingLabel : config.submitLabel}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
            </form>

            {switchControl && (
                <p className="mt-6 text-center text-sm text-slate-600">
                    {config.helperText}{' '}
                    {switchControl}
                </p>
            )}
        </div>
    );
}
