import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  component: Users,
});

function Users() {
  return <div className="p-6">Users</div>;
}
