# Shopify Order Analytics Dashboard

A simple, fast, and responsive **Shopify Order Analytics Dashboard** built with **Next.js (App Router) + TypeScript + Tailwind CSS** designed specifically to answer:

> **"For this Shopify product, how many orders and units came from each Indian state during this date range?"**

---

## Features

- **Product-wise State Breakdown**: Filter by individual product or view store-wide metrics across all products.
- **Indian State Aggregation**: Analyzes shipping addresses (`province` / `provinceCode` where `countryCodeV2 === 'IN'`) with canonical Indian state name normalization.
- **Metrics at a Glance**:
  - **Orders**: Count of unique Shopify orders containing the product.
  - **Units**: Sum of line-item quantities sold.
  - **Revenue**: Product-specific line item revenue formatted in Indian Rupees (₹).
  - **Top State**: Automatically identifies the leading delivery state.
- **Date Range Filters**: Custom date picker with one-click presets (*Today*, *Last 7 Days*, *Last 30 Days*, *This Month*).
- **Interactive State Search & Sorting**: Real-time state filter and sorting by State name, Orders, Units, or Revenue.
- **Cursor-Based GraphQL Pagination**: Efficiently fetches Shopify orders across multiple pages on the server side.
- **Zero Client Credential Exposure**: All Shopify Admin API calls and tokens stay strictly on the server.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Source**: Shopify Admin GraphQL API

---

## Getting Started

### 1. Clone & Install Dependencies

```bash
cd Shopify-orderDashboard
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.local.example .env.local
```

Populate the variables:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-07
```

---

## Shopify Setup Guide (Obtaining API Credentials)

Follow these steps in your Shopify Admin to generate an Admin API Access Token:

1. **Log in to Shopify Admin**: Go to `https://admin.shopify.com/store/your-store-name`.
2. **Navigate to App Development**:
   - Go to **Settings** (bottom left) → **Apps and sales channels**.
   - Click on **Develop apps** (top right).
   - If prompted, click **Allow custom app development**.
3. **Create Custom App**:
   - Click **Create an app**.
   - Name it `Order Analytics Dashboard` and choose your app developer account.
4. **Configure Admin API Scopes**:
   - In the **Configuration** tab, click **Configure** next to *Admin API integration*.
   - Under **Orders**, select:
     - `read_orders`
   - Under **Products**, select:
     - `read_products`
   - Click **Save**.
5. **Install App & Copy Token**:
   - Go to the **API credentials** tab.
   - Click **Install app** and confirm installation.
   - Under **Admin API access token**, click **Reveal token once** and copy the token (starts with `shpat_...`).
6. **Paste into `.env.local`**:
   - Set `SHOPIFY_STORE_DOMAIN` to your `.myshopify.com` domain.
   - Set `SHOPIFY_ACCESS_TOKEN` to your copied token.

---

## Campaign Attribution (Campaign ID → State)

The **Campaign-wise Breakdown** table groups orders by ad campaign ID. Expanding a campaign row shows which states that campaign's orders came from.

### Where the campaign ID comes from

The dashboard reads campaign attribution from two sources, in priority order:

1. **Order custom attributes** (primary). COD form apps such as **EasySell COD Form** create orders through the API and copy the landing page's UTM parameters onto the order as attributes. The keys used are `utm_campaign` (falling back to `utm_id`, then `campaign_id`), plus `utm_source`, `utm_medium` and `utm_content`. With Meta ads these hold numeric IDs:

   | Attribute | Meaning |
   | --- | --- |
   | `utm_campaign` / `utm_id` | Campaign ID (e.g. `120253491168280721`) |
   | `utm_content` | Ad ID |
   | `utm_term` | Ad set ID |
   | `utm_source` | `fb` / `ig` |
   | `utm_medium` | `paid` |

2. **`customerJourneySummary`** (fallback), used for orders placed through the normal web checkout, where Shopify itself records the visit and its UTM parameters.

Orders with no attribution from either source are grouped under **"Direct / No Campaign"**.

> **Note:** orders created by a COD form app never have `customerJourneySummary` data — Shopify records no storefront visit for an API-created order, so `momentsCount` is `0` and `firstVisit`/`lastVisit` are `null`. This is expected and is why the custom attributes are the primary source.

For campaign data to populate, your ad links must carry UTM parameters. In Meta Ads Manager, use dynamic URL parameters on the ad's website URL:

```
utm_source=fb&utm_medium=paid&utm_id={{campaign.id}}&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}
```

---

## Development & Production Commands

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Production Build

```bash
npm run build
npm run start
```

---

## Project Structure

```text
Shopify-orderDashboard/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   │   └── route.ts          # Server route handler for fetching & aggregating orders
│   │   └── products/
│   │       └── route.ts          # Server route handler for fetching product catalog
│   ├── globals.css               # Clean Tailwind design tokens
│   ├── layout.tsx                # App layout & SEO metadata
│   └── page.tsx                  # Dashboard page
├── components/
│   └── dashboard/
│       ├── Dashboard.tsx         # Main dashboard orchestrator
│       ├── Header.tsx            # Header with live connection status
│       ├── StatsCards.tsx        # 4 summary metrics cards
│       ├── ProductSelector.tsx   # Product dropdown selector
│       ├── DateRangeFilter.tsx   # Date pickers & quick presets
│       ├── StateOrdersTable.tsx  # Sortable & searchable state table
│       └── SkeletonLoaders.tsx   # Skeletons for card & table loading states
├── lib/
│   ├── shopify.ts                # Server-only GraphQL client
│   ├── shopify-queries.ts        # Typed GraphQL queries
│   ├── order-analytics.ts        # Business logic: state normalization & metrics calculation
│   └── formatters.ts             # Indian currency (₹) & date formatting utilities
├── types/
│   └── shopify.ts                # TypeScript types & interfaces
├── .env.local.example            # Environment variables template
├── package.json
└── README.md
```

---

## License

MIT License.
