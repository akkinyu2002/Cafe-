// Fill these values from Supabase Project Settings -> API.
// Keep anon key only. Never put service_role key in frontend code.
// `requireAuthForOrders: true` means users must sign in before placing/syncing orders.
window.KanigiriSupabaseConfig = {
  url: "https://lxfwqeotuxjhwlojkhnl.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZndxZW90dXhqaHdsb2praG5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2OTA1ODQsImV4cCI6MjA5MDI2NjU4NH0.fuKOaRjEe79VyOjMZ7Mf3sij2mYVbLbAhTOcgEjj-SY",
  schema: "public",
  ordersTable: "orders",
  requireAuthForOrders: true
};
