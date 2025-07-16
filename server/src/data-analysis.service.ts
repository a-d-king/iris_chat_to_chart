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
        const maxDepth = 5; // Prevent infinite recursion

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

            // Handle dynamic key objects (like cashDetails, creditCardDetails)
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
            const groupingDimensions = array.map(item => item.connector || item.label || item.name || 'Unknown');

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
        if (path.length > 3) {
            return false;
        }

        return true;
    }

    /**
     * Analyze a single metric and determine its characteristics
     */
    private analyzeMetric(key: string, value: any, fullPath?: string): MetricInfo | null {

        // Skip null/undefined values
        if (value === null || value === undefined) {
            return null;
        }

        // Handle scalar values
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

        // Handle arrays
        if (Array.isArray(value)) {
            return this.analyzeArrayMetric(key, value, fullPath);
        }

        // Handle objects
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

        // Skip arrays of objects - they'll be handled by extractFromObjectArray
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
     * Generate chart type suggestions based on available metrics
     */
    private generateChartSuggestions(metrics: MetricInfo[]): ChartSuggestion[] {
        const suggestions: ChartSuggestion[] = [];

        const timeSeriesMetrics = metrics.filter(m => m.hasTimeData && !m.hasGrouping);
        const groupedSeriesMetrics = metrics.filter(m => m.hasGrouping);
        const scalarMetrics = metrics.filter(m => m.type === 'scalar');
        const embeddedMetrics = metrics.filter(m => m.type === 'embeddedMetrics' || m.type === 'dynamicKeyObject');

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

        // Bar charts for embedded metrics and dynamic key objects
        if (embeddedMetrics.length > 0) {
            suggestions.push({
                chartType: 'bar',
                confidence: 0.75,
                reason: 'Ideal for comparing metrics across different accounts or entities',
                bestForMetrics: embeddedMetrics.map(m => m.name)
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
                    for (const item of obj.slice(0, 3)) { // Check first few items
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

                    // Recursively check nested objects
                    for (const key of Object.keys(obj).slice(0, 10)) { // Limit to avoid deep recursion
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

    /**
     * Find the best metric match for a given prompt
     */
    findBestMetricMatch(prompt: string, metrics: MetricInfo[]): MetricInfo | null {
        const promptLower = prompt.toLowerCase();

        // Direct name matches (including nested paths)
        for (const metric of metrics) {
            const metricNameLower = metric.name.toLowerCase();
            if (promptLower.includes(metricNameLower)) {
                return metric;
            }

            // Check if prompt matches the base name (without path)
            const baseName = metric.name.split('.').pop()?.toLowerCase();
            if (baseName && promptLower.includes(baseName)) {
                return metric;
            }
        }

        // Keyword matching
        const keywords = promptLower.split(' ');
        let bestMatch: MetricInfo | null = null;
        let bestScore = 0;

        for (const metric of metrics) {
            const metricKeywords = metric.name.toLowerCase().split(/(?=[A-Z])|[\s_.-]+/);
            let score = 0;

            for (const keyword of keywords) {
                if (metricKeywords.some(mk => mk.includes(keyword) || keyword.includes(mk))) {
                    score++;
                }
            }

            // Bonus points for embedded metrics if the prompt mentions the container
            if (metric.embeddedMetrics && metric.embeddedMetrics.some(em =>
                keywords.some(kw => em.toLowerCase().includes(kw) || kw.includes(em.toLowerCase()))
            )) {
                score += 2;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = metric;
            }
        }

        return bestMatch;
    }
} 