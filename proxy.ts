import middleware from "next-auth/middleware";

export function proxy(req: any, ctx: any) {
  return (middleware as any)(req, ctx);
}

export const config = {
  matcher: ["/summary"],
};
