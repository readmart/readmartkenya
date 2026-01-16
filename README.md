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

## 📄 License

MIT
