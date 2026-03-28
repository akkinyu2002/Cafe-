// Fill these values from Supabase Project Settings -> API.
// Keep anon key only. Never put service_role key in frontend code.
// `requireAuthForOrders: true` means users must sign in before placing/syncing orders.
window.KanigiriSupabaseConfig = {
  url: "https://lxfwqeotuxjhwlojkhnl.supabase.co",
  anonKey: "",
  schema: "public",
  ordersTable: "orders",
  requireAuthForOrders: true
};
