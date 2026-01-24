# READMART

A production-ready React + TypeScript application built with Vite, Tailwind CSS v4, and shadcn/ui.

## 🚀 Features

- **Framework**: React 19 + Vite 7
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Database & Auth**: Supabase
- **Routing**: React Router 7
- **Validation**: Zod
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Security**: jose, bcryptjs
- **Deployment**: Vercel ready with custom routing

## 🛠️ Project Setup

### Prerequisites

- Node.js (Latest LTS)
- npm

### Installation

```bash
npm install
```

### Development

Start the development server on [http://localhost:3004/](http://localhost:3004/):

```bash
npm run dev
```

### Build

Build the project for production:

```bash
npm run build
```

## 📂 Project Structure

- `src/components/`: Reusable UI components (shadcn/ui)
- `src/lib/`: Utility functions and shared logic
- `src/assets/`: Static assets
- `vite.config.ts`: Production-optimized Vite configuration
- `vercel.json`: Vercel routing and security headers

## 🔧 Configuration Details

- **Port**: 3004
- **Path Alias**: `@` points to `./src`
- **API Proxy**: `/api` proxies to `http://127.0.0.1:3002`
- **Build**: Manual chunking enabled for vendor optimization

## 📦 Shipping Configuration Standard

### 1. Database Schema
The `shipping_zones` table has been enhanced with the following columns:
- `price`: Unified delivery fee (KES).
- `estimated_days`: Delivery ETA.
- `country_code`: 2-letter ISO code (e.g., 'KE').
- `region`: Geographic region or province.
- `postal_codes`: Comma-separated list of supported codes.
- `shipping_method`: Type of delivery (Standard, Express, Pickup, Global).

### 2. Maintenance Flow
1. **Adding Zones**: Use the Founder Dashboard -> Regional Management.
2. **Metadata**: Ensure `country_code` and `region` are provided for better filtering.
3. **Postal Codes**: Add specific codes to enable auto-matching in checkout.
4. **Validation**: Checkout automatically matches zones based on city or postal code input.

### 3. Standards
- Nairobi CBD: KES 150 (1 Day)
- Nairobi Environs: KES 250 (1-2 Days)
- Major Towns (Mombasa, Kisumu): KES 350 (2-3 Days)
- Upcountry: KES 450 (3-5 Days)

## 📄 License

MIT
