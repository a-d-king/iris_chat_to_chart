import { Injectable } from '@nestjs/common';
import { MetricInfo } from './data-analysis.service';
import { DateFilterUtil } from '../utils/date-filter.util';

/**
 * Common chart data format returned by all slicing strategies
 */
export interface ChartData {
    dates: string[];
    values: Array<{
        label: string;
        values: number[];
    }>;
}

/**
 * Interface for metric slicing strategies
 */
export interface SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo, dateRange?: string): ChartData;
}

/**
 * Strategy for slicing time series data
 */
export class TimeSeriesSlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo, dateRange?: string): ChartData {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || !Array.isArray(rawData)) {
            return { dates: [], values: [] };
        }

        // Filter by date range if specified
        const filteredData = DateFilterUtil.filterByDateRange(rawData, 'date', dateRange);

        // Convert to AG Chart format
        return {
            dates: filteredData.map((item: any) => item.date),
            values: [{
                label: metricInfo.description,
                values: filteredData.map((item: any) => item.value)
            }]
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Strategy for slicing grouped series data
 */
export class GroupedSeriesSlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo, dateRange?: string): ChartData {
        // Handle nested path metrics (like dataBySalesConnectors.grossSales)
        if (metricInfo.keyPath && metricInfo.keyPath.includes('.')) {
            return this.sliceNestedGroupedSeries(data, metricInfo, dateRange);
        }

        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || !rawData.dates || !rawData.values) {
            return { dates: [], values: [] };
        }

        // Filter by date range if specified
        let dates = rawData.dates;
        let values = rawData.values;

        if (dateRange) {
            const filteredIndices = DateFilterUtil.getDateIndicesInRange(dates, dateRange);
            dates = filteredIndices.map(i => dates[i]);
            values = values.map((series: any) => ({
                label: series.label,
                values: filteredIndices.map(i => series.values[i])
            }));
        }

        return { dates, values };
    }

    private sliceNestedGroupedSeries(data: any, metricInfo: MetricInfo, dateRange?: string): ChartData {
        const pathParts = metricInfo.keyPath!.split('.');
        const containerPath = pathParts.slice(0, -1).join('.');
        const metricKey = pathParts[pathParts.length - 1];

        const containerData = this.getNestedValue(data, containerPath);

        if (!Array.isArray(containerData)) {
            return { dates: [], values: [] };
        }

        // Special case: If this is a time series array (has date/value objects) and we're extracting 'value'
        // then convert it to proper time series format instead of treating as grouped series
        if (metricKey === 'value' && containerData.length > 0 &&
            containerData[0].date && containerData[0].value !== undefined) {

            // Filter by date range if specified
            const filteredData = DateFilterUtil.filterByDateRange(containerData, 'date', dateRange);

            // Return as time series format
            return {
                dates: filteredData.map((item: any) => item.date),
                values: [{
                    label: metricInfo.description,
                    values: filteredData.map((item: any) => item.value)
                }]
            };
        }

        // Original logic for true grouped series (like dataBySalesConnectors)
        const categories = containerData.map(item => item.connector || item.label || item.name || 'Unknown');
        const values = containerData.map(item => (item as any)[metricKey] || 0);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: values
            }]
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Strategy for slicing scalar data
 */
export class ScalarSlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo): ChartData {
        const value = this.getNestedValue(data, metricInfo.name);

        return {
            dates: ['Total'],
            values: [{
                label: metricInfo.description,
                values: [value]
            }]
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Strategy for slicing dynamic key objects (like cashDetails, creditCardDetails)
 */
export class DynamicKeyObjectSlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo): ChartData {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || typeof rawData !== 'object') {
            return { dates: [], values: [] };
        }

        const entries = Object.entries(rawData);
        if (entries.length === 0) {
            return { dates: [], values: [] };
        }

        // If this is a container metric, return summary of all accounts
        if (!metricInfo.keyPath?.includes('.') || metricInfo.keyPath.split('.').length === 1) {
            const categories = entries.map(([key, value]: [string, any]) =>
                value.name || value.officialName || key
            );

            // Get the first numeric property as the default metric
            const firstEntry = entries[0][1];
            const firstNumericKey = Object.keys(firstEntry).find(key =>
                typeof (firstEntry as any)[key] === 'number'
            );

            if (!firstNumericKey) {
                return { dates: [], values: [] };
            }

            const values = entries.map(([_, value]: [string, any]) => (value as any)[firstNumericKey] || 0);

            return {
                dates: categories,
                values: [{
                    label: `${firstNumericKey} by account`,
                    values: values
                }]
            };
        }

        // If this is a specific metric within the dynamic object
        const pathParts = metricInfo.keyPath.split('.');
        const metricKey = pathParts[pathParts.length - 1];

        const categories = entries.map(([key, value]: [string, any]) =>
            value.name || value.officialName || key
        );
        const values = entries.map(([_, value]: [string, any]) => (value as any)[metricKey] || 0);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: values
            }]
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Strategy for slicing embedded metrics (like dataBySalesConnectors)
 */
export class EmbeddedMetricsSlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo): ChartData {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            return { dates: [], values: [] };
        }

        // Improved category extraction with better fallbacks
        const categories = rawData.map((item, index) => {
            const label = item.connector || item.label || item.name;

            // If we still don't have a good label, try to extract from other fields
            if (!label || label.toLowerCase().includes('unknown')) {
                // Look for other meaningful identifiers
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

        // Get all numeric keys from the first item
        const firstItem = rawData[0];
        const numericKeys = Object.keys(firstItem).filter(key =>
            typeof firstItem[key] === 'number' && key !== 'date'
        );

        if (numericKeys.length === 0) {
            return { dates: [], values: [] };
        }

        // Create series for each numeric metric
        const values = numericKeys.map(key => ({
            label: key,
            values: rawData.map(item => (item as any)[key] || 0)
        }));

        return {
            dates: categories,
            values: values
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Strategy for slicing simple arrays
 */
export class ArraySlicingStrategy implements SlicingStrategy {
    slice(data: any, metricInfo: MetricInfo): ChartData {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            return { dates: [], values: [] };
        }

        // Generate simple indices as categories (Item 1, Item 2, etc.)
        const categories = rawData.map((_, index) => `Item ${index + 1}`);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: rawData.map(value => typeof value === 'number' ? value : 0)
            }]
        };
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

/**
 * Main chart data slicer that uses strategy pattern to handle different metric types
 */
@Injectable()
export class ChartDataSlicerService {
    private strategies = new Map<string, SlicingStrategy>([
        ['timeSeries', new TimeSeriesSlicingStrategy()],
        ['groupedSeries', new GroupedSeriesSlicingStrategy()],
        ['scalar', new ScalarSlicingStrategy()],
        ['dynamicKeyObject', new DynamicKeyObjectSlicingStrategy()],
        ['embeddedMetrics', new EmbeddedMetricsSlicingStrategy()],
        ['array', new ArraySlicingStrategy()]
    ]);

    /**
     * Slice metric data based on the metric type using appropriate strategy
     * @param data - Raw data from API
     * @param metricInfo - Information about the metric to slice
     * @param dateRange - Optional date range filter
     * @returns Formatted chart data ready for visualization
     */
    slice(data: any, metricInfo: MetricInfo, dateRange?: string): ChartData {
        const strategy = this.strategies.get(metricInfo.type);

        if (!strategy) {
            throw new Error(`Unsupported metric type: ${metricInfo.type}`);
        }

        return strategy.slice(data, metricInfo, dateRange);
    }

    /**
     * Add or update a slicing strategy for a metric type
     * @param metricType - The metric type to register strategy for
     * @param strategy - The slicing strategy implementation
     */
    registerStrategy(metricType: string, strategy: SlicingStrategy): void {
        this.strategies.set(metricType, strategy);
    }

    /**
     * Get available metric types that can be sliced
     * @returns Array of supported metric types
     */
    getSupportedMetricTypes(): string[] {
        return Array.from(this.strategies.keys());
    }
}