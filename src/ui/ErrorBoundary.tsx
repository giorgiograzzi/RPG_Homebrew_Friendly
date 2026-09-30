import { Component, type ReactNode } from "react";

// Un errore di disegno non deve lasciare la pagina bianca: si vede il messaggio e si può ricaricare
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="xp-app" style={{ padding: 16 }}>
        <h2>Qualcosa non va</h2>
        <p>{this.state.error.message}</p>
        <button type="button" className="xp-btn primary" onClick={() => location.reload()}>Ricarica</button>
      </div>
    );
  }
}
