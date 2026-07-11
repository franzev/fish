export interface ChatSearchUrlState {
  query: string;
  page: number;
  sortDirection: "asc" | "desc";
}

const searchParam = "search";
const pageParam = "page";
const sortParam = "sort";
const maximumPage = 1_000_000;

export function readChatSearchUrlState(search: string): ChatSearchUrlState | null {
  const params = new URLSearchParams(search);
  const query = params.get(searchParam)?.trim() ?? "";
  if (!query || query.length > 4_000) return null;

  const rawPage = params.get(pageParam) ?? "";
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isSafeInteger(parsedPage)
    ? Math.min(Math.max(parsedPage, 1), maximumPage)
    : 1;

  return {
    query,
    page,
    sortDirection: params.get(sortParam) === "asc" ? "asc" : "desc",
  };
}

export function createChatSearchUrl(
  currentUrl: string,
  state: ChatSearchUrlState | null
): string {
  const url = new URL(currentUrl);
  if (state) {
    url.searchParams.set(searchParam, state.query.trim());
    if (state.page > 1) url.searchParams.set(pageParam, String(state.page));
    else url.searchParams.delete(pageParam);
    if (state.sortDirection === "asc") url.searchParams.set(sortParam, "asc");
    else url.searchParams.delete(sortParam);
  } else {
    url.searchParams.delete(searchParam);
    url.searchParams.delete(pageParam);
    url.searchParams.delete(sortParam);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
