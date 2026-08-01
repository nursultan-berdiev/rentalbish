/** Рендер markdown ответа ассистента под токены темы. */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { css } from "../../design/css";

export default function Markdown({ text }: { text: string }) {
  return (
    <div style={css("font-size:12.5px;line-height:1.55;color:var(--text)")} className="ai-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
