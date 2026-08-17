import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/assessments";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mx-auto ring-8 ring-destructive/5">
              <AlertTriangle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold tracking-wider text-destructive uppercase">
                Application Error
              </span>
              <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                An unexpected error occurred while rendering this view. You can reload the page or return to the dashboard.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-muted/60 border rounded-lg text-left text-xs font-mono text-muted-foreground overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button size="sm" onClick={this.handleReset} className="gap-2">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
