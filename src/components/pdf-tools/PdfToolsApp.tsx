import { useState } from "react";
import MergePdf from "./tools/MergePdf";
import SplitPdf from "./tools/SplitPdf";
import PdfToImages from "./tools/PdfToImages";
import PdfToText from "./tools/PdfToText";
import ExtractPages from "./tools/ExtractPages";
import CompressPdf from "./tools/CompressPdf";
import PdfToWord from "./tools/PdfToWord";

const TOOLS = [
  {
    id: "merge",
    label: "Merge",
    description: "Combine multiple PDFs into one",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
  },
  {
    id: "split",
    label: "Split",
    description: "Split a PDF into multiple files",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    id: "extract",
    label: "Extract",
    description: "Extract specific pages",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
  {
    id: "to-images",
    label: "To Images",
    description: "Convert pages to PNG or JPEG",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    ),
  },
  {
    id: "to-text",
    label: "To Text",
    description: "Extract text or HTML content",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    id: "to-word",
    label: "To Word",
    description: "Convert PDF to Word (.docx)",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    id: "compress",
    label: "Compress",
    description: "Reduce PDF file size",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
  },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

const TOOL_COMPONENTS: Record<ToolId, () => React.JSX.Element> = {
  merge: () => <MergePdf />,
  split: () => <SplitPdf />,
  extract: () => <ExtractPages />,
  "to-images": () => <PdfToImages />,
  "to-text": () => <PdfToText />,
  "to-word": () => <PdfToWord />,
  compress: () => <CompressPdf />,
};

export default function PdfToolsApp() {
  const [activeTool, setActiveTool] = useState<ToolId>("merge");

  const ActiveComponent = TOOL_COMPONENTS[activeTool];

  return (
    <div className="grid gap-6 lg:grid-cols-[220px,1fr]">
      {/* Sidebar navigation */}
      <nav className="space-y-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveTool(tool.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
              activeTool === tool.id
                ? "border border-accent-red/20 bg-accent-red/10 text-text-primary"
                : "border border-transparent text-text-muted hover:border-border-card hover:bg-bg-card/60 hover:text-text-secondary"
            }`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                activeTool === tool.id
                  ? "bg-accent-red/20 text-accent-red"
                  : "bg-bg-secondary text-text-muted"
              }`}
            >
              {tool.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{tool.label}</p>
              <p className="truncate text-[10px] text-text-muted">
                {tool.description}
              </p>
            </div>
          </button>
        ))}
      </nav>

      {/* Active tool content */}
      <div className="min-w-0">
        <ActiveComponent />
      </div>
    </div>
  );
}
