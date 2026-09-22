import { ImageResponse } from "next/og";

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b5c5e",
          color: "#fff",
          fontSize: size * 0.42,
          fontWeight: 700,
        }}
      >
        CL
      </div>
    ),
    { width: size, height: size },
  );
}
