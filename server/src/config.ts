/**
 * Configuration for the Chat-to-Chart application
 */
export const config = {
    // Data source configuration
    dataSource: {
        // Primary data file to use (will fallback to metrics.json if not found)
        primaryFile: 'sample-june-metrics.json',
        fallbackFile: 'metrics.json'
    },

    // OpenAI configuration
    openai: {
        model: 'gpt-4o',
        temperature: 0
    },

    // Server configuration
    server: {
        port: 4000,
        cors: true
    },

    // Audit configuration
    audit: {
        enabled: true,
        retentionDays: 30,
        directory: 'audit-logs'
    }
}; 