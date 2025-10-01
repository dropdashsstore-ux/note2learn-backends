//1️⃣ Import modules
const express = require("express");
const bodyParser = require("body-parser");
const paypal = require("@paypal/checkout-server-sdk");
const fs = require("fs");
const path = require("path");

// 2️⃣ PayPal environment (Sandbox or Live)
const environment = new paypal.core.LiveEnvironment(
  "AWGtUo737Mk8q-gu93EggJqBW3RQc7VGbaVBmcTEVp3j88Zn71_DZ-bedjelh-qxWdVJ00EMrsMqHc3B", // Client ID
  "ELobXisXewB3T-MAl7dnzApBYLjg2QJHlt_-JvkR4oFoevg7MBEIHgwdYtubdUgeinoaX0IPj4_fgJr4"  // Secret
);
const client = new paypal.core.PayPalHttpClient(environment);

const app = express();
app.use(bodyParser.json());

// 3️⃣ File paths for access codes
const PRO_CODES_FILE = path.join(__dirname, "../videos/pro_access_codes.csv");
const ENTERPRISE_CODES_FILE = path.join(__dirname, "../videos/enterprise_access_codes.csv");

// 4️⃣ Load CSV files into memory (simplest for now)
function loadCodes(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const lines = data.split("\n").filter(Boolean);
  return lines.map(line => {
    const [code, plan, used] = line.split(",");
    return { code, plan, used };
  });
}

// 5️⃣ Update CSV after usage
function saveCodes(filePath, codes) {
  const data = codes.map(c => `${c.code},${c.plan},${c.used}`).join("\n");
  fs.writeFileSync(filePath, data);
}

// 6️⃣ Webhook endpoint
app.post("/paypal-webhook", async (req, res) => {
  const webhookEvent = req.body;

  // Log for debugging
  console.log("Received PayPal webhook:", webhookEvent);

  // --- Step A: Identify subscription ID ---
  const subscriptionId = webhookEvent.resource && webhookEvent.resource.id;
  const email = webhookEvent.resource && webhookEvent.resource.subscriber && webhookEvent.resource.subscriber.email_address;

  if (!subscriptionId || !email) {
    return res.status(400).send("Invalid webhook data");
  }

  // Step B: Determine plan from subscription
  let planType = "";
  if (subscriptionId === "P-0NH870137T357213UNDNI3UQ") planType = "Enterprise";
  else if (subscriptionId === "P-5T5628518J728382DNDNIZEA") planType = "Pro";
  else return res.status(400).send("Unknown subscription ID");

  // Step C: Load codes
  const codesFile = planType === "Pro" ? PRO_CODES_FILE : ENTERPRISE_CODES_FILE;
  let codes = loadCodes(codesFile);

  // Step D: Find unused code to assign to user
  const codeEntry = codes.find(c => c.used === "No");
  if (!codeEntry) {
    return res.status(400).send("No available codes for this plan");
  }

  // Step E: Mark code as used
  codeEntry.used = "Yes";
  saveCodes(codesFile, codes);

  // Step F: Update your database here
  // Example: add user and assigned code
  // database.addUser({ email, plan: planType, code: codeEntry.code, active: true });

  console.log(`Assigned ${planType} code ${codeEntry.code} to ${email}`);

  // Step G: Respond to PayPal
  res.status(200).send("Webhook processed successfully");
});

// 7️⃣ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
