import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // If it's a chunk loading error, try to reload
    if (error.message.includes('Failed to fetch dynamically imported module') || 
        error.message.includes('loading chunk')) {
      window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 text-center">
          <div className="glass-card p-8 max-w-md w-full space-y-4">
            <h1 className="text-2xl font-bold text-primary">Something went wrong</h1>
            <p className="text-muted-foreground">
              We encountered an error while loading the application. This usually happens after a new update.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
