/**
 * Facebook Marketplace posting script
 * Automatically fills in vehicle information on Facebook Marketplace
 */

// Debugging flag - set to true to see detailed logs
const DEBUG = true;

// Function to log debuging messages
function debugLog(...args) {
  if (DEBUG) {
    console.log("[FB Auto-Fill]", ...args);
  }
}

// Function to pause execution for specified milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find an element using multiple approaches
 * Tries each selector and also tries finding by text content and attributes
 */
async function findElement(
  selectors,
  options = {},
  maxAttempts = 10,
  attemptDelay = 500
) {
  const {
    labelText = null, // Text in a label near the element
    placeholder = null, // Placeholder text
    ariaLabel = null, // aria-label attribute value
    role = null, // role attribute
    tagName = null, // specific tag like 'input', 'button'
    type = null, // input type (for inputs)
    testId = null, // data-testid attribute value
    position = null, // Position like 'first', 'last', index number
  } = options;

  if (!Array.isArray(selectors)) {
    selectors = selectors ? [selectors] : [];
  }

  let attempts = 0;
  let element = null;

  debugLog("Finding element with selectors and options:", {
    selectors,
    options,
  });

  while (attempts < maxAttempts && !element) {
    // Try direct CSS selectors first
    for (const selector of selectors) {
      try {
        element = document.querySelector(selector);
        if (element) {
          debugLog("Found element with selector:", selector);
          return element;
        }
      } catch (error) {
        console.error("Error with selector:", selector, error);
      }
    }

    // Try finding by label text (for form inputs)
    if (labelText) {
      const labels = Array.from(document.querySelectorAll("label"));
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
          // If the label has a 'for' attribute, get the input by ID
          if (label.htmlFor) {
            element = document.getElementById(label.htmlFor);
            if (element) {
              debugLog("Found element by label htmlFor:", label.htmlFor);
              return element;
            }
          }

          // Try to find input inside or after the label
          element =
            label.querySelector("input, textarea, select") ||
            label.nextElementSibling?.querySelector(
              "input, textarea, select"
            ) ||
            label.parentElement?.querySelector("input, textarea, select");

          if (element) {
            debugLog("Found element by label proximity");
            return element;
          }
        }
      }
    }

    // Try finding by placeholder
    if (placeholder) {
      const inputs = document.querySelectorAll("input, textarea");
      for (const input of inputs) {
        if (
          input.placeholder &&
          input.placeholder.toLowerCase().includes(placeholder.toLowerCase())
        ) {
          debugLog("Found element by placeholder:", placeholder);
          return input;
        }
      }
    }

    // Try finding by aria-label
    if (ariaLabel) {
      const elements = document.querySelectorAll("[aria-label]");
      for (const el of elements) {
        if (
          el
            .getAttribute("aria-label")
            .toLowerCase()
            .includes(ariaLabel.toLowerCase())
        ) {
          debugLog("Found element by aria-label:", ariaLabel);
          return el;
        }
      }
    }

    // Try finding by role
    if (role) {
      const elements = document.querySelectorAll(`[role="${role}"]`);
      if (elements.length > 0) {
        if (position === "first") return elements[0];
        if (position === "last") return elements[elements.length - 1];
        if (typeof position === "number") return elements[position] || null;

        // If no position specified but we found elements, return the first one
        debugLog("Found element by role:", role);
        return elements[0];
      }
    }

    // Try finding by tag name
    if (tagName) {
      const elements = document.getElementsByTagName(tagName);
      if (elements.length > 0) {
        if (position === "first") return elements[0];
        if (position === "last") return elements[elements.length - 1];
        if (typeof position === "number") return elements[position] || null;

        // Return first element if no position specified
        debugLog("Found element by tag name:", tagName);
        return elements[0];
      }
    }

    // Try finding by type (for inputs)
    if (type) {
      const inputs = document.querySelectorAll(`input[type="${type}"]`);
      if (inputs.length > 0) {
        if (position === "first") return inputs[0];
        if (position === "last") return inputs[inputs.length - 1];
        if (typeof position === "number") return inputs[position] || null;

        debugLog("Found element by input type:", type);
        return inputs[0];
      }
    }

    // Try finding by data-testid
    if (testId) {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (el) {
        debugLog("Found element by data-testid:", testId);
        return el;
      }
    }

    // If we haven't found the element yet, wait and try again
    attempts++;
    await sleep(attemptDelay);
  }

  debugLog("Element not found with any approach after", attempts, "attempts");
  return null;
}

/**
 * Find all elements matching any of the selectors
 */
async function findElements(selectors, maxAttempts = 10, attemptDelay = 500) {
  if (!Array.isArray(selectors)) {
    selectors = [selectors];
  }

  let attempts = 0;
  let elements = [];

  debugLog("Finding elements with selectors:", selectors);

  while (attempts < maxAttempts && elements.length === 0) {
    for (const selector of selectors) {
      try {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > 0) {
          debugLog("Found", found.length, "elements with selector:", selector);
          elements = found;
          break;
        }
      } catch (error) {
        console.error("Error finding elements with selector:", selector, error);
      }
    }

    if (elements.length === 0) {
      attempts++;
      await sleep(attemptDelay);
    }
  }

  return elements;
}

/**
 * Function to find and fill an input field
 * Uses multiple methods to try to fill inputs properly
 */
async function fillInputField(selectors, value, options = {}) {
  if (!value) {
    debugLog("No value to fill");
    return false;
  }

  // Wait for the element to be available
  const element = await findElement(selectors);

  if (!element) {
    console.error(`Element not found with selectors:`, selectors);
    return false;
  }

  try {
    debugLog("Filling input field:", selectors, "with value:", value);

    // Focus the input to trigger any event listeners
    element.focus();
    await sleep(100);

    // Clear existing value if needed
    if (options.clearFirst) {
      element.value = "";
      await sleep(100);
    }

    // Try multiple approaches to set the value
    // Method 1: Direct property setting
    element.value = value;

    // Method 2: Simulate typing
    for (const char of value.toString()) {
      const keyCode = char.charCodeAt(0);
      element.dispatchEvent(
        new KeyboardEvent("keydown", { key: char, keyCode })
      );
      element.dispatchEvent(
        new KeyboardEvent("keypress", { key: char, keyCode })
      );
      element.value += char;
      element.dispatchEvent(new KeyboardEvent("keyup", { key: char, keyCode }));
      await sleep(10);
    }

    // Method 3: Dispatch events to ensure React components update
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));

    // Optional delay after filling
    if (options.delayAfter) {
      await sleep(options.delayAfter);
    }

    debugLog("Successfully filled input field");
    return true;
  } catch (error) {
    console.error("Error filling input field:", error);
    return false;
  }
}

/**
 * Select the vehicle type in the Facebook form
 */
async function selectVehicleType() {
  try {
    debugLog("Selecting vehicle type...");
    
    // Look for vehicle type dropdown
    const vehicleTypeDropdown = await findElement(
      ['[aria-label="Vehicle type"]', '[placeholder="Vehicle type"]'],
      {
        labelText: "Vehicle type",
        role: "combobox",
      },
      15, // More attempts
      800  // Longer delay
    );
    
    if (!vehicleTypeDropdown) {
      debugLog("Vehicle type dropdown not found");
      return false;
    }
    
    // Click to open the dropdown
    vehicleTypeDropdown.click();
    await sleep(1200);
    
    // Find and click the "Car/Truck" option
    const options = await findElements(
      ['[role="option"]', '[role="menuitem"]', 'li', '.dropdown-item']
    );
    
    let found = false;
    for (const option of options) {
      const text = option.textContent.trim().toLowerCase();
      if (text === "car/truck" || text.includes("car") || text.includes("truck")) {
        debugLog("Selecting Car/Truck option");
        option.click();
        found = true;
        await sleep(1500);
        break;
      }
    }
    
    if (!found) {
      debugLog("Could not find Car/Truck option, trying to type it directly");
      // Try typing directly if we couldn't click an option
      if (vehicleTypeDropdown.tagName === "INPUT") {
        vehicleTypeDropdown.value = "Car/Truck";
        vehicleTypeDropdown.dispatchEvent(new Event("input", { bubbles: true }));
        vehicleTypeDropdown.dispatchEvent(new Event("change", { bubbles: true }));
        vehicleTypeDropdown.dispatchEvent(new KeyboardEvent("keydown", { 
          key: "Enter", 
          keyCode: 13, 
          which: 13,
          bubbles: true 
        }));
        await sleep(800);
        return true;
      }
    }
    
    return found;
  } catch (error) {
    console.error("Error selecting vehicle type:", error);
    return false;
  }
}

/**
 * Upload images to Facebook listing
 */
async function uploadImages(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    debugLog("No images to upload");
    return false;
  }

  try {
    debugLog("Starting image upload process");
    showFloatingStatus("Preparing to upload images...");

    // First, try to locate any "Add photos" button
    const addPhotosButton = await findElement(
      ['[aria-label="Add photos"]', '[aria-label="Add Photos"]', 'button:contains("Add photos")'],
      {
        labelText: "Add photos",
        ariaLabel: "Add photos",
        role: "button",
      },
      15,  // More attempts
      800   // Longer delay
    );

    if (addPhotosButton) {
      debugLog('Found "Add photos" button, clicking it');
      addPhotosButton.click();
      await sleep(1500);
    }

    // Now find the file input
    let fileInput = await findElement(
      ['input[type="file"][accept*="image"]', 'input[type="file"]'],
      {
        type: "file",
      },
      15,  // More attempts
      800   // Longer delay
    );

    if (!fileInput) {
      debugLog("File input not found directly, trying alternative approaches");

      // Look for any file input
      const allInputs = document.querySelectorAll("input");
      for (const input of allInputs) {
        if (input.type === "file" || input.accept?.includes("image")) {
          fileInput = input;
          debugLog("Found file input through all inputs scan");
          break;
        }
      }

      if (!fileInput) {
        debugLog("Still could not find file input, trying to create one");

        // Create a file input
        fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.multiple = true;
        fileInput.style.position = "absolute";
        fileInput.style.top = "-1000px";
        document.body.appendChild(fileInput);
      }
    }

    if (!fileInput) {
      showFloatingStatus("Could not find or create file input", "error");
      return false;
    }

    debugLog("Found file input, downloading images");
    showFloatingStatus("Downloading images...");

    // Improved image downloading process
    let imageFiles = [];
    let successCount = 0;
    const maxImages = Math.min(5, imageUrls.length);

    for (let i = 0; i < maxImages; i++) {
      const url = imageUrls[i];
      try {
        debugLog(`Downloading image ${i + 1}/${maxImages}: ${url}`);
        
        // Use a Blob URL approach with proxied URL when needed
        const fetchOptions = {
          method: "GET",
          mode: "cors",
          cache: "no-cache",
          credentials: "same-origin",
          redirect: "follow",
          referrerPolicy: "no-referrer",
        };
        
        // Try direct fetch first
        let response;
        try {
          response = await fetch(url, fetchOptions);
          if (!response.ok) throw new Error("Direct fetch failed");
        } catch (err) {
          // Try with a proxy if direct fetch fails
          const proxiedUrl = `https://cors-anywhere.herokuapp.com/${url}`;
          response = await fetch(proxiedUrl, fetchOptions);
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        const blob = await response.blob();
        const fileName = `vehicle_image_${i + 1}_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        imageFiles.push(file);
        successCount++;
        
      } catch (error) {
        debugLog(`Error downloading image ${i + 1}:`, error.message);

        // Fallback to canvas approach if fetch fails
        // Modify the image downloading part in uploadImages function:
        try {
          // Use base64 data URLs instead of trying to fetch the actual images
          const img = new Image();
          img.crossOrigin = "anonymous";

          // Set up a timeout to prevent hanging
          const imgPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Image loading timed out")),
              10000
            );

            img.onload = () => {
              clearTimeout(timeout);
              const canvas = document.createElement("canvas");
              canvas.width = img.width || 800; // Set fallback size if width is 0
              canvas.height = img.height || 600;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0);

              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    const fileName = `vehicle_image_${i + 1}_${Date.now()}.jpg`;
                    const file = new File([blob], fileName, {
                      type: "image/jpeg",
                    });
                    resolve(file);
                  } else {
                    reject(new Error("Canvas to Blob conversion failed"));
                  }
                },
                "image/jpeg",
                0.75
              ); // Lower quality for better compatibility
            };

            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Image loading failed"));
            };
          });

          // Try loading the image without CORS first
          img.src = url;

          // If that fails, add a fallback
          if (img.complete && img.naturalWidth === 0) {
            throw new Error("Image didn't load properly");
          }

          const file = await imgPromise;
          imageFiles.push(file);
          successCount++;
        } catch (error) {
          debugLog(`Error with image ${i + 1}:`, error.message);
          // Consider adding a placeholder image here
        }
      }
    }

    if (imageFiles.length === 0) {
      showFloatingStatus("Could not download any images. Please add them manually.", "warning");
      return false;
    }

    debugLog(`Successfully downloaded ${successCount} images, uploading now`);
    showFloatingStatus(`Uploading ${successCount} images...`);

    // Upload using DataTransfer when supported
    try {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach(file => dataTransfer.items.add(file));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      
      // Wait for images to upload
      await sleep(imageFiles.length * 1000);
      showFloatingStatus("Images uploaded successfully", "success");
      return true;
      
    } catch (error) {
      debugLog("DataTransfer method failed:", error.message);
      
      // Fallback to clicking the input and showing manual instructions
      try {
        fileInput.click();
        showFloatingStatus("Please select the downloaded images manually", "warning");
        return false;
      } catch (clickError) {
        debugLog("Input click failed:", clickError.message);
        return false;
      }
    }
  } catch (error) {
    console.error("Error in uploadImages:", error);
    showFloatingStatus("Error uploading images: " + error.message, "error");
    return false;
  }
}

/**
 * Function to select an option from a dropdown
 * Works with various dropdown implementations
 */
async function selectDropdownOption(
  dropdownSelectors,
  optionText,
  options = {}
) {
  if (!optionText) {
    debugLog("No option text to select");
    return false;
  }

  try {
    debugLog("Selecting dropdown option:", optionText);

    // Find dropdown element
    const dropdown = await findElement(dropdownSelectors);
    // Add this method to selectDropdownOption function:
    if (!dropdown) {
      // Try a different approach - look for labels first
      const labels = document.querySelectorAll("label");
      for (const label of labels) {
        if (
          label.textContent.includes(
            dropdownSelectors[0].replace('[aria-label="', "").replace('"]', "")
          )
        ) {
          // Found label, now look for nearby dropdown
          const possibleDropdown =
            label.nextElementSibling ||
            label.parentElement.querySelector('[role="combobox"]') ||
            label.parentElement.querySelector("select");

          if (possibleDropdown) {
            dropdown = possibleDropdown;
            break;
          }
        }
      }

      // If still not found, try more direct approach
      if (!dropdown) {
        // Just try to type the value in any visible input
        const inputs = document.querySelectorAll('input:not([type="hidden"])');
        for (const input of inputs) {
          if (input.offsetParent !== null) {
            // Check if visible
            dropdown = input;
            break;
          }
        }
      }
    }

    // Try to click to open dropdown
    dropdown.click();
    await sleep(options.dropdownDelay || 800);

    // Multiple approaches to find dropdown options
    const optionSelectors = [
      'div[role="option"]',
      'li[role="option"]',
      ".dropdown-option",
      ".select-option",
      'div[role="menuitem"]',
      '[data-testid="dropdown-option"]',
      // Add more generic selectors that might match options
      "ul > li",
      ".menu-item",
      '[role="listbox"] > *',
    ];

    // Find all potential options from DOM
    const allOptions = await findElements(optionSelectors);

    // No options found
    if (allOptions.length === 0) {
      console.error("No options found for dropdown");

      // Try direct input if it's an input-based selector
      if (dropdown.tagName === "INPUT") {
        debugLog("Attempting to fill dropdown as input field");
        dropdown.value = optionText;
        dropdown.dispatchEvent(new Event("input", { bubbles: true }));
        dropdown.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(300);

        // Press Enter key
        dropdown.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            keyCode: 13,
            bubbles: true,
          })
        );
        await sleep(300);

        return true;
      }

      return false;
    }

    debugLog("Found", allOptions.length, "potential options");

    // Convert option text to lowercase for case-insensitive comparison
    const targetText = optionText.toString().toLowerCase();

    // Find and click the matching option
    let optionFound = false;

    for (const option of allOptions) {
      const text = option.textContent.toLowerCase().trim();

      // Look for exact match or contains match
      if (text === targetText || text.includes(targetText)) {
        debugLog("Found matching option:", text);
        option.click();
        optionFound = true;
        await sleep(options.delayAfter || 500);
        break;
      }
    }

    if (!optionFound) {
      // Try fallback: click dropdown again to close it
      dropdown.click();
      await sleep(300);

      // If it's an input element, try to just set the value
      if (dropdown.tagName === "INPUT") {
        debugLog("No matching option found, trying direct input");
        dropdown.value = optionText;
        dropdown.dispatchEvent(new Event("input", { bubbles: true }));
        dropdown.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(300);

        // Press Tab to try to finalize selection
        dropdown.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Tab",
            keyCode: 9,
            bubbles: true,
          })
        );

        return true;
      }

      console.error("Option not found in dropdown:", optionText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error selecting dropdown option:", error);
    return false;
  }
}

/**
 * Fill in the entire Facebook Marketplace vehicle listing form
*/
async function fillFacebookListingForm(vehicleData) {
  let formReady = false;
  let attempts = 0;
  while (!formReady && attempts < 20) {
    // Check for key elements that indicate the form is loaded
    const formElements = document.querySelectorAll('input, select, [role="combobox"]');
    if (formElements.length > 5) {
      formReady = true;
      debugLog("Form appears to be ready with", formElements.length, "form elements");
    } else {
      debugLog("Waiting for form to load...");
      await sleep(1000);
      attempts++;
    }
  }
  
  if (!formReady) {
    showFloatingStatus("Form didn't load properly. Try refreshing the page.", "error");
    return false;
  }
  try {
    debugLog("Starting to fill Facebook form with vehicle data:", vehicleData);
    showFloatingStatus("Starting form fill...");

    // Wait for the form to load
    await sleep(2000);

    // First, select vehicle type (Car/Truck)
    await selectVehicleType();

    // Make sure we're on the vehicle creation page
    if (
      !window.location.href.includes("facebook.com/marketplace/create/vehicle")
    ) {
      debugLog(
        "Not on vehicle creation page, checking if we need to select vehicle category"
      );

      // Find the "Insert Vehicle Data" button or similar
      const insertDataButton = await findElement(['button[type="button"]'], {
        labelText: "Insert Vehicle Data",
        role: "button",
      });

      if (insertDataButton) {
        debugLog("Found Insert Vehicle Data button, clicking it");
        insertDataButton.click();
        await sleep(1500);
      } else {
        // Look for vehicle type selector
        const vehicleType = await findElement([], {
          ariaLabel: "Vehicle type",
          role: "combobox",
          labelText: "Vehicle type",
        });

        if (vehicleType) {
          debugLog("Found vehicle type selector, clicking it");
          vehicleType.click();
          await sleep(1000);

          // Find options that appear after clicking
          const options = document.querySelectorAll(
            '[role="option"], [role="menuitem"], li, .dropdown-item'
          );
          debugLog(`Found ${options.length} potential options`);

          for (const option of options) {
            if (option.textContent.toLowerCase().includes("vehicle")) {
              debugLog("Found Vehicle option, clicking it");
              option.click();
              await sleep(1500);
              break;
            }
          }
        }
      }
    }

    // Let's now find and fill all the form fields using our more robust methods
    showFloatingStatus("Setting basic vehicle details...");

    // Try to fill Make field
    if (vehicleData.make) {
      const makeField = await findElement(['input[name="make"]'], {
        labelText: "Make",
        placeholder: "Make",
        ariaLabel: "Make",
      });

      if (makeField) {
        debugLog("Found Make field, filling with:", vehicleData.make);
        // Focus and clear field first
        makeField.focus();
        makeField.value = "";
        await sleep(200);

        // Type value character by character
        for (const char of vehicleData.make) {
          makeField.value += char;
          makeField.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(50);
        }

        makeField.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(500);
      } else {
        debugLog("Make field not found");
      }
    }

    // Try to fill Model field
    if (vehicleData.model) {
      const modelField = await findElement(['input[name="model"]'], {
        labelText: "Model",
        placeholder: "Model",
        ariaLabel: "Model",
      });

      if (modelField) {
        debugLog("Found Model field, filling with:", vehicleData.model);
        // Focus and clear field first
        modelField.focus();
        modelField.value = "";
        await sleep(200);

        // Type value character by character
        for (const char of vehicleData.model) {
          modelField.value += char;
          modelField.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(50);
        }

        modelField.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(500);
      } else {
        debugLog("Model field not found");
      }
    }

    // Try to select Year field
    if (vehicleData.year) {
      // First try to find and click on the year dropdown
      const yearField = await findElement([], {
        labelText: "Year",
        role: "combobox",
        ariaLabel: "Year",
      });

      if (yearField) {
        debugLog("Found Year field, clicking to open dropdown");
        yearField.click();
        await sleep(1000);

        // Now try to find and click the specific year option
        const yearOptions = document.querySelectorAll(
          '[role="option"], [role="menuitem"], li, option'
        );
        let yearFound = false;

        for (const option of yearOptions) {
          if (option.textContent.trim() === vehicleData.year.toString()) {
            debugLog("Found matching year option:", option.textContent);
            option.click();
            yearFound = true;
            await sleep(500);
            break;
          }
        }

        if (!yearFound) {
          debugLog(
            "Could not find specific year option, will try direct input"
          );
          // Try direct input if it's an input element
          if (yearField.tagName === "INPUT") {
            yearField.value = vehicleData.year;
            yearField.dispatchEvent(new Event("input", { bubbles: true }));
            yearField.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      } else {
        debugLog("Year field not found");
      }
    }

    // Kilometers/Mileage
    const mileageSelectors = [
      'input[name="mileage"]',
      'input[aria-label="Mileage"]',
      'input[placeholder*="Mileage"]',
      'input[id*="mileage"]',
      'input[id*="kilom"]',
    ];

    if (vehicleData.kilometers) {
      await fillInputField(mileageSelectors, vehicleData.kilometers, {
        delayAfter: 500,
      });
    }

    // Exterior Color
    const exteriorColorSelectors = [
      '[aria-label="Exterior Color"]',
      '[placeholder*="Exterior Color"]',
      'select[name="exteriorColor"]',
    ];

    if (vehicleData.exteriorColor) {
      await selectDropdownOption(
        exteriorColorSelectors,
        vehicleData.exteriorColor,
        { delayAfter: 500 }
      );
    }

    // Transmission
    const transmissionSelectors = [
      '[aria-label="Transmission"]',
      'select[name="transmission"]',
      '[role="combobox"][aria-label*="Transmission"]',
    ];

    if (vehicleData.transmission) {
      // Map common AutoTrader transmission values to Facebook options
      let transmissionValue = vehicleData.transmission.toLowerCase();

      if (transmissionValue.includes("auto")) {
        transmissionValue = "Automatic";
      } else if (
        transmissionValue.includes("manual") ||
        transmissionValue.includes("standard")
      ) {
        transmissionValue = "Manual";
      }

      await selectDropdownOption(transmissionSelectors, transmissionValue, {
        delayAfter: 500,
      });
    }

    // Fuel Type
    const fuelTypeSelectors = [
      '[aria-label="Fuel Type"]',
      'select[name="fuelType"]',
      '[role="combobox"][aria-label*="Fuel"]',
    ];

    if (vehicleData.fuelType) {
      await selectDropdownOption(fuelTypeSelectors, vehicleData.fuelType, {
        delayAfter: 500,
      });
    }

    // Update status
    showFloatingStatus("Setting price and title...");

    // Title
    const titleSelectors = [
      'input[name="title"]',
      'input[aria-label="Title"]',
      'input[placeholder*="Title"]',
      'input[id*="title"]',
      // Add more generic selectors
      'input[type="text"]:not([aria-label="Price"])',
    ];

    const titleText = `${vehicleData.year} ${vehicleData.make} ${
      vehicleData.model
    }${vehicleData.trim ? " " + vehicleData.trim : ""}`;
    await fillInputField(titleSelectors, titleText, { delayAfter: 500 });

    // Price
    const priceSelectors = [
      'input[name="price"]',
      'input[aria-label="Price"]',
      'input[placeholder*="Price"]',
      'input[type="number"]',
      'input[id*="price"]',
      // Add this very generic selector as a last resort
      'input[type="text"]:not([aria-label="Make"]):not([aria-label="Model"])',
    ];

    if (vehicleData.price) {
      debugLog("Filling price field with:", vehicleData.price);

      // Find price input with more attempts
      const priceInput = await findElement(priceSelectors, {}, 15, 800);

      if (priceInput) {
        // Focus and clear first
        priceInput.focus();
        priceInput.value = "";
        await sleep(200);

        // Set value directly
        priceInput.value = vehicleData.price.toString().replace(/[^0-9]/g, "");

        // Dispatch events
        priceInput.dispatchEvent(new Event("input", { bubbles: true }));
        priceInput.dispatchEvent(new Event("change", { bubbles: true }));
        priceInput.dispatchEvent(new Event("blur", { bubbles: true }));

        await sleep(500);
      } else {
        debugLog("Price field not found after multiple attempts");
      }
    }

    // Location - Facebook may require a location
    const locationSelectors = [
      'input[placeholder*="Location"]',
      'input[aria-label="Location"]',
      'input[name="location"]',
    ];

    // Try to set a generic location if we have one
    if (vehicleData.dealerLocation) {
      await fillInputField(locationSelectors, vehicleData.dealerLocation, {
        delayAfter: 500,
      });
    }

    // Description
    showFloatingStatus("Creating description...");

    // Create comprehensive description
    let description = titleText + "\n\n";

    // Add price information
    if (vehicleData.price) {
      description += `Price: ${vehicleData.price.toLocaleString()}\n`;
    }

    if (vehicleData.msrp && vehicleData.msrp !== vehicleData.price) {
      description += `MSRP: ${vehicleData.msrp.toLocaleString()}\n`;
    }

    description += "\n";

    // Add kilometers/mileage
    if (vehicleData.kilometers) {
      description += `Kilometers: ${vehicleData.kilometers.toLocaleString()}\n`;
    }

    // Add specifications
    if (vehicleData.bodyType)
      description += `Body Type: ${vehicleData.bodyType}\n`;
    if (vehicleData.transmission)
      description += `Transmission: ${vehicleData.transmission}\n`;
    if (vehicleData.drivetrain)
      description += `Drivetrain: ${vehicleData.drivetrain}\n`;
    if (vehicleData.fuelType)
      description += `Fuel Type: ${vehicleData.fuelType}\n`;
    if (vehicleData.engine) description += `Engine: ${vehicleData.engine}\n`;
    if (vehicleData.exteriorColor)
      description += `Exterior Color: ${vehicleData.exteriorColor}\n`;
    if (vehicleData.interiorColor)
      description += `Interior Color: ${vehicleData.interiorColor}\n`;

    description += "\n";

    // Add stock number and VIN if available
    if (vehicleData.stockNumber) {
      description += `Stock Number: ${vehicleData.stockNumber}\n`;
    }

    if (vehicleData.vin) {
      description += `VIN: ${vehicleData.vin}\n`;
    }

    description += "\n";

    // Add additional description if available
    if (vehicleData.description) {
      description += vehicleData.description + "\n\n";
    }

    // Add source link
    description += `Original listing: ${vehicleData.sourceUrl}`;

    // Find and fill description field
    const descriptionSelectors = [
      "textarea",
      'textarea[name="description"]',
      'textarea[aria-label="Description"]',
      'div[contenteditable="true"]',
      'div[role="textbox"]',
    ];

    await fillInputField(descriptionSelectors, description, {
      delayAfter: 800,
    });

    // Upload images
    showFloatingStatus("Uploading images...");
    await uploadImages(vehicleData.images);

    // Update status
    showFloatingStatus("Form filled successfully!", "success");
    debugLog("Form filled successfully!");

    return true;
  } catch (error) {
    console.error("Error filling Facebook form:", error);
    showFloatingStatus("Error filling form: " + error.message, "error");
    return false;
  }
}

/**
 * Show a floating status indicator
 */
function showFloatingStatus(message, type = "info") {
  // Remove any existing status
  const existingStatus = document.getElementById("vehicle-lister-status");
  if (existingStatus) {
    existingStatus.remove();
  }

  // Set color based on type
  let backgroundColor = "#4285f4"; // default blue for info
  if (type === "success") {
    backgroundColor = "#0f9d58"; // green
  } else if (type === "error") {
    backgroundColor = "#db4437"; // red
  } else if (type === "warning") {
    backgroundColor = "#f4b400"; // yellow
  }

  // Create status element
  const status = document.createElement("div");
  status.id = "vehicle-lister-status";
  status.innerHTML = `
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
    ">
      ${message}
    </div>
  `;

  // Add to page
  document.body.appendChild(status);

  // Remove after a timeout unless it's an error
  if (type !== "error") {
    setTimeout(() => {
      if (status.parentNode) {
        status.parentNode.removeChild(status);
      }
    }, 5000);
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog("Facebook content script received message:", message);

  if (message.action === "fillListingForm" && message.vehicleData) {
    // Start filling the form
    fillFacebookListingForm(message.vehicleData)
      .then((success) => {
        sendResponse({
          success,
          message: success ? "Form filled successfully" : "Error filling form",
        });
      })
      .catch((error) => {
        console.error("Error in fillListingForm:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }
});

// Check if we need to auto-fill based on pending data
(async function () {
  try {
    // Wait a moment for page to load
    await sleep(1000);

    // Check if we're on the Facebook Marketplace vehicle listing creation page
    if (
      window.location.href.includes("facebook.com/marketplace/create/vehicle")
    ) {
      debugLog(
        "On Facebook Marketplace vehicle creation page - checking for pending data"
      );

      // Get pending Facebook post data from storage
      chrome.storage.local.get("pendingFacebookPost", async (result) => {
        const pendingPost = result.pendingFacebookPost;

        if (pendingPost && pendingPost.vehicleId) {
          debugLog("Found pending Facebook post, getting vehicle data...");

          // Get the vehicle data from storage
          chrome.storage.local.get("vehicleInventory", async (result) => {
            const inventory = result.vehicleInventory || [];
            const vehicle = inventory.find(
              (v) => v.id === pendingPost.vehicleId
            );

            if (vehicle) {
              debugLog("Auto-filling form with vehicle data:", vehicle);

              // Show notification
              showFloatingStatus(
                `Auto-filling ${vehicle.year} ${vehicle.make} ${vehicle.model} listing...`
              );

              // Wait a moment, then fill the form
              await sleep(1500);
              await fillFacebookListingForm(vehicle);

              // Update vehicle status
              const updatedInventory = inventory.map((v) => {
                if (v.id === pendingPost.vehicleId) {
                  return {
                    ...v,
                    status: "posting",
                    lastUpdated: new Date().toISOString(),
                  };
                }
                return v;
              });

              // Save updated inventory
              chrome.storage.local.set({
                vehicleInventory: updatedInventory,
                // Clear the pending post
                pendingFacebookPost: null,
              });
            } else {
              showFloatingStatus(
                "Vehicle data not found in inventory",
                "error"
              );
            }
          });
        } else {
          debugLog("No pending posts found in storage");
        }
      });
    }
  } catch (error) {
    console.error("Error in auto-fill check:", error);
    showFloatingStatus(
      "Error checking for pending posts: " + error.message,
      "error"
    );
  }
})();
