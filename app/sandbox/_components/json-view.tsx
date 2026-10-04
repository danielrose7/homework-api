import { Fragment } from "react";

const TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function copy(text: string) {
  navigator.clipboard.writeText(text).catch(() => undefined);
}

/** Pretty JSON with light syntax colour. Ids copy on click. */
export function JsonView({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last)
      nodes.push(<Fragment key={key++}>{text.slice(last, index)}</Fragment>);
    const [token, str, colon, literal] = match;
    if (str !== undefined && colon) {
      nodes.push(
        <span key={key++} className="text-code-key">
          {str}
        </span>,
        colon,
      );
    } else if (str !== undefined) {
      const inner = str.slice(1, -1);
      nodes.push(
        UUID.test(inner) ? (
          <Fragment key={key++}>
            {'"'}
            <button
              type="button"
              title="Copy id"
              className="text-code-str cursor-copy underline decoration-dotted underline-offset-2"
              onClick={() => copy(inner)}
            >
              {inner}
            </button>
            {'"'}
          </Fragment>
        ) : (
          <span key={key++} className="text-code-str">
            {str}
          </span>
        ),
      );
    } else if (literal) {
      nodes.push(
        <span key={key++} className="text-code-lit">
          {token}
        </span>,
      );
    } else {
      nodes.push(
        <span key={key++} className="text-code-num">
          {token}
        </span>,
      );
    }
    last = index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return (
    <pre className="leading-relaxed break-words whitespace-pre-wrap">
      {nodes}
    </pre>
  );
}
