import { describe, expect, it } from "vitest";
import type { ToolResult } from "../types/index.js";
import { extractToolResultFromOutput } from "./tool-results.js";

describe("transcript media tool results", () => {
  it("preserves media metadata when stored tool output is normalized", () => {
    const mediaResult: ToolResult = {
      success: true,
      output: "Generated 1 image.\n- /tmp/example.png",
      media: [
        {
          kind: "image",
          path: "/tmp/example.png",
          url: "https://example.com/generated.png",
          sourcePath: "/tmp/source.png",
          prompt: "Create a new hero image",
          modelId: "grok-imagine-image",
        },
      ],
    };

    expect(extractToolResultFromOutput(mediaResult)).toEqual(mediaResult);
  });
});
