import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeError, fieldErrorOf } from "@/lib/errors";

const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim() === "") errors.name = "Informe seu nome.";

  if (email.trim() === "") errors.email = "Informe seu e-mail.";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "E-mail inválido.";

  if (password === "") errors.password = "Informe uma senha.";
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return errors;
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const errors = validate(name, email, password);
    setInvalid(errors);
    setFailure(null);

    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await signUp({ name, email, password });
      void navigate("/orders", { replace: true });
    } catch (error) {
      setFailure(error);
    } finally {
      setPending(false);
    }
  }

  const nameError = invalid.name ?? fieldErrorOf(failure, "name");
  const emailError = invalid.email ?? fieldErrorOf(failure, "email");
  const passwordError = invalid.password ?? fieldErrorOf(failure, "password");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-3xl font-semibold font-stretch-110%">
          Criar conta
        </h2>
        <p className="text-muted-foreground text-sm">
          Depois do cadastro você já entra direto.
        </p>
      </header>

      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failure)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError !== undefined}
            aria-describedby={nameError && "name-error"}
          />
          {nameError && (
            <p id="name-error" className="text-destructive text-sm">
              {nameError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={emailError !== undefined}
            aria-describedby={emailError && "email-error"}
          />
          {emailError && (
            <p id="email-error" className="text-destructive text-sm">
              {emailError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={passwordError !== undefined}
            aria-describedby={passwordError && "password-error"}
          />
          {passwordError && (
            <p id="password-error" className="text-destructive text-sm">
              {passwordError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        Já tem conta?{" "}
        <Link to="/login" className="text-foreground font-medium underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
