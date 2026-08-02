import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NewOrderPage() {
  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl font-semibold font-stretch-110%">
        Novo pedido
      </h1>
      <p className="text-muted-foreground text-sm">
        O formulário de criação ainda não está disponível.
      </p>
      <Button variant="outline" asChild>
        <Link to="/orders">Voltar para os pedidos</Link>
      </Button>
    </section>
  );
}
