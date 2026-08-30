import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pos")({
  component: Pos,
});

function Pos() {
  return <div className="p-6">Pos</div>;
}
