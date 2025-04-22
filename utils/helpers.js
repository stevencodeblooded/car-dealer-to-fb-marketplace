/**
 * Helper utility functions for Vehicle Lister extension
 */

const Helpers = {
  /**
   * Format a price for display
   * @param {number|string} price - The price to format
   * @param {boolean} includeDollarSign - Whether to include $ sign
   * @returns {string} Formatted price
   */
  formatPrice: (price, includeDollarSign = true) => {
    if (!price) return "";

    // Convert to number if it's a string
    const numPrice =
      typeof price === "string"
        ? parseFloat(price.replace(/[^0-9.]/g, ""))
        : price;

    if (isNaN(numPrice)) return "";

    // Format with commas
    const formattedPrice = numPrice.toLocaleString("en-CA");
    return includeDollarSign ? `$${formattedPrice}` : formattedPrice;
  },

  /**
   * Extract numeric value from a string
   * @param {string} str - String containing a number
   * @returns {number|null} Extracted number or null if not found
   */
  extractNumber: (str) => {
    if (!str) return null;

    const matches = str.match(/[\d,]+(\.\d+)?/);
    if (!matches) return null;

    return parseFloat(matches[0].replace(/,/g, ""));
  },

  /**
   * Create a Facebook-friendly vehicle description
   * @param {Object} vehicleData - Vehicle data object
   * @returns {string} Formatted description
   */
  createFacebookDescription: (vehicleData) => {
    let description = "";

    // Add title
    if (vehicleData.year && vehicleData.make && vehicleData.model) {
      description += `${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`;
      if (vehicleData.trim) {
        description += ` ${vehicleData.trim}`;
      }
      description += "\n\n";
    }

    // Add price information
    if (vehicleData.price) {
      description += `Price: ${Helpers.formatPrice(vehicleData.price)}\n`;

      if (vehicleData.msrp && vehicleData.msrp !== vehicleData.price) {
        description += `MSRP: ${Helpers.formatPrice(vehicleData.msrp)}\n`;
      }

      description += "\n";
    }

    // Add kilometers/mileage
    if (vehicleData.kilometers) {
      description += `Kilometers: ${vehicleData.kilometers.toLocaleString()}\n`;
    }

    // Add key specifications
    const specs = [];

    if (vehicleData.bodyType) specs.push(`Body Type: ${vehicleData.bodyType}`);
    if (vehicleData.transmission)
      specs.push(`Transmission: ${vehicleData.transmission}`);
    if (vehicleData.drivetrain)
      specs.push(`Drivetrain: ${vehicleData.drivetrain}`);
    if (vehicleData.fuelType) specs.push(`Fuel Type: ${vehicleData.fuelType}`);
    if (vehicleData.engine) specs.push(`Engine: ${vehicleData.engine}`);
    if (vehicleData.exteriorColor)
      specs.push(`Exterior Color: ${vehicleData.exteriorColor}`);
    if (vehicleData.interiorColor)
      specs.push(`Interior Color: ${vehicleData.interiorColor}`);

    if (specs.length > 0) {
      description += specs.join("\n") + "\n\n";
    }

    // Add stock number and VIN if available
    if (vehicleData.stockNumber) {
      description += `Stock Number: ${vehicleData.stockNumber}\n`;
    }

    if (vehicleData.vin) {
      description += `VIN: ${vehicleData.vin}\n\n`;
    }

    // Add description if available
    if (vehicleData.description) {
      description += `${vehicleData.description}\n\n`;
    }

    // Add dealer information if available
    if (vehicleData.dealerName) {
      description += `Available at: ${vehicleData.dealerName}`;
      if (vehicleData.dealerLocation) {
        description += `, ${vehicleData.dealerLocation}`;
      }
      description += "\n";
    }

    return description;
  },

  /**
   * Format a date for display
   * @param {string} dateString - ISO date string
   * @returns {string} Formatted date
   */
  formatDate: (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  },

  /**
   * Download images from URLs with multiple fallback approaches
   * @param {Array} imageUrls - Array of image URLs
   * @returns {Promise<Array>} Array of image Blob objects
   */
  downloadImages: async (imageUrls) => {
    if (!imageUrls || !imageUrls.length) return [];

    const imageBlobs = [];
    const maxImages = Math.min(10, imageUrls.length); // Limit number of images

    for (let i = 0; i < maxImages; i++) {
      const url = imageUrls[i];
      let blob = null;

      // Try multiple approaches
      try {
        // Approach 1: Direct fetch
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          cache: "no-cache",
          credentials: "same-origin",
          redirect: "follow",
          referrerPolicy: "no-referrer",
        });

        if (response.ok) {
          blob = await response.blob();
        } else {
          throw new Error("Direct fetch failed");
        }
      } catch (error) {
        console.warn(
          `Primary download approach failed for image ${i + 1}:`,
          error
        );

        try {
          // Approach 2: Try with a proxy service
          const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
          const proxyResponse = await fetch(proxyUrl);

          if (proxyResponse.ok) {
            blob = await proxyResponse.blob();
          } else {
            throw new Error("Proxy fetch failed");
          }
        } catch (proxyError) {
          console.warn(
            `Proxy download approach failed for image ${i + 1}:`,
            proxyError
          );

          try {
            // Approach 3: Try using Image and Canvas
            const img = new Image();
            img.crossOrigin = "Anonymous";

            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = url;
            });

            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            blob = await new Promise((resolve) => {
              canvas.toBlob(resolve, "image/jpeg", 0.85);
            });
          } catch (canvasError) {
            console.error(
              `Canvas approach also failed for image ${i + 1}:`,
              canvasError
            );
          }
        }
      }

      if (blob) {
        imageBlobs.push(blob);
      }
    }

    return imageBlobs;
  },

  /**
   * Convert Blob objects to File objects
   * @param {Array} blobs - Array of image Blobs
   * @returns {Array} Array of File objects
   */
  convertBlobsToFiles: (blobs) => {
    return blobs.map((blob, index) => {
      const fileName = `vehicle_image_${index + 1}_${Date.now()}.jpg`;
      return new File([blob], fileName, { type: blob.type || "image/jpeg" });
    });
  },

  /**
   * Convert array of image URLs to data URLs
   * @param {Array} imageUrls - Array of image URLs
   * @returns {Promise<Array>} Array of data URLs
   */
  convertToDataUrls: async (imageUrls) => {
    if (!imageUrls || !imageUrls.length) return [];

    const imagePromises = imageUrls.map((url) =>
      fetch(url)
        .then((response) => response.blob())
        .then((blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        })
        .catch((error) => {
          console.error("Error converting image to data URL:", error);
          return null;
        })
    );

    const dataUrls = await Promise.all(imagePromises);
    return dataUrls.filter((url) => url !== null);
  },

  /**
   * Sleep/wait for specified milliseconds
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after specified time
   */
  sleep: (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Generate a unique ID
   * @returns {string} Unique ID
   */
  generateId: () => {
    return "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  },
};

export default Helpers;
