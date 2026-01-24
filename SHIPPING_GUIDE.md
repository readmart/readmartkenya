# ReadMart Logistics & Shipping Management Guide

This document outlines the configuration standards and maintenance processes for the shipping and logistics system.

## 1. City/Area Management

The "City/Area Management" module in the Founder Dashboard allows you to manage delivery zones, towns, and pricing strategies.

### 1.1 Adding/Editing Areas
- **Town/Area Name**: The specific name of the delivery node (e.g., "Nairobi Central").
- **County**: The higher-level administrative unit for grouping and filtering.
- **Postal Codes**: Comma-separated list of postal codes for auto-matching during checkout.
- **Base Delivery Fee**: The starting price for shipping to this area.
- **Weight Surcharge**: Additional cost per KG of product weight.
- **Volume Surcharge**: Additional cost per cubic meter (m³) of product volume.
- **Validity Dates**: Set "Valid From" and "Valid Until" to schedule price changes.

### 1.2 Batch Operations
- **Export**: Download the current area database as a CSV file.
- **Import**: Upload a CSV file to bulk-create or update areas. The CSV should follow the header format: `Name, Price, Weight Surcharge, Volume Surcharge, County, Postal Codes, Method`.

## 2. Product Physical Attributes

To ensure accurate shipping calculation, physical products must have their weight and volume defined in the Inventory management section.

- **Weight (KG)**: Standard weight of the item.
- **Volume (m³)**: Space occupied by the item.

## 3. Shipping Calculation Logic

The system automatically calculates the shipping fee during checkout using the following formula:

`Total Shipping = Base Fee + (Total Weight * Weight Surcharge) + (Total Volume * Volume Surcharge)`

### 3.1 Auto-Matching
The system attempts to match the customer's delivery address to a shipping zone based on:
1.  **City/Town Name**: Case-insensitive partial match.
2.  **Postal Code**: Exact match against the area's defined postal codes.

## 4. Maintenance & Audit

- **Operation Logs**: All changes to shipping zones and prices are recorded in the audit logs.
- **Security**: Only authorized administrators with `founder` or `admin` roles can modify logistics settings.
- **Validation**: The system prevents negative prices and invalid date ranges to ensure business logic integrity.
