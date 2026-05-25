export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DATABASE_URL?.includes("cloudsql")) {
    const { initPrisma } = await import("@/lib/data/prisma");
    await initPrisma();
  }
}
