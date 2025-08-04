import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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

            const headers = {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Origin': 'https://dashboard.irisfinance.co',
                'Pragma': 'no-cache',
                'Referer': 'https://dashboard.irisfinance.co/',
                'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            };

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
     * @param dateRange Date range in YYYY or YYYY-MM format
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

        if (dateRange.match(/^\d{4}$/)) {
            // Year format (YYYY)
            const year = parseInt(dateRange);
            return {
                startDate: `${year}-01-01T00:00:00.000Z`,
                endDate: `${year}-12-31T23:59:59.999Z`
            };
        }

        if (dateRange.match(/^\d{4}-\d{2}$/)) {
            // Month format (YYYY-MM)
            const [year, month] = dateRange.split('-').map(n => parseInt(n));
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0); // Last day of month

            return {
                startDate: startDate.toISOString().replace(/T.*/, 'T00:00:00.000Z'),
                endDate: endDate.toISOString().replace(/T.*/, 'T23:59:59.999Z')
            };
        }

        throw new Error(`Invalid date range format: ${dateRange}. Use YYYY or YYYY-MM format.`);
    }
} 