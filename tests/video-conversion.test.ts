import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

import { isAcceptedVideo, VIDEO_FORMATS } from "../src/lib/ffmpeg";

const VIDEOS_DIR = path.join(__dirname, "videos");
const fixtureNames = fs
  .readdirSync(VIDEOS_DIR)
  .filter((file) => fs.statSync(path.join(VIDEOS_DIR, file)).isFile());

describe("video conversion", () => {
  it("keeps the expected output formats available", () => {
    expect(VIDEO_FORMATS.map((format) => format.ext)).toEqual([
      "mp4",
      "webm",
      "avi",
      "mkv",
      "mov",
      "flv",
      "ogv",
      "ts",
      "gif",
      "mp3",
      "wav",
      "ogg",
      "aac",
      "flac",
    ]);
  });

  for (const filename of fixtureNames) {
    const filePath = path.join(VIDEOS_DIR, filename);
    const buffer = fs.readFileSync(filePath);

    it(`accepts ${filename} as a video fixture`, () => {
      const file = new File([buffer], filename, {
        type: "application/octet-stream",
      });

      expect(isAcceptedVideo(file)).toBe(true);
    });
  }
});
