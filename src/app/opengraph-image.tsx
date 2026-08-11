import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const alt = "Vriksha Bandhan by Mirchi — It’s time to protect the protector.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoBytes = await readFile(path.join(process.cwd(), "public/brand/mirchi-logo.png"));
  const logoDataUrl = `data:image/png;base64,${logoBytes.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(120deg, #f8f5e9 0%, #fffdf7 55%, #ecf1dc 100%)",
        color: "#153d2b",
        padding: "64px 72px",
      }}
    >
      <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
        <img src={logoDataUrl} alt="" width={194} height={82} style={{ objectFit: "contain" }} />
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "760px" }}>
            <div style={{ fontSize: 84, lineHeight: 0.92, fontFamily: "Georgia", letterSpacing: "-4px" }}>
              Vriksha Bandhan
            </div>
            <div style={{ marginTop: "26px", fontSize: 34, color: "#58753c" }}>
              It’s time to protect the protector.
            </div>
          </div>
          <div
            style={{
              width: "210px",
              height: "210px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "8px solid #b88a3e",
              borderRadius: "999px",
              boxShadow: "0 0 0 14px #d62b2b, 0 0 0 22px #d8b36a",
              fontSize: 72,
              fontFamily: "Georgia",
            }}
          >
            983
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: "3px", textTransform: "uppercase" }}>
          983 Trees · 983 Promises · One Greener Mumbai
        </div>
      </div>
    </div>,
    size,
  );
}
