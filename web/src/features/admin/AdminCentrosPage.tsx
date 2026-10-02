import {
  actualizarCentroSchema,
  LOGO_MAX_BYTES,
  type ActualizarCentroInput,
  type Centro,
} from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { httpsCallable } from "firebase/functions";
import { Building2, ImageUp } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { functions } from "../../app/firebase";
import { PageHeader } from "../../components/layout";
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  useToast,
} from "../../components/ui";
import { mensajeError } from "../../lib/mensajeError";
import { LOGO_RESPALDO, useCentros, useLogoCentroUrl } from "../centros/centrosApi";

const actualizarCentroCallable = httpsCallable<ActualizarCentroInput, { ok: boolean }>(
  functions,
  "actualizarCentro",
);

function leerArchivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const resultado = reader.result as string;
      // "data:image/png;base64,AAAA..." -> "AAAA..."
      resolve(resultado.slice(resultado.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function AdminCentrosPage() {
  const centros = useCentros();
  const [centroId, setCentroId] = useState<string | null>(null);

  useEffect(() => {
    if (!centroId && centros && centros.length > 0) {
      setCentroId(centros[0].centroId);
    }
  }, [centros, centroId]);

  const centro = centros?.find((c) => c.centroId === centroId) ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Centros" description="Datos, logo y pie de página que aparecen en los PDF." />

      {centros === null ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-11 max-w-xs" />
          <Skeleton className="h-80" />
        </div>
      ) : centros.length === 0 ? (
        <EmptyState
          icon={<Building2 aria-hidden className="h-8 w-8" />}
          title="No hay centros registrados"
          description="Los centros se crean desde el proceso de alta del sistema."
        />
      ) : (
        <div className="space-y-4">
          {centros.length > 1 && (
            <Field label="Centro" className="max-w-xs">
              <Select value={centroId ?? ""} onChange={(e) => setCentroId(e.target.value)}>
                {centros.map((c) => (
                  <option key={c.centroId} value={c.centroId}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {centro && <CentroForm key={centro.centroId} centro={centro} />}
        </div>
      )}
    </div>
  );
}

type LogoNuevo = { base64: string; mimeType: "image/png" | "image/jpeg" };

function valoresDe(centro: Centro): ActualizarCentroInput {
  return {
    centroId: centro.centroId,
    nombre: centro.nombre,
    direccion: centro.direccion,
    telefono: centro.telefono,
    piePdf: centro.piePdf,
  };
}

function CentroForm({ centro }: { centro: Centro }) {
  const toast = useToast();
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [logoNuevo, setLogoNuevo] = useState<LogoNuevo | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logoActualUrl = useLogoCentroUrl(centro.centroId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActualizarCentroInput>({
    resolver: zodResolver(actualizarCentroSchema),
    defaultValues: valoresDe(centro),
  });

  useEffect(() => {
    reset(valoresDe(centro));
    setPreviewLocal(null);
    setLogoNuevo(null);
    setQuitarLogo(false);
  }, [centro, reset]);

  useEffect(() => {
    return () => {
      if (previewLocal) URL.revokeObjectURL(previewLocal);
    };
  }, [previewLocal]);

  const manejarSeleccionLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > LOGO_MAX_BYTES) {
      toast.error("La imagen supera 1 MB.");
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("El logo debe ser una imagen PNG o JPEG.");
      return;
    }

    try {
      const base64 = await leerArchivoBase64(file);
      setLogoNuevo({ base64, mimeType: file.type });
      setQuitarLogo(false);
      setPreviewLocal(URL.createObjectURL(file));
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const marcarQuitarLogo = () => {
    setQuitarLogo(true);
    setLogoNuevo(null);
    setPreviewLocal(null);
  };

  const onSubmit = async (values: ActualizarCentroInput) => {
    try {
      await actualizarCentroCallable({
        ...values,
        centroId: centro.centroId,
        logo: logoNuevo ?? undefined,
        quitarLogo: quitarLogo || undefined,
      });
      toast.ok("Centro actualizado.");
      setLogoNuevo(null);
      setQuitarLogo(false);
      setPreviewLocal(null);
    } catch (err) {
      toast.error(mensajeError(err));
    }
  };

  const vistaLogo = previewLocal ?? (quitarLogo ? LOGO_RESPALDO : logoActualUrl);
  const hayLogoPendiente = logoNuevo !== null || quitarLogo;

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <h2 className="text-base font-semibold">{centro.nombre}</h2>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <img
              src={vistaLogo}
              alt="Logo del centro"
              className="h-20 w-40 shrink-0 rounded-md border border-line bg-bg object-contain"
            />
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => void manejarSeleccionLogo(e)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                  <ImageUp aria-hidden className="h-4 w-4" />
                  Cambiar logo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={marcarQuitarLogo}>
                  Quitar logo
                </Button>
              </div>
              <p className="text-13 text-ink-soft">
                {hayLogoPendiente
                  ? "El cambio del logo se aplicará al guardar."
                  : "PNG o JPEG, hasta 1 MB."}
              </p>
            </div>
          </div>

          <Field label="Nombre" error={errors.nombre?.message}>
            <Input {...register("nombre")} />
          </Field>
          <Field label="Dirección" error={errors.direccion?.message}>
            <Input {...register("direccion")} />
          </Field>
          <Field label="Teléfono" error={errors.telefono?.message}>
            <Input type="tel" {...register("telefono")} />
          </Field>
          <Field
            label="Pie de página de los PDFs"
            hint="Texto centrado al pie de la receta, el certificado y el resumen de atención."
            error={errors.piePdf?.message}
          >
            <Input {...register("piePdf")} />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
