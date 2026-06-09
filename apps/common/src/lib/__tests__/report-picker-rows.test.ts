import { buildCurrentRevisionReportPickerRows } from "../report-picker-rows";
import type { PropertyReport } from "../../types";

describe("buildCurrentRevisionReportPickerRows", () => {
  it("returns one current-revision row per ready report", () => {
    const reports = [
      {
        id: "r1",
        revision: 3,
        status: "ready",
        title: "Move-out",
        mode: "snapshot",
      },
      {
        id: "r2",
        revision: 1,
        status: "ready",
        title: "Annual",
        mode: "snapshot",
      },
    ] as PropertyReport[];

    const rows = buildCurrentRevisionReportPickerRows(reports);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      reportId: "r1",
      revision: 3,
      isArchived: false,
      parent: reports[0],
    });
    expect(rows[1]).toMatchObject({
      reportId: "r2",
      revision: 1,
      isArchived: false,
    });
  });
});
