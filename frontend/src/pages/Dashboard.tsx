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
        <div>
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Your Documents</h1>
                    <p className="mt-2 text-sm text-slate-600">Manage and view analysis for your uploaded product requirements.</p>
                </div>
                <Link
                    to="/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Upload New Document
                </Link>
            </div>

            {prds.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-slate-200">
                    <FileText className="mx-auto h-12 w-12 text-slate-300" />
                    <h3 className="mt-4 text-sm font-medium text-slate-900">No documents</h3>
                    <p className="mt-1 text-sm text-slate-500">Get started by uploading a new PRD or BRD.</p>
                    <div className="mt-6">
                        <Link
                            to="/upload"
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Upload Document
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
                    <ul className="divide-y divide-slate-200">
                        {prds.map((prd) => (
                            <li key={prd.id} className="hover:bg-slate-50 transition-colors">
                                <Link to={`/prd/${prd.id}`} className="block block px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center min-w-0">
                                            <div className="flex-shrink-0">
                                                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <FileText className="h-6 w-6 text-blue-600" />
                                                </div>
                                            </div>
                                            <div className="min-w-0 flex-1 px-4 md:grid md:grid-cols-2 md:gap-4 items-center">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 truncate">{prd.filename}</p>
                                                    <p className="mt-1 text-xs text-slate-500 truncate">
                                                        Uploaded on {formatDate(prd.created_at)}
                                                    </p>
                                                </div>
                                                <div className="hidden md:block">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${prd.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                            prd.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                                                prd.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                                    'bg-slate-100 text-slate-800'}`}>
                                                        {prd.status === 'processing' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                                        {prd.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <ArrowRight className="h-5 w-5 text-slate-400" />
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
