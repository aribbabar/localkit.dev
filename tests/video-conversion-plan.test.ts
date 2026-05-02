import { describe, expect, it } from "vitest";

import {
  buildVideoConversionArgs,
  planVideoConversion,
  type VideoConvertOptions,
} from "../src/lib/ffmpeg";

describe("video conversion planning", () => {
  it("transcodes same-format fast conversions", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "mp4",
      mode: "fast",
    });

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
  });

  it("transcodes format-only fast conversions", () => {
    const options: VideoConvertOptions = {
      format: "mkv",
      mode: "fast",
    };

    const plan = planVideoConversion("clip.mp4", options);
    const args = buildVideoConversionArgs("input.mp4", "output.mkv", options);

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
    expect(args).not.toContain("-c");
    expect(args).not.toContain("copy");
    expect(args).toEqual([
      "-i",
      "input.mp4",
      "-preset",
      "ultrafast",
      "output.mkv",
    ]);
  });

  it("forces transcode when resizing video", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "mp4",
      mode: "fast",
      resolution: "1280x720",
    });

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
  });

  it("forces transcode when changing frame rate", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "mp4",
      mode: "fast",
      frameRate: 30,
    });

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
  });

  it("forces transcode for GIF output", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "gif",
      mode: "fast",
    });

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
  });

  it("forces transcode for audio extraction", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "mp3",
      mode: "fast",
    });

    expect(plan.strategy).toBe("transcode");
    expect(plan.requiresTranscode).toBe(true);
  });

  it("transcodes container changes in balanced mode", () => {
    const plan = planVideoConversion("clip.mp4", {
      format: "mkv",
      mode: "balanced",
    });

    expect(plan.strategy).toBe("transcode");
  });
});
