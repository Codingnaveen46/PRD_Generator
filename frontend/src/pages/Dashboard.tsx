import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { formatDate } from '../utils/formatters';
import { FileText, Loader2, ArrowRight } from 'lucide-react';

interface PRD {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

export default function Dashboard() {
    const [prds, setPrds] = useState<PRD[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrds = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api/v1/prds');
                setPrds(response.data);
            } catch (error) {
                console.error('Error fetching PRDs:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrds();
    }, []);

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
                            <Link 
                                key={prd.id} 
                                to={`/prd/${prd.id}`}
                                className="group"
                            >
                                <div className="bg-white rounded-2xl shadow-md border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden hover:-translate-y-1">
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
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
