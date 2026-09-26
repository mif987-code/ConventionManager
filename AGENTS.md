# Project Notes

- Build backend: `cd backend && npm run build`
- Build admin: `cd admin-panel && npm run build`
- Apply migrations: `cd backend && npm run db:migrate`
- Production Render deploy builds from the repository root with `npm install && npm run build` and starts with `npm start`.
- Registration concurrency load tests must run only against an isolated staging database with mock payments. Use `LOAD_TEST_CONFIRM=staging`; never load test production.
- Local database connections can intermittently time out and should be retried.
- Dropbox backups currently report `invalid_access_token`; refresh the Dropbox credential before relying on remote backup uploads.
