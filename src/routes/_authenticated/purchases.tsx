import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/purchases")({
  component: Purchases,
});

function Purchases() {
  return <div className="p-6">Purchases</div>;
}
