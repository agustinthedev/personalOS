import ReactMarkdown from "react-markdown";
import { sanitizeArticleBody } from "@/lib/markdown";

type ArticleBodyProps = {
  body: string;
  title?: string;
};

export function ArticleBody({ body, title }: ArticleBodyProps) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => (
          <h2 className="pt-6 text-2xl font-semibold text-zinc-50">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="pt-4 text-xl font-semibold text-zinc-100">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-[17px] leading-8 text-zinc-300">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-zinc-50">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc space-y-2 pl-6 text-[17px] leading-8 text-zinc-300">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal space-y-2 pl-6 text-[17px] leading-8 text-zinc-300">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-orange-300/60 pl-5 text-zinc-300">
            {children}
          </blockquote>
        ),
      }}
    >
      {sanitizeArticleBody(body, title)}
    </ReactMarkdown>
  );
}
