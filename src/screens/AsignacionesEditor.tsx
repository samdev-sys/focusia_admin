import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { adminService, leerError } from '../lib/adminApi';
import {
  Button, Aviso, Cargando, Checkbox, useCarga,
} from '../components/ui';

const TIPOS = [
  { id: 'tribu', label: 'Tribu' },
  { id: 'capacitacion', label: 'Capacitaciones' },
  { id: 'categoria', label: 'Categorías' },
  { id: 'modulo', label: 'Módulos' },
  { id: 'bloque', label: 'Visita guiada' },
  { id: 'juego', label: 'Juegos' },
  { id: 'avatar', label: 'Avatares' },
  { id: 'inspiracion', label: 'Inspiración' },
] as const;

interface Item {
  id: number;
  texto: string;
  extra?: string;
}

/** Qué contenido ve este usuario. Vacío = ve todo (default de usuarios nuevos). */
export default function AsignacionesEditor({
  userId, onCambio,
}: {
  userId: number; onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, number[]>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const catalogos = useCarga(async () => {
    const [temas, meses, categorias, bloques, juegos, avatares, inspiracion, actuales] =
      await Promise.all([
        adminService.listarTemasTribu(),
        adminService.listarMeses(),
        adminService.listarCategorias(),
        adminService.listarBloques(),
        adminService.listarJuegos(),
        adminService.listarAvatares(),
        adminService.listarInspiracion(),
        adminService.listarAsignaciones({ user: userId }),
      ]);
    const items: Record<string, Item[]> = {
      tribu: temas.map((t) => ({
        id: t.id, texto: t.titulo, extra: t.activo ? 'activo' : undefined,
      })),
      capacitacion: meses
        .filter((m) => m.training)
        .map((m) => ({
          id: m.training!.id, texto: `Mes ${m.month_number} · ${m.training!.title}`,
        })),
      categoria: categorias.map((c) => ({ id: c.id, texto: c.name })),
      modulo: categorias.flatMap((c) =>
        c.modules.map((m) => ({ id: m.id, texto: m.name, extra: c.name })),
      ),
      bloque: bloques.map((b) => ({ id: b.id, texto: b.title })),
      juego: juegos.map((j) => ({ id: j.id, texto: j.titulo })),
      avatar: avatares.map((a) => ({ id: a.id, texto: a.name })),
      inspiracion: inspiracion.map((r) => ({
        id: r.id, texto: r.titulo, extra: r.categoria_label || r.categoria,
      })),
    };
    const sel: Record<string, number[]> = {};
    for (const a of actuales) {
      sel[a.tipo] = [...(sel[a.tipo] ?? []), a.objeto_id];
    }
    setSeleccion(sel);
    return items;
  }, [userId]);

  const alternar = (tipo: string, id: number) => {
    const lista = seleccion[tipo] ?? [];
    setSeleccion({
      ...seleccion,
      [tipo]: lista.includes(id) ? lista.filter((i) => i !== id) : [...lista, id],
    });
    setOk(false);
  };

  const guardar = async (tipo: string) => {
    setGuardando(tipo);
    setError(null);
    try {
      await adminService.reemplazarAsignaciones(userId, tipo, seleccion[tipo] ?? []);
      setOk(true);
      onCambio();
    } catch (e) {
      setError(leerError(e));
    } finally {
      setGuardando(null);
    }
  };

  if (catalogos.cargando) return <Cargando texto="Cargando contenido asignable…" />;
  if (catalogos.error || !catalogos.datos) {
    return <Aviso tipo="error">{catalogos.error ?? 'No se pudo cargar.'}</Aviso>;
  }

  const items = catalogos.datos;

  return (
    <div>
      <h4 className="text-xs font-bold text-slate-700 dark:text-gray-200 mb-1">
        Contenido asignado
      </h4>
      <p className="text-[11px] text-gray-400 mb-2">
        Si un módulo queda vacío, el usuario ve todo ese módulo (default).
        Si marcás elementos, solo ve esos.
      </p>
      {error && (
        <div className="mb-2">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      {ok && (
        <div className="mb-2">
          <Aviso tipo="ok">Asignación guardada. Aplica en la próxima recarga de la app.</Aviso>
        </div>
      )}
      <div className="space-y-2">
        {TIPOS.map((t) => {
          const lista = items[t.id] ?? [];
          const elegidos = seleccion[t.id] ?? [];
          const esAbierto = abierto === t.id;
          return (
            <div
              key={t.id}
              className="rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden"
            >
              <button
                onClick={() => setAbierto(esAbierto ? null : t.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <span className="text-xs font-bold text-slate-700 dark:text-gray-200 flex-1">
                  {t.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    elegidos.length === 0
                      ? 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
                      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                  }`}
                >
                  {elegidos.length === 0 ? 'todo' : `${elegidos.length} asignados`}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${esAbierto ? 'rotate-180' : ''}`}
                />
              </button>
              {esAbierto && (
                <div className="px-4 pb-3">
                  {lista.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-2">
                      No hay contenido de este tipo para asignar.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2.5 py-2">
                      {lista.map((item) => (
                        <Checkbox
                          key={item.id}
                          etiqueta={item.texto}
                          ayuda={item.extra}
                          checked={elegidos.includes(item.id)}
                          onChange={() => alternar(t.id, item.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      onClick={() => guardar(t.id)}
                      cargando={guardando === t.id}
                    >
                      Guardar {t.label.toLowerCase()}
                    </Button>
                    {elegidos.length > 0 && (
                      <button
                        onClick={() => {
                          setSeleccion({ ...seleccion, [t.id]: [] });
                          setOk(false);
                        }}
                        className="text-[11px] font-semibold text-gray-400 hover:text-red-500"
                      >
                        Vaciar (ver todo)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
