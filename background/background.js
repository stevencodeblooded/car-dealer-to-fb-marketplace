/**
 * Background service worker for Vehicle Lister extension
 * Handles communication between components and maintains state
 */

// Initialize when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Vehicle Lister extension installed/updated");
  // Initialize storage with empty inventory if not exists
  chrome.storage.local.get("vehicleInventory", (result) => {
    if (!result.vehicleInventory) {
      chrome.storage.local.set({ vehicleInventory: [] });
    }
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "detectVehicle") {
    // Request the content script to detect vehicle data on the current page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "detectVehicle" },
          (response) => {
            if (response && response.vehicleData) {
              sendResponse({
                success: true,
                vehicleData: response.vehicleData,
              });
            } else {
              sendResponse({
                success: false,
                error: "No vehicle data detected",
              });
            }
          }
        );
        return true; // Keep the message channel open for async response
      }
    });
    return true;
  }

  if (message.action === "saveVehicle") {
    // Save vehicle data to storage
    saveVehicleToInventory(message.vehicleData, sendResponse);
    return true;
  }

  if (message.action === "getVehicleInventory") {
    // Retrieve vehicle inventory from storage
    chrome.storage.local.get("vehicleInventory", (result) => {
      sendResponse({ success: true, inventory: result.vehicleInventory || [] });
    });
    return true;
  }

  if (message.action === "removeVehicle") {
    // Remove vehicle from inventory
    removeVehicleFromInventory(message.vehicleId, sendResponse);
    return true;
  }

  if (message.action === "postToFacebook") {
    // Trigger Facebook posting process
    postVehicleToFacebook(message.vehicleId, sendResponse);
    return true;
  }
});

/**
 * Save vehicle data to local storage inventory
 */
function saveVehicleToInventory(vehicleData, callback) {
  chrome.storage.local.get("vehicleInventory", (result) => {
    const inventory = result.vehicleInventory || [];

    // Generate unique ID if not provided
    if (!vehicleData.id) {
      vehicleData.id = "vehicle_" + Date.now();
    }

    // Add metadata
    vehicleData.dateAdded = new Date().toISOString();
    vehicleData.status = "saved";

    // Add to inventory
    inventory.push(vehicleData);

    // Save updated inventory
    chrome.storage.local.set({ vehicleInventory: inventory }, () => {
      if (callback) {
        callback({ success: true, vehicleId: vehicleData.id });
      }
    });
  });
}

/**
 * Remove vehicle from inventory
 */
function removeVehicleFromInventory(vehicleId, callback) {
  chrome.storage.local.get("vehicleInventory", (result) => {
    const inventory = result.vehicleInventory || [];
    const updatedInventory = inventory.filter(
      (vehicle) => vehicle.id !== vehicleId
    );

    chrome.storage.local.set({ vehicleInventory: updatedInventory }, () => {
      if (callback) {
        callback({ success: true });
      }
    });
  });
}

/**
 * Initiate Facebook posting process
 */
function postVehicleToFacebook(vehicleId, callback) {
  // Get vehicle data from inventory
  chrome.storage.local.get("vehicleInventory", (result) => {
    const inventory = result.vehicleInventory || [];
    const vehicle = inventory.find((v) => v.id === vehicleId);

    if (!vehicle) {
      if (callback) {
        callback({ success: false, error: "Vehicle not found in inventory" });
      }
      return;
    }

    // Open Facebook Marketplace listing creation page
    chrome.tabs.create(
      {
        url: "https://www.facebook.com/marketplace/create/vehicle",
      },
      (tab) => {
        // Store the vehicle data and tab info for use by the content script
        chrome.storage.local.set(
          {
            pendingFacebookPost: {
              vehicleId: vehicleId,
              tabId: tab.id,
            },
          },
          () => {
            if (callback) {
              callback({
                success: true,
                message: "Opening Facebook Marketplace",
              });
            }
          }
        );
      }
    );
  });
}
