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

/**
 * Mirrors @Size(max = 255) on the register request, itself the width of the column behind each
 * field. Counted on the value as typed, because that is the value the server measures: it trims the
 * address only once validation has already run, and never trims the name at all.
 */
const MAX_TEXT_LENGTH = 255;

/** BCrypt's own ceiling, which the API enforces. Counted in bytes, so an accent costs two. */
const MAX_PASSWORD_BYTES = 72;

/** Register is the only call that can conflict, so a 409 here is never a status transition. */
const EMAIL_TAKEN = { 409: "Este e-mail já está cadastrado." };

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (name.trim() === "") errors.name = "Informe seu nome.";
  else if (name.length > MAX_TEXT_LENGTH) errors.name = tooLong();

  if (email.trim() === "") errors.email = "Informe seu e-mail.";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "E-mail inválido.";
  else if (email.length > MAX_TEXT_LENGTH) errors.email = tooLong();

  if (password === "") errors.password = "Informe uma senha.";
  else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha precisa de ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    errors.password = `A senha é longa demais (máximo de ${MAX_PASSWORD_BYTES} bytes; acentos contam como dois).`;
  }

  return errors;
}

/** The same sentence the order form uses for the same ceiling, so the two screens agree. */
function tooLong(): string {
  return `No máximo ${MAX_TEXT_LENGTH} caracteres.`;
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
          <AlertDescription>
            {describeError(failure, EMAIL_TAKEN)}
          </AlertDescription>
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
