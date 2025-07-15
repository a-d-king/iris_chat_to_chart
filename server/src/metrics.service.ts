import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { config } from './config';

/**
 * Service for handling metrics data operations with caching
 */
@Injectable()
export class MetricsService {
    private cache: any;
    private dataAnalysis: any;

    constructor(private dataAnalysisService: DataAnalysisService) { }

    /**
     * Load metrics data from available JSON file
     * Uses caching to improve performance
     * @returns Promise<any> - The loaded metrics data
     */
    async load() {
        if (!this.cache) {
            try {
                const raw = await fs.readFile(
                    path.join(__dirname, '..', 'sample-june-metrics.json'),
                    'utf-8'
                );
                console.log('📊 Using sample-june-metrics.json data');

                this.cache = JSON.parse(raw);

                this.dataAnalysis = this.dataAnalysisService.analyzeData(this.cache);
                console.log(`Detected ${this.dataAnalysis.availableMetrics.length} metrics in the dataset`);

            } catch (error) {
                console.error('Error loading metrics data:', error);
                throw new Error('Failed to load metrics data');
            }
        }
        return this.cache;
    }

    /**
     * Get data analysis results
     * @returns Data analysis including available metrics and suggestions
     */
    async getDataAnalysis() {
        await this.load(); // Ensure data is loaded
        return this.dataAnalysis;
    }

    /**
     * Slice metrics data based on the specified parameters
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY or YYYY-MM)
     * @param groupBy - Optional grouping dimension (unused in current implementation)
     * @returns Promise<any> - The sliced data ready for charting
     */
    async slice(metric: string, dateRange: string, groupBy?: string) {
        const data = await this.load();
        const analysis = this.dataAnalysis;

        // Find the matching metric
        const metricInfo = analysis.availableMetrics.find((m: MetricInfo) =>
            m.name.toLowerCase() === metric.toLowerCase()
        );

        if (!metricInfo) {
            throw new Error(`Metric "${metric}" not found in dataset`);
        }

        // Handle different data structures based on metric type
        switch (metricInfo.type) {
            case 'timeSeries':
                return this.sliceTimeSeries(data, metricInfo, dateRange);
            case 'groupedSeries':
                return this.sliceGroupedSeries(data, metricInfo, dateRange);
            case 'scalar':
                return this.sliceScalar(data, metricInfo);
            default:
                throw new Error(`Unsupported metric type: ${metricInfo.type}`);
        }
    }

    /**
     * Extract time series data
     */
    private sliceTimeSeries(data: any, metricInfo: MetricInfo, dateRange: string): any {
        const rawData = data[metricInfo.name];

        if (!rawData || !Array.isArray(rawData)) {
            return [];
        }

        // Filter by date range if specified
        let filteredData = rawData;
        if (dateRange && dateRange !== '2023') {
            filteredData = rawData.filter((item: any) => {
                if (dateRange.includes('-')) {
                    // Month-specific filter (e.g., "2025-06")
                    return item.date && item.date.startsWith(dateRange);
                } else {
                    // Year filter (e.g., "2025")
                    return item.date && item.date.startsWith(dateRange);
                }
            });
        }

        // Convert to chart format
        return {
            dates: filteredData.map((item: any) => item.date),
            values: [{
                label: metricInfo.description,
                values: filteredData.map((item: any) => item.value)
            }]
        };
    }

    /**
     * Extract grouped series data
     */
    private sliceGroupedSeries(data: any, metricInfo: MetricInfo, dateRange: string): any {
        const rawData = data[metricInfo.name];

        if (!rawData || !rawData.dates || !rawData.values) {
            return [];
        }

        // Filter by date range if specified
        let dates = rawData.dates;
        let values = rawData.values;

        if (dateRange && dateRange !== '2023') {
            const filteredIndices: number[] = [];
            dates.forEach((date: string, index: number) => {
                if (dateRange.includes('-')) {
                    if (date.startsWith(dateRange)) {
                        filteredIndices.push(index);
                    }
                } else {
                    if (date.startsWith(dateRange)) {
                        filteredIndices.push(index);
                    }
                }
            });

            dates = filteredIndices.map(i => dates[i]);
            values = values.map((series: any) => ({
                label: series.label,
                values: filteredIndices.map(i => series.values[i])
            }));
        }

        return {
            dates,
            values
        };
    }

    /**
     * Extract scalar data
     */
    private sliceScalar(data: any, metricInfo: MetricInfo) {
        const value = data[metricInfo.name];

        return {
            dates: ['Total'],
            values: [{
                label: metricInfo.description,
                values: [value]
            }]
        };
    }


} 