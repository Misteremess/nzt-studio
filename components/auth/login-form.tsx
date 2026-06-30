"use client";

import Image from "next/image";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { beginAuth, completeEnrollment } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "credentials" | "enroll" | "totp";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetToStart() {
    setStep("credentials");
    setCode("");
    setQrDataUrl(null);
    setSecret(null);
    setError(null);
  }

  // Login final: authorize() en el servidor revalida password + código.
  async function doSignIn() {
    const result = await signIn("credentials", {
      email,
      password,
      code,
      redirect: false,
    });
    if (result?.error) {
      setError("No se pudo iniciar sesión. Revisa el código e inténtalo de nuevo.");
      setPending(false);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  // Paso 1 — credenciales.
  async function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await beginAuth(email, password);

    if (result.status === "invalid") {
      setError("Credenciales incorrectas.");
      setPending(false);
      return;
    }
    if (result.status === "totp") {
      setStep("totp");
      setPending(false);
      return;
    }
    // enroll
    setQrDataUrl(result.qrDataUrl);
    setSecret(result.secret);
    setStep("enroll");
    setPending(false);
  }

  // Paso 2a — enrolamiento: confirmar el primer código y entrar.
  async function handleEnroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const { ok } = await completeEnrollment(email, password, code);
    if (!ok) {
      setError("Código incorrecto. Asegúrate de escanear el QR e introducir el código actual.");
      setPending(false);
      return;
    }
    await doSignIn();
  }

  // Paso 2b — login con 2FA ya configurado.
  async function handleTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    await doSignIn();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {step === "credentials" && "Iniciar sesión"}
          {step === "enroll" && "Configura tu 2FA"}
          {step === "totp" && "Verificación en dos pasos"}
        </CardTitle>
        <CardDescription className="text-xs">
          {step === "credentials" && "Introduce tus credenciales de acceso privado."}
          {step === "enroll" &&
            "Escanea el QR con Google Authenticator e introduce el código de 6 dígitos."}
          {step === "totp" && "Introduce el código de 6 dígitos de tu app de autenticación."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "credentials" && (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Comprobando..." : "Continuar"}
            </Button>
          </form>
        )}

        {step === "enroll" && (
          <form onSubmit={handleEnroll} className="space-y-4">
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <Image
                  src={qrDataUrl}
                  alt="Código QR para 2FA"
                  width={200}
                  height={200}
                  unoptimized
                  className="rounded-md border bg-white p-1"
                />
                {secret && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    ¿No puedes escanear? Introduce esta clave manualmente:
                    <br />
                    <code className="font-mono break-all">{secret}</code>
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="code-enroll">Código de verificación</Label>
              <Input
                id="code-enroll"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                required
                disabled={pending}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Activando..." : "Activar 2FA y entrar"}
            </Button>
            <button
              type="button"
              onClick={resetToStart}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Volver
            </button>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleTotp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code-totp">Código de verificación</Label>
              <Input
                id="code-totp"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                required
                autoFocus
                disabled={pending}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Accediendo..." : "Acceder"}
            </Button>
            <button
              type="button"
              onClick={resetToStart}
              className="w-full text-center text-xs text-muted-foreground hover:underline"
            >
              Volver
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
