import { useState, ImgHTMLAttributes } from "react";

/**
 * <img> that fades in when the file finishes loading, instead of popping in
 * abruptly. Matches the fade DestinationPoster already uses, so image
 * appearance feels consistent across the app. An image that is already
 * downloaded when it mounts (going back to a screen, reopening a page) shows
 * at once: fading it in again would only make a cached screen look slow.
 */
export function FadeInImage({ className = "", onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [state, setState] = useState<"loading" | "fading" | "instant">("loading");

  return (
    <img
      {...props}
      ref={(el) => {
        // Runs before the first paint, so a cached image never shows hidden.
        if (el && state === "loading" && el.complete && el.naturalWidth > 0) setState("instant");
      }}
      onLoad={(e) => {
        setState((s) => (s === "instant" ? s : "fading"));
        onLoad?.(e);
      }}
      className={`${className} ${
        state === "instant" ? "opacity-100" : `transition-opacity duration-300 ${state === "fading" ? "opacity-100" : "opacity-0"}`
      }`}
    />
  );
}
