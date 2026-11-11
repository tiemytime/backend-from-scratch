# Build an HTTP Server From Scratch

Goal: see that HTTP is **just text over a TCP connection**. Express, Next.js and every other framework do this under the hood.

We build one small notes API in 9 steps. Each step is its own folder with:

- `README.md`: the idea **in plain words** first, then **how it works** line by line, then the mistakes made along the way
- `server.js`: the complete, working code **for that step only**

Read the [HTTP notes](../notes.md) first if requests, responses and status codes are new to you.

## The picture to keep in mind

Picture the server as a **small shop with a counter**. A customer (curl or a browser) walks in and asks for something.

## Steps

| # | Step | In plain words |
|---|---|---|
| 1 | [A server that only listens](./step-01-listen/) | Open the shop |
| 2 | [Send a reply](./step-02-reply/) | Learn to answer |
| 3 | [Different pages for different paths](./step-03-routing/) | Different answers for different questions |
| 4 | [Send JSON](./step-04-json/) | Answers that apps can read |
| 5 | [Receive data (POST)](./step-05-post/) | Customers can give us things |
| 6 | [Keep data after restart](./step-06-save-to-file/) | A notebook instead of a whiteboard |
| 7 | [Use Node's `http` module](./step-07-http-module/) | Hire an assistant |
| 8 | [One specific note (CRUD)](./step-08-crud/) | Work with one specific note |
| 9 | [Search with a query string](./step-09-search/) | Search |

Steps 1 to 6 do everything **by hand** on a raw TCP connection (`net`). Step 7 switches to Node's `http` module, which does the cutting and formatting for us.

## How to follow along

Each step's `server.js` runs on its own:

```bash
cd step-01-listen
node server.js          # terminal 1
curl localhost:3000     # terminal 2
```

Stop the server with Ctrl+C before starting the next step. Only one program can use port 3000 at a time.

From Step 6 on, notes are saved in a `notes.json` next to that step's `server.js`. It's in `.gitignore`: it's data, not code.

**Next stage:** the same app in Express.
