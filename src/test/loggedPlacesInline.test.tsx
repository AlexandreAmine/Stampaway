import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ requests: [] as string[] }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/components/DestinationPoster", () => ({ DestinationPoster: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("@/components/PosterWishlistButton", () => ({ PosterWishlistButton: () => null }));
vi.mock("@/lib/placeRankings", () => ({
  fetchAverageRatingMap: async () => new Map([["p-pt", 4.5]]),
  fetchCategoryAverageMap: async () => new Map(),
}));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    in: () => q,
    order: () => q,
    then: (resolve: any) => {
      h.requests.push("reviews");
      resolve({
        data: [
          { id: "r1", place_id: "p-pt", rating: 4, liked: false, visit_year: 2023, visit_month: 5, duration_days: 6, created_at: "2023-06-01", places: { name: "Portugal", country: "Portugal", type: "country", image: null } },
        ],
        error: null,
      });
    },
  };
  return { supabase: { from: () => q } };
});

import { LoggedPlacesInline } from "@/components/LoggedPlacesInline";
import { LanguageProvider } from "@/contexts/LanguageContext";

const mount = (client: QueryClient) =>
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <MemoryRouter>
          <LoggedPlacesInline type="country" />
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );

describe("LoggedPlacesInline", () => {
  it("shows the logged places, and at once when the tab is opened again", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const first = mount(client);
    expect((await screen.findAllByText("Portugal")).length).toBeGreaterThan(0);
    first.unmount();

    // Reopened: on screen in the very first render, no placeholder.
    mount(client);
    expect(screen.getAllByText("Portugal").length).toBeGreaterThan(0);
    // And refreshed in the background.
    await waitFor(() => expect(h.requests.length).toBe(2));
  });
});
