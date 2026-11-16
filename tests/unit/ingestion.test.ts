import { describe, expect, it } from "vitest";
import { normaliseHeader, parseDateDMY, parseDecimal, parseExportCsv } from "@/lib/sdr/export-parser";
import { parseGalleryHtml, photoKind } from "@/lib/sdr/html-parsers";
import { rowHash } from "@/lib/data/normalize";
import { csvEscape, toCsv } from "@/lib/csv";
import { assertAllowedUrl } from "@/lib/sdr/http";
import { sniffImageType } from "@/lib/sdr/photos";
import { chiSquareSf, kruskalWallis, mad, median } from "@/lib/analytics/stats";

const HEADER = "Núm Butlletí;Circuit;Observacions caracterització;Observacions Altres Residus;Pes Total;Data Presa Mostres;";

describe("SDR export parser", () => {
  it("maps columns by normalised header name", () => {
    const p = parseExportCsv(`${HEADER}\r\n31301;FIGUERES;ok;;250,29;30/10/2026;\r\n`);
    expect(p.rows[0]!.values).toMatchObject({ bulletinId: "31301", circuitName: "FIGUERES", "kg.total": "250,29", samplingDate: "30/10/2026" });
    expect(p.unknownHeaders).toEqual([]);
    expect(normaliseHeader("Instal·lació Caracterització")).toBe("instal·lacio caracteritzacio");
  });

  it("re-aligns rows whose free-text observations contain ';'", () => {
    const p = parseExportCsv(`${HEADER}\r\n1;C;a;b;c;x;250,00;01/01/2026;\r\n`);
    const r = p.rows[0]!;
    expect(r.realigned).toBe(true);
    expect(r.values["kg.total"]).toBe("250,00");
    expect(r.values.samplingDate).toBe("01/01/2026");
    expect(r.values.obsCharacterization).toBe("a;b;c");
  });

  it("parses comma decimals and local dates strictly", () => {
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("250,67")).toBe(250.67);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("n/a")).toBeNull();
    expect(parseDateDMY("22/12/2025")).toBe("2025-12-22");
    expect(parseDateDMY("31/02/x")).toBeNull();
  });

  it("row hash is stable (idempotent ingestion) and ignores personal fields", () => {
    const a = { bulletinId: "1", circuitName: "C", "kg.total": "1,00", vehiclePlate: "1234ABC" };
    expect(rowHash(a)).toBe(rowHash({ ...a }));
    expect(rowHash(a)).toBe(rowHash({ ...a, vehiclePlate: "9999ZZZ" }));
    expect(rowHash(a)).not.toBe(rowHash({ ...a, "kg.total": "2,00" })); // a correction at source → new version
  });
});

describe("photo gallery parsing", () => {
  it("reads image ids and the SDR photo type", () => {
    const html = `<img src="GetImatge.do?imatgeId=464012&thumbNail=true"/><select name="imatgeType1" id="selecImatgeType1"><option value="0"></option><option value="1" selected="selected">1. Lot</option></select>
      <img src="GetImatge.do?imatgeId=464006&thumbNail=true"/><select id="selecImatgeType2"><option value="7" selected="selected">9. Paper i cartró</option></select>
      <img src="GetImatge.do?scale=760&thumbNail=false&imatgeId=464012"/>`;
    const ps = parseGalleryHtml(html, "31301", "2026-11-04T00:00:00Z");
    expect(ps.map((p) => [p.imageId, p.kind])).toEqual([["464012", "lot"], ["464006", "impropi"]]);
    expect(photoKind("21. Altres aspectes")).toBe("incidencia");
    expect(photoKind(null)).toBe("desconegut");
  });

  it("detects image type from bytes, not from the declared Content-Type", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("<html><body>not an image</body>"))).toBeNull();
  });
});

describe("security helpers", () => {
  it("prevents CSV formula injection", () => {
    expect(csvEscape("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvEscape("+1")).toBe("'+1");
    expect(csvEscape(-3)).toBe("-3"); // numbers are not prefixed
    expect(toCsv(["a"], [["@cmd"]]).endsWith("'@cmd")).toBe(true);
  });

  it("only allows the SDR host over https (SSRF guard)", () => {
    expect(assertAllowedUrl("/cform/ListCaracteritzacions.do").hostname).toBe("sdr.arc.cat");
    expect(() => assertAllowedUrl("https://evil.example.com/")).toThrow();
    expect(() => assertAllowedUrl("http://sdr.arc.cat/")).toThrow();
    expect(() => assertAllowedUrl("https://169.254.169.254/latest/meta-data")).toThrow();
  });
});

describe("statistics", () => {
  it("robust location/scale", () => {
    expect(median([1, 2, 100])).toBe(2);
    expect(mad([1, 1, 1, 1])).toBe(0);
  });
  it("chi-square survival and Kruskal–Wallis", () => {
    expect(chiSquareSf(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(kruskalWallis([[1, 2, 3], [1, 2, 3]]).p).toBeGreaterThan(0.9);
    expect(kruskalWallis([[1, 2, 3, 4, 5], [11, 12, 13, 14, 15]]).p).toBeLessThan(0.05);
  });
});
