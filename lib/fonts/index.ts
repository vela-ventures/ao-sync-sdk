const preconnectGoogleFonts = document.createElement("link");
preconnectGoogleFonts.rel = "preconnect";
preconnectGoogleFonts.href = "https://fonts.googleapis.com";
document.head.appendChild(preconnectGoogleFonts);

// Create <link> for preconnect to fonts.gstatic.com with crossorigin
const preconnectGstatic = document.createElement("link");
preconnectGstatic.rel = "preconnect";
preconnectGstatic.href = "https://fonts.gstatic.com";
preconnectGstatic.crossOrigin = "anonymous"; // Specify crossorigin
document.head.appendChild(preconnectGstatic);

// Create <link> for the actual font stylesheet
const fontStylesheet = document.createElement("link");
fontStylesheet.rel = "stylesheet";
fontStylesheet.href =
  "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap";
document.head.appendChild(fontStylesheet);
