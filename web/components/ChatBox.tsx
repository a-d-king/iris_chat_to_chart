import React, { useState } from 'react';

interface ChatBoxProps {
    onResponse: (response: any) => void;
}

/**
 * ChatBox component for user input and API communication
 * Provides a text input and submit button to send prompts to the backend
 */
export default function ChatBox({ onResponse }: ChatBoxProps) {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Handle form submission - send the prompt to the backend API
     */
    const ask = async () => {
        if (!text.trim()) return;

        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:4000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from server');
            }

            const result = await response.json();

            onResponse(result);
            setText('');
        } catch (error) {
            console.error('Error sending prompt:', error);
            alert('Error: Could not process your request. Make sure the server is running.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isLoading) {
            ask();
        }
    };

    return (
        <div>
            <div style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center'
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
                    💬
                </div>
                <h3 style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: '#7c3aed',
                    margin: 0
                }}>
                    Ask Iris Finance AI
                </h3>
            </div>

            <div style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
                padding: 16,
                border: '2px solid #e5e7eb',
                borderRadius: 12,
                backgroundColor: '#fafafa',
                transition: 'all 0.2s ease',
                ...(text.trim() ? { borderColor: '#7c3aed', backgroundColor: '#f8faff' } : {})
            }}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about your financial data here..."
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 16,
                        backgroundColor: 'white',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                    disabled={isLoading}
                />
                <button
                    onClick={ask}
                    disabled={isLoading || !text.trim()}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: isLoading ? '#9ca3af' : (text.trim() ? '#7c3aed' : '#d1d5db'),
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: isLoading ? 'not-allowed' : (text.trim() ? 'pointer' : 'default'),
                        fontSize: 16,
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        minWidth: 100,
                        boxShadow: text.trim() && !isLoading ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none',
                        transform: text.trim() && !isLoading ? 'translateY(-1px)' : 'none'
                    }}
                >
                    {isLoading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                width: 16,
                                height: 16,
                                border: '2px solid white',
                                borderTop: '2px solid transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }}></span>
                            Processing...
                        </span>
                    ) : 'Generate Chart'}
                </button>
            </div>

            {/* Example Prompts */}
            <div style={{
                fontSize: 14,
                color: '#6b7280'
            }}>
                <strong style={{ color: '#7c3aed' }}>Try these examples:</strong>
                <div style={{
                    marginTop: 8,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8
                }}>
                    {[
                        "Show me sales trends over time",
                        "Compare revenue by sales channel",
                        "Account performance breakdown",
                        "Cash flow analysis"
                    ].map((example, index) => (
                        <button
                            key={index}
                            onClick={() => setText(example)}
                            disabled={isLoading}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: 6,
                                fontSize: 13,
                                color: '#6b7280',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.borderColor = '#7c3aed';
                                    e.currentTarget.style.color = '#7c3aed';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.color = '#6b7280';
                                }
                            }}
                        >
                            "{example}"
                        </button>
                    ))}
                </div>
            </div>

            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
} 