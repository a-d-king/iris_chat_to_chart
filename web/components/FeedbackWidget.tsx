import React, { useState } from 'react';

interface FeedbackWidgetProps {
    requestId: string;
    chartId?: string;
    onFeedbackSubmitted?: () => void;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
    requestId,
    chartId,
    onFeedbackSubmitted
}) => {
    const [selectedRating, setSelectedRating] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const ratingConfig = [
        { value: 1, color: '#ef4444', label: 'Terrible' },
        { value: 2, color: '#f97316', label: 'Bad' },
        { value: 3, color: '#eab308', label: 'Neutral' },
        { value: 4, color: '#3b82f6', label: 'Good' },
        { value: 5, color: '#22c55e', label: 'Great' }
    ];

    const handleSubmitFeedback = async () => {
        if (!selectedRating) return;

        setIsSubmitting(true);
        try {
            const response = await fetch('http://localhost:4000/v1/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    rating: selectedRating,
                    comment: comment.trim() || undefined,
                    chartId
                })
            });

            if (response.ok) {
                setIsSubmitted(true);
                onFeedbackSubmitted?.();
            } else {
                throw new Error('Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div style={{
                padding: '12px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '14px',
                color: '#0369a1'
            }}>
                ✅ Thank you for your feedback!
            </div>
        );
    }

    return (
        <div style={{
            padding: '16px',
            backgroundColor: '#f8faff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            marginTop: '12px'
        }}>
            <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
            }}>
                How would you rate this chart?
            </div>

            <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                marginBottom: '12px'
            }}>
                {ratingConfig.map((config) => (
                    <button
                        key={config.value}
                        onClick={() => setSelectedRating(config.value)}
                        style={{
                            width: '80px',
                            height: '60px',
                            borderRadius: '8px',
                            border: selectedRating === config.value
                                ? `3px solid ${config.color}`
                                : '2px solid #d1d5db',
                            backgroundColor: selectedRating === config.value
                                ? config.color
                                : 'white',
                            color: selectedRating === config.value ? 'white' : config.color,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '2px'
                        }}
                        title={config.label}
                    >
                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                            {config.value}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>
                            {config.label}
                        </div>
                    </button>
                ))}
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional: Add a comment about this chart..."
                style={{
                    width: '100%',
                    minHeight: '60px',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '12px',
                    resize: 'vertical',
                    marginBottom: '12px',
                    boxSizing: 'border-box'
                }}
            />

            <button
                onClick={handleSubmitFeedback}
                disabled={!selectedRating || isSubmitting}
                style={{
                    width: '100%',
                    padding: '8px 16px',
                    backgroundColor: selectedRating ? '#7c3aed' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: selectedRating ? 'pointer' : 'not-allowed',
                    opacity: isSubmitting ? 0.7 : 1
                }}
            >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
        </div>
    );
};

export default FeedbackWidget; 