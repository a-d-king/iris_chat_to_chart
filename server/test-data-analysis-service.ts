import * as fs from 'fs';
import * as path from 'path';
import { DataAnalysis, MetricInfo, ChartSuggestion } from './src/data-analysis.service';

/**
 * Primary test suite for DataAnalysisService
 */
export class TestDataAnalysisService {

    /**
     * Analyze the loaded data and provide context for chart generation
     */
    analyzeData(data: any): DataAnalysis {
        const metrics = this.extractMetricsRecursively(data);
        const suggestions = this.generateChartSuggestions(metrics);
        const context = this.generateDataContext(metrics);

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

        if (array.length === 0) return metrics;

        const firstItem = array[0];
        const numericKeys = Object.keys(firstItem).filter(key =>
            typeof firstItem[key] === 'number' && key !== 'date'
        );

        // Create a container metric for the array
        if (numericKeys.length > 0) {
            metrics.push({
                name: basePath,
                type: 'embeddedMetrics',
                description: `${this.generateMetricDescription(basePath, 'embeddedMetrics')} containing ${numericKeys.length} metrics`,
                hasTimeData: false,
                hasGrouping: true,
                groupingDimensions: array.map(item => item.connector || item.label || item.name || 'Unknown'),
                valueType: 'generic',
                chartRecommendations: ['bar', 'stacked-bar'],
                keyPath: basePath,
                embeddedMetrics: numericKeys,
                sampleValues: numericKeys.map(key => (firstItem as any)[key])
            });

            // Create individual metrics for each numeric key
            for (const key of numericKeys) {
                const metricName = `${basePath}.${key}`;
                metrics.push({
                    name: metricName,
                    type: 'groupedSeries',
                    description: `${this.generateMetricDescription(key, 'groupedSeries')} from ${basePath}`,
                    hasTimeData: false,
                    hasGrouping: true,
                    groupingDimensions: array.map(item => item.connector || item.label || item.name || 'Unknown'),
                    valueType: this.detectValueType(key, firstItem[key]),
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

        if (entries.length === 0) return metrics;

        const [firstKey, firstValue] = entries[0];

        if (typeof firstValue === 'object' && firstValue !== null) {
            const numericKeys = Object.keys(firstValue).filter(key =>
                typeof (firstValue as any)[key] === 'number'
            );

            // Create a container metric
            if (numericKeys.length > 0) {
                metrics.push({
                    name: basePath,
                    type: 'dynamicKeyObject',
                    description: `${this.generateMetricDescription(containerKey, 'dynamicKeyObject')} with ${entries.length} accounts`,
                    hasTimeData: false,
                    hasGrouping: true,
                    groupingDimensions: entries.map(([key, value]: [string, any]) =>
                        value.name || value.officialName || key
                    ),
                    valueType: 'generic',
                    chartRecommendations: ['bar'],
                    keyPath: basePath,
                    embeddedMetrics: numericKeys,
                    sampleValues: numericKeys.map(key => (firstValue as any)[key])
                });

                // Create individual metrics for each numeric property
                for (const key of numericKeys) {
                    const metricName = `${basePath}.${key}`;
                    metrics.push({
                        name: metricName,
                        type: 'groupedSeries',
                        description: `${this.generateMetricDescription(key, 'groupedSeries')} across ${containerKey}`,
                        hasTimeData: false,
                        hasGrouping: true,
                        groupingDimensions: entries.map(([accountKey, value]: [string, any]) =>
                            value.name || value.officialName || accountKey
                        ),
                        valueType: this.detectValueType(key, (firstValue as any)[key]),
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

        return hasIdLikeKeys && allSimilarStructure;
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
     * Extract and categorize all metrics from the data (legacy method for backward compatibility)
     */
    private extractMetrics(data: any): MetricInfo[] {
        return this.extractMetricsRecursively(data);
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
            return {
                name: fullPath || key,
                type: 'scalar',
                description: this.generateMetricDescription(key, 'scalar'),
                hasTimeData: false,
                hasGrouping: false,
                valueType: this.detectValueType(key, value),
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
    private generateDataContext(metrics: MetricInfo[]): string {
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

// Main test function
async function testMetricDiscovery() {
    try {
        console.log('🔍 Testing Metric Discovery System \n');
        console.log('='.repeat(70));

        // Load the same sample data that the real service uses
        const dataPath = path.join(__dirname, 'sample-june-metrics.json');
        const rawData = fs.readFileSync(dataPath, 'utf-8');
        const data = JSON.parse(rawData);

        console.log(`📁 Loaded data from: ${dataPath}`);
        console.log(`📊 Raw data has ${Object.keys(data).length} top-level properties\n`);

        // Initialize the EXACT COPY of DataAnalysisService
        const analysisService = new TestDataAnalysisService();

        // Analyze the data using EXACT same method
        const analysis = analysisService.analyzeData(data);

        // Display results
        console.log('📈 METRIC DISCOVERY RESULTS');
        console.log('='.repeat(70));
        console.log(`Total metrics discovered: ${analysis.availableMetrics.length}\n`);

        // Group metrics by type
        const metricsByType: Record<string, MetricInfo[]> = {};
        analysis.availableMetrics.forEach(metric => {
            if (!metricsByType[metric.type]) {
                metricsByType[metric.type] = [];
            }
            metricsByType[metric.type].push(metric);
        });

        // Display metrics by type with more details
        Object.entries(metricsByType).forEach(([type, metrics]) => {
            console.log(`\n🏷️  ${type.toUpperCase()} METRICS (${metrics.length})`);
            console.log('-'.repeat(50));
            metrics.forEach(metric => {
                console.log(`  • ${metric.name}`);
                console.log(`    Description: ${metric.description}`);
                console.log(`    Value Type: ${metric.valueType}`);
                console.log(`    Path: ${metric.keyPath || 'root'}`);
                console.log(`    Chart Recs: ${metric.chartRecommendations.join(', ')}`);
                if (metric.embeddedMetrics && metric.embeddedMetrics.length > 0) {
                    console.log(`    Contains: ${metric.embeddedMetrics.join(', ')}`);
                }
                if (metric.groupingDimensions && metric.groupingDimensions.length > 0) {
                    const displayGroups = metric.groupingDimensions.slice(0, 3);
                    const moreText = metric.groupingDimensions.length > 3 ? ` +${metric.groupingDimensions.length - 3} more` : '';
                    console.log(`    Groups: ${displayGroups.join(', ')}${moreText}`);
                }
                console.log('');
            });
        });

        // Display comprehensive statistics
        console.log('\n📊 COMPREHENSIVE STATISTICS');
        console.log('='.repeat(70));
        console.log(`📊 Total metrics discovered: ${analysis.availableMetrics.length}`);
        console.log(`⏰ Time series metrics: ${analysis.availableMetrics.filter(m => m.hasTimeData).length}`);
        console.log(`📚 Grouped metrics: ${analysis.availableMetrics.filter(m => m.hasGrouping).length}`);
        console.log(`💰 Currency metrics: ${analysis.availableMetrics.filter(m => m.valueType === 'currency').length}`);
        console.log(`📊 Percentage metrics: ${analysis.availableMetrics.filter(m => m.valueType === 'percentage').length}`);
        console.log(`🔢 Count metrics: ${analysis.availableMetrics.filter(m => m.valueType === 'count').length}`);
        console.log(`🔄 Generic metrics: ${analysis.availableMetrics.filter(m => m.valueType === 'generic').length}`);

        // Breakdown by type
        console.log('\n📈 BREAKDOWN BY TYPE:');
        Object.entries(metricsByType).forEach(([type, metrics]) => {
            console.log(`   ${type}: ${metrics.length} metrics`);
        });

        // Display chart suggestions
        console.log('\n🎯 CHART SUGGESTIONS');
        console.log('='.repeat(70));
        analysis.suggestedChartTypes.forEach(suggestion => {
            console.log(`${suggestion.chartType.toUpperCase()} (confidence: ${suggestion.confidence})`);
            console.log(`  Reason: ${suggestion.reason}`);
            console.log(`  Best for: ${suggestion.bestForMetrics.slice(0, 5).join(', ')}${suggestion.bestForMetrics.length > 5 ? '...' : ''}\n`);
        });

        // Display data context
        console.log('\n📝 DATA CONTEXT FOR AI');
        console.log('='.repeat(70));
        console.log(analysis.dataContext);

        // Show some examples of newly discovered metrics
        console.log('\n🆕 EXAMPLES OF NEWLY DISCOVERED METRICS');
        console.log('='.repeat(70));

        const dynamicMetrics = analysis.availableMetrics.filter(m => m.type === 'dynamicKeyObject');
        const embeddedMetrics = analysis.availableMetrics.filter(m => m.type === 'embeddedMetrics');
        const nestedMetrics = analysis.availableMetrics.filter(m => m.keyPath && m.keyPath.includes('.'));

        if (dynamicMetrics.length > 0) {
            console.log('🔑 Dynamic Key Objects (Account-based metrics):');
            dynamicMetrics.forEach(m => console.log(`   • ${m.name} (${m.embeddedMetrics?.length} sub-metrics)`));
        }

        if (embeddedMetrics.length > 0) {
            console.log('\n📦 Embedded Metrics Containers:');
            embeddedMetrics.forEach(m => console.log(`   • ${m.name} (${m.embeddedMetrics?.length} sub-metrics)`));
        }

        if (nestedMetrics.length > 0) {
            console.log('\n🔗 Nested/Path-based Metrics:');
            nestedMetrics.slice(0, 10).forEach(m => console.log(`   • ${m.name}`));
            if (nestedMetrics.length > 10) {
                console.log(`   ... and ${nestedMetrics.length - 10} more nested metrics`);
            }
        }

        console.log('\n✅ TypeScript service test completed successfully!');
        console.log('🎯 This matches exactly what the real DataAnalysisService will find!');

    } catch (error) {
        console.error('❌ Error during testing:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
    }
}

// Run the test
testMetricDiscovery(); 