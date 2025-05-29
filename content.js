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
    } else if (message.type === "reset") {
      resetAll();
    }
  });

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
