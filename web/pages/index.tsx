import React, { useState } from 'react';
import ChatBox from '../components/ChatBox';
import ChartView from '../components/ChartView';

/**
 * Main home page component
 * Combines the ChatBox and ChartView components to create the full application
 */
export default function Home() {
    const [spec, setSpec] = useState(null);

    return (
        <main style={{
            padding: 24,
            maxWidth: 1200,
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: 32,
                borderBottom: '2px solid #eee',
                paddingBottom: 24
            }}>
                <h1 style={{
                    fontSize: 32,
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: 8
                }}>
                    Chat → Chart MVP
                </h1>
                <p style={{
                    fontSize: 16,
                    color: '#666',
                    margin: 0
                }}>
                    Transform natural language into beautiful charts powered by AI
                </p>
            </div>

            {/* Instructions */}
            <div style={{
                backgroundColor: '#f8f9fa',
                padding: 16,
                borderRadius: 8,
                marginBottom: 24,
                border: '1px solid #e9ecef'
            }}>
                <h3 style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#495057',
                    margin: '0 0 8px 0'
                }}>
                    How to use:
                </h3>
                <ul style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: '#6c757d',
                    fontSize: 14
                }}>
                    <li>Type a natural language request for a chart</li>
                    <li>The AI will interpret your request and generate the appropriate chart</li>
                    <li>Make sure your server is running and has access to metrics.json</li>
                </ul>
            </div>

            {/* Chat Input */}
            <ChatBox onResponse={setSpec} />

            {/* Chart Display */}
            <ChartView spec={spec} />

            {/* Footer */}
            <div style={{
                marginTop: 40,
                padding: 16,
                textAlign: 'center',
                fontSize: 12,
                color: '#999',
                borderTop: '1px solid #eee'
            }}>
                <p>
                    🚀 Built with Next.js, NestJS, OpenAI, and ag-charts-react
                </p>
                <p>
                    Make sure to set your OPENAI_API_KEY environment variable and place your metrics.json file in the server directory
                </p>
            </div>
        </main>
    );
} 