import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { config } from './config';

/**
 * Service for handling metrics data operations
 * Loads and processes data from metrics.json or sample-june-metrics.json file
 */
@Injectable()
export class MetricsService {
    private cache: any; // Cache to avoid re-reading the file on every request
    private dataAnalysis: any; // Cache for data analysis results

    constructor(private dataAnalysisService: DataAnalysisService) { }

    /**
     * Load metrics data from available JSON files
     * Tries sample-june-metrics.json first, then falls back to metrics.json
     * Uses caching to improve performance
     * @returns Promise<any> - The loaded metrics data
     */
    async load() {
        if (!this.cache) {
            try {
                // Try to load primary data file first
                let raw: string;
                try {
                    raw = await fs.readFile(
                        path.join(__dirname, '..', config.dataSource.primaryFile),
                        'utf-8'
                    );
                    console.log(`📊 Using ${config.dataSource.primaryFile} data`);
                } catch (primaryError) {
                    // Fall back to fallback file
                    raw = await fs.readFile(
                        path.join(__dirname, '..', config.dataSource.fallbackFile),
                        'utf-8'
                    );
                    console.log(`📊 Using ${config.dataSource.fallbackFile} data`);
                }

                this.cache = JSON.parse(raw);

                // Analyze the data structure
                this.dataAnalysis = this.dataAnalysisService.analyzeData(this.cache);
                console.log(`🔍 Detected ${this.dataAnalysis.availableMetrics.length} metrics in the dataset`);

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
     * Intelligently adapts to different data structures
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY or YYYY-MM)
     * @param groupBy - Optional grouping dimension
     * @returns Promise<any> - The sliced data ready for charting
     */
    async slice(metric: string, dateRange: string, groupBy?: string) {
        const data = await this.load();
        const analysis = this.dataAnalysis;

        // Find the best matching metric
        const metricInfo = analysis.availableMetrics.find((m: MetricInfo) =>
            m.name.toLowerCase() === metric.toLowerCase()
        );

        if (!metricInfo) {
            console.log(`❌ Metric "${metric}" not found, falling back to legacy logic`);
            return this.legacySlice(data, metric, dateRange, groupBy);
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
                return this.legacySlice(data, metric, dateRange, groupBy);
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

    /**
     * Legacy slice method for backward compatibility
     */
    private legacySlice(data: any, metric: string, dateRange: string, groupBy?: string) {
        if (groupBy) {
            const key = `${metric}By${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`;
            return data[key] || [];
        }

        const seriesKey = metric + 'Series';
        return data[seriesKey] || [];
    }
} 