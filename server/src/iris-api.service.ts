import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { buildIrisHeaders } from './config/iris.config';

interface IrisApiFilters {
    startDate: string;
    endDate: string;
    isCashRefundSelected: boolean;
    salesChannels: {
        DTC: {
            channels: {
                [key: string]: {
                    stores: {
                        [key: string]: {
                            subchannels: string[];
                        };
                    };
                };
            };
        };
        Wholesale: {
            channels: Record<string, unknown>;
        };
    };
}

interface IrisApiPayload {
    filters: IrisApiFilters;
}

@Injectable()
export class IrisApiService {
    private readonly logger = new Logger(IrisApiService.name);
    private readonly apiUrl = process.env.IRIS_API_URL || 'https://api.irisfinance.co/metrics';
    private readonly apiToken = process.env.IRIS_API_TOKEN;

    constructor(private readonly httpService: HttpService) { }

    /**
     * Fetch metrics data from Iris Finance API
     * @param dateRange Optional date range (YYYY or YYYY-MM format)
     * @returns Promise<any> - The metrics data from the API
     */
    async fetchMetrics(dateRange?: string): Promise<any> {
        if (!this.apiToken) {
            throw new Error('IRIS_API_TOKEN environment variable is required');
        }

        try {
            // Parse date range or use current defaults
            const { startDate, endDate } = this.parseDateRange(dateRange);

            const payload: IrisApiPayload = {
                filters: {
                    startDate,
                    endDate,
                    isCashRefundSelected: false,
                    salesChannels: {
                        DTC: {
                            channels: {
                                "Amazon Seller Partner": {
                                    stores: {
                                        US: {
                                            subchannels: ["amazon"]
                                        }
                                    }
                                },
                                Shopify: {
                                    stores: {
                                        yoprettyboy: {
                                            subchannels: [
                                                "buy button", "point of sale", "faire", "facebook & instagram",
                                                "unknown", "iphone", "shop", "tiktok", "draft order",
                                                "subscription", "online store"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        Wholesale: {
                            channels: {}
                        }
                    }
                }
            };

            const headers = buildIrisHeaders(this.apiToken);

            this.logger.log(`Fetching metrics from Iris API for date range: ${startDate} to ${endDate}`);

            const response = await firstValueFrom(
                this.httpService.post(this.apiUrl, payload, { headers })
            );

            this.logger.log(`Successfully fetched metrics data from Iris API`);
            return (response as any).data;

        } catch (error: any) {
            this.logger.error('Error fetching data from Iris API:', error);
            if (error.response) {
                this.logger.error('API Response Status:', error.response.status);
                this.logger.error('API Response Data:', error.response.data);
            }
            const errorMessage = error.message || 'Unknown error occurred';
            throw new Error(`Failed to fetch data from Iris Finance API: ${errorMessage}`);
        }
    }

    /**
 * Parse date range string and return start/end dates
 * Supports multiple formats: YYYY, YYYY-MM, YYYY-MM-DD, ISO strings, and custom ranges
 * @param dateRange Date range in various formats
 * @returns Object with startDate and endDate in ISO format
 */
    private parseDateRange(dateRange?: string): { startDate: string; endDate: string } {
        if (!dateRange) {
            // Default to current week for API calls
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - 6); // 7 days ago

            return {
                startDate: startOfWeek.toISOString(),
                endDate: now.toISOString()
            };
        }

        // Handle custom date ranges from frontend: "startISO,endISO"
        if (dateRange.includes(',')) {
            const [startDate, endDate] = dateRange.split(',');

            // If already in ISO format, use as-is
            if (startDate.includes('T') && endDate.includes('T')) {
                return {
                    startDate: startDate,
                    endDate: endDate
                };
            }

            // If in YYYY-MM-DD format, convert to ISO
            return {
                startDate: `${startDate}T00:00:00.000Z`,
                endDate: `${endDate}T23:59:59.999Z`
            };
        }

        // Handle single date values (YYYY-MM-DD format from frontend presets)
        if (dateRange.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Single day range
            return {
                startDate: `${dateRange}T00:00:00.000Z`,
                endDate: `${dateRange}T23:59:59.999Z`
            };
        }

        // Handle year format (YYYY)
        if (dateRange.match(/^\d{4}$/)) {
            const year = parseInt(dateRange);
            return {
                startDate: `${year}-01-01T00:00:00.000Z`,
                endDate: `${year}-12-31T23:59:59.999Z`
            };
        }

        // Handle month format (YYYY-MM)
        if (dateRange.match(/^\d{4}-\d{2}$/)) {
            const [year, month] = dateRange.split('-').map(n => parseInt(n));
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of month

            return {
                startDate: startDate.toISOString().replace(/T.*/, 'T00:00:00.000Z'),
                endDate: endDate.toISOString().replace(/T.*/, 'T23:59:59.999Z')
            };
        }

        this.logger.warn(`Unrecognized date range format: ${dateRange}, using default week range`);

        // Fallback to current week
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 6);

        return {
            startDate: startOfWeek.toISOString(),
            endDate: now.toISOString()
        };
    }
} 