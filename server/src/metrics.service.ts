import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

/**
 * Service for handling metrics data operations
 * Loads and processes data from metrics.json file
 */
@Injectable()
export class MetricsService {
    private cache: any; // Cache to avoid re-reading the file on every request

    /**
     * Load metrics data from metrics.json file
     * Uses caching to improve performance
     * @returns Promise<any> - The loaded metrics data
     */
    async load() {
        if (!this.cache) {
            try {
                const raw = await fs.readFile(
                    path.join(__dirname, '..', 'metrics.json'),
                    'utf-8'
                );
                this.cache = JSON.parse(raw);
            } catch (error) {
                console.error('Error loading metrics.json:', error);
                throw new Error('Failed to load metrics data');
            }
        }
        return this.cache;
    }

    /**
     * Slice metrics data based on the specified parameters
     * This is a naive implementation - adjust based on your actual JSON structure
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY or YYYY-MM)
     * @param groupBy - Optional grouping dimension
     * @returns Promise<any> - The sliced data ready for charting
     */
    async slice(metric: string, dateRange: string, groupBy?: string) {
        const data = await this.load();

        // Super-naïve slice: adjust to your JSON shape
        // This assumes your metrics.json has properties like:
        // - revenueByRegion, usersByCountry (when groupBy is provided)
        // - revenueSeries, usersSeries (when no groupBy)

        if (groupBy) {
            const key = `${metric}By${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`;
            return data[key] || [];
        }

        const seriesKey = metric + 'Series';
        return data[seriesKey] || [];
    }
} 