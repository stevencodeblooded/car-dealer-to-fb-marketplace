/**
 * Popup script for the Vehicle Lister extension
 */

// DOM elements
const detectTab = document.getElementById("tab-detect");
const inventoryTab = document.getElementById("tab-inventory");
const detectVehicleTab = document.getElementById("detect-vehicle-tab");
const inventoryTabContent = document.getElementById("inventory-tab");
const detectVehicleButton = document.getElementById("detect-vehicle-button");
const detectionResult = document.getElementById("detection-result");
const vehiclePreview = document.getElementById("vehicle-preview");
const saveVehicleButton = document.getElementById("save-vehicle");
const cancelDetectButton = document.getElementById("cancel-detect");
const resultCloseButton = document.getElementById("result-close");
const emptyInventory = document.getElementById("empty-inventory");
const inventoryList = document.getElementById("inventory-list");
const statusMessage = document.getElementById("status-message");

// State variables
let currentDetectedVehicle = null;
let vehicleInventory = [];

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  // Set up tab switching
  detectTab.addEventListener("click", () => switchTab("detect"));
  inventoryTab.addEventListener("click", () => switchTab("inventory"));

  // Set up vehicle detection
  detectVehicleButton.addEventListener("click", detectVehicle);

  // Set up detection result actions
  saveVehicleButton.addEventListener("click", saveVehicle);
  cancelDetectButton.addEventListener("click", cancelDetection);
  resultCloseButton.addEventListener("click", cancelDetection);

  // Load inventory when popup opens
  loadInventory();

  // Set default tab
  switchTab("inventory");
});

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Update tab buttons
  detectTab.classList.toggle("active", tabName === "detect");
  inventoryTab.classList.toggle("active", tabName === "inventory");

  // Show/hide tab content
  detectVehicleTab.style.display = tabName === "detect" ? "block" : "none";
  inventoryTabContent.style.display =
    tabName === "inventory" ? "block" : "none";

  // Additional actions when switching to inventory tab
  if (tabName === "inventory") {
    loadInventory();
  }
}

/**
 * Detect vehicle on the current page
 */
function detectVehicle() {
  showLoading("Detecting vehicle...");

  // Send message to the active tab to detect vehicle
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "detectVehicle" },
        (response) => {
          hideLoading();

          if (response && response.success && response.vehicleData) {
            // Save the detected vehicle data
            currentDetectedVehicle = response.vehicleData;

            // Display the preview
            showVehiclePreview(response.vehicleData);
          } else {
            // Show error message
            showNotification(
              "No vehicle detected or not a vehicle page",
              "error"
            );
          }
        }
      );
    } else {
      hideLoading();
      showNotification("No active tab found", "error");
    }
  });
}

/**
 * Show vehicle preview in the detection result area
 */
function showVehiclePreview(vehicleData) {
  // Format the vehicle title
  const title = `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`;
  const trimText = vehicleData.trim ? ` ${vehicleData.trim}` : "";

  // Format the price
  const price = vehicleData.price
    ? `$${vehicleData.price.toLocaleString()}`
    : "Price not available";

  // Create preview HTML
  const previewHTML = `
    <div class="preview-title">${title}${trimText}</div>
    <div class="preview-price">${price}</div>
    ${
      vehicleData.images && vehicleData.images.length > 0
        ? `<img src="${vehicleData.images[0]}" class="preview-image" alt="${title}">`
        : '<div class="preview-image-placeholder">No image available</div>'
    }
    
    <div class="preview-details">
      ${
        vehicleData.kilometers
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Kilometers</span>
          <span class="preview-detail-value">${vehicleData.kilometers.toLocaleString()}</span>
        </div>
      `
          : ""
      }
      
      ${
        vehicleData.bodyType
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Body Type</span>
          <span class="preview-detail-value">${vehicleData.bodyType}</span>
        </div>
      `
          : ""
      }
      
      ${
        vehicleData.transmission
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Transmission</span>
          <span class="preview-detail-value">${vehicleData.transmission}</span>
        </div>
      `
          : ""
      }
      
      ${
        vehicleData.exteriorColor
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Exterior Color</span>
          <span class="preview-detail-value">${vehicleData.exteriorColor}</span>
        </div>
      `
          : ""
      }
      
      ${
        vehicleData.drivetrain
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Drivetrain</span>
          <span class="preview-detail-value">${vehicleData.drivetrain}</span>
        </div>
      `
          : ""
      }
      
      ${
        vehicleData.fuelType
          ? `
        <div class="preview-detail-item">
          <span class="preview-detail-label">Fuel Type</span>
          <span class="preview-detail-value">${vehicleData.fuelType}</span>
        </div>
      `
          : ""
      }
    </div>
  `;

  // Update the preview container
  vehiclePreview.innerHTML = previewHTML;

  // Show the detection result
  detectionResult.style.display = "block";
}

/**
 * Save the detected vehicle to inventory
 */
function saveVehicle() {
  if (!currentDetectedVehicle) {
    showNotification("No vehicle data to save", "error");
    return;
  }

  showLoading("Saving vehicle...");

  // Send message to background script to save the vehicle
  chrome.runtime.sendMessage(
    { action: "saveVehicle", vehicleData: currentDetectedVehicle },
    (response) => {
      hideLoading();

      if (response && response.success) {
        // Show success message
        showNotification("Vehicle saved to inventory!", "success");

        // Reset the detection state
        currentDetectedVehicle = null;
        detectionResult.style.display = "none";

        // Switch to inventory tab
        switchTab("inventory");
      } else {
        // Show error message
        showNotification("Failed to save vehicle", "error");
      }
    }
  );
}

/**
 * Cancel the vehicle detection
 */
function cancelDetection() {
  currentDetectedVehicle = null;
  detectionResult.style.display = "none";
}

/**
 * Load vehicle inventory from storage
 */
function loadInventory() {
  showLoading("Loading inventory...");

  // Send message to background script to get the inventory
  chrome.runtime.sendMessage({ action: "getVehicleInventory" }, (response) => {
    hideLoading();

    if (response && response.success) {
      vehicleInventory = response.inventory || [];
      renderInventory();
    } else {
      showNotification("Failed to load inventory", "error");
    }
  });
}

/**
 * Render the vehicle inventory
 */
function renderInventory() {
  // Update visibility of empty state and list
  if (vehicleInventory.length === 0) {
    emptyInventory.style.display = "flex";
    inventoryList.style.display = "none";
    return;
  } else {
    emptyInventory.style.display = "none";
    inventoryList.style.display = "flex";
  }

  // Clear the list
  inventoryList.innerHTML = "";

  // Add each vehicle to the list
  vehicleInventory.forEach((vehicle) => {
    const vehicleCard = document.createElement("div");
    vehicleCard.className = "vehicle-card";

    // Create vehicle title
    const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    const trimText = vehicle.trim ? ` ${vehicle.trim}` : "";

    // Format the price
    const price = vehicle.price
      ? `$${vehicle.price.toLocaleString()}`
      : "Price not available";

    // Get the first image if available
    const imageUrl =
      vehicle.images && vehicle.images.length > 0 ? vehicle.images[0] : "";

    // Create HTML for the card
    vehicleCard.innerHTML = `
      ${
        imageUrl
          ? `<img src="${imageUrl}" class="vehicle-card-image" alt="${title}">`
          : '<div class="vehicle-card-image" style="background-color: #f1f1f1;"></div>'
      }
      
      <div class="vehicle-card-content">
        <div class="vehicle-card-title">${title}${trimText}</div>
        <div class="vehicle-card-price">${price}</div>
        
        <div class="vehicle-card-details">
          ${
            vehicle.kilometers
              ? `<span>${vehicle.kilometers.toLocaleString()} km</span>`
              : ""
          }
          ${vehicle.transmission ? `<span>${vehicle.transmission}</span>` : ""}
          ${
            vehicle.exteriorColor ? `<span>${vehicle.exteriorColor}</span>` : ""
          }
        </div>
        
        <div class="vehicle-card-actions">
          <button class="vehicle-card-button primary" data-action="post" data-id="${
            vehicle.id
          }">
            Post to Facebook
          </button>
          <button class="vehicle-card-button danger" data-action="remove" data-id="${
            vehicle.id
          }">
            Remove
          </button>
        </div>
      </div>
    `;

    // Add event listeners to buttons
    const postButton = vehicleCard.querySelector('[data-action="post"]');
    const removeButton = vehicleCard.querySelector('[data-action="remove"]');

    postButton.addEventListener("click", () =>
      postVehicleToFacebook(vehicle.id)
    );
    removeButton.addEventListener("click", () => removeVehicle(vehicle.id));

    // Add the card to the list
    inventoryList.appendChild(vehicleCard);
  });
}

/**
 * Post a vehicle to Facebook Marketplace
 */
function postVehicleToFacebook(vehicleId) {
  showLoading("Opening Facebook Marketplace...");

  // Send message to background script to post the vehicle
  chrome.runtime.sendMessage(
    { action: "postToFacebook", vehicleId },
    (response) => {
      hideLoading();

      if (response && response.success) {
        // Show success message
        showNotification("Opening Facebook Marketplace...", "success");
      } else {
        // Show error message
        showNotification("Failed to post to Facebook", "error");
      }
    }
  );
}

/**
 * Remove a vehicle from inventory
 */
function removeVehicle(vehicleId) {
  if (!confirm("Are you sure you want to remove this vehicle?")) {
    return;
  }

  showLoading("Removing vehicle...");

  // Send message to background script to remove the vehicle
  chrome.runtime.sendMessage(
    { action: "removeVehicle", vehicleId },
    (response) => {
      hideLoading();

      if (response && response.success) {
        // Show success message
        showNotification("Vehicle removed from inventory", "success");

        // Reload inventory
        loadInventory();
      } else {
        // Show error message
        showNotification("Failed to remove vehicle", "error");
      }
    }
  );
}

/**
 * Show a notification message
 */
function showNotification(message, type = "info") {
  // Check if a notification already exists
  let notification = document.querySelector(".notification");

  // Create notification if it doesn't exist
  if (!notification) {
    notification = document.createElement("div");
    notification.className = "notification";
    document.body.appendChild(notification);
  }

  // Update notification content and type
  notification.textContent = message;
  notification.className = `notification ${type}`;

  // Show the notification
  setTimeout(() => {
    notification.classList.add("visible");
  }, 10);

  // Hide the notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove("visible");

    // Remove from DOM after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);

  // Update status message
  statusMessage.textContent = message;
}

/**
 * Show loading overlay
 */
function showLoading(message = "Loading...") {
  // Check if a loading overlay already exists
  let loadingOverlay = document.querySelector(".loading-overlay");

  // Create loading overlay if it doesn't exist
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);
  }

  // Update status message
  statusMessage.textContent = message;
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const loadingOverlay = document.querySelector(".loading-overlay");

  if (loadingOverlay) {
    loadingOverlay.parentNode.removeChild(loadingOverlay);
  }

  // Reset status message
  statusMessage.textContent = "Ready";
}
