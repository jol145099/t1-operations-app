# Supabase setup

1. Create a new Supabase project.
2. Open **SQL Editor** and run `schema.sql`.
3. In **Authentication > Providers > Email**, keep Email/Password enabled.
4. Create test users in Authentication.
5. Each new auth user gets a `profiles` row automatically.
6. For a customer login:
   - set `profiles.role = 'customer'`
   - create one `customers` row with `profile_id = auth user id`
7. For a player login:
   - set `profiles.role = 'player'`
   - create one `players` row with `profile_id = auth user id`
8. For staff/admin:
   - change `profiles.role` to `staff` or `admin`.
9. Copy the project URL and **publishable key** into `.env`.

Never put the service-role key inside the Expo app.
