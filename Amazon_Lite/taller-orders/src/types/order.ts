export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "confirmed" | "canceled" | "completed";
  createdAt: string;
  updatedAt: string;
}
