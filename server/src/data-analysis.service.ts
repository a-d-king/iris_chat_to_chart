import { Injectable } from '@nestjs/common';

/**
 * Interface for data analysis results
 */
export interface DataQualityReport {
    completeness: number; // % of non-null values
    consistency: boolean; // uniform data types
    outliers: any[]; // detected anomalies
    recommendations: string[];
    issues: string[];
    dataVolume: number;
    timeRange?: { start: string; end: string; gaps: string[] };
}

export interface DataAnalysis {
    availableMetrics: MetricInfo[];
    suggestedChartTypes: ChartSuggestion[];
    dataContext: string;
    dataQuality: DataQualityReport;
    metricRelationships: MetricRelationship[];
}

export interface ChartSuggestion {
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';
    confidence: number;
    reason: string;
    bestForMetrics: string[];
    dataFitScore: number;
    visualEffectiveness: number;
    alternatives: ChartSuggestion[];
}

export interface MetricRelationship {
    primaryMetric: string;
    relatedMetrics: {
        metric: string;
        correlationType: 'causal' | 'complementary' | 'inverse' | 'temporal';
        strength: number; // 0-1
        businessContext: string;
    }[];
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
        const dataQuality = this.assessDataQuality(data, metrics);
        const metricRelationships = this.analyzeMetricRelationships(metrics);
        const suggestions = this.generateAdvancedChartSuggestions(metrics, dataQuality);
        const context = this.generateDataContext(metrics, data);

        return {
            availableMetrics: metrics,
            suggestedChartTypes: suggestions,
            dataContext: context,
            dataQuality,
            metricRelationships
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

    /**
     * Find the best metric match for a given prompt with enhanced business context awareness
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

        // Enhanced business-context keyword matching
        const keywords = promptLower.split(' ');
        let bestMatch: MetricInfo | null = null;
        let bestScore = 0;

        for (const metric of metrics) {
            const metricKeywords = metric.name.toLowerCase().split(/(?=[A-Z])|[\s_.-]+/);
            let score = 0;

            // Standard keyword matching
            for (const keyword of keywords) {
                if (metricKeywords.some(mk => mk.includes(keyword) || keyword.includes(mk))) {
                    score++;
                }
            }

            // Business context boost
            score += this.calculateBusinessContextBoost(promptLower, metric);

            // Handle embedded metrics
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

        /**
     * Calculate business context boost for better metric matching
     */
    private calculateBusinessContextBoost(promptLower: string, metric: MetricInfo): number {
        const metricNameLower = metric.name.toLowerCase();
        let boost = 0;

        // Enhanced business domain mapping with relationship awareness
        const domainMappings = {
            sales: {
                keywords: ['sales', 'revenue', 'gross', 'net', 'income'],
                related: ['orders', 'customer', 'growth'],
                boost: 5
            },
            orders: {
                keywords: ['orders', 'order', 'count', 'volume', 'quantity'],
                related: ['sales', 'customer', 'fulfillment'],
                boost: 5
            },
            customers: {
                keywords: ['customer', 'user', 'client', 'acquisition'],
                related: ['sales', 'orders', 'retention'],
                boost: 4
            },
            financial: {
                keywords: ['profit', 'margin', 'income', 'expense', 'cost'],
                related: ['sales', 'cash', 'balance'],
                boost: 4
            },
            cash: {
                keywords: ['cash', 'balance', 'flow', 'liquidity'],
                related: ['financial', 'profit', 'expense'],
                boost: 3
            },
            performance: {
                keywords: ['growth', 'rate', 'performance', 'kpi', 'trend'],
                related: ['sales', 'orders', 'customer'],
                boost: 4
            },
            inventory: {
                keywords: ['inventory', 'stock', 'product', 'supply'],
                related: ['orders', 'sales', 'fulfillment'],
                boost: 3
            }
        };

        // Calculate domain-specific boosts
        for (const [domain, config] of Object.entries(domainMappings)) {
            const promptHasDomain = config.keywords.some(keyword => promptLower.includes(keyword));
            const promptHasRelated = config.related.some(related => promptLower.includes(related));
            const metricHasDomain = config.keywords.some(keyword => metricNameLower.includes(keyword));
            const metricHasRelated = config.related.some(related => metricNameLower.includes(related));

            if (promptHasDomain && metricHasDomain) {
                // Direct domain match - highest boost
                boost += config.boost;
            } else if (promptHasDomain && metricHasRelated) {
                // Related domain match - good boost
                boost += config.boost * 0.7;
            } else if (promptHasRelated && metricHasDomain) {
                // Cross-domain relationship - moderate boost
                boost += config.boost * 0.5;
            } else if (metricHasDomain && !promptHasDomain && !promptHasRelated) {
                // Metric in domain but not mentioned in prompt - lower boost
                boost += config.boost * 0.2;
            }
        }

        // Context-specific boosts
        if ((promptLower.includes('trend') || promptLower.includes('analysis') || promptLower.includes('over time'))
            && metric.hasTimeData) {
            boost += 2;
        }

        if ((promptLower.includes('comparison') || promptLower.includes('vs') || promptLower.includes('versus'))
            && metric.hasGrouping) {
            boost += 1;
        }

        return boost;
    }

    /**
     * Assess data quality and identify potential issues
     */
    private assessDataQuality(data: any, metrics: MetricInfo[]): DataQualityReport {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let totalValues = 0;
        let nullValues = 0;
        const outliers: any[] = [];
        const timeRange = this.detectTimeRange(data);

        // Analyze each metric for quality issues
        for (const metric of metrics) {
            const values = this.extractMetricValues(data, metric);

            if (!values || values.length === 0) {
                issues.push(`Metric '${metric.name}' has no data`);
                continue;
            }

            totalValues += values.length;

            // Check for null/undefined values
            const nullCount = values.filter(v => v == null || v === undefined).length;
            nullValues += nullCount;

            if (nullCount > values.length * 0.3) {
                issues.push(`Metric '${metric.name}' has ${Math.round(nullCount / values.length * 100)}% missing data`);
                recommendations.push(`Consider filtering or imputing missing values for ${metric.name}`);
            }

            // Detect outliers for numeric data
            if (metric.valueType !== 'generic') {
                const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
                if (numericValues.length > 0) {
                    const detectedOutliers = this.detectOutliers(numericValues);
                    if (detectedOutliers.length > 0) {
                        outliers.push(...detectedOutliers.map(val => ({ metric: metric.name, value: val })));
                    }
                }
            }

            // Check data volume
            if (values.length < 3) {
                issues.push(`Metric '${metric.name}' has insufficient data points (${values.length})`);
                recommendations.push(`Consider using different date range for ${metric.name}`);
            }
        }

        const completeness = totalValues > 0 ? (totalValues - nullValues) / totalValues : 0;
        const consistency = issues.filter(i => i.includes('missing data')).length === 0;

        // Generate recommendations based on data quality
        if (completeness < 0.8) {
            recommendations.push('Data completeness is low - consider data cleaning');
        }
        if (outliers.length > 0) {
            recommendations.push('Outliers detected - may affect chart readability');
        }
        if (timeRange?.gaps && timeRange.gaps.length > 0) {
            recommendations.push('Time series has gaps - consider interpolation');
        }

        return {
            completeness: Math.round(completeness * 100) / 100,
            consistency,
            outliers,
            recommendations,
            issues,
            dataVolume: totalValues,
            timeRange
        };
    }

    /**
     * Analyze relationships between metrics
     */
    private analyzeMetricRelationships(metrics: MetricInfo[]): MetricRelationship[] {
        const relationships: MetricRelationship[] = [];

        for (const metric of metrics) {
            const relatedMetrics = [];

            // Find business logic relationships
            const metricName = metric.name.toLowerCase();

            for (const otherMetric of metrics) {
                if (otherMetric.name === metric.name) continue;

                const otherName = otherMetric.name.toLowerCase();
                let relationship = null;

                // Causal relationships (business logic)
                if (metricName.includes('gross') && otherName.includes('net')) {
                    relationship = {
                        metric: otherMetric.name,
                        correlationType: 'causal' as const,
                        strength: 0.9,
                        businessContext: 'Net values derived from gross values'
                    };
                } else if (metricName.includes('sales') && otherName.includes('profit')) {
                    relationship = {
                        metric: otherMetric.name,
                        correlationType: 'causal' as const,
                        strength: 0.8,
                        businessContext: 'Profit typically correlates with sales volume'
                    };
                } else if (metricName.includes('customer') && otherName.includes('sales')) {
                    relationship = {
                        metric: otherMetric.name,
                        correlationType: 'causal' as const,
                        strength: 0.7,
                        businessContext: 'Customer metrics often drive sales performance'
                    };
                }

                // Complementary relationships (same domain)
                else if ((metricName.includes('sales') && otherName.includes('revenue')) ||
                    (metricName.includes('cash') && otherName.includes('balance'))) {
                    relationship = {
                        metric: otherMetric.name,
                        correlationType: 'complementary' as const,
                        strength: 0.8,
                        businessContext: 'Related financial metrics'
                    };
                }

                // Temporal relationships (same time patterns)
                else if (metric.hasTimeData && otherMetric.hasTimeData &&
                    metric.type === otherMetric.type) {
                    relationship = {
                        metric: otherMetric.name,
                        correlationType: 'temporal' as const,
                        strength: 0.6,
                        businessContext: 'Similar temporal patterns and data structure'
                    };
                }

                if (relationship) {
                    relatedMetrics.push(relationship);
                }
            }

            if (relatedMetrics.length > 0) {
                relationships.push({
                    primaryMetric: metric.name,
                    relatedMetrics: relatedMetrics.slice(0, 5) // Limit to top 5 relationships
                });
            }
        }

        return relationships;
    }

    /**
     * Generate advanced chart suggestions with enhanced intelligence
     */
    private generateAdvancedChartSuggestions(metrics: MetricInfo[], dataQuality: DataQualityReport): ChartSuggestion[] {
        const suggestions: ChartSuggestion[] = [];

        for (const metric of metrics) {
            const baseScore = this.calculateDataFitScore(metric, dataQuality);
            const visualScore = this.calculateVisualEffectiveness(metric);

            // Line charts for temporal data
            if (metric.hasTimeData && metric.type === 'timeSeries') {
                const confidence = dataQuality.completeness > 0.8 ? 0.9 : 0.7;
                suggestions.push({
                    chartType: 'line',
                    confidence,
                    reason: `Time series data ideal for trend analysis. ${dataQuality.completeness < 0.8 ? 'Some data gaps present.' : ''}`,
                    bestForMetrics: [metric.name],
                    dataFitScore: baseScore * 0.9,
                    visualEffectiveness: visualScore * 0.9,
                    alternatives: this.generateAlternatives(metric, ['bar', 'stacked-bar'])
                });
            }

            // Enhanced bar chart logic
            if (metric.type === 'scalar' || metric.type === 'dynamicKeyObject' || metric.type === 'embeddedMetrics') {
                const hasOutliers = dataQuality.outliers.some(o => o.metric === metric.name);
                const confidence = hasOutliers ? 0.7 : 0.8;

                suggestions.push({
                    chartType: 'bar',
                    confidence,
                    reason: `Categorical data excellent for comparisons. ${hasOutliers ? 'Outliers present - may need attention.' : ''}`,
                    bestForMetrics: [metric.name],
                    dataFitScore: baseScore * (hasOutliers ? 0.7 : 0.8),
                    visualEffectiveness: visualScore * 0.8,
                    alternatives: this.generateAlternatives(metric, ['stacked-bar', 'heatmap'])
                });
            }

            // Enhanced stacked bar logic
            if (metric.hasGrouping && metric.type === 'groupedSeries' &&
                (metric.groupingDimensions?.length || 0) > 1 && (metric.groupingDimensions?.length || 0) <= 8) {

                const dataVolumeFactor = dataQuality.dataVolume > 100 ? 0.9 : 0.7;
                suggestions.push({
                    chartType: 'stacked-bar',
                    confidence: 0.85 * dataVolumeFactor,
                    reason: `Grouped data shows composition well. ${dataQuality.dataVolume <= 100 ? 'Limited data volume.' : ''}`,
                    bestForMetrics: [metric.name],
                    dataFitScore: baseScore * dataVolumeFactor,
                    visualEffectiveness: visualScore * 0.85,
                    alternatives: this.generateAlternatives(metric, ['bar', 'heatmap'])
                });
            }
        }

        // Sort by confidence and data fit score
        return suggestions
            .sort((a, b) => (b.confidence * b.dataFitScore) - (a.confidence * a.dataFitScore))
            .slice(0, 10); // Limit to top 10 suggestions
    }

    /**
     * Helper methods for advanced chart suggestions
     */
    private calculateDataFitScore(metric: MetricInfo, dataQuality: DataQualityReport): number {
        let score = dataQuality.completeness;

        // Penalize for outliers
        const hasOutliers = dataQuality.outliers.some(o => o.metric === metric.name);
        if (hasOutliers) score *= 0.8;

        // Boost for sufficient data volume
        if (dataQuality.dataVolume > 50) score *= 1.1;

        // Penalize for data quality issues
        const hasIssues = dataQuality.issues.some(issue => issue.includes(metric.name));
        if (hasIssues) score *= 0.7;

        return Math.min(score, 1.0);
    }

    private calculateVisualEffectiveness(metric: MetricInfo): number {
        let score = 0.7; // Base score

        // Boost for time data (trends are compelling)
        if (metric.hasTimeData) score += 0.2;

        // Boost for grouping (comparisons are valuable)
        if (metric.hasGrouping) score += 0.15;

        // Boost for currency data (business relevant)
        if (metric.valueType === 'currency') score += 0.1;

        return Math.min(score, 1.0);
    }

    private generateAlternatives(metric: MetricInfo, chartTypes: string[]): ChartSuggestion[] {
        return chartTypes.map(type => ({
            chartType: type as 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall',
            confidence: 0.6,
            reason: `Alternative visualization for ${metric.name}`,
            bestForMetrics: [metric.name],
            dataFitScore: 0.6,
            visualEffectiveness: 0.6,
            alternatives: [] as ChartSuggestion[]
        }));
    }

    private extractMetricValues(data: any, metric: MetricInfo): any[] {
        try {
            const rawData = this.getNestedValue(data, metric.name);

            if (Array.isArray(rawData)) {
                if (rawData[0] && typeof rawData[0] === 'object' && 'value' in rawData[0]) {
                    return rawData.map(item => item.value);
                }
                return rawData;
            }

            if (typeof rawData === 'object' && rawData?.values) {
                if (Array.isArray(rawData.values) && rawData.values[0]?.values) {
                    return rawData.values.flatMap((series: any) => series.values || []);
                }
            }

            return rawData !== null && rawData !== undefined ? [rawData] : [];
        } catch (error) {
            return [];
        }
    }

    private detectOutliers(values: number[]): number[] {
        if (values.length < 4) return [];

        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        return values.filter(value => value < lowerBound || value > upperBound);
    }

    private detectTimeRange(data: any): { start: string; end: string; gaps: string[] } | undefined {
        const dates: string[] = [];

        const extractDates = (obj: any) => {
            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    if (item && typeof item === 'object' && item.date) {
                        dates.push(item.date);
                    }
                });
            } else if (obj && typeof obj === 'object') {
                if (obj.dates && Array.isArray(obj.dates)) {
                    dates.push(...obj.dates);
                }
                Object.values(obj).forEach(value => extractDates(value));
            }
        };

        extractDates(data);

        if (dates.length === 0) return undefined;

        const sortedDates = dates.sort();
        const gaps: string[] = [];

        // Simple gap detection (this could be more sophisticated)
        for (let i = 1; i < sortedDates.length; i++) {
            const current = new Date(sortedDates[i]);
            const previous = new Date(sortedDates[i - 1]);
            const diffDays = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);

            if (diffDays > 7) { // More than a week gap
                gaps.push(`Gap between ${sortedDates[i - 1]} and ${sortedDates[i]}`);
            }
        }

        return {
            start: sortedDates[0],
            end: sortedDates[sortedDates.length - 1],
            gaps
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
} 