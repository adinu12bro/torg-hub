# Plan: Super Admin setup + finish remaining ERP modules

## Your question: "What is the super_admin login?"

There is no preset username or password. The design is: **the first account to register automatically becomes Super Admin** (via a database trigger). That did not happen as intended — your account `ainuannu0@gmail.com` is registered as **staff**, so currently nobody has Super Admin access and nobody can manage roles.

**Fix:** promote your existing account to Super Admin. After that you sign in at `/auth` with the same email + password you already use, and you will see Users & Roles, settings, and all admin features.

## Changes

1. **Promote your account to Super Admin** (one data change, no re-registration):
   - Update the `user_roles` row for `ainuannu0@gmail.com` from `staff` to `super_admin`.
   - Also fix the auto-role trigger so future edge cases cannot leave the app without an admin.

2. **Fix the outstanding build error** in `src/routes/_authenticated/inventory.tsx`:
   - The movement ledger joins `inventory_movements.user_id` to profiles with an alias PostgREST can't resolve. Remove the `profiles:user_id(full_name)` embed and join profile names client-side instead.

3. **Continue remaining modules** (as before):
   - Purchases, Suppliers, Customers, Sales History, Payments & Credit, Expenses, Reports, Notifications, Users & Roles, Settings, Audit Logs.

## Technical details

- Role change runs as: `UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = (SELECT id FROM auth.users WHERE email = 'ainuannu0@gmail.com')`
- Roles are verified server-side by `has_min_role()` / RLS policies, so promoting the row is the complete change — no code edits needed for access.
- After promotion, sign out and back in once so the app refreshes your role.
