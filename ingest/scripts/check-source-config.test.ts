import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSourceConfiguration } from "./check-source-config";

const { metadata } = vi.hoisted(() => ({
  metadata: {
    id: "example",
    name: "Example source",
    url: "https://example.com",
    localities: ["bg.plovdiv"],
  },
}));

vi.mock("@oboapp/shared", () => ({ SOURCES: [metadata] }));

let directory: string;
let packageDirectory: string;

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "obo-source-selection-"));
  packageDirectory = join(directory, "node_modules", "@oboapp", "source-example");
  mkdirSync(packageDirectory, { recursive: true });
  mkdirSync(join(directory, "terraform"));
  mkdirSync(join(directory, "crawlers", metadata.id), { recursive: true });
  writeFileSync(join(directory, "crawlers", metadata.id, "index.ts"), "throw new Error('Entrypoint was loaded');");
  writeJson(join(directory, "package.json"), {
    dependencies: {
      "@oboapp/source-example": "1.2.3",
      "@oboapp/source-sdk": "0.1.1",
      "@oboapp/source-web-utils": "0.3.1",
      playwright: "1.61.1",
    },
  });
  writeJson(join(packageDirectory, "package.json"), {
    name: "@oboapp/source-example",
    version: "1.2.3",
    exports: { ".": "./runtime.cjs", "./metadata": "./metadata.cjs" },
  });
  writeFileSync(join(packageDirectory, "runtime.cjs"), "throw new Error('Provider runtime was loaded');");
  writeFileSync(join(packageDirectory, "metadata.cjs"), `exports.metadata = ${JSON.stringify(metadata)};`);
  writeJson(join(directory, "terraform", "source-jobs.bg.plovdiv.json"), {
    "plovdiv-example": { source: metadata.id, memory: "512Mi", timeout: "1800s" },
  });
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("source configuration files", () => {
  it("reads dependency metadata and deployment jobs without loading runtimes or support packages", () => {
    expect(() => checkSourceConfiguration(directory, directory)).not.toThrow();
  });

  it("reports a selected package with no isolated metadata export", () => {
    writeJson(join(packageDirectory, "package.json"), {
      name: "@oboapp/source-example",
      exports: { ".": "./runtime.cjs" },
    });
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(
      "Cannot read browser-safe source metadata from @oboapp/source-example/metadata",
    );
  });

  it("rejects malformed package metadata before checking the selection", () => {
    writeFileSync(join(packageDirectory, "metadata.cjs"), "exports.metadata = { id: 'example' };");
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(
      "Cannot read browser-safe source metadata from @oboapp/source-example/metadata",
    );
  });

  it("reports a removed selected entrypoint", () => {
    rmSync(join(directory, "crawlers", metadata.id, "index.ts"));
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(
      "Catalog source example has no crawler entrypoint",
    );
  });

  it("reports missing deployment data", () => {
    rmSync(join(directory, "terraform", "source-jobs.bg.plovdiv.json"));
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(
      "Catalog locality bg.plovdiv has no deployment job configuration",
    );
  });

  it("rejects misspelled deployment options", () => {
    writeJson(join(directory, "terraform", "source-jobs.bg.plovdiv.json"), {
      "plovdiv-example": { source: metadata.id, emergnt: true },
    });
    expect(() => checkSourceConfiguration(directory, directory)).toThrow("emergnt");
  });

  it.each(["memory", "timeout"])("rejects a job missing its %s setting", (field) => {
    const job: Record<string, string> = {
      source: metadata.id,
      memory: "512Mi",
      timeout: "1800s",
    };
    delete job[field];
    writeJson(join(directory, "terraform", "source-jobs.bg.plovdiv.json"), {
      "plovdiv-example": job,
    });
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(field);
  });

  it("rejects malformed deployment JSON", () => {
    writeFileSync(join(directory, "terraform", "source-jobs.bg.plovdiv.json"), "{");
    expect(() => checkSourceConfiguration(directory, directory)).toThrow(SyntaxError);
  });

  it("ignores unrelated Terraform JSON files", () => {
    writeJson(join(directory, "terraform", "terraform.tfvars.json"), { unrelated: true });
    expect(() => checkSourceConfiguration(directory, directory)).not.toThrow();
  });
});
