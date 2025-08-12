import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

/**
 * Context information for error logging
 */
export interface ErrorContext {
    operation?: string;
    component?: string;
    requestId?: string;
    userId?: string;
    metadata?: Record<string, any>;
}

/**
 * Centralized error handling service
 * Provides consistent error handling, logging, and response formatting across the application
 */
@Injectable()
export class ErrorHandlerService {

    /**
     * Handle API-related errors with consistent formatting and logging
     * @param operation - Name of the operation that failed
     * @param error - The error that occurred
     * @param context - Additional context information
     * @throws Appropriate NestJS exception based on error type
     */
    handleApiError(operation: string, error: any, context?: ErrorContext): never {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const logContext = {
            operation,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            ...context
        };

        // Log the error with context
        console.error(`[${operation}] Error:`, logContext);

        // Map error types to appropriate HTTP exceptions
        if (this.isNotFoundError(errorMessage)) {
            throw new NotFoundException(this.sanitizeErrorMessage(errorMessage));
        }

        if (this.isBadRequestError(errorMessage)) {
            throw new BadRequestException(this.sanitizeErrorMessage(errorMessage));
        }

        if (this.isValidationError(errorMessage)) {
            throw new BadRequestException(this.sanitizeErrorMessage(errorMessage));
        }

        // Default to internal server error for unhandled errors
        const sanitizedMessage = `${operation} failed: ${this.sanitizeErrorMessage(errorMessage)}`;
        throw new InternalServerErrorException(sanitizedMessage);
    }

    /**
     * Handle validation errors with user-friendly messages
     * @param field - Field name that failed validation
     * @param value - Value that failed validation
     * @param requirement - What was expected
     * @param context - Additional context
     * @throws BadRequestException with detailed validation message
     */
    handleValidationError(field: string, value: any, requirement: string, context?: ErrorContext): never {
        const message = `Invalid ${field}: "${value}". ${requirement}`;
        
        const logContext = {
            operation: 'validation',
            field,
            value,
            requirement,
            timestamp: new Date().toISOString(),
            ...context
        };

        console.error('[Validation] Error:', logContext);
        throw new BadRequestException(message);
    }

    /**
     * Handle data processing errors with context
     * @param operation - Data processing operation name
     * @param dataType - Type of data being processed
     * @param error - The error that occurred
     * @param context - Additional context
     * @throws Appropriate exception based on error type
     */
    handleDataProcessingError(operation: string, dataType: string, error: any, context?: ErrorContext): never {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        const logContext = {
            operation: `data_processing_${operation}`,
            dataType,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            ...context
        };

        console.error(`[DataProcessing][${operation}] Error:`, logContext);

        if (this.isDataNotFoundError(errorMessage)) {
            throw new NotFoundException(`${dataType} not found: ${this.sanitizeErrorMessage(errorMessage)}`);
        }

        if (this.isDataFormatError(errorMessage)) {
            throw new BadRequestException(`Invalid ${dataType} format: ${this.sanitizeErrorMessage(errorMessage)}`);
        }

        throw new InternalServerErrorException(`Failed to process ${dataType}: ${this.sanitizeErrorMessage(errorMessage)}`);
    }

    /**
     * Handle external API errors (like OpenAI, Iris API)
     * @param apiName - Name of the external API
     * @param operation - Operation that was attempted
     * @param error - The error that occurred
     * @param context - Additional context
     * @throws Appropriate exception based on error type
     */
    handleExternalApiError(apiName: string, operation: string, error: any, context?: ErrorContext): never {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        const logContext = {
            operation: `external_api_${apiName}_${operation}`,
            apiName,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            ...context
        };

        console.error(`[ExternalAPI][${apiName}] Error:`, logContext);

        if (this.isAuthenticationError(errorMessage)) {
            throw new BadRequestException(`${apiName} authentication failed. Please check API credentials.`);
        }

        if (this.isRateLimitError(errorMessage)) {
            throw new BadRequestException(`${apiName} rate limit exceeded. Please try again later.`);
        }

        if (this.isTimeoutError(errorMessage)) {
            throw new InternalServerErrorException(`${apiName} request timed out. Please try again.`);
        }

        throw new InternalServerErrorException(`${apiName} service unavailable: ${this.sanitizeErrorMessage(errorMessage)}`);
    }

    /**
     * Log information messages with consistent formatting
     * @param operation - Operation name
     * @param message - Information message
     * @param context - Additional context
     */
    logInfo(operation: string, message: string, context?: ErrorContext): void {
        const logContext = {
            operation,
            message,
            level: 'INFO',
            timestamp: new Date().toISOString(),
            ...context
        };

        console.log(`[${operation}] Info:`, logContext);
    }

    /**
     * Log warning messages with consistent formatting
     * @param operation - Operation name
     * @param message - Warning message
     * @param context - Additional context
     */
    logWarning(operation: string, message: string, context?: ErrorContext): void {
        const logContext = {
            operation,
            message,
            level: 'WARNING',
            timestamp: new Date().toISOString(),
            ...context
        };

        console.warn(`[${operation}] Warning:`, logContext);
    }

    /**
     * Check if error indicates a "not found" condition
     */
    private isNotFoundError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('not found') ||
               errorMessage.toLowerCase().includes('does not exist') ||
               errorMessage.toLowerCase().includes('missing');
    }

    /**
     * Check if error indicates a bad request condition
     */
    private isBadRequestError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('required') ||
               errorMessage.toLowerCase().includes('invalid') ||
               errorMessage.toLowerCase().includes('malformed');
    }

    /**
     * Check if error is a validation error
     */
    private isValidationError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('validation') ||
               errorMessage.toLowerCase().includes('format') ||
               errorMessage.toLowerCase().includes('must be');
    }

    /**
     * Check if error indicates data not found
     */
    private isDataNotFoundError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('metric') && errorMessage.toLowerCase().includes('not found') ||
               errorMessage.toLowerCase().includes('data not available') ||
               errorMessage.toLowerCase().includes('no data');
    }

    /**
     * Check if error indicates data format issues
     */
    private isDataFormatError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('format') ||
               errorMessage.toLowerCase().includes('structure') ||
               errorMessage.toLowerCase().includes('schema');
    }

    /**
     * Check if error indicates authentication issues
     */
    private isAuthenticationError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('authentication') ||
               errorMessage.toLowerCase().includes('unauthorized') ||
               errorMessage.toLowerCase().includes('api key') ||
               errorMessage.toLowerCase().includes('token');
    }

    /**
     * Check if error indicates rate limiting
     */
    private isRateLimitError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('rate limit') ||
               errorMessage.toLowerCase().includes('too many requests') ||
               errorMessage.toLowerCase().includes('quota');
    }

    /**
     * Check if error indicates timeout
     */
    private isTimeoutError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes('timeout') ||
               errorMessage.toLowerCase().includes('timed out') ||
               errorMessage.toLowerCase().includes('connection') ||
               errorMessage.toLowerCase().includes('network');
    }

    /**
     * Sanitize error messages to remove sensitive information
     * @param errorMessage - Raw error message
     * @returns Sanitized error message safe for client consumption
     */
    private sanitizeErrorMessage(errorMessage: string): string {
        // Remove potential sensitive information
        return errorMessage
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email addresses
            .replace(/\b(?:sk-|pk_|rk_)[A-Za-z0-9]{20,}\b/g, '[API_KEY]') // API keys
            .replace(/\b(?:password|pwd|secret|token)=\S+/gi, '[CREDENTIAL]') // Credentials in URLs
            .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]') // IP addresses
            .substring(0, 500); // Truncate very long messages
    }
}