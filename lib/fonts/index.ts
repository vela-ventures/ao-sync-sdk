if (typeof window !== "undefined") {
  const preconnectGoogleFonts = document.createElement("link");
  preconnectGoogleFonts.rel = "preconnect";
  preconnectGoogleFonts.href = "https://fonts.googleapis.com";
  document.head.appendChild(preconnectGoogleFonts);

  const preconnectGstatic = document.createElement("link");
  preconnectGstatic.rel = "preconnect";
  preconnectGstatic.href = "https://fonts.gstatic.com";
  preconnectGstatic.crossOrigin = "anonymous";
  document.head.appendChild(preconnectGstatic);

  const fontStylesheet = document.createElement("link");
  fontStylesheet.rel = "stylesheet";
  fontStylesheet.href =
    "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap";
  document.head.appendChild(fontStylesheet);
}

import "@fontsource/sora";
import "@fontsource/sora/400.css";
import "@fontsource/sora/500.css";