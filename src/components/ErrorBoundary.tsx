import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Evita pantalla en blanco en producción; el detalle queda en consola.
    console.error('Error no controlado en el panel:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0A0A26] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <h1 className="text-white font-bold text-lg">Ocurrió un error</h1>
            <p className="text-white/60 text-sm mt-2">
              El panel encontró un problema inesperado. Recarga la página e intenta de nuevo.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 rounded-lg bg-[#6236FF] text-white text-sm font-semibold hover:brightness-110"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
