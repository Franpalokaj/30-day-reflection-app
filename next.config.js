/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    // Temporarily skip ESLint during production builds to unblock deploys
    ignoreDuringBuilds: true,
  },
};

export default config;
