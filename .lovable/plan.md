# Fix the backend connection error on the published site

## What's happening

The backend connection (URL + key) was re-bound in this project's environment. The preview now renders fine: `/login` loads with no error and all three backend variables are present. The published site at `edusys-central.lovable.app`, however, is still serving the deployment that was built before the re-bind, so it keeps showing "Missing Supabase environment variable(s)".

## Fix

1. Re-publish the project so the live deployment is rebuilt with the current backend binding.
2. After the deploy completes (about a minute), load the published URL and confirm the login page renders without the error.
3. If the message still appears after the fresh deploy, re-bind the backend environment once more and re-publish; that would indicate the production build isn't picking up the key rather than a stale artifact.

## Notes

No source code changes are needed — no app file reads the backend URL or key outside the auto-generated integration clients, which read them from the environment at build/run time.
