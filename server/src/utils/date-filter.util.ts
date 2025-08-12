/**
 * Utility class for handling date range filtering operations
 * Consolidates duplicate date filtering logic from multiple services
 */
export class DateFilterUtil {
    /**
     * Filter array of items by date range
     * @param items - Array of items to filter
     * @param dateField - Name of the date field in each item
     * @param dateRange - Date range string (YYYY, YYYY-MM, YYYY-MM-DD, or ISO range)
     * @returns Filtered array of items
     */
    static filterByDateRange<T extends Record<string, any>>(
        items: T[], 
        dateField: string, 
        dateRange?: string
    ): T[] {
        if (!dateRange || !items.length) return items;
        
        return items.filter(item => {
            if (!item[dateField]) return false;
            
            // Handle custom ISO date ranges (e.g., "2025-05-06T00:00:00.000Z,2025-08-04T23:59:59.999Z")
            if (dateRange.includes(',')) {
                const [startISO, endISO] = dateRange.split(',');
                const startDate = this.extractDatePart(startISO);
                const endDate = this.extractDatePart(endISO);
                const itemDate = this.extractDatePart(item[dateField]);
                
                return itemDate >= startDate && itemDate <= endDate;
            }
            
            // Handle YYYY-MM-DD format
            if (this.isFullDateFormat(dateRange)) {
                return item[dateField].startsWith(dateRange);
            }
            
            // Handle YYYY-MM and YYYY formats
            return item[dateField] && item[dateField].startsWith(dateRange);
        });
    }

    /**
     * Filter date indices for grouped series data
     * @param dates - Array of date strings
     * @param dateRange - Date range string
     * @returns Array of filtered indices
     */
    static getDateIndicesInRange(dates: string[], dateRange?: string): number[] {
        if (!dateRange || !dates.length) return dates.map((_, i) => i);
        
        const filteredIndices: number[] = [];
        
        dates.forEach((date, index) => {
            if (!date) return;
            
            // Handle custom ISO date ranges
            if (dateRange.includes(',')) {
                const [startISO, endISO] = dateRange.split(',');
                const startDate = this.extractDatePart(startISO);
                const endDate = this.extractDatePart(endISO);
                const itemDate = this.extractDatePart(date);
                
                if (itemDate >= startDate && itemDate <= endDate) {
                    filteredIndices.push(index);
                }
            }
            // Handle YYYY-MM-DD format
            else if (this.isFullDateFormat(dateRange)) {
                if (date.startsWith(dateRange)) {
                    filteredIndices.push(index);
                }
            }
            // Handle YYYY-MM and YYYY formats
            else if (date.startsWith(dateRange)) {
                filteredIndices.push(index);
            }
        });
        
        return filteredIndices;
    }

    /**
     * Validate date range format
     * @param dateRange - Date range string to validate
     * @returns True if format is valid
     */
    static isValidDateRangeFormat(dateRange: string): boolean {
        if (!dateRange) return false;
        
        return (
            /^\d{4}$/.test(dateRange) ||                                    // YYYY
            /^\d{4}-\d{2}$/.test(dateRange) ||                             // YYYY-MM
            /^\d{4}-\d{2}-\d{2}$/.test(dateRange) ||                       // YYYY-MM-DD
            /^\d{4}-\d{2}-\d{2}T.*,\d{4}-\d{2}-\d{2}T.*$/.test(dateRange)  // Custom ISO range
        );
    }

    /**
     * Extract date part (YYYY-MM-DD) from ISO string or date
     * @param dateStr - Date string to extract from
     * @returns Date part in YYYY-MM-DD format
     */
    private static extractDatePart(dateStr: string): string {
        return dateStr.split('T')[0];
    }

    /**
     * Check if date range is in full date format (YYYY-MM-DD)
     * @param dateRange - Date range to check
     * @returns True if full date format
     */
    private static isFullDateFormat(dateRange: string): boolean {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateRange);
    }
}