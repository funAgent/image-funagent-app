const intFromEnv = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const appEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://image.funagent.app",
  openaiImageModel: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
  defaultDailyLimit: intFromEnv("DEFAULT_DAILY_LIMIT", 3),
  defaultMaxRefImages: intFromEnv("DEFAULT_MAX_REF_IMAGES", 4),
  defaultMaxFileMb: intFromEnv("DEFAULT_MAX_FILE_MB", 10),
  maxTotalUploadMb: intFromEnv("MAX_TOTAL_UPLOAD_MB", 25),
  adminOpenIds: new Set(
    (process.env.ADMIN_OPENIDS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ),
};
