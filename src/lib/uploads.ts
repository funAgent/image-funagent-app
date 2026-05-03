import { ApiError } from "@/lib/http";
import type { User } from "@/generated/prisma/client";
import { userLimits } from "@/lib/quota";

export type ValidatedUpload = {
  file: File;
  name: string;
  size: number;
  type: "image/png" | "image/jpeg" | "image/webp";
};

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function getFiles(formData: FormData, field = "images") {
  return formData
    .getAll(field)
    .filter((item): item is File => item instanceof File && item.size > 0);
}

export function validateUploads(files: File[], user: User): ValidatedUpload[] {
  const limits = userLimits(user);
  if (files.length > limits.maxRefImages) {
    throw new ApiError(
      "BAD_REQUEST",
      `参考图最多上传 ${limits.maxRefImages} 张。`,
      400,
    );
  }

  const maxFileBytes = limits.maxFileMb * 1024 * 1024;
  const maxTotalBytes = limits.maxTotalUploadMb * 1024 * 1024;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > maxTotalBytes) {
    throw new ApiError(
      "BAD_REQUEST",
      `参考图总大小不能超过 ${limits.maxTotalUploadMb} MB。`,
      400,
    );
  }

  return files.map((file) => {
    if (!allowedTypes.has(file.type)) {
      throw new ApiError("BAD_REQUEST", "参考图仅支持 PNG、JPG、WEBP。", 400);
    }

    if (file.size > maxFileBytes) {
      throw new ApiError(
        "BAD_REQUEST",
        `单张参考图不能超过 ${limits.maxFileMb} MB。`,
        400,
      );
    }

    return {
      file,
      name: sanitizeFileName(file.name || "reference-image"),
      size: file.size,
      type: file.type as ValidatedUpload["type"],
    };
  });
}

export function sanitizeFileName(name: string) {
  return name
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 96);
}
