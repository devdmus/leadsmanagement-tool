# Social Media Integration Guide

This guide will help you connect Facebook Lead Ads and LinkedIn Gen Forms to your Leads Management System.

---

## 📘 Facebook Lead Ads Integration

To fetch leads from Facebook, you need a **Page ID** and an **Access Token**.

### Step 1: Create a Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/).
2. Click **My Apps** > **Create App**.
3. Select **Other** > **Next** > **Business** > **Next**.
4. Enter an App Name (e.g., "Leads Sync") and click **Create App**.

### Step 2: Add Marketing API
1. On the App Dashboard, scroll down to **Marketing API** and click **Set Up**.

### Step 3: Generate Access Token
1. In the left sidebar, go to **Tools** > **Graph API Explorer**.
2. Select your App in the "Facebook App" dropdown.
3. In "User or Page", select **Get Page Access Token**.
4. A permission window will pop up. Ensure you approve:
   - `leads_retrieval`
   - `pages_read_engagement`
   - `pages_manage_ads`
5. Click **Generate Access Token**.
6. **Copy the Access Token**. This is what you'll paste into the app.

### Step 4: Get Page ID
1. Go to your Facebook Page.
2. The **Page ID** is often in the URL: `facebook.com/PageName-123456789/`.
3. Or go to **About** > **Page Transparency** to see the ID.

### ⚠️ Important: Allow Your Domain
Since this app runs in your browser, Facebook will block it unless allowed.
1. Go to **App Settings** > **Basic**.
2. Click **Add Platform** > **Website**.
3. Enter your URL: `http://localhost:5173` (or your real domain).
4. Save Changes.

---

## 💼 LinkedIn Gen Forms Integration

To fetch leads from LinkedIn, you need an **Ad Account ID** and an **Access Token**.

### Step 1: Create a LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps).
2. Click **Create App**.
3. Link your Company Page and fill in the details.

### Step 2: Request Marketing Access
1. Go to the **Products** tab.
2. Request access for **Marketing Developer Platform**.

### Step 3: Get Ad Account ID
1. Go to [Campaign Manager](https://www.linkedin.com/campaignmanager/accounts).
2. Click your account.
3. Look at the URL: `https://www.linkedin.com/campaignmanager/accounts/508123456/...`
4. The number (e.g., `508123456`) is your **Ad Account ID**.

### Step 4: Generate Access Token
1. In the Developer Portal, go to the **Auth** tab.
2. Under "OAuth 2.0 tools", click **Token Generator**.
3. Select the scopes: `r_ads_leadgen_automation` and `r_basicprofile`.
4. Click **Request Access Token**.
5. **Copy the Token**.

---

## 🧪 Testing Mode

If you don't have accounts yet, you can test the feature using Mock Mode.

1. Open the **Import** dialog in the app.
2. In the **Access Token** field (for either Facebook or LinkedIn), type: `test`
3. Click **Connect & Sync**.
4. The system will generate dummy leads for you to see how it works.
