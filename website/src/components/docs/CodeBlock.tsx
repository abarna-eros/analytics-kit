import { useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
  chrome?: boolean;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code: string): string {
  return escapeHtml(code)
    .replace(/(\/\/.*$)/gm, '<span class="tok-comment">$1</span>')
    .replace(/('[^'\n]*'|"[^"\n]*")/g, '<span class="tok-string">$1</span>')
    .replace(/\b(import|export|from|await|const|let|return|new|type)\b/g, '<span class="tok-kw">$1</span>')
    .replace(/\b(createAnalytics|track|page|identify|group|reset|init)\b/g, '<span class="tok-fn">$1</span>');
}

export function CodeBlock({ code, language = 'ts', label, chrome = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`code-block${chrome ? ' code-chrome' : ''}`}>
      {chrome ? (
        <div className="window-bar">
          <span className="window-dot window-dot-red" />
          <span className="window-dot window-dot-amber" />
          <span className="window-dot window-dot-green" />
          <span className="window-title">{label ?? language}</span>
        </div>
      ) : null}
      <button className="btn-icon copy" type="button" onClick={() => void copy()} aria-label={`Copy ${label ?? language} code`}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
      </pre>
    </div>
  );
}
