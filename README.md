# Kanigiri Cafe

Welcome to Kanigiri Cafe, where you can enjoy the best Japanese snacks and beverages! Our mission is to provide high-quality products with authentic flavors and a warm atmosphere. Come and visit us!

## Live Demo

You can view my project live at: [Demo](https://akkinyu2002.github.io/Cafe-/)

## Supabase Online Orders Setup

The project now uses Supabase Auth + RLS-secured online orders.

1. Create a Supabase project.
2. In SQL Editor, run [`senior-cafe-restaurant-site/supabase-setup.sql`](senior-cafe-restaurant-site/supabase-setup.sql).
3. Open [`senior-cafe-restaurant-site/supabase-config.js`](senior-cafe-restaurant-site/supabase-config.js) and set:
   - `url`: your Supabase project URL
   - `anonKey`: your Supabase anon/public key
   - `requireAuthForOrders`: keep `true` for secure mode
4. In Supabase Authentication settings, disable email confirmation if you want instant sign-up login (optional).

### Existing User + New User Flow

1. Existing user can sign in from website checkout account box.
2. New user can click `Create Account` in checkout account box, then sign in.
3. Signed-in users can place orders; each user sees only their own orders by policy.
4. To make an admin:
   - Create/sign in that account once so it exists in `auth.users`.
   - Run this SQL with that email:
     - `insert into public.admin_users (user_id) select id from auth.users where email = 'your-admin@example.com' on conflict (user_id) do nothing;`
5. Admin user signs in at `/admin.html` using the same Supabase email/password.

If `url` or `anonKey` is empty, the app falls back to local browser storage mode.

