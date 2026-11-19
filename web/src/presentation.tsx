import React from "react";
import { Copy, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "./omc-next/components/ui/button";
import { Input, PasswordInput } from "./omc-next/components/ui/input";
import { Textarea } from "./omc-next/components/ui/textarea";
import { Checkbox } from "./omc-next/components/ui/checkbox";
import { Select, type SelectProps } from "./omc-next/components/ui/select";
import {
  Combobox,
  type ComboboxProps,
} from "./omc-next/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "./omc-next/components/ui/sheet";
import {
  TableRoot as Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type ColumnDef,
} from "./omc-next/components/ui/table";
import { Pager } from "./omc-next/components/common/Pager";
import { omcToastManager, Toaster } from "./omc-next/components/ui/toast";
export { Button, Input, PasswordInput, Textarea, Checkbox, Toaster };
export { NumberInput } from "./omc-next/components/ui/number-input";
export { Segmented } from "./omc-next/components/ui/segmented";
export { Tabs } from "./omc-next/components/ui/tabs";
export { Tooltip } from "./omc-next/components/common/Tooltip";
export { Panel } from "./omc-next/components/common/Panel";
export { AppModal } from "./omc-next/components/common/AppModal";

export const toast = {
  success: (headline: string) => {
    omcToastManager.add({ type: "success", data: { headline }, timeout: 4000 });
  },
  info: (headline: string) => {
    omcToastManager.add({ type: "info", data: { headline }, timeout: 4000 });
  },
  error: (headline: string) => {
    omcToastManager.add({ type: "error", data: { headline }, timeout: 8000 });
  },
};

export function Stack({
  children,
  orientation,
  direction,
  wrap,
  size = 8,
  align,
  style,
  className,
}: React.PropsWithChildren<{
  orientation?: "vertical" | "horizontal";
  direction?: "vertical" | "horizontal";
  wrap?: boolean;
  size?: number | string | number[];
  align?: string;
  style?: React.CSSProperties;
  className?: string;
}>) {
  const vertical = (orientation || direction) === "vertical";
  const gap = Array.isArray(size)
    ? size.map((x) => x + "px").join(" ")
    : typeof size === "number"
      ? size
      : ({ small: 8, middle: 16, large: 24 }[size] ?? 8);
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: vertical
          ? "stretch"
          : align === "start"
            ? "flex-start"
            : align === "end"
              ? "flex-end"
              : "center",
        flexWrap: wrap ? "wrap" : undefined,
        gap,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
export function SearchInput(props: React.ComponentProps<typeof Input>) {
  return <Input type="search" {...props} />;
}
export function FormLayout({
  children,
  layout = "vertical",
  onFinish,
  style,
  className,
}: React.PropsWithChildren<{
  layout?: string;
  onFinish?: (values: Record<string, string>) => void;
  style?: React.CSSProperties;
  className?: string;
}>) {
  return (
    <form
      className={className}
      style={{
        display: layout === "inline" ? "flex" : "grid",
        gap: 16,
        flexWrap: "wrap",
        alignItems: layout === "inline" ? "end" : undefined,
        ...style,
      }}
      onSubmit={(e) => {
        e.preventDefault();
        onFinish?.(
          Object.fromEntries(
            [...new FormData(e.currentTarget)].map(([key, value]) => [
              key,
              String(value),
            ]),
          ),
        );
      }}
    >
      {children}
    </form>
  );
}
export function FormField({
  label,
  htmlFor,
  children,
  className,
  style,
}: React.PropsWithChildren<{
  label?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  style?: React.CSSProperties;
}>) {
  const generated = React.useId();
  const id = htmlFor || generated;
  return (
    <div
      className={`form-field ${className || ""}`}
      style={{ display: "grid", gap: 6, minWidth: 0, ...style }}
    >
      {label && (
        <label className="text-md text-fg-2" htmlFor={id}>
          {label}
        </label>
      )}
      {React.isValidElement<{ id?: string }>(children) && !children.props.id
        ? React.cloneElement(children, { id })
        : children}
    </div>
  );
}
export function Text({
  children,
  type,
  strong,
  style,
  ellipsis,
  ...props
}: React.PropsWithChildren<{
  type?: string;
  strong?: boolean;
  style?: React.CSSProperties;
  className?: string;
  ellipsis?: boolean;
}>) {
  return (
    <span
      {...props}
      style={{
        color:
          type === "secondary"
            ? "var(--muted)"
            : type === "danger"
              ? "var(--danger)"
              : undefined,
        fontWeight: strong ? 600 : undefined,
        overflow: ellipsis ? "hidden" : undefined,
        textOverflow: ellipsis ? "ellipsis" : undefined,
        whiteSpace: ellipsis ? "nowrap" : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
export function PromptText({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);
  const reset = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  React.useEffect(() => () => clearTimeout(reset.current), []);
  return (
    <div className="prompt-text">
      <pre>{children}</pre>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={copied ? "已复制 / Copied" : "复制 / Copy"}
        icon={copied ? <Check size={13} /> : <Copy size={13} />}
        onClick={() =>
          void navigator.clipboard
            .writeText(children)
            .then(() => {
              setCopied(true);
              clearTimeout(reset.current);
              reset.current = setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => toast.error("复制失败 / Copy failed"))
        }
      />
    </div>
  );
}
export function Heading({
  level = 2,
  children,
  ...props
}: React.PropsWithChildren<{
  level?: number;
  style?: React.CSSProperties;
  className?: string;
}>) {
  const Tag = ["h1", "h2", "h3", "h4", "h5", "h6"][
    Math.min(6, Math.max(1, level)) - 1
  ] as "h2";
  return (
    <Tag className="m-0 text-xl font-semibold" {...props}>
      {children}
    </Tag>
  );
}
export function Notice({
  title,
  type = "info",
  showIcon: _showIcon,
  closable,
  onClose,
}: {
  title?: React.ReactNode;
  type?: "error" | "warning" | "info" | "success";
  showIcon?: boolean;
  closable?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      role={type === "error" ? "alert" : undefined}
      className="rounded-md bg-surface px-3 py-2 text-md"
      style={{
        borderInlineStart:
          "2px solid " +
          {
            error: "var(--danger)",
            warning: "var(--warn)",
            success: "var(--success)",
            info: "var(--accent)",
          }[type],
      }}
    >
      {title}
      {closable && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="关闭 / Close"
          onClick={onClose}
        >
          ×
        </Button>
      )}
    </div>
  );
}
export function EmptyState({ description }: { description?: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-md text-muted-foreground">
      {description ?? "—"}
    </div>
  );
}
export function Spinner({ size }: { size?: string }) {
  return (
    <Loader2
      aria-label="加载中 / Loading"
      role="status"
      className="size-5 animate-spin text-muted-foreground"
    />
  );
}
export function ProgressMeter({
  percent = 0,
  showInfo = true,
  status,
  format,
}: {
  percent?: number;
  showInfo?: boolean;
  size?: string;
  status?: string;
  strokeColor?: string;
  format?: () => React.ReactNode;
}) {
  const value = Math.max(
    0,
    Math.min(100, Number.isFinite(percent) ? percent : 0),
  );
  return (
    <div className="flex items-center gap-2">
      <progress
        className="h-1.5 w-full"
        value={value}
        max={100}
        style={{
          accentColor:
            status === "exception" ? "var(--danger)" : "var(--accent)",
        }}
        aria-label="进度 / Progress"
      />
      {showInfo && (
        <span className="text-xs text-muted-foreground">
          {format ? format() : `${Math.round(value)}%`}
        </span>
      )}
    </div>
  );
}
export function Badge({
  children,
  color,
  className,
  style,
}: React.PropsWithChildren<{
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}>) {
  return (
    <span
      className={`inline-flex rounded-sm bg-surface px-1.5 py-0.5 text-xs text-fg-2 ${className || ""}`}
      style={{
        ...style,
        color:
          color === "red"
            ? "var(--danger)"
            : color === "green"
              ? "var(--success)"
              : undefined,
      }}
    >
      {children}
    </span>
  );
}
export function DetailList({
  items,
}: {
  items: Array<{
    key?: React.Key;
    label: React.ReactNode;
    children?: React.ReactNode;
  }>;
  column?: number | Record<string, number>;
  size?: string;
  bordered?: boolean;
}) {
  return (
    <dl className="m-0 grid gap-2">
      {items.map((item, i) => (
        <div
          key={item.key ?? i}
          className="grid grid-cols-[minmax(100px,1fr)_2fr] gap-3 border-b border-border-soft py-2 text-md"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="m-0 break-words">{item.children}</dd>
        </div>
      ))}
    </dl>
  );
}
export { Collapse as DisclosureList } from "./omc-next/components/ui/accordion";
export function ChoiceSelect<V = string>(
  props: Omit<ComboboxProps<V>, "options" | "value" | "onChange"> & {
    value?: V | null;
    onChange?: (value: V) => void;
    options?: Array<{
      value: any;
      label: React.ReactNode;
      disabled?: boolean;
      [key: string]: unknown;
    }>;
    filterOption?: unknown;
    optionFilterProp?: string;
  },
) {
  const {
    showSearch,
    mode,
    filterOption: _filterOption,
    optionFilterProp: _optionFilterProp,
    ...rest
  } = props;
  return showSearch || mode ? (
    <Combobox
      {...(rest as ComboboxProps<V>)}
      mode={mode}
      showSearch={showSearch}
    />
  ) : (
    <Select {...(rest as SelectProps<any>)} />
  );
}
export function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
  footerStart,
  width = "medium",
  className,
}: React.PropsWithChildren<{
  open?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  footerStart?: React.ReactNode;
  width?: "small" | "medium" | "large" | "wide";
  className?: string;
}>) {
  return (
    <Sheet
      open={!!open}
      onOpenChange={(next) => {
        if (!next) onClose?.();
      }}
    >
      <SheetContent
        side="right"
        className={className}
        style={{
          width: `min(100vw, ${{ small: 400, medium: 560, large: 760, wide: 1120 }[width]}px)`,
        }}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {(footer || footerStart) && (
          <SheetFooter>
            <div className="mr-auto">{footerStart}</div>
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

export interface RecordTableProps<T extends object> {
  rowKey: Extract<keyof T, string> | ((record: T, index: number) => React.Key);
  columns: readonly ColumnDef<T>[];
  dataSource?: readonly T[];
  loading?: boolean;
  size?: "small" | "middle" | "large";
  pagination?:
    | false
    | {
        current?: number;
        defaultPageSize?: number;
        pageSize?: number;
        onChange?: (page: number) => void;
        showSizeChanger?: boolean;
        hideOnSinglePage?: boolean;
      };
  scroll?: { x?: number | string | true };
  locale?: { emptyText?: React.ReactNode };
  className?: string;
  rowSelection?: {
    selectedRowKeys?: React.Key[];
    preserveSelectedRowKeys?: boolean;
    columnWidth?: number;
    onChange?: (keys: React.Key[], rows: T[]) => void;
    getCheckboxProps?: (record: T) => {
      disabled?: boolean;
      "aria-label"?: string;
    };
  };
  expandable?: {
    childrenColumnName?: string;
    expandedRowKeys?: readonly React.Key[];
    onExpandedRowsChange?: (keys: readonly React.Key[]) => void;
    expandedRowRender: (record: T) => React.ReactNode;
    rowExpandable?: (record: T) => boolean;
  };
}
export function RecordTable<T extends object>({
  rowKey,
  columns,
  dataSource = [],
  loading,
  size,
  pagination = false,
  scroll,
  locale,
  className,
  rowSelection,
  expandable,
}: RecordTableProps<T>) {
  const [ownPage, setOwnPage] = React.useState(1);
  const [ownSize, setOwnSize] = React.useState(
    pagination ? (pagination.defaultPageSize ?? 20) : 20,
  );
  const [ownExpanded, setOwnExpanded] = React.useState<React.Key[]>([]);
  const pageSize = pagination
    ? (pagination.pageSize ?? ownSize)
    : dataSource.length || 1;
  const total = dataSource.length;
  const page = pagination
    ? Math.min(
        pagination.current ?? ownPage,
        Math.max(1, Math.ceil(total / pageSize)),
      )
    : 1;
  const records = pagination
    ? dataSource.slice((page - 1) * pageSize, page * pageSize)
    : dataSource;
  const keyFor = (r: T, i: number) =>
    typeof rowKey === "function" ? rowKey(r, i) : String(r[rowKey]);
  const selected = rowSelection?.selectedRowKeys ?? [];
  const expanded = expandable?.expandedRowKeys ?? ownExpanded;
  const changeSelection = (keys: React.Key[]) =>
    rowSelection?.onChange?.(
      keys,
      dataSource.filter((r, i) => keys.includes(keyFor(r, i))),
    );
  const eligible = records
    .map((r, i) => ({ r, key: keyFor(r, (page - 1) * pageSize + i) }))
    .filter(({ r }) => !rowSelection?.getCheckboxProps?.(r).disabled);
  const selectedOnPage = eligible.filter(({ key }) => selected.includes(key));
  const toggle = (key: React.Key) => {
    const keys = expanded.includes(key)
      ? expanded.filter((x) => x !== key)
      : [...expanded, key];
    setOwnExpanded([...keys]);
    expandable?.onExpandedRowsChange?.(keys);
  };
  const count = columns.length + (rowSelection ? 1 : 0) + (expandable ? 1 : 0);
  return (
    <div className={className} data-record-table aria-busy={loading}>
      <div className="max-w-full overflow-x-auto">
        <Table
          style={{
            minWidth:
              typeof scroll?.x === "number"
                ? scroll.x
                : scroll?.x === "max-content"
                  ? "max-content"
                  : undefined,
          }}
        >
          <TableHeader>
            <TableRow>
              {rowSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="选择本页 / Select page"
                    disabled={!eligible.length}
                    checked={
                      !!eligible.length &&
                      selectedOnPage.length === eligible.length
                    }
                    indeterminate={
                      selectedOnPage.length > 0 &&
                      selectedOnPage.length < eligible.length
                    }
                    onCheckedChange={(checked) => {
                      const keys = new Set(selected);
                      for (const { key } of eligible)
                        checked ? keys.add(key) : keys.delete(key);
                      changeSelection([...keys]);
                    }}
                  />
                </TableHead>
              )}
              {expandable && <TableHead className="w-8" />}
              {columns.map((c, i) => (
                <TableHead
                  key={c.key ?? i}
                  style={{
                    width: c.width,
                    textAlign: c.align,
                    whiteSpace: "nowrap",
                  }}
                >
                  {typeof c.title === "function" ? c.title({}) : c.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length ? (
              records.map((r, i) => {
                const key = keyFor(r, (page - 1) * pageSize + i);
                const canExpand =
                  expandable &&
                  (!expandable.rowExpandable || expandable.rowExpandable(r));
                return (
                  <React.Fragment key={key}>
                    <TableRow
                      data-selected={selected.includes(key) || undefined}
                    >
                      {rowSelection && (
                        <TableCell>
                          <Checkbox
                            checked={selected.includes(key)}
                            {...rowSelection.getCheckboxProps?.(r)}
                            aria-label={
                              rowSelection.getCheckboxProps?.(r)[
                                "aria-label"
                              ] ?? `选择 / Select ${String(key)}`
                            }
                            onCheckedChange={(checked) =>
                              changeSelection(
                                checked
                                  ? [...selected, key]
                                  : selected.filter((x) => x !== key),
                              )
                            }
                          />
                        </TableCell>
                      )}
                      {expandable && (
                        <TableCell>
                          {canExpand && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                expanded.includes(key) ? "折叠行" : "展开行"
                              }
                              aria-expanded={expanded.includes(key)}
                              icon={
                                <ChevronRight
                                  size={14}
                                  style={{
                                    transform: expanded.includes(key)
                                      ? "rotate(90deg)"
                                      : undefined,
                                  }}
                                />
                              }
                              onClick={() => toggle(key)}
                            />
                          )}
                        </TableCell>
                      )}
                      {columns.map((c, j) => {
                        let value: unknown = r;
                        if (c.dataIndex !== undefined) {
                          for (const field of Array.isArray(c.dataIndex)
                            ? c.dataIndex
                            : [c.dataIndex])
                            value =
                              value != null
                                ? (value as Record<string, unknown>)[
                                    String(field)
                                  ]
                                : undefined;
                        }
                        const result = c.render ? c.render(value, r, i) : value;
                        const content = result as React.ReactNode;
                        return (
                          <TableCell
                            className={c.className}
                            key={c.key ?? j}
                            style={{
                              width: c.width,
                              textAlign: c.align,
                              padding:
                                size === "small" ? "8px 12px" : undefined,
                              whiteSpace: c.ellipsis ? "nowrap" : undefined,
                            }}
                          >
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {canExpand && expanded.includes(key) && (
                      <TableRow>
                        <TableCell colSpan={count} className="bg-surface">
                          {expandable.expandedRowRender(r)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={count}>
                  {loading ? (
                    <Spinner />
                  ) : (
                    (locale?.emptyText ?? <EmptyState />)
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && (!pagination.hideOnSinglePage || total > pageSize) && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          {pagination.showSizeChanger && (
            <Select<number>
              aria-label="每页数量 / Page size"
              value={pageSize}
              options={[10, 20, 50, 100].map((value) => ({
                value,
                label: String(value),
              }))}
              onChange={(value) => {
                setOwnSize(value);
                setOwnPage(1);
                pagination.onChange?.(1);
              }}
            />
          )}
          <Pager
            page={page}
            pageSize={pageSize}
            total={total}
            onChange={(next) => {
              setOwnPage(next);
              pagination.onChange?.(next);
            }}
          />
        </div>
      )}
    </div>
  );
}
