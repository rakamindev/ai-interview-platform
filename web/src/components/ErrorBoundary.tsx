import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  // Fill the viewport when wrapping the whole app; stay inline when wrapping one page.
  fullScreen?: boolean;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  // No error-reporting service is configured; keep a tagged record in the browser console.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Page crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className={
            this.props.fullScreen === false
              ? "flex items-center justify-center p-8"
              : "min-h-screen flex items-center justify-center p-8"
          }
        >
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="font-semibold">Something went wrong.</p>
            <p className="text-sm text-muted-foreground">
              Please refresh the page. If the problem persists, contact support.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw /> Refresh
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
