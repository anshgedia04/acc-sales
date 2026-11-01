export type SalesEntry = {
  entryId: string;
  date: string;
  party: string;
  billNo: string;
  product: string;
  quantity: number | '';
  billRate: number | '';
  billAmount: number | '';
  withoutBillRate: number | '';
  withoutBillAmount: number | '';
  billPaid: number | '';
  withoutBillPaid: number | '';
  paymentType: string;
  totalPaid: number | '';
  balance: number | '';
};

export type SalesEntryInput = Omit<
  SalesEntry,
  'entryId' | 'billAmount' | 'withoutBillAmount' | 'totalPaid' | 'balance'
>;

export type SalesOptionType = 'parties' | 'products' | 'paymentTypes';
export type SalesEntryOptions = Record<SalesOptionType, string[]>;
export type SalesSummaryTotals = { quantity: number; billSale: number; withoutSale: number; totalSale: number; totalPaid: number; balance: number };

type ApiEnvelope = {
  ok: boolean;
  message?: string;
  entries?: unknown;
  entry?: unknown;
  options?: unknown;
  summary?: unknown;
};

export class SalesApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SalesApiError';
  }
}

function parseOptions(value: unknown): SalesEntryOptions {
  if (!isRecord(value)) throw new SalesApiError('Google Sheets returned invalid saved options.');
  const parseList = (item: unknown) => Array.isArray(item) ? item.map(asString).map((text) => text.trim()).filter(Boolean) : [];
  return { parties: parseList(value.parties), products: parseList(value.products), paymentTypes: parseList(value.paymentTypes) };
}

function parseSalesSummary(value: unknown): SalesSummaryTotals {
  if (!isRecord(value)) throw new SalesApiError('Google Sheets returned an invalid sales summary.');
  const numeric = (field: string) => {
    const result = Number(value[field]);
    if (!Number.isFinite(result)) throw new SalesApiError(`Google Sheets returned an invalid ${field} total.`);
    return result;
  };
  return { quantity: numeric('quantity'), billSale: numeric('billSale'), withoutSale: numeric('withoutSale'), totalSale: numeric('totalSale'), totalPaid: numeric('totalPaid'), balance: numeric('balance') };
}

function getApiUrl() {
  const url = process.env.EXPO_PUBLIC_APPS_SCRIPT_URL?.trim();

  if (!url) {
    throw new SalesApiError(
      'Google Sheets is not configured. Add EXPO_PUBLIC_APPS_SCRIPT_URL to .env and reload the app.',
    );
  }

  return url;
}

function getUrl(params: Record<string, string | undefined>) {
  const url = new URL(getApiUrl());

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNumberOrBlank(value: unknown): number | '' {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function parseEntry(value: unknown): SalesEntry {
  if (!isRecord(value)) {
    throw new SalesApiError('Google Sheets returned an invalid sales entry.');
  }

  const entryId = asString(value.entryId);

  if (!entryId) {
    throw new SalesApiError('Google Sheets returned an entry without an Entry ID.');
  }

  return {
    entryId,
    date: asString(value.date),
    party: asString(value.party),
    billNo: asString(value.billNo),
    product: asString(value.product),
    quantity: asNumberOrBlank(value.quantity),
    billRate: asNumberOrBlank(value.billRate),
    billAmount: asNumberOrBlank(value.billAmount),
    withoutBillRate: asNumberOrBlank(value.withoutBillRate),
    withoutBillAmount: asNumberOrBlank(value.withoutBillAmount),
    billPaid: asNumberOrBlank(value.billPaid),
    withoutBillPaid: asNumberOrBlank(value.withoutBillPaid),
    paymentType: asString(value.paymentType),
    totalPaid: asNumberOrBlank(value.totalPaid),
    balance: asNumberOrBlank(value.balance),
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new SalesApiError('Could not reach Google Sheets. Check your internet connection and try again.');
  }

  const text = await response.text();
  let body: ApiEnvelope;

  try {
    body = JSON.parse(text) as ApiEnvelope;
  } catch {
    throw new SalesApiError('Google Sheets returned an unreadable response.');
  }

  if (!response.ok || !body.ok) {
    throw new SalesApiError(body.message || 'Google Sheets could not complete the request.');
  }

  return body as T;
}

export function isSalesApiConfigured() {
  return Boolean(process.env.EXPO_PUBLIC_APPS_SCRIPT_URL?.trim());
}

export async function listSalesEntries(search?: string): Promise<SalesEntry[]> {
  const response = await request<ApiEnvelope>(
    getUrl({ action: 'list', search: search?.trim() }),
  );

  if (!Array.isArray(response.entries)) {
    throw new SalesApiError('Google Sheets returned an invalid entries list.');
  }

  return response.entries.map(parseEntry);
}

export async function listSalesEntryOptions(): Promise<SalesEntryOptions> {
  const response = await request<ApiEnvelope>(getUrl({ action: 'options' }));
  return parseOptions(response.options);
}

export async function getSalesSummary(): Promise<SalesSummaryTotals> {
  const response = await request<ApiEnvelope>(getUrl({ action: 'summary' }));
  return parseSalesSummary(response.summary);
}

export async function addSalesEntryOption(type: SalesOptionType, value: string): Promise<SalesEntryOptions> {
  const response = await request<ApiEnvelope>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'addOption', option: { type, value: value.trim() } }),
  });
  return parseOptions(response.options);
}

export async function createSalesEntry(input: SalesEntryInput): Promise<SalesEntry> {
  const response = await request<ApiEnvelope>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'create', entry: input }),
  });

  return parseEntry(response.entry);
}

export async function updateSalesEntry(
  entryId: string,
  input: SalesEntryInput,
): Promise<SalesEntry> {
  const response = await request<ApiEnvelope>(getApiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'update', entry: { ...input, entryId } }),
  });

  return parseEntry(response.entry);
}
