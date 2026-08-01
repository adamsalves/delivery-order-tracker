import { useParams } from "react-router";

export function OrderDetailPage() {
  const { id } = useParams();

  return (
    <section className="space-y-2">
      <h1 className="font-display text-3xl font-semibold font-stretch-110%">
        Pedido{" "}
        <span className="font-mono tabular-nums font-stretch-normal">
          #{id}
        </span>
      </h1>
      <p className="text-muted-foreground text-sm">
        Nenhum detalhe para exibir.
      </p>
    </section>
  );
}
