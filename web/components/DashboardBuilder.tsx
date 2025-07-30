import React, { useState, useEffect } from 'react';

// Types for dashboard requirements
interface DashboardRequirements {
    intent: string;
    analysisType: 'performance' | 'comparison' | 'trend' | 'breakdown' | 'correlation' | 'custom';
    dataScope: {
        metrics: string[];
        timeRange: {
            type: 'absolute' | 'relative';
            start?: string;
            end?: string;
            period?: 'last7days' | 'last30days' | 'lastQuarter' | 'ytd' | 'custom';
        };
        filters: {
            channels?: string[];
            products?: string[];
            regions?: string[];
        };
    };
    comparison: {
        enabled: boolean;
        type?: 'time-over-time' | 'segment-comparison' | 'benchmark';
        baseline?: string;
        segments?: string[];
    };
    visualization: {
        preferredChartTypes?: string[];
        layout: 'grid' | 'stacked' | 'tabs';
        maxCharts: number;
        includeKPIs: boolean;
        includeTrends: boolean;
    };
    context: {
        audience: 'executive' | 'analyst' | 'operational' | 'custom';
        purpose: 'reporting' | 'monitoring' | 'investigation' | 'presentation';
        updateFrequency?: 'realtime' | 'daily' | 'weekly' | 'monthly';
    };
}

interface DashboardBuilderProps {
    onDashboardGenerate: (requirements: DashboardRequirements) => void;
    isLoading: boolean;
}

export default function DashboardBuilder({ onDashboardGenerate, isLoading }: DashboardBuilderProps) {
    const [step, setStep] = useState(1);
    const [mode, setMode] = useState<'quick' | 'builder'>('quick');
    const [quickPrompt, setQuickPrompt] = useState('');
    const [requirements, setRequirements] = useState<DashboardRequirements>({
        intent: '',
        analysisType: 'performance',
        dataScope: {
            metrics: [],
            timeRange: { type: 'relative', period: 'last30days' },
            filters: {}
        },
        comparison: { enabled: false },
        visualization: {
            layout: 'grid',
            maxCharts: 4,
            includeKPIs: true,
            includeTrends: true
        },
        context: {
            audience: 'analyst',
            purpose: 'reporting'
        }
    });

    // Available metrics from the actual JSON data
    const availableMetrics = [
        // Revenue Metrics
        { id: 'totalGrossSales', name: 'Total Gross Sales', category: 'Revenue' },
        { id: 'totalNetSales', name: 'Total Net Sales', category: 'Revenue' },
        { id: 'totalDiscounts', name: 'Total Discounts', category: 'Revenue' },
        { id: 'totalRefunds', name: 'Total Refunds', category: 'Revenue' },
        { id: 'totalShippingIncome', name: 'Total Shipping Income', category: 'Revenue' },
        { id: 'sales', name: 'Daily Sales', category: 'Revenue' },
        { id: 'netSales', name: 'Net Sales Over Time', category: 'Revenue' },
        { id: 'netSalesByConnector', name: 'Net Sales by Channel', category: 'Revenue' },

        // Order & Customer Metrics
        { id: 'totalOrders', name: 'Total Orders', category: 'Operations' },
        { id: 'orders', name: 'Orders Over Time', category: 'Operations' },
        { id: 'averageOrderValue', name: 'Average Order Value', category: 'Operations' },
        { id: 'totalNewCustomersCount', name: 'New Customers Count', category: 'Customer' },
        { id: 'totalNewCustomerOrders', name: 'New Customer Orders', category: 'Customer' },
        { id: 'totalReturningCustomerOrders', name: 'Returning Customer Orders', category: 'Customer' },
        { id: 'newCustomerAverageOrderValue', name: 'New Customer AOV', category: 'Customer' },
        { id: 'customerAqCost', name: 'Customer Acquisition Cost', category: 'Customer' },

        // Financial Performance
        { id: 'grossProfit', name: 'Gross Profit', category: 'Financial' },
        { id: 'grossProfits', name: 'Gross Profit Over Time', category: 'Financial' },
        { id: 'grossProfitMargin', name: 'Gross Profit Margin %', category: 'Financial' },
        { id: 'contributionMargin', name: 'Contribution Margin', category: 'Financial' },
        { id: 'contributionMargins', name: 'Contribution Margin Over Time', category: 'Financial' },
        { id: 'contributionMarginPercentage', name: 'Contribution Margin %', category: 'Financial' },
        { id: 'contributionMarginPercentages', name: 'Contribution Margin % Over Time', category: 'Financial' },
        { id: 'totalCogs', name: 'Total Cost of Goods Sold', category: 'Financial' },
        { id: 'productCogs', name: 'Product COGS', category: 'Financial' },

        // Marketing & Growth
        { id: 'totalMarketingExpense', name: 'Total Marketing Expense', category: 'Marketing' },
        { id: 'marketingExpenses', name: 'Marketing Expenses by Channel', category: 'Marketing' },
        { id: 'netMER', name: 'Net Marketing Efficiency Ratio', category: 'Marketing' },
        { id: 'aMer', name: 'Advertising Marketing Efficiency Ratio', category: 'Marketing' },
        { id: 'aMers', name: 'aMER Over Time', category: 'Marketing' },

        // Cash Flow & Operations
        { id: 'cashOnHand', name: 'Cash on Hand', category: 'Cash Flow' },
        { id: 'cashOnHandAmounts', name: 'Cash on Hand Over Time', category: 'Cash Flow' },
        { id: 'changeInCash', name: 'Change in Cash', category: 'Cash Flow' },
        { id: 'changesInCash', name: 'Cash Changes Over Time', category: 'Cash Flow' },
        { id: 'burnRate', name: 'Monthly Burn Rate', category: 'Cash Flow' },
        { id: 'burnRates', name: 'Burn Rate Over Time', category: 'Cash Flow' },
        { id: 'freeCashYield', name: 'Free Cash Yield', category: 'Cash Flow' },

        // Operational Expenses
        { id: 'totalLogistics', name: 'Total Logistics Costs', category: 'Operations' },
        { id: 'totalFreight', name: 'Total Freight Costs', category: 'Operations' },
        { id: 'totalFees', name: 'Total Fees', category: 'Operations' },
        { id: 'totalSalesGeneralAdministrativeExpenses', name: 'SG&A Expenses', category: 'Operations' },

        // Credit & Payments
        { id: 'creditCardBalance', name: 'Credit Card Balance', category: 'Financial' },
        { id: 'creditCardBalances', name: 'Credit Card Balances Over Time', category: 'Financial' },
        { id: 'amazonBalance', name: 'Amazon Balance', category: 'Financial' },

        // Complex Data Objects (for advanced analysis)
        { id: 'cashDetails', name: 'Cash Flow Details', category: 'Advanced' },
        { id: 'creditCardDetails', name: 'Credit Card Details', category: 'Advanced' },
        { id: 'dataBySalesConnectors', name: 'Sales by Connector Details', category: 'Advanced' }
    ];

    const metricCategories = [
        'Revenue',
        'Operations',
        'Customer',
        'Financial',
        'Marketing',
        'Cash Flow',
        'Advanced'
    ];

    const handleQuickGenerate = () => {
        if (!quickPrompt.trim()) return;

        // Convert quick prompt to basic requirements
        const quickRequirements: DashboardRequirements = {
            ...requirements,
            intent: quickPrompt,
            analysisType: detectAnalysisType(quickPrompt)
        };

        onDashboardGenerate(quickRequirements);
    };

    const handleBuilderGenerate = () => {
        if (!requirements.intent.trim() || requirements.dataScope.metrics.length === 0) return;
        onDashboardGenerate(requirements);
    };

    const detectAnalysisType = (prompt: string): DashboardRequirements['analysisType'] => {
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('trend') || lowerPrompt.includes('over time')) return 'trend';
        if (lowerPrompt.includes('compare') || lowerPrompt.includes('comparison')) return 'comparison';
        if (lowerPrompt.includes('breakdown') || lowerPrompt.includes('by')) return 'breakdown';
        if (lowerPrompt.includes('performance') || lowerPrompt.includes('kpi')) return 'performance';
        return 'custom';
    };

    const updateRequirements = (updates: Partial<DashboardRequirements>) => {
        setRequirements(prev => ({ ...prev, ...updates }));
    };

    const updateDataScope = (updates: Partial<DashboardRequirements['dataScope']>) => {
        setRequirements(prev => ({
            ...prev,
            dataScope: { ...prev.dataScope, ...updates }
        }));
    };

    const updateVisualization = (updates: Partial<DashboardRequirements['visualization']>) => {
        setRequirements(prev => ({
            ...prev,
            visualization: { ...prev.visualization, ...updates }
        }));
    };

    const updateContext = (updates: Partial<DashboardRequirements['context']>) => {
        setRequirements(prev => ({
            ...prev,
            context: { ...prev.context, ...updates }
        }));
    };

    const updateComparison = (updates: Partial<DashboardRequirements['comparison']>) => {
        setRequirements(prev => ({
            ...prev,
            comparison: { ...prev.comparison, ...updates }
        }));
    };

    if (mode === 'quick') {
        return (
            <div style={{ padding: 20 }}>
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ color: '#7c3aed', margin: 0 }}>Quick Dashboard Generator</h3>
                    <button
                        onClick={() => setMode('builder')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        Advanced Builder
                    </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <input
                        value={quickPrompt}
                        onChange={(e) => setQuickPrompt(e.target.value)}
                        placeholder="Describe what you want to see in your dashboard..."
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #e5e7eb',
                            borderRadius: 8,
                            fontSize: 16,
                            outline: 'none',
                            marginBottom: 12
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />

                    <button
                        onClick={handleQuickGenerate}
                        disabled={isLoading || !quickPrompt.trim()}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: isLoading ? '#9ca3af' : (quickPrompt.trim() ? '#7c3aed' : '#d1d5db'),
                            color: 'white',
                            border: 'none',
                            borderRadius: 8,
                            cursor: isLoading ? 'not-allowed' : (quickPrompt.trim() ? 'pointer' : 'default'),
                            fontSize: 16,
                            fontWeight: '600'
                        }}
                    >
                        {isLoading ? 'Generating...' : 'Generate Quick Dashboard'}
                    </button>
                </div>

                <div style={{ fontSize: 14, color: '#6b7280' }}>
                    <strong>Examples:</strong>
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                            "Show me sales performance trends",
                            "Compare revenue across channels",
                            "Executive overview dashboard",
                            "Monthly financial breakdown"
                        ].map((example, index) => (
                            <button
                                key={index}
                                onClick={() => setQuickPrompt(example)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 6,
                                    fontSize: 13,
                                    cursor: 'pointer'
                                }}
                            >
                                "{example}"
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ color: '#7c3aed', margin: 0 }}>Advanced Dashboard Builder</h3>
                <button
                    onClick={() => setMode('quick')}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        cursor: 'pointer'
                    }}
                >
                    Quick Mode
                </button>
            </div>

            {/* Step Progress */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
                {[1, 2, 3, 4].map((stepNum) => (
                    <React.Fragment key={stepNum}>
                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                backgroundColor: step >= stepNum ? '#7c3aed' : '#e5e7eb',
                                color: step >= stepNum ? 'white' : '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                            onClick={() => setStep(stepNum)}
                        >
                            {stepNum}
                        </div>
                        {stepNum < 4 && (
                            <div
                                style={{
                                    width: 40,
                                    height: 2,
                                    backgroundColor: step > stepNum ? '#7c3aed' : '#e5e7eb',
                                    margin: '0 8px'
                                }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Step Content */}
            {step === 1 && (
                <StepOne
                    requirements={requirements}
                    updateRequirements={updateRequirements}
                    availableMetrics={availableMetrics}
                    metricCategories={metricCategories}
                    updateDataScope={updateDataScope}
                />
            )}
            {step === 2 && (
                <StepTwo
                    requirements={requirements}
                    updateDataScope={updateDataScope}
                    updateComparison={updateComparison}
                />
            )}
            {step === 3 && (
                <StepThree
                    requirements={requirements}
                    updateVisualization={updateVisualization}
                />
            )}
            {step === 4 && (
                <StepFour
                    requirements={requirements}
                    updateContext={updateContext}
                />
            )}

            {/* Navigation */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                <button
                    onClick={() => setStep(Math.max(1, step - 1))}
                    disabled={step === 1}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: step === 1 ? '#f3f4f6' : '#e5e7eb',
                        border: 'none',
                        borderRadius: 6,
                        cursor: step === 1 ? 'not-allowed' : 'pointer'
                    }}
                >
                    Previous
                </button>

                {step < 4 ? (
                    <button
                        onClick={() => setStep(step + 1)}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        Next
                    </button>
                ) : (
                    <div>
                        <button
                            onClick={handleBuilderGenerate}
                            disabled={isLoading || !requirements.intent.trim() || requirements.dataScope.metrics.length === 0}
                            style={{
                                padding: '12px 24px',
                                backgroundColor: isLoading ? '#9ca3af' :
                                    (requirements.intent.trim() && requirements.dataScope.metrics.length > 0 ? '#7c3aed' : '#d1d5db'),
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                cursor: isLoading ? 'not-allowed' : (requirements.intent.trim() && requirements.dataScope.metrics.length > 0 ? 'pointer' : 'not-allowed'),
                                fontWeight: '600'
                            }}
                        >
                            {isLoading ? 'Generating Dashboard...' : 'Generate Dashboard'}
                        </button>

                        {/* Validation feedback */}
                        {(!requirements.intent.trim() || requirements.dataScope.metrics.length === 0) && !isLoading && (
                            <div style={{
                                marginTop: 8,
                                fontSize: 12,
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <span>⚠️</span>
                                {!requirements.intent.trim() && !requirements.dataScope.metrics.length ?
                                    'Please add an intent description and select at least one metric in Step 1' :
                                    !requirements.intent.trim() ?
                                        'Please describe what you want to analyze in Step 1' :
                                        'Please select at least one metric in Step 1'
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Step Components
const StepOne = ({ requirements, updateRequirements, availableMetrics, metricCategories, updateDataScope }: any) => (
    <div>
        <h4 style={{ color: '#374151', marginBottom: 16 }}>Step 1: Define Your Intent & Select Metrics</h4>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                What do you want to analyze?
            </label>
            <input
                value={requirements.intent}
                onChange={(e) => updateRequirements({ intent: e.target.value })}
                placeholder="Describe your analysis goal..."
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14
                }}
            />
        </div>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Analysis Type
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['performance', 'comparison', 'trend', 'breakdown', 'correlation', 'custom'].map((type) => (
                    <button
                        key={type}
                        onClick={() => updateRequirements({ analysisType: type as any })}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: requirements.analysisType === type ? '#7c3aed' : '#f3f4f6',
                            color: requirements.analysisType === type ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {type}
                    </button>
                ))}
            </div>
        </div>

        <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Select Metrics {requirements.dataScope.metrics.length > 0 && (
                    <span style={{
                        color: '#7c3aed',
                        fontWeight: 'normal',
                        fontSize: 14
                    }}>
                        ({requirements.dataScope.metrics.length} selected)
                    </span>
                )}
            </label>
            {metricCategories.map((category: string) => (
                <div key={category} style={{ marginBottom: 16 }}>
                    <h5 style={{ color: '#6b7280', marginBottom: 8 }}>{category}</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {availableMetrics
                            .filter((metric: any) => metric.category === category)
                            .map((metric: any) => (
                                <button
                                    key={metric.id}
                                    onClick={() => {
                                        const currentMetrics = requirements.dataScope.metrics;
                                        const newMetrics = currentMetrics.includes(metric.id)
                                            ? currentMetrics.filter((id: string) => id !== metric.id)
                                            : [...currentMetrics, metric.id];
                                        updateDataScope({ metrics: newMetrics });
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        backgroundColor: requirements.dataScope.metrics.includes(metric.id)
                                            ? '#7c3aed' : '#f9fafb',
                                        color: requirements.dataScope.metrics.includes(metric.id)
                                            ? 'white' : '#374151',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        fontSize: 12
                                    }}
                                >
                                    {metric.name}
                                </button>
                            ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const StepTwo = ({ requirements, updateDataScope, updateComparison }: any) => (
    <div>
        <h4 style={{ color: '#374151', marginBottom: 16 }}>Step 2: Time Range & Comparison</h4>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Time Range
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {[
                    { label: 'Last 7 Days', value: 'last7days' },
                    { label: 'Last 30 Days', value: 'last30days' },
                    { label: 'Last Quarter', value: 'lastQuarter' },
                    { label: 'Year to Date', value: 'ytd' }
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => updateDataScope({
                            timeRange: { type: 'relative', period: option.value as any }
                        })}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: requirements.dataScope.timeRange.period === option.value
                                ? '#7c3aed' : '#f3f4f6',
                            color: requirements.dataScope.timeRange.period === option.value
                                ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: 8, fontWeight: 600 }}>
                <input
                    type="checkbox"
                    checked={requirements.comparison.enabled}
                    onChange={(e) => updateComparison({ enabled: e.target.checked })}
                    style={{ marginRight: 8 }}
                />
                Enable Comparison
            </label>

            {requirements.comparison.enabled && (
                <div style={{ marginLeft: 24 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {[
                            { label: 'Time over Time', value: 'time-over-time' },
                            { label: 'Segment Comparison', value: 'segment-comparison' },
                            { label: 'Benchmark', value: 'benchmark' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => updateComparison({ type: option.value as any })}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: requirements.comparison.type === option.value
                                        ? '#7c3aed' : '#f3f4f6',
                                    color: requirements.comparison.type === option.value
                                        ? 'white' : '#374151',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 12
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
);

const StepThree = ({ requirements, updateVisualization }: any) => (
    <div>
        <h4 style={{ color: '#374151', marginBottom: 16 }}>Step 3: Visualization Preferences</h4>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Layout Style
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
                {[
                    { label: 'Grid', value: 'grid' },
                    { label: 'Stacked', value: 'stacked' },
                    { label: 'Tabs', value: 'tabs' }
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => updateVisualization({ layout: option.value as any })}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: requirements.visualization.layout === option.value
                                ? '#7c3aed' : '#f3f4f6',
                            color: requirements.visualization.layout === option.value
                                ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Maximum Charts: {requirements.visualization.maxCharts}
            </label>
            <input
                type="range"
                min="2"
                max="8"
                value={requirements.visualization.maxCharts}
                onChange={(e) => updateVisualization({ maxCharts: parseInt(e.target.value) })}
                style={{ width: '100%' }}
            />
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={requirements.visualization.includeKPIs}
                    onChange={(e) => updateVisualization({ includeKPIs: e.target.checked })}
                    style={{ marginRight: 8 }}
                />
                Include KPIs
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={requirements.visualization.includeTrends}
                    onChange={(e) => updateVisualization({ includeTrends: e.target.checked })}
                    style={{ marginRight: 8 }}
                />
                Include Trends
            </label>
        </div>
    </div>
);

const StepFour = ({ requirements, updateContext }: any) => (
    <div>
        <h4 style={{ color: '#374151', marginBottom: 16 }}>Step 4: Dashboard Context</h4>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Target Audience
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                    { label: 'Executive', value: 'executive' },
                    { label: 'Analyst', value: 'analyst' },
                    { label: 'Operational', value: 'operational' },
                    { label: 'Custom', value: 'custom' }
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => updateContext({ audience: option.value as any })}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: requirements.context.audience === option.value
                                ? '#7c3aed' : '#f3f4f6',
                            color: requirements.context.audience === option.value
                                ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Purpose
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                    { label: 'Reporting', value: 'reporting' },
                    { label: 'Monitoring', value: 'monitoring' },
                    { label: 'Investigation', value: 'investigation' },
                    { label: 'Presentation', value: 'presentation' }
                ].map((option) => (
                    <button
                        key={option.value}
                        onClick={() => updateContext({ purpose: option.value as any })}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: requirements.context.purpose === option.value
                                ? '#7c3aed' : '#f3f4f6',
                            color: requirements.context.purpose === option.value
                                ? 'white' : '#374151',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                        }}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div style={{ marginBottom: 20 }}>
            <h5 style={{ color: '#374151', marginBottom: 12 }}>Requirements Summary</h5>
            <div style={{
                padding: 16,
                backgroundColor: '#f9fafb',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14
            }}>
                <div><strong>Intent:</strong> {requirements.intent || 'Not specified'}</div>
                <div><strong>Analysis Type:</strong> {requirements.analysisType}</div>
                <div><strong>Metrics:</strong> {requirements.dataScope.metrics.length} selected</div>
                <div><strong>Time Range:</strong> {requirements.dataScope.timeRange.period}</div>
                <div><strong>Audience:</strong> {requirements.context.audience}</div>
                <div><strong>Purpose:</strong> {requirements.context.purpose}</div>
            </div>
        </div>
    </div>
); 