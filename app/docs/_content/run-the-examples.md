Every example is a complete request. It reads where the app runs, your token and any ids from environment
variables, so it runs exactly as written once they are set:

```sh
export HOST=http://localhost:3000
```

Sign in first (the example names who sends each request) to get a `TOKEN`. The `curl` form of sign-in needs
[`jq`](https://jqlang.github.io/jq/) to pick the token out; the Python and Node examples need `requests` and
Node 18 or later. Ids are different in every database, so find them first. The list routes return them, and the
[sandbox console](/sandbox/console) offers each one in a picker.
