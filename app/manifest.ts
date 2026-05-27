import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roost — Your Shared Stay",
    short_name: "Roost",
    description:
      "The shared brain for group stays. Trip details, packing, meals, photos — all in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F1EB",
    theme_color: "#3F6A47",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
