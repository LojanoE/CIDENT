import { loginSchema, type LoginInput } from "@cident/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";
import { Button, Field, Input } from "../../components/ui";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginInput) => {
    setError(null);
    try {
      await login(values);
      navigate("/", { replace: true });
    } catch {
      // Mensaje genérico deliberado: no revelar si el usuario existe o no.
      setError("Usuario o contraseña incorrectos.");
    }
  };

  return (
    <main className="min-h-screen bg-bg md:grid md:grid-cols-2">
      <aside className="hidden flex-col items-center justify-center gap-6 bg-accent-wash p-10 text-center md:flex">
        <img src="/luna-dental-login.svg" alt="" aria-hidden className="w-full max-w-xs" />
        <div>
          <p className="text-2xl font-semibold text-accent">Luna-Dental</p>
          <p className="mt-1 max-w-xs text-sm text-ink-soft">Historia clínica odontológica para tus centros.</p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8 md:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <img src="/luna-dental-logo.svg" alt="" aria-hidden className="h-12 w-12 md:hidden" />
            <div>
              <h1 className="text-xl font-semibold">
                <span className="md:hidden">Luna-Dental</span>
                <span className="hidden md:inline">Bienvenido</span>
              </h1>
              <p className="text-sm text-ink-soft">Historia clínica odontológica</p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4 rounded-lg border border-line bg-surface p-5 shadow-card md:p-6"
          >
            <h2 className="text-lg font-semibold">Iniciar sesión</h2>

            <Field label="Usuario" error={errors.usuario?.message}>
              <Input id="usuario" type="text" autoComplete="username" autoCapitalize="none" {...register("usuario")} />
            </Field>

            <Field label="Contraseña" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            </Field>

            {error && (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              Ingresar
            </Button>
          </form>
        </div>
        <p className="mt-6 text-xs text-ink-soft">© Luna-Dental</p>
      </div>
    </main>
  );
}
