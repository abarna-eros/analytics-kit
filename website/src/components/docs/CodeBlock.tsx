import { useState } from 'react';
import { CheckIcon, CopyIcon } from './Icons';

interface CodeBlockProps {
  code: string;
  language?: string;
  label?: string;
}

export function CodeBlock({ code, language = 'ts', label }: CodeBlockProps) {
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
    <div className="code-block">
      <button className="btn-icon copy" type="button" onClick={() => void copy()} aria-label={`Copy ${label ?? language} code`}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
