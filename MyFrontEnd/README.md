# Vulnerability Scanner

A simple and fast tool to track security issues and assets.

## Tech Stack

- React 19 & TypeScript
- Tailwind CSS 4
- TanStack Table & Query
- Shadcn UI
- Lucide Icons
- Date-fns
- React-hook-form
- Zod

## Folder Structure

- **src/Features**: Main logic for each part (IPs, Domains, etc.)
- **src/Pages**: Full page views.
- **src/components**: Shared UI and Data Tables.
- **src/Types**: Data models (found in `data-types.ts`).
- **src/Contexts**: Global state for modals and themes.

## How We Build Pages

1. **Define Data**: Add the data type in `src/Types/data-types.ts`.
2. **Define Columns**: Create a columns file in the feature folder to map the data.
3. **Show Table**: Pass columns to the `DataTable` (Desktop) or `DataTableMobile` (Mobile).

## Key UI Components

- **Summary**: Top cards showing total counts and severities.
- **MobileCard**: Simple card layout for mobile users.
- **DetailCard**: Shows specific details in rows and sections.

## Contexts

- **Confirm Modal**: Global popups for confirming actions.
- **Sort & Filter**: Logic for sorting and filtering data on mobile.
- **View Modal**: Displays asset details in a popup.
- **Theme**: Switches between light and dark modes.

## Feature Status

### Done

- IP Addresses
- Domains
- Ports
- Open Vulnerabilities
- Fixed Vulnerabilities
- Assets Management

### Coming Soon

- Scan Management
- User Settings
- Login System
- Advanced Charts
- Landing Page
