import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

import { Loader2, Download, AlertTriangle, CheckCircle2, FileText, ChevronLeft, ShieldAlert, MessageSquare, Send, RefreshCw, X } from 'lucide-react';

export default function PRDViewer() {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
    const prdContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;

        const fetchPrdDetail = async () => {
            try {
                console.log('Fetching PRD for id:', id);
                const response = await axios.get(`http://localhost:8000/api/v1/prds/${id}`);
                console.log('PRD response:', response.data);

                setData(response.data);

                // Stop polling if completed or failed
                if (response.data.status === 'completed' || response.data.status === 'failed') {
                    clearInterval(interval);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error('Error fetching PRD:', err);
                setError(err.response?.data?.detail || "Failed to load PRD data.");
                clearInterval(interval);
                setLoading(false);
            }
        };

        if (id) {
            fetchPrdDetail();
            // Poll every 3 seconds while loading
            interval = setInterval(fetchPrdDetail, 3000);
        }

        return () => clearInterval(interval);
    }, [id]);

    const handleDownload = async (format: 'md' | 'pdf' | 'docx') => {
        console.log('Download requested, data:', data);
        
        if (!data || !data.analysis) {
            alert('Please wait for the analysis to complete before downloading.');
            return;
        }
        
        console.log('standardized_prd:', data.analysis.standardized_prd?.substring(0, 100));

        // Professional Naming: PRD_[Sanitized_Filename]
        let cleanName = "PRD_Export";
        if (data.filename) {
            const lastDotIndex = data.filename.lastIndexOf('.');
            const rawName = lastDotIndex !== -1 ? data.filename.substring(0, lastDotIndex) : data.filename;
            // Shorter, cleaner sanitization
            const sanitized = rawName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
            cleanName = `PRD_${sanitized}`;
        }

        const contentMarkdown = data?.analysis?.standardized_prd || '';

        if (!contentMarkdown) {
            alert('No content available to download');
            return;
        }

        try {
            if (format === 'md') {
                const blob = new Blob([contentMarkdown], { type: 'text/plain;charset=utf-8' });
                saveAs(blob, `${cleanName}.md`);
            } else if (format === 'pdf') {
                try {
                    const doc = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: 'a4'
                    });
                    
                    doc.setProperties({
                        title: cleanName,
                        subject: 'Standardized PRD Document',
                        author: 'PRD AI Generator'
                    });

                    const pageWidth = 190;
                    const pageHeight = 280;
                    const margin = 10;
                    const lineHeight = 7;
                    let y = margin;
                    
                    const lines = contentMarkdown.split('\n');
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const trimmed = line.trim();
                        
                        if (trimmed.startsWith('## ')) {
                            doc.setFontSize(18);
                            doc.setFont('helvetica', 'bold');
                            y += 5;
                        } else if (trimmed.startsWith('### ')) {
                            doc.setFontSize(14);
                            doc.setFont('helvetica', 'bold');
                            y += 3;
                        } else if (trimmed.startsWith('# ')) {
                            doc.setFontSize(22);
                            doc.setFont('helvetica', 'bold');
                            y += 8;
                        } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                            doc.setFontSize(11);
                            doc.setFont('helvetica', 'normal');
                            const bulletText = '  •  ' + trimmed.replace(/^[* -] /, '');
                            const textLines = doc.splitTextToSize(bulletText, pageWidth - margin * 2);
                            for (const textLine of textLines) {
                                if (y + lineHeight > pageHeight) {
                                    doc.addPage();
                                    y = margin;
                                }
                                doc.text(textLine, margin, y);
                                y += lineHeight;
                            }
                            continue;
                        } else {
                            doc.setFontSize(11);
                            doc.setFont('helvetica', 'normal');
                        }
                        
                        if (trimmed) {
                            const textLines = doc.splitTextToSize(trimmed, pageWidth - margin * 2);
                            for (const textLine of textLines) {
                                if (y + lineHeight > pageHeight) {
                                    doc.addPage();
                                    y = margin;
                                }
                                doc.text(textLine, margin, y);
                                y += lineHeight;
                            }
                        } else {
                            y += 3;
                        }
                    }
                    
                    const pdfData = doc.output('datauristring');
                    const link = document.createElement('a');
                    link.href = pdfData;
                    link.download = `${cleanName}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } catch (pdfError) {
                    console.error('PDF generation error:', pdfError);
                    alert('Failed to generate PDF. Check console for details.');
                }

            } else if (format === 'docx') {
                const lines = contentMarkdown.split('\n');
                const children: any[] = [];

                lines.forEach((line: string) => {
                    const trimmed = line.trim();

                    if (!trimmed) {
                        children.push(new Paragraph({ children: [new TextRun("")] })); // Explicit empty run for schema stability
                        return;
                    }

                    if (trimmed.startsWith('### ')) {
                        children.push(new Paragraph({
                            text: trimmed.replace('### ', ''),
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 240, after: 120 }
                        }));
                    } else if (trimmed.startsWith('## ')) {
                        children.push(new Paragraph({
                            text: trimmed.replace('## ', ''),
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 360, after: 180 }
                        }));
                    } else if (trimmed.startsWith('# ')) {
                        children.push(new Paragraph({
                            text: trimmed.replace('# ', ''),
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 480, after: 240 }
                        }));
                    } else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                        children.push(new Paragraph({
                            children: [new TextRun(trimmed.replace(/^[* -] /, ''))],
                            bullet: { level: 0 },
                            spacing: { after: 100 }
                        }));
                    } else {
                        children.push(new Paragraph({
                            children: [new TextRun(trimmed)],
                            spacing: { after: 150 }
                        }));
                    }
                });

                const doc = new Document({
                    sections: [{
                        properties: {},
                        children: children,
                    }],
                });

                const blob = await Packer.toBlob(doc);
                saveAs(blob, `${cleanName}.docx`);
            }
        } catch (err) {
            console.error(`Error generating ${format}:`, err);
            alert(`Failed to generate ${format.toUpperCase()} file. Please try again.`);
        }
    };

    const handleRefine = async () => {
        if (!chatInput.trim() || isRefining) return;

        const instruction = chatInput;
        setIsRefining(true);
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', content: instruction }]);

        try {
            const response = await axios.post(`http://localhost:8000/api/v1/prds/${id}/refine`, {
                instruction
            });
            setData(response.data);
            setChatHistory(prev => [...prev, { role: 'ai', content: "I've updated the PRD based on your instructions!" }]);
        } catch (err: any) {
            console.error('Error refining PRD:', err);
            setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error while trying to refine the document." }]);
        } finally {
            setIsRefining(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-slate-500 font-medium animate-pulse">Initializing request...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex flex-col items-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading PRD</h3>
                <p className="text-red-700">{error}</p>
                <Link to="/dashboard" className="mt-6 text-blue-600 hover:underline">Return to Dashboard</Link>
            </div>
        );
    }

    if (data?.status === 'processing') {
        return (
            <div className="flex flex-col justify-center items-center h-[50vh] space-y-6">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">AI is analyzing your document</h2>
                    <p className="text-slate-500 mt-2 max-w-sm">
                        We are extracting text, correlating requirements, and standardizing the format. This typically takes 10-30 seconds.
                    </p>
                </div>
            </div>
        );
    }

    if (data?.status === 'failed') {
        return (
            <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex flex-col items-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Analysis Failed</h3>
                <p className="text-red-700">The OpenAI processing step encountered an error for this document.</p>
                <Link to="/upload" className="mt-6 text-blue-600 hover:underline font-medium">Upload another file</Link>
            </div>
        );
    }

    const analysis = data?.analysis;

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="mb-6">
                <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Dashboard
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Main Document Panel */}
                <div className={`transition-all duration-300 ${showChat ? 'lg:w-[60%]' : 'w-full lg:w-2/3'} space-y-6`}>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Standardized PRD
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                                    Source: {data.filename}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDownload('md')}
                                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                    title="Download as Markdown"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    MD
                                </button>
                                <button
                                    onClick={() => handleDownload('pdf')}
                                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                    title="Download as PDF"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    PDF
                                </button>
                                <button
                                    onClick={() => handleDownload('docx')}
                                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 hover:text-blue-600 transition-colors"
                                    title="Download as DOCX"
                                >
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    DOCX
                                </button>
                                <div className="w-px h-6 bg-slate-200 mx-1" />
                                <button
                                    onClick={() => setShowChat(!showChat)}
                                    className={`inline-flex items-center px-4 py-1.5 shadow-sm text-xs font-bold rounded-lg transition-all duration-200 ${showChat
                                        ? 'bg-blue-600 text-white ring-2 ring-blue-100'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                                        }`}
                                >
                                    <MessageSquare className={`w-3.5 h-3.5 mr-1.5 ${showChat ? 'animate-pulse' : ''}`} />
                                    Refine with AI
                                </button>
                            </div>
                        </div>
                        <div ref={prdContentRef} className="p-10 prose prose-slate max-w-none 
                            prose-headings:text-slate-900 
                            prose-h1:text-3xl prose-h1:font-black prose-h1:border-b-2 prose-h1:border-blue-100 prose-h1:pb-4 prose-h1:mb-10 prose-h1:mt-16
                            prose-h2:text-2xl prose-h2:font-extrabold prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-3 prose-h2:mt-12 prose-h2:mb-6
                            prose-h3:text-xl prose-h3:font-bold prose-h3:mt-8 prose-h3:mb-4
                            prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-8 prose-p:text-lg
                            prose-li:text-slate-700 prose-li:my-2 prose-li:text-lg
                            prose-ul:my-8
                            prose-a:text-blue-600 prose-a:font-semibold">
                            <ReactMarkdown>{analysis?.standardized_prd || "No content generated."}</ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* Refinement Sidebar */}
                {showChat && (
                    <div className="w-full lg:w-96 flex flex-col h-[700px] lg:h-[calc(100vh-140px)] sticky top-24 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden animate-in slide-in-from-right duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="font-bold text-slate-900">Refine with AI</h3>
                            </div>
                            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-grow p-6 overflow-y-auto space-y-4 bg-slate-50/30">
                            {chatHistory.length === 0 && (
                                <div className="text-center py-8">
                                    <div className="bg-blue-100 text-blue-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                                        <RefreshCw className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-600">What would you like to update?</p>
                                    <p className="text-xs text-slate-400 mt-1 italic">"Add a section for security requirements"</p>
                                </div>
                            )}

                            {chatHistory.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-bl-none'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {isRefining && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                        <span className="text-xs font-medium text-slate-500 italic">Thinking...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="relative">
                                <textarea
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleRefine();
                                        }
                                    }}
                                    placeholder="Type your instruction..."
                                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none h-24"
                                />
                                <button
                                    onClick={handleRefine}
                                    disabled={!chatInput.trim() || isRefining}
                                    className="absolute right-3 bottom-3 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Intelligence Sidebar */}
                <div className={`${showChat ? 'hidden xl:flex' : 'flex'} w-full lg:w-1/3 flex-col gap-6 sticky top-24 transition-opacity duration-300`}>
                    {/* Quality Score Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Intelligence Score</h3>
                        <div className="flex items-end gap-4">
                            <div className="text-6xl font-black tracking-tighter text-slate-900">
                                {analysis?.quality_score || 0}
                            </div>
                            <div className="pb-1.5 flex flex-col">
                                <span className="text-slate-400 text-sm font-medium">/ 100</span>
                                <span className="text-blue-600 font-semibold text-sm">Actionability</span>
                            </div>
                        </div>
                        <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full ${(analysis?.quality_score || 0) > 80 ? 'bg-emerald-500' :
                                    (analysis?.quality_score || 0) > 50 ? 'bg-amber-400' : 'bg-red-500'
                                    }`}
                                style={{ width: `${analysis?.quality_score || 0}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Missing Requirements */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            <h3 className="font-bold text-slate-900">Missing Requirements</h3>
                        </div>
                        <div className="p-6">
                            {analysis?.missing_requirements?.length > 0 ? (
                                <ul className="space-y-3">
                                    {analysis.missing_requirements.map((req: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-700">
                                            <span className="bg-amber-100 text-amber-800 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">{i + 1}</span>
                                            <span>{req}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-4 flex flex-col items-center text-emerald-600">
                                    <CheckCircle2 className="w-8 h-8 opacity-50 mb-2" />
                                    <span className="text-sm font-medium">No major missing requirements detected.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* QA Risk Insights */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-rose-500" />
                            <h3 className="font-bold text-slate-900">QA & Technical Risks</h3>
                        </div>
                        <div className="p-6 bg-slate-50/50">
                            {analysis?.qa_risk_insights?.length > 0 ? (
                                <ul className="space-y-3">
                                    {analysis.qa_risk_insights.map((risk: string, i: number) => (
                                        <li key={i} className="flex gap-3 text-sm text-slate-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                                            <span>{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-4 text-sm text-slate-500 italic">
                                    No specific risks identified.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
