import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: Suppliers,
});

function Suppliers() {
  return <div className="p-6">Suppliers</div>;
}
