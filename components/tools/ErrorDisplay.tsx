'use client';

import { useState } from 'react';
import { Copy, Check, AlertCircle, ChevronDown, ChevronUp, Bug } from 'lucide-react';

interface ErrorDisplayProps {
    error: string;
    details?: string;
    stack?: string;
    context?: Record<string, any>;
    onDismiss?: () => void;
    toolName?: string;
}

export default function ErrorDisplay({ 
    error, 
    details, 
    stack, 
    context,
    onDismiss,
    toolName = 'Tool'
}: ErrorDisplayProps) {
    const [copied, setCopied] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    // Format the full error log for copying
    const formatErrorLog = () => {
        const timestamp = new Date().toISOString();
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
        
        let log = `=== STS AI Tools Error Log ===
Tool: ${toolName}
Timestamp: ${timestamp}
Error: ${error}`;

        if (details) {
            log += `\nDetails: ${details}`;
        }

        if (context && Object.keys(context).length > 0) {
            log += `\n\nContext:`;
            Object.entries(context).forEach(([key, value]) => {
                log += `\n  ${key}: ${JSON.stringify(value)}`;
            });
        }

        if (stack) {
            log += `\n\nStack Trace:\n${stack}`;
        }

        log += `\n\nBrowser: ${userAgent}`;
        log += `\n==============================`;

        return log;
    };

    const handleCopy = async () => {
        const errorLog = formatErrorLog();
        try {
            await navigator.clipboard.writeText(errorLog);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = errorLog;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const hasDetails = details || stack || (context && Object.keys(context).length > 0);

    return (
        <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
            {/* Main Error Message */}
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                        <p className="text-red-800 font-medium text-sm">{error}</p>
                        {details && (
                            <p className="text-red-600 text-xs mt-1">{details}</p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-3 ml-8">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors"
                    >
                        {copied ? (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy Error Log
                            </>
                        )}
                    </button>

                    {hasDetails && (
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors"
                        >
                            <Bug className="w-3.5 h-3.5" />
                            {showDetails ? 'Hide' : 'Show'} Details
                            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                    )}

                    {onDismiss && (
                        <button
                            onClick={onDismiss}
                            className="px-3 py-1.5 text-red-600 hover:text-red-800 text-xs font-medium transition-colors"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable Details Section */}
            {showDetails && hasDetails && (
                <div className="border-t border-red-200 bg-red-100/50 p-4">
                    <pre className="text-xs text-red-800 font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-48 overflow-y-auto">
                        {formatErrorLog()}
                    </pre>
                </div>
            )}
        </div>
    );
}

// Helper function to format errors consistently
export function formatError(err: unknown): { message: string; details?: string; stack?: string } {
    if (err instanceof Error) {
        return {
            message: err.message,
            details: err.name !== 'Error' ? err.name : undefined,
            stack: err.stack,
        };
    }
    
    if (typeof err === 'string') {
        return { message: err };
    }

    if (err && typeof err === 'object') {
        const anyErr = err as any;
        return {
            message: anyErr.message || anyErr.error || JSON.stringify(err),
            details: anyErr.details || anyErr.code,
            stack: anyErr.stack,
        };
    }

    return { message: String(err) };
}

// Hook for managing error state with enhanced logging
export function useToolError(toolName: string) {
    const [errorState, setErrorState] = useState<{
        error: string;
        details?: string;
        stack?: string;
        context?: Record<string, any>;
    } | null>(null);

    const setError = (err: unknown, context?: Record<string, any>) => {
        const formatted = formatError(err);
        
        // Also log to console for debugging
        console.error(`[${toolName}] Error:`, err);
        if (context) {
            console.error(`[${toolName}] Context:`, context);
        }

        setErrorState({
            error: formatted.message,
            details: formatted.details,
            stack: formatted.stack,
            context,
        });
    };

    const clearError = () => setErrorState(null);

    return {
        errorState,
        setError,
        clearError,
        ErrorComponent: errorState ? (
            <ErrorDisplay
                error={errorState.error}
                details={errorState.details}
                stack={errorState.stack}
                context={errorState.context}
                toolName={toolName}
                onDismiss={clearError}
            />
        ) : null,
    };
}
