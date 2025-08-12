import { Injectable } from '@nestjs/common';
import { DataAnalysis } from '../data-analysis.service';
import { IntentAnalysis } from './intent-analyzer.service';

/**
 * Interface for chart ranking results
 */
export interface ChartRanking {
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';
    score: number;
    confidence: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    dataCompatibility: number;
    intentAlignment: number;
    visualEffectiveness: number;
    usabilityScore: number;
}

export interface TopKChartsAnalysis {
    rankings: ChartRanking[];
    topK: ChartRanking[];
    recommendedChart: ChartRanking;
    alternativeCharts: ChartRanking[];
    analysisMetadata: {
        totalScored: number;
        confidenceThreshold: number;
        scoringCriteria: string[];
    };
}

/**
 * Service responsible for ranking and selecting optimal chart types
 * Extracted from ReasoningService for better separation of concerns
 */
@Injectable()
export class ChartRankerService {

    /**
     * Generate top K chart recommendations with systematic ranking
     * @param prompt - User's natural language prompt
     * @param dataAnalysis - Available data analysis results
     * @param k - Number of top charts to return
     * @param intentAnalysis - Optional intent analysis for better scoring
     * @returns Comprehensive chart ranking analysis
     */
    generateTopKCharts(
        prompt: string,
        dataAnalysis: DataAnalysis,
        k: number = 5,
        intentAnalysis?: IntentAnalysis
    ): TopKChartsAnalysis {
        const availableCharts: ('line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall')[] =
            ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'];

        const rankings: ChartRanking[] = [];

        // Score each chart type
        for (const chartType of availableCharts) {
            const ranking = this.scoreChartType(chartType, prompt, dataAnalysis, intentAnalysis);
            rankings.push(ranking);
        }

        // Sort by score (descending)
        rankings.sort((a, b) => b.score - a.score);

        // Get top K
        const topK = rankings.slice(0, k);
        const recommendedChart = rankings[0];
        const alternativeCharts = rankings.slice(1, 4); // Top 2-4 as alternatives

        return {
            rankings,
            topK,
            recommendedChart,
            alternativeCharts,
            analysisMetadata: {
                totalScored: rankings.length,
                confidenceThreshold: 0.6,
                scoringCriteria: [
                    'Data compatibility',
                    'Intent alignment',
                    'Visual effectiveness',
                    'Usability score'
                ]
            }
        };
    }

    /**
     * Score a specific chart type based on multiple criteria
     * @param chartType - Chart type to score
     * @param prompt - User's natural language prompt
     * @param dataAnalysis - Available data analysis results
     * @param intentAnalysis - Optional intent analysis for better scoring
     * @returns Detailed chart ranking with scores and reasoning
     */
    private scoreChartType(
        chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall',
        prompt: string,
        dataAnalysis: DataAnalysis,
        intentAnalysis?: IntentAnalysis
    ): ChartRanking {
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Score data compatibility (0-1)
        const dataCompatibility = this.scoreDataCompatibility(chartType, dataAnalysis);

        // Score intent alignment (0-1)
        const intentAlignment = this.scoreIntentAlignment(chartType, prompt, intentAnalysis);

        // Score visual effectiveness (0-1)
        const visualEffectiveness = this.scoreVisualEffectiveness(chartType, dataAnalysis);

        // Score usability (0-1)
        const usabilityScore = this.scoreUsability(chartType, dataAnalysis);

        // Calculate overall score (weighted average)
        const weights = {
            data: 0.3,
            intent: 0.35,
            visual: 0.2,
            usability: 0.15
        };

        const score = (
            dataCompatibility * weights.data +
            intentAlignment * weights.intent +
            visualEffectiveness * weights.visual +
            usabilityScore * weights.usability
        );

        // Generate reasoning and strengths/weaknesses
        const { reasoning, chartStrengths, chartWeaknesses } = this.generateChartReasoning(
            chartType, dataCompatibility, intentAlignment, visualEffectiveness, usabilityScore, dataAnalysis
        );

        strengths.push(...chartStrengths);
        weaknesses.push(...chartWeaknesses);

        // Calculate confidence based on score and data quality
        const confidence = Math.min(score + 0.1, 1.0) * (dataAnalysis.availableMetrics.length > 0 ? 1.0 : 0.8);

        return {
            chartType,
            score,
            confidence,
            reasoning,
            strengths,
            weaknesses,
            dataCompatibility,
            intentAlignment,
            visualEffectiveness,
            usabilityScore
        };
    }

    /**
     * Score how well a chart type fits the available data
     */
    private scoreDataCompatibility(chartType: string, dataAnalysis: DataAnalysis): number {
        const metrics = dataAnalysis.availableMetrics;
        let score = 0.5; // Base score

        const timeSeriesMetrics = metrics.filter(m => m.hasTimeData);
        const groupedMetrics = metrics.filter(m => m.hasGrouping);
        const scalarMetrics = metrics.filter(m => m.type === 'scalar');

        switch (chartType) {
            case 'line':
                if (timeSeriesMetrics.length > 0) score += 0.4;
                if (timeSeriesMetrics.length > 2) score += 0.1; // Multiple time series
                if (groupedMetrics.length === 0) score -= 0.2; // No grouping reduces line chart value
                break;

            case 'bar':
                if (scalarMetrics.length > 0 || groupedMetrics.length > 0) score += 0.3;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) <= 8)) score += 0.2;
                if (scalarMetrics.length > 5) score -= 0.1; // Too many scalars for simple bar
                break;

            case 'stacked-bar':
                if (groupedMetrics.length > 0) score += 0.4;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) >= 2 && (m.groupingDimensions?.length || 0) <= 6)) score += 0.2;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) > 8)) score -= 0.3; // Too many categories
                break;

            case 'heatmap':
                if (groupedMetrics.length > 0 && timeSeriesMetrics.length > 0) score += 0.3;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) > 3)) score += 0.2;
                if (metrics.length < 3) score -= 0.2; // Not enough data for heatmap
                break;

            case 'waterfall':
                if (timeSeriesMetrics.length > 0) score += 0.2;
                if (metrics.some(m => m.name.toLowerCase().includes('change') || m.name.toLowerCase().includes('delta'))) score += 0.3;
                if (scalarMetrics.length > 0) score += 0.1;
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score how well a chart type aligns with user intent
     */
    private scoreIntentAlignment(chartType: string, prompt: string, intentAnalysis?: IntentAnalysis): number {
        let score = 0.5; // Base score
        const promptLower = prompt.toLowerCase();

        // Use intentAnalysis if available
        if (intentAnalysis) {
            const primaryIntent = intentAnalysis.primaryIntent.type;

            switch (chartType) {
                case 'line':
                    if (primaryIntent === 'temporal_trend') score += 0.4;
                    if (intentAnalysis.temporalSignals.some(s => s.type === 'trend')) score += 0.2;
                    if (primaryIntent === 'categorical_comparison') score -= 0.1;
                    break;

                case 'bar':
                    if (primaryIntent === 'categorical_comparison') score += 0.4;
                    if (primaryIntent === 'performance_overview') score += 0.2;
                    if (intentAnalysis.comparisonSignals.length > 0) score += 0.2;
                    break;

                case 'stacked-bar':
                    if (primaryIntent === 'compositional_breakdown') score += 0.4;
                    if (primaryIntent === 'categorical_comparison') score += 0.2;
                    if (intentAnalysis.aggregationLevel === 'detailed') score += 0.1;
                    break;

                case 'heatmap':
                    if (primaryIntent === 'correlation_analysis') score += 0.4;
                    if (primaryIntent === 'anomaly_detection') score += 0.3;
                    if (intentAnalysis.aggregationLevel === 'detailed') score += 0.1;
                    break;

                case 'waterfall':
                    if (primaryIntent === 'temporal_trend' && intentAnalysis.temporalSignals.some(s => s.type === 'growth_analysis')) score += 0.3;
                    if (promptLower.includes('impact') || promptLower.includes('change')) score += 0.2;
                    break;
            }
        } else {
            // Fallback to keyword matching if no intentAnalysis
            switch (chartType) {
                case 'line':
                    if (promptLower.match(/trend|over time|growth|decline/)) score += 0.3;
                    break;
                case 'bar':
                    if (promptLower.match(/compare|vs|versus|against/)) score += 0.3;
                    break;
                case 'stacked-bar':
                    if (promptLower.match(/breakdown|composition|by/)) score += 0.3;
                    break;
                case 'heatmap':
                    if (promptLower.match(/pattern|correlation|relationship/)) score += 0.3;
                    break;
                case 'waterfall':
                    if (promptLower.match(/impact|change|effect/)) score += 0.3;
                    break;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score visual effectiveness of chart type for given data
     */
    private scoreVisualEffectiveness(chartType: string, dataAnalysis: DataAnalysis): number {
        let score = 0.6; // Base effectiveness score
        const metrics = dataAnalysis.availableMetrics;

        switch (chartType) {
            case 'line':
                // Lines are excellent for trends but poor for categories without time
                if (metrics.some(m => m.hasTimeData)) score += 0.3;
                if (metrics.filter(m => m.hasTimeData).length > 1) score += 0.1; // Multiple trends
                break;

            case 'bar':
                // Bars are versatile and generally effective
                score += 0.2;
                if (metrics.some(m => m.hasGrouping && (m.groupingDimensions?.length || 0) <= 10)) score += 0.1;
                break;

            case 'stacked-bar':
                // Stacked bars excellent for composition but can be cluttered
                if (metrics.some(m => m.hasGrouping && (m.groupingDimensions?.length || 0) >= 2)) score += 0.2;
                if (metrics.some(m => (m.groupingDimensions?.length || 0) > 6)) score -= 0.2; // Too cluttered
                break;

            case 'heatmap':
                // Heatmaps great for patterns but need sufficient data
                if (metrics.length >= 3) score += 0.2;
                if (metrics.some(m => m.hasGrouping && m.hasTimeData)) score += 0.2;
                if (metrics.length < 2) score -= 0.3; // Insufficient for heatmap
                break;

            case 'waterfall':
                // Waterfalls are specialized but very effective for the right data
                if (metrics.some(m => m.name.toLowerCase().includes('change'))) score += 0.3;
                else score -= 0.1; // Less effective without change data
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score usability and interpretability of chart type
     */
    private scoreUsability(chartType: string, dataAnalysis: DataAnalysis): number {
        let score = 0.7; // Base usability score

        switch (chartType) {
            case 'line':
                score += 0.2; // Generally easy to read
                break;
            case 'bar':
                score += 0.3; // Very intuitive
                break;
            case 'stacked-bar':
                score += 0.1; // Somewhat more complex
                if (dataAnalysis.availableMetrics.some(m => (m.groupingDimensions?.length || 0) > 5)) {
                    score -= 0.2; // More complex with many categories
                }
                break;
            case 'heatmap':
                score -= 0.1; // Requires more interpretation
                break;
            case 'waterfall':
                score += 0.0; // Specialized but clear when appropriate
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Generate detailed reasoning for chart selection
     */
    private generateChartReasoning(
        chartType: string,
        dataCompatibility: number,
        intentAlignment: number,
        visualEffectiveness: number,
        usabilityScore: number,
        dataAnalysis: DataAnalysis
    ): { reasoning: string; chartStrengths: string[]; chartWeaknesses: string[] } {
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        let reasoning = `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart analysis: `;

        // Data compatibility reasoning
        if (dataCompatibility > 0.8) {
            reasoning += 'Excellent data compatibility. ';
            strengths.push('Perfect fit for data structure');
        } else if (dataCompatibility > 0.6) {
            reasoning += 'Good data compatibility. ';
            strengths.push('Compatible with data structure');
        } else {
            reasoning += 'Limited data compatibility. ';
            weaknesses.push('Data structure not optimal for this chart type');
        }

        // Intent alignment reasoning
        if (intentAlignment > 0.8) {
            reasoning += 'Strong alignment with user intent. ';
            strengths.push('Directly addresses user requirements');
        } else if (intentAlignment > 0.6) {
            reasoning += 'Moderate alignment with intent. ';
        } else {
            reasoning += 'Weak intent alignment. ';
            weaknesses.push('Does not strongly address user intent');
        }

        // Visual effectiveness reasoning
        if (visualEffectiveness > 0.8) {
            strengths.push('Highly effective visualization');
        } else if (visualEffectiveness < 0.5) {
            weaknesses.push('Limited visual effectiveness for this data');
        }

        // Usability reasoning
        if (usabilityScore > 0.8) {
            strengths.push('Easy to interpret and understand');
        } else if (usabilityScore < 0.6) {
            weaknesses.push('May require more interpretation');
        }

        // Chart-specific strengths and weaknesses
        switch (chartType) {
            case 'line':
                if (dataAnalysis.availableMetrics.some(m => m.hasTimeData)) {
                    strengths.push('Excellent for showing trends over time');
                } else {
                    weaknesses.push('Less effective without temporal data');
                }
                break;
            case 'bar':
                strengths.push('Simple and intuitive comparisons');
                break;
            case 'stacked-bar':
                strengths.push('Shows both totals and composition');
                if (dataAnalysis.availableMetrics.some(m => (m.groupingDimensions?.length || 0) > 6)) {
                    weaknesses.push('May be cluttered with many categories');
                }
                break;
            case 'heatmap':
                strengths.push('Reveals complex patterns and correlations');
                weaknesses.push('Requires more cognitive effort to interpret');
                break;
            case 'waterfall':
                strengths.push('Perfect for showing cumulative changes');
                weaknesses.push('Specialized use case - not suitable for all data');
                break;
        }

        return {
            reasoning: reasoning.trim(),
            chartStrengths: strengths,
            chartWeaknesses: weaknesses
        };
    }
}