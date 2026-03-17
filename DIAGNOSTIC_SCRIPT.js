// 🔍 Browser Console Diagnostic Script
// Paste this in DevTools Console (F12) to debug the issue

console.log("=== 🔍 CRM API Configuration Diagnostic ===\n");

// 1. Check environment variables
console.log("1️⃣ Environment Variables:");
console.log("   VITE_API_BASE:", import.meta.env.VITE_API_BASE);
console.log("   VITE_WP_API_KEY:", import.meta.env.VITE_WP_API_KEY);

// 2. Check localStorage for sites
console.log("\n2️⃣ Saved Sites (localStorage):");
const sites = JSON.parse(localStorage.getItem("crm_wp_sites") || "[]");
console.log("   Number of sites:", sites.length);
if (sites.length > 0) {
  sites.forEach((site, i) => {
    console.log(`   Site ${i + 1}:`, {
      name: site.name,
      url: site.url,
      id: site.id,
    });
  });
} else {
  console.warn("   ⚠️ NO SITES CONFIGURED! You must add a WordPress site.");
}

// 3. Check current site
console.log("\n3️⃣ Current Site (localStorage):");
const currentSiteId = localStorage.getItem("crm_current_site_id");
console.log("   Current Site ID:", currentSiteId);

// 4. Check site cache (in-memory)
console.log("\n4️⃣ Site Cache (in-memory - from SiteContext):");
const siteCache = window.__crm_site_cache || "Not loaded yet";
console.log("   Cache:", siteCache);

// 5. Check leads cache
console.log("\n5️⃣ Leads Local Cache:");
const leadsCache = JSON.parse(
  localStorage.getItem("crm_leads_local_updates") || "{}",
);
console.log("   Cached leads:", Object.keys(leadsCache).length);

// 6. Suggest fixes
console.log("\n6️⃣ FIXES TO TRY:");
if (sites.length === 0) {
  console.log("   ❌ NO SITES CONFIGURED");
  console.log(
    '   ✅ ACTION: Go to "Sites" menu and add your WordPress site URL',
  );
  console.log("   Example: http://localhost/wordpress or https://yoursite.com");
} else {
  console.log("   ✅ Sites are configured");
  const site = sites[0];
  console.log(`   Will try to use: ${site.url}/wp-json/crm/v1`);
  console.log(`   With API key: ${import.meta.env.VITE_WP_API_KEY}`);
}

console.log("\n=== End Diagnostic ===\n");
