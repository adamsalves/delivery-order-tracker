import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeError, fieldErrorOf } from "@/lib/errors";

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};

  if (email.trim() === "") errors.email = "Informe seu e-mail.";
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "E-mail inválido.";

  if (password === "") errors.password = "Informe sua senha.";

  return errors;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  const target =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/orders";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const errors = validate(email, password);
    setInvalid(errors);
    setFailure(null);

    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await signIn({ email, password });
      void navigate(target, { replace: true });
    } catch (error) {
      setFailure(error);
    } finally {
      setPending(false);
    }
  }

  const emailError = invalid.email ?? fieldErrorOf(failure, "email");
  const passwordError = invalid.password ?? fieldErrorOf(failure, "password");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="font-display text-3xl font-semibold font-stretch-110%">
          Entrar
        </h2>
        <p className="text-muted-foreground text-sm">
          Acesse para acompanhar os pedidos.
        </p>
      </header>

      {failure !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failure)}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
            autoComplete="current-password"
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
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">
        Não tem conta?{" "}
        <Link to="/register" className="text-foreground font-medium underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
