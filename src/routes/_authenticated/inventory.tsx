import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

function Inventory() {
  return <div className="p-6">Inventory</div>;
}
