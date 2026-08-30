import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/audit")({
  component: Audit,
});

function Audit() {
  return <div className="p-6">Audit</div>;
}
