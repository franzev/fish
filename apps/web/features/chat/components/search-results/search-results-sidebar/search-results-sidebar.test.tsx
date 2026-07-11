import { describe, expect, it } from "vitest";
import { paginationItems } from "./search-results-sidebar";

describe("search result pagination", () => {
  it("keeps the first-page sequence stable and includes the ellipsis", () => {
    expect(paginationItems(1, 400)).toEqual([1, 2, 3, "ellipsis", 400]);
    expect(paginationItems(2, 400)).toEqual([1, 2, 3, "ellipsis", 400]);
    expect(paginationItems(3, 400)).toEqual([1, 2, 3, "ellipsis", 400]);
  });

  it("uses a bounded five-item window in the middle and at the end", () => {
    expect(paginationItems(200, 400)).toEqual([1, "ellipsis", 200, "ellipsis", 400]);
    expect(paginationItems(400, 400)).toEqual([1, "ellipsis", 398, 399, 400]);
  });

  it("shows every page when an ellipsis would not save space", () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});
