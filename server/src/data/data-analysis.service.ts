import { Injectable } from '@nestjs/common';

/**
 * Interface for data analysis results
 */
export interface DataAnalysis {
    availableMetrics: MetricInfo[];
    suggestedChartTypes: ChartSuggestion[];
    dataContext: string;
}

export interface ChartSuggestion {
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';
    confidence: number;
    reason: string;
    bestForMetrics: string[];
}

export interface MetricInfo {
    name: string;
    type: 'scalar' | 'timeSeries' | 'groupedSeries' | 'array' | 'dynamicKeyObject' | 'embeddedMetrics';
    description: string;
    hasTimeData: boolean;
    hasGrouping: boolean;
    groupingDimensions?: string[];
    sampleValues?: any[];
    valueType: 'currency' | 'percentage' | 'count' | 'generic';
    chartRecommendations: string[];
    keyPath?: string;
    embeddedMetrics?: string[];
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
        const metrics = this.extractMetricsRecursively(data);
        const suggestions = this.generateChartSuggestions(metrics);
        const context = this.generateDataContext(metrics, data);

        return {
            availableMetrics: metrics,
            suggestedChartTypes: suggestions,
            dataContext: context
        };
    }

    /**
     * Recursively extract and categorize all metrics from the data
     */
    private extractMetricsRecursively(data: any, keyPath: string[] = [], depth: number = 0): MetricInfo[] {
        const metrics: MetricInfo[] = [];
        const maxDepth = 10;

        if (depth > maxDepth || !data || typeof data !== 'object') {
            return metrics;
        }

        for (const [key, value] of Object.entries(data)) {
            const currentPath = keyPath.length > 0 ? `${keyPath.join('.')}.${key}` : key;
            const fullPath = [...keyPath, key];

            // Analyze current level metric
            const metric = this.analyzeMetric(key, value, currentPath);
            if (metric) {
                metrics.push(metric);
            }

            // Handle arrays of objects with embedded metrics
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                const embeddedMetrics = this.extractFromObjectArray(value, currentPath);
                metrics.push(...embeddedMetrics);
            }

            // Handle dynamic key objects (cashDetails, creditCardDetails)
            if (this.isDynamicKeyObject(value)) {
                const dynamicMetrics = this.extractFromDynamicKeyObject(key, value, currentPath);
                metrics.push(...dynamicMetrics);
            }

            // Recurse into objects that aren't already handled
            if (this.shouldRecurseInto(value, fullPath)) {
                metrics.push(...this.extractMetricsRecursively(value, fullPath, depth + 1));
            }
        }

        return metrics;
    }

    /**
     * Extract metrics from arrays of objects with embedded metrics
     */
    private extractFromObjectArray(array: any[], basePath: string): MetricInfo[] {
        const metrics: MetricInfo[] = [];

        if (array.length === 0) {
            return metrics;
        }

        const firstItem = array[0];

        const numericKeys = Object.keys(firstItem).filter(key =>
            typeof firstItem[key] === 'number' && key !== 'date'
        );

        // Create a container metric for the array
        if (numericKeys.length > 0) {
            const groupingDimensions = array.map((item, index) => {
                const label = item.connector || item.label || item.name;

                // If we still don't have a good label, try to extract from other fields
                if (!label || label.toLowerCase().includes('unknown')) {
                    const fallback = item.channel || item.type || item.id ||
                        Object.keys(item).find(key =>
                            key !== 'values' &&
                            key !== 'date' &&
                            typeof item[key] === 'string' &&
                            item[key].length > 0 &&
                            !item[key].toLowerCase().includes('unknown') &&
                            !item[key].toLowerCase().includes('undefined') &&
                            !item[key].toLowerCase().includes('null')
                        );
                    return fallback ? item[fallback] : `Category ${index + 1}`;
                }

                return label;
            });

            metrics.push({
                name: basePath,
                type: 'embeddedMetrics',
                description: `${this.generateMetricDescription(basePath, 'embeddedMetrics')} containing ${numericKeys.length} metrics`,
                hasTimeData: false,
                hasGrouping: true,
                groupingDimensions: groupingDimensions,
                valueType: 'generic',
                chartRecommendations: ['bar', 'stacked-bar'],
                keyPath: basePath,
                embeddedMetrics: numericKeys,
                sampleValues: numericKeys.map(key => (firstItem as any)[key])
            });

            // Create individual metrics for each numeric key
            for (const key of numericKeys) {
                const metricName = `${basePath}.${key}`;
                const valueType = this.detectValueType(key, firstItem[key]);

                metrics.push({
                    name: metricName,
                    type: 'groupedSeries',
                    description: `${this.generateMetricDescription(key, 'groupedSeries')} from ${basePath}`,
                    hasTimeData: false,
                    hasGrouping: true,
                    groupingDimensions: groupingDimensions,
                    valueType: valueType,
                    chartRecommendations: ['bar', 'stacked-bar'],
                    keyPath: metricName,
                    sampleValues: array.slice(0, 3).map(item => (item as any)[key])
                });
            }
        }

        return metrics;
    }

    /**
     * Extract metrics from objects with dynamic keys (like account IDs)
     */
    private extractFromDynamicKeyObject(containerKey: string, obj: any, basePath: string): MetricInfo[] {
        const metrics: MetricInfo[] = [];
        const entries = Object.entries(obj);

        if (entries.length === 0) {
            return metrics;
        }

        const [firstKey, firstValue] = entries[0];

        if (typeof firstValue === 'object' && firstValue !== null) {
            const numericKeys = Object.keys(firstValue).filter(key =>
                typeof (firstValue as any)[key] === 'number'
            );

            // Create a container metric
            if (numericKeys.length > 0) {
                const groupingDimensions = entries.map(([key, value]: [string, any]) =>
                    value.name || value.officialName || key
                );

                metrics.push({
                    name: basePath,
                    type: 'dynamicKeyObject',
                    description: `${this.generateMetricDescription(containerKey, 'dynamicKeyObject')} with ${entries.length} accounts`,
                    hasTimeData: false,
                    hasGrouping: true,
                    groupingDimensions: groupingDimensions,
                    valueType: 'generic',
                    chartRecommendations: ['bar'],
                    keyPath: basePath,
                    embeddedMetrics: numericKeys,
                    sampleValues: numericKeys.map(key => (firstValue as any)[key])
                });

                // Create individual metrics for each numeric property
                for (const key of numericKeys) {
                    const metricName = `${basePath}.${key}`;
                    const valueType = this.detectValueType(key, (firstValue as any)[key]);

                    metrics.push({
                        name: metricName,
                        type: 'groupedSeries',
                        description: `${this.generateMetricDescription(key, 'groupedSeries')} across ${containerKey}`,
                        hasTimeData: false,
                        hasGrouping: true,
                        groupingDimensions: groupingDimensions,
                        valueType: valueType,
                        chartRecommendations: ['bar'],
                        keyPath: metricName,
                        sampleValues: entries.slice(0, 3).map(([_, value]: [string, any]) => (value as any)[key])
                    });
                }
            }
        }

        return metrics;
    }

    /**
     * Check if an object has dynamic keys (like account IDs)
     */
    private isDynamicKeyObject(value: any): boolean {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }

        const entries = Object.entries(value);
        if (entries.length === 0) return false;

        // Check if keys look like IDs (long alphanumeric strings) or UUIDs
        const hasIdLikeKeys = entries.every(([key]) =>
            key.length > 20 && /^[a-zA-Z0-9]+$/.test(key)
        );

        // Check if all values have similar structure
        const firstValue = entries[0][1];
        if (typeof firstValue !== 'object' || firstValue === null) {
            return false;
        }

        const firstKeys = Object.keys(firstValue);
        const allSimilarStructure = entries.every(([_, val]) =>
            typeof val === 'object' && val !== null &&
            Object.keys(val).length === firstKeys.length
        );

        const result = hasIdLikeKeys && allSimilarStructure;

        return result;
    }

    /**
     * Check if we should recurse into this object
     */
    private shouldRecurseInto(value: any, path: string[]): boolean {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return false;
        }

        // Don't recurse into known patterns we've already handled
        if (this.isDynamicKeyObject(value)) {
            return false;
        }

        // Don't recurse into grouped series structures
        if (value.dates && value.values && Array.isArray(value.dates) && Array.isArray(value.values)) {
            return false;
        }

        // Don't recurse too deep
        if (path.length > 5) {
            return false;
        }

        return true;
    }

    /**
     * Analyze a single metric and determine its characteristics
     */
    private analyzeMetric(key: string, value: any, fullPath?: string): MetricInfo | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'number') {
            const valueType = this.detectValueType(key, value);
            return {
                name: fullPath || key,
                type: 'scalar',
                description: this.generateMetricDescription(key, 'scalar'),
                hasTimeData: false,
                hasGrouping: false,
                valueType: valueType,
                chartRecommendations: ['bar'],
                sampleValues: [value],
                keyPath: fullPath
            };
        }

        if (Array.isArray(value)) {
            return this.analyzeArrayMetric(key, value, fullPath);
        }

        if (typeof value === 'object') {
            return this.analyzeObjectMetric(key, value, fullPath);
        }

        return null;
    }

    /**
     * Analyze array-based metrics
     */
    private analyzeArrayMetric(key: string, value: any[], fullPath?: string): MetricInfo | null {
        if (value.length === 0) {
            return null;
        }

        const firstItem = value[0];
        const metricName = fullPath || key;

        // Check if it's time series i.e. has date/value pairs
        if (firstItem && typeof firstItem === 'object' && 'date' in firstItem && 'value' in firstItem) {
            return {
                name: metricName,
                type: 'timeSeries',
                description: this.generateMetricDescription(key, 'timeSeries'),
                hasTimeData: true,
                hasGrouping: false,
                valueType: this.detectValueType(key, firstItem.value),
                chartRecommendations: ['line', 'bar'],
                sampleValues: value.slice(0, 3).map(item => item.value),
                keyPath: fullPath
            };
        }

        // Skip arrays of objects - handled by extractFromObjectArray
        if (firstItem && typeof firstItem === 'object') {
            return null;
        }

        return {
            name: metricName,
            type: 'array',
            description: this.generateMetricDescription(key, 'array'),
            hasTimeData: false,
            hasGrouping: false,
            valueType: 'generic',
            chartRecommendations: ['bar'],
            sampleValues: value.slice(0, 3),
            keyPath: fullPath
        };
    }

    /**
     * Analyze object-based metrics i.e. grouped series
     */
    private analyzeObjectMetric(key: string, value: any, fullPath?: string): MetricInfo | null {
        const metricName = fullPath || key;

        if (value.dates && value.values && Array.isArray(value.dates) && Array.isArray(value.values)) {
            const groupingDimensions = value.values.map((series: any) => series.label);

            return {
                name: metricName,
                type: 'groupedSeries',
                description: this.generateMetricDescription(key, 'groupedSeries'),
                hasTimeData: true,
                hasGrouping: true,
                groupingDimensions,
                valueType: this.detectValueType(key, value.values[0]?.values?.[0]),
                chartRecommendations: ['line', 'bar', 'stacked-bar'],
                sampleValues: value.values[0]?.values?.slice(0, 3),
                keyPath: fullPath
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
            keyLower.includes('cost') || keyLower.includes('margin') && !keyLower.includes('percentage') ||
            keyLower.includes('balance') || keyLower.includes('amount')) {
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
            case 'dynamicKeyObject':
                return `${keyWords} breakdown by account/entity`;
            case 'embeddedMetrics':
                return `${keyWords} with multiple metrics`;
            default:
                return keyWords;
        }
    }

    /**
     * Generate chart type suggestions based on available metrics to help GPT-4o make better decisions
     * Enhanced with sophisticated scoring, cross-metric analysis, and deduplication
     */
    private generateChartSuggestions(metrics: MetricInfo[]): ChartSuggestion[] {
        const chartCandidates = new Map<string, ChartSuggestion>();

        // 1. Generate metric-specific suggestions with enhanced scoring
        for (const metric of metrics) {
            const metricSuggestions = this.generateMetricSpecificSuggestions(metric);
            metricSuggestions.forEach(suggestion => {
                const existing = chartCandidates.get(suggestion.chartType);
                if (!existing || suggestion.confidence > existing.confidence) {
                    chartCandidates.set(suggestion.chartType, suggestion);
                }
            });
        }

        // 2. Generate cross-metric combination suggestions
        const combinationSuggestions = this.generateCombinationSuggestions(metrics);
        combinationSuggestions.forEach(suggestion => {
            const existing = chartCandidates.get(suggestion.chartType);
            if (!existing || suggestion.confidence > existing.confidence) {
                chartCandidates.set(suggestion.chartType, suggestion);
            }
        });

        // 3. Apply quality filtering and sort
        const qualityThreshold = 0.4;
        const filteredSuggestions = Array.from(chartCandidates.values())
            .filter(s => s.confidence >= qualityThreshold)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 5); // Limit to top 5 suggestions

        return filteredSuggestions;
    }

    /**
     * Generate suggestions for individual metrics with enhanced data compatibility scoring
     */
    private generateMetricSpecificSuggestions(metric: MetricInfo): ChartSuggestion[] {
        const suggestions: ChartSuggestion[] = [];
        const chartTypes: Array<'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall'> =
            ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'];

        for (const chartType of chartTypes) {
            const dataScore = this.scoreMetricDataCompatibility(chartType, metric);
            const visualScore = this.scoreVisualEffectiveness(chartType, metric);

            // Weighted scoring: prioritize data compatibility
            const confidence = Math.round((dataScore * 0.7 + visualScore * 0.3) * 100) / 100;

            if (confidence > 0.3) { // Only include viable options
                suggestions.push({
                    chartType,
                    confidence,
                    reason: this.generateEnhancedReason(chartType, metric, dataScore, visualScore),
                    bestForMetrics: [metric.name]
                });
            }
        }

        return suggestions;
    }

    /**
     * Generate suggestions for metric combinations and cross-metric analysis
     */
    private generateCombinationSuggestions(metrics: MetricInfo[]): ChartSuggestion[] {
        const suggestions: ChartSuggestion[] = [];

        const timeSeriesMetrics = metrics.filter(m => m.hasTimeData);
        const groupedMetrics = metrics.filter(m => m.hasGrouping);
        const currencyMetrics = metrics.filter(m => m.valueType === 'currency');
        const changeMetrics = metrics.filter(m =>
            m.name.toLowerCase().includes('change') ||
            m.name.toLowerCase().includes('delta') ||
            m.name.toLowerCase().includes('diff')
        );

        // Multi-metric line chart for compatible time series
        if (timeSeriesMetrics.length >= 2) {
            const compatibleMetrics = timeSeriesMetrics.filter(m =>
                m.valueType === 'currency' || m.valueType === 'count'
            ).slice(0, 4); // Limit to avoid clutter

            if (compatibleMetrics.length >= 2) {
                let confidence = 0.75;

                // Boost if all metrics are same value type (better visual coherence)
                const valueTypes = new Set(compatibleMetrics.map(m => m.valueType));
                if (valueTypes.size === 1) {
                    confidence += 0.1;
                }

                suggestions.push({
                    chartType: 'line',
                    confidence: Math.min(confidence, 0.95),
                    reason: `Multiple time-series metrics (${compatibleMetrics.length}) with ${valueTypes.size === 1 ? 'consistent' : 'mixed'} value types - excellent for trend comparison`,
                    bestForMetrics: compatibleMetrics.map(m => m.name)
                });
            }
        }

        // Stacked bar for grouped financial metrics
        if (groupedMetrics.length >= 2 && currencyMetrics.length >= 2) {
            const relevantMetrics = metrics.filter(m =>
                m.hasGrouping && m.valueType === 'currency' &&
                (m.groupingDimensions?.length || 0) <= 8
            ).slice(0, 3);

            if (relevantMetrics.length >= 2) {
                suggestions.push({
                    chartType: 'stacked-bar',
                    confidence: 0.82,
                    reason: `Multiple grouped currency metrics showing composition and comparison across categories`,
                    bestForMetrics: relevantMetrics.map(m => m.name)
                });
            }
        }

        // Waterfall for change/delta metrics
        if (changeMetrics.length > 0) {
            suggestions.push({
                chartType: 'waterfall',
                confidence: 0.78,
                reason: 'Change/delta metrics are perfect for showing cumulative effects and sequential impact',
                bestForMetrics: changeMetrics.map(m => m.name)
            });
        }

        // Heatmap for complex multi-dimensional data
        const complexMetrics = metrics.filter(m =>
            m.hasGrouping && m.hasTimeData && (m.groupingDimensions?.length || 0) > 3
        );
        if (complexMetrics.length > 0) {
            suggestions.push({
                chartType: 'heatmap',
                confidence: 0.68,
                reason: 'Multi-dimensional data with many categories reveals patterns and correlations in heatmaps',
                bestForMetrics: complexMetrics.map(m => m.name).slice(0, 2)
            });
        }

        return suggestions;
    }

    /**
     * Score how well a chart type fits individual metric data characteristics
     */
    private scoreMetricDataCompatibility(chartType: string, metric: MetricInfo): number {
        let score = 0.5; // Base score

        switch (chartType) {
            case 'line':
                if (metric.hasTimeData && metric.type === 'timeSeries') score += 0.4;
                if (metric.hasTimeData && metric.type === 'groupedSeries') score += 0.3;
                if (!metric.hasTimeData) score -= 0.3; // Lines need temporal data
                break;

            case 'bar':
                if (metric.type === 'scalar' || metric.type === 'dynamicKeyObject' || metric.type === 'embeddedMetrics') score += 0.3;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) <= 10) score += 0.2;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) > 15) score -= 0.2; // Too many categories
                break;

            case 'stacked-bar':
                if (metric.hasGrouping && metric.type === 'groupedSeries') score += 0.4;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) >= 2 && (metric.groupingDimensions?.length || 0) <= 8) score += 0.2;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) > 10) score -= 0.3; // Too cluttered
                if (!metric.hasGrouping) score -= 0.4; // Needs grouping for stacking
                break;

            case 'heatmap':
                if (metric.hasGrouping && metric.hasTimeData) score += 0.3;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) > 5) score += 0.2;
                if (!metric.hasGrouping || !metric.hasTimeData) score -= 0.3; // Needs both dimensions
                break;

            case 'waterfall':
                if (metric.name.toLowerCase().includes('change') || metric.name.toLowerCase().includes('delta')) score += 0.4;
                if (metric.hasTimeData) score += 0.1;
                if (metric.type === 'scalar') score += 0.1;
                if (!metric.hasTimeData && !metric.name.toLowerCase().includes('change')) score -= 0.2;
                break;
        }

        // Boost score based on value type compatibility
        if (metric.valueType === 'currency' && (chartType === 'line' || chartType === 'bar' || chartType === 'stacked-bar')) {
            score += 0.1;
        }
        if (metric.valueType === 'percentage' && chartType === 'line') {
            score += 0.1;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score visual effectiveness of chart type for given metric
     */
    private scoreVisualEffectiveness(chartType: string, metric: MetricInfo): number {
        let score = 0.6; // Base effectiveness score

        switch (chartType) {
            case 'line':
                if (metric.hasTimeData) score += 0.3;
                if (metric.valueType === 'currency' || metric.valueType === 'count') score += 0.1;
                break;

            case 'bar':
                score += 0.2; // Generally effective
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) <= 10) score += 0.1;
                break;

            case 'stacked-bar':
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) >= 2) score += 0.2;
                if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) > 6) score -= 0.2; // Can be cluttered
                break;

            case 'heatmap':
                if (metric.hasGrouping && metric.hasTimeData) score += 0.2;
                if ((metric.groupingDimensions?.length || 0) < 3) score -= 0.3; // Insufficient for heatmap
                break;

            case 'waterfall':
                if (metric.name.toLowerCase().includes('change')) score += 0.3;
                else score -= 0.1; // Less effective without change context
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Generate enhanced reasoning with contextual details
     */
    private generateEnhancedReason(chartType: string, metric: MetricInfo, dataScore: number, visualScore: number): string {
        const baseReasons = {
            'line': 'Ideal for showing trends and patterns over time',
            'bar': 'Excellent for categorical comparisons and discrete values',
            'stacked-bar': 'Perfect for showing composition and part-to-whole relationships',
            'heatmap': 'Great for revealing patterns across multiple dimensions',
            'waterfall': 'Specialized for showing cumulative changes and impact analysis'
        };

        let reason = baseReasons[chartType as keyof typeof baseReasons] || 'Good fit for this data type';

        // Add data-specific context
        if (metric.hasTimeData && chartType === 'line') {
            reason += ` - ${metric.name} contains temporal data`;
        }

        if (metric.hasGrouping && (chartType === 'bar' || chartType === 'stacked-bar')) {
            const groupCount = metric.groupingDimensions?.length || 0;
            reason += ` - ${groupCount} categories for comparison`;
        }

        if (metric.valueType === 'currency') {
            reason += ' (financial data)';
        } else if (metric.valueType === 'percentage') {
            reason += ' (percentage data)';
        } else if (metric.valueType === 'count') {
            reason += ' (count data)';
        }

        // Add quality indicators
        if (dataScore > 0.8) {
            reason += ' [Excellent data fit]';
        } else if (dataScore > 0.6) {
            reason += ' [Good data fit]';
        }

        return reason;
    }







    /**
     * Generate contextual information about the data for the AI model
     */
    private generateDataContext(metrics: MetricInfo[], data?: any): string {
        const timeSeriesCount = metrics.filter(m => m.hasTimeData).length;
        const groupedCount = metrics.filter(m => m.hasGrouping).length;
        const scalarCount = metrics.filter(m => m.type === 'scalar').length;
        const embeddedCount = metrics.filter(m => m.type === 'embeddedMetrics' || m.type === 'dynamicKeyObject').length;

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

        if (embeddedCount > 0) {
            context += `There are ${embeddedCount} complex metrics with embedded sub-metrics or account-level breakdowns. `;
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

        // Try to detect the year range from actual data
        if (data) {
            let detectedYear = null;

            // Look for dates in various common structures
            const checkForDates = (obj: any, path: string = ''): string | null => {
                if (Array.isArray(obj)) {
                    for (const item of obj.slice(0, 3)) {
                        if (item && typeof item === 'object' && item.date) {
                            const dateStr = String(item.date);
                            const yearMatch = dateStr.match(/^(\d{4})-/);
                            if (yearMatch) return yearMatch[1];
                        }
                    }
                } else if (obj && typeof obj === 'object') {
                    // Check for dates arrays in grouped data
                    if (obj.dates && Array.isArray(obj.dates) && obj.dates.length > 0) {
                        const dateStr = String(obj.dates[0]);
                        const yearMatch = dateStr.match(/^(\d{4})-/);
                        if (yearMatch) return yearMatch[1];
                    }

                    // Recursively check nested objects in data
                    for (const key of Object.keys(obj).slice(0, 10)) {
                        const result = checkForDates(obj[key], path + '.' + key);
                        if (result) return result;
                    }
                }
                return null;
            };

            detectedYear = checkForDates(data);

            if (detectedYear) {
                context += `Data appears to be from ${detectedYear}. Use ${detectedYear} for date ranges unless user specifies otherwise. `;
            }
        }

        return context;
    }
} 