import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { DashboardDto, DashboardChartDto } from "./dto/chat.dto";
import { MetricsService } from "./data/metrics.service";
import { MetricInfo } from "./data/data-analysis.service";

export type DashboardGraphDeps = {
    metricsService: MetricsService;
    // Required helpers injected from DashboardService (no fallbacks)
    identifyRelatedMetrics: (prompt: string, dataAnalysis: any, maxCharts?: number) => Promise<MetricInfo[]>;
    generateChartSpecs: (request: DashboardDto, metrics: MetricInfo[], dataAnalysis: any) => Promise<any[]>;
    formatTitle: (metricName: string, chartType: string) => string;
    calcSpan: (chartType: string, totalCharts: number) => number;
    generateDashboardId: () => string;
};

type DashboardState = typeof DashboardAnnotation.State;

const DashboardAnnotation = Annotation.Root({
    // Request inputs
    prompt: Annotation<string>(),
    dateRange: Annotation<string | undefined>(),
    maxCharts: Annotation<number | undefined>(),
    // Keep full request available for helpers like generateChartSpecs
    request: Annotation<DashboardDto | undefined>(),

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

    // Output metadata
    responseTimeMs: Annotation<number>(),
});

export function createDashboardGraph(deps: DashboardGraphDeps) {
    const { metricsService } = deps;

    const initNode = async (state: DashboardState) => {
        return {
            startTime: Date.now(),
            dashboardId: deps.generateDashboardId(),
        };
    };

    const analyzeDataNode = async (state: DashboardState) => {
        const dataAnalysis = await metricsService.getDataAnalysis(state.dateRange);
        return { dataAnalysis };
    };

    const selectRelatedMetricsNode = async (state: DashboardState) => {
        const maxCharts = state.maxCharts ?? 5;
        const related = await deps.identifyRelatedMetrics(state.prompt, state.dataAnalysis, maxCharts);
        return { relatedMetrics: related };
    };

    const generateSpecsNode = async (state: DashboardState) => {
        if (!state.request) return { chartSpecs: [] };
        const specs = await deps.generateChartSpecs(state.request, state.relatedMetrics, state.dataAnalysis);
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
                span: deps.calcSpan(spec.chartType, state.chartSpecs.length),
            } as DashboardChartDto);
            index++;
        }
        return { charts };
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
        .addNode("finalize", finalizeNode)
        .addEdge(START, "init")
        .addEdge("init", "analyzeData")
        .addEdge("analyzeData", "selectRelatedMetrics")
        .addEdge("selectRelatedMetrics", "generateSpecs")
        .addEdge("generateSpecs", "fetchData")
        .addEdge("fetchData", "finalize")
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
        request,
    } as any);

    return {
        dashboardId: result.dashboardId,
        charts: result.charts,
        metadata: {
            totalCharts: result.charts?.length ?? 0,
            responseTimeMs: result.responseTimeMs,
        },
        requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
}


