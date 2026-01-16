import React, { createContext, useContext, useState, type ReactNode } from 'react';

type Currency = 'KES' | 'USD' | 'EUR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatPrice: (amount: number) => string;
  exchangeRate: number; // For simplicity, relative to USD
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<Currency>('KES');

  // Mock exchange rates (USD base)
  const rates: Record<Currency, number> = {
    USD: 1,
    KES: 150,
    EUR: 0.92,
  };

  const formatPrice = (amount: number) => {
    // If input is USD, convert to selected currency
    const convertedAmount = amount * rates[currency];
    
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: currency,
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider value={{ 
      currency, 
      setCurrency, 
      formatPrice, 
      exchangeRate: rates[currency] 
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
