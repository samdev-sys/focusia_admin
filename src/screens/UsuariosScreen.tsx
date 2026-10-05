import { useState } from 'react';
import {
  Search, Sparkles, Send, Plus, Pencil, Trash2, Loader2, Bot,
} from 'lucide-react';
import {
  adminService, leerError,
  type UsuarioFicha, type ChatMensaje, type Asignacion,
} from '../lib/adminApi';
import AsignacionesEditor from './AsignacionesEditor';
import {
  Button, Card, PageHeader, Field, Input, Select, Modal, Aviso,
  Cargando, Vacio, Checkbox, useConfirmacion, useCarga,
} from '../components/ui';

const INSIGNIA_MEMBRESIA: Record<string, string> = {
  vigente:
    'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  proxima:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  vencida: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

function InsigniaMembresia({ ficha }: { ficha: UsuarioFicha }) {
  if (!ficha.membresia) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">
        Sin membresía
      </span>
    );
  }
  const m = ficha.membresia;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${INSIGNIA_MEMBRESIA[m.estado]}`}
      title={`${m.fecha_inicio} → ${m.fecha_fin}`}
    >
      {m.estado} · {m.dias_restantes}d
    </span>
  );
}

export default function UsuariosScreen() {
  const [q, setQ] = useState('');
  const [filtroMembresia, setFiltroMembresia] = useState('');
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const { datos, cargando, error, recargar } = useCarga(
    () => adminService.listarUsuarios({
      q: q || undefined,
      membresia: filtroMembresia || undefined,
    }),
    [q, filtroMembresia],
  );

  return (
    <>
      <PageHeader
        titulo="Usuarios e IA"
        descripcion="Nivel por mes alcanzado, membresías y asistente con IA."
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <Card
            titulo="Personas usuarias"
            descripcion="El nivel es el mes más alto con capacitación completada."
            acciones={
              <button
                onClick={recargar}
                className="text-xs font-semibold text-[#6236FF] hover:underline"
              >
                Actualizar
              </button>
            }
          >
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre o correo…"
                  className="pl-8"
                />
              </div>
              <Select
                value={filtroMembresia}
                onChange={(e) => setFiltroMembresia(e.target.value)}
                className="sm:w-44"
              >
                <option value="">Todas</option>
                <option value="vigente">Vigente</option>
                <option value="vencida">Vencida</option>
                <option value="sin">Sin membresía</option>
              </Select>
            </div>

            {cargando && <Cargando texto="Cargando usuarios…" />}
            {error && <Aviso tipo="error">{error}</Aviso>}
            {!cargando && !error && (datos ?? []).length === 0 && (
              <Vacio>No hay usuarios con ese filtro.</Vacio>
            )}
            <div className="space-y-2">
              {(datos ?? []).map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSeleccionado(u.id)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                    seleccionado === u.id
                      ? 'border-[#6236FF] bg-purple-50 dark:bg-white/5'
                      : 'border-gray-100 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#6236FF] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      N{u.nivel}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                        {u.username}
                        {u.is_staff && (
                          <span className="ml-1.5 text-[9px] font-bold text-purple-600 dark:text-purple-300">
                            STAFF
                          </span>
                        )}
                        {u.asignaciones && Object.keys(u.asignaciones).length > 0 && (
                          <span className="ml-1.5 px-1.5 py-px rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            asignado
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {u.capacitaciones_completadas}/{u.capacitaciones_totales} caps · meses {u.recursos_desbloqueados.join(', ') || '—'}
                      </p>
                    </div>
                    <InsigniaMembresia ficha={u} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ChatAsistente />
        </div>
      </div>

      {seleccionado !== null && (
        <DetalleUsuario
          id={seleccionado}
          onCerrar={() => setSeleccionado(null)}
          onCambio={recargar}
        />
      )}
    </>
  );
}

// ── Chat del admin con la IA ──

function ChatAsistente() {
  const [historial, setHistorial] = useState<ChatMensaje[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);

  const enviar = async () => {
    const texto = pregunta.trim();
    if (!texto || pensando) return;
    setPregunta('');
    setError(null);
    setPensando(true);
    const nuevo = [...historial, { rol: 'admin' as const, texto }];
    setHistorial(nuevo);
    try {
      const r = await adminService.asistenteChat(texto, nuevo);
      setFuente(r.fuente);
      setHistorial([...nuevo, { rol: 'ia', texto: r.respuesta }]);
    } catch (e) {
      setError(leerError(e));
    } finally {
      setPensando(false);
    }
  };

  return (
    <Card
      titulo="Asistente IA"
      descripcion={
        fuente === 'reglas'
          ? 'Modo reglas (sin GROQ_API_KEY).'
          : 'Pregunta por niveles, membresías y rezagados.'
      }
    >
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-3">
        {historial.length === 0 && (
          <p className="text-[11px] text-gray-400 py-6 text-center">
            Ej.: «¿Quiénes tienen la membresía vencida?» o «¿Quién está listo para el mes 5?»
          </p>
        )}
        {historial.map((m, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
              m.rol === 'admin'
                ? 'bg-[#6236FF] text-white self-end max-w-[90%]'
                : 'bg-gray-100 dark:bg-white/10 text-slate-700 dark:text-gray-200 self-start max-w-[95%]'
            }`}
          >
            {m.rol === 'ia' && (
              <Bot className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5 text-[#6236FF] dark:text-purple-300" />
            )}
            {m.texto}
          </div>
        ))}
        {pensando && (
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pensando…
          </p>
        )}
      </div>
      {error && (
        <div className="mb-2">
          <Aviso tipo="error">{error}</Aviso>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="Pregunta a la IA…"
        />
        <Button onClick={enviar} cargando={pensando} titulo="Enviar">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
}

// ── Detalle: análisis IA + membresías ──

function DetalleUsuario({
  id, onCerrar, onCambio,
}: {
  id: number; onCerrar: () => void; onCambio: () => void;
}) {
  const detalle = useCarga(() => adminService.verUsuario(id), [id]);
  const [analisis, setAnalisis] = useState<string | null>(null);
  const [fuente, setFuente] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorIa, setErrorIa] = useState<string | null>(null);
  const [editando, setEditando] = useState<{
    id: number; fecha_inicio: string; fecha_fin: string; nota: string;
  } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const confirmar = useConfirmacion();

  const analizar = async () => {
    setAnalizando(true);
    setErrorIa(null);
    try {
      const r = await adminService.analizarUsuario(id);
      setAnalisis(r.analisis);
      setFuente(r.fuente);
    } catch (e) {
      setErrorIa(leerError(e));
    } finally {
      setAnalizando(false);
    }
  };

  const guardarMembresia = async () => {
    if (!editando) return;
    setGuardando(true);
    setErrorForm(null);
    try {
      const datos = {
        fecha_inicio: editando.fecha_inicio,
        fecha_fin: editando.fecha_fin,
        nota: editando.nota,
      };
      if (editando.id === 0) {
        await adminService.crearMembresia({ user: id, ...datos });
      } else {
        await adminService.editarMembresia(editando.id, datos);
      }
      setEditando(null);
      detalle.recargar();
      onCambio();
    } catch (e) {
      setErrorForm(leerError(e));
    } finally {
      setGuardando(false);
    }
  };

  const f = detalle.datos;

  return (
    <>
      <Modal
        abierto
        onCerrar={onCerrar}
        titulo={f ? `${f.username} · Nivel ${f.nivel}` : 'Usuario'}
        descripcion={
          f
            ? `Mes alcanzado ${f.mes_alcanzado} · ${f.capacitaciones_completadas}/${f.capacitaciones_totales} capacitaciones`
            : undefined
        }
        ancho="max-w-3xl"
      >
        {detalle.cargando && <Cargando />}
        {detalle.error && <Aviso tipo="error">{detalle.error}</Aviso>}
        {f && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <InsigniaMembresia ficha={f} />
              <span className="text-[11px] text-gray-400">
                Recursos desbloqueados: meses {f.recursos_desbloqueados.join(', ') || '—'}
              </span>
              <span className="text-[11px] text-gray-400">
                · Ingreso {f.fecha_ingreso}
                {f.ultima_actividad ? ` · Última actividad ${f.ultima_actividad.slice(0, 10)}` : ' · Sin actividad'}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-gray-200">
                  Análisis de la IA
                </h4>
                <Button variant="suave" onClick={analizar} cargando={analizando}>
                  <Sparkles className="w-3.5 h-3.5" />
                  {analisis ? 'Reanalizar' : 'Analizar'}
                </Button>
              </div>
              {errorIa && <Aviso tipo="error">{errorIa}</Aviso>}
              {analisis ? (
                <p className="text-xs leading-relaxed whitespace-pre-wrap bg-purple-50 dark:bg-white/5 border border-purple-100 dark:border-white/10 rounded-xl px-4 py-3 text-slate-700 dark:text-gray-200">
                  {analisis}
                  {fuente === 'reglas' && (
                    <span className="block mt-1 text-[10px] text-gray-400">
                      Generado por reglas (sin GROQ_API_KEY).
                    </span>
                  )}
                </p>
              ) : (
                !analizando && (
                  <p className="text-[11px] text-gray-400">
                    La IA resume nivel, membresía y recomienda la próxima acción.
                  </p>
                )
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-gray-200">
                  Membresías
                </h4>                <Button
                  variant="suave"
                  onClick={() =>
                    setEditando({ id: 0, fecha_inicio: '', fecha_fin: '', nota: '' })
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nueva
                </Button>
              </div>
              {(f.membresias ?? []).length === 0 && (
                <p className="text-[11px] text-gray-400">Sin membresías registradas.</p>
              )}
              <div className="space-y-2">
                {(f.membresias ?? []).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-white/10 px-4 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 dark:text-gray-200">
                        {m.fecha_inicio} → {m.fecha_fin}
                        {m.nota && (
                          <span className="font-normal text-gray-400"> · {m.nota}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${INSIGNIA_MEMBRESIA[m.estado]}`}
                    >
                      {m.estado} · {m.dias_restantes}d
                    </span>
                    <Button
                      variant="ghost"
                      titulo="Editar"
                      onClick={() => setEditando({ ...m })}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      titulo="Eliminar"
                      onClick={() =>
                        confirmar.pedir(
                          'Eliminar membresía',
                          `${m.fecha_inicio} → ${m.fecha_fin}. El usuario quedará sin ese período.`,
                          async () => {
                            await adminService.borrarMembresia(m.id);
                            detalle.recargar();
                            onCambio();
                          },
                        )
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <AsignacionesEditor userId={id} onCambio={onCambio} />
          </div>
        )}
      </Modal>
      {confirmar.dialogo}

      <Modal
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
        titulo={editando?.id === 0 ? 'Nueva membresía' : 'Editar membresía'}
        descripcion="Fechas personalizadas por usuario. El fin no puede ser anterior al inicio."
        ancho="max-w-md"
        pie={
          <>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarMembresia} cargando={guardando}>
              Guardar
            </Button>
          </>
        }
      >
        {errorForm && <Aviso tipo="error">{errorForm}</Aviso>}
        {editando && (
          <div className="grid grid-cols-2 gap-3">
            <Field etiqueta="Inicio" requerido>
              <Input
                type="date"
                value={editando.fecha_inicio}
                onChange={(e) => setEditando({ ...editando, fecha_inicio: e.target.value })}
              />
            </Field>
            <Field etiqueta="Fin" requerido>
              <Input
                type="date"
                value={editando.fecha_fin}
                onChange={(e) => setEditando({ ...editando, fecha_fin: e.target.value })}
              />
            </Field>
            <div className="col-span-2">
              <Field etiqueta="Nota" ayuda="Opcional: plan, pago, acuerdo.">
                <Input
                  value={editando.nota}
                  onChange={(e) => setEditando({ ...editando, nota: e.target.value })}
                  placeholder="Ej. Plan anual pagado por transferencia"
                  maxLength={280}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
