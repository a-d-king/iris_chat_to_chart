/**
 * Provider configurations for dependency injection
 * Centralizes all service instantiation for the refactored architecture
 */

import { ChartDataSlicer } from './data/chart-data-slicer';

// Create provider for ChartDataSlicer since it doesn't use dependency injection
export const ChartDataSlicerProvider = {
    provide: ChartDataSlicer,
    useFactory: () => new ChartDataSlicer(),
};

// Export all provider tokens for easy importing
export const PROVIDERS = [
    ChartDataSlicerProvider,
] as const;