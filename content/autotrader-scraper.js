/**
 * AutoTrader.ca scraper content script
 * Detects and extracts vehicle listing data from AutoTrader.ca pages
 */

// Function to sleep/pause execution
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Determine if the current page is a vehicle detail page
function isVehicleDetailPage() {
  // Check for specific elements that indicate a vehicle listing page
  return (
    window.location.href.includes("/a/") &&
    document.querySelector(".hero-title") !== null
  );
}

// Determine if the current page is a search results page
function isSearchResultsPage() {
  return (
    window.location.href.includes("/cars/") || 
    window.location.href.includes("/search/") || 
    window.location.href.includes("/results/")
  );
}

// Add CSS for the extraction buttons
function addExtractionButtonsStyle() {
  const style = document.createElement('style');
  style.textContent = `
    .extract-button {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 999;
      background-color: #4285f4;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background-color 0.2s ease;
    }
    .extract-button:hover {
      background-color: #3367d6;
    }
    .extract-button:active {
      transform: translateY(1px);
    }
    .dealer-split-wrapper {
      position: relative;
    }
  `;
  document.head.appendChild(style);
}

// Extract vehicle data from the current page
function extractVehicleData() {
  // Only extract data if this is a vehicle detail page
  if (!isVehicleDetailPage()) {
    return null;
  }

  console.log("Extracting vehicle data from AutoTrader.ca page...");

  try {
    // Initialize vehicle data object
    const vehicleData = {
      source: "autotrader.ca",
      sourceUrl: window.location.href,
      images: [],
      dateExtracted: new Date().toISOString(),
    };

    // Extract vehicle title (year, make, model)
    const titleElement = document.querySelector(".hero-title");
    if (titleElement) {
      const title = titleElement.textContent.trim();

      // Parse title to extract year, make, model, and trim
      const titleParts = title.split(" ");
      if (titleParts.length >= 3) {
        // Try to extract year from the title
        const yearMatch = title.match(/^(19|20)\d{2}/);
        if (yearMatch) {
          vehicleData.year = parseInt(yearMatch[0]);

          // Remove year from title parts for further processing
          titleParts.shift();
        }

        // Extract make (assuming it's the first word after year)
        vehicleData.make = titleParts[0];

        // Extract model (can be multiple words)
        if (titleParts.length >= 3) {
          // If we have several words, the last one might be a trim level
          vehicleData.trim = titleParts[titleParts.length - 1];

          // Model is everything between make and trim
          vehicleData.model = titleParts.slice(1, -1).join(" ");

          // Special handling for cases where there might not be a trim
          // If the extracted "trim" is actually part of the model name
          if (
            vehicleData.model.length === 0 ||
            vehicleData.trim.toLowerCase() === "ev" ||
            vehicleData.trim.match(/^[A-Z]-?[0-9]+$/)
          ) {
            vehicleData.model = titleParts.slice(1).join(" ");
            vehicleData.trim = "";
          }
        } else {
          // If only two words (e.g., "Kia Soul"), assume model is the second word
          vehicleData.model = titleParts.slice(1).join(" ");
          vehicleData.trim = "";
        }
      }
    }

    // Extract location - fixed to avoid capturing CARFAX link text
    const locationElement = document.querySelector(".hero-location");
    if (locationElement) {
      const locationText = locationElement.textContent.trim();
      // Extract location before any pipe characters
      const locationParts = locationText.split("|");
      if (locationParts.length > 0) {
        // Get the first part that contains location
        vehicleData.dealerLocation = locationParts[0].trim();

        // If it contains "km", it's likely the first part is kilometers
        if (vehicleData.dealerLocation.match(/km/i)) {
          // Try the second part if available
          if (locationParts.length > 1) {
            vehicleData.dealerLocation = locationParts[1].trim();
          }
        }
      }
    }

    // If location not found or incorrectly extracted, try from sub-title
    if (
      !vehicleData.dealerLocation ||
      vehicleData.dealerLocation.includes("CARFAX")
    ) {
      const subTitleElement = document.querySelector(".hero-sub-title");
      if (subTitleElement) {
        const subTitle = subTitleElement.textContent.trim();
        // Look for location between pipe characters, but not containing "CARFAX"
        const locationParts = subTitle.split("|");
        for (let i = 0; i < locationParts.length; i++) {
          const part = locationParts[i].trim();
          if (
            part &&
            !part.includes("CARFAX") &&
            !part.match(/^\d+[\s,]*km/i)
          ) {
            vehicleData.dealerLocation = part;
            break;
          }
        }
      }
    }

    // Extract kilometers
    const subTitleElement = document.querySelector(".hero-sub-title");
    if (subTitleElement) {
      const subTitle = subTitleElement.textContent.trim();

      // Look for kilometers
      const kmMatch = subTitle.match(/([0-9,]+)\s*km/i);
      if (kmMatch) {
        vehicleData.kilometers = parseInt(kmMatch[1].replace(/,/g, ""));
      }
    }

    // Extract price information
    const priceElement = document.querySelector(".hero-price");
    if (priceElement) {
      const price = priceElement.textContent.trim().replace(/[^0-9.]/g, "");
      vehicleData.price = parseFloat(price);
    }

    // Extract MSRP if available
    const msrpElement = document.querySelector(".hero-msrp");
    if (msrpElement) {
      const msrpText = msrpElement.textContent.trim();
      const msrpMatch = msrpText.match(/[0-9,]+/);
      if (msrpMatch) {
        vehicleData.msrp = parseFloat(msrpMatch[0].replace(/,/g, ""));
      }
    }

    // Extract status (New/Used)
    const statusBadge = document.querySelector(".hero-badge");
    if (statusBadge) {
      const statusClass = statusBadge.classList;
      if (statusClass.contains("new")) {
        vehicleData.status = "New";
      } else if (statusClass.contains("used")) {
        vehicleData.status = "Used";
      } else if (statusClass.contains("cpo")) {
        vehicleData.status = "Certified Pre-Owned";
      }
    }

    // Extract description - target the correct container first
    const descriptionElement = document.querySelector(
      "#vdp-collapsible-content-text"
    );

    if (descriptionElement) {
      vehicleData.description = descriptionElement.textContent.trim();
    } else {
      // Try alternative selectors if primary one not found
      const altDescriptionElement = document.querySelector(
        ".force-wrapping, #vdp-collapsible-short-text"
      );

      if (altDescriptionElement) {
        vehicleData.description = altDescriptionElement.textContent.trim();
      }
    }

    // If description still not found, try more generic approach with card-body
    if (!vehicleData.description) {
      // Look for any container with readable description content
      const possibleDescContainers = document.querySelectorAll(
        ".card-body .force-wrapping, .card-body[*ngcontent-nic-c240], .collapsible-container .card-body, .vdp-content-description"
      );

      for (const container of possibleDescContainers) {
        const text = container.textContent.trim();
        if (text.length > 50) {
          // Longer threshold for more confidence
          vehicleData.description = text;
          break;
        }
      }
    }

    // Extract specifications
    const specItems = document.querySelectorAll("#sl-card-body .list-item");

    specItems.forEach((item) => {
      const key = item.querySelector('[id^="spec-key-"]');
      const value = item.querySelector('[id^="spec-value-"] strong');

      if (key && value) {
        const keyText = key.textContent.trim();
        const valueText = value.textContent.trim();

        switch (keyText) {
          case "Body Type":
            vehicleData.bodyType = valueText;
            break;
          case "Transmission":
            vehicleData.transmission = valueText;
            break;
          case "Drivetrain":
            vehicleData.drivetrain = valueText;
            break;
          case "Engine":
            vehicleData.engine = valueText;
            break;
          case "Fuel Type":
            vehicleData.fuelType = valueText;
            break;
          case "Exterior Colour":
            vehicleData.exteriorColor = valueText;
            break;
          case "Interior Colour":
            vehicleData.interiorColor = valueText;
            break;
          case "Stock Number":
            vehicleData.stockNumber = valueText;
            break;
          case "VIN":
            vehicleData.vin = valueText;
            break;
          case "Doors":
            vehicleData.doors = parseInt(valueText);
            break;
          case "Cylinders":
            vehicleData.cylinders = valueText;
            break;
          case "Horsepower":
            vehicleData.horsepower = valueText;
            break;
        }
      }
    });

    // Extract all images
    // For the main gallery images
    const galleryImages = document.querySelectorAll(
      ".gallery-carousel-md .gallery-thumbnail img"
    );
    if (galleryImages && galleryImages.length > 0) {
      galleryImages.forEach((img) => {
        if (img.src) {
          // Get the full-size image URL instead of thumbnail
          const fullSizeUrl = img.src.replace("-180x135", "-1024x786");
          vehicleData.images.push(fullSizeUrl);
        }
      });
    } else {
      // Fallback to main photo if gallery not found
      const mainPhoto = document.querySelector("#mainPhoto");
      if (mainPhoto && mainPhoto.src) {
        vehicleData.images.push(mainPhoto.src);
      }
    }

    // If no images found in the gallery, try alternative selectors
    if (vehicleData.images.length === 0) {
      const altImages = document.querySelectorAll(
        ".gallery-thumbnails-wrapper img"
      );
      if (altImages && altImages.length > 0) {
        altImages.forEach((img) => {
          if (img.src) {
            const fullSizeUrl = img.src.replace("-180x135", "-1024x786");
            vehicleData.images.push(fullSizeUrl);
          }
        });
      }
    }

    // Extract dealer name (if available)
    const dealerName = document.querySelector(".dealer-name, .dealer-link");
    if (dealerName) {
      vehicleData.dealerName = dealerName.textContent.trim();
    }

    console.log("Extracted vehicle data:", vehicleData);
    return vehicleData;
  } catch (error) {
    console.error("Error extracting vehicle data:", error);
    return null;
  }
}

// Function to add extraction buttons to listing cards
function addExtractionButtonsToListings() {
  // Look for all vehicle listing cards
  const listingCards = document.querySelectorAll(".dealer-split-wrapper");

  if (listingCards.length === 0) {
    console.log("No listing cards found on this page");
    return;
  }

  console.log(
    `Found ${listingCards.length} vehicle listings, adding extraction buttons`
  );

  // Add a button to each listing
  listingCards.forEach((card, index) => {
    // Check if button already exists
    if (card.querySelector(".extract-button")) {
      return;
    }

    // Find the link to the vehicle detail page
    const vehicleLink = card.querySelector("a.inner-link");
    if (!vehicleLink) return;

    // Create extraction button
    const extractButton = document.createElement("button");
    extractButton.className = "extract-button";
    extractButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
        <path d="M2 17l10 5 10-5"></path>
        <path d="M2 12l10 5 10-5"></path>
      </svg>
      Extract Vehicle
    `;

    // Add click handler
    extractButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Store the vehicle URL for later
      const vehicleUrl = vehicleLink.href;

      // Navigate to the vehicle detail page
      chrome.storage.local.set(
        {
          pendingExtraction: {
            vehicleUrl,
            autoOpenFacebook: true,
          },
        },
        () => {
          window.location.href = vehicleUrl;
        }
      );
    });

    // Add the button to the card
    card.style.position = "relative";
    card.appendChild(extractButton);
  });
}

// Function to auto-extract and post to Facebook if we're coming from a listing
function checkPendingExtraction() {
  chrome.storage.local.get("pendingExtraction", async (result) => {
    if (
      result.pendingExtraction &&
      result.pendingExtraction.vehicleUrl === window.location.href
    ) {
      console.log("Auto-extracting vehicle from listing page...");

      // Show notification
      showNotification("Auto-extracting vehicle data...", "info");

      // Wait a moment for the page to fully load
      await sleep(2000);

      // Extract vehicle data
      const vehicleData = extractVehicleData();

      if (vehicleData) {
        // Show success message
        showNotification("Vehicle data extracted successfully!", "success");

        // Save vehicle to inventory
        chrome.runtime.sendMessage(
          { action: "saveVehicle", vehicleData },
          (response) => {
            if (response && response.success) {
              showNotification("Vehicle saved to inventory", "success");

              // If auto-open is enabled, open Facebook Marketplace
              if (result.pendingExtraction.autoOpenFacebook) {
                showNotification("Opening Facebook Marketplace...", "info");

                // Send message to open Facebook
                chrome.runtime.sendMessage({
                  action: "postToFacebook",
                  vehicleId: response.vehicleId,
                });
              }

              // Clear the pending extraction
              chrome.storage.local.remove("pendingExtraction");
            } else {
              showNotification("Failed to save vehicle", "error");
            }
          }
        );
      } else {
        showNotification("Failed to extract vehicle data", "error");
      }
    }
  });
}

/**
 * Show a temporary notification message
 */
function showNotification(message, type = "info") {
  // Create notification element
  const notification = document.createElement("div");

  // Set style based on notification type
  let backgroundColor = "#4285f4"; // default blue for info
  if (type === "success") {
    backgroundColor = "#0f9d58"; // green
  } else if (type === "error") {
    backgroundColor = "#db4437"; // red
  } else if (type === "warning") {
    backgroundColor = "#f4b400"; // yellow
  }

  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: ${backgroundColor};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      max-width: 300px;
      transition: opacity 0.3s ease-in-out;
    ">
      ${message}
    </div>
  `;

  // Add to page
  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("AutoTrader content script received message:", message);

  if (message.action === "detectVehicle") {
    const vehicleData = extractVehicleData();

    if (vehicleData) {
      sendResponse({ success: true, vehicleData });
    } else {
      sendResponse({
        success: false,
        error: "No vehicle detected or not a vehicle page",
      });
    }

    return true;
  }
});

// Automatically check if we're on a search results page or vehicle page
(function () {
  // Add extraction buttons if on search results page
  if (isSearchResultsPage()) {
    console.log("On search results page, adding extraction buttons");
    addExtractionButtonsStyle();
    addExtractionButtonsToListings();

    // Also set up a mutation observer to handle dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          addExtractionButtonsToListings();
        }
      }
    });

    // Start observing changes to the DOM
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // If on vehicle detail page, check for pending extraction or add button
  if (isVehicleDetailPage()) {
    // Check if we should auto-extract
    checkPendingExtraction();

    // Otherwise just add the floating button as before
    console.log("AutoTrader vehicle page detected, adding extraction button");

    // Create a floating button to extract vehicle data
    const extractButton = document.createElement("div");
    extractButton.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4285f4;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 9999;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
        Extract Vehicle Data
      </div>
    `;

    // Add click event to extract and save vehicle data
    extractButton.addEventListener("click", () => {
      const vehicleData = extractVehicleData();

      if (vehicleData) {
        // Send message to background script to save the vehicle data
        chrome.runtime.sendMessage(
          { action: "saveVehicle", vehicleData },
          (response) => {
            if (response && response.success) {
              // Show success message
              showNotification("Vehicle saved to inventory!", "success");

              // Ask if user wants to post to Facebook
              if (
                confirm(
                  "Vehicle saved! Would you like to post it to Facebook Marketplace?"
                )
              ) {
                showNotification("Opening Facebook Marketplace...", "info");
                chrome.runtime.sendMessage({
                  action: "postToFacebook",
                  vehicleId: response.vehicleId,
                });
              }
            } else {
              // Show error message
              showNotification("Failed to save vehicle", "error");
            }
          }
        );
      } else {
        showNotification("No vehicle data found", "error");
      }
    });

    // Add the button to the page
    document.body.appendChild(extractButton);
  }
})();