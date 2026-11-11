# Backend From Scratch

Learning backend from the very basics, one layer at a time. Every topic is explained in **plain words first**, then with the **real technical terms**.

Written for me, and for anyone starting backend from zero.

## Topics

| # | Topic | What's inside |
|---|---|---|
| 01 | [Terminal](./01-terminal/notes.md) | The 4 pieces of a terminal, stdin/stdout/stderr, pipes, redirects, PATH, job control, escape codes, nvim basics |
| 02 | [How the web works + HTTP](./02-http/notes.md) | DNS → TCP → TLS → request → response, status codes, methods, REST, headers, cookies, a raw HTTP server ([in plain words](./02-http/in-plain-words.md)) |

## Run the code

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
cd 02-http
node server-http.js                              # terminal 1
curl localhost:3000/api/notes -d '{"text":"hi"}' # terminal 2
curl localhost:3000/api/notes
```

## Roadmap

1. ✅ Terminal basics
2. ✅ How the internet works + HTTP (raw server, CRUD, search, file storage)
3. ⬜ Backend core: REST APIs, routing, middleware, validation, auth (sessions, JWT, password hashing)
4. ⬜ Databases: raw SQL, indexes, transactions, connection pooling
5. ⬜ Scaling: caching (Redis), queues, background jobs, load balancers
6. ⬜ Deploy: Docker, logs, monitoring

## How to learn fast

- 70% hands-on, 30% theory. Read one idea, then try it immediately.
- One main resource per topic. Don't hop between ten tutorials.
- Don't memorize commands. Remember the question they answer, look the rest up with `tldr`.
- Read error messages. They usually tell you the file, the line and the problem.

## Resources

- Julia Evans' zines (wizardzines.com)
- MDN Web Docs: HTTP section
- Hussein Nasser (YouTube)
- Sriniously, "Backend from First Principles" (YouTube)
- roadmap.sh/backend
- *Designing Data-Intensive Applications* (Martin Kleppmann), later
