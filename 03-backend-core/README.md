# Stage 3: Backend Core

Everything a real API needs on top of "receive a request, send a reply".

Each topic is a folder with:

- `notes.md`: the problem, the idea in plain words, how it works underneath, which option to pick when, common mistakes, questions to check yourself
- `example.js`: a small working server you run and poke with `curl`

## Setup (once)

```bash
cd 03-backend-core
pnpm install
```

## Topics

| # | Topic | In plain words |
|---|---|---|
| 01 | [Express](./01-express/) | A ready-made shop fitting instead of building it all by hand |
| 02 | [Middleware](./02-middleware/) | A row of staff every customer walks past before the counter |
| 03 | [Validation](./03-validation/) | Don't trust anything a customer hands you |
| 04 | [Project structure](./04-project-structure/) | Splitting one big file into routes, controllers, services |
| 05 | [Config and env vars](./05-config-env/) | Keeping secrets and settings out of the code |
| 06 | [Password hashing](./06-password-hashing/) | Storing passwords so even you can't read them |
| 07 | [Sessions and cookies](./07-sessions-cookies/) | Remembering who someone is between requests |
| 08 | [JWT](./08-jwt/) | A signed ID card the customer carries |
| 09 | [Authorization](./09-authorization/) | Logged in is not the same as allowed |
| 10 | CORS | Which websites may call your API from a browser |
| 11 | Security basics | Rate limiting, security headers, common attacks |
