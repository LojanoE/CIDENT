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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div>
            <h1 className="text-xl font-semibold">CIDENT</h1>
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
    </main>
  );
}
