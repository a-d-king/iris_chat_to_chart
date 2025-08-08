import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { DashboardDto, DashboardChartDto } from "./chat.dto";
import { OpenAiService } from "./openai.service";
import { MetricsService } from "./metrics.service";
import { MetricInfo } from "./data-analysis.service";

export type DashboardGraphDeps = {
    openAiService: OpenAiService;
    metricsService: MetricsService;
};

type DashboardState = typeof DashboardAnnotation.State;

const DashboardAnnotation = Annotation.Root({
    // Request inputs
    prompt: Annotation<string>(),
    dateRange: Annotation<string | undefined>(),
    maxCharts: Annotation<number | undefined>(),
    generateInsights: Annotation<boolean | undefined>(),

    // Working state
    startTime: Annotation<number>(),
    dashboardId: Annotation<string>(),
    dataAnalysis: Annotation<any>(),
    relatedMetrics: Annotation<MetricInfo[]>({
        reducer: (x: MetricInfo[] | undefined, y: MetricInfo[] | undefined): MetricInfo[] => (y ?? x ?? []),
        default: (): MetricInfo[] => []
    }),
    chartSpecs: Annotation<any[]>({
        reducer: (x: any[] | undefined, y: any[] | undefined): any[] => (y ?? x ?? []),
        default: (): any[] => []
    }),
    charts: Annotation<DashboardChartDto[]>({
        reducer: (x: DashboardChartDto[] | undefined, y: DashboardChartDto[] | undefined): DashboardChartDto[] => (y ?? x ?? []),
        default: (): DashboardChartDto[] => []
    }),
    insights: Annotation<string[]>({
        reducer: (x: string[] | undefined, y: string[] | undefined): string[] => (y ?? x ?? []),
        default: (): string[] => []
    }),

    // Output metadata
    responseTimeMs: Annotation<number>(),
});

function generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateChartTitle(metricName: string, chartType: string): string {
    const cleanName = metricName.split('.').pop() || metricName;
    const formattedName = cleanName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

    const typeMap: Record<string, string> = {
        'line': 'Trends',
        'bar': 'Comparison',
        'stacked-bar': 'Breakdown',
        'heatmap': 'Pattern Analysis',
        'waterfall': 'Impact Analysis'
    };

    return `${formattedName} ${typeMap[chartType] || 'Analysis'}`;
}

function calculateChartSpan(): number {
    // Single column layout for now; can evolve later
    return 4;
}

function basicInsights(charts: DashboardChartDto[]): string[] {
    const insights: string[] = [];
    if (charts.length > 3) {
        insights.push(`Generated ${charts.length} related charts for comprehensive analysis`);
    }
    const chartTypes = [...new Set(charts.map((c) => c.chartType))];
    if (chartTypes.length > 2) {
        insights.push('Multiple visualization types used for different data perspectives');
    }
    const hasTimeSeries = charts.some((c) => c.chartType === 'line');
    const hasComparison = charts.some((c) => c.chartType === 'bar' || c.chartType === 'stacked-bar');
    if (hasTimeSeries && hasComparison) {
        insights.push('Dashboard includes both trend analysis and comparative metrics');
    }
    return insights.slice(0, 3);
}

export function createDashboardGraph(deps: DashboardGraphDeps) {
    const { openAiService, metricsService } = deps;

    const initNode = async (state: DashboardState) => {
        return {
            startTime: Date.now(),
            dashboardId: generateDashboardId(),
        };
    };

    const analyzeDataNode = async (state: DashboardState) => {
        const dataAnalysis = await metricsService.getDataAnalysis(state.dateRange);
        return { dataAnalysis };
    };

    const selectRelatedMetricsNode = async (state: DashboardState) => {
        // Exclude scalar metrics for visualization
        const visualizable = state.dataAnalysis.availableMetrics.filter((m: MetricInfo) => m.type !== 'scalar');
        const maxCharts = state.maxCharts ?? 5;
        // Simple fallback: pick first N metrics deterministically
        const related = visualizable.slice(0, maxCharts);
        return { relatedMetrics: related };
    };

    const generateSpecsNode = async (state: DashboardState) => {
        const specs: any[] = [];
        for (const metric of state.relatedMetrics) {
            const metricPrompt = `Show ${metric.name} ${metric.hasTimeData ? 'trends over time' : 'breakdown'}`;
            try {
                const spec = await openAiService.prompt(metricPrompt, state.dataAnalysis);
                specs.push({
                    ...spec,
                    title: generateChartTitle(metric.name, spec.chartType),
                    dateRange: state.dateRange || spec.dateRange,
                });
            } catch (error) {
                specs.push({
                    chartType: metric.hasTimeData ? 'line' : 'bar',
                    metric: metric.name,
                    dateRange: state.dateRange || '2025-06',
                    title: generateChartTitle(metric.name, metric.hasTimeData ? 'line' : 'bar'),
                });
            }
        }
        return { chartSpecs: specs };
    };

    const fetchDataNode = async (state: DashboardState) => {
        const charts: DashboardChartDto[] = [] as any;
        let index = 0;
        for (const spec of state.chartSpecs) {
            const data = await metricsService.slice(spec.metric, spec.dateRange, spec.groupBy);
            // Server-side logging of chart data used per dashboard chart
            try {
                const seriesLabels = Array.isArray((data as any)?.values)
                    ? (data as any).values.map((s: any) => s.label)
                    : [];
                console.log('=== DASHBOARD CHART DATA USED ===');
                console.log({
                    chartId: `chart_${index + 1}`,
                    chartType: spec.chartType,
                    metric: spec.metric,
                    dateRange: spec.dateRange,
                    groupBy: spec.groupBy,
                    points: (data as any)?.dates?.length || 0,
                    series: seriesLabels,
                    sample: {
                        dates: (data as any)?.dates?.slice(0, 3),
                        firstSeriesSample: (data as any)?.values?.[0]?.values?.slice(0, 3)
                    }
                });
                console.log('=== END DASHBOARD CHART DATA ===');
            } catch { }
            charts.push({
                ...spec,
                id: `chart_${index + 1}`,
                data,
                row: Math.floor(index / 2) + 1,
                col: (index % 2) + 1,
                span: calculateChartSpan(),
            } as DashboardChartDto);
            index++;
        }
        return { charts };
    };

    const computeInsightsNode = async (state: DashboardState) => {
        if (!(state.generateInsights ?? true)) return { insights: [] };
        return { insights: basicInsights(state.charts) };
    };

    const finalizeNode = async (state: DashboardState) => {
        const responseTimeMs = Date.now() - state.startTime;
        return { responseTimeMs };
    };

    const builder = new StateGraph(DashboardAnnotation)
        .addNode("init", initNode)
        .addNode("analyzeData", analyzeDataNode)
        .addNode("selectRelatedMetrics", selectRelatedMetricsNode)
        .addNode("generateSpecs", generateSpecsNode)
        .addNode("fetchData", fetchDataNode)
        .addNode("computeInsights", computeInsightsNode)
        .addNode("finalize", finalizeNode)
        .addEdge(START, "init")
        .addEdge("init", "analyzeData")
        .addEdge("analyzeData", "selectRelatedMetrics")
        .addEdge("selectRelatedMetrics", "generateSpecs")
        .addEdge("generateSpecs", "fetchData")
        .addEdge("fetchData", "computeInsights")
        .addEdge("computeInsights", "finalize")
        .addEdge("finalize", END);

    return builder.compile();
}

export async function runDashboardGraph(
    request: DashboardDto,
    deps: DashboardGraphDeps
) {
    const graph = createDashboardGraph(deps);
    const result = await graph.invoke({
        prompt: request.prompt,
        dateRange: request.dateRange,
        maxCharts: request.maxCharts,
        generateInsights: request.generateInsights,
    } as any);

    return {
        dashboardId: result.dashboardId,
        charts: result.charts,
        metadata: {
            totalCharts: result.charts?.length ?? 0,
            responseTimeMs: result.responseTimeMs,
            suggestedInsights: result.insights ?? [],
        },
        requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
}


