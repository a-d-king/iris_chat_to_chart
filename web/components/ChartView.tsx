import React from 'react';
import { AgChartsReact } from 'ag-charts-react';

interface ChartViewProps {
    spec: any;
}

/**
 * Format values based on metric type for proper display
 */
const formatValue = (value: number, metric: string): string => {
    // Currency metrics
    if (metric.toLowerCase().includes('sales') ||
        metric.toLowerCase().includes('revenue') ||
        metric.toLowerCase().includes('profit') ||
        metric.toLowerCase().includes('cost') ||
        metric.toLowerCase().includes('expense') ||
        metric.toLowerCase().includes('cash') ||
        metric.toLowerCase().includes('balance') ||
        metric.toLowerCase().includes('margin') && !metric.toLowerCase().includes('percentage')) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    }

    // Percentage metrics
    if (metric.toLowerCase().includes('percentage') ||
        metric.toLowerCase().includes('rate') ||
        metric.toLowerCase().includes('margin') && metric.toLowerCase().includes('percentage')) {
        return `${value.toFixed(2)}%`;
    }

    // Order/count metrics
    if (metric.toLowerCase().includes('order') ||
        metric.toLowerCase().includes('count') ||
        metric.toLowerCase().includes('customer')) {
        return new Intl.NumberFormat('en-US').format(Math.round(value));
    }

    // Default numeric formatting
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value);
};

/**
 * ChartView component for rendering charts using ag-charts-react
 * Takes a chart specification and renders the appropriate chart type
 */
export default function ChartView({ spec }: ChartViewProps) {
    if (!spec) {
        return (
            <div style={{
                padding: 20,
                textAlign: 'center',
                color: '#666',
                border: '2px dashed #ddd',
                borderRadius: 8,
                marginTop: 20
            }}>
                <p>No chart to display. Ask for a chart using the input above!</p>
                <p style={{ fontSize: 12 }}>
                    Try: "Show me revenue trends for 2023" or "Display user counts by region"
                </p>
            </div>
        );
    }

    const { chartType, data, metric, groupBy, dateRange, originalPrompt } = spec;

    // Super-basic mapping of data to chart format with proper value formatting
    // This assumes your data has a structure like:
    // { dates: ['2023-01', '2023-02', ...], values: [{ label: 'Revenue', values: [100, 120, ...] }] }
    const chartData = data.dates ?
        data.dates.map((date: string, index: number) => {
            const dataPoint: any = {
                date: new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            };

            // Add values for each series with original numeric values (formatting handled by tooltips)
            if (data.values && Array.isArray(data.values)) {
                data.values.forEach((series: any) => {
                    dataPoint[series.label] = series.values[index];
                });
            }

            return dataPoint;
        }) : [];

    // Configure chart series based on chart type and data structure
    const series = data.values && Array.isArray(data.values)
        ? data.values.map((series: any) => ({
            type: chartType === 'stacked-bar' ? 'bar' : chartType,
            xKey: 'date',
            yKey: series.label,
            yName: series.label,
            stacked: chartType === 'stacked-bar'
        }))
        : [{
            type: chartType === 'stacked-bar' ? 'bar' : chartType,
            xKey: 'date',
            yKey: 'value',
            yName: metric
        }];

    // Chart options for ag-charts (simplified to avoid TypeScript conflicts)
    const chartOptions = {
        data: chartData,
        series: series,
        title: {
            text: `${metric} ${groupBy ? `by ${groupBy}` : ''} (${dateRange})`
        }
    };

    return (
        <div style={{
            marginTop: 20,
            padding: 20,
            border: '1px solid #ddd',
            borderRadius: 8,
            backgroundColor: '#fff'
        }}>
            {/* User Prompt Display */}
            {originalPrompt && (
                <div style={{
                    marginBottom: 16,
                    padding: 16,
                    backgroundColor: '#f8f9fa',
                    borderRadius: 6,
                    borderLeft: '4px solid #007bff'
                }}>
                    <div style={{
                        fontSize: 12,
                        color: '#6c757d',
                        marginBottom: 4,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        User Request
                    </div>
                    <div style={{
                        fontSize: 16,
                        color: '#495057',
                        fontStyle: 'italic'
                    }}>
                        "{originalPrompt}"
                    </div>
                </div>
            )}

            {/* Chart Metadata */}
            <div style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: '#f0f8ff',
                borderRadius: 4,
                fontSize: 14
            }}>
                <strong>Chart Type:</strong> {chartType} |
                <strong> Metric:</strong> {metric} |
                <strong> Date Range:</strong> {dateRange}
                {groupBy && <span> | <strong>Grouped by:</strong> {groupBy}</span>}
            </div>

            {/* Chart with Formatted Data */}
            <div style={{ height: 400 }}>
                <AgChartsReact options={chartOptions} />
            </div>

            {/* Data Formatting Legend */}
            <div style={{
                marginTop: 12,
                padding: 8,
                backgroundColor: '#f8f9fa',
                borderRadius: 4,
                fontSize: 12,
                color: '#6c757d'
            }}>
                <strong>Data Formatting:</strong> {
                    metric.toLowerCase().includes('sales') ||
                        metric.toLowerCase().includes('profit') ||
                        metric.toLowerCase().includes('revenue') ||
                        metric.toLowerCase().includes('cost') ||
                        metric.toLowerCase().includes('cash') ? 'Currency (USD)' :
                        metric.toLowerCase().includes('percentage') ||
                            metric.toLowerCase().includes('rate') ? 'Percentage (%)' :
                            metric.toLowerCase().includes('order') ||
                                metric.toLowerCase().includes('count') ||
                                metric.toLowerCase().includes('customer') ? 'Count (whole numbers)' :
                                'Numeric values'
                }
            </div>
        </div>
    );
} 