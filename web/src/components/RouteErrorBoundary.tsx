import { Component, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  routeName?: string;
  showSessionRecovery?: boolean;
}

interface State {
  hasError: boolean;
}

class RouteErrorBoundaryInner extends Component<
  Props & { navigate: (path: string) => void },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <p className="font-medium text-lg">Something went wrong.</p>
            {this.props.showSessionRecovery ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Your interview progress has been saved. You can try refreshing to reconnect, or
                  contact the interviewer if the problem persists.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="text-sm text-primary underline"
                    onClick={() => window.location.reload()}
                  >
                    Reconnect
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    className="text-sm text-muted-foreground underline"
                    onClick={() => this.props.navigate("/")}
                  >
                    Go to home
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Please refresh the page. If the problem persists, contact support.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="text-sm text-primary underline"
                    onClick={() => window.location.reload()}
                  >
                    Refresh
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    className="text-sm text-muted-foreground underline"
                    onClick={() => this.props.navigate("/")}
                  >
                    Go to home
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RouteErrorBoundary({
  children,
  routeName,
  showSessionRecovery = false
}: Props) {
  const navigate = useNavigate();
  return (
    <RouteErrorBoundaryInner
      navigate={navigate}
      routeName={routeName}
      showSessionRecovery={showSessionRecovery}
    >
      {children}
    </RouteErrorBoundaryInner>
  );
}
