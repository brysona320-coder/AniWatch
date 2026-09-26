# Adsterra Monetization Setup Guide

## Quick Start (5 Minutes)

### Step 1: Create Adsterra Account
1. Go to **https://adsterra.com**
2. Click **"Sign Up"** in top right
3. Enter your email and create password
4. Verify your email (check inbox)
5. **Account created! ✓**

### Step 2: Add Your Website
1. Log in to your Adsterra dashboard
2. Go to **"Websites"** section
3. Click **"Add Website"**
4. Enter: `https://brysona320-coder.github.io/AniWatch/`
5. Select category: **Entertainment/Anime**
6. Click **"Add"**
7. **Website added! ✓**

### Step 3: Create Ad Zones
You need to create ad zones for different ad placements. Follow these steps for each:

#### Zone 1: Header Banner (728x90)
1. Go to **"Zones"** → Click **"Create Zone"**
2. Choose: **Display Banner**
3. Select size: **728x90 (Leaderboard)**
4. Name: `Header Banner`
5. Click **"Create"**
6. **Copy the Zone ID** (you'll need this)

#### Zone 2: Content Rectangle (336x280)
1. Click **"Create Zone"** again
2. Choose: **Display Banner**
3. Select size: **336x280 (Medium Rectangle)**
4. Name: `Content Rectangle`
5. Click **"Create"**
6. **Copy the Zone ID**

#### Zone 3: Sidebar Skyscraper (300x600)
1. Click **"Create Zone"** again
2. Choose: **Display Banner**
3. Select size: **300x600 (Half Page)**
4. Name: `Sidebar Skyscraper`
5. Click **"Create"**
6. **Copy the Zone ID**

#### Zone 4: Interstitial (Full Page) - Optional
1. Click **"Create Zone"** again
2. Choose: **Interstitial**
3. Select size: **Interstitial (Full Page)**
4. Name: `Interstitial`
5. Click **"Create"**
6. **Copy the Zone ID**

### Step 4: Get Your Publisher ID
1. Go to **Settings** or **Account** section
2. Find **"Publisher ID"** or **"Site ID"**
3. **Copy this ID** (looks like: `123456` or similar)

### Step 5: Update Your Code
Edit `src/app.js` and replace:

```javascript
// Replace this:
const ADSTERRA_PUBLISHER_ID = 'YOUR_PUBLISHER_ID_HERE';

// With your actual Publisher ID:
const ADSTERRA_PUBLISHER_ID = '123456';

// Replace these with your Zone IDs:
const ADSTERRA_ZONES = {
  headerBanner: 123456,          // Your header banner Zone ID
  contentRectangle: 234567,      // Your content Zone ID
  sidebarSkyscraper: 345678,     // Your sidebar Zone ID
  interstitial: 456789           // Your interstitial Zone ID (optional)
};
```

### Step 6: Deploy Changes
1. Push your changes to GitHub:
   ```bash
   git add src/app.js
   git commit -m "Add Adsterra ad zones configuration"
   git push origin main
   ```
2. GitHub Pages will automatically update in ~1 minute

### Step 7: Start Earning
1. Visit your website: `https://brysona320-coder.github.io/AniWatch/`
2. Refresh the page - you should see ads appearing!
3. Go to Adsterra dashboard to monitor earnings in real-time
4. **Payments go to your PayPal** (set up in Settings)

---

## Adsterra Dashboard Features

### Monitor Earnings
- **Real-time analytics** - See impressions, clicks, revenue
- **Daily reports** - Track earnings by date
- **Zone performance** - See which ad placements earn most

### Payout Settings
1. Go to **Settings** → **Payment Info**
2. Add your **PayPal email**
3. Set **minimum payout threshold** (default $10-25)
4. Once threshold is reached, **automatic transfer to PayPal**

### Payment Methods
- PayPal (fastest, ~24-48 hours)
- Bank transfer
- Wire transfer
- Bitcoin/Crypto (if enabled)

---

## Expected Earnings

### CPM Rates (per 1000 impressions)
- **US Traffic:** $5-15 CPM
- **EU Traffic:** $3-10 CPM
- **Other:** $1-5 CPM

### Example Calculations
- **1,000 daily visitors × 30 days:**
  - Low estimate: 30,000 impressions × $3 CPM = **$90/month**
  - High estimate: 30,000 impressions × $8 CPM = **$240/month**

- **10,000 daily visitors × 30 days:**
  - Low estimate: 300,000 impressions × $3 CPM = **$900/month**
  - High estimate: 300,000 impressions × $8 CPM = **$2,400/month**

---

## Troubleshooting

### Ads Not Showing?

1. **Check Publisher ID**
   - Is it configured in `src/app.js`?
   - Is it correct from your dashboard?

2. **Check Zone IDs**
   - Are they entered correctly?
   - Are they numeric values without quotes?

3. **Wait 15 minutes**
   - Adsterra needs time to sync new zones
   - After 15 minutes, refresh your page

4. **Check Browser Console**
   - Open DevTools (F12 or Right-click → Inspect)
   - Go to **Console** tab
   - Look for error messages

5. **Verify Domain**
   - Make sure website is added in Adsterra dashboard
   - Domain must match exactly

### Low Earnings?

1. **Increase Traffic** - More visitors = more impressions
2. **Better Placements** - Ads above fold (visible without scrolling) earn more
3. **Target Tier-1 Traffic** - US/UK/CA traffic has highest CPM
4. **Multiple Zones** - Use all 4 zone types for maximum revenue

### Payment Issues?

1. Go to Adsterra **Settings** → **Payment Info**
2. Verify PayPal email is correct
3. Set payout threshold (usually $10-25)
4. Once you earn enough, Adsterra sends to PayPal automatically
5. Check your PayPal account for incoming payment

---

## Important Notes

✅ **Do's:**
- Monitor ad performance in dashboard
- Use all 4 ad zones for maximum earnings
- Keep your site content quality high
- Follow Adsterra terms of service
- Let ads load before refreshing

❌ **Don'ts:**
- Don't click your own ads (will get banned)
- Don't refresh excessively to inflate impressions
- Don't use proxy/VPN to fake traffic
- Don't violate Adsterra policies
- Don't share zone codes publicly

---

## Support

- **Adsterra Help:** https://adsterra.com/support
- **FAQ:** https://adsterra.com/faq
- **Email Support:** support@adsterra.com
- **Live Chat:** Available in dashboard

---

## Summary

| Step | Time | Status |
|------|------|--------|
| 1. Sign up | 2 min | ✓ |
| 2. Add website | 1 min | ✓ |
| 3. Create zones | 3 min | ✓ |
| 4. Get IDs | 1 min | ✓ |
| 5. Update code | 2 min | ⏳ Next |
| 6. Deploy | 1 min | ⏳ After code |
| 7. Start earning | ✓ | ⏳ After deploy |

**Total time to first earnings: ~15 minutes**

---

**You're now set up to earn money! 🎉💰**

Adsterra will start paying you once you reach the minimum payout threshold. Payments go directly to your PayPal account automatically.
