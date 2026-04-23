import { Fragment } from "react";

// Match http(s) URLs and bare www. URLs. Trailing punctuation is trimmed in render.
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCT = /[.,!?:;'")\]]+$/;

interface LinkifyProps {
  text: string;
  className?: string;
}

/**
 * Renders text with clickable links for any URLs found.
 * Supports http://, https://, and www. prefixed URLs.
 */
export function Linkify({ text, className }: LinkifyProps) {
  if (!text) return <span className={className}>{text}</span>;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Use matchAll for reliable iteration (no stateful lastIndex pitfalls)
  const matches = Array.from(text.matchAll(URL_REGEX));

  for (const match of matches) {
    const matched = match[0];
    const start = match.index ?? 0;

    // Trim trailing punctuation from the URL itself
    const trimmed = matched.replace(TRAILING_PUNCT, "");
    const trailing = matched.slice(trimmed.length);

    // Push text before this URL
    if (start > lastIndex) {
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, start)}</Fragment>);
    }

    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    nodes.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-primary hover:underline break-all"
      >
        {trimmed}
      </a>,
    );

    if (trailing) {
      nodes.push(<Fragment key={key++}>{trailing}</Fragment>);
    }

    lastIndex = start + matched.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <span className={className}>{nodes}</span>;
}
