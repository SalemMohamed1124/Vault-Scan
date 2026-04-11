// UseTableRefRegistry.ts
"use client";

type TableRegistry<T> = {
  [id: string]: T[];
};

// Singleton registry shared across all components
const tablesRef: TableRegistry<unknown> = {};

export function UseTableRefRegistry<T>() {
  const registerTable = (id: string, data: T[]) => {
    tablesRef[id] = data;
  };

  const getTable = (id: string): T[] | undefined => {
    return tablesRef[id] as T[] | undefined;
  };

  return { registerTable, getTable };
}
