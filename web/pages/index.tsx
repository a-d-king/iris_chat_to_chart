import React, { useState } from 'react';
import ChatBox from '../components/ChatBox';
import ChartView from '../components/ChartView';
import DashboardView from '../components/DashboardView';
import DashboardBuilder from '../components/DashboardBuilder';

/**
 * Main home page component
 * Combines the ChatBox and ChartView components to create the full application
 */
export default function Home() {
    const [spec, setSpec] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<'legacy' | 'enhanced'>('enhanced');
    const [lastRequest, setLastRequest] = useState<string | null>(null);

    const handleEnhancedDashboardGenerate = async (requirements: any) => {
        // Prevent duplicate requests by checking if the same request is already in progress
        const requestKey = JSON.stringify({
            intent: requirements.intent,
            metrics: requirements.dataScope.metrics.sort(), // Sort to normalize
            analysisType: requirements.analysisType,
            timeRange: requirements.dataScope.timeRange
        });

        // Check if this exact request is already being processed
        if (isLoading && lastRequest === requestKey) {
            console.log('Duplicate request prevented - same request already in progress');
            return;
        }

        setLastRequest(requestKey);
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:4000/dashboard/enhanced', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: requirements.intent,
                    requirements
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate enhanced dashboard');
            }

            const result = await response.json();
            setDashboard(result);
            setSpec(null); // Clear single chart if any
        } catch (error) {
            console.error('Error generating enhanced dashboard:', error);
            alert('Error: Could not generate dashboard. Make sure the server is running.');
        } finally {
            setIsLoading(false);
            // Clear last request after a delay to allow for new requests
            setTimeout(() => setLastRequest(null), 1000);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <main style={{
                padding: 24,
                maxWidth: 1200,
                margin: '0 auto'
            }}>
                <div style={{
                    textAlign: 'center',
                    margin: '0 auto 32px auto',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 16,
                    padding: 32,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    maxWidth: 360
                }}>
                    <img
                        src="/iris.jpeg"
                        alt="Iris Finance"
                        style={{
                            width: 64,
                            height: 64,
                            margin: '0 auto 16px auto',
                            display: 'block',
                            borderRadius: 12,
                            objectFit: 'cover',
                            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)'
                        }}
                    />

                    <h1 style={{
                        fontSize: 36,
                        fontWeight: 'bold',
                        color: '#7c3aed',
                        marginBottom: 8,
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        Iris Finance
                    </h1>
                    <h2 style={{
                        fontSize: 24,
                        color: '#7c3aed',
                        marginBottom: 8,
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                        Chat → Chart AI
                    </h2>
                </div>

                <div style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    padding: 20,
                    borderRadius: 12,
                    marginBottom: 24,
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <h3 style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#7c3aed',
                        margin: '0 0 12px 0',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <span style={{
                            width: 24,
                            height: 24,
                            backgroundColor: '#7c3aed',
                            borderRadius: '50%',
                            color: 'white',
                            fontSize: 14,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8
                        }}>
                            ?
                        </span>
                        How to use:
                    </h3>
                    <ul style={{
                        margin: 0,
                        paddingLeft: 20,
                        color: '#5b21b6',
                        fontSize: 15,
                        lineHeight: 1.6
                    }}>
                        <li><strong>Ask natural questions:</strong> "Show me revenue trends" or "Compare sales by channel"</li>
                        <li><strong>AI-powered analysis:</strong> System automatically discovers metrics from data and logs data used for chart generation</li>
                        <li><strong>Intelligent visualizations:</strong> Get the perfect chart type for your business insights</li>
                    </ul>
                </div>

                <div style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 24,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                    border: '2px solid #7c3aed'
                }}>
                    {/* Mode Toggle */}
                    <div style={{
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        backgroundColor: '#f1f5f9',
                        borderRadius: 8,
                        padding: 4,
                        width: 'fit-content',
                        margin: '0 auto 20px auto'
                    }}>
                        <button
                            onClick={() => setMode('enhanced')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: mode === 'enhanced' ? '#7c3aed' : 'transparent',
                                color: mode === 'enhanced' ? 'white' : '#6b7280',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 14,
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Enhanced Builder
                        </button>
                        <button
                            onClick={() => setMode('legacy')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: mode === 'legacy' ? '#7c3aed' : 'transparent',
                                color: mode === 'legacy' ? 'white' : '#6b7280',
                                border: 'none',
                                borderRadius: 4,
                                fontSize: 14,
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Legacy Mode
                        </button>
                    </div>

                    {mode === 'enhanced' ? (
                        <DashboardBuilder
                            onDashboardGenerate={handleEnhancedDashboardGenerate}
                            isLoading={isLoading}
                        />
                    ) : (
                        <ChatBox
                            onResponse={setSpec}
                            onDashboardResponse={setDashboard}
                        />
                    )}
                </div>

                <div style={{
                    backgroundColor: 'white',
                    borderRadius: 12,
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                    border: '2px solid #7c3aed',
                    overflow: 'hidden'
                }}>
                    {dashboard ? (
                        <DashboardView dashboard={dashboard} />
                    ) : (
                        <ChartView spec={spec} />
                    )}
                </div>

                <div style={{
                    marginTop: 40,
                    padding: 20,
                    textAlign: 'center',
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.9)',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                    <p style={{
                        margin: '0 0 8px 0',
                        fontWeight: '600'
                    }}>
                        Iris Finance - AI-Powered Business Intelligence Platform
                    </p>
                    <p style={{
                        margin: 0,
                        fontSize: 12,
                        color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                        Built with Next.js, NestJS, OpenAI GPT-4, ag-charts-react, ag-grid-react, and ag-grid-community
                    </p>
                </div>
            </main>
        </div>
    );
} 