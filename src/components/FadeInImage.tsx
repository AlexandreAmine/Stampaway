import { useState, ImgHTMLAttributes } from "react";

/**
 * <img> that fades in when the file finishes loading, instead of popping in
 * abruptly. Matches the fade DestinationPoster already uses, so image
 * appearance feels consistent across the app. Cached images fade in on the
 * next frame, which still reads as smooth rather than delayed.
 */
export function FadeInImage({ className = "", onLoad, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  );
}
