// types/global.ts
// Tipos de dominio compartidos entre múltiples módulos.

export type ID = string;
export type Timestamp = Date;

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: string;
};