import { Banner } from "@/app/sandbox/_components/ui";
import { isErrorBody } from "@/app/sandbox/_lib/types";

export function ErrorBanner({
  status,
  body,
}: {
  status: number;
  body: unknown;
}) {
  if (!isErrorBody(body)) {
    return <Banner tone="bad">{status} Unexpected response</Banner>;
  }
  const { error } = body;
  return (
    <Banner tone="bad">
      <b>
        {status} {error.code}
      </b>{" "}
      {error.message}
      {error.details?.length ? (
        <ul className="mt-1 list-disc pl-5">
          {error.details.map((detail, index) => (
            <li key={index}>
              <b>{detail.field}</b> {detail.code}: {detail.message}
            </li>
          ))}
        </ul>
      ) : null}
    </Banner>
  );
}
