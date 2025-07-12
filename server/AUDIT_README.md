# Audit System Documentation

## Overview

The audit system automatically logs all chart generation requests for compliance, debugging, and analytics purposes. Every chart request is saved with complete context including the user prompt, generated chart specification, and the actual data used.

## Features

- **Complete Request Logging**: Every chart generation request is logged with full context
- **Unique Request IDs**: Each request gets a unique identifier for tracking
- **Daily Summaries**: Consolidated daily logs for easy review
- **Audit Statistics**: Built-in analytics for monitoring usage patterns
- **Automatic Cleanup**: Old logs are automatically cleaned up (configurable retention)
- **Data Privacy**: Audit logs are excluded from version control

## File Structure

```
server/
├── audit-logs/
│   ├── chart-1703123456789-abc123def.json    # Individual request logs
│   ├── chart-1703123456790-def456ghi.json
│   ├── daily-summary-2023-12-21.json         # Daily summaries
│   └── daily-summary-2023-12-22.json
```

## Audit Log Format

Each audit log contains:

```json
{
  "timestamp": "2023-12-21T10:30:00.000Z",
  "requestId": "1703123456789-abc123def",
  "userPrompt": "Show me sales data by region",
  "chartSpec": {
    "chartType": "bar",
    "metric": "sales",
    "dateRange": "2023",
    "groupBy": "region"
  },
  "dataUsed": {
    "dates": ["2023-01", "2023-02", "..."],
    "values": [/* chart data */]
  },
  "dataAnalysis": {
    "availableMetrics": [/* analyzed metrics */],
    "suggestedChartTypes": [/* AI suggestions */]
  },
  "metadata": {
    "usingMockData": false,
    "dataSourceFile": "sample-june-metrics.json",
    "responseTimeMs": 1247,
    "metricsCount": 15
  }
}
```

## API Endpoints

### Chart Generation (with audit)
```
POST /chat
```
Returns chart data with `requestId` for audit tracking.

### Audit Statistics
```
GET /audit/stats
```
Returns audit statistics including:
- Total requests
- Today's requests
- Chart type breakdown
- Average response time
- Mock data usage percentage

## Configuration

Audit settings in `config.ts`:

```typescript
audit: {
    enabled: true,          // Enable/disable audit logging
    retentionDays: 30,      // How long to keep audit logs
    directory: 'audit-logs' // Directory name for audit logs
}
```

## Privacy and Security

- **Data Sensitivity**: Audit logs contain the actual data used for charts
- **Version Control**: Audit logs are excluded from Git (in .gitignore)
- **Access Control**: Ensure proper file system permissions on audit directory
- **Data Retention**: Old logs are automatically cleaned up based on retention policy

## Use Cases

1. **Compliance**: Track what data was shown to users and when
2. **Debugging**: Reproduce issues by examining exact request context
3. **Analytics**: Understand usage patterns and popular chart types
4. **Performance**: Monitor response times and identify bottlenecks
5. **Data Governance**: Audit access to sensitive business metrics

## Maintenance

The audit system includes automatic maintenance:

- **Daily Summaries**: Lightweight summaries for quick review
- **Automatic Cleanup**: Old logs are removed based on retention policy
- **Error Handling**: Robust error handling ensures audit failures don't break chart generation

## Example Usage

```bash
# View audit statistics
curl http://localhost:4000/audit/stats

# Generate a chart (automatically audited)
curl -X POST http://localhost:4000/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me revenue trends"}'
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the server has write permissions to the audit directory
2. **Disk Space**: Monitor disk usage as audit logs can grow large over time
3. **Performance**: Large audit directories may slow down statistics calculation

### Logs to Check

- Server console output for audit-related messages
- Individual audit log files for request details
- Daily summary files for patterns and trends

## Best Practices

1. **Regular Monitoring**: Check audit statistics regularly
2. **Backup Important Logs**: Consider backing up audit logs for critical compliance needs
3. **Disk Space Management**: Monitor disk usage and adjust retention as needed
4. **Access Control**: Secure the audit directory with appropriate permissions 