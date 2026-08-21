import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mirchi Vriksha Bandhan",
    short_name: "Vriksha Bandhan",
    description: "Tie a Rakhi to a tree and join Mirchi’s Vriksha Bandhan movement in Mumbai.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#173a2b",
    icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png" }],
  };
}
