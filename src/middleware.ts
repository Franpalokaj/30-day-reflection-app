import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/api/ai/stream", "/api/trpc"],
});

export const config = {
  matcher: ["/((?!.+\.[\w]+$|_next).*)", "/", "/(api)(.*)"],
};


