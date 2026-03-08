import { useEffect, useMemo, useRef, useState } from 'react';
import { toBlob, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import {
    Background,
    Controls,
    Handle,
    MiniMap,
    Position,
    ReactFlow,
    type Edge,
    type Node,
    type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    BrainCircuit,
    Download,
    Maximize2,
    Move,
    X,
    ZoomIn,
} from 'lucide-react';

type CoverageStatus = 'full' | 'partial' | 'gap';

export interface QAMindMapRequirement {
    requirement: string;
    scenarios: string[];
    covered: boolean;
}

export interface QAMindMapModule {
    module_name: string;
    requirements: QAMindMapRequirement[];
}

export interface QACoverageModuleSummary {
    module_name: string;
    coverage_percentage: number;
}

export interface MindMapSelection {
    label: string;
    nodeType: 'module' | 'requirement' | 'scenario';
    moduleName: string;
    status: CoverageStatus;
    description: string;
    scenarios: string[];
}

interface QACoverageMindMapProps {
    modules: QAMindMapModule[];
    coverageModules: QACoverageModuleSummary[];
    onSelectionChange?: (selection: MindMapSelection | null) => void;
}

interface MindMapNodeData {
    label: string;
    nodeType: 'module' | 'requirement' | 'scenario';
    moduleName: string;
    status: CoverageStatus;
    description: string;
    scenarios: string[];
    collapsed?: boolean;
    collapsible?: boolean;
    onToggle?: () => void;
    onSelect?: (selection: MindMapSelection) => void;
}

const MODULE_NODE_SIZE = { width: 300, height: 138 };
const REQUIREMENT_NODE_SIZE = { width: 310, height: 134 };
const SCENARIO_NODE_SIZE = { width: 280, height: 112 };
const CANVAS_PADDING = 48;
const MIN_CANVAS_WIDTH = 760;
const MIN_CANVAS_HEIGHT = 420;
const COLUMN_GAP = 220;
const NODE_GAP = 56;
const MODULE_GAP = 88;

const statusPresentation: Record<CoverageStatus, { border: string; bg: string; text: string; dot: string }> = {
    full: {
        border: 'border-emerald-300/70',
        bg: 'bg-emerald-500/12',
        text: 'text-emerald-100',
        dot: 'bg-emerald-400',
    },
    partial: {
        border: 'border-amber-300/70',
        bg: 'bg-amber-500/12',
        text: 'text-amber-100',
        dot: 'bg-amber-300',
    },
    gap: {
        border: 'border-rose-300/70',
        bg: 'bg-rose-500/12',
        text: 'text-rose-100',
        dot: 'bg-rose-400',
    },
};

function getCoverageStatus(coveragePercentage: number): CoverageStatus {
    if (coveragePercentage >= 85) return 'full';
    if (coveragePercentage >= 60) return 'partial';
    return 'gap';
}

function getRequirementStatus(requirement: QAMindMapRequirement): CoverageStatus {
    if (!requirement.covered) return 'gap';
    if (requirement.scenarios.length >= 2) return 'full';
    return 'partial';
}

function MindMapNode({ data, selected }: NodeProps<MindMapNodeData>) {
    const presentation = statusPresentation[data.status];

    return (
        <div
            title={data.description}
            onClick={() => data.onSelect?.({
                label: data.label,
                nodeType: data.nodeType,
                moduleName: data.moduleName,
                status: data.status,
                description: data.description,
                scenarios: data.scenarios,
            })}
            className={`w-[270px] max-w-[270px] cursor-pointer rounded-[1.1rem] border px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)] transition-colors duration-150 ${presentation.border} ${presentation.bg} ${selected ? 'ring-2 ring-blue-300/60' : ''} hover:border-blue-300/70 hover:bg-white/10`}
        >
            {data.nodeType !== 'module' && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!h-2.5 !w-2.5 !border-2 !border-slate-950 !bg-slate-200"
                />
            )}

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${presentation.dot}`} />
                        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${presentation.text}`}>
                            {data.nodeType}
                        </p>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold leading-6 text-white">{data.label}</p>
                </div>

                {data.collapsible && (
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onToggle?.();
                        }}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/10"
                    >
                        {data.collapsed ? 'Expand' : 'Collapse'}
                    </button>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                    {data.scenarios.length} linked scenario{data.scenarios.length === 1 ? '' : 's'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                    {data.moduleName}
                </span>
            </div>

            {data.nodeType !== 'scenario' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!h-2.5 !w-2.5 !border-2 !border-slate-950 !bg-slate-200"
                />
            )}
        </div>
    );
}

function getNodeSize(nodeType: MindMapNodeData['nodeType']) {
    if (nodeType === 'module') return MODULE_NODE_SIZE;
    if (nodeType === 'requirement') return REQUIREMENT_NODE_SIZE;
    return SCENARIO_NODE_SIZE;
}

function stackHeights(heights: number[], gap: number) {
    if (!heights.length) return 0;
    return heights.reduce((total, height, index) => total + height + (index > 0 ? gap : 0), 0);
}

function getScenarioSubtreeHeight() {
    return SCENARIO_NODE_SIZE.height;
}

function getRequirementSubtreeHeight(requirement: QAMindMapRequirement) {
    const scenarioHeights = requirement.scenarios.map(() => getScenarioSubtreeHeight());
    const scenariosHeight = stackHeights(scenarioHeights, NODE_GAP);
    return Math.max(REQUIREMENT_NODE_SIZE.height, scenariosHeight);
}

function getModuleSubtreeHeight(module: QAMindMapModule, collapsed: boolean) {
    if (collapsed || !module.requirements.length) {
        return MODULE_NODE_SIZE.height;
    }

    const requirementHeights = module.requirements.map((requirement) => getRequirementSubtreeHeight(requirement));
    const requirementsHeight = stackHeights(requirementHeights, NODE_GAP);
    return Math.max(MODULE_NODE_SIZE.height, requirementsHeight);
}

function buildFlowElements(
    modules: QAMindMapModule[],
    coverageModules: QACoverageModuleSummary[],
    collapsedModules: Record<string, boolean>,
    onToggleModule: (moduleName: string) => void,
    onSelectNode: (selection: MindMapSelection) => void,
) {
    const coverageLookup = new Map(coverageModules.map((module) => [module.module_name.toLowerCase(), module.coverage_percentage]));
    const nodes: Node<MindMapNodeData>[] = [];
    const edges: Edge[] = [];
    let currentTop = CANVAS_PADDING;
    const moduleColumnX = CANVAS_PADDING;
    const requirementColumnX = CANVAS_PADDING + MODULE_NODE_SIZE.width + COLUMN_GAP;
    const scenarioColumnX = requirementColumnX + REQUIREMENT_NODE_SIZE.width + COLUMN_GAP;

    modules.forEach((module) => {
        const coveragePercentage = coverageLookup.get(module.module_name.toLowerCase()) ?? 0;
        const moduleStatus = getCoverageStatus(coveragePercentage);
        const collapsed = collapsedModules[module.module_name] ?? false;
        const moduleId = `module-${module.module_name}`;
        const moduleSubtreeHeight = getModuleSubtreeHeight(module, collapsed);
        const branchTop = currentTop;
        const branchCenterY = branchTop + moduleSubtreeHeight / 2;

        const moduleScenarios = module.requirements.flatMap((requirement) => requirement.scenarios);

        nodes.push({
            id: moduleId,
            type: 'mindMapNode',
            position: {
                x: moduleColumnX,
                y: branchCenterY - MODULE_NODE_SIZE.height / 2,
            },
            data: {
                label: module.module_name,
                nodeType: 'module',
                moduleName: module.module_name,
                status: moduleStatus,
                description: `${module.module_name} coverage ${coveragePercentage}%. Click to inspect linked scenarios or collapse this branch.`,
                scenarios: moduleScenarios,
                collapsed,
                collapsible: true,
                onToggle: () => onToggleModule(module.module_name),
                onSelect: onSelectNode,
            },
            draggable: true,
        });

        if (!collapsed) {
            let requirementTop = branchTop;

            module.requirements.forEach((requirement, requirementIndex) => {
                const requirementId = `${moduleId}-requirement-${requirementIndex}`;
                const requirementStatus = getRequirementStatus(requirement);
                const requirementSubtreeHeight = getRequirementSubtreeHeight(requirement);
                const requirementCenterY = requirementTop + requirementSubtreeHeight / 2;

                nodes.push({
                    id: requirementId,
                    type: 'mindMapNode',
                    position: {
                        x: requirementColumnX,
                        y: requirementCenterY - REQUIREMENT_NODE_SIZE.height / 2,
                    },
                    data: {
                        label: requirement.requirement,
                        nodeType: 'requirement',
                        moduleName: module.module_name,
                        status: requirementStatus,
                        description: requirement.covered
                            ? `${requirement.requirement} is mapped to ${requirement.scenarios.length} generated scenario${requirement.scenarios.length === 1 ? '' : 's'}.`
                            : `${requirement.requirement} has no mapped scenarios and needs additional QA coverage.`,
                        scenarios: requirement.scenarios,
                        onSelect: onSelectNode,
                    },
                    draggable: true,
                });

                edges.push({
                    id: `${moduleId}-${requirementId}`,
                    source: moduleId,
                    target: requirementId,
                    type: 'bezier',
                    animated: requirementStatus !== 'full',
                    style: { stroke: requirementStatus === 'gap' ? '#fb7185' : requirementStatus === 'partial' ? '#fbbf24' : '#34d399', strokeWidth: 1.7 },
                });

                const totalScenarioHeight = stackHeights(
                    requirement.scenarios.map(() => SCENARIO_NODE_SIZE.height),
                    NODE_GAP,
                );
                let scenarioTop = requirementCenterY - totalScenarioHeight / 2;

                requirement.scenarios.forEach((scenario, scenarioIndex) => {
                    const scenarioId = `${requirementId}-scenario-${scenarioIndex}`;
                    const scenarioCenterY = scenarioTop + SCENARIO_NODE_SIZE.height / 2;

                    nodes.push({
                        id: scenarioId,
                        type: 'mindMapNode',
                        position: {
                            x: scenarioColumnX,
                            y: scenarioCenterY - SCENARIO_NODE_SIZE.height / 2,
                        },
                        data: {
                            label: scenario,
                            nodeType: 'scenario',
                            moduleName: module.module_name,
                            status: 'full',
                            description: `Generated scenario under ${requirement.requirement}. Click to focus the related test case.`,
                            scenarios: [scenario],
                            onSelect: onSelectNode,
                        },
                        draggable: true,
                    });

                    edges.push({
                        id: `${requirementId}-${scenarioId}`,
                        source: requirementId,
                        target: scenarioId,
                        type: 'bezier',
                        style: { stroke: '#60a5fa', strokeWidth: 1.4 },
                    });

                    scenarioTop += SCENARIO_NODE_SIZE.height + NODE_GAP;
                });

                requirementTop += requirementSubtreeHeight + NODE_GAP;
            });
        }

        currentTop += moduleSubtreeHeight + MODULE_GAP;
    });

    const layoutedNodes = nodes.map((node) => ({
        ...node,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
    }));

    const horizontalPositions = layoutedNodes.map((node) => node.position.x + getNodeSize(node.data.nodeType).width);
    const verticalPositions = layoutedNodes.map((node) => node.position.y + getNodeSize(node.data.nodeType).height);

    const canvasWidth = Math.max(MIN_CANVAS_WIDTH, ...horizontalPositions, 0) + CANVAS_PADDING;
    const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, ...verticalPositions, 0) + CANVAS_PADDING;

    return {
        nodes: layoutedNodes,
        edges,
        canvasWidth,
        canvasHeight,
    };
}

function shouldExcludeFromExport(node: HTMLElement) {
    return (
        node.classList?.contains('react-flow__controls')
        || node.classList?.contains('react-flow__minimap')
        || node.classList?.contains('react-flow__panel')
    );
}

function FlowCanvas({
    nodes,
    edges,
    heightClassName,
    wrapperRef,
    canvasWidth,
    canvasHeight,
    viewportKey,
}: {
    nodes: Node<MindMapNodeData>[];
    edges: Edge[];
    heightClassName: string;
    wrapperRef: React.RefObject<HTMLDivElement | null>;
    canvasWidth: number;
    canvasHeight: number;
    viewportKey: string;
}) {
    return (
        <div className={`qa-flow premium-focus-surface overflow-auto rounded-[1.3rem] ${heightClassName}`}>
            <div
                ref={wrapperRef}
                className="relative"
                style={{
                    width: `${canvasWidth}px`,
                    minWidth: '100%',
                    height: `${canvasHeight}px`,
                    minHeight: '100%',
                }}
            >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%)]" />
                <ReactFlow
                    key={viewportKey}
                    fitView
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={{ mindMapNode: MindMapNode }}
                    minZoom={0.3}
                    maxZoom={1.6}
                    fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
                    nodesDraggable
                    proOptions={{ hideAttribution: true }}
                    className="bg-transparent"
                    defaultEdgeOptions={{
                        type: 'bezier',
                        animated: false,
                        style: {
                            strokeWidth: 1.6,
                        },
                    }}
                >
                    <Background color="#1e293b" gap={22} size={1} />
                    <MiniMap
                        pannable
                        zoomable
                        className="!bottom-5 !right-5 !h-28 !w-40 !rounded-xl !border !border-slate-700 !bg-slate-950/90"
                        nodeColor={(node) => {
                            const status = (node.data as MindMapNodeData).status;
                            if (status === 'gap') return '#fb7185';
                            if (status === 'partial') return '#fbbf24';
                            return '#34d399';
                        }}
                    />
                    <Controls className="!bottom-6 !left-6 !shadow-none" showInteractive={false} />
                </ReactFlow>
            </div>
        </div>
    );
}

export default function QACoverageMindMap({
    modules,
    coverageModules,
    onSelectionChange,
}: QACoverageMindMapProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeModuleName, setActiveModuleName] = useState<string>('');
    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
    const inlineWrapperRef = useRef<HTMLDivElement>(null);
    const modalWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setCollapsedModules(
            modules.reduce<Record<string, boolean>>((accumulator, module) => {
                accumulator[module.module_name] = false;
                return accumulator;
            }, {}),
        );
    }, [modules]);

    useEffect(() => {
        if (!modules.length) {
            setActiveModuleName('');
            return;
        }

        const moduleExists = modules.some((module) => module.module_name === activeModuleName);
        if (!moduleExists) {
            setActiveModuleName(modules[0].module_name);
        }
    }, [activeModuleName, modules]);

    const handleToggleModule = (moduleName: string) => {
        setCollapsedModules((current) => ({
            ...current,
            [moduleName]: !current[moduleName],
        }));
    };

    const handleSelectNode = (selection: MindMapSelection) => {
        onSelectionChange?.(selection);
    };

    const visibleModules = useMemo(
        () => modules.filter((module) => module.module_name === activeModuleName),
        [activeModuleName, modules],
    );
    const visibleCoverageModules = useMemo(
        () => coverageModules.filter((module) => module.module_name === activeModuleName),
        [activeModuleName, coverageModules],
    );

    const { nodes, edges, canvasWidth, canvasHeight } = useMemo(
        () => buildFlowElements(
            visibleModules,
            visibleCoverageModules,
            collapsedModules,
            handleToggleModule,
            handleSelectNode,
        ),
        [collapsedModules, visibleCoverageModules, visibleModules],
    );
    const viewportKey = useMemo(
        () => nodes.map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`).join('|'),
        [nodes],
    );

    const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
        const target = modalWrapperRef.current || inlineWrapperRef.current;
        if (!target) return;

        try {
            const exportOptions = {
                cacheBust: true,
                pixelRatio: 2,
                skipAutoScale: true,
                backgroundColor: '#08101f',
                width: canvasWidth,
                height: canvasHeight,
                canvasWidth,
                canvasHeight,
                style: {
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    minWidth: `${canvasWidth}px`,
                    minHeight: `${canvasHeight}px`,
                    overflow: 'hidden',
                },
                filter: (node: HTMLElement) => !shouldExcludeFromExport(node),
            };

            if (format === 'svg') {
                const dataUrl = await toSvg(target, exportOptions);
                const svgBlob = await fetch(dataUrl).then((response) => response.blob());
                saveAs(svgBlob, 'coverage-mind-map.svg');
                return;
            }

            const pngBlob = await toBlob(target, exportOptions);
            if (!pngBlob) {
                throw new Error('Could not generate image blob.');
            }

            if (format === 'png') {
                saveAs(pngBlob, 'coverage-mind-map.png');
                return;
            }

            const pngDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result);
                    } else {
                        reject(new Error('Failed to convert PNG blob to data URL.'));
                    }
                };
                reader.onerror = () => reject(reader.error || new Error('Failed to read PNG blob.'));
                reader.readAsDataURL(pngBlob);
            });

            const pdf = new jsPDF({
                orientation: canvasWidth >= canvasHeight ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvasWidth, canvasHeight],
            });
            pdf.addImage(pngDataUrl, 'PNG', 0, 0, canvasWidth, canvasHeight);
            pdf.save('coverage-mind-map.pdf');
        } catch (error) {
            console.error('Mind map export failed:', error);
            window.alert('Failed to export the coverage map. Please try again.');
        }
    };

    return (
        <>
            <div className="premium-surface rounded-[1.5rem] p-5 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-blue-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_42%),linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-4">
                    <div>
                        <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                            <BrainCircuit className="h-5 w-5 text-blue-600" />
                            Visual Test Coverage Map
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                            Understand requirement coverage visually. Open the full interactive map to zoom, pan, collapse branches, inspect tooltips, and jump into related scenarios.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 hover:bg-blue-700"
                        >
                            <Maximize2 className="h-4 w-4" />
                            View Interactive Map
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleExport('png')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <Download className="h-4 w-4" />
                            Download PNG
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleExport('svg')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <Download className="h-4 w-4" />
                            Download SVG
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleExport('pdf')}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <Download className="h-4 w-4" />
                            Download PDF
                        </button>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Fully covered
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Partial coverage
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Coverage gap
                    </span>
                </div>

                <div className="mb-4 rounded-[1.15rem] border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Focused Module View
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {modules.map((module) => {
                            const coverageMatch = coverageModules.find((coverageModule) => coverageModule.module_name === module.module_name);
                            const coveragePercentage = coverageMatch?.coverage_percentage ?? 0;
                            const isActive = module.module_name === activeModuleName;
                            const tone = getCoverageStatus(coveragePercentage);

                            return (
                                <button
                                    key={module.module_name}
                                    type="button"
                                    onClick={() => {
                                        setActiveModuleName(module.module_name);
                                        onSelectionChange?.(null);
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                                        isActive
                                            ? 'border-blue-200 bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)]'
                                            : tone === 'full'
                                                ? 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                                                : tone === 'partial'
                                                    ? 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                                                    : 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                                    }`}
                                >
                                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : tone === 'full' ? 'bg-emerald-500' : tone === 'partial' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                    {module.module_name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <FlowCanvas
                    nodes={nodes}
                    edges={edges}
                    heightClassName="h-[420px]"
                    wrapperRef={inlineWrapperRef}
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    viewportKey={viewportKey}
                />
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
                    <div className="flex h-[92vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-[1.8rem] border border-slate-700 bg-slate-950 shadow-2xl">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
                            <div>
                                <p className="text-lg font-bold text-white">Coverage Mind Map</p>
                                <p className="mt-1 text-sm text-slate-400">
                                    Interactive QA coverage explorer with draggable nodes, zoom controls, and branch collapsing.
                                </p>
                            </div>

                        <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                                    <ZoomIn className="h-4 w-4" />
                                    Zoom and pan enabled
                                </span>
                                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                                    <Move className="h-4 w-4" />
                                    Drag nodes
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleExport('png')}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)] transition hover:bg-blue-700"
                                >
                                    <Download className="h-4 w-4" />
                                    PNG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleExport('svg')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-800"
                                >
                                    <Download className="h-4 w-4" />
                                    SVG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleExport('pdf')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-800"
                                >
                                    <Download className="h-4 w-4" />
                                    PDF
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-white px-3 py-2 text-xs font-bold text-slate-900 transition hover:bg-slate-100"
                                >
                                    <X className="h-4 w-4" />
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-5">
                            <FlowCanvas
                                nodes={nodes}
                                edges={edges}
                                heightClassName="h-full"
                                wrapperRef={modalWrapperRef}
                                canvasWidth={canvasWidth}
                                canvasHeight={canvasHeight}
                                viewportKey={viewportKey}
                            />
                        </div>

                        <div className="border-t border-slate-800 px-6 py-4 text-sm text-slate-400">
                            Click a node to surface related scenarios, collapse a module to focus on one branch, or export the map for reporting.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
