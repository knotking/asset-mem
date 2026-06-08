import {
  collectServiceProviderCandidates,
  dedupeServiceProvidersByName,
} from "../src/lib/service-providers";

describe("service-providers", () => {
  it("dedupes providers by normalized name", () => {
    const out = dedupeServiceProvidersByName([
      { name: "Ace Plumbing" },
      { name: "ace plumbing" },
      { name: "Bay Door Co" },
    ]);
    expect(out).toHaveLength(2);
    expect((out[0] as { name: string }).name).toBe("Ace Plumbing");
    expect((out[1] as { name: string }).name).toBe("Bay Door Co");
  });

  it("collectServiceProviderCandidates avoids serp + google double count", () => {
    const service = {
      localPros: {
        serpAPIResults: [
          { name: "Precision Garage Door", contact_info: "(925) 555-0100" },
          { name: "Up Right Garage Door Repair", ratings: "4.9" },
        ],
        googleSearchResults: [
          { name: "Precision Garage Door", contact_info: "(925) 555-0100" },
        ],
      },
    };
    const out = collectServiceProviderCandidates(service);
    expect(out).toHaveLength(2);
    expect(out.map((p) => (p as { name: string }).name)).toEqual([
      "Precision Garage Door",
      "Up Right Garage Door Repair",
    ]);
  });

  it("falls back to googleSearchResults when serpAPIResults is empty", () => {
    const service = {
      localPros: {
        serpAPIResults: [],
        googleSearchResults: [{ name: "Wilfredo's Garage Door Service" }],
      },
    };
    const out = collectServiceProviderCandidates(service);
    expect(out).toHaveLength(1);
    expect((out[0] as { name: string }).name).toBe("Wilfredo's Garage Door Service");
  });
});
