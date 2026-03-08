import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import clsx from 'clsx';
import { formatDate } from '../utils/formatters';
import {
    AlertTriangle,
    CheckCircle2,
    FileText,
    Loader2,
    Search,
    Sparkles,
    Trash2,
    UploadCloud,
    Zap,
} from 'lucide-react';

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

const VALID_TYPES = [
    'application/pdf',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const VALID_EXTENSIONS = ['.pdf', '.md', '.docx'];

function getStatusPresentation(status: PRD['status']) {
    if (status === 'completed') {
        return {
            label: 'Completed',
            className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        };
    }

    if (status === 'failed') {
        return {
            label: 'Failed',
            className: 'bg-red-50 text-red-700 border-red-200',
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
        };
    }

    if (status === 'processing') {
        return {
            label: 'Processing',
            className: 'bg-blue-50 text-blue-700 border-blue-200',
            icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        };
    }

    return {
        label: 'Queued',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: <Zap className="h-3.5 w-3.5" />,
    };
}

function getDocumentType(filename: string) {
    const extension = filename.split('.').pop()?.toUpperCase();
    return extension || 'FILE';
}

function getGapSummary(status: PRD['status']) {
    if (status === 'completed') return 'Gap review available';
    if (status === 'failed') return 'Analysis needs retry';
    return 'Gap review pending';
}

export default function Dashboard() {
    const [prds, setPrds] = useState<PRD[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const navigate = useNavigate();

    const fetchPrds = useCallback(async (showLoader = false) => {
        if (showLoader) setLoading(true);

        try {
            const response = await axios.get<PRD[]>('http://localhost:8000/api/v1/prds');
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

    const hasActiveProcessing = prds.some((prd) => prd.status === 'pending' || prd.status === 'processing');

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

    const validateAndSetFile = (selectedFile: File) => {
        setUploadError(null);
        const isValidType = VALID_TYPES.includes(selectedFile.type)
            || VALID_EXTENSIONS.some((extension) => selectedFile.name.toLowerCase().endsWith(extension));

        if (!isValidType) {
            setUploadError('Invalid file type. Please upload a .pdf, .md, or .docx file.');
            setFile(null);
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setUploadError('File is too large. Maximum size is 10MB.');
            setFile(null);
            return;
        }

        setFile(selectedFile);
    };

    const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) return;
        validateAndSetFile(event.target.files[0]);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);

        if (!event.dataTransfer.files?.length) return;
        validateAndSetFile(event.dataTransfer.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setUploadError(null);
        setFeedback(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('http://localhost:8000/api/v1/analyze', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setFeedback({ type: 'success', text: `"${file.name}" was uploaded and is being analyzed.` });
            await fetchPrds(false);
        } catch (error: unknown) {
            console.error('Upload error:', error);
            if (axios.isAxiosError(error)) {
                setUploadError(error.response?.data?.detail || 'Failed to upload file. Please try again.');
            } else {
                setUploadError('Failed to upload file. Please try again.');
            }
        } finally {
            setUploading(false);
        }
    };

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
                text: `Could not delete "${deleteCandidate.filename}". Please try again.`,
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

    const sortedPrds = [...prds].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
    const filteredPrds = sortedPrds.filter((prd) =>
        prd.filename.toLowerCase().includes(query.trim().toLowerCase()),
    );
    const completedCount = prds.filter((prd) => prd.status === 'completed').length;
    const processingCount = prds.filter((prd) => prd.status === 'pending' || prd.status === 'processing').length;
    const failedCount = prds.filter((prd) => prd.status === 'failed').length;
    const recentActivity = sortedPrds.slice(0, 3);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(191,219,254,0.45),_transparent_28%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_48%,_#f8fafc_100%)]">
            <div className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/82 backdrop-blur-xl shadow-sm">
                <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">
                                <Sparkles className="h-3.5 w-3.5" />
                                PRD Intelligence
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                                Document Dashboard
                            </h1>
                            <p className="mt-2 text-sm text-slate-600 sm:text-base">
                                Analyze uploaded PRDs and BRDs, track document health, and move faster with clearer requirement intelligence.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <label className="relative block min-w-[280px] flex-1 md:min-w-[340px]">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder="Search documents"
                                    className="w-full rounded-2xl border border-slate-200 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-sm font-bold text-white shadow-[0_20px_40px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800"
                            >
                                <UploadCloud className="h-4 w-4" />
                                Upload Document
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mx-auto grid w-full max-w-[1800px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.55fr)_380px] lg:px-8">
                <section className="min-w-0 space-y-8">
                    {feedback && (
                        <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                            feedback.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-red-200 bg-red-50 text-red-800'
                        }`}>
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

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Documents</p>
                            <p className="mt-3 text-3xl font-black text-slate-950">{prds.length}</p>
                            <p className="mt-2 text-sm text-slate-600">Uploaded across your workspace.</p>
                        </div>

                        <div className="rounded-[1.75rem] border border-blue-200/80 bg-blue-50/80 p-5 shadow-[0_18px_40px_rgba(37,99,235,0.08)] backdrop-blur">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">AI Insights Ready</p>
                            <p className="mt-3 text-3xl font-black text-slate-950">{completedCount}</p>
                            <p className="mt-2 text-sm text-blue-900/80">Completed analyses ready to review.</p>
                        </div>

                        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur">
                            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">In Progress</p>
                            <div className="mt-3 flex items-center gap-3">
                                <p className="text-3xl font-black text-slate-950">{processingCount}</p>
                                {processingCount > 0 && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                                {failedCount > 0 ? `${failedCount} document${failedCount > 1 ? 's' : ''} need attention.` : 'Everything is moving smoothly.'}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/82 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Documents</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                                    Uploaded PRDs and BRDs
                                </h2>
                            </div>
                            <p className="text-sm font-medium text-slate-500">
                                {filteredPrds.length} result{filteredPrds.length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {filteredPrds.length === 0 ? (
                            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-16 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
                                    <FileText className="h-8 w-8" />
                                </div>
                                <h3 className="mt-6 text-xl font-bold text-slate-900">
                                    {prds.length === 0 ? 'No documents yet' : 'No documents match this search'}
                                </h3>
                                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                                    {prds.length === 0
                                        ? 'Use the quick upload panel to analyze your first PRD or BRD document.'
                                        : 'Try another file name or clear the search input to see all uploaded documents.'}
                                </p>
                                {prds.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                                    >
                                        <UploadCloud className="h-4 w-4" />
                                        Upload Your First Document
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setQuery('')}
                                        className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                                    >
                                        Clear Search
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {filteredPrds.map((prd) => {
                                    const status = getStatusPresentation(prd.status);

                                    return (
                                        <div key={prd.id} className="group">
                                            <div
                                                className={clsx(
                                                    'cursor-pointer overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_28px_60px_rgba(37,99,235,0.10)] sm:px-6',
                                                    deletingId === prd.id && 'pointer-events-none opacity-70',
                                                )}
                                                onClick={() => navigate(`/prd/${prd.id}`)}
                                                onKeyDown={(event) => handleCardKeyDown(event, prd.id)}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start gap-4">
                                                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 transition group-hover:from-blue-600 group-hover:to-blue-500 group-hover:text-white">
                                                                <FileText className="h-6 w-6" />
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-lg font-bold text-slate-950 transition group-hover:text-blue-700">
                                                                            {prd.filename}
                                                                        </p>
                                                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                                                                            <span>{getDocumentType(prd.filename)}</span>
                                                                            <span>Uploaded {formatDate(prd.created_at)}</span>
                                                                        </div>
                                                                    </div>

                                                                    <span className={`inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-bold ${status.className}`}>
                                                                        {status.icon}
                                                                        {status.label}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-5 grid gap-3 md:grid-cols-3">
                                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                                            Analysis Status
                                                                        </p>
                                                                        <p className="mt-2 text-sm font-semibold text-slate-900">{status.label}</p>
                                                                    </div>
                                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                                            Requirement Extraction
                                                                        </p>
                                                                        <p className="mt-2 text-sm font-semibold text-slate-900">
                                                                            {prd.status === 'completed' ? 'Structured output ready' : 'Preparing extraction'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                                                                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                                            Requirement Gaps
                                                                        </p>
                                                                        <p className="mt-2 text-sm font-semibold text-slate-900">{getGapSummary(prd.status)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                navigate(`/prd/${prd.id}`);
                                                            }}
                                                            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                                                        >
                                                            View Analysis
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openDeleteModal(prd.id, prd.filename);
                                                            }}
                                                            disabled={deletingId === prd.id}
                                                            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {deletingId === prd.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                <aside className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/86 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Quick Upload</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                                    Analyze a new document
                                </h2>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                                <UploadCloud className="h-5 w-5" />
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.md,.docx"
                            onChange={handleFileInput}
                        />

                        <div
                            className={clsx(
                                'mt-6 rounded-[1.75rem] border-2 border-dashed p-6 text-center transition duration-300',
                                isDragging
                                    ? 'border-blue-500 bg-blue-50/90'
                                    : file
                                        ? 'border-emerald-400 bg-emerald-50/80'
                                        : 'border-slate-300 bg-slate-50/70 hover:border-blue-300 hover:bg-blue-50/40',
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {file ? (
                                <div>
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700">
                                        <FileText className="h-7 w-7" />
                                    </div>
                                    <p className="mt-4 text-sm font-bold text-slate-950">{file.name}</p>
                                    <p className="mt-2 text-sm text-slate-500">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • ready to analyze
                                    </p>
                                    <button
                                        type="button"
                                        className="mt-4 text-xs font-bold text-blue-700 underline underline-offset-2"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setFile(null);
                                            setUploadError(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                    >
                                        Choose a different file
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-100 text-blue-700">
                                        <UploadCloud className="h-7 w-7" />
                                    </div>
                                    <p className="mt-4 text-base font-bold text-slate-950">
                                        Drag and drop your PRD or BRD document here, or click to upload.
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-slate-500">
                                        Supports PDF, DOCX, and Markdown up to 10MB.
                                    </p>
                                </div>
                            )}
                        </div>

                        {uploadError && (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {uploadError}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => void handleUpload()}
                            disabled={!file || uploading}
                            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Start Analysis
                                </>
                            )}
                        </button>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/86 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">AI Insights</p>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl bg-slate-50 px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Coverage</p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                    {completedCount > 0
                                        ? `${completedCount} completed document${completedCount > 1 ? 's are' : ' is'} ready for deeper requirement review.`
                                        : 'Upload a document to start generating structured requirement intelligence.'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Queue Health</p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                    {processingCount > 0
                                        ? `${processingCount} document${processingCount > 1 ? 's are' : ' is'} currently being analyzed by AI.`
                                        : 'No analyses are waiting in the queue right now.'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-4 py-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Gap Detection</p>
                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                    Completed analyses surface missing requirements and unclear areas directly inside each document view.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/86 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur sm:p-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-700">Recent Activity</p>
                        <div className="mt-5 space-y-4">
                            {recentActivity.length === 0 ? (
                                <p className="text-sm leading-6 text-slate-500">
                                    Your recent uploads and analyses will appear here.
                                </p>
                            ) : (
                                recentActivity.map((prd) => {
                                    const status = getStatusPresentation(prd.status);
                                    return (
                                        <div key={prd.id} className="rounded-2xl bg-slate-50 px-4 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-slate-900">{prd.filename}</p>
                                                    <p className="mt-1 text-xs text-slate-500">{formatDate(prd.created_at)}</p>
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}>
                                                    {status.icon}
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {deleteCandidate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm"
                    onClick={closeDeleteModal}
                >
                    <div
                        className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Delete document confirmation"
                    >
                        <div className="p-6">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Delete this document?</h3>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        You are deleting <span className="font-semibold text-slate-800">{deleteCandidate.filename}</span>.
                                        This permanently removes the PRD and its analysis.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 rounded-b-[1.75rem] border-t border-slate-100 bg-slate-50 px-6 py-4">
                            <button
                                type="button"
                                onClick={closeDeleteModal}
                                disabled={Boolean(deletingId)}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Keep Document
                            </button>
                            <button
                                type="button"
                                onClick={() => void confirmDelete()}
                                disabled={Boolean(deletingId)}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
