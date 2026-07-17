import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProofBall: Momentum trading for your favorite sports",
    short_name: "ProofBall",
    description:
      "Momentum trading for your favorite sports. Call which way the live win-probability swings, settled on-chain. Built on TxLINE + Solana.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e14",
    theme_color: "#0a0e14",
    orientation: "portrait",
    categories: ["sports", "games", "entertainment"],
    icons: [
      { src: "/proofball-logo.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
