import { Component, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "@/(paraglide)/messages.js";

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
            <p className="font-medium text-lg">{m.error.unexpected()}</p>
            {this.props.showSessionRecovery ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {m.error.session_saved()} {m.error.refresh()}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="text-sm text-primary underline"
                    onClick={() => window.location.reload()}
                  >
                    {m.error.reconnect()}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    className="text-sm text-muted-foreground underline"
                    onClick={() => this.props.navigate("/")}
                  >
                    {m.error.go_home()}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {m.error.refresh()}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="text-sm text-primary underline"
                    onClick={() => window.location.reload()}
                  >
                    {m.error.refresh_button()}
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    className="text-sm text-muted-foreground underline"
                    onClick={() => this.props.navigate("/")}
                  >
                    {m.error.go_home()}
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
