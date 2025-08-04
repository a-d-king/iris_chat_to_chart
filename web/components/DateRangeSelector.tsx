import React, { useState } from 'react';

interface DateRangeSelectorProps {
    selectedRange: string;
    onRangeChange: (range: string) => void;
}

type PresetRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'Custom';

interface DateRangeOption {
    id: PresetRange;
    label: string;
    description: string;
    getValue: () => string;
}

/**
 * DateRangeSelector component for selecting time ranges
 * Supports preset ranges (1D, 1W, 1M, 3M, 1Y) and custom date ranges
 */
export default function DateRangeSelector({ selectedRange, onRangeChange }: DateRangeSelectorProps) {
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Helper function to get date strings for API
    const getDateString = (daysAgo: number): string => {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const dateRangeOptions: DateRangeOption[] = [
        {
            id: '1D',
            label: '1 Day',
            description: 'Last 24 hours',
            getValue: () => {
                const today = getDateString(0);
                const yesterday = getDateString(1);
                return `${yesterday},${today}`;
            }
        },
        {
            id: '1W',
            label: '1 Week',
            description: 'Last 7 days',
            getValue: () => {
                const today = getDateString(0);
                const weekAgo = getDateString(7);
                return `${weekAgo},${today}`;
            }
        },
        {
            id: '1M',
            label: '1 Month',
            description: 'Last 30 days',
            getValue: () => {
                const today = getDateString(0);
                const monthAgo = getDateString(30);
                return `${monthAgo},${today}`;
            }
        },
        {
            id: '3M',
            label: '3 Months',
            description: 'Last 90 days',
            getValue: () => {
                const today = getDateString(0);
                const threeMonthsAgo = getDateString(90);
                return `${threeMonthsAgo},${today}`;
            }
        },
        {
            id: '1Y',
            label: '1 Year',
            description: 'Last 365 days',
            getValue: () => {
                const today = getDateString(0);
                const yearAgo = getDateString(365);
                return `${yearAgo},${today}`;
            }
        },
        {
            id: 'Custom',
            label: 'Custom',
            description: 'Choose specific dates',
            getValue: () => 'custom'
        }
    ];

    const handlePresetSelect = (option: DateRangeOption) => {
        if (option.id === 'Custom') {
            setIsCustomMode(true);
            return;
        }

        setIsCustomMode(false);
        onRangeChange(option.getValue());
    };

    const handleCustomDateSubmit = () => {
        if (customStartDate && customEndDate) {
            // Format as custom range: "startDate,endDate"
            const customRange = `${customStartDate},${customEndDate}`;
            onRangeChange(customRange);
            setIsCustomMode(false);
        }
    };

    const formatDisplayRange = (range: string): string => {
        if (range.includes(',')) {
            const [start, end] = range.split(',');
            return `${start} to ${end}`;
        }

        const option = dateRangeOptions.find(opt => opt.getValue() === range);
        return option ? option.label : 'Custom Range';
    };

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 8
            }}>
                <span style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: '#7c3aed',
                    marginRight: 8
                }}>
                    📅 Time Range:
                </span>
                <span style={{
                    fontSize: 13,
                    color: '#6b7280',
                    backgroundColor: '#f8faff',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #e5e7eb'
                }}>
                    {selectedRange ? formatDisplayRange(selectedRange) : 'Select range'}
                </span>
            </div>

            {/* Preset Range Buttons */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: isCustomMode ? 12 : 0
            }}>
                {dateRangeOptions.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => handlePresetSelect(option)}
                        style={{
                            padding: '8px 12px',
                            backgroundColor: selectedRange === option.getValue() ? '#7c3aed' : 'white',
                            color: selectedRange === option.getValue() ? 'white' : '#6b7280',
                            border: '1px solid #e5e7eb',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: 70,
                            position: 'relative'
                        }}
                        onMouseOver={(e) => {
                            if (selectedRange !== option.getValue()) {
                                e.currentTarget.style.borderColor = '#7c3aed';
                                e.currentTarget.style.backgroundColor = '#f8faff';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (selectedRange !== option.getValue()) {
                                e.currentTarget.style.borderColor = '#e5e7eb';
                                e.currentTarget.style.backgroundColor = 'white';
                            }
                        }}
                        title={option.description}
                    >
                        <span style={{ fontWeight: '600' }}>{option.label}</span>
                        <span style={{
                            fontSize: 10,
                            opacity: 0.8,
                            marginTop: 2
                        }}>
                            {option.description}
                        </span>
                    </button>
                ))}
            </div>

            {/* Custom Date Range Input */}
            {isCustomMode && (
                <div style={{
                    padding: 16,
                    backgroundColor: '#f8faff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    marginTop: 8
                }}>
                    <div style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#7c3aed',
                        marginBottom: 12
                    }}>
                        Select Custom Date Range:
                    </div>

                    <div style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{
                                fontSize: 12,
                                color: '#6b7280',
                                marginBottom: 4,
                                fontWeight: '500'
                            }}>
                                Start Date:
                            </label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    backgroundColor: 'white'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{
                                fontSize: 12,
                                color: '#6b7280',
                                marginBottom: 4,
                                fontWeight: '500'
                            }}>
                                End Date:
                            </label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    backgroundColor: 'white'
                                }}
                            />
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'flex-end'
                        }}>
                            <button
                                onClick={handleCustomDateSubmit}
                                disabled={!customStartDate || !customEndDate}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: customStartDate && customEndDate ? '#7c3aed' : '#d1d5db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    fontWeight: '600',
                                    cursor: customStartDate && customEndDate ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Apply
                            </button>
                            <button
                                onClick={() => {
                                    setIsCustomMode(false);
                                    setCustomStartDate('');
                                    setCustomEndDate('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'white',
                                    color: '#6b7280',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 4,
                                    fontSize: 13,
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 