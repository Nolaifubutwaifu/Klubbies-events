import sharp from "sharp";

// Untrusted SVG is not decoded in the app. sharp 0.35.5 fixes the librsvg
// use-after-free (GHSA-wq5f-xc86-pv6w / CVE-2026-96889); blocking the loader
// is the upstream workaround, so a later file that still reaches sharp cannot
// reopen it. Scripts that rasterise their own SVG import "sharp" directly.
sharp.block({ operation: ["VipsForeignLoadSvg"] });

export default sharp;
