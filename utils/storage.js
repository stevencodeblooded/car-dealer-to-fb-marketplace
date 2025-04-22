/**
 * Storage utility functions for Vehicle Lister extension
 */

const StorageUtils = {
  /**
   * Get the entire vehicle inventory
   * @returns {Promise<Array>} Array of vehicle objects
   */
  getVehicleInventory: () => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        resolve(result.vehicleInventory || []);
      });
    });
  },

  /**
   * Get a specific vehicle by ID
   * @param {string} vehicleId - The ID of the vehicle to retrieve
   * @returns {Promise<Object|null>} Vehicle object or null if not found
   */
  getVehicleById: (vehicleId) => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        const inventory = result.vehicleInventory || [];
        const vehicle = inventory.find((v) => v.id === vehicleId);
        resolve(vehicle || null);
      });
    });
  },

  /**
   * Save a vehicle to the inventory
   * @param {Object} vehicleData - Vehicle data to save
   * @returns {Promise<{success: boolean, vehicleId: string}>}
   */
  saveVehicle: (vehicleData) => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        const inventory = result.vehicleInventory || [];

        // Generate ID if not provided
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
          resolve({ success: true, vehicleId: vehicleData.id });
        });
      });
    });
  },

  /**
   * Update an existing vehicle in the inventory
   * @param {string} vehicleId - ID of the vehicle to update
   * @param {Object} updatedData - New data to merge with existing vehicle data
   * @returns {Promise<{success: boolean}>}
   */
  updateVehicle: (vehicleId, updatedData) => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        const inventory = result.vehicleInventory || [];
        const index = inventory.findIndex((v) => v.id === vehicleId);

        if (index === -1) {
          resolve({ success: false, error: "Vehicle not found" });
          return;
        }

        // Update the vehicle data
        inventory[index] = {
          ...inventory[index],
          ...updatedData,
          lastUpdated: new Date().toISOString(),
        };

        // Save updated inventory
        chrome.storage.local.set({ vehicleInventory: inventory }, () => {
          resolve({ success: true });
        });
      });
    });
  },

  /**
   * Remove a vehicle from the inventory
   * @param {string} vehicleId - ID of the vehicle to remove
   * @returns {Promise<{success: boolean}>}
   */
  removeVehicle: (vehicleId) => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        const inventory = result.vehicleInventory || [];
        const updatedInventory = inventory.filter((v) => v.id !== vehicleId);

        chrome.storage.local.set({ vehicleInventory: updatedInventory }, () => {
          resolve({ success: true });
        });
      });
    });
  },

  /**
   * Update the status of a vehicle
   * @param {string} vehicleId - ID of the vehicle to update
   * @param {string} status - New status (saved, posted, etc.)
   * @returns {Promise<{success: boolean}>}
   */
  updateVehicleStatus: (vehicleId, status) => {
    return new Promise((resolve) => {
      chrome.storage.local.get("vehicleInventory", (result) => {
        const inventory = result.vehicleInventory || [];
        const index = inventory.findIndex((v) => v.id === vehicleId);

        if (index === -1) {
          resolve({ success: false, error: "Vehicle not found" });
          return;
        }

        // Update status
        inventory[index].status = status;
        inventory[index].lastUpdated = new Date().toISOString();

        // Add status-specific data
        if (status === "posted") {
          inventory[index].datePosted = new Date().toISOString();
        }

        // Save updated inventory
        chrome.storage.local.set({ vehicleInventory: inventory }, () => {
          resolve({ success: true });
        });
      });
    });
  },

  /**
   * Clear all stored vehicles
   * @returns {Promise<{success: boolean}>}
   */
  clearInventory: () => {
    return new Promise((resolve) => {
      chrome.storage.local.set({ vehicleInventory: [] }, () => {
        resolve({ success: true });
      });
    });
  },
};

export default StorageUtils;
