import React, { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("PageErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 p-6 border rounded-xl bg-card shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Terjadi Kesalahan pada Halaman Ini
            </h2>
            <p className="text-sm text-muted-foreground">
              {this.props.pageName
                ? `Halaman ${this.props.pageName} mengalami gangguan tidak terduga.`
                : "Halaman ini mengalami gangguan tidak terduga."}{" "}
              Navigasi utama Anda tetap aman.
            </p>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <div className="p-3 bg-muted rounded-md text-left text-xs font-mono text-destructive overflow-x-auto max-h-36">
              {this.state.error.toString()}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/assessments"}>
              <Home className="h-4 w-4 mr-1.5" />
              Kembali ke Asesmen
            </Button>
            <Button size="sm" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Muat Ulang
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
