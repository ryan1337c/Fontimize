const isDev = false; // set true for development

// toggles console logs
if (!isDev) {
  console.log = function () {};
}

(() => {
  // Handles styling requests for the webpage
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "changeFont") {
      changeFont(message.value);
    } else if (message.type === "changeFontSize") {
      changeFontSize(message.value);
    } else if (message.type === "getFontStyles") {
      getFontStyles(sendResponse);
    } else if (message.type === "changeLetterSpacing") {
      changeLetterSpace(message.value);
    } else if (message.type === "changeColorMode") {
      changeColorMode(message.value);
    } else if (message.type === "reset") {
      resetAll();
    }
  });

  // Method to change color mode
  const changeColorMode = (value) => {
    const existing = document.getElementById("universal-dark-mode");
    if (existing) {
      existing.remove();
    } else {
      const style = document.createElement("style");
      style.id = "universal-dark-mode";
      style.textContent = `
    html, body, div, span, p, a, h1, h2, h3, h4, h5, h6,
    section, article, header, footer, main, nav, aside,
    li, ul, ol, table, tr, td, th, form, label, input, textarea, select, button {
      background-color: #121212 !important;
      color: #e0e0e0 !important;
      border-color: #333 !important;
    }
    a {
      color: #80cbc4 !important;
    }
      img, svg, path, [class*="icon"], use {
        filter: none !important;
        color: unset !important;
        fill: unset !important;
        stroke: unset !important;
        background-color: transparent !important;
      }
}
  `;
      document.head.appendChild(style);
    }
  };

  // Method to reset webpage back to original style
  const resetAll = () => {
    const idsToRemove = [
      "font-override-style",
      "size-override-style",
      "space-override-style",
    ];

    idsToRemove.forEach((id) => {
      const style = document.getElementById(id);
      if (style) style.remove();
    });
  };

  // Method for changing font
  const changeFont = (value) => {
    if (value === "None") {
      const style = document.getElementById("font-override-style");
      if (style) style.remove();
      return;
    }
    const styleId = "font-override-style";
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
  * {
    font-family: "${value}" !important;
  }
  yt-formatted-string, ytd-video-primary-info-renderer {
    font-family: "${value}" !important;
  }
`;
    document.head.appendChild(style);
  };

  // Method for changing font size
  const changeFontSize = (value) => {
    const styleId = "size-override-style";
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `html { font-size: ${value} !important; }`;
    document.head.appendChild(style);
  };

  // Method for changing letter spacing
  const changeLetterSpace = (value) => {
    const styleId = "space-override-style";
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) existingStyle.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `html { letter-spacing: ${value} !important; }`;
    document.head.appendChild(style);
  };

  const getFontStyles = (sendResponse) => {
    const style = window.getComputedStyle(document.documentElement);

    const fontStyles = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      fontVariant: style.fontVariant,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      wordSpacing: style.wordSpacing,
      textTransform: style.textTransform,
      textIndent: style.textIndent,
      textDecoration: style.textDecoration,
    };

    console.log("Font styles: ", fontStyles);

    // Sent back to popup.js
    sendResponse(fontStyles);
  };
})();
