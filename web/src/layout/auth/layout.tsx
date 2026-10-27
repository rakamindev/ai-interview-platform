import React from "react";

interface LayoutAuthProps {
  children: React.ReactNode;
  title: string;
}

export default function LayoutAuth({ children, title }: LayoutAuthProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">AI Interview</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
        </div>

        {children}
      </div>
    </div>
  );
}
