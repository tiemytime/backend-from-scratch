// A tiny copy of how Express runs middleware. No Express needed.
// Run: node how-next-works.js

const stack = [];

function use(fn) {
  stack.push(fn);
}

function handle(req, res) {
  let i = 0;
  function next() {
    const fn = stack[i];
    i++;
    if (fn) {
      fn(req, res, next);
    }
  }
  next();
}

use((req, res, next) => {
  console.log("1. logger sees", req.url);
  next();
});

use((req, res, next) => {
  if (!req.user) {
    console.log("2. guard: no user, stopping here");
    return;
  }
  console.log("2. guard: user is", req.user);
  next();
});

use((req, res, next) => {
  console.log("3. route: sending the reply");
});

console.log("--- request with a user ---");
handle({ url: "/notes", user: "asha" }, {});

console.log("--- request without a user ---");
handle({ url: "/notes" }, {});
