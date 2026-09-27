# AniWatch ad setup on GitHub Pages

AniWatch renders ad placements entirely in the GitHub Pages frontend.

## Configure the site

Create your publisher website and ad zones in your ad-network dashboard. Then open this GitHub repository:

**Settings → Secrets and variables → Actions → Variables**

Add the public zone keys:

```
ADSTERRA_HEADER_KEY
ADSTERRA_RECTANGLE_KEY
ADSTERRA_SIDEBAR_KEY
```

Push to `main` or manually run the **Deploy GitHub Pages** workflow. The workflow injects those values into the static deployment; no source edit is needed.

If a key is blank, its slot stays hidden.

## Premium behavior

When Supabase is configured, AniWatch reads the signed-in user's verified `profiles.is_premium` value. Premium accounts do not render the configured ad placements.

Do not click your own ads, manufacture traffic, or attempt to bypass the ad network's policies. Payout methods, thresholds, eligibility, and current ad formats are controlled by the publisher network and should be checked in its dashboard.
