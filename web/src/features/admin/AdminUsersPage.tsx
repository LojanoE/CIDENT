import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  type ActualizarUsuarioInput,
  type Centro,
  type CrearUsuarioInput,
  type Usuario,
} from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { db, functions } from "../../app/firebase";
import { PageHeader } from "../../components/layout";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmarDialog,
  DataList,
  EmptyState,
  Field,
  Input,
  Select,
  Sheet,
  Skeleton,
  useToast,
  type Columna,
} from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";

const crearUsuarioCallable = httpsCallable<CrearUsuarioInput, { uid: string }>(
  functions,
  "crearUsuario",
);
const actualizarUsuarioCallable = httpsCallable<ActualizarUsuarioInput, { ok: boolean }>(
  functions,
  "actualizarUsuario",
);

const ETIQUETA_ROL: Record<Usuario["rol"], string> = { admin: "Admin", profesional: "Profesional" };

export function AdminUsersPage() {
  const toast = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [centros, setCentros] = useState<Centro[] | null>(null);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [aDesactivar, setADesactivar] = useState<Usuario | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    const unsubUsuarios = onSnapshot(
      query(collection(db, "users"), orderBy("usuario")),
      (snap) => setUsuarios(snap.docs.map((d) => d.data() as Usuario)),
      (err) => toast.error(mensajeError(err)),
    );
    const unsubCentros = onSnapshot(collection(db, "centros"), (snap) =>
      setCentros(snap.docs.map((d) => ({ centroId: d.id, ...d.data() }) as Centro)),
    );
    return () => {
      unsubUsuarios();
      unsubCentros();
    };
    // `toast` es estable dentro del proveedor; no debe reabrir las suscripciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombreCentro = useMemo(() => {
    const mapa = new Map((centros ?? []).map((c) => [c.centroId, c.nombre]));
    return (id: string) => mapa.get(id) ?? id;
  }, [centros]);

  const cambiarEstado = async (usuario: Usuario) => {
    setCambiandoEstado(true);
    try {
      await actualizarUsuarioCallable({ uid: usuario.uid, activo: !usuario.activo });
      toast.ok(usuario.activo ? `«${usuario.usuario}» desactivado.` : `«${usuario.usuario}» activado.`);
    } catch (err) {
      toast.error(mensajeError(err));
    } finally {
      setCambiandoEstado(false);
      setADesactivar(null);
    }
  };

  const columnas: Columna<Usuario>[] = [
    { id: "usuario", header: "Usuario", cell: (u) => <span className="font-mono font-medium">{u.usuario}</span> },
    { id: "nombre", header: "Nombre", cell: (u) => u.nombreCompleto },
    { id: "centro", header: "Centro", cell: (u) => nombreCentro(u.centroId) },
    { id: "rol", header: "Rol", cell: (u) => ETIQUETA_ROL[u.rol] },
    {
      id: "estado",
      header: "Estado",
      cell: (u) => <Badge tone={u.activo ? "ok" : "danger"}>{u.activo ? "Activo" : "Desactivado"}</Badge>,
    },
    {
      id: "acciones",
      header: "Acciones",
      align: "right",
      cell: (u) => (
        <AccionesUsuario
          usuario={u}
          onEditar={() => setEditando(u)}
          onEstado={() => (u.activo ? setADesactivar(u) : void cambiarEstado(u))}
          deshabilitado={cambiandoEstado}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Usuarios" description="Crea cuentas y administra los accesos de tu centro." />

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        <CrearUsuarioForm centros={centros} />

        <section aria-label="Usuarios registrados" className="min-w-0">
          {usuarios === null ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : usuarios.length === 0 ? (
            <EmptyState
              icon={<UserRound aria-hidden className="h-8 w-8" />}
              title="No hay usuarios registrados"
              description="Crea el primer usuario con el formulario."
            />
          ) : (
            <DataList
              caption="Usuarios"
              items={usuarios}
              columns={columnas}
              rowKey={(u) => u.uid}
              renderCard={(u) => (
                <TarjetaUsuario
                  usuario={u}
                  centro={nombreCentro(u.centroId)}
                  onEditar={() => setEditando(u)}
                  onEstado={() => (u.activo ? setADesactivar(u) : void cambiarEstado(u))}
                  deshabilitado={cambiandoEstado}
                />
              )}
            />
          )}
        </section>
      </div>

      <EditarUsuarioSheet usuario={editando} centros={centros} onClose={() => setEditando(null)} />

      <ConfirmarDialog
        open={aDesactivar !== null}
        title="¿Desactivar este usuario?"
        description={
          aDesactivar
            ? `«${aDesactivar.usuario}» no podrá iniciar sesión hasta que lo actives de nuevo.`
            : undefined
        }
        confirmLabel="Sí, desactivar"
        variant="danger"
        loading={cambiandoEstado}
        onCancel={() => setADesactivar(null)}
        onConfirm={() => aDesactivar && void cambiarEstado(aDesactivar)}
      />
    </div>
  );
}

interface AccionesProps {
  usuario: Usuario;
  onEditar: () => void;
  onEstado: () => void;
  deshabilitado: boolean;
}

function AccionesUsuario({ usuario, onEditar, onEstado, deshabilitado }: AccionesProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" aria-label={`Editar ${usuario.usuario}`} onClick={onEditar}>
        Editar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`${usuario.activo ? "Desactivar" : "Activar"} ${usuario.usuario}`}
        disabled={deshabilitado}
        onClick={onEstado}
      >
        {usuario.activo ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}

function TarjetaUsuario({ usuario, centro, ...acciones }: AccionesProps & { centro: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{usuario.nombreCompleto}</p>
          <p className="font-mono text-13 text-ink-soft">{usuario.usuario}</p>
        </div>
        <Badge tone={usuario.activo ? "ok" : "danger"}>{usuario.activo ? "Activo" : "Desactivado"}</Badge>
      </div>
      <p className="text-13 text-ink-soft">
        {centro} · {ETIQUETA_ROL[usuario.rol]}
      </p>
      <AccionesUsuario usuario={usuario} {...acciones} />
    </div>
  );
}

function CrearUsuarioForm({ centros }: { centros: Centro[] | null }) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CrearUsuarioInput>({
    resolver: zodResolver(crearUsuarioSchema),
    defaultValues: { rol: "profesional", centroId: "", registroProfesional: "" },
  });

  const onSubmit = async (values: CrearUsuarioInput) => {
    try {
      await crearUsuarioCallable(values);
      toast.ok(`Usuario «${values.usuario}» creado.`);
      reset({ rol: "profesional", centroId: values.centroId, registroProfesional: "" });
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <h2 className="text-base font-semibold">Nuevo usuario</h2>

          <Field label="Usuario" error={errors.usuario?.message}>
            <Input autoComplete="off" {...register("usuario")} />
          </Field>
          <Field label="Contraseña" error={errors.password?.message}>
            <Input type="password" autoComplete="new-password" {...register("password")} />
          </Field>
          <Field label="Nombre completo" error={errors.nombreCompleto?.message}>
            <Input {...register("nombreCompleto")} />
          </Field>
          <Field label="Registro profesional" error={errors.registroProfesional?.message}>
            <Input {...register("registroProfesional")} />
          </Field>
          <Field label="Centro" error={errors.centroId?.message}>
            <Select {...register("centroId")}>
              <option value="">Seleccionar…</option>
              {(centros ?? []).map((c) => (
                <option key={c.centroId} value={c.centroId}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol" error={errors.rol?.message}>
            <Select {...register("rol")}>
              <option value="profesional">Profesional</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>

          <Button type="submit" loading={isSubmitting} className="w-full">
            Crear usuario
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function EditarUsuarioSheet({
  usuario,
  centros,
  onClose,
}: {
  usuario: Usuario | null;
  centros: Centro[] | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={usuario !== null}
      onClose={onClose}
      title="Editar usuario"
      description={usuario ? usuario.usuario : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <FormularioGuardar />
        </div>
      }
    >
      {usuario && <EditarUsuarioForm key={usuario.uid} usuario={usuario} centros={centros} onListo={onClose} />}
    </Sheet>
  );
}

const ID_FORM_EDITAR = "form-editar-usuario";

/** El botón vive en el pie del `Sheet`, fuera del `<form>`: se asocia por el atributo `form`. */
function FormularioGuardar() {
  return (
    <Button type="submit" form={ID_FORM_EDITAR}>
      Guardar cambios
    </Button>
  );
}

function EditarUsuarioForm({
  usuario,
  centros,
  onListo,
}: {
  usuario: Usuario;
  centros: Centro[] | null;
  onListo: () => void;
}) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ActualizarUsuarioInput>({
    resolver: zodResolver(actualizarUsuarioSchema),
    defaultValues: {
      uid: usuario.uid,
      centroId: usuario.centroId,
      rol: usuario.rol,
      nombreCompleto: usuario.nombreCompleto,
      registroProfesional: usuario.registroProfesional,
    },
  });

  const onSubmit = async (values: ActualizarUsuarioInput) => {
    try {
      await actualizarUsuarioCallable({ ...values, uid: usuario.uid });
      toast.ok("Cambios guardados.");
      onListo();
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  return (
    <form id={ID_FORM_EDITAR} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Nombre completo" error={errors.nombreCompleto?.message}>
        <Input {...register("nombreCompleto")} />
      </Field>
      <Field label="Registro profesional" error={errors.registroProfesional?.message}>
        <Input {...register("registroProfesional")} />
      </Field>
      <Field label="Centro" error={errors.centroId?.message}>
        <Select {...register("centroId")}>
          {(centros ?? []).map((c) => (
            <option key={c.centroId} value={c.centroId}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Rol" error={errors.rol?.message}>
        <Select {...register("rol")}>
          <option value="profesional">Profesional</option>
          <option value="admin">Admin</option>
        </Select>
      </Field>
      <Field
        label="Nueva contraseña (opcional)"
        hint="Déjala vacía para conservar la actual."
        error={errors.passwordNueva?.message}
      >
        <Input
          type="password"
          autoComplete="new-password"
          {...register("passwordNueva", { setValueAs: (v: string) => (v === "" ? undefined : v) })}
        />
      </Field>
    </form>
  );
}
