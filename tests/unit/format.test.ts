import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDayMonth, formatEventDates } from "@/lib/format";

// Node writes "Sept" for en-AU and Safari writes "Sep". A server-rendered date
// that differs from the browser's makes React throw the page away on iPhones,
// so every short month comes from one fixed list.
describe("short dates are the same on the server and on an iPhone", () => {
  it("writes September as Sep", () => {
    expect(formatDate("2026-09-27")).toBe("27 Sep 2026");
    expect(formatDayMonth("2026-09-27")).toBe("27 Sep");
    expect(formatDateTime("2026-09-27T08:00:00Z")).toBe("27 Sep, 6:00 pm");
  });

  it("formats event ranges without Intl's short months", () => {
    expect(formatEventDates("2026-09-14", null)).toBe("14 Sep 2026");
    expect(formatEventDates("2026-09-14", "2026-09-15")).toBe("14–15 Sep 2026");
    expect(formatEventDates("2026-09-30", "2026-10-02")).toBe("30 Sep – 2 Oct 2026");
    expect(formatEventDates("2026-12-31", "2027-01-01")).toBe("31 Dec 2026 – 1 Jan 2027");
  });
});
