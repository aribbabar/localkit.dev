import type { APIRoute, GetStaticPaths } from "astro";
import type { ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const accentColors: Record<string, string> = {
  purple: "#a78bfa",
  blue: "#60a5fa",
  red: "#f87171",
  cyan: "#22d3ee",
  indigo: "#818cf8",
  teal: "#2dd4bf",
};

const tools = [
  { slug: "image-converter", title: "Image Converter", description: "Batch convert images between PNG, JPG, GIF, BMP, TIFF, and more formats.", accent: "purple", category: "Image" },
  { slug: "video-converter", title: "Video Converter", description: "Batch convert videos between MP4, WebM, AVI, MKV, MOV, and more using FFmpeg.", accent: "blue", category: "Video" },
  { slug: "pdf-tools", title: "PDF Tools", description: "Merge, split, compress, extract pages, and convert PDFs to images or text.", accent: "red", category: "Document" },
  { slug: "info-redactor", title: "Info Redactor", description: "Securely redact sensitive data from documents or images before sharing.", accent: "indigo", category: "Security" },
  { slug: "path-converter", title: "Path Converter", description: "Convert file paths between forward slashes and backslashes instantly.", accent: "teal", category: "Tool" },
  { slug: "svg-viewer", title: "SVG Viewer", description: "Preview SVG code with live rendering, animation playback, zoom, and background modes.", accent: "cyan", category: "Image" },
  { slug: "code-formatter", title: "Code Formatter", description: "Format and beautify 25+ languages — JS, TS, HTML, CSS, C/C++, Java, C#, and more.", accent: "teal", category: "Tool" },
  { slug: "image-metadata", title: "Image Metadata", description: "View, edit, and strip EXIF, GPS, IPTC, and XMP metadata from images.", accent: "purple", category: "Image" },
  { slug: "markdown-preview", title: "Markdown Preview", description: "Real-time Markdown render and preview with full GFM support.", accent: "cyan", category: "Document" },
  { slug: "password-generator", title: "Password Generator", description: "Generate strong, random passwords with customizable length and character options.", accent: "indigo", category: "Security" },
];

export const getStaticPaths: GetStaticPaths = () => {
  return tools.map((tool) => ({
    params: { slug: tool.slug },
    props: tool,
  }));
};

async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap"
  );
  const css = await res.text();
  const fontUrl = css.match(/src: url\((.+?)\)/)?.[1];
  if (!fontUrl) throw new Error("Font URL not found");
  const fontRes = await fetch(fontUrl);
  return fontRes.arrayBuffer();
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description, accent, category } = props as (typeof tools)[number];
  const color = accentColors[accent] || accentColors.indigo;

  const fontData = await loadFont();

  const svg = await satori(
    ({
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          background: "linear-gradient(145deg, #0f0f14 0%, #13131a 50%, #0f0f14 100%)",
          fontFamily: "Space Grotesk",
        },
        children: [
          // Top accent bar
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: `linear-gradient(90deg, ${color}, transparent)`,
              },
            },
          },
          // Top row: logo + category
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: color,
                            opacity: 0.9,
                          },
                        },
                      },
                      {
                        type: "div",
                        props: {
                          style: {
                            fontSize: "24px",
                            fontWeight: 600,
                            color: "#a1a1aa",
                          },
                          children: "LocalKit",
                        },
                      },
                    ],
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "16px",
                      fontWeight: 600,
                      color: color,
                      border: `1px solid ${color}33`,
                      padding: "6px 16px",
                      borderRadius: "20px",
                      background: `${color}11`,
                    },
                    children: category,
                  },
                },
              ],
            },
          },
          // Main content
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "56px",
                      fontWeight: 700,
                      color: "#fafafa",
                      lineHeight: 1.15,
                    },
                    children: title,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "22px",
                      fontWeight: 600,
                      color: "#71717a",
                      lineHeight: 1.5,
                    },
                    children: description,
                  },
                },
              ],
            },
          },
          // Bottom: tagline
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "16px",
                      color: "#52525b",
                      fontWeight: 600,
                    },
                    children: "localkit.dev — Private, local, open-source tools",
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "14px",
                      color: "#3f3f46",
                      fontWeight: 600,
                    },
                    children: "Free & Open Source",
                  },
                },
              ],
            },
          },
        ],
      },
    }) as unknown as ReactNode,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Space Grotesk",
          data: fontData,
          weight: 600,
          style: "normal" as const,
        },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: 1200 },
  });

  return new Response(new Uint8Array(resvg.render().asPng()), {
    headers: { "Content-Type": "image/png" },
  });
};
