# Dashboard & Widget API Fetch Issues - Fixed

## Issues Found & Resolved

### 1. **WP Leads API Not Fetching - Root Causes**

#### Issue A: Empty API_BASE on Page Refresh

**Problem:**

- When the dashboard page refreshes, the `siteCache` might not be initialized yet
- `wpLeadsApi.getApiBase()` returns an empty string if no site is in cache
- The fallback `VITE_API_BASE=/wp-api` is a relative path that doesn't work when the WordPress site is on a different domain/port
- This causes fetch to `/leads?api_key=SECRET123` → **Network Error**

**Solution:**
✅ Added validation in `wpLeadsApi.ts`:

```typescript
if (!API_BASE) {
  console.error("❌ [wpLeadsApi] API_BASE is empty. Site not configured...");
  throw new Error("API_BASE is not configured. Please check site settings.");
}
```

#### Issue B: No Error Context in DashboardPage

**Problem:**

- The error was caught but not properly logged
- Users saw "Failed to load stats" without knowing why
- No toast notification to inform users

**Solution:**
✅ Enhanced error logging in `DashboardPage.tsx`:

```typescript
catch (error: any) {
  const errorMsg = error?.message || String(error);
  console.error('❌ [DashboardPage] Failed to load stats:', errorMsg);
  toast({
    title: 'Error Loading Dashboard',
    description: `Failed to fetch leads: ${errorMsg}`,
    variant: 'destructive',
  });
}
```

#### Issue C: API Key Not Set or Not Passed

**Problem:**

- If `VITE_WP_API_KEY` is not set, API calls fail
- No validation to check if API key is available

**Solution:**
✅ Added validation in `wpLeadsApi.ts`:

```typescript
if (!API_KEY) {
  console.error("❌ [wpLeadsApi] API_KEY (VITE_WP_API_KEY) is not configured.");
  throw new Error("API_KEY is not configured. Check environment variables.");
}
```

---

### 2. **Widget Content Data Not Fetching**

#### ChatWidget Issues

**Problems:**

- Missing error context in `loadRooms()`, `loadUsers()`, and `loadMessages()`
- Silent failures made debugging difficult
- No user feedback on fetch failures

**Solutions:**
✅ Added detailed logging to ChatWidget.tsx:

```typescript
const loadRooms = async () => {
  try {
    console.log("📝 [ChatWidget] Loading rooms...");
    const data = await chatApi.getRooms();
    // ... processing
    console.log("✅ [ChatWidget] Rooms loaded:", mappedRooms.length);
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error("❌ [ChatWidget] Failed to load rooms:", errorMsg);
  }
};
```

---

## Files Modified

1. **src/db/wpLeadsApi.ts**
   - Added validation for `API_BASE` and `API_KEY`
   - Enhanced error handling with detailed logging
   - Proper error propagation to calling code

2. **src/pages/DashboardPage.tsx**
   - Added detailed error logging for stats loading
   - Added toast notifications for user feedback
   - Improved error context in follow-ups loading

3. **src/components/common/ChatWidget.tsx**
   - Enhanced logging for all data fetching operations
   - Better error context for debugging

---

## How to Debug API Issues

### Step 1: Check Browser Console

Open DevTools (F12) → Console tab and look for:

- 🔍 `[wpLeadsApi] Fetching from: ...` - Shows the actual URL being called
- ❌ `[wpLeadsApi] API Error` - Shows HTTP status and response
- ✅ `[wpLeadsApi] Fetched X leads` - Confirms success

### Step 2: Verify Environment Variables

Check `.env` file:

```bash
# Should be configured like this:
VITE_API_BASE=/crm/v1  # Or full URL to WordPress site
VITE_WP_API_KEY=SECRET123  # Match WordPress plugin setting CRM_API_KEY
```

### Step 3: Check Site Cache

The `siteCache` should be populated when `SiteContext` loads sites from the database.
If you see "API_BASE is empty" error, it means:

- Sites haven't been loaded from DB yet (page just loaded)
- Site configuration is missing
- No site is selected

### Step 4: Verify WordPress Plugin

Ensure the WordPress plugin `wp-activity-logs.php` is:

- Activated in WordPress
- Has the correct API key configured
- CORS headers are properly set

---

## Expected Behavior After Fix

### On Dashboard Page Load (Refreshed)

✅ You should see in Console:

```
🔍 [wpLeadsApi] Fetching from: https://yoursite.com/wp-json/crm/v1
✅ [wpLeadsApi] Fetched 15 leads from https://yoursite.com/wp-json/crm/v1
📊 [DashboardPage] Loading stats...
✅ [DashboardPage] Stats loaded successfully: {total: 15, pending: 5, ...}
```

### On Widget Load

✅ You should see in Console:

```
👥 [ChatWidget] Loading users...
✅ [ChatWidget] Users loaded: 8
📝 [ChatWidget] Loading rooms...
✅ [ChatWidget] Rooms loaded: 3
```

### If There's an Error

❌ You should see clear error messages:

```
❌ [wpLeadsApi] API_BASE is empty. Site not configured or env variable not set.
```

---

## Common Issues & Solutions

### Issue: "API_BASE is empty"

**Solutions:**

1. Ensure at least one WordPress site is configured in Sites settings
2. Check that the site URL is correctly saved
3. Restart the dev server: `npm run dev`
4. Check SiteContext loads sites successfully

### Issue: "Failed to fetch leads: HTTP 401"

**Solutions:**

1. Wrong API key - Check `VITE_WP_API_KEY` matches WordPress constant `CRM_API_KEY`
2. API key not being sent - Check query parameter `api_key=...` in console URL
3. WordPress plugin not activated

### Issue: "Failed to fetch leads: HTTP 404"

**Solutions:**

1. WordPress site URL is incorrect
2. WordPress plugin endpoints not registered
3. `/wp-json/crm/v1/leads` endpoint not found

### Issue: ChatWidget shows no data

**Solutions:**

1. Check `profilesApi.getAll()` - should fallback to mock data if WordPress unavailable
2. Check `chatApi.getRooms()` - uses localStorage as the primary data source
3. Check browser localStorage for `crm_chat_rooms` and `crm_profiles_cache`

---

## Testing the Fix

### 1. Test Dashboard Stats Loading

```typescript
// In browser console:
import { wpLeadsApi } from "./src/db/wpLeadsApi";
await wpLeadsApi.getAll();
// Should log detailed information about the fetch
```

### 2. Test Error Handling

```typescript
// Temporarily set empty API_KEY
sessionStorage.setItem("debug_empty_key", "true");
// Refresh page - should show "API_KEY is not configured" error
```

### 3. Verify Your Configuration

Before loading test data, ensure:

- [ ] At least one WordPress site is added in Sites settings
- [ ] Site URL contains your WordPress domain
- [ ] API key matches WordPress plugin setting
