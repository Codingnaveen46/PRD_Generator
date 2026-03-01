import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDate } from '../utils/formatters';
import { FileText, Loader2, ArrowRight, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PRD {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

interface DeleteCandidate {
    id: string;
    filename: string;
}

export default function Dashboard() {
    const [prds, setPrds] = useState<PRD[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const navigate = useNavigate();

    const fetchPrds = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);

        try {
            const response = await axios.get('http://localhost:8000/api/v1/prds');
            setPrds(response.data);
        } catch (error) {
            console.error('Error fetching PRDs:', error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPrds(true);
    }, [fetchPrds]);

    const hasActiveProcessing = prds.some(
        (prd) => prd.status === 'pending' || prd.status === 'processing'
    );

    useEffect(() => {
        if (!hasActiveProcessing) return;

        const interval = setInterval(() => {
            void fetchPrds(false);
        }, 3000);

        return () => clearInterval(interval);
    }, [fetchPrds, hasActiveProcessing]);

    useEffect(() => {
        const handleVisibilityOrFocus = () => {
            if (document.visibilityState === 'hidden') return;
            void fetchPrds(false);
        };

        window.addEventListener('focus', handleVisibilityOrFocus);
        document.addEventListener('visibilitychange', handleVisibilityOrFocus);

        return () => {
            window.removeEventListener('focus', handleVisibilityOrFocus);
            document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        };
    }, [fetchPrds]);

    const openDeleteModal = (prdId: string, filename: string) => {
        setFeedback(null);
        setDeleteCandidate({ id: prdId, filename });
    };

    const closeDeleteModal = () => {
        if (deletingId) return;
        setDeleteCandidate(null);
    };

    const confirmDelete = async () => {
        if (!deleteCandidate) return;

        setDeletingId(deleteCandidate.id);
        try {
            await axios.delete(`http://localhost:8000/api/v1/prds/${deleteCandidate.id}`);
            setPrds((prev) => prev.filter((item) => item.id !== deleteCandidate.id));
            setFeedback({ type: 'success', text: `"${deleteCandidate.filename}" was deleted successfully.` });
            setDeleteCandidate(null);
        } catch (error) {
            console.error('Error deleting PRD:', error);
            setFeedback({
                type: 'error',
                text: `Could not delete "${deleteCandidate.filename}". Please try again.`
            });
        } finally {
            setDeletingId(null);
        }
    };

    const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, prdId: string) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(`/prd/${prdId}`);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                Document Dashboard
                            </h1>
                            <p className="mt-2 text-sm text-slate-600">Manage and analyze your product requirements</p>
                        </div>
                        <Link
                            to="/upload"
                            className="inline-flex items-center px-6 py-3 border border-transparent shadow-lg text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95"
                        >
                            + Upload Document
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {feedback && (
                    <div className={`mb-6 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${feedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <div className="flex items-center gap-2 text-sm font-medium">
                            {feedback.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <AlertTriangle className="h-4 w-4" />
                            )}
                            {feedback.text}
                        </div>
                        <button
                            type="button"
                            className="text-xs font-semibold underline underline-offset-2 opacity-80 hover:opacity-100"
                            onClick={() => setFeedback(null)}
                        >
                            Dismiss
                        </button>
                    </div>
                )}

                {prds.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl shadow-lg border border-slate-200">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-blue-100 rounded-2xl">
                                <FileText className="w-12 h-12 text-blue-600" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No documents yet</h3>
                        <p className="text-slate-600 mb-8 max-w-md mx-auto">Get started by uploading your first PRD or BRD for AI-powered analysis.</p>
                        <Link
                            to="/upload"
                            className="inline-flex items-center px-6 py-3 border border-transparent shadow-md text-sm font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                        >
                            Upload Your First Document
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        <div className="text-sm text-slate-600 font-semibold">
                            {prds.length} document{prds.length !== 1 ? 's' : ''} uploaded
                        </div>
                        {prds.map((prd) => (
                            <div key={prd.id} className="group">
                                <div
                                    className={`bg-white rounded-2xl shadow-md border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden hover:-translate-y-1 ${deletingId === prd.id ? 'opacity-70 pointer-events-none' : 'cursor-pointer'}`}
                                    onClick={() => navigate(`/prd/${prd.id}`)}
                                    onKeyDown={(event) => handleCardKeyDown(event, prd.id)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between gap-4">
                                        {/* Left side */}
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="flex-shrink-0">
                                                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center group-hover:from-blue-200 group-hover:to-blue-100 transition-colors duration-300">
                                                    <FileText className="h-6 w-6 text-blue-600" />
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                                    {prd.filename}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    📅 {formatDate(prd.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Status and arrow */}
                                        <div className="flex items-center gap-4">
                                            <div className="hidden sm:block">
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold capitalize gap-2 transition-all duration-300
                                ${prd.status === 'completed' ? 'bg-emerald-100 text-emerald-700 shadow-sm' :
                                    prd.status === 'processing' ? 'bg-blue-100 text-blue-700 shadow-sm' :
                                        prd.status === 'failed' ? 'bg-red-100 text-red-700 shadow-sm' :
                                            'bg-slate-100 text-slate-700'}`}>
                                                    {prd.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                                                    {prd.status === 'completed' && <span>✓</span>}
                                                    {prd.status === 'failed' && <span>✕</span>}
                                                    {prd.status}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openDeleteModal(prd.id, prd.filename);
                                                }}
                                                disabled={deletingId === prd.id}
                                                className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                title="Delete document"
                                                aria-label={`Delete ${prd.filename}`}
                                            >
                                                {deletingId === prd.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </button>
                                            <div className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300">
                                                <ArrowRight className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress bar for processing */}
                                    {prd.status === 'processing' && (
                                        <div className="h-1 bg-slate-100">
                                            <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 w-1/2 animate-pulse"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {deleteCandidate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm px-4"
                    onClick={closeDeleteModal}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Delete document confirmation"
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Delete this document?</h3>
                                    <p className="mt-2 text-sm text-slate-600">
                                        You are deleting <span className="font-semibold text-slate-800">{deleteCandidate.filename}</span>.
                                        This action permanently removes the PRD and its analysis and cannot be undone.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={Boolean(deletingId)}
                                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Keep Document
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDelete()}
                                disabled={Boolean(deletingId)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {Boolean(deletingId) && <Loader2 className="h-4 w-4 animate-spin" />}
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
