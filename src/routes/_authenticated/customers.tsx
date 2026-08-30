import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/customers")({
  component: Customers,
});

function Customers() {
  return <div className="p-6">Customers</div>;
}
