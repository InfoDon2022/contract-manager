const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  // Health
  health: () => request("/api/health"),

  // Contracts
  listContracts: () => request("/api/contracts"),
  getContract: (id) => request(`/api/contracts/${id}`),
  createContract: (data) => request("/api/contracts", { method: "POST", body: JSON.stringify(data) }),
  updateContract: (id, data) => request(`/api/contracts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Workstreams
  listWorkstreams: (contractId) => request(`/api/workstreams${contractId ? `?contract_id=${contractId}` : ""}`),
  createWorkstream: (data) => request("/api/workstreams", { method: "POST", body: JSON.stringify(data) }),
  deleteWorkstream: (id) => request(`/api/workstreams/${id}`, { method: "DELETE" }),

  // Vendors
  listVendors: () => request("/api/vendors"),
  getVendor: (id) => request(`/api/vendors/${id}`),
  createVendor: (data) => request("/api/vendors", { method: "POST", body: JSON.stringify(data) }),
  updateVendor: (id, data) => request(`/api/vendors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVendor: (id) => request(`/api/vendors/${id}`, { method: "DELETE" }),

  // Client Invoices
  listClientInvoices: (contractId) => request(`/api/client-invoices${contractId ? `?contract_id=${contractId}` : ""}`),
  createClientInvoice: (data) => request("/api/client-invoices", { method: "POST", body: JSON.stringify(data) }),
  updateClientInvoice: (id, data) => request(`/api/client-invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteClientInvoice: (id) => request(`/api/client-invoices/${id}`, { method: "DELETE" }),
  createClientPayment: (invoiceId, data) => request(`/api/client-invoices/${invoiceId}/payments`, { method: "POST", body: JSON.stringify(data) }),

  // Vendor Bills
  listVendorBills: (contractId, vendorId) => {
    const params = new URLSearchParams();
    if (contractId) params.set("contract_id", contractId);
    if (vendorId) params.set("vendor_id", vendorId);
    const qs = params.toString();
    return request(`/api/vendor-bills${qs ? `?${qs}` : ""}`);
  },
  createVendorBill: (data) => request("/api/vendor-bills", { method: "POST", body: JSON.stringify(data) }),
  updateVendorBill: (id, data) => request(`/api/vendor-bills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteVendorBill: (id) => request(`/api/vendor-bills/${id}`, { method: "DELETE" }),
  createVendorPayment: (billId, data) => request(`/api/vendor-bills/${billId}/payments`, { method: "POST", body: JSON.stringify(data) }),

  // Direct Costs
  listDirectCosts: (contractId) => request(`/api/direct-costs${contractId ? `?contract_id=${contractId}` : ""}`),
  createDirectCost: (data) => request("/api/direct-costs", { method: "POST", body: JSON.stringify(data) }),
  updateDirectCost: (id, data) => request(`/api/direct-costs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDirectCost: (id) => request(`/api/direct-costs/${id}`, { method: "DELETE" }),

  // Forecast
  listForecast: (contractId) => request(`/api/forecast${contractId ? `?contract_id=${contractId}` : ""}`),
  createForecast: (data) => request("/api/forecast", { method: "POST", body: JSON.stringify(data) }),
  updateForecast: (id, data) => request(`/api/forecast/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteForecast: (id) => request(`/api/forecast/${id}`, { method: "DELETE" }),

  // Bank Accounts
  listBankAccounts: () => request("/api/bank-accounts"),
  createBankAccount: (data) => request("/api/bank-accounts", { method: "POST", body: JSON.stringify(data) }),
  updateBankAccount: (id, data) => request(`/api/bank-accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: () => request("/api/dashboard"),

  // Reports
  reportPL: () => request("/api/reports/pl"),
  reportCashFlow: () => request("/api/reports/cash-flow"),
  reportVendorSummary: () => request("/api/reports/vendor-summary"),
  reportBilledVsCollected: () => request("/api/reports/billed-vs-collected"),
  reportForecastVsActual: () => request("/api/reports/forecast-vs-actual"),
};

export default api;
