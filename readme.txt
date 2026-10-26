CLASS CHAT ONLINE — ACTIVITY 7

FILES
- index.html: login/sign-up screen and chat layout
- style.css: responsive styling
- script.js: Supabase authentication, message history, live updates, weather bot
- supabase-setup.sql: database tables, trigger, permissions, and RLS policies

SETUP
1. Open your Supabase project dashboard.
2. In SQL Editor, run the complete contents of supabase-setup.sql.
3. In Authentication settings:
   - Turn OFF email confirmation for this classroom activity if your instructor requires it.
   - Set minimum password length to 8.
   - Keep anonymous sign-ins OFF.
4. In Database > Publications > supabase_realtime, confirm that the messages table is enabled.
5. Open this folder in VS Code and run index.html using Live Server.
6. Sign up with a display name (2–24 characters), email, and password of at least 8 characters.
7. Open a second browser or private window and sign up another test account. Send messages to verify realtime.
8. Type /weather Manila to test the private weather bot.

SECURITY
- The browser contains only the Supabase URL and publishable key. Never use a secret or service_role key in front-end code.
- RLS is enabled. The database sets user_id from auth.uid() by default and checks that inserted messages belong to the logged-in user.
- Message text is inserted as textContent, not HTML, so tags are displayed as text.
- Do not post private or sensitive information. The project owner can access project data.

SECURITY LAB IDEAS (run only on your own test account/project)
1. Logged-out access: sign out and attempt a messages select in DevTools; it should be denied or return no rows.
2. Impersonation: try inserting a message with another user's user_id; RLS should reject it.
3. Length limit: try inserting content longer than 500 characters; the database check constraint should reject it.
4. Delete another user's message: the RLS policy should prevent deleting it.
5. XSS test: send the literal text <img src=x onerror=alert(1)>; it should display as text and not execute.
6. Token: inspect your own session token only in DevTools and do not paste it into any website or share it.

TROUBLESHOOTING
- "Invalid API key": check that the URL and publishable key in script.js match the Supabase dashboard.
- Permission denied: run the SQL setup and confirm you are logged in.
- No live updates: enable messages in the supabase_realtime publication.
- Sign-up fails waiting for email: check the Email provider's confirmation setting.
- Weather bot fails: check internet access and whether open-meteo.com is reachable.

Note: The uploaded instructor guide describes the setup and expected results, but does not include the full student activity worksheet or original setup SQL. This package implements the schema and app behavior described in that guide.