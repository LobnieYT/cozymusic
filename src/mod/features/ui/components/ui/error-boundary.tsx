import { Component, type ReactNode } from "react";

/** Страховка: падение одной карточки/панели никогда не роняет всё меню. */
export class ErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { error: string | null }
> {
  constructor(props: { children: ReactNode; label: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: any) {
    return { error: String(e?.message || e) };
  }
  componentDidCatch(e: any) {
    console.error(`[cozymusic] UI crashed (${this.props.label}):`, e);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="m-3 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2">
          <span className="text-sm font-semibold text-red-300">
            Ошибка в «{this.props.label}»
          </span>
          <details className="text-muted-foreground mt-1 text-xs">
            <summary className="cursor-pointer">Подробности (покажи разработчику)</summary>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap">{this.state.error}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
