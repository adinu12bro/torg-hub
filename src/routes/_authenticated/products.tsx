import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/products")({
  component: Products,
});

function Products() {
  return <div className="p-6">Products</div>;
}
