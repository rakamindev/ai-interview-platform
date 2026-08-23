import { Component, type ReactNode } from "react";
import { m } from "@/paraglide/messages.js";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <p className="font-medium">{m.error.unexpected()}</p>
            <p className="text-sm text-muted-foreground">{m.error.refresh()}</p>
            <button
              className="text-sm text-primary underline"
              onClick={() => window.location.reload()}
            >
              {m.error.refresh_button()}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
