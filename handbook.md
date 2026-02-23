# CardGuard User Handbook

## What is CardGuard?

CardGuard helps you store and manage important cards and documents (IDs, passports, licenses, credit/debit cards, etc.) while tracking expiry dates, reminders, and renewal steps.

## Getting Started

### Sign in

1. Open CardGuard in your browser.
2. Click **Continue with Google**.

### (Optional) Enable App Lock (PIN)

1. Open **Settings**.
2. Enable **App Lock**.
3. Set a **6-digit PIN**.

Notes can be encrypted when App Lock is enabled.

## Add Your First Card

1. Click **Add card**.
2. Fill in:
   - **Type** (card type)
   - **Expiry date**
   - **Profile / Dependent** (optional)
   - **Card title**
   - **Issuer** (optional)
   - **Renew link** (optional)
   - **Renewal provider** (optional)
3. Upload files (optional):
   - Front image
   - Back image
   - PDF documents
4. (Optional) Click **Scan image** to auto-detect expiry/details.
5. Click **Save**.

## View / Download Card Files

1. Open a card.
2. Use the file tabs (Front / Back / File 3...).
3. Use:
   - **Download file** to download the selected attachment
   - **Download card** to export the card preview

## Set Multiple Reminders (30/14/7/1 days)

1. Open a card.
2. Click **Edit**.
3. Under **Reminders**, select one or more:
   - 30 days before
   - 14 days before
   - 7 days before
   - 1 day before
4. Click **Save**.

## Calendar Integration (Google / Apple / .ics)

1. Open a card.
2. Click **Add to Calendar**.
3. Choose one:
   - **Google Calendar**
   - **Apple Calendar**
   - **Download .ics**

This creates a calendar event for the renewal/expiry.

## Renewal Steps (Checklist)

Use Renewal Steps to save a checklist of what you need for renewal.

### Add steps

1. Add/Edit a card.
2. Under **Renewal Steps**, click **Add Step**.
3. Enter:
   - Step title
   - Description (optional)
   - Required (toggle)
4. Click **Add**.
5. Reorder using ↑ / ↓.
6. Remove with ×.

### View steps

1. Open the card.
2. Scroll to **Renewal Steps** in the card view.

## Renewal Providers + Search Instructions

Renewal Providers let you save official portals + how to search inside them.

### Create a provider

1. Open **Manage**.
2. In **Renewal providers**, enter:
   - Provider name
   - Portal URL
   - Search instructions (optional)
3. Click **Add provider**.

### Use it during renewal

1. Open a card.
2. Click **Renew**.
3. The portal opens and the saved instructions are shown.

## Profiles / Dependents

Profiles help you group cards by person (e.g., Personal, Dad, Wife).

### Add profile

1. Open **Manage**.
2. In **Profiles / Dependents**, enter a profile name.
3. Click **Add**.

### Assign card to a profile

1. Add/Edit a card.
2. Select the profile in **Profile / Dependent**.

## Manage Panel

Open **Manage** to maintain custom lists:

- **Custom card types** (create/delete)
- **Profiles / Dependents** (create/delete)
- **Renewal providers** (create/delete)

The Manage window is scrollable, so you can reach all sections.

## Tips

- Keep expiry dates accurate so reminders and calendar exports work correctly.
- Attach PDFs for receipts, forms, or renewal confirmations.
- Add renewal steps for complex renewals (e.g., passport) to avoid forgetting documents.

## Troubleshooting

### I can’t scroll in Manage

- Try scrolling inside the popup (mouse wheel/trackpad).
- If using mobile, drag inside the popup content.

### PDF preview not showing

Some browsers don’t support inline PDF preview.

- Use **Open PDF** or **Download file**.

### “Supabase not configured”

This means cloud environment variables are missing.

- Check your deployment environment variables.
- Redeploy the app.
