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
            const response = await axios.post('http://localhost:8000/api/v1/analyze', formData, {
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
        <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Upload PRD</h1>
                <p className="mt-2 text-sm text-slate-600">
                    Upload your raw Product Requirements Document to generate an intelligent, standardized analysis.
                </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div
                    className={clsx(
                        "border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer",
                        isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:bg-slate-50",
                        (file && !isDragging) ? "border-emerald-500 bg-emerald-50/30" : ""
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
                        <div className="flex flex-col items-center">
                            <div className="p-4 bg-emerald-100 rounded-full mb-4">
                                <File className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">{file.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <button
                                className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-500"
                                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            >
                                Choose another file
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center pointer-events-none">
                            <div className="p-4 bg-blue-50 rounded-full mb-4">
                                <UploadCloud className="w-10 h-10 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Click or drag file to this area to upload</h3>
                            <p className="text-sm text-slate-500 mt-2">Support for a single upload. Strictly prohibit from uploading company data or other confidential files.</p>
                            <p className="text-xs text-slate-400 mt-4 font-semibold uppercase tracking-wider">Accepted file types: PDF, DOCX, MD (Max 10MB)</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                <div className="mt-8 flex justify-end shrink-0">
                    <button
                        onClick={handleUpload}
                        disabled={!file || loading}
                        className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading && <Loader2 className="w-5 h-5 mr-3 animate-spin" />}
                        {loading ? 'Uploading...' : 'Generate Intelligence'}
                    </button>
                </div>
            </div>
        </div>
    );
}
