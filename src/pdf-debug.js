import poppler from 'pdf-poppler';

// Print out the poppler module details
console.log("Poppler module paths:", poppler);
console.log("Current platform:", process.platform);

// Check if there's a platform check in the module
const popplerCode = JSON.stringify(poppler);
console.log("Poppler code contains platform check:", 
  popplerCode.includes("linux") || popplerCode.includes("platform"));

try {
  // Try to access any function
  console.log("Poppler functions:", Object.keys(poppler));
} catch (e) {
  console.error("Error inspecting poppler:", e);
}
