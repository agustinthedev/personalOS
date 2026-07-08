type ArticleBodyProps = {
  body: string;
};

export function ArticleBody({ body }: ArticleBodyProps) {
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5 text-[17px] leading-8 text-zinc-300">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="pt-6 text-2xl font-semibold text-zinc-50">
              {block.replace(/^## /, "")}
            </h2>
          );
        }

        if (block.startsWith("- ")) {
          return (
            <ul key={index} className="list-disc space-y-2 pl-6">
              {block.split("\n").map((item) => (
                <li key={item}>{item.replace(/^- /, "")}</li>
              ))}
            </ul>
          );
        }

        return <p key={index}>{block}</p>;
      })}
    </div>
  );
}
