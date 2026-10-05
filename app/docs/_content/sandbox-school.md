The examples in these docs run against a seeded school called **Sandbox** (slug `sandbox`). Every person in it signs
in with the password `sandbox-dev`.

| Role          | Usernames                                                     |
| ------------- | ------------------------------------------------------------- |
| Administrator | `reyes`                                                       |
| Teachers      | `alvarez` (Algebra I), `chen` (English 9), `okafor` (Biology) |
| Students      | `maya`, `jon`, `priya`, `theo`, `lena`, `omar`, `sam`, `noor` |

To run it yourself, follow [Run it locally in the README](https://github.com/danielrose7/homework-api#run-it-locally):

```sh
pnpm db:setup   # database, migrations and the Sandbox seed
pnpm dev        # http://localhost:3000
```

The [sandbox console](/sandbox/console) lets you sign in as any of them and try every route, and shows the
request it made so you can copy it as curl. It only exists while `SANDBOX_MODE=true`.
