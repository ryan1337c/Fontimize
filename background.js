const isDev = false; // set true for development

// toggles console logs
if (!isDev) {
  console.log = function () {};
}

// variables
var color;

// Create contextMenu only once when extension is updated or downloaded
chrome.runtime.onInstalled.addListener(() => {
  // Insert Highlights to text
  chrome.contextMenus.create({
    id: "highlightText",
    title: "Highlight selected text",
    contexts: ["selection"],
  });
  // Remove Highlights from text
  chrome.contextMenus.create({
    id: "removeHighlightText",
    title: "Remove highlights",
    contexts: ["selection"],
  });
});

// Saved highlights
let existingHighlights = [];

// Handle highlight functionality in menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "highlightText") {
    // inject javascript into the context of current tab
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [color],
      func: (color) => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          highlightRange(range, color);

          function highlightRange(range, color) {
            // Get commonAncestorContainer
            let container = range.commonAncestorContainer;

            // If it's a text node, use its parent element instead
            if (container.nodeType === Node.TEXT_NODE) {
              container = container.parentNode;
            }

            // Create a tree walker and set to walk through existing DOM tree starting from container
            const treeWalker = document.createTreeWalker(
              container,
              NodeFilter.SHOW_TEXT, // Only consider text nodes
              {
                acceptNode: function (node) {
                  const nodeRange = document.createRange();
                  nodeRange.selectNodeContents(node);

                  // Accept if node range intersects with selection range
                  return range.compareBoundaryPoints(
                    Range.END_TO_START,
                    nodeRange
                  ) < 0 &&
                    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >
                      0
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
                },
              },
              false
            );

            const textNodes = [];
            while (treeWalker.nextNode()) {
              textNodes.push(treeWalker.currentNode);
            }

            textNodes.forEach((textNode, index) => {
              const nodeRange = document.createRange();

              // Determining node range
              if (index === 0) {
                nodeRange.setStart(textNode, range.startOffset);
              } else {
                nodeRange.setStart(textNode, 0);
              }

              if (index === textNodes.length - 1) {
                nodeRange.setEnd(textNode, range.endOffset);
              } else {
                nodeRange.setEnd(textNode, textNode.length);
              }

              // Surround the range with a span
              const span = document.createElement("span");
              span.style.backgroundColor = color;
              span.id = "helperExtension";

              try {
                nodeRange.surroundContents(span);
              } catch (e) {
                console.warn("Cannot surround contents:", e);
              }
            });
          }
        }
      },
    });
  } else if (info.menuItemId === "removeHighlightText") {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        removeHighlights(range);

        function removeHighlights(range) {
          // Get commonAncestorContainer
          let container = range.commonAncestorContainer;

          // If it's a text node, use its parent element instead
          if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentNode;
          }

          // Create tree walker for text nodes
          const treeWalker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: function (node) {
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);

                // Accepts only if node contetns intersects with selection
                return range.compareBoundaryPoints(
                  Range.END_TO_START,
                  nodeRange
                ) < 0 &&
                  range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );

          // Collect relevant text nodes
          const textNodes = [];
          while (treeWalker.nextNode()) {
            textNodes.push(treeWalker.currentNode);
          }

          // Unwrap text nodes inside highlight spans
          textNodes.forEach((textNode, index) => {
            const parent = textNode.parentNode;

            if (
              parent.nodeName === "SPAN" &&
              parent.id === "helperExtension" &&
              parent.style.backgroundColor
            ) {
              const isFirst = index === 0;
              const isLast = index === textNodes.length - 1;

              // Determine start and end offsets
              const startOffset = isFirst ? range.startOffset : 0;
              const endOffset = isLast ? range.endOffset : textNode.length;

              const fullText = textNode.textContent;

              // Split the text into before, unwrapped, and after parts
              const beforeText = fullText.slice(0, startOffset);
              const unwrappedText = fullText.slice(startOffset, endOffset);
              const afterText = fullText.slice(endOffset);

              const fragment = document.createDocumentFragment();

              // Create a new span for "before" part (if any)
              if (beforeText.length > 0) {
                const beforeSpan = document.createElement("span");
                beforeSpan.style.backgroundColor = parent.style.backgroundColor;
                beforeSpan.textContent = beforeText;
                beforeSpan.id = "helperExtension";
                fragment.appendChild(beforeSpan);
              }

              // Add unwrapped (no highlight) plain text
              if (unwrappedText.length > 0) {
                fragment.appendChild(document.createTextNode(unwrappedText));
              }

              // Create a new span for "after" part (if any)
              if (afterText.length > 0) {
                const afterSpan = document.createElement("span");
                afterSpan.style.backgroundColor = parent.style.backgroundColor;
                afterSpan.textContent = afterText;
                afterSpan.id = "helperExtension";
                fragment.appendChild(afterSpan);
              }

              // replace original span with new fragment
              parent.replaceWith(fragment);
            }
          });

          // Clear the selection so it disappears
          window.getSelection().removeAllRanges();
        }
      },
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, response) => {
  if (message.type === "setHighlight") {
    color = message.value;
  } else if (message.type === "getHighlightsFromStorage") {
    existingHighlights = message.value;
  }
});
