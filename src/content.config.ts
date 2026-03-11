import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const docs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tool: z.string().optional(),
    accent: z.string().default("indigo"),
    icon: z.string(),
    lastUpdated: z.coerce.date(),
    order: z.number().default(0),
  }),
});

export const collections = { docs };
