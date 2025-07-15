import { Injectable } from '@nestjs/common';

/**
 * Interface for data analysis results
 */
export interface DataAnalysis {
    availableMetrics: MetricInfo[];
    suggestedChartTypes: ChartSuggestion[];
    dataContext: string;
}

export interface MetricInfo {
    name: string;
    type: 'scalar' | 'timeSeries' | 'groupedSeries' | 'array';
    description: string;
    hasTimeData: boolean;
    hasGrouping: boolean;
    groupingDimensions?: string[];
    sampleValues?: any[];
    valueType: 'currency' | 'percentage' | 'count' | 'generic';
    chartRecommendations: string[];
}

export interface ChartSuggestion {
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';
    confidence: number;
    reason: string;
    bestForMetrics: string[];
}

/**
 * Service for analyzing data structure and providing intelligent chart recommendations
 */
@Injectable()
export class DataAnalysisService {

    /**
     * Analyze the loaded data and provide context for chart generation
     */
    analyzeData(data: any): DataAnalysis {
        const metrics = this.extractMetrics(data);
        const suggestions = this.generateChartSuggestions(metrics);
        const context = this.generateDataContext(metrics);

        return {
            availableMetrics: metrics,
            suggestedChartTypes: suggestions,
            dataContext: context
        };
    }

    /**
     * Extract and categorize all metrics from the data
     */
    private extractMetrics(data: any): MetricInfo[] {
        const metrics: MetricInfo[] = [];

        for (const [key, value] of Object.entries(data)) {
            const metric = this.analyzeMetric(key, value);
            if (metric) {
                metrics.push(metric);
            }
        }

        return metrics;
    }

    /**
     * Analyze a single metric and determine its characteristics
     */
    private analyzeMetric(key: string, value: any): MetricInfo | null {
        // Skip null/undefined values
        if (value === null || value === undefined) {
            return null;
        }

        // Handle scalar values
        if (typeof value === 'number') {
            return {
                name: key,
                type: 'scalar',
                description: this.generateMetricDescription(key, 'scalar'),
                hasTimeData: false,
                hasGrouping: false,
                valueType: this.detectValueType(key, value),
                chartRecommendations: ['bar'],
                sampleValues: [value]
            };
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return this.analyzeArrayMetric(key, value);
        }

        // Handle objects
        if (typeof value === 'object') {
            return this.analyzeObjectMetric(key, value);
        }

        return null;
    }

    /**
     * Analyze array-based metrics
     */
    private analyzeArrayMetric(key: string, value: any[]): MetricInfo | null {
        if (value.length === 0) {
            return null;
        }

        const firstItem = value[0];

        // Check if it's time series i.e. has date/value pairs
        if (firstItem && typeof firstItem === 'object' && 'date' in firstItem && 'value' in firstItem) {
            return {
                name: key,
                type: 'timeSeries',
                description: this.generateMetricDescription(key, 'timeSeries'),
                hasTimeData: true,
                hasGrouping: false,
                valueType: this.detectValueType(key, firstItem.value),
                chartRecommendations: ['line', 'bar'],
                sampleValues: value.slice(0, 3).map(item => item.value)
            };
        }

        return {
            name: key,
            type: 'array',
            description: this.generateMetricDescription(key, 'array'),
            hasTimeData: false,
            hasGrouping: false,
            valueType: 'generic',
            chartRecommendations: ['bar'],
            sampleValues: value.slice(0, 3)
        };
    }

    /**
     * Analyze object-based metrics i.e. grouped series
     */
    private analyzeObjectMetric(key: string, value: any): MetricInfo | null {
        if (value.dates && value.values && Array.isArray(value.dates) && Array.isArray(value.values)) {
            const groupingDimensions = value.values.map((series: any) => series.label);

            return {
                name: key,
                type: 'groupedSeries',
                description: this.generateMetricDescription(key, 'groupedSeries'),
                hasTimeData: true,
                hasGrouping: true,
                groupingDimensions,
                valueType: this.detectValueType(key, value.values[0]?.values?.[0]),
                chartRecommendations: ['line', 'bar', 'stacked-bar'],
                sampleValues: value.values[0]?.values?.slice(0, 3)
            };
        }

        return null;
    }

    /**
     * Detect the type of values (currency, percentage, count, etc.)
     */
    private detectValueType(key: string, sampleValue: any): 'currency' | 'percentage' | 'count' | 'generic' {
        const keyLower = key.toLowerCase();

        // Currency indicators
        if (keyLower.includes('sales') || keyLower.includes('revenue') || keyLower.includes('income') ||
            keyLower.includes('profit') || keyLower.includes('cash') || keyLower.includes('expenses') ||
            keyLower.includes('cost') || keyLower.includes('margin') && !keyLower.includes('percentage')) {
            return 'currency';
        }

        // Percentage indicators
        if (keyLower.includes('percentage') || keyLower.includes('rate') || keyLower.includes('ratio')) {
            return 'percentage';
        }

        // Count indicators
        if (keyLower.includes('orders') || keyLower.includes('customers') || keyLower.includes('count') ||
            keyLower.includes('users') || keyLower.includes('total') && typeof sampleValue === 'number' && sampleValue % 1 === 0) {
            return 'count';
        }

        return 'generic';
    }

    /**
     * Generate human-readable descriptions for metrics
     */
    private generateMetricDescription(key: string, type: string): string {
        const keyWords = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

        switch (type) {
            case 'scalar':
                return `Total ${keyWords}`;
            case 'timeSeries':
                return `${keyWords} over time`;
            case 'groupedSeries':
                return `${keyWords} broken down by category over time`;
            case 'array':
                return `${keyWords} data points`;
            default:
                return keyWords;
        }
    }

    /**
     * Generate chart type suggestions based on available metrics
     */
    private generateChartSuggestions(metrics: MetricInfo[]): ChartSuggestion[] {
        const suggestions: ChartSuggestion[] = [];

        const timeSeriesMetrics = metrics.filter(m => m.hasTimeData && !m.hasGrouping);
        const groupedSeriesMetrics = metrics.filter(m => m.hasGrouping);
        const scalarMetrics = metrics.filter(m => m.type === 'scalar');

        // Line charts for time series
        if (timeSeriesMetrics.length > 0) {
            suggestions.push({
                chartType: 'line',
                confidence: 0.9,
                reason: 'Perfect for showing trends over time',
                bestForMetrics: timeSeriesMetrics.map(m => m.name)
            });
        }

        // Bar charts for comparisons
        if (scalarMetrics.length > 1) {
            suggestions.push({
                chartType: 'bar',
                confidence: 0.8,
                reason: 'Great for comparing different metrics',
                bestForMetrics: scalarMetrics.map(m => m.name)
            });
        }

        // Stacked bar charts for grouped data
        if (groupedSeriesMetrics.length > 0) {
            suggestions.push({
                chartType: 'stacked-bar',
                confidence: 0.85,
                reason: 'Shows composition and trends for grouped data',
                bestForMetrics: groupedSeriesMetrics.map(m => m.name)
            });
        }

        // Waterfall charts for changes over time
        const changeMetrics = metrics.filter(m => m.name.toLowerCase().includes('change') ||
            m.name.toLowerCase().includes('delta'));
        if (changeMetrics.length > 0) {
            suggestions.push({
                chartType: 'waterfall',
                confidence: 0.7,
                reason: 'Excellent for showing cumulative changes',
                bestForMetrics: changeMetrics.map(m => m.name)
            });
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Generate contextual information about the data for the AI model
     */
    private generateDataContext(metrics: MetricInfo[]): string {
        const timeSeriesCount = metrics.filter(m => m.hasTimeData).length;
        const groupedCount = metrics.filter(m => m.hasGrouping).length;
        const scalarCount = metrics.filter(m => m.type === 'scalar').length;

        const currencyMetrics = metrics.filter(m => m.valueType === 'currency');
        const percentageMetrics = metrics.filter(m => m.valueType === 'percentage');
        const countMetrics = metrics.filter(m => m.valueType === 'count');

        let context = `This dataset contains ${metrics.length} metrics. `;

        if (timeSeriesCount > 0) {
            context += `There are ${timeSeriesCount} time-series metrics that show trends over time. `;
        }

        if (groupedCount > 0) {
            context += `There are ${groupedCount} grouped metrics that can be broken down by categories. `;
        }

        if (scalarCount > 0) {
            context += `There are ${scalarCount} summary/total metrics. `;
        }

        if (currencyMetrics.length > 0) {
            context += `Currency metrics include: ${currencyMetrics.map(m => m.name).join(', ')}. `;
        }

        if (percentageMetrics.length > 0) {
            context += `Percentage metrics include: ${percentageMetrics.map(m => m.name).join(', ')}. `;
        }

        if (countMetrics.length > 0) {
            context += `Count metrics include: ${countMetrics.map(m => m.name).join(', ')}. `;
        }

        return context;
    }

    /**
     * Find the best metric match for a given prompt
     */
    findBestMetricMatch(prompt: string, metrics: MetricInfo[]): MetricInfo | null {
        const promptLower = prompt.toLowerCase();

        // Direct name matches
        for (const metric of metrics) {
            if (promptLower.includes(metric.name.toLowerCase())) {
                return metric;
            }
        }

        // Keyword matching
        const keywords = promptLower.split(' ');
        let bestMatch: MetricInfo | null = null;
        let bestScore = 0;

        for (const metric of metrics) {
            const metricKeywords = metric.name.toLowerCase().split(/(?=[A-Z])|[\s_-]+/);
            let score = 0;

            for (const keyword of keywords) {
                if (metricKeywords.some(mk => mk.includes(keyword) || keyword.includes(mk))) {
                    score++;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = metric;
            }
        }

        return bestMatch;
    }
} 