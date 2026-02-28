import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, File, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export default function UploadPRD() {
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            validateAndSetFile(droppedFile);
        }
    }, []);

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    const validateAndSetFile = (selectedFile: File) => {
        setError(null);
        const validTypes = [
            'application/pdf',
            'text/markdown',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const validExtensions = ['.pdf', '.md', '.docx'];

        const isValidType = validTypes.includes(selectedFile.type) ||
            validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

        if (!isValidType) {
            setError("Invalid file type. Please upload a .pdf, .md, or .docx file.");
            setFile(null);
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) {
            setError("File is too large. Maximum size is 10MB.");
            setFile(null);
            return;
        }

        setFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post('http://localhost:8000/api/v1/analyze', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Navigate to the dashboard or directly to the processing PRD
            navigate(`/dashboard`);
        } catch (err: any) {
            console.error('Upload error:', err);
            setError(err.response?.data?.detail || "Failed to upload file. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-4 py-20">
            <div className="w-full max-w-3xl">
                {/* Header */}
                <div className="mb-12 text-center">
                    <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-4">
                        Upload Your Document
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Simply upload your PRD, BRD, or feature document and we'll provide intelligent analysis, identify missing requirements, and highlight potential risks.
                    </p>
                </div>

                {/* Upload Card */}
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="p-8 sm:p-12">
                        {/* Drop Zone */}
                        <div
                            className={clsx(
                                "border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer",
                                isDragging 
                                    ? "border-blue-500 bg-blue-50 scale-105" 
                                    : file 
                                        ? "border-emerald-500 bg-emerald-50" 
                                        : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
                            )}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <input
                                id="file-upload"
                                type="file"
                                className="hidden"
                                accept=".pdf,.md,.docx"
                                onChange={onFileInput}
                            />

                            {file ? (
                                <div className="flex flex-col items-center py-4">
                                    <div className="p-4 bg-emerald-100 rounded-2xl mb-4 animate-bounce">
                                        <File className="w-10 h-10 text-emerald-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">{file.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze
                                    </p>
                                    <button
                                        className="text-sm text-blue-600 font-bold hover:text-blue-700 underline underline-offset-2 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                                    >
                                        ↻ Choose different file
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-8 pointer-events-none">
                                    <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                                        <UploadCloud className="w-14 h-14 text-blue-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                                        Drag & drop your file here
                                    </h3>
                                    <p className="text-slate-600 mb-4">or click to browse your computer</p>
                                    <div className="flex gap-2 justify-center flex-wrap">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">PDF</span>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">DOCX</span>
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">Markdown</span>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-6 font-medium">Maximum size: 10 MB</p>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-4">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-red-900">Upload failed</p>
                                    <p className="text-sm text-red-700 mt-1">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-8 flex gap-4 justify-center sm:justify-end">
                            <button
                                onClick={() => window.history.back()}
                                className="inline-flex items-center px-6 py-3 border border-slate-300 shadow-sm text-sm font-bold rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="inline-flex items-center px-8 py-3 border border-transparent shadow-lg text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <span>Generate Analysis</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Info Footer */}
                    <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-t border-slate-200 px-8 py-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
                            <div>
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fast</p>
                                <p className="text-sm text-slate-700">Analyze in seconds</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Secure</p>
                                <p className="text-sm text-slate-700">Your data is encrypted</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Smart</p>
                                <p className="text-sm text-slate-700">AI-powered insights</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
