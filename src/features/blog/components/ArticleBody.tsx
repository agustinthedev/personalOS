import ReactMarkdown from "react-markdown";
import { sanitizeArticleBody } from "@/features/blog/markdown";

type ArticleBodyProps = {
  body: string;
  title?: string;
};

export function ArticleBody({ body, title }: ArticleBodyProps) {
  return (
    <div>
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mb-5 mt-12 text-2xl font-semibold leading-tight text-white first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-4 mt-9 text-xl font-semibold leading-tight text-white">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-5 text-[17px] leading-8 text-white/82 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mb-6 mt-3 list-disc space-y-3 pl-6 text-[17px] leading-8 text-white/82">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-6 mt-3 list-decimal space-y-3 pl-6 text-[17px] leading-8 text-white/82">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 rounded-[28px] border border-white/10 bg-white/[0.045] p-5 text-white/82">
              {children}
            </blockquote>
          ),
        }}
      >
        {sanitizeArticleBody(body, title)}
      </ReactMarkdown>
    </div>
  );
}
