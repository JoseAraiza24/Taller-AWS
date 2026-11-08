export interface User {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: "buyer" | "seller";
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<User, "password">;
