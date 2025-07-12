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
    const [isMockMode, setIsMockMode] = useState(false);

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

            // Check if the server is using mock data
            setIsMockMode(result.isMockData || false);

            onResponse(result);
            setText(''); // Clear input after successful submission
        } catch (error) {
            console.error('Error sending prompt:', error);
            alert('Error: Could not process your request. Make sure the server is running.');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handle Enter key press to submit the form
     */
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !isLoading) {
            ask();
        }
    };

    return (
        <div>
            {/* Mock Mode Banner */}
            {isMockMode && (
                <div style={{
                    backgroundColor: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    fontSize: 14,
                    color: '#856404'
                }}>
                    <strong>🎭 Demo Mode:</strong> Using mock data for testing.
                    Set <code>OPENAI_API_KEY</code> environment variable to use real AI.
                </div>
            )}

            <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 20,
                padding: 16,
                border: '1px solid #ddd',
                borderRadius: 8,
                backgroundColor: '#f9f9f9'
            }}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask for a chart (e.g., 'Show me revenue trends for 2023')"
                    style={{
                        flex: 1,
                        padding: 8,
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        fontSize: 14
                    }}
                    disabled={isLoading}
                />
                <button
                    onClick={ask}
                    disabled={isLoading || !text.trim()}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: isLoading ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: 4,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: 14
                    }}
                >
                    {isLoading ? 'Processing...' : 'Ask'}
                </button>
            </div>
        </div>
    );
} 