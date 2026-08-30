import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/payments")({
  component: Payments,
});

function Payments() {
  return <div className="p-6">Payments</div>;
}
