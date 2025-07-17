import React from 'react';
import { AgChartsReact } from 'ag-charts-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Generate AG Grid column definitions based on the chart data structure
 */
const generateColumnDefs = (data: any[], metric: string) => {
    if (!data || data.length === 0) {
        return [];
    }

    const sampleRow = data[0];
    return Object.keys(sampleRow).map(key => ({
        field: key,
        headerName: formatTitle(key),
        sortable: true,
        filter: true,
        resizable: true,
        flex: 1,
        valueFormatter: (key === 'date' || key === 'index') ? undefined :
            (params: any) => {
                if (params.value == null) return '';
                // Check if it's a numeric value that should be formatted
                if (typeof params.value === 'number') {
                    return formatValue(params.value, metric);
                }
                return params.value;
            }
    }));
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
                date: (() => {
                    try {
                        // Handle different date formats
                        if (date.includes('-')) {
                            const [year, month, day] = date.split('-').map(Number);
                            if (year && month && day) {
                                const localDate = new Date(year, month - 1, day);
                                return localDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                });
                            }
                        }
                        // Fallback for other formats
                        return new Date(date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        });
                    } catch (error) {
                        console.warn('Date parsing error:', error, 'for date:', date);
                        return date;
                    }
                })()
            };

            if (data.values && Array.isArray(data.values)) {
                data.values.forEach((series: any) => {
                    dataPoint[series.label] = series.values[index];
                });
            }

            return dataPoint;
        }) : [];

    let gridData = chartData && chartData.length > 0 ? chartData : null;

    // If chartData is empty, try to process the raw backend data
    if (!gridData && data && data.dates && data.values) {
        // Convert backend format to grid format
        gridData = data.dates.map((date: string, index: number) => {
            const row: any = { date };

            // Add each series as a column
            if (Array.isArray(data.values)) {
                data.values.forEach((series: any) => {
                    if (series.label && series.values && series.values[index] !== undefined) {
                        row[series.label] = series.values[index];
                    }
                });
            }

            return row;
        });
    }

    // Configure series based on chart type
    const configureSeries = () => {
        if (chartType === 'heatmap') {
            // Heatmap requires special configuration
            if (!data.values || !Array.isArray(data.values) || data.values.length === 0) {
                console.warn('Heatmap requires grouped data with multiple series');
                // Fallback to bar chart for single metrics - this should be changed/improved
                return [{
                    type: 'bar',
                    xKey: 'date',
                    yKey: 'value',
                    yName: metric,
                    fill: '#2563eb',
                    stroke: '#2563eb',
                    strokeWidth: 2
                }];
            }

            return [{
                type: 'heatmap',
                xKey: 'date',
                yKey: 'category',
                colorKey: 'value',
                colorRange: ['#0891b2', '#f59e0b', '#dc2626'],
                colorName: metric
            }];
        }

        if (chartType === 'waterfall') {
            // Waterfall requires cumulative data structure
            return [{
                type: 'waterfall',
                xKey: 'date',
                yKey: 'value',
                yName: metric,
                fill: '#2563eb',
                stroke: '#2563eb',
                strokeWidth: 2
            }];
        }

        // Standard line/bar/stacked-bar configuration
        return data.values && Array.isArray(data.values)
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
    };

    const series = configureSeries();

    // Validate there is data to display
    if (!chartData || chartData.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded">
                <div className="text-center">
                    <div className="text-gray-500 text-lg mb-2">No Data Available</div>
                    <div className="text-gray-400 text-sm">
                        The requested metric "{metric}" doesn't contain any data for the specified date range.
                    </div>
                </div>
            </div>
        );
    }

    // Validate that series configuration is valid
    if (!series || series.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded">
                <div className="text-center">
                    <div className="text-gray-500 text-lg mb-2">Chart Configuration Error</div>
                    <div className="text-gray-400 text-sm">
                        Unable to configure chart for type "{chartType}" with the available data.
                    </div>
                </div>
            </div>
        );
    }

    // Configure axes based on chart type
    const configureAxes = () => {
        if (chartType === 'heatmap') {
            return [
                {
                    type: 'category',
                    position: 'bottom',
                    title: { text: 'Date' }
                },
                {
                    type: 'category',
                    position: 'left',
                    title: { text: 'Category' }
                }
            ];
        }

        return [
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
        ];
    };

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
        axes: configureAxes()
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

            {/* Data Table with AG Grid */}
            {gridData && gridData.length > 0 && (
                <div>
                    {/* Data Table Header */}
                    <div style={{
                        padding: 16,
                        backgroundColor: '#f8faff',
                        borderTop: '2px solid #7c3aed',
                        borderBottom: '1px solid #e5e7eb'
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
                                📊
                            </div>
                            <strong style={{ color: '#7c3aed', fontSize: 16 }}>Data Table</strong>
                        </div>
                        <div style={{
                            fontSize: 13,
                            color: '#6b7280'
                        }}>
                            Interactive table with sorting, filtering, and export capabilities
                        </div>
                    </div>

                    {/* AG Grid */}
                    <div className="ag-theme-alpine" style={{
                        height: 400,
                        backgroundColor: 'white'
                    }}>
                        <AgGridReact
                            rowData={gridData}
                            columnDefs={generateColumnDefs(gridData, metric)}
                            defaultColDef={{
                                sortable: true,
                                filter: true,
                                resizable: true,
                                flex: 1
                            }}
                            animateRows={true}
                            rowSelection="multiple"
                            suppressRowClickSelection={false}
                            pagination={true}
                            paginationPageSize={10}
                            domLayout="normal"
                        />
                    </div>
                </div>
            )}

            {(!gridData || gridData.length === 0) && (
                <div style={{
                    padding: 20,
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    margin: '16px 0',
                    textAlign: 'center'
                }}>
                    <strong style={{ color: '#dc2626' }}>⚠️ No Data Available for Table</strong>
                    <div style={{ marginTop: 8, fontSize: 14, color: '#7f1d1d' }}>
                        The chart is displaying but no tabular data could be processed. Check the debug info above.
                    </div>
                </div>
            )}

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