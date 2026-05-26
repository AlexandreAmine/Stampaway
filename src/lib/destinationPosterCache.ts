import { supabase } from "@/integrations/supabase/client";

export const DESTINATION_POSTER_CACHE_TTL_MS = 60_000;

export type DestinationPosterProvider = "unsplash" | "pexels";

export type DestinationPosterRequestToken = {
  cacheKey: string;
  version: number;
};

export type DestinationPosterFetchResult = {
  url: string | null;
  fromCache: boolean;
};

type CacheEntry = {
  url: string;
  cachedAt: number;
};

const posterCache = new Map<string, CacheEntry>();
const posterInflight = new Map<string, Promise<DestinationPosterFetchResult>>();
const posterVersions = new Map<string, number>();

const getCacheKey = (placeId: string, provider: DestinationPosterProvider) =>
  `${provider}:${placeId}`;

const getVersion = (cacheKey: string) => posterVersions.get(cacheKey) ?? 0;

const isFresh = (entry: CacheEntry) =>
  Date.now() - entry.cachedAt <= DESTINATION_POSTER_CACHE_TTL_MS;

export function getDestinationPosterRequestToken(
  placeId: string,
  provider: DestinationPosterProvider
): DestinationPosterRequestToken {
  const cacheKey = getCacheKey(placeId, provider);

  return {
    cacheKey,
    version: getVersion(cacheKey),
  };
}

export function isDestinationPosterRequestTokenCurrent(
  placeId: string,
  provider: DestinationPosterProvider,
  token: DestinationPosterRequestToken
) {
  const cacheKey = getCacheKey(placeId, provider);
  return token.cacheKey === cacheKey && token.version === getVersion(cacheKey);
}

export function getCachedDestinationPosterUrl(
  placeId: string,
  provider: DestinationPosterProvider
) {
  const cacheKey = getCacheKey(placeId, provider);
  const cached = posterCache.get(cacheKey);
  if (!cached) return null;

  if (!isFresh(cached)) {
    posterCache.delete(cacheKey);
    return null;
  }

  return cached.url;
}

export function setCachedDestinationPosterUrl(
  placeId: string,
  provider: DestinationPosterProvider,
  url: string
) {
  if (!url) return;

  const cacheKey = getCacheKey(placeId, provider);
  const cached = posterCache.get(cacheKey);
  const hasInflight = posterInflight.has(cacheKey);
  if (cached?.url === url && isFresh(cached) && !hasInflight) return;

  posterVersions.set(cacheKey, getVersion(cacheKey) + 1);
  posterInflight.delete(cacheKey);
  posterCache.set(cacheKey, {
    url,
    cachedAt: Date.now(),
  });
}

export function invalidateDestinationPosterCache(
  placeId: string,
  provider?: DestinationPosterProvider
) {
  const providers: DestinationPosterProvider[] = provider ? [provider] : ["unsplash", "pexels"];

  providers.forEach((nextProvider) => {
    const cacheKey = getCacheKey(placeId, nextProvider);
    posterVersions.set(cacheKey, getVersion(cacheKey) + 1);
    posterInflight.delete(cacheKey);
    posterCache.delete(cacheKey);
  });
}

export async function fetchDestinationPosterUrl(
  placeId: string,
  provider: DestinationPosterProvider,
  token: DestinationPosterRequestToken
): Promise<DestinationPosterFetchResult> {
  const cached = getCachedDestinationPosterUrl(placeId, provider);
  if (cached) return { url: cached, fromCache: true };

  const cacheKey = getCacheKey(placeId, provider);
  const inflight = posterInflight.get(cacheKey);
  if (inflight) return inflight;

  const fnName = provider === "pexels" ? "fetch-pexels-poster" : "fetch-unsplash-poster";
  const request = supabase.functions
    .invoke(fnName, { body: { place_id: placeId } })
    .then(({ data, error }) => {
      if (error) throw error;

      const imageUrl = typeof data?.image_url === "string" ? data.image_url : null;
      if (imageUrl && isDestinationPosterRequestTokenCurrent(placeId, provider, token)) {
        posterCache.set(cacheKey, {
          url: imageUrl,
          cachedAt: Date.now(),
        });
      }

      return { url: imageUrl, fromCache: false };
    })
    .finally(() => {
      if (posterInflight.get(cacheKey) === request) {
        posterInflight.delete(cacheKey);
      }
    });

  posterInflight.set(cacheKey, request);
  return request;
}
