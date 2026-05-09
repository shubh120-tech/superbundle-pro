// app/routes/api.upload.jsx
// Handles video file uploads to Cloudinary

import { authenticate } from "../shopify.server";

// Upload to Cloudinary via REST API
async function uploadToCloudinary(fileBuffer, fileName, mimeType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET."
    );
  }

  // 🔑 Generate signature
  const timestamp = Math.round(Date.now() / 1000);
  const folder = "superbundle-pro/videos";
  const transformation = "q_auto,vc_auto";

  // Params to sign (MUST match request params)
  const paramsToSign = {
    folder,
    timestamp,
    transformation,
  };

  // Sort params alphabetically
  const sortedParams = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  const signatureString = sortedParams + apiSecret;

  // SHA1 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 🧾 Build form data
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBuffer], { type: mimeType }),
    fileName
  );
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("resource_type", "video");
  formData.append("transformation", transformation);

  // 📡 Upload
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Cloudinary upload failed");
  }

  const result = await response.json();

  return {
    url: result.secure_url,
    thumbnailUrl: result.secure_url
      .replace(/\.[^/.]+$/, ".jpg")
      .replace("/video/upload/", "/video/upload/so_0/"),
    publicId: result.public_id,
    duration: result.duration,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
}

// 🧾 Shopify route handler
export const action = async ({ request }) => {
  try {
    await authenticate.admin(request);
  } catch {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return Response.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // 🎯 Validate type
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/avi",
      "video/webm",
      "video/mov",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        {
          success: false,
          message: `Invalid file type: ${file.type}. Use MP4, MOV, AVI, WebM.`,
        },
        { status: 400 }
      );
    }

    // 📏 Validate size (100MB)
    const maxSize = 100 * 1024 * 1024;

    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          message: `File too large: ${(file.size / 1024 / 1024).toFixed(
            1
          )}MB. Max 100MB.`,
        },
        { status: 400 }
      );
    }

    // 📦 Read buffer
    const fileBuffer = await file.arrayBuffer();

    // 🚀 Upload
    const result = await uploadToCloudinary(
      fileBuffer,
      file.name,
      file.type
    );

    return Response.json({
      success: true,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl,
      publicId: result.publicId,
      duration: result.duration,
      size: file.size,
    });
  } catch (e) {
    console.error("Upload error:", e.message);
    return Response.json(
      { success: false, message: e.message },
      { status: 500 }
    );
  }
};