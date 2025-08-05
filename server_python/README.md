# Chat to Chart Python Server

Python backend for the Chat to Chart application, converted from the original NestJS TypeScript implementation.

## Features

- **FastAPI**: Modern, fast web framework for building APIs
- **AI-Powered Chart Generation**: Uses OpenAI GPT-4o for natural language to chart specification conversion
- **Data Processing**: Sophisticated data analysis and transformation for multiple chart types
- **Caching**: In-memory caching for improved performance
- **Audit Logging**: Comprehensive request/response logging and analytics
- **Dashboard Generation**: Multi-chart dashboard creation with layout management
- **Feedback System**: User rating and feedback collection

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `IRIS_API_TOKEN`: Your Iris Finance API token
- `IRIS_API_URL`: Iris Finance API URL (default: https://api.irisfinance.co/metrics)
- `PORT`: Server port (default: 4000)

### 3. Start the Server

```bash
python start.py
```

Or use uvicorn directly:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload
```

## API Endpoints

### Chart Generation
- `POST /chat` - Generate single chart from natural language prompt
- `POST /dashboard` - Generate multi-chart dashboard

### Feedback & Analytics
- `POST /feedback` - Submit user feedback for charts
- `GET /feedback/stats` - Get aggregated feedback statistics
- `GET /audit/stats` - Get system usage statistics

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health status

## Architecture

### Services
- **OpenAIService**: AI-powered chart specification generation
- **MetricsService**: Data processing, caching, and transformation
- **DataAnalysisService**: Intelligent data structure analysis
- **IrisApiService**: External API client for data fetching
- **DashboardService**: Multi-chart orchestration and layout
- **AuditService**: Request logging and analytics

### Data Models
All data models use Pydantic for type safety and validation:
- **ChatDto**: Chat request structure
- **DashboardDto**: Dashboard generation request
- **FeedbackDto**: User feedback structure
- **MetricInfo**: Metric metadata and analysis
- **ChartResponse**: Chart generation response

## Chart Types Supported

1. **Line Charts**: Time series trends and patterns
2. **Bar Charts**: Category comparisons and discrete values
3. **Stacked Bar Charts**: Composition and part-to-whole relationships
4. **Heatmaps**: Intensity patterns across dimensions
5. **Waterfall Charts**: Cumulative changes and contributions

## Development

### Project Structure
```
server_python/
├── app/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration management
│   ├── models/
│   │   └── dtos.py          # Pydantic data models
│   ├── services/            # Business logic services
│   ├── controllers/         # API route handlers
│   └── utils/               # Utility functions
├── audit-logs/              # Audit log storage
├── requirements.txt         # Python dependencies
├── start.py                # Server startup script
└── README.md               # This file
```

### Testing

Run tests with pytest:

```bash
pytest
```

### Logging

The application uses Python's built-in logging with INFO level by default. Logs include:
- Request/response cycles
- Error handling and debugging
- Performance metrics
- API interaction details

## Migration from TypeScript

This Python implementation maintains full API compatibility with the original NestJS TypeScript server while providing:
- Better data processing performance with native Python libraries
- Improved type safety with Pydantic models
- Modern async/await patterns
- Enhanced error handling and logging
- Simplified deployment and scaling options

## Performance

- **Caching**: TTL-based in-memory caching for API responses
- **Async Processing**: Full async/await implementation for I/O operations
- **Connection Pooling**: HTTP client connection reuse
- **Data Processing**: Optimized Python data manipulation

## Monitoring

The server provides several monitoring endpoints:
- Audit statistics for usage tracking
- Feedback analytics for user satisfaction
- Health check endpoints for uptime monitoring
- Comprehensive logging for debugging and analysis