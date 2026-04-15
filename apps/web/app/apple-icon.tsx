import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 120,
          background: "linear-gradient(135deg, #7c3aed, #2563eb)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          color: "white",
          fontWeight: 800,
          letterSpacing: "-0.05em",
        }}
      >
        R
      </div>
    ),
    {
      ...size,
    }
  );
}
