export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
