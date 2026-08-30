import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/scan")({
  component: Scan,
});

function Scan() {
  return <div className="p-6">Scan</div>;
}
