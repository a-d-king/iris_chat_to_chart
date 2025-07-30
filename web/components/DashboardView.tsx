import React from 'react';
import ChartView from './ChartView';

interface DashboardChart {
    id: string;
    chartType: string;
    title: string;
    metric: string;
    data: any;
    row: number;
    col: number;
    span: number;
    insights?: string[];
}

interface DashboardViewProps {
    dashboard: {
        dashboardId: string;
        charts: DashboardChart[];
        metadata: {
            totalCharts: number;
            responseTimeMs: number;
            suggestedInsights: string[];
            context?: {
                audience?: string;
                purpose?: string;
                updateFrequency?: string;
            };
            analysisType?: string;
        };
        requestId: string;
        originalPrompt: string;
    } | null;
}

export default function DashboardView({ dashboard }: DashboardViewProps) {
    if (!dashboard) {
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
                    No dashboard to display
                </h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                    Generate a dashboard with multiple charts using the form above
                </p>
            </div>
        );
    }

    const { charts, metadata, originalPrompt } = dashboard;

    return (
        <div>
            {/* Dashboard Header */}
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
                        📊
                    </div>
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: '600',
                        color: '#7c3aed',
                        margin: 0
                    }}>
                        {metadata.analysisType
                            ? `${metadata.analysisType.charAt(0).toUpperCase() + metadata.analysisType.slice(1)} Dashboard`
                            : 'AI-Generated Dashboard'} ({metadata.totalCharts} Charts)
                    </h3>
                </div>

                {/* User Prompt Display */}
                <div style={{
                    padding: 16,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    borderLeft: '4px solid #7c3aed',
                    marginBottom: 16
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

                {/* Context Information */}
                {metadata.context && (
                    <div style={{
                        padding: 12,
                        backgroundColor: '#fef3c7',
                        borderRadius: 8,
                        border: '1px solid #fcd34d',
                        marginBottom: 16
                    }}>
                        <h4 style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: '#92400e',
                            margin: '0 0 8px 0'
                        }}>
                            Dashboard Context
                        </h4>
                        <div style={{
                            fontSize: 13,
                            color: '#78350f',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 16
                        }}>
                            {metadata.context.audience && (
                                <div><strong>Audience:</strong> {metadata.context.audience}</div>
                            )}
                            {metadata.context.purpose && (
                                <div><strong>Purpose:</strong> {metadata.context.purpose}</div>
                            )}
                            {metadata.analysisType && (
                                <div><strong>Analysis:</strong> {metadata.analysisType}</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Dashboard Insights */}
                {metadata.suggestedInsights && metadata.suggestedInsights.length > 0 && (
                    <div style={{
                        padding: 12,
                        backgroundColor: '#ecfdf5',
                        borderRadius: 8,
                        border: '1px solid #d1fae5'
                    }}>
                        <h4 style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: '#059669',
                            margin: '0 0 8px 0'
                        }}>
                            Dashboard Insights
                        </h4>
                        <ul style={{
                            margin: 0,
                            paddingLeft: 20,
                            fontSize: 13,
                            color: '#047857'
                        }}>
                            {metadata.suggestedInsights.map((insight, index) => (
                                <li key={index} style={{ marginBottom: 4 }}>
                                    {insight}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Charts Grid */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                backgroundColor: '#f8faff'
            }}>
                {charts.map((chart) => (
                    <div
                        key={chart.id}
                        style={{
                            width: '100%',
                            border: '1px solid #e5e7eb',
                            backgroundColor: 'white'
                        }}
                    >
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: '#f8faff'
                        }}>
                            <h4 style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: '#7c3aed',
                                margin: 0
                            }}>
                                {chart.title}
                            </h4>
                        </div>
                        <ChartView
                            spec={{
                                chartType: chart.chartType,
                                metric: chart.metric,
                                data: chart.data,
                                originalPrompt: chart.title
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Dashboard Footer */}
            <div style={{
                padding: 16,
                backgroundColor: '#f8faff',
                borderTop: '1px solid #e5e7eb',
                fontSize: 13,
                color: '#6b7280',
                textAlign: 'center'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 24,
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <strong>Charts Generated:</strong> {metadata.totalCharts}
                    </div>
                    <div>
                        <strong>Response Time:</strong> {metadata.responseTimeMs}ms
                    </div>
                    <div>
                        <strong>Dashboard ID:</strong> {dashboard.dashboardId.split('_')[1]}...
                    </div>
                </div>
            </div>
        </div>
    );
} 