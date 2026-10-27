"use client";

import {
  type CellData,
  type ColumnDef,
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  type RowData,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Features shared by every data table in the app (TanStack Table v9). */
export const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
  },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});

export type AppColumnDef<T extends RowData> = ColumnDef<
  typeof tableFeatureSet,
  T,
  CellData
>;

/** Typed column helper bound to the app's feature set. */
export function columnHelper<T extends RowData>() {
  return createColumnHelper<typeof tableFeatureSet, T>();
}

/** Sortable, searchable table built on TanStack Table and shadcn/ui. */
export function DataTable<T extends RowData>({
  columns,
  data,
  searchPlaceholder,
  toolbar,
  empty = "Nothing here yet.",
  initialSorting = [],
  rowClassName,
}: {
  /** Must be stable (module scope or memoised). */
  columns: AppColumnDef<T>[];
  data: T[];
  /** Shows a global search box when set. */
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  empty?: ReactNode;
  initialSorting?: SortingState;
  rowClassName?: (row: T) => string | undefined;
}) {
  const table = useTable({
    features: tableFeatureSet,
    columns,
    data,
    initialState: { sorting: initialSorting },
    globalFilterFn: "includesString",
  });
  const globalFilter = (table.state.globalFilter as string | undefined) ?? "";

  return (
    <div className="flex flex-col gap-3">
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchPlaceholder && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalFilter}
                onChange={(e) => table.setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const content = header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  );
                  return (
                    <TableHead key={header.id}>
                      {sortable && !header.isPlaceholder ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {content}
                          {sorted === "asc" ? (
                            <ArrowUp />
                          ) : sorted === "desc" ? (
                            <ArrowDown />
                          ) : (
                            <ArrowUpDown className="opacity-40" />
                          )}
                        </Button>
                      ) : (
                        content
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(rowClassName?.(row.original))}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
