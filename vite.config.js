import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves a project site (not a user/org page) at
// https://<user>.github.io/<repo>/ -- Vite needs `base` set to the repo
// name so built asset URLs resolve under that subpath instead of the
// domain root. Must match the GitHub repo name exactly (case-sensitive).
export default defineConfig({
  base: "/Opt-BH/",
  plugins: [react()],
});
