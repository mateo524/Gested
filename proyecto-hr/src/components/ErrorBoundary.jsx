import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-[1.75rem] border border-rose-400/20 bg-rose-500/5 p-8 text-center shadow-[0_20px_60px_rgba(2,8,23,0.25)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-7 w-7 text-rose-300">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-semibold text-white">Algo salió mal</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#9fb6c4]">
            Ocurrió un error inesperado en esta sección. Podés reintentar o volver al inicio.
          </p>
          {this.state.error?.message ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-left text-xs font-mono text-[#7a9aaa]">
              {this.state.error.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => this.handleRetry()}
              className="rounded-2xl bg-[#14b8a6] px-5 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl border border-white/15 px-5 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
