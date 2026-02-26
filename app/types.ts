export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  buyPrice?: number;
  sellPrice?: number;
  unit?: string;
  quantity: number;
  status?: string;
  createdAt: Date;
  userId: string;
  categoryId: string;
  supplierId: string;
  category?: string;
  supplier?: string;
}

// Define the Supplier interface
export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  userId: string;
}

// Define the Category interface
export interface Category {
  id: string;
  name: string;
  userId: string;
}
