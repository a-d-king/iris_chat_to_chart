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
 * Format text for proper title display - converts camelCase/snake_case to Title Case
 */
const formatTitle = (text: string): string => {
    return text
        // Handle camelCase by adding spaces before capital letters
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Handle snake_case and kebab-case by replacing _ and - with spaces
        .replace(/[_-]/g, ' ')
        // Capitalize first letter of each word
        .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * ChartView component for rendering charts using ag-charts-react
 * Takes a chart specification and renders the appropriate chart type
 */
export default function ChartView({ spec }: ChartViewProps) {
    if (!spec) {
        return (
            <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#6b7280',
                background: 'linear-gradient(135deg, #f8faff 0%, #f1f5f9 100%)',
                borderRadius: 12,
                margin: 20
            }}>
                <div style={{
                    width: 80,
                    height: 80,
                    backgroundColor: '#e5e7eb',
                    borderRadius: '50%',
                    margin: '0 auto 20px auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32
                }}>
                    📊
                </div>
                <h3 style={{
                    fontSize: 20,
                    fontWeight: '600',
                    color: '#7c3aed',
                    margin: '0 0 12px 0'
                }}>
                    No chart to display
                </h3>
            </div>
        );
    }

    const { chartType, data, metric, groupBy, dateRange, originalPrompt } = spec;

    const chartData = data.dates ?
        data.dates.map((date: string, index: number) => {
            const dataPoint: any = {
                date: new Date(date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                })
            };

            if (data.values && Array.isArray(data.values)) {
                data.values.forEach((series: any) => {
                    dataPoint[series.label] = series.values[index];
                });
            }

            return dataPoint;
        }) : [];

    const series = data.values && Array.isArray(data.values)
        ? data.values.map((series: any, index: number) => {
            const basicColors = [
                '#dc2626', // Red
                '#2563eb', // Blue
                '#eab308', // Yellow
                '#ea580c', // Orange
                '#16a34a', // Green
                '#9333ea', // Purple
                '#06b6d4', // Cyan
                '#e11d48', // Pink/Rose
                '#84cc16', // Lime
                '#0891b2', // Sky Blue
                '#f59e0b', // Amber
                '#7c3aed'  // Violet
            ];
            return {
                type: chartType === 'stacked-bar' ? 'bar' : chartType,
                xKey: 'date',
                yKey: series.label,
                yName: series.label,
                stacked: chartType === 'stacked-bar',
                fill: basicColors[index % basicColors.length],
                stroke: basicColors[index % basicColors.length],
                strokeWidth: 2
            };
        })
        : [{
            type: chartType === 'stacked-bar' ? 'bar' : chartType,
            xKey: 'date',
            yKey: 'value',
            yName: metric,
            fill: '#2563eb',
            stroke: '#2563eb',
            strokeWidth: 2
        }];

    const chartOptions = {
        data: chartData,
        series: series.map((s: any) => ({
            ...s,
            tooltip: {
                renderer: (params: any) => {
                    const { datum, yKey } = params;
                    const value = datum[yKey];
                    return {
                        title: s.yName || yKey,
                        content: formatValue(value, metric)
                    };
                }
            }
        })),
        title: {
            text: `${formatTitle(metric)} ${groupBy ? `by ${formatTitle(groupBy)}` : ''} (${dateRange})`
        },
        background: {
            fill: 'white'
        },
        axes: [
            {
                type: 'category',
                position: 'bottom'
            },
            {
                type: 'number',
                position: 'left',
                label: {
                    formatter: ({ value }: any) => formatValue(value, metric)
                }
            }
        ]
    };

    return (
        <div>
            {/* Header with AI indicator */}
            <div style={{
                padding: 20,
                borderBottom: '2px solid #7c3aed',
                backgroundColor: '#f8faff'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 12
                }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        backgroundColor: '#7c3aed',
                        borderRadius: '50%',
                        color: 'white',
                        fontSize: 16,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12
                    }}>
                        🤖
                    </div>
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#7c3aed',
                        margin: 0
                    }}>
                        AI-Generated Chart
                    </h3>
                </div>

                {/* User Prompt Display */}
                {originalPrompt && (
                    <div style={{
                        padding: 16,
                        backgroundColor: 'white',
                        borderRadius: 8,
                        border: '1px solid #e5e7eb',
                        borderLeft: '4px solid #7c3aed'
                    }}>
                        <div style={{
                            fontSize: 12,
                            color: '#6b7280',
                            marginBottom: 4,
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Your Request
                        </div>
                        <div style={{
                            fontSize: 16,
                            color: '#374151',
                            fontStyle: 'italic',
                            fontWeight: '500'
                        }}>
                            "{originalPrompt}"
                        </div>
                    </div>
                )}
            </div>

            {/* Chart Metadata */}
            <div style={{
                padding: 16,
                backgroundColor: '#f8faff',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 16,
                    fontSize: 14
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            width: 12,
                            height: 12,
                            backgroundColor: '#7c3aed',
                            borderRadius: '50%',
                            marginRight: 8
                        }}></span>
                        <strong style={{ color: '#7c3aed' }}>Chart Type:</strong>
                        <span style={{ color: '#374151', marginLeft: 4 }}>{chartType}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            width: 12,
                            height: 12,
                            backgroundColor: '#9333ea',
                            borderRadius: '50%',
                            marginRight: 8
                        }}></span>
                        <strong style={{ color: '#7c3aed' }}>Metric:</strong>
                        <span style={{ color: '#374151', marginLeft: 4 }}>{metric}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                            width: 12,
                            height: 12,
                            backgroundColor: '#a855f7',
                            borderRadius: '50%',
                            marginRight: 8
                        }}></span>
                        <strong style={{ color: '#7c3aed' }}>Period:</strong>
                        <span style={{ color: '#374151', marginLeft: 4 }}>{dateRange}</span>
                    </div>
                    {groupBy && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                width: 12,
                                height: 12,
                                backgroundColor: '#c084fc',
                                borderRadius: '50%',
                                marginRight: 8
                            }}></span>
                            <strong style={{ color: '#7c3aed' }}>Grouped by:</strong>
                            <span style={{ color: '#374151', marginLeft: 4 }}>{groupBy}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart with White Background */}
            <div style={{
                height: 450,
                padding: 20,
                backgroundColor: 'white'
            }}>
                <AgChartsReact options={chartOptions} />
            </div>

            {/* Data Formatting Legend */}
            <div style={{
                padding: 16,
                backgroundColor: '#f8faff',
                borderTop: '1px solid #e5e7eb',
                fontSize: 13,
                color: '#6b7280'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 8
                }}>
                    <div style={{
                        width: 20,
                        height: 20,
                        backgroundColor: '#7c3aed',
                        borderRadius: 4,
                        marginRight: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 'bold'
                    }}>
                        i
                    </div>
                    <strong style={{ color: '#7c3aed' }}>Data Formatting:</strong>
                </div>
                <div style={{ marginLeft: 28 }}>
                    {
                        metric.toLowerCase().includes('sales') ||
                            metric.toLowerCase().includes('profit') ||
                            metric.toLowerCase().includes('revenue') ||
                            metric.toLowerCase().includes('cost') ||
                            metric.toLowerCase().includes('cash') ? 'Currency values displayed in USD format' :
                            metric.toLowerCase().includes('percentage') ||
                                metric.toLowerCase().includes('rate') ? 'Percentage values with 2 decimal places' :
                                metric.toLowerCase().includes('order') ||
                                    metric.toLowerCase().includes('count') ||
                                    metric.toLowerCase().includes('customer') ? 'Count values as whole numbers' :
                                    'Numeric values with up to 2 decimal places'
                    }
                </div>
            </div>
        </div>
    );
} 