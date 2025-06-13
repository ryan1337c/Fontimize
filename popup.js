const isDev = false; // set true for development

// toggles console logs
if (!isDev) {
  console.log = function () {};
}

document.addEventListener("DOMContentLoaded", async () => {
  // User Icons setup
  const bucketName = "helperextensionbucket";
  let pfpList;
  let currentIconIndex = 0;
  const iconDataResult = await chrome.storage.local.get("iconData");
  const iconData = iconDataResult["iconData"];
  var iconObj = {};

  // If Icondata exists, use it. Otherwise, create data and inject it into local storage
  if (iconData && iconData.allIcons.length > 0) {
    console.log("Done fetch: ", iconData);
    iconObj = iconData;
    pfpList = iconObj.allIcons;
    currentIconIndex = iconObj.userIconIndex;
  } else {
    console.log("Fetching icons");
    pfpList = await fetchAndStoreImages(bucketName); // Fetches from public bucket provided by AWS
    iconObj = {
      allIcons: pfpList,
      userIconIndex: 0,
    };
    console.log("PFP list: ", pfpList);
    // save icons
    chrome.storage.local.set({ iconData: iconObj }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error saving inital IconData to storage:",
          chrome.runtime.lastError
        );
        alert("Unable to save your data. Storage may be full or restricted.");
      } else {
        console.log("Inital IconData successfully saved!");
      }
    });
  }

  async function fetchURLsFromBucket(bucketName) {
    // S3 List Objects API endpoint for the bucket with list-type=2 for cleaner output
    const url = `https://${bucketName}.s3.amazonaws.com?list-type=2`;
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const xmlText = await response.text();

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");

      // Get all <Contents> nodes which represent files
      const contents = xmlDoc.getElementsByTagName("Contents");

      // Extract keys (file names)
      const files = [];
      for (let i = 0; i < contents.length; i++) {
        const keyNode = contents[i].getElementsByTagName("Key")[0];
        const key = keyNode.textContent;

        // Filter images by extension
        if (key.match(/\.(jpg|jpeg|png|gif|svg)$/i)) {
          files.push(`https://${bucketName}.s3.amazonaws.com/${key}`);
        }
      }
      console.log("Icon List: ", files);
      return files;
    } catch (err) {
      console.error("Error fetching bucket contents", err);
      return [];
    }
  }

  async function fetchAndStoreImages(bucketName) {
    // Fetch list of image urls
    const imageUrls = await fetchURLsFromBucket(bucketName);

    // Fetch each image file content in parallel
    const imagesData = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to fetch image ${url}: ${response.status}`);
            return null;
          }

          // get image blob
          const blob = await response.blob();

          // convert blob to base64
          const base64 = await blobToBase64(blob);

          return {
            url,
            base64,
          };
        } catch (err) {
          console.error("Error fetching image", url, err);
          return null;
        }
      })
    );

    // Filter out any failed fetches (null)
    const validImages = imagesData.filter((img) => img !== null);

    return validImages;
  }

  // Helper to convert Blob to base64 string
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob); // This reads blob as base64 data URI
    });
  }

  let currentTabId;
  let hostName;
  let dataObject = {};
  // Get active tab once on popup load
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
    if (tabs.length === 0) {
      console.log("No active tab found");
      return;
    }

    currentTabId = tabs[0].id;
    let url = new URL(tabs[0].url);
    hostName = url.hostname;

    // Get stored data for this host
    const result = await chrome.storage.local.get(hostName);
    const siteData = result[hostName];
    if (siteData) {
      dataObject = siteData;
      console.log("Return dataobject is: ", dataObject);
    } else {
      console.log("No data found for this hostname");
    }

    initializePopup(currentTabId, dataObject);
  });

  function initializePopup(currentTabId, dataObject) {
    // Color mode
    const chk = document.getElementById("checkbox");
    const moon = document.getElementById("moon");
    const sun = document.getElementById("sun");
    chk.addEventListener("change", () => {
      chk.classList.toggle("dark");
      // animations injection
      if (chk.classList.contains("dark")) {
        sun.classList.remove("animate");
        moon.classList.add("animate");
      } else {
        moon.classList.remove("animate");
        sun.classList.add("animate");
      }
      // Send message to content.js to change color modes
      chrome.tabs.sendMessage(currentTabId, {
        type: "changeColorMode",
        value: chk.classList.contains("dark") ? "dark" : "light",
      });
    });

    // User Profile functionality
    const profile = document.getElementById("profile");
    const profileSelection = document.getElementById("profileSelection");
    const savePfpBtn = document.getElementById("savePfpBtn");
    const editPfp = document.getElementById("edit");

    const pfpContainer = document.getElementById("pfpContainer");
    let pfpChildrens = [];

    // Inject icons
    if (pfpContainer.children.length === 0) {
      for (var i = 0; i < pfpList.length; i++) {
        const img = document.createElement("img");
        img.src = pfpList[i].base64;
        img.alt = "PFP";
        img.className = "pfp";
        pfpContainer.appendChild(img);
      }
      pfpChildrens = [...pfpContainer.children];
      pfpChildrens[currentIconIndex].classList.add("selected");
      profile.src = pfpChildrens[currentIconIndex].src;
    }

    // set user icon
    pfpChildrens.forEach((pfp, index) => {
      pfp.addEventListener("click", () => {
        pfpChildrens[currentIconIndex].classList.toggle("selected");
        currentIconIndex = index;
        pfp.classList.toggle("selected");
      });
    });

    // Save user icon
    savePfpBtn.addEventListener("click", () => {
      profile.src = pfpChildrens[currentIconIndex].src;
      iconObj.userIconIndex = currentIconIndex;

      // Save to storage
      chrome.storage.local.set({ iconData: iconObj }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving IconData to storage:",
            chrome.runtime.lastError
          );
          alert("Unable to save your data. Storage may be full or restricted.");
        } else {
          console.log("IconData successfully saved!");
        }
      });

      profileSelection.classList.remove("open");
    });

    profile.addEventListener("click", () => {
      // Toggle profile selection
      profileSelection.classList.toggle("open");
    });

    profile.addEventListener("mouseenter", () => {
      editPfp.classList.add("selected");
    });

    profile.addEventListener("mouseleave", () => {
      editPfp.classList.remove("selected");
    });

    // Select Font Dropdown logic
    const fontDropDown = document.getElementById("fontDropdown");
    const fontToggle = document.querySelector(".fontDropdown-toggle");
    const fontItems = document.querySelectorAll(".fontDropdown-item");

    var currentFontIndex =
      Object.keys(dataObject).length === 0 ? 0 : dataObject.currentFontIndex;
    console.log("Current font index: ", currentFontIndex);
    var currentFont = fontItems[currentFontIndex];
    fontToggle.textContent = currentFont.textContent;

    // init font to webpage
    chrome.tabs.sendMessage(currentTabId, {
      type: "changeFont",
      value: currentFont.textContent,
    });

    fontToggle.addEventListener("click", () => {
      fontDropDown.classList.toggle("open");
      currentFont.classList.add("selected");
    });

    fontItems.forEach((item, index) => {
      item.addEventListener("click", () => {
        currentFontIndex = index;
        currentFont.classList.remove("selected");
        currentFont = item;
        item.classList.toggle("selected");
        fontToggle.textContent = item.textContent;
        // Send message to content.js
        chrome.tabs.sendMessage(currentTabId, {
          type: "changeFont",
          value: item.textContent,
        });
        // Close dropdown after selecting
        fontDropDown.classList.toggle("open");
      });
    });

    document.addEventListener("click", function (event) {
      const isClickInsideDropdown = fontDropDown.contains(event.target);
      const isClickInsideProfileArea =
        profileSelection.contains(event.target) ||
        profile.contains(event.target);

      // Toggle off dropdown menu if user clicks outside of it
      if (!isClickInsideDropdown && fontDropDown.classList.contains("open")) {
        fontDropDown.classList.remove("open");
      }

      // Toggle off profile area if user clicks outside of it
      if (
        !isClickInsideProfileArea &&
        profileSelection.classList.contains("open")
      ) {
        profileSelection.classList.remove("open");
        pfpChildrens[currentIconIndex].classList.remove("selected");
        currentIconIndex = iconObj ? iconObj.userIconIndex : 0;
        console.log("currentIconIndex: ", iconObj);
        pfpChildrens[currentIconIndex].classList.add("selected");
      }
    });

    // Variables for font size
    var fontSlider = document.getElementById("sizeRange");
    const fontSizeTitle = document.getElementById("fontSizeTitle");
    let initialSize;

    // Variables for letter space
    const spacingSlider = document.getElementById("letterSpacingRange");
    const letterSpaceTitle = document.getElementById("letterSpacing");

    // Ask the active tab for current font styles in content.js
    chrome.tabs.sendMessage(
      currentTabId,
      { type: "getFontStyles" },
      (response) => {
        if (response && response.fontSize) {
          let letterSpacing = response.letterSpacing;
          const size = response.fontSize;
          const cleanSize = parseInt(size);
          initialSize = parseInt(size);

          // Font size init
          fontSlider.value =
            Object.keys(dataObject).length === 0
              ? cleanSize
              : dataObject.fontSliderValue;
          fontSizeTitle.textContent =
            Object.keys(dataObject).length === 0
              ? size
              : dataObject.fontSizeTitle;

          // Send message to content.js to update font size of webpage
          chrome.tabs.sendMessage(currentTabId, {
            type: "changeFontSize",
            value: fontSlider.value + "px",
          });

          // Letter space init
          spacingSlider.value =
            Object.keys(dataObject).length === 0
              ? 0
              : dataObject.spaceSliderValue;
          letterSpacing =
            Object.keys(dataObject).length === 0
              ? "normal"
              : dataObject.letterSpaceTitle;
          if (letterSpacing === "normal")
            letterSpaceTitle.textContent = 0 + "px";

          // Send message to content.js to update the letter spacing of webpage
          chrome.tabs.sendMessage(currentTabId, {
            type: "changeLetterSpacing",
            value: spacingSlider.value + "px",
          });

          // Update font styles variables within the css file
          document.documentElement.style.setProperty("--main-fontSize", size);
          document.documentElement.style.setProperty(
            "--letter-spacing",
            letterSpacing
          );
        }
      }
    );

    // Font size functionality
    fontSlider.addEventListener("input", () => {
      // Send message to content.js to update font size of webpage
      chrome.tabs.sendMessage(currentTabId, {
        type: "changeFontSize",
        value: fontSlider.value + "px",
      });
      fontSizeTitle.textContent = fontSlider.value + "px";
    });

    // Letter spacing functionality
    spacingSlider.addEventListener("input", () => {
      // Send message to content.js to update the letter spacing of webpage
      chrome.tabs.sendMessage(currentTabId, {
        type: "changeLetterSpacing",
        value: spacingSlider.value + "px",
      });
      letterSpaceTitle.textContent = spacingSlider.value + "px";
      console.log(letterSpaceTitle.textContent);
    });

    // Highlights functionality
    const colors = document.querySelectorAll(".dot");
    var currentColorIndex =
      Object.keys(dataObject).length === 0 ? 0 : dataObject.currentColorIndex;
    var currentColor = colors[currentColorIndex];
    currentColor.style.outline = "0.5px solid black";
    currentColor.classList.toggle("selected");

    // send inital colors to background.js
    var initStyle = window.getComputedStyle(currentColor);
    chrome.runtime.sendMessage({
      type: "setHighlight",
      value: initStyle.backgroundColor,
    });

    colors.forEach((color, index) => {
      color.addEventListener("mouseover", () => {
        color.style.outline = "0.5px solid black";
      });
      color.addEventListener("mouseout", () => {
        if (!color.classList.contains("selected")) color.style.outline = "none";
      });
      color.addEventListener("click", () => {
        currentColor.style.outline = "none";
        currentColor.classList.toggle("selected");
        currentColor = color;
        color.style.outline = "0.5px solid black";
        color.classList.toggle("selected");
        currentColorIndex = index;
        const style = window.getComputedStyle(color);
        const bgColor = style.backgroundColor;

        // Send color to background
        chrome.runtime.sendMessage({
          type: "setHighlight",
          value: bgColor,
        });
      });
    });

    // Save btn functionality
    const saveBtn = document.getElementById("saveBtn");
    saveBtn.addEventListener("click", () => {
      // Save currentFont
      dataObject.currentFontIndex = currentFontIndex;

      // Save font size
      dataObject.fontSizeTitle = fontSizeTitle.textContent;
      dataObject.fontSliderValue = fontSlider.value;

      // Save Letter spacing
      dataObject.letterSpaceTitle = letterSpaceTitle.textContent;
      dataObject.spaceSliderValue = spacingSlider.value;

      dataObject.currentColorIndex = currentColorIndex;

      // Save to chrome.storage.local
      chrome.storage.local.set({ [hostName]: dataObject }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error saving web data to storage.",
            chrome.runtime.lastError
          );
          alert("Unable to save your data. Storage may be full or restricted.");
        } else {
          console.log("Web data successfully saved.");
        }
      });
    });

    // Reset btn functionality
    const resetBtn = document.getElementById("resetBtn");
    resetBtn.addEventListener("click", () => {
      chrome.tabs.sendMessage(currentTabId, {
        type: "reset",
      });

      currentFontIndex = 0;

      currentColorIndex = 0;
      currentColor.style.outline = "none";
      currentColor = colors[currentColorIndex];
      currentColor.classList.toggle("selected");
      currentColor.style.outline = "0.5px solid black";

      const style = window.getComputedStyle(currentColor);
      const bgColor = style.backgroundColor;
      // Send color to background
      chrome.runtime.sendMessage({
        type: "setHighlight",
        value: bgColor,
      });

      fontToggle.textContent = "None";
      fontSlider.value = initialSize;
      fontSizeTitle.textContent = initialSize + "px";
      spacingSlider.value = 0;
      letterSpaceTitle.textContent = "0px";

      // remove hostname from storage
      chrome.storage.local.remove(hostName, () => {
        if (chrome.runtime.lastError) {
          console.error("Error removing hostname:", chrome.runtime.lastError);
        } else {
          console.log(`${hostName} removed from chrome.storage.local`);
        }
      });
    });
  }
});
