import React from 'react';
import { AgChartsReact } from 'ag-charts-react';

interface ChartViewProps {
    spec: any;
}

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

    const { chartType, data, metric, groupBy, dateRange } = spec;

    // Super-basic mapping of data to chart format
    // This assumes your data has a structure like:
    // { dates: ['2023-01', '2023-02', ...], values: [{ label: 'Revenue', values: [100, 120, ...] }] }
    const chartData = data.dates ?
        data.dates.map((date: string, index: number) => {
            const dataPoint: any = { date };

            // Add values for each series
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

    // Chart options for ag-charts
    const chartOptions = {
        data: chartData,
        series: series,
        title: {
            text: `${metric} ${groupBy ? `by ${groupBy}` : ''} (${dateRange})`
        },
        axes: [
            {
                type: 'category',
                position: 'bottom',
                title: { text: 'Date' }
            },
            {
                type: 'number',
                position: 'left',
                title: { text: metric }
            }
        ]
    };

    return (
        <div style={{
            marginTop: 20,
            padding: 20,
            border: '1px solid #ddd',
            borderRadius: 8,
            backgroundColor: '#fff'
        }}>
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

            <div style={{ height: 400 }}>
                <AgChartsReact options={chartOptions} />
            </div>
        </div>
    );
} 