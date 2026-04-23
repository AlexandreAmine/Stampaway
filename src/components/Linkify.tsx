import { Fragment } from "react";

// Match http(s) URLs and bare www. URLs
const URL_REGEX = /(\b(?:https?:\/\/|www\.)[^\s<]+[^\s<.,!?:;'")\]])/gi;

interface LinkifyProps {
  text: string;
  className?: string;
}

/**
 * Renders text with clickable links for any URLs found.
 * Supports http://, https://, and www. prefixed URLs.
 */
export function Linkify({ text, className }: LinkifyProps) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // reset lastIndex since regex is global
          URL_REGEX.lastIndex = 0;
          const href = part.startsWith("http") ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline break-all"
            >
              {part}
            </a>
          );
        }
        URL_REGEX.lastIndex = 0;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </span>
  );
}
