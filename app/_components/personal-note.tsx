import { GITHUB_URL } from "@/app/_components/site-nav";

const MAIN = `${GITHUB_URL}/blob/main`;
const SCHEMA_URL = `${MAIN}/prisma/schema.prisma`;

const READ_THESE = [
  ["Database schema", SCHEMA_URL],
  ["modules/submissions", `${GITHUB_URL}/tree/main/modules/submissions`],
  [
    "Teacher submissions endpoint handler",
    `${MAIN}/app/api/v1/orgs/%5Borg_slug%5D/submissions/route.ts#L83-L96`,
  ],
  [
    "Grade route handler endpoint",
    `${MAIN}/app/api/v1/orgs/%5Borg_slug%5D/submissions/%5Bsubmission_id%5D/grade/route.ts#L78-L93`,
  ],
] as const;

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className="text-foreground underline underline-offset-4">
      {children}
    </a>
  );
}

export function PersonalNote() {
  return (
    <section className="bg-card mt-12 max-w-3xl rounded-xl border p-6 font-sans text-[15px] leading-7">
      <div className="space-y-4">
        <p className="font-bold">Hey Stride team!</p>
        <p>
          My name is Daniel Rose. I&apos;m a runner, foodie, and developer
          living in the San Juan mountains of SW Colorado: Silverton to be
          exact. It&apos;s close to Durango or Telluride, which you might have
          heard of.
        </p>
        <p>
          My wife was out of town over the weekend so I went a tad too hard on
          this project. Not like 10&apos;s of hours hard! Still close to the
          assignment&apos;s allowance. I just think it&apos;s a little more than
          a simple FastAPI repo with a local db and some generated docs.
        </p>
        <p>
          I started by brainstorming the general schema. Gist can be found in
          the <ExternalLink href={SCHEMA_URL}>prisma schema file</ExternalLink>.
          I have a love/hate relationship with prisma. It was what I was most
          recently using in production at another Fractal company and is fairly
          easy to read + setup. As such I thought it&apos;d be an alright
          choice. It&apos;s fully typesafe and supports DB enums well but I have
          my gripes.
        </p>
        <p>
          For the PK id&apos;s of the tables, I went with v7 UUID&apos;s.
          v7&apos;s are nice as they are lexicographically sortable and also as
          random as a more classic v4 UUID. I think for the
          assignment-as-written sequential integers (1, 2, 3...) would have
          probably been ok but might as well use some fancy juice. In addition
          to these standards, I added some generated timestamps (created_at,
          updated_at).
        </p>
        <p>
          While working through the skinny version of schema required by the
          assignment, I realized it would be good to have some users. I reached
          for better auth--an open source auth library that&apos;s now part of
          vercel. It has some quirks for this simple use case but handles users,
          session mgmt, and organizations. &quot;Organizations&quot; in this
          context are setup as schools. Most every table has organization_id on
          it to help for resource management and the future potential of things
          like row level security (multiple tenants, one database).
        </p>
        <p>
          I also tried to think about what future projects might include. As
          such I modeled out a super simple school/academic
          year/term/class/class_teacher/class_seat (join to student)
          relationship. This helps to define which students and teachers
          interact.
        </p>
        <p>
          My grading is a bit more than the assignment asked for in terms of an
          enum-type letter grade. I wanted to make something that would extend
          to the next-up project so captured points and moved grade scales to be
          data-driven. Simply put the schema allows for a school/class to have
          things like Pass/Fail and &apos;A+, A, A-, etc&apos; rather than just
          &apos;A&apos;. This introduced what might seem to be odd terms to the
          app like &apos;grade band&apos; to help with future extension ideas
          including grade book functionality (eg total up all the homework
          points to get the class grade for homework).
        </p>
        <p>
          Early on in the project I wanted to ensure there was hefty test
          coverage. There are a few levels but simply put tests can be found in
          __tests__ in a JS/TS convention that is generally co-located to the
          functionality that is being tested. I worked up a little integration
          test suite on top of libraries like thoughtbot&apos;s fishery (similar
          to FactoryBot in ruby on rails projects). This allows for tests to
          seed data, login a user, and run the API endpoint against
          expectations. Each test is isolated in a DB transaction that is rolled
          back at the end of the test (pass or fail). These tests aren&apos;t as
          fast as pure unit tests as they actually interact with a database.
          They also aren&apos;t as slow as e2e tests, which I generally like as
          acceptance tests for the happy-case of complex features.
        </p>
        <p>
          I also had AI build out a little docs site and API console for simple
          review.
        </p>
        <p>
          If you are looking for the &quot;does this actually work&quot; goods,
          I&apos;d go to the sandbox&apos;s project brief. Can click through
          different situations from the assignment. After clicking, we run
          actual HTTP requests and display the results for you. I added a
          &apos;copy as curl&apos; button, but I think the UI will expose what
          you&apos;re after.
        </p>
        <p>
          I also had claude sonnet spin up some other investigative tools like a
          reset button to go back to the seed script&apos;s output and hit
          specific routes as a few different users.
        </p>
        <p className="font-bold">
          So Dan... where&apos;s the code I should actually read?
        </p>
        <p>Check out</p>
        <ul className="list-disc space-y-1 pl-6">
          {READ_THESE.map(([label, href]) => (
            <li key={href}>
              <ExternalLink href={href}>{label}</ExternalLink>
            </li>
          ))}
        </ul>
        <p>
          I tried to put together some thorough docs as well and generally stick
          towards snake_case over camelCase as I think that&apos;ll feel more
          familiar to you each.
        </p>
        <p>
          If you aren&apos;t familiar, NextJS offers file-based routing. Rather
          than a routes file that helps orient the server to go route -&gt;
          controller -&gt; view, the route file is the controller and its file
          path matches the param
        </p>
        <p>
          for example app/api/v1/orgs/[org_slug]/submissions/route.ts handles
          the AWS lambda endpoint for the route GET
          /api/v1/orgs/[org_slug]/submissions with &apos;org_slug&apos; being a
          route-based param.
        </p>
        <p>
          Anyhow... super excited to meet you each in a few days time and answer
          questions.
        </p>
        <p>Upwards,</p>
        <p className="font-bold">Daniel Rose</p>
      </div>
    </section>
  );
}
