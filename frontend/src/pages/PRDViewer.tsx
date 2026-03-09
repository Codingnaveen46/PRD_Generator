import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

import {
    Loader2,
    Download,
    AlertTriangle,
    Check,
    CheckCircle2,
    Copy,
    FileText,
    ChevronLeft,
    ShieldAlert,
    MessageSquare,
    Send,
    RefreshCw,
    X,
    Bug,
    FileDown,
    Layers,
    Search,
    Sparkles,
    ShieldCheck,
    Gauge,
    CircleAlert,
    ListFilter,
    Target,
    TriangleAlert,
    ChevronDown,
    ChevronUp,
    Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QACoverageMindMap, { type MindMapSelection } from '../components/QACoverageMindMap';

interface AnalysisData {
    standardized_prd?: string;
    quality_score?: number;
    missing_requirements?: string[];
    qa_risk_insights?: string[];
}

interface PRDDetailResponse {
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    analysis?: AnalysisData;
}

interface ChatMessage {
    role: 'user' | 'ai';
    content: string;
}

interface TestCase {
    scenario: string;
    testing_type: string;
    severity: string;
    priority: string;
    feature_name: string;
    sub_feature_name: string;
    test_conditions: string;
    test_idea: string;
    test_data: string;
    acceptance_criteria: string;
    test_steps: string;
}

interface RiskLevelPresentation {
    label: string;
    className: string;
    barClassName: string;
    helperText: string;
    icon: ReactNode;
    panelClassName: string;
}

interface CoverageModule {
    module_name: string;
    total_requirements: number;
    covered_requirements: number;
    coverage_percentage: number;
    mapped_test_scenarios: string[];
    uncovered_requirements: string[];
    recommended_test_scenarios: string[];
}

interface RiskAnalysisItem {
    area: string;
    level: string;
    issues: string[];
    suggested_testing_approach: string;
}

interface MindMapRequirement {
    requirement: string;
    scenarios: string[];
    covered: boolean;
}

interface MindMapModule {
    module_name: string;
    requirements: MindMapRequirement[];
}

interface QAIntelligence {
    overall_coverage_percentage: number;
    coverage_modules: CoverageModule[];
    uncovered_requirement_alerts: string[];
    risk_analysis: RiskAnalysisItem[];
    mind_map: MindMapModule[];
}

interface QAIntelligenceResponse {
    prd_id: string;
    intelligence: QAIntelligence;
    cached: boolean;
}

interface AutomationScriptResponse {
    framework: string;
    language: string;
    file_name: string;
    code: string;
    explanation: string;
}

const CODE_KEYWORDS = new Set([
    'import', 'from', 'export', 'default', 'const', 'let', 'var', 'new', 'return', 'await', 'async', 'if', 'else',
    'try', 'catch', 'finally', 'throw', 'class', 'extends', 'describe', 'it', 'test', 'beforeEach', 'afterEach',
    'public', 'private', 'protected', 'static', 'void', 'package', 'async', 'function', 'final', 'true', 'false',
]);

const CODE_GLOBALS = new Set([
    'test', 'expect', 'page', 'request', 'cy', 'By', 'WebDriver', 'WebDriverWait', 'ExpectedConditions',
    'ChromeDriver', 'Duration',
]);

function normalizeLabel(value?: string) {
    return value?.trim().toLowerCase() || '';
}

function createQaIntelligenceSignature(standardizedPrd?: string, testCases: TestCase[] = []) {
    if (!standardizedPrd || !testCases.length) return '';

    const serialized = `${standardizedPrd}::${JSON.stringify(
        testCases.map((testCase) => [
            testCase.scenario,
            testCase.testing_type,
            testCase.severity,
            testCase.priority,
            testCase.feature_name,
            testCase.sub_feature_name,
            testCase.acceptance_criteria,
            testCase.test_steps,
        ]),
    )}`;

    let hash = 0;
    for (let index = 0; index < serialized.length; index += 1) {
        hash = (hash * 31 + serialized.charCodeAt(index)) | 0;
    }

    return `${serialized.length}-${Math.abs(hash)}`;
}

function getSeverityPresentation(severity: string) {
    const normalized = normalizeLabel(severity);

    if (normalized === 'critical') {
        return 'bg-red-50 text-red-700 border-red-200';
    }

    if (normalized === 'high') {
        return 'bg-orange-50 text-orange-700 border-orange-200';
    }

    if (normalized === 'medium') {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getPriorityPresentation(priority: string) {
    const normalized = normalizeLabel(priority);

    if (normalized === 'critical') return 'bg-red-50 text-red-700 border-red-200';
    if (normalized === 'high') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (normalized === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getTypePresentation(type: string) {
    const normalized = normalizeLabel(type);

    if (normalized.includes('security')) {
        return {
            label: type || 'Security',
            className: 'bg-rose-50 text-rose-700 border-rose-200',
            icon: <ShieldCheck className="h-3.5 w-3.5" />,
        };
    }

    if (normalized.includes('performance')) {
        return {
            label: type || 'Performance',
            className: 'bg-violet-50 text-violet-700 border-violet-200',
            icon: <Gauge className="h-3.5 w-3.5" />,
        };
    }

    if (normalized.includes('negative')) {
        return {
            label: type || 'Negative',
            className: 'bg-amber-50 text-amber-700 border-amber-200',
            icon: <TriangleAlert className="h-3.5 w-3.5" />,
        };
    }

    return {
        label: type || 'Functional',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Sparkles className="h-3.5 w-3.5" />,
    };
}

function getRiskLevelPresentation(
    score: number,
    missingRequirementCount: number,
    criticalCount: number,
    highPriorityCount: number,
): RiskLevelPresentation {
    if (score < 55 || criticalCount > 0) {
        return {
            label: 'High Risk',
            className: 'bg-red-50 text-red-700 border-red-200',
            barClassName: 'bg-red-500',
            helperText: 'Critical issues or low requirement quality need immediate attention.',
            icon: <AlertTriangle className="h-4 w-4" />,
            panelClassName: 'border-red-200 bg-red-50/80',
        };
    }

    if (score < 75 || missingRequirementCount > 2 || highPriorityCount > 4) {
        return {
            label: 'Moderate Risk',
            className: 'bg-amber-50 text-amber-700 border-amber-200',
            barClassName: 'bg-amber-400',
            helperText: 'Coverage is useful but there are still gaps worth resolving before implementation.',
            icon: <TriangleAlert className="h-4 w-4" />,
            panelClassName: 'border-amber-200 bg-amber-50/80',
        };
    }

    return {
        label: 'Low Risk',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        barClassName: 'bg-emerald-500',
        helperText: 'The analysis looks healthy and the document appears relatively actionable.',
        icon: <ShieldCheck className="h-4 w-4" />,
        panelClassName: 'border-emerald-200 bg-emerald-50/80',
    };
}

function getCoverageScoreBarClass(score: number) {
    if (score <= 50) {
        return 'bg-red-500';
    }

    if (score <= 75) {
        return 'bg-amber-400';
    }

    return 'bg-emerald-500';
}

function buildAISuggestions(items: string[], mode: 'missing' | 'risk') {
    const combined = items.join(' ').toLowerCase();
    const suggestions: string[] = [];

    if (combined.includes('performance') || combined.includes('latency') || combined.includes('scale')) {
        suggestions.push('Add explicit performance benchmarks, scalability targets, and load expectations.');
    }

    if (combined.includes('error') || combined.includes('retry') || combined.includes('failure')) {
        suggestions.push('Document retry logic, failure states, and user-facing error handling requirements.');
    }

    if (combined.includes('security') || combined.includes('sql') || combined.includes('session')) {
        suggestions.push('Specify security controls, session handling, and validation rules as testable requirements.');
    }

    if (combined.includes('mobile') || combined.includes('responsive')) {
        suggestions.push('Include responsive behavior and mobile acceptance criteria for key flows.');
    }

    if (!suggestions.length) {
        suggestions.push(
            mode === 'missing'
                ? 'Clarify non-functional requirements, edge cases, and success criteria to strengthen coverage.'
                : 'Turn each highlighted risk into a specific requirement and validation step for QA.',
        );
    }

    return suggestions.slice(0, 2);
}

function getAutomationFrameworkPresentation(framework: string) {
    const normalized = normalizeLabel(framework);

    if (normalized === 'playwright') {
        return 'border-blue-400/30 bg-blue-500/10 text-blue-200';
    }

    if (normalized === 'cypress') {
        return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    }

    if (normalized === 'selenium') {
        return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    }

    return 'border-violet-400/30 bg-violet-500/10 text-violet-200';
}

function renderHighlightedCode(line: string): ReactNode[] {
    const tokens = line.match(/(\/\/.*$|#.*$|\/\*.*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|@\w+|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|.)/g) || [line];

    return tokens.map((token, index) => {
        if (!token.trim()) {
            return token;
        }

        let className = 'text-slate-100';

        if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
            className = 'text-slate-500';
        } else if (token.startsWith('"') || token.startsWith('\'') || token.startsWith('`')) {
            className = 'text-emerald-300';
        } else if (token.startsWith('@')) {
            className = 'text-fuchsia-300';
        } else if (/^\d/.test(token)) {
            className = 'text-amber-300';
        } else if (CODE_KEYWORDS.has(token)) {
            className = 'text-sky-300';
        } else if (CODE_GLOBALS.has(token)) {
            className = 'text-violet-300';
        } else if (/^[A-Z][A-Za-z0-9_]*$/.test(token)) {
            className = 'text-cyan-300';
        }

        return (
            <span key={`${token}-${index}`} className={className}>
                {token}
            </span>
        );
    });
}

function getCoverageTone(coveragePercentage: number) {
    if (coveragePercentage >= 85) {
        return {
            accent: 'text-emerald-700',
            badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            panel: 'border-emerald-200 bg-emerald-50/60',
            progress: 'bg-emerald-500',
            indicator: 'bg-emerald-500',
        };
    }

    if (coveragePercentage >= 60) {
        return {
            accent: 'text-amber-700',
            badge: 'border-amber-200 bg-amber-50 text-amber-700',
            panel: 'border-amber-200 bg-amber-50/60',
            progress: 'bg-amber-400',
            indicator: 'bg-amber-500',
        };
    }

    return {
        accent: 'text-red-700',
        badge: 'border-red-200 bg-red-50 text-red-700',
        panel: 'border-red-200 bg-red-50/60',
        progress: 'bg-red-500',
        indicator: 'bg-red-500',
    };
}

function getRiskTone(level: string) {
    const normalized = normalizeLabel(level);

    if (normalized === 'high') {
        return {
            badge: 'border-red-200 bg-red-50 text-red-700',
            panel: 'border-red-200 bg-red-50/60',
            accent: 'text-red-700',
            indicator: 'bg-red-500',
        };
    }

    if (normalized === 'medium') {
        return {
            badge: 'border-amber-200 bg-amber-50 text-amber-700',
            panel: 'border-amber-200 bg-amber-50/60',
            accent: 'text-amber-700',
            indicator: 'bg-amber-500',
        };
    }

    return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        panel: 'border-emerald-200 bg-emerald-50/60',
        accent: 'text-emerald-700',
        indicator: 'bg-emerald-500',
    };
}

function findRiskForModule(moduleName: string, riskItems: RiskAnalysisItem[]) {
    const normalizedModule = normalizeLabel(moduleName);

    return riskItems.find((risk) => {
        const normalizedArea = normalizeLabel(risk.area);
        return normalizedArea.includes(normalizedModule) || normalizedModule.includes(normalizedArea);
    });
}

function CollapsibleSection({
    title,
    description,
    icon,
    isOpen,
    onToggle,
    badge,
    children,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    badge?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="premium-surface overflow-hidden rounded-[1.5rem] shadow-sm">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                        {icon}
                        {title}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>

                <div className="flex items-center gap-3">
                    {badge}
                    <span className="rounded-full border border-slate-200 bg-white p-2 text-slate-500">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                </div>
            </button>

            {isOpen && <div className="border-t border-slate-100 px-5 py-5">{children}</div>}
        </div>
    );
}

export default function PRDViewer() {
    const AUTOMATION_FRAMEWORKS = ['Playwright', 'Cypress', 'Selenium', 'API'];
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<PRDDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [isGeneratingTestCases, setIsGeneratingTestCases] = useState(false);
    const [activeTab, setActiveTab] = useState<'prd' | 'testcases' | 'qa'>('prd');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [featureFilter, setFeatureFilter] = useState('all');
    const [qaIntelligence, setQaIntelligence] = useState<QAIntelligence | null>(null);
    const [qaIntelligenceCached, setQaIntelligenceCached] = useState(false);
    const [isLoadingQAIntelligence, setIsLoadingQAIntelligence] = useState(false);
    const [isRefreshingQAIntelligence, setIsRefreshingQAIntelligence] = useState(false);
    const [qaIntelligenceError, setQaIntelligenceError] = useState<string | null>(null);
    const [selectedFramework, setSelectedFramework] = useState('Playwright');
    const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
    const [automationScript, setAutomationScript] = useState<AutomationScriptResponse | null>(null);
    const [isGeneratingAutomation, setIsGeneratingAutomation] = useState(false);
    const [automationError, setAutomationError] = useState<string | null>(null);
    const [copiedAutomation, setCopiedAutomation] = useState(false);
    const [animatedCoverageScore, setAnimatedCoverageScore] = useState(0);
    const [expandedQaSections, setExpandedQaSections] = useState({
        coverage: true,
        gaps: true,
        technicalRisks: true,
        riskInsights: true,
    });
    const [expandedCoverageModules, setExpandedCoverageModules] = useState<Record<string, boolean>>({});
    const [expandedGapModules, setExpandedGapModules] = useState<Record<string, boolean>>({});
    const [expandedRiskAreas, setExpandedRiskAreas] = useState<Record<string, boolean>>({});
    const [mindMapSelection, setMindMapSelection] = useState<MindMapSelection | null>(null);
    const prdContentRef = useRef<HTMLDivElement>(null);
    const automationPanelRef = useRef<HTMLDivElement>(null);
    const previousQaCacheKeyRef = useRef<string | null>(null);
    const qaIntelligenceFetchAttemptedRef = useRef<string | null>(null);

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

                    // Also fetch test cases if PRD is completed
                    if (response.data.status === 'completed') {
                        try {
                            const tcResponse = await axios.get(`http://localhost:8000/api/v1/prds/${id}/test-cases`);
                            if (tcResponse.data && tcResponse.data.test_cases) {
                                setTestCases(tcResponse.data.test_cases);
                            }
                        } catch (tcErr) {
                            console.error('Error fetching test cases:', tcErr);
                        }
                    }
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

    useEffect(() => {
        if (!testCases.length) {
            setSelectedScenarioIndex(0);
            return;
        }

        if (selectedScenarioIndex > testCases.length - 1) {
            setSelectedScenarioIndex(0);
        }
    }, [selectedScenarioIndex, testCases]);

    const qaIntelligenceSignature = useMemo(
        () => createQaIntelligenceSignature(data?.analysis?.standardized_prd, testCases),
        [data?.analysis?.standardized_prd, testCases],
    );
    const qaIntelligenceCacheKey = useMemo(
        () => (id && qaIntelligenceSignature ? `qa-intelligence:${id}:${qaIntelligenceSignature}` : null),
        [id, qaIntelligenceSignature],
    );

    useEffect(() => {
        if (previousQaCacheKeyRef.current === qaIntelligenceCacheKey) {
            return;
        }

        previousQaCacheKeyRef.current = qaIntelligenceCacheKey;
        qaIntelligenceFetchAttemptedRef.current = null;
        setQaIntelligence(null);
        setQaIntelligenceCached(false);
        setQaIntelligenceError(null);
    }, [qaIntelligenceCacheKey]);

    const fetchQAIntelligence = useCallback(async (forceRegenerate = false) => {
        if (!id || !testCases.length) return;

        if (!forceRegenerate && qaIntelligenceFetchAttemptedRef.current === qaIntelligenceCacheKey) {
            return;
        }

        qaIntelligenceFetchAttemptedRef.current = qaIntelligenceCacheKey;

        if (forceRegenerate) {
            setIsRefreshingQAIntelligence(true);
        } else if (!qaIntelligence) {
            setIsLoadingQAIntelligence(true);
        }

        setQaIntelligenceError(null);

        try {
            const response = await axios.get<QAIntelligenceResponse>(
                `http://localhost:8000/api/v1/prds/${id}/qa-intelligence`,
                {
                    params: forceRegenerate ? { regenerate: true } : undefined,
                },
            );

            setQaIntelligence(response.data.intelligence);
            setQaIntelligenceCached(response.data.cached);

            if (qaIntelligenceCacheKey) {
                sessionStorage.setItem(
                    qaIntelligenceCacheKey,
                    JSON.stringify({
                        intelligence: response.data.intelligence,
                        cached: response.data.cached,
                    }),
                );
            }
        } catch (err: any) {
            console.error('Error fetching QA intelligence:', err);
            setQaIntelligenceError(err.response?.data?.detail || 'Failed to load QA intelligence.');
        } finally {
            setIsLoadingQAIntelligence(false);
            setIsRefreshingQAIntelligence(false);
        }
    }, [id, qaIntelligence, qaIntelligenceCacheKey, testCases.length]);

    useEffect(() => {
        if (!id || activeTab !== 'qa' || !testCases.length || qaIntelligence || isLoadingQAIntelligence) {
            return;
        }

        if (qaIntelligenceCacheKey) {
            const cachedPayload = sessionStorage.getItem(qaIntelligenceCacheKey);
            if (cachedPayload) {
                try {
                    const parsedCache = JSON.parse(cachedPayload) as Pick<QAIntelligenceResponse, 'intelligence' | 'cached'>;
                    setQaIntelligence(parsedCache.intelligence);
                    setQaIntelligenceCached(true);
                    return;
                } catch (cacheError) {
                    console.error('Failed to parse cached QA intelligence:', cacheError);
                    sessionStorage.removeItem(qaIntelligenceCacheKey);
                }
            }
        }

        void fetchQAIntelligence();
    }, [activeTab, fetchQAIntelligence, id, isLoadingQAIntelligence, qaIntelligence, qaIntelligenceCacheKey, testCases.length]);

    useEffect(() => {
        if (!copiedAutomation) return;

        const timeout = window.setTimeout(() => setCopiedAutomation(false), 1800);
        return () => window.clearTimeout(timeout);
    }, [copiedAutomation]);

    useEffect(() => {
        if (!qaIntelligence) return;

        setExpandedCoverageModules(
            qaIntelligence.coverage_modules.reduce<Record<string, boolean>>((accumulator, module) => {
                accumulator[module.module_name] = true;
                return accumulator;
            }, {}),
        );

        setExpandedGapModules(
            qaIntelligence.coverage_modules.reduce<Record<string, boolean>>((accumulator, module) => {
                accumulator[module.module_name] = module.uncovered_requirements.length > 0 || module.coverage_percentage < 80;
                return accumulator;
            }, {}),
        );

        setExpandedRiskAreas(
            qaIntelligence.risk_analysis.reduce<Record<string, boolean>>((accumulator, risk) => {
                accumulator[risk.area] = true;
                return accumulator;
            }, {}),
        );

        setMindMapSelection(null);
    }, [qaIntelligence]);

    const analysis = data?.analysis;
    const qualityScore = analysis?.quality_score || 0;
    const missingRequirements = analysis?.missing_requirements || [];
    const qaRisks = analysis?.qa_risk_insights || [];

    useEffect(() => {
        setAnimatedCoverageScore(0);

        const animationFrame = window.requestAnimationFrame(() => {
            setAnimatedCoverageScore(qualityScore);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [qualityScore]);

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
                const blob = new Blob([contentMarkdown], { type: 'text/markdown;charset=utf-8' });
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

                    const pdfBlob = doc.output('blob');
                    saveAs(pdfBlob, `${cleanName}.pdf`);
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

        const userMessage = chatInput;
        setIsRefining(true);
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const response = await axios.post(`http://localhost:8000/api/v1/prds/${id}/chat`, {
                message: userMessage
            });

            const { action, message: aiMessage, analysis } = response.data;

            // Show the AI's dynamic response
            setChatHistory(prev => [...prev, { role: 'ai', content: aiMessage }]);

            // If the AI updated the PRD, refresh the data
            if (action === 'update' && analysis) {
                // Refetch the full PRD detail to get updated data
                const detailResponse = await axios.get(`http://localhost:8000/api/v1/prds/${id}`);
                setData(detailResponse.data);
                setQaIntelligence(null);
                setQaIntelligenceCached(false);
            }
        } catch (err: any) {
            console.error('Error in AI chat:', err);
            setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsRefining(false);
        }
    };

    const handleGenerateTestCases = async () => {
        if (isGeneratingTestCases) return;

        setIsGeneratingTestCases(true);
        setActiveTab('testcases');
        setQaIntelligence(null);
        setQaIntelligenceCached(false);
        setQaIntelligenceError(null);
        setAutomationScript(null);
        setAutomationError(null);

        try {
            const response = await axios.post(`http://localhost:8000/api/v1/prds/${id}/generate-test-cases`);
            if (response.data && response.data.test_cases) {
                setTestCases(response.data.test_cases);
            }
        } catch (err: any) {
            console.error('Error generating test cases:', err);
            const errorMessage = err.response?.data?.detail || 'Failed to generate test cases. Please try again.';
            alert(errorMessage);
        } finally {
            setIsGeneratingTestCases(false);
        }
    };

    const handleRegenerateQAIntelligence = async () => {
        if (!qaIntelligenceCacheKey) {
            qaIntelligenceFetchAttemptedRef.current = null;
            await fetchQAIntelligence(true);
            return;
        }

        sessionStorage.removeItem(qaIntelligenceCacheKey);
        qaIntelligenceFetchAttemptedRef.current = null;
        await fetchQAIntelligence(true);
    };

    const handleGenerateAutomation = async () => {
        if (!id || !testCases.length) return;

        const selectedTestCase = testCases[selectedScenarioIndex];
        if (!selectedTestCase) return;

        setIsGeneratingAutomation(true);
        setAutomationError(null);
        setCopiedAutomation(false);

        try {
            const response = await axios.post<AutomationScriptResponse>(
                `http://localhost:8000/api/v1/prds/${id}/automation-script`,
                {
                    framework: selectedFramework,
                    scenario: selectedTestCase.scenario,
                    testing_type: selectedTestCase.testing_type,
                    feature_name: selectedTestCase.feature_name,
                    sub_feature_name: selectedTestCase.sub_feature_name,
                    test_data: selectedTestCase.test_data,
                    acceptance_criteria: selectedTestCase.acceptance_criteria,
                    test_steps: selectedTestCase.test_steps,
                },
            );

            setAutomationScript(response.data);
        } catch (err: any) {
            console.error('Error generating automation script:', err);
            setAutomationError(err.response?.data?.detail || 'Failed to generate automation script.');
        } finally {
            setIsGeneratingAutomation(false);
        }
    };

    const handleCopyAutomation = async () => {
        if (!automationScript?.code) return;

        try {
            await navigator.clipboard.writeText(automationScript.code);
            setCopiedAutomation(true);
        } catch (err) {
            console.error('Failed to copy automation code:', err);
            setAutomationError('Could not copy the automation code to the clipboard.');
        }
    };

    const handleDownloadAutomation = () => {
        if (!automationScript?.code) return;

        const blob = new Blob([automationScript.code], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, automationScript.file_name || 'generated-automation.txt');
    };

    const toggleQaSection = (section: keyof typeof expandedQaSections) => {
        setExpandedQaSections((current) => ({
            ...current,
            [section]: !current[section],
        }));
    };

    const toggleCoverageModule = (moduleName: string) => {
        setExpandedCoverageModules((current) => ({
            ...current,
            [moduleName]: !current[moduleName],
        }));
    };

    const toggleGapModule = (moduleName: string) => {
        setExpandedGapModules((current) => ({
            ...current,
            [moduleName]: !current[moduleName],
        }));
    };

    const toggleRiskArea = (area: string) => {
        setExpandedRiskAreas((current) => ({
            ...current,
            [area]: !current[area],
        }));
    };

    const handleMindMapScenarioSelect = (scenario: string) => {
        const scenarioIndex = testCases.findIndex((testCase) => testCase.scenario === scenario);
        if (scenarioIndex === -1) return;

        setSelectedScenarioIndex(scenarioIndex);
        setAutomationScript(null);
        setAutomationError(null);
        automationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleDownloadTestCases = (format: 'csv' | 'xlsx') => {
        if (!testCases || testCases.length === 0) {
            alert('No test cases to download.');
            return;
        }

        const fileName = `TestCases_${data?.filename?.split('.')[0] || 'Export'}`;

        // Prepare data for export with requested column headers
        const exportData = testCases.map(tc => ({
            'Scenario': tc.scenario,
            'Testing Type': tc.testing_type,
            'Severity': tc.severity,
            'Priority': tc.priority,
            'Feature Name': tc.feature_name,
            'Sub Feature Name': tc.sub_feature_name,
            'Test Conditions': tc.test_conditions,
            'Test Idea': tc.test_idea,
            'Test Data': tc.test_data,
            'Acceptance Criteria': tc.acceptance_criteria,
            'Test Steps': tc.test_steps
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        if (format === 'csv') {
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            saveAs(blob, `${fileName}.csv`);
        } else {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            saveAs(blob, `${fileName}.xlsx`);
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

    const typeOptions = Array.from(new Set(testCases.map((testCase) => testCase.testing_type).filter(Boolean)));
    const severityOptions = Array.from(new Set(testCases.map((testCase) => testCase.severity).filter(Boolean)));
    const priorityOptions = Array.from(new Set(testCases.map((testCase) => testCase.priority).filter(Boolean)));
    const featureOptions = Array.from(
        new Set(
            testCases
                .map((testCase) => testCase.feature_name || testCase.sub_feature_name)
                .filter(Boolean),
        ),
    );
    const filteredTestCases = testCases.filter((testCase) => {
        const matchesSearch = [testCase.scenario, testCase.test_idea, testCase.feature_name, testCase.sub_feature_name]
            .join(' ')
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase());
        const matchesType = typeFilter === 'all' || testCase.testing_type === typeFilter;
        const matchesSeverity = severityFilter === 'all' || testCase.severity === severityFilter;
        const matchesPriority = priorityFilter === 'all' || testCase.priority === priorityFilter;
        const featureValue = testCase.feature_name || testCase.sub_feature_name;
        const matchesFeature = featureFilter === 'all' || featureValue === featureFilter;

        return matchesSearch && matchesType && matchesSeverity && matchesPriority && matchesFeature;
    });
    const criticalCount = testCases.filter((testCase) => normalizeLabel(testCase.severity) === 'critical').length;
    const highPriorityCount = testCases.filter((testCase) => normalizeLabel(testCase.priority) === 'high').length;
    const mediumOrLowCount = testCases.filter((testCase) => {
        const priority = normalizeLabel(testCase.priority);
        return priority === 'medium' || priority === 'low';
    }).length;
    const riskLevel = getRiskLevelPresentation(
        qualityScore,
        missingRequirements.length,
        criticalCount,
        highPriorityCount,
    );
    const missingRequirementSuggestions = buildAISuggestions(missingRequirements, 'missing');
    const riskSuggestions = buildAISuggestions(qaRisks, 'risk');
    const selectedTestCase = testCases[selectedScenarioIndex] || null;
    const automationCodeLines = automationScript?.code.split('\n') || [];
    const highRiskAreaCount = qaIntelligence?.risk_analysis.filter((item) => normalizeLabel(item.level) === 'high').length || 0;
    const uncoveredRequirementCount = qaIntelligence?.coverage_modules.reduce(
        (total, module) => total + module.uncovered_requirements.length,
        0,
    ) || 0;
    const gapModules = qaIntelligence?.coverage_modules.filter((module) => (
        module.uncovered_requirements.length > 0 ||
        module.recommended_test_scenarios.length > 0 ||
        module.coverage_percentage < 85
    )) || [];
    const viewerGridClass = showChat
        ? "grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.75fr)_minmax(320px,0.85fr)] gap-6 items-start"
        : "grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(340px,0.9fr)] gap-6 items-start";

    return (
        <div className="w-full pb-12">
            <div className="mb-6">
                <Link to="/dashboard" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back to Dashboard
                </Link>
            </div>

            <div className={viewerGridClass}>
                {/* Main Document Panel */}
                <div className="min-w-0">
                    <div className="premium-surface rounded-xl shadow-sm overflow-hidden">
                        <div className="premium-divider border-b bg-slate-50/85 px-6 py-5 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    Standardized PRD
                                </h2>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold break-all">
                                    Source: {data?.filename || 'Unknown source'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
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
                                <button
                                    onClick={() => setShowChat(!showChat)}
                                    className={`inline-flex items-center px-4 py-1.5 shadow-sm text-xs font-bold rounded-lg transition-all duration-200 ${showChat
                                        ? 'bg-blue-600 text-white ring-2 ring-blue-100'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                                        }`}
                                >
                                    <MessageSquare className={`w-3.5 h-3.5 mr-1.5 ${showChat ? 'animate-pulse' : ''}`} />
                                    {showChat ? "Hide AI Panel" : "Refine with AI"}
                                </button>
                                <button
                                    onClick={handleGenerateTestCases}
                                    disabled={isGeneratingTestCases}
                                    className={`inline-flex items-center px-4 py-1.5 shadow-sm text-xs font-bold rounded-lg transition-all duration-200 ${activeTab === 'testcases'
                                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-100'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-emerald-600'
                                        }`}
                                >
                                    {isGeneratingTestCases ? (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                        <Bug className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    {testCases.length > 0 ? "Regenerate Test Cases" : "Generate Test Cases"}
                                </button>
                            </div>
                        </div>

                        {/* Tab Switcher */}
                        {testCases.length > 0 && (
                            <div className="px-6 border-b border-slate-200 bg-white flex gap-6">
                                <button
                                    onClick={() => setActiveTab('prd')}
                                    className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'prd' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Document
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('testcases')}
                                    className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'testcases' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Bug className="w-4 h-4" />
                                        Test Cases
                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded-full">{testCases.length}</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('qa')}
                                    className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'qa' ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" />
                                        QA Intelligence
                                    </div>
                                </button>
                            </div>
                        )}

                        <div ref={prdContentRef} className="p-8 xl:p-10 2xl:px-12">
                            {activeTab === 'prd' ? (
                                <div className="prose prose-slate max-w-none 
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
                            ) : activeTab === 'testcases' ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
                                                <Layers className="h-5 w-5" />
                                                Generated Test Cases
                                            </h3>
                                            <p className="mt-1 text-sm text-emerald-800">
                                                AI-generated scenarios based on the document structure, requirements, and identified risks.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => handleDownloadTestCases('csv')}
                                                className="inline-flex items-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                                            >
                                                <FileDown className="w-4 h-4 mr-2" />
                                                CSV
                                            </button>
                                            <button
                                                onClick={() => handleDownloadTestCases('xlsx')}
                                                className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                                            >
                                                <FileDown className="w-4 h-4 mr-2" />
                                                Excel
                                            </button>
                                        </div>
                                    </div>

                                    {isGeneratingTestCases ? (
                                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                            <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                                            <p className="text-slate-500 font-medium animate-pulse">AI is crafting comprehensive test scenarios...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total Test Cases</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{testCases.length}</p>
                                                    <p className="mt-2 text-sm text-slate-500">
                                                        {filteredTestCases.length} visible with current filters
                                                    </p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-red-200 bg-red-50/70 p-4 shadow-sm">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Critical Issues</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{criticalCount}</p>
                                                    <p className="mt-2 text-sm text-red-900/70">Scenarios with the highest product risk.</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-orange-200 bg-orange-50/70 p-4 shadow-sm">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">High Priority</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{highPriorityCount}</p>
                                                    <p className="mt-2 text-sm text-orange-900/70">Requires attention early in QA planning.</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Medium & Low</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{mediumOrLowCount}</p>
                                                    <p className="mt-2 text-sm text-slate-500">Completes broader coverage across the flow.</p>
                                                </div>
                                            </div>

                                            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                                                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
                                                    <ListFilter className="h-4 w-4 text-blue-600" />
                                                    Filter and Search Test Cases
                                                </div>

                                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))]">
                                                    <label className="relative block">
                                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            value={searchTerm}
                                                            onChange={(event) => setSearchTerm(event.target.value)}
                                                            placeholder="Search scenarios, ideas, or features"
                                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                        />
                                                    </label>

                                                    <select
                                                        value={typeFilter}
                                                        onChange={(event) => setTypeFilter(event.target.value)}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                    >
                                                        <option value="all">All Types</option>
                                                        {typeOptions.map((option) => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={severityFilter}
                                                        onChange={(event) => setSeverityFilter(event.target.value)}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                    >
                                                        <option value="all">All Severities</option>
                                                        {severityOptions.map((option) => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={priorityFilter}
                                                        onChange={(event) => setPriorityFilter(event.target.value)}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                    >
                                                        <option value="all">All Priorities</option>
                                                        {priorityOptions.map((option) => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={featureFilter}
                                                        onChange={(event) => setFeatureFilter(event.target.value)}
                                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                    >
                                                        <option value="all">All Features</option>
                                                        {featureOptions.map((option) => (
                                                            <option key={option} value={option}>{option}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="premium-surface overflow-hidden rounded-[1.5rem] shadow-sm">
                                                <div className="max-h-[780px] overflow-auto">
                                                    <table className="w-full min-w-[1320px] border-collapse text-left">
                                                        <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Scenario</th>
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Type</th>
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Severity</th>
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Priority</th>
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Feature</th>
                                                                <th className="px-5 py-4 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Expectation / Criteria</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredTestCases.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={6} className="px-6 py-16 text-center">
                                                                        <div className="mx-auto flex max-w-md flex-col items-center">
                                                                            <Search className="h-8 w-8 text-slate-300" />
                                                                            <p className="mt-4 text-lg font-bold text-slate-900">No matching test cases</p>
                                                                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                                                                Try changing the filters or search term to reveal more generated scenarios.
                                                                            </p>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                filteredTestCases.map((tc, idx) => {
                                                                    const typePresentation = getTypePresentation(tc.testing_type);
                                                                    return (
                                                                        <tr
                                                                            key={`${tc.scenario}-${idx}`}
                                                                            className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/65'} border-b border-slate-100 transition-colors hover:bg-blue-50/55`}
                                                                        >
                                                                            <td className="px-5 py-5 align-top">
                                                                                <div className="min-w-[260px]">
                                                                                    <div className="text-sm font-bold text-slate-900">{tc.scenario}</div>
                                                                                    <div className="mt-2 text-xs leading-6 text-slate-500">{tc.test_idea}</div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-5 py-5 align-top">
                                                                                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase ${typePresentation.className}`}>
                                                                                    {typePresentation.icon}
                                                                                    {typePresentation.label}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-5 py-5 align-top">
                                                                                <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase ${getSeverityPresentation(tc.severity)}`}>
                                                                                    {tc.severity || 'Unknown'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-5 py-5 align-top">
                                                                                <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase ${getPriorityPresentation(tc.priority)}`}>
                                                                                    {tc.priority || 'Unknown'}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-5 py-5 align-top">
                                                                                <div className="text-sm font-semibold text-slate-800">{tc.feature_name}</div>
                                                                                {tc.sub_feature_name && (
                                                                                    <div className="mt-1 text-xs text-slate-500">{tc.sub_feature_name}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-5 py-5 align-top">
                                                                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/55 px-4 py-3 text-xs leading-6 text-slate-700">
                                                                                    {tc.acceptance_criteria}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-violet-100 bg-violet-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-lg font-bold text-violet-950">
                                                <Sparkles className="h-5 w-5" />
                                                QA Intelligence Dashboard
                                            </h3>
                                            <p className="mt-1 text-sm text-violet-900/75">
                                                AI-powered coverage analysis, bug-risk detection, automation readiness, and test mapping.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {qaIntelligenceCached && (
                                                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Loaded from cached analysis
                                                </div>
                                            )}
                                            {qaIntelligence && (
                                                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700">
                                                    Coverage {qaIntelligence.overall_coverage_percentage}%
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => void handleRegenerateQAIntelligence()}
                                                disabled={isRefreshingQAIntelligence || isLoadingQAIntelligence || !testCases.length}
                                                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${isRefreshingQAIntelligence ? 'animate-spin' : ''}`} />
                                                {isRefreshingQAIntelligence ? 'Regenerating...' : 'Regenerate Analysis'}
                                            </button>
                                        </div>
                                    </div>

                                    {isLoadingQAIntelligence ? (
                                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                            <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
                                            <p className="text-slate-500 font-medium animate-pulse">
                                                AI is building requirement coverage and risk intelligence...
                                            </p>
                                        </div>
                                    ) : qaIntelligenceError ? (
                                        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6">
                                            <div className="flex items-center gap-3 text-red-800">
                                                <AlertTriangle className="h-5 w-5" />
                                                <p className="font-semibold">{qaIntelligenceError}</p>
                                            </div>
                                        </div>
                                    ) : qaIntelligence ? (
                                        <>
                                            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                                                <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-sm">
                                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                                        <Target className="h-4 w-4 text-blue-600" />
                                                        Coverage Health
                                                    </div>
                                                    <div className="mt-3 flex items-end justify-between gap-3">
                                                        <p className="text-3xl font-black text-slate-950">{qaIntelligence.overall_coverage_percentage}%</p>
                                                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                                                            qaIntelligence.overall_coverage_percentage >= 85
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : qaIntelligence.overall_coverage_percentage >= 60
                                                                    ? 'bg-amber-50 text-amber-700'
                                                                    : 'bg-red-50 text-red-700'
                                                        }`}>
                                                            {qaIntelligence.overall_coverage_percentage >= 85
                                                                ? 'Healthy'
                                                                : qaIntelligence.overall_coverage_percentage >= 60
                                                                    ? 'Partial'
                                                                    : 'At Risk'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-4 h-2.5 rounded-full bg-slate-100">
                                                        <div
                                                            className={`h-2.5 rounded-full ${
                                                                qaIntelligence.overall_coverage_percentage >= 85
                                                                    ? 'bg-emerald-500'
                                                                    : qaIntelligence.overall_coverage_percentage >= 60
                                                                        ? 'bg-amber-400'
                                                                        : 'bg-red-500'
                                                            }`}
                                                            style={{ width: `${qaIntelligence.overall_coverage_percentage}%` }}
                                                        />
                                                    </div>
                                                    <p className="mt-3 text-sm text-slate-500">Across mapped modules and requirements.</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-violet-200 bg-violet-50/70 p-5 shadow-sm">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Modules Mapped</p>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{qaIntelligence.coverage_modules.length}</p>
                                                    <p className="mt-2 text-sm text-violet-900/70">Feature and module groups identified by AI.</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
                                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        Coverage Gaps
                                                    </div>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{uncoveredRequirementCount}</p>
                                                    <p className="mt-2 text-sm text-amber-900/70">Requirements still weakly tested or uncovered.</p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-red-200 bg-red-50/70 p-5 shadow-sm">
                                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                                                        <ShieldAlert className="h-4 w-4" />
                                                        High Risk Areas
                                                    </div>
                                                    <p className="mt-3 text-3xl font-black text-slate-950">{highRiskAreaCount}</p>
                                                    <p className="mt-2 text-sm text-red-900/70">Requirement areas likely to create bugs in production.</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <CollapsibleSection
                                                    title="Requirement Coverage Intelligence"
                                                    description="Collapse modules to focus on one area at a time, with progress bars and coverage health signals for each requirement group."
                                                    icon={<Target className="h-5 w-5 text-violet-600" />}
                                                    isOpen={expandedQaSections.coverage}
                                                    onToggle={() => toggleQaSection('coverage')}
                                                    badge={(
                                                        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                                                            {qaIntelligence.coverage_modules.length} modules
                                                        </span>
                                                    )}
                                                >
                                                    <div className="space-y-4">
                                                        {qaIntelligence.coverage_modules.map((module) => {
                                                            const coverageTone = getCoverageTone(module.coverage_percentage);
                                                            const relatedRisk = findRiskForModule(module.module_name, qaIntelligence.risk_analysis);
                                                            const isOpen = expandedCoverageModules[module.module_name] ?? true;

                                                            return (
                                                                <div key={module.module_name} className={`overflow-hidden rounded-[1.25rem] border ${coverageTone.panel}`}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleCoverageModule(module.module_name)}
                                                                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/40"
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-3">
                                                                                <span className={`h-2.5 w-2.5 rounded-full ${coverageTone.indicator}`} />
                                                                                <p className="text-base font-bold text-slate-900">{module.module_name}</p>
                                                                                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${coverageTone.badge}`}>
                                                                                    {module.coverage_percentage}% coverage
                                                                                </span>
                                                                                {relatedRisk && (
                                                                                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${getRiskTone(relatedRisk.level).badge}`}>
                                                                                        {relatedRisk.level} risk
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="mt-3 h-2.5 rounded-full bg-white/70">
                                                                                <div
                                                                                    className={`h-2.5 rounded-full ${coverageTone.progress}`}
                                                                                    style={{ width: `${module.coverage_percentage}%` }}
                                                                                />
                                                                            </div>
                                                                            <p className="mt-3 text-sm text-slate-600">
                                                                                {module.covered_requirements} of {module.total_requirements} requirements mapped to generated scenarios.
                                                                            </p>
                                                                        </div>

                                                                        <span className="rounded-full border border-white/70 bg-white/80 p-2 text-slate-500">
                                                                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                        </span>
                                                                    </button>

                                                                    {isOpen && (
                                                                        <div className="grid gap-4 border-t border-white/70 bg-white/60 px-4 py-4 xl:grid-cols-3">
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mapped Test Scenarios</p>
                                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                                    {module.mapped_test_scenarios.length > 0 ? module.mapped_test_scenarios.slice(0, 6).map((scenario) => (
                                                                                        <button
                                                                                            key={scenario}
                                                                                            type="button"
                                                                                            onClick={() => handleMindMapScenarioSelect(scenario)}
                                                                                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                                                                                        >
                                                                                            {scenario}
                                                                                        </button>
                                                                                    )) : (
                                                                                        <p className="text-sm text-slate-500">No mapped scenarios yet.</p>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Uncovered Requirements</p>
                                                                                <ul className="mt-3 space-y-2">
                                                                                    {module.uncovered_requirements.length > 0 ? module.uncovered_requirements.map((requirement) => (
                                                                                        <li key={requirement} className="text-sm text-slate-700">{requirement}</li>
                                                                                    )) : (
                                                                                        <li className="text-sm text-emerald-700">No major uncovered requirements detected.</li>
                                                                                    )}
                                                                                </ul>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Recommended Test Scenarios</p>
                                                                                <ul className="mt-3 space-y-2">
                                                                                    {module.recommended_test_scenarios.length > 0 ? module.recommended_test_scenarios.map((scenario) => (
                                                                                        <li key={scenario} className="text-sm text-slate-700">{scenario}</li>
                                                                                    )) : (
                                                                                        <li className="text-sm text-slate-500">No extra recommendations for this module.</li>
                                                                                    )}
                                                                                </ul>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </CollapsibleSection>

                                                <CollapsibleSection
                                                    title="Gap Analysis"
                                                    description="Requirement gaps, uncovered alerts, and AI suggestions grouped by module so teams can close the most important holes first."
                                                    icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
                                                    isOpen={expandedQaSections.gaps}
                                                    onToggle={() => toggleQaSection('gaps')}
                                                    badge={(
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                                                            {gapModules.length} modules need attention
                                                        </span>
                                                    )}
                                                >
                                                    <div className="space-y-4">
                                                        {qaIntelligence.uncovered_requirement_alerts.length > 0 && (
                                                            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
                                                                <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">Priority Alerts</p>
                                                                <ul className="mt-3 space-y-2">
                                                                    {qaIntelligence.uncovered_requirement_alerts.map((alert) => (
                                                                        <li key={alert} className="text-sm text-slate-700">{alert}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                                                            <div className="space-y-4">
                                                                {gapModules.map((module) => {
                                                                    const isOpen = expandedGapModules[module.module_name] ?? true;
                                                                    const tone = getCoverageTone(module.coverage_percentage);

                                                                    return (
                                                                        <div key={`gap-${module.module_name}`} className={`overflow-hidden rounded-[1.25rem] border ${tone.panel}`}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleGapModule(module.module_name)}
                                                                                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/40"
                                                                            >
                                                                                <div>
                                                                                    <div className="flex items-center gap-3">
                                                                                        <span className={`h-2.5 w-2.5 rounded-full ${tone.indicator}`} />
                                                                                        <p className="text-base font-bold text-slate-900">{module.module_name}</p>
                                                                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone.badge}`}>
                                                                                            {module.coverage_percentage}% coverage
                                                                                        </span>
                                                                                    </div>
                                                                                    <p className="mt-2 text-sm text-slate-600">
                                                                                        {module.uncovered_requirements.length} uncovered requirements and {module.recommended_test_scenarios.length} recommended additions.
                                                                                    </p>
                                                                                </div>

                                                                                <span className="rounded-full border border-white/70 bg-white/80 p-2 text-slate-500">
                                                                                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                                </span>
                                                                            </button>

                                                                            {isOpen && (
                                                                                <div className="grid gap-4 border-t border-white/70 bg-white/60 px-4 py-4 md:grid-cols-2">
                                                                                    <div>
                                                                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Missing Requirements</p>
                                                                                        <ul className="mt-3 space-y-2">
                                                                                            {module.uncovered_requirements.length ? module.uncovered_requirements.map((requirement) => (
                                                                                                <li key={requirement} className="text-sm text-slate-700">{requirement}</li>
                                                                                            )) : (
                                                                                                <li className="text-sm text-slate-500">No explicit requirement gaps in this module.</li>
                                                                                            )}
                                                                                        </ul>
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Recommended Scenarios</p>
                                                                                        <ul className="mt-3 space-y-2">
                                                                                            {module.recommended_test_scenarios.length ? module.recommended_test_scenarios.map((scenario) => (
                                                                                                <li key={scenario} className="text-sm text-slate-700">{scenario}</li>
                                                                                            )) : (
                                                                                                <li className="text-sm text-slate-500">No extra scenarios recommended for this branch.</li>
                                                                                            )}
                                                                                        </ul>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50/70 p-4">
                                                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">AI Suggestions</p>
                                                                <ul className="mt-3 space-y-3">
                                                                    {missingRequirementSuggestions.map((suggestion) => (
                                                                        <li key={suggestion} className="text-sm leading-6 text-slate-700">{suggestion}</li>
                                                                    ))}
                                                                </ul>
                                                                {missingRequirements.length > 0 && (
                                                                    <>
                                                                        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document-level gaps</p>
                                                                        <ul className="mt-3 space-y-2">
                                                                            {missingRequirements.slice(0, 5).map((requirement) => (
                                                                                <li key={requirement} className="text-sm text-slate-700">{requirement}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CollapsibleSection>

                                                <CollapsibleSection
                                                    title="QA Technical Risks"
                                                    description="Risk cards grouped by module or system area, with severity highlighting and suggested testing approaches."
                                                    icon={<ShieldAlert className="h-5 w-5 text-rose-500" />}
                                                    isOpen={expandedQaSections.technicalRisks}
                                                    onToggle={() => toggleQaSection('technicalRisks')}
                                                    badge={(
                                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
                                                            {qaIntelligence.risk_analysis.length} risk groups
                                                        </span>
                                                    )}
                                                >
                                                    <div className="space-y-4">
                                                        {qaIntelligence.risk_analysis.map((risk) => {
                                                            const riskTone = getRiskTone(risk.level);
                                                            const isOpen = expandedRiskAreas[risk.area] ?? true;

                                                            return (
                                                                <div key={`${risk.area}-${risk.level}`} className={`overflow-hidden rounded-[1.25rem] border ${riskTone.panel}`}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleRiskArea(risk.area)}
                                                                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/40"
                                                                    >
                                                                        <div>
                                                                            <div className="flex flex-wrap items-center gap-3">
                                                                                <span className={`h-2.5 w-2.5 rounded-full ${riskTone.indicator}`} />
                                                                                <p className="text-base font-bold text-slate-900">{risk.area}</p>
                                                                                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${riskTone.badge}`}>
                                                                                    {risk.level}
                                                                                </span>
                                                                            </div>
                                                                            <p className="mt-2 text-sm text-slate-600">
                                                                                {risk.issues.length} flagged issue{risk.issues.length === 1 ? '' : 's'} with a recommended testing path.
                                                                            </p>
                                                                        </div>

                                                                        <span className="rounded-full border border-white/70 bg-white/80 p-2 text-slate-500">
                                                                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                                        </span>
                                                                    </button>

                                                                    {isOpen && (
                                                                        <div className="grid gap-4 border-t border-white/70 bg-white/60 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                                                                            <ul className="space-y-2">
                                                                                {risk.issues.map((issue) => (
                                                                                    <li key={issue} className="text-sm text-slate-700">{issue}</li>
                                                                                ))}
                                                                            </ul>
                                                                            <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-3">
                                                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Suggested Testing Approach</p>
                                                                                <p className="mt-2 text-sm leading-6 text-slate-700">{risk.suggested_testing_approach}</p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </CollapsibleSection>

                                                <CollapsibleSection
                                                    title="Risk Insights"
                                                    description="Document-level QA intelligence extracted from the PRD, distilled into concise implementation and testing guidance."
                                                    icon={<CircleAlert className="h-5 w-5 text-blue-600" />}
                                                    isOpen={expandedQaSections.riskInsights}
                                                    onToggle={() => toggleQaSection('riskInsights')}
                                                    badge={(
                                                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                                            {qaRisks.length} insights
                                                        </span>
                                                    )}
                                                >
                                                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                                                        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Detected Risk Insights</p>
                                                            <ul className="mt-3 space-y-2">
                                                                {qaRisks.length > 0 ? qaRisks.map((risk) => (
                                                                    <li key={risk} className="text-sm text-slate-700">{risk}</li>
                                                                )) : (
                                                                    <li className="text-sm text-slate-500">No additional risk insights detected beyond the structured QA analysis.</li>
                                                                )}
                                                            </ul>
                                                        </div>

                                                        <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50/70 p-4">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Suggested Improvements</p>
                                                            <ul className="mt-3 space-y-3">
                                                                {riskSuggestions.map((suggestion) => (
                                                                    <li key={suggestion} className="text-sm leading-6 text-slate-700">{suggestion}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </CollapsibleSection>
                                            </div>

                                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                                                <div ref={automationPanelRef} className="premium-surface rounded-[1.5rem] p-5 shadow-sm">
                                                    <div className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-950">
                                                        <Bug className="h-5 w-5 text-blue-600" />
                                                        Automation Test Generation
                                                    </div>

                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <select
                                                            value={selectedFramework}
                                                            onChange={(event) => setSelectedFramework(event.target.value)}
                                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                        >
                                                            {AUTOMATION_FRAMEWORKS.map((framework) => (
                                                                <option key={framework} value={framework}>{framework}</option>
                                                            ))}
                                                        </select>

                                                        <select
                                                            value={selectedScenarioIndex}
                                                            onChange={(event) => {
                                                                setSelectedScenarioIndex(Number(event.target.value));
                                                                setAutomationScript(null);
                                                                setAutomationError(null);
                                                            }}
                                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                                                        >
                                                            {testCases.map((testCase, index) => (
                                                                <option key={`${testCase.scenario}-${index}`} value={index}>
                                                                    {testCase.scenario}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {selectedTestCase && (
                                                        <div className="mt-4 rounded-[1.15rem] border border-slate-200 bg-slate-50/70 p-4">
                                                            <p className="text-sm font-bold text-slate-900">{selectedTestCase.scenario}</p>
                                                            <p className="mt-2 text-sm text-slate-600">
                                                                {selectedTestCase.feature_name} {selectedTestCase.sub_feature_name ? `• ${selectedTestCase.sub_feature_name}` : ''}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="mt-4 flex flex-wrap gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={handleGenerateAutomation}
                                                            disabled={!selectedTestCase || isGeneratingAutomation}
                                                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {isGeneratingAutomation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                                            Generate Automation Script
                                                        </button>
                                                    </div>

                                                    {automationError && (
                                                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                            {automationError}
                                                        </div>
                                                    )}

                                                    {automationScript && (
                                                        <div className="premium-focus-surface mt-5 overflow-hidden rounded-[1.35rem] shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
                                                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/90 px-4 py-3">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <div className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300">
                                                                        <FileText className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-sm font-semibold text-slate-100">
                                                                            {automationScript.file_name}
                                                                        </p>
                                                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
                                                                            <span className={`rounded-full border px-2.5 py-1 ${getAutomationFrameworkPresentation(automationScript.framework)}`}>
                                                                                {automationScript.framework} • {automationScript.language}
                                                                            </span>
                                                                            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-400">
                                                                                VS Code Dark
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleCopyAutomation}
                                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                                                                    >
                                                                        {copiedAutomation ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                                                        {copiedAutomation ? 'Copied' : 'Copy'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleDownloadAutomation}
                                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
                                                                    >
                                                                        <Download className="h-4 w-4" />
                                                                        Download
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="overflow-auto">
                                                                <div className="min-w-[760px]">
                                                                    {automationCodeLines.map((line, index) => (
                                                                        <div
                                                                            key={`${automationScript.file_name}-${index}`}
                                                                            className="grid grid-cols-[64px_minmax(0,1fr)] border-b border-slate-900/80 last:border-b-0 hover:bg-white/5"
                                                                        >
                                                                            <div className="select-none border-r border-slate-800 bg-slate-950/70 px-4 py-1.5 text-right text-xs leading-7 text-slate-500">
                                                                                {index + 1}
                                                                            </div>
                                                                            <code className="block whitespace-pre px-4 py-1.5 font-mono text-[13px] leading-7 text-slate-100">
                                                                                {line ? renderHighlightedCode(line) : <span>&nbsp;</span>}
                                                                            </code>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-6">
                                                    <QACoverageMindMap
                                                        modules={qaIntelligence.mind_map}
                                                        coverageModules={qaIntelligence.coverage_modules}
                                                        onSelectionChange={setMindMapSelection}
                                                    />

                                                    <div className="premium-surface rounded-[1.5rem] p-5 shadow-sm">
                                                        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
                                                            <CircleAlert className="h-5 w-5 text-violet-600" />
                                                            Related Test Scenarios
                                                        </div>

                                                        {mindMapSelection ? (
                                                            <div className="space-y-4">
                                                                <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50/70 p-4">
                                                                    <div className="flex flex-wrap items-center gap-3">
                                                                        <p className="text-base font-bold text-slate-900">{mindMapSelection.label}</p>
                                                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${mindMapSelection.status === 'full'
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                            : mindMapSelection.status === 'partial'
                                                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                                                : 'border-red-200 bg-red-50 text-red-700'
                                                                        }`}>
                                                                            {mindMapSelection.status === 'full' ? 'Fully covered' : mindMapSelection.status === 'partial' ? 'Partial coverage' : 'Coverage gap'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="mt-2 text-sm text-slate-600">{mindMapSelection.description}</p>
                                                                </div>

                                                                {mindMapSelection.scenarios.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {mindMapSelection.scenarios.map((scenario) => (
                                                                            <button
                                                                                key={`${mindMapSelection.label}-${scenario}`}
                                                                                type="button"
                                                                                onClick={() => handleMindMapScenarioSelect(scenario)}
                                                                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                                                                            >
                                                                                {scenario}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                                                        No linked scenarios yet. This branch needs additional test coverage.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-[1.15rem] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-500">
                                                                Click a node in the coverage map to inspect the linked scenarios and jump directly to automation generation.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-6 text-center text-slate-500">
                                            Generate test cases first to unlock AI-powered QA intelligence.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Refinement Sidebar */}
                {showChat && (
                    <div className="min-w-0 flex flex-col h-[680px] xl:h-[calc(100vh-140px)] xl:sticky xl:top-24 bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden animate-in slide-in-from-right duration-300">
                        <div className="px-6 py-4 border-b border-slate-100 bg-blue-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="font-bold text-slate-900">Refine with AI</h3>
                            </div>
                            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-grow p-5 overflow-y-auto space-y-4 bg-slate-50/30 custom-scrollbar">
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
                                    <div className={`max-w-[90%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'user'
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
                <div className={`${showChat ? 'hidden xl:flex' : 'flex'} min-w-0 flex-col gap-6 xl:sticky xl:top-24 transition-opacity duration-300`}>
                    <div className="premium-surface rounded-[1.5rem] p-6 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-700">AI Intelligence</p>
                                <h3 className="mt-2 text-xl font-black text-slate-950">Coverage Overview</h3>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                                <Sparkles className="h-5 w-5" />
                            </div>
                        </div>

                        <div className="mt-6 grid gap-4">
                            <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                        <Target className="h-4 w-4 text-blue-600" />
                                        Requirement Coverage Score
                                        <div className="group relative">
                                            <Info className="h-4 w-4 cursor-help text-slate-400 transition group-hover:text-slate-600" />
                                            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium leading-5 text-slate-600 shadow-xl group-hover:block">
                                                Calculated using mapped requirements, missing requirements, QA risk indicators, and overall test coverage completeness.
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-2xl font-black text-slate-950">{qualityScore}/100</span>
                                </div>
                                <div className="mt-4 h-2 rounded-full bg-slate-200/90 md:h-2.5">
                                    <div
                                        className={`h-2 rounded-full transition-[width] duration-1000 ease-out md:h-2.5 ${getCoverageScoreBarClass(qualityScore)}`}
                                        style={{ width: `${animatedCoverageScore}%` }}
                                    />
                                </div>
                            </div>

                            <div className={`rounded-[1.25rem] border p-4 ${riskLevel.panelClassName}`}>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <CircleAlert className="h-4 w-4 text-blue-600" />
                                    Risk Level
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${riskLevel.className}`}>
                                        {riskLevel.icon}
                                        {riskLevel.label}
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">{riskLevel.helperText}</p>
                            </div>
                        </div>
                    </div>

                    <div className="premium-surface rounded-[1.5rem] p-6 shadow-sm">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <h3 className="text-lg font-bold text-slate-950">Missing Requirements</h3>
                        </div>

                        <div className="mt-5 space-y-4">
                            {missingRequirements.length > 0 ? (
                                <>
                                    <div className="space-y-3">
                                        {missingRequirements.map((req, index) => (
                                            <div key={index} className="rounded-[1.15rem] border border-amber-100 bg-amber-50/70 p-4">
                                                <div className="flex gap-3">
                                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">
                                                        {index + 1}
                                                    </span>
                                                    <p className="text-sm leading-6 text-slate-700">{req}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-[1.15rem] border border-blue-100 bg-blue-50/70 p-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                                            <Sparkles className="h-4 w-4" />
                                            AI Suggestions
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {missingRequirementSuggestions.map((suggestion) => (
                                                <li key={suggestion} className="text-sm leading-6 text-slate-700">
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-[1.15rem] border border-emerald-100 bg-emerald-50/70 p-4 text-center">
                                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                                    <p className="mt-3 text-sm font-medium text-emerald-800">
                                        No major missing requirements detected.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="premium-surface rounded-[1.5rem] p-6 shadow-sm">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-rose-500" />
                            <h3 className="text-lg font-bold text-slate-950">QA Technical Risks</h3>
                        </div>

                        <div className="mt-5 space-y-4">
                            {qaRisks.length > 0 ? (
                                <>
                                    <div className="space-y-3">
                                        {qaRisks.map((risk, index) => (
                                            <div key={index} className="rounded-[1.15rem] border border-rose-100 bg-rose-50/70 p-4">
                                                <div className="flex gap-3">
                                                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                                    <p className="text-sm leading-6 text-slate-700">{risk}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-[1.15rem] border border-blue-100 bg-blue-50/70 p-4">
                                        <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
                                            <Sparkles className="h-4 w-4" />
                                            AI Suggestions
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {riskSuggestions.map((suggestion) => (
                                                <li key={suggestion} className="text-sm leading-6 text-slate-700">
                                                    {suggestion}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-[1.15rem] border border-emerald-100 bg-emerald-50/70 p-4 text-center">
                                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                                    <p className="mt-3 text-sm font-medium text-emerald-800">
                                        No significant QA or technical risks detected.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
