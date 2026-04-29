"use client";

import React from "react";

type Props = { label: string; children: React.ReactNode };

type S = { error: Error | null };

export class PanelErrorBoundary extends React.Component<Props, S> {
  state: S = { error: null };

  static getDerivedStateFromError(error: Error): S {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/35 bg-red-950/30 p-4 text-sm text-text">
          <div className="font-medium text-red-200">{this.props.label} — ошибка рендера</div>
          <pre className="mt-2 max-h-40 overflow-auto text-xs text-red-100/90 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="mt-3 rounded-lg border border-border bg-black/30 px-3 py-1.5 text-xs"
            onClick={() => this.setState({ error: null })}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
