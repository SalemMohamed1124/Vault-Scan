// UseTableRefRegistry.ts
type TableRegistry<T> = {
  [id: string]: T[];
};

// Singleton registry shared across all components
const tablesRef: TableRegistry<unknown> = {};

export function UseTableRefRegistry<T>() {
  /**
   * Register or update table data by ID
   * @param id - must match tableName in DataTable
   * @param data - array of rows of type T
   */
  const registerTable = (id: string, data: T[]) => {
    tablesRef[id] = data;
  };

  /**
   * Get table data by ID
   * @param id - tableName
   * @returns table data array of type T or undefined
   */
  const getTable = (id: string): T[] | undefined => {
    return tablesRef[id] as T[] | undefined;
  };

  return { registerTable, getTable };
}
