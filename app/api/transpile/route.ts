export const runtime = "nodejs";

export async function POST(req: Request) {
  const { code } = (await req.json()) as { code: string };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require("typescript") as typeof import("typescript");
    const { outputText } = ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: false,
      },
    });
    return Response.json({ js: outputText });
  } catch (e: unknown) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
