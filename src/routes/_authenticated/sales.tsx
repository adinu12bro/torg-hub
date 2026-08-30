import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sales")({
  component: Sales,
});

function Sales() {
  return <div className="p-6">Sales</div>;
}
