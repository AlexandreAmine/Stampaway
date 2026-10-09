/**
 * Screens presented like iOS modals: they rise from the bottom over
 * everything (RouteTransition), hide the tab bar, and close with
 * dismissModal() instead of a swipe back.
 */
export const MODAL_PATHS = new Set(["/add", "/import-photos"]);
